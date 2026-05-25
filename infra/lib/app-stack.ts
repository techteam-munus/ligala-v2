import path from "node:path";
import { Stack, Duration, CfnOutput, type StackProps } from "aws-cdk-lib";
import type { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type * as rds from "aws-cdk-lib/aws-rds";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as iam from "aws-cdk-lib/aws-iam";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as amplify from "@aws-cdk/aws-amplify-alpha";
import { Monitoring } from "./monitoring";
import { AmplifyEnvInjector } from "./amplify-env-injector";

export interface AppStackProps extends StackProps {
  envName: string;
  vpc: ec2.IVpc;
  uploadsBucket: s3.IBucket;
  dbCluster: rds.DatabaseCluster;
  dbProxy: rds.DatabaseProxy;
  dbClientSecurityGroup: ec2.SecurityGroup;
  appSecret: secretsmanager.Secret;
  /** Optional email to subscribe to the alarm SNS topic. */
  alarmEmail?: string;
}

/**
 * AppStack: per-deploy compute. Two Lambdas (API + Migration) behind one HTTP
 * API Gateway. Both use the same code asset built by `apps/api/scripts/build.mjs`
 * (esbuild bundle + drizzle SQL files copied for the migration runner).
 */
export class AppStack extends Stack {
  public readonly monitoring: Monitoring;
  public readonly apiLambda: lambda.Function;
  public readonly migrateLambda: lambda.Function;
  public readonly httpApi: apigwv2.HttpApi;
  public readonly webApp: amplify.App;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    this.monitoring = new Monitoring(this, "Monitoring", {
      envName: props.envName,
      alarmEmail: props.alarmEmail,
    });

    // ── Shared Lambda asset ────────────────────────────────────────────────
    // Pre-built by `pnpm --filter @ligala/api build` — see
    // apps/api/scripts/build.mjs. Both functions share one upload; CDK
    // deduplicates by content hash.
    const apiAsset = lambda.Code.fromAsset(
      path.resolve(__dirname, "../../apps/api/dist"),
    );

    // Amplify default-domain pattern is `https://{branch}.{appId}.amplifyapp.com`.
    // The appId is a CFN token resolved at deploy time; we compose the URL up
    // front so the API Lambda's BETTER_AUTH_URL points at the eventual Amplify
    // origin from first deploy onward.
    const deployBranch = "develop";

    const commonEnv: Record<string, string> = {
      NODE_ENV: "production",
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
      DB_PROXY_ENDPOINT: props.dbProxy.endpoint,
      DB_MASTER_SECRET_ARN: props.dbCluster.secret!.secretArn,
      APP_SECRET_ARN: props.appSecret.secretArn,
      DB_NAME: "ligala",
      S3_UPLOADS_BUCKET: props.uploadsBucket.bucketName,
      // Set below after webApp is created — uses webApp.appId token.
    };

    // ── API Lambda ─────────────────────────────────────────────────────────
    this.apiLambda = new lambda.Function(this, "ApiLambda", {
      functionName: `ligala-v2-${props.envName}-api`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: "lambda.handler",
      code: apiAsset,
      memorySize: 1024,
      timeout: Duration.seconds(30),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.dbClientSecurityGroup],
      environment: commonEnv,
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: lambda.Tracing.DISABLED,
    });
    this.monitoring.attachLambdaErrors(this.apiLambda, "api");
    this.monitoring.attachLambdaThrottles(this.apiLambda, "api");
    this.monitoring.attachLambdaDurationP95(this.apiLambda, "api", 3000);

    // ── Migration Lambda ───────────────────────────────────────────────────
    // Same asset, different handler. Long timeout because future migrations
    // could include data backfills.
    this.migrateLambda = new lambda.Function(this, "MigrateLambda", {
      functionName: `ligala-v2-${props.envName}-migrate`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: "migrate-lambda.handler",
      code: apiAsset,
      memorySize: 512,
      timeout: Duration.minutes(5),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.dbClientSecurityGroup],
      environment: commonEnv,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });
    this.monitoring.attachLambdaErrors(this.migrateLambda, "migrate");

    // ── Permissions ────────────────────────────────────────────────────────
    props.dbCluster.secret!.grantRead(this.apiLambda);
    props.dbCluster.secret!.grantRead(this.migrateLambda);
    props.appSecret.grantRead(this.apiLambda);
    props.appSecret.grantRead(this.migrateLambda);
    props.uploadsBucket.grantReadWrite(this.apiLambda);
    // RDS Proxy IAM auth is off; password-based connection via the secret is
    // what both Lambdas use. No proxy-level grantConnect() needed.

    // ── Email queue + DLQ + worker ─────────────────────────────────────────
    const emailDlq = new sqs.Queue(this, "EmailDlq", {
      queueName: `ligala-v2-${props.envName}-email-dlq`,
      retentionPeriod: Duration.days(14),
    });
    const emailQueue = new sqs.Queue(this, "EmailQueue", {
      queueName: `ligala-v2-${props.envName}-email`,
      visibilityTimeout: Duration.seconds(60), // > worker timeout (30s)
      deadLetterQueue: { queue: emailDlq, maxReceiveCount: 3 },
    });

    const emailWorker = new lambda.Function(this, "EmailWorker", {
      functionName: `ligala-v2-${props.envName}-email-worker`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: "email/handler.handler",
      code: lambda.Code.fromAsset(path.resolve(__dirname, "../../workers/dist")),
      memorySize: 512,
      timeout: Duration.seconds(30),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.dbClientSecurityGroup],
      environment: {
        ...commonEnv,
        EMAIL_FROM: "no-reply@mymunus.com",
        EMAIL_REPLY_TO: "support@mymunus.com",
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });
    emailWorker.addEventSource(
      new SqsEventSource(emailQueue, {
        batchSize: 10,
        reportBatchItemFailures: true,
      }),
    );

    // Worker needs DB creds + app secret + SES send permission.
    props.dbCluster.secret!.grantRead(emailWorker);
    props.appSecret.grantRead(emailWorker);
    emailWorker.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: [
          `arn:aws:ses:${this.region}:${this.account}:identity/mymunus.com`,
        ],
      }),
    );

    // API Lambda produces to the queue.
    emailQueue.grantSendMessages(this.apiLambda);
    this.apiLambda.addEnvironment("EMAIL_QUEUE_URL", emailQueue.queueUrl);

    // Hard email verification: unverified users can't sign in until they
    // confirm. Enforced by the API Lambda's Better Auth instance — the web app
    // proxies all /api/auth/* here (next.config rewrite), so the API is the
    // single auth authority. Non-prod also enables the self-serve verify route
    // (/accounts/_dev/verify-email) so e2e automation can mark a freshly
    // signed-up user verified without a real inbox round-trip.
    this.apiLambda.addEnvironment("EMAIL_VERIFICATION_REQUIRED", "true");
    if (props.envName !== "prod") {
      this.apiLambda.addEnvironment("EMAIL_DEV_VERIFY_ENABLED", "true");
    }

    // Monitoring (per the "attach on the line the resource is created" convention).
    this.monitoring.attachLambdaErrors(emailWorker, "email-worker");
    this.monitoring.attachLambdaThrottles(emailWorker, "email-worker");
    this.monitoring.attachLambdaDurationP95(emailWorker, "email-worker", 5000);
    this.monitoring.attachDlqDepth(emailDlq, "email-dlq");

    // ── HTTP API Gateway ───────────────────────────────────────────────────
    this.httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: `ligala-v2-${props.envName}-api`,
      // CORS will be tightened to the Amplify origin in Phase 4. For first
      // deploy + smoke tests, allow any origin.
      corsPreflight: {
        allowHeaders: ["content-type", "authorization", "cookie"],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowOrigins: ["*"],
        allowCredentials: false,
        maxAge: Duration.hours(1),
      },
    });

    const integration = new apigwv2Integrations.HttpLambdaIntegration(
      "ApiIntegration",
      this.apiLambda,
    );

    // Catch-all route: every method + every path → the Hono handler.
    this.httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration,
    });
    // Root path needs its own route since {proxy+} doesn't match an empty path.
    this.httpApi.addRoutes({
      path: "/",
      methods: [apigwv2.HttpMethod.ANY],
      integration,
    });

    this.monitoring.attachApi5xx(this.httpApi, "api");
    this.monitoring.attachApiLatencyP95(this.httpApi, "api", 1000);

    // ── Amplify Hosting (web) ──────────────────────────────────────────────
    // No sourceCodeProvider: CDK creates the app shell, the user connects the
    // GitHub repo through the Amplify Console (which uses the AWS-Amplify
    // GitHub App). Subsequent pushes auto-build via the Console-managed
    // webhook + the amplify.yml at repo root.
    //
    // Env vars: we DON'T pass `environmentVariables` here. The full env-var
    // set (CDK-managed values + secret-derived values like BETTER_AUTH_SECRET)
    // is written by the AmplifyEnvInjector below, which owns this app's env
    // entirely. Passing them on App create would race with the injector's
    // update on every deploy.
    this.webApp = new amplify.App(this, "WebApp", {
      appName: `ligala-v2-${props.envName}-web`,
      platform: amplify.Platform.WEB_COMPUTE,
    });

    // Compose the URL the deploy branch will serve at so the API Lambda can
    // include it in BETTER_AUTH_URL from first deploy. If the branch is
    // renamed or a custom domain is added, re-set this env var.
    const webBranchUrl = `https://${deployBranch}.${this.webApp.appId}.amplifyapp.com`;
    this.apiLambda.addEnvironment("BETTER_AUTH_URL", webBranchUrl);

    // Inject Amplify env vars (CDK-managed + secret-derived). See construct
    // docstring for the rationale (avoids embedding secret values in the
    // CloudFormation template).
    new AmplifyEnvInjector(this, "WebEnv", {
      amplifyApp: this.webApp,
      sourceSecret: props.appSecret,
      baseEnvVars: {
        API_URL: this.httpApi.apiEndpoint,
        AMPLIFY_MONOREPO_APP_ROOT: "apps/web",
        AMPLIFY_DIFF_DEPLOY: "false",
        _LIVE_UPDATES: JSON.stringify([
          { name: "Node.js version", pkg: "node", type: "nvm", version: "20" },
        ]),
      },
      // Used by `apps/web/lib/ibp-verification-cookie.ts` to sign the
      // short-lived IBP-verification cookie. Same secret value as the API
      // Lambda so cookies stay valid across both surfaces.
      secretJsonKeys: ["BETTER_AUTH_SECRET"],
    });

    // ── Outputs ────────────────────────────────────────────────────────────
    new CfnOutput(this, "ApiUrl", {
      value: this.httpApi.apiEndpoint,
      description: "HTTP API Gateway invoke URL.",
    });
    new CfnOutput(this, "MigrateLambdaName", {
      value: this.migrateLambda.functionName,
      description:
        'Invoke: aws lambda invoke --function-name <this> --payload \'{"action":"migrate-and-seed"}\' out.json',
    });
    new CfnOutput(this, "ApiLambdaName", {
      value: this.apiLambda.functionName,
    });
    new CfnOutput(this, "WebAppId", {
      value: this.webApp.appId,
      description:
        "Amplify App ID. Connect this app to the GitHub develop branch in the Amplify Console.",
    });
    new CfnOutput(this, "WebUrl", {
      value: webBranchUrl,
      description: `Expected URL for the ${deployBranch} branch once connected.`,
    });
    new CfnOutput(this, "EmailQueueUrl", {
      value: emailQueue.queueUrl,
      description: "SQS URL for the email worker queue.",
    });
  }
}
