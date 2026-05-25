import { CustomResource, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cr from "aws-cdk-lib/custom-resources";
import type * as amplify from "@aws-cdk/aws-amplify-alpha";
import type * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

export interface AmplifyEnvInjectorProps {
  amplifyApp: amplify.App;
  /** Secret whose JSON body holds the values to copy into Amplify env. */
  sourceSecret: secretsmanager.ISecret;
  /**
   * Env vars CDK itself sets on the Amplify app (the ones declared in
   * `environmentVariables` when creating the app). The injector merges these
   * with the secret-derived values so a redeploy can't drop them.
   */
  baseEnvVars: Record<string, string>;
  /** JSON keys to copy from the secret into the merged env. */
  secretJsonKeys: readonly string[];
}

/**
 * Copies selected JSON fields from a Secrets Manager secret into an Amplify
 * app's environment variables every time CDK deploys this stack.
 *
 * Why: Amplify Hosting compute (the SSR Lambda) reads its env vars from the
 * Amplify app config, not from Secrets Manager. We don't want to embed the
 * actual secret value into the CloudFormation template (it would leak via
 * stack output/template downloads), so a deploy-time hook reads the secret
 * from SM and patches the Amplify app config out-of-band.
 *
 * The CDK-managed `environmentVariables` on the app would otherwise overwrite
 * our injected keys on every deploy — so we also re-write the CDK-managed
 * vars from `baseEnvVars`. Effectively this resource owns the *full* env-var
 * set on the Amplify app from creation onward.
 */
export class AmplifyEnvInjector extends Construct {
  constructor(scope: Construct, id: string, props: AmplifyEnvInjectorProps) {
    super(scope, id);

    const handler = new lambda.Function(this, "Handler", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      timeout: Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_MONTH,
      code: lambda.Code.fromInline(`
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { AmplifyClient, UpdateAppCommand } = require("@aws-sdk/client-amplify");

exports.handler = async (event) => {
  const physicalId = event.PhysicalResourceId || event.ResourceProperties.amplifyAppId;
  if (event.RequestType === "Delete") {
    // Leave the env vars in place; another CR or manual edit may own them post-deletion.
    return { PhysicalResourceId: physicalId };
  }
  const { amplifyAppId, secretArn, baseEnvVars, secretJsonKeys } = event.ResourceProperties;
  const sm = new SecretsManagerClient({});
  const result = await sm.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (!result.SecretString) throw new Error("Secret has no SecretString");
  const parsed = JSON.parse(result.SecretString);
  const merged = { ...baseEnvVars };
  for (const k of secretJsonKeys) {
    const v = parsed[k];
    if (typeof v === "string" && v.length > 0) merged[k] = v;
  }
  const amp = new AmplifyClient({});
  await amp.send(new UpdateAppCommand({ appId: amplifyAppId, environmentVariables: merged }));
  return { PhysicalResourceId: amplifyAppId };
};
`),
    });

    props.sourceSecret.grantRead(handler);
    handler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["amplify:UpdateApp"],
        resources: [props.amplifyApp.arn],
      }),
    );

    const provider = new cr.Provider(this, "Provider", {
      onEventHandler: handler,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    new CustomResource(this, "Resource", {
      serviceToken: provider.serviceToken,
      properties: {
        amplifyAppId: props.amplifyApp.appId,
        secretArn: props.sourceSecret.secretArn,
        baseEnvVars: props.baseEnvVars,
        secretJsonKeys: props.secretJsonKeys,
        // Forces the CR to re-run on every deploy so Amplify env stays in sync
        // even when only `baseEnvVars` changes (CFN otherwise diffs as no-op).
        deployedAt: new Date().toISOString(),
      },
    });
  }
}
