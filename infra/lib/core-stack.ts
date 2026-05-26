import {
  Stack,
  RemovalPolicy,
  Duration,
  CfnOutput,
  type StackProps,
} from "aws-cdk-lib";
import type { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

export interface CoreStackProps extends StackProps {
  envName: string;
  /**
   * Public custom domain (host, no scheme) in front of the Amplify default
   * domain — e.g. `dev.ligalaoffice.mymunus.com`. Added to the uploads bucket
   * CORS allowlist so browser presigned uploads work from it.
   */
  webCustomDomain?: string;
}

/**
 * CoreStack: long-lived foundation shared by every app deploy.
 *
 * Ships VPC, S3 uploads bucket, Aurora Serverless v2 Postgres behind RDS Proxy,
 * and the app secret in Secrets Manager. AppStack reads the cluster + proxy +
 * secret + uploads bucket via cross-stack references.
 *
 * Deferred (added when the feature lands):
 *   - Redis ElastiCache (no rate-limiter using it yet)
 *   - SES verified identities (no outbound mail wired yet)
 */
export class CoreStack extends Stack {
  public readonly vpc: ec2.IVpc;
  public readonly uploadsBucket: s3.IBucket;
  public readonly dbCluster: rds.DatabaseCluster;
  public readonly dbProxy: rds.DatabaseProxy;
  public readonly dbClientSecurityGroup: ec2.SecurityGroup;
  public readonly appSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: CoreStackProps) {
    super(scope, id, props);

    const isProd = props.envName === "prod";

    // ── VPC ────────────────────────────────────────────────────────────────
    this.vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: isProd ? 2 : 1,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        {
          name: "private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: "isolated",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // Gateway endpoint keeps S3 traffic on AWS backbone.
    this.vpc.addGatewayEndpoint("S3Endpoint", {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // Interface endpoint so Lambdas in private subnets can reach Secrets Manager
    // without crossing the NAT (cheaper + lower-latency than NAT egress).
    this.vpc.addInterfaceEndpoint("SecretsManagerEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // ── S3 uploads bucket ──────────────────────────────────────────────────
    // CORS: browsers PUT directly to the presigned URL after the API hands one
    // out, so the bucket must allow every origin the app is served from — the
    // Amplify default domain, localhost (dev), and the custom domain when set.
    // Without the custom domain here, its presigned uploads fail the CORS
    // preflight (no Access-Control-Allow-Origin on the OPTIONS response).
    const uploadOrigins = [
      "https://*.amplifyapp.com",
      "http://localhost:3000",
      ...(props.webCustomDomain ? [`https://${props.webCustomDomain}`] : []),
    ];
    this.uploadsBucket = new s3.Bucket(this, "UploadsBucket", {
      bucketName: `ligala-v2-${props.envName}-uploads`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      lifecycleRules: [
        { abortIncompleteMultipartUploadAfter: Duration.days(7) },
      ],
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.PUT,
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: uploadOrigins,
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ],
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    // ── Aurora Serverless v2 Postgres ──────────────────────────────────────
    // Cluster SG: no rules of its own; ingress is added below from the
    // `dbClientSecurityGroup` marker SG so AppStack only needs to attach the
    // marker SG to its Lambda — no cross-stack SG rule wiring.
    const dbClusterSecurityGroup = new ec2.SecurityGroup(
      this,
      "DbClusterSg",
      {
        vpc: this.vpc,
        description: "Aurora cluster - accepts traffic from db-client SG only",
        allowAllOutbound: false,
      },
    );

    this.dbClientSecurityGroup = new ec2.SecurityGroup(
      this,
      "DbClientSg",
      {
        vpc: this.vpc,
        description:
          "Marker SG: anything attached to this is allowed into the Aurora cluster + proxy",
        allowAllOutbound: true,
      },
    );

    dbClusterSecurityGroup.addIngressRule(
      this.dbClientSecurityGroup,
      ec2.Port.tcp(5432),
      "Postgres from db-client SG",
    );

    this.dbCluster = new rds.DatabaseCluster(this, "Database", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbClusterSecurityGroup],
      defaultDatabaseName: "ligala",
      credentials: rds.Credentials.fromGeneratedSecret("ligala_admin", {
        secretName: `ligala-v2-${props.envName}-db-master`,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: isProd ? 4 : 1,
      writer: rds.ClusterInstance.serverlessV2("writer"),
      readers: isProd
        ? [rds.ClusterInstance.serverlessV2("reader", { scaleWithWriter: true })]
        : undefined,
      backup: {
        retention: isProd ? Duration.days(7) : Duration.days(1),
      },
      storageEncrypted: true,
      deletionProtection: isProd,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // ── RDS Proxy ──────────────────────────────────────────────────────────
    // The Drizzle client (packages/db/src/client.ts) is already configured for
    // RDS Proxy: max: 1, prepare: false — don't change those without
    // re-checking pinning behavior.
    this.dbProxy = new rds.DatabaseProxy(this, "DatabaseProxy", {
      proxyTarget: rds.ProxyTarget.fromCluster(this.dbCluster),
      secrets: [this.dbCluster.secret!],
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbClusterSecurityGroup],
      requireTLS: true,
      iamAuth: false,
      idleClientTimeout: Duration.minutes(30),
      maxConnectionsPercent: 95,
    });

    // ── Proxy ⇄ cluster connectivity ───────────────────────────────────────
    // The proxy and the cluster both run in `dbClusterSecurityGroup`, so the
    // proxy's backend connections to Aurora (tcp/5432) are intra-SG traffic.
    // CDK's DatabaseProxy construct adds an implicit self-rule for this, but we
    // declare it explicitly so the dependency is visible in code and re-asserted
    // on every deploy (egress is required because allowAllOutbound is false).
    //
    // ⚠️  Do NOT detach the cluster from this SG — e.g. a manual
    // `modify-db-cluster --vpc-security-group-ids ...` to get direct access.
    // Moving the cluster to another SG silently black-holes the proxy→DB path:
    // the proxy can't open backend connections, and every query times out with
    // RDS Proxy "Timed-out waiting to acquire database connection" (surfaces as
    // 504s on SSR pages). For ad-hoc direct access, port-forward to the proxy
    // endpoint through the bastion + SSM instead (see the bastion comment below).
    dbClusterSecurityGroup.addIngressRule(
      dbClusterSecurityGroup,
      ec2.Port.tcp(5432),
      "Proxy to Aurora (intra cluster SG)",
    );
    dbClusterSecurityGroup.addEgressRule(
      dbClusterSecurityGroup,
      ec2.Port.tcp(5432),
      "Proxy to Aurora (intra cluster SG)",
    );

    // ── App secret ─────────────────────────────────────────────────────────
    // One Secrets Manager entry holds:
    //   - BETTER_AUTH_SECRET (auto-generated, 64 chars, no punctuation)
    //   - placeholder slots for provider keys (filled in via console when keys
    //     are provisioned; API handlers gracefully no-op when unset).
    this.appSecret = new secretsmanager.Secret(this, "AppSecret", {
      secretName: `ligala-v2-${props.envName}-app`,
      description: "Ligala app secrets: auth signing key + provider credentials",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          PAYMONGO_SECRET_KEY: "",
          PAYMONGO_WEBHOOK_SECRET: "",
          // Disbursements / payouts (PayMongo batch_transfers). The wallet is the
          // platform source account funds are transferred FROM; the transfer
          // webhook secret verifies the /webhooks/paymongo-transfer callback.
          // Until these are filled, payouts resolve to the dev_simulate provider
          // (no real transfer) — see apps/api/src/routes/payouts.ts.
          PAYMONGO_WALLET_ACCOUNT_NUMBER: "",
          PAYMONGO_WALLET_ACCOUNT_NAME: "",
          PAYMONGO_WALLET_BIC: "",
          PAYMONGO_TRANSFER_WEBHOOK_SECRET: "",
          PAYPAL_CLIENT_ID: "",
          PAYPAL_CLIENT_SECRET: "",
          PAYPAL_WEBHOOK_ID: "",
          IDMETA_BASE_URL: "",
          IDMETA_TOKEN: "",
          IDMETA_TEMPLATE_ID: "",
          IDMETA_WEBHOOK_SECRET: "",
          SENTRY_DSN: "",
        }),
        generateStringKey: "BETTER_AUTH_SECRET",
        excludePunctuation: true,
        passwordLength: 64,
      },
    });

    // ── Bastion (non-prod only) ────────────────────────────────────────────
    // t4g.nano in PRIVATE_WITH_EGRESS with DbClientSg attached. No SSH key,
    // no public IP, no inbound rules — all access is via SSM Session Manager
    // (outbound only, polled by the SSM agent built into Amazon Linux 2023).
    // Use case: DBeaver/psql port-forwarding to the RDS Proxy from a laptop.
    //
    // Stop the instance when not in use to drop bill to ~$0 (root EBS only).
    // Connect:
    //   aws ssm start-session --target <BastionInstanceId> \
    //     --document-name AWS-StartPortForwardingSessionToRemoteHost \
    //     --parameters host=<DbProxyEndpoint>,portNumber=5432,localPortNumber=5432
    // Then point DBeaver at localhost:5432 with creds from the DbMasterSecret.
    if (!isProd) {
      const bastionRole = new iam.Role(this, "BastionRole", {
        assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            "AmazonSSMManagedInstanceCore",
          ),
        ],
      });

      const bastion = new ec2.Instance(this, "Bastion", {
        vpc: this.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T4G,
          ec2.InstanceSize.NANO,
        ),
        machineImage: ec2.MachineImage.latestAmazonLinux2023({
          cpuType: ec2.AmazonLinuxCpuType.ARM_64,
        }),
        role: bastionRole,
        securityGroup: this.dbClientSecurityGroup,
        requireImdsv2: true,
        blockDevices: [
          {
            deviceName: "/dev/xvda",
            volume: ec2.BlockDeviceVolume.ebs(8, {
              volumeType: ec2.EbsDeviceVolumeType.GP3,
              encrypted: true,
              deleteOnTermination: true,
            }),
          },
        ],
      });

      new CfnOutput(this, "BastionInstanceId", {
        value: bastion.instanceId,
        description:
          "EC2 bastion for SSM port-forwarding into the VPC. Stop when idle.",
      });
    }

    // ── Outputs ────────────────────────────────────────────────────────────
    new CfnOutput(this, "VpcId", { value: this.vpc.vpcId });
    new CfnOutput(this, "UploadsBucketName", {
      value: this.uploadsBucket.bucketName,
    });
    new CfnOutput(this, "DbProxyEndpoint", {
      value: this.dbProxy.endpoint,
      description:
        "Use this hostname in DATABASE_URL. Port 5432, database 'ligala'.",
    });
    new CfnOutput(this, "DbMasterSecretArn", {
      value: this.dbCluster.secret!.secretArn,
      description:
        "Master credentials (username + password). Read for one-off psql / migrations.",
    });
    new CfnOutput(this, "AppSecretArn", {
      value: this.appSecret.secretArn,
      description:
        "Application secrets (BETTER_AUTH_SECRET + provider key slots).",
    });
    new CfnOutput(this, "DbClientSgId", {
      value: this.dbClientSecurityGroup.securityGroupId,
      description:
        "Attach this SG to any Lambda/EC2 that needs to talk to the database.",
    });
  }
}
