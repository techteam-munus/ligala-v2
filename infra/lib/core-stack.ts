import { Stack, StackProps, RemovalPolicy, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as s3 from "aws-cdk-lib/aws-s3";

export interface CoreStackProps extends StackProps {
  envName: string;
}

/**
 * CoreStack: long-lived foundation shared by every app deploy.
 *
 * Phase 0 ships VPC + S3 uploads bucket so AppStack has something to attach to.
 * Phase 1+ adds:
 *   - Aurora Serverless v2 Postgres cluster + RDS Proxy
 *   - Redis ElastiCache (cluster mode)
 *   - SES verified identities
 *   - Secrets Manager entries (DB creds, OAuth, payments, IDMeta)
 */
export class CoreStack extends Stack {
  public readonly vpc: ec2.IVpc;
  public readonly uploadsBucket: s3.IBucket;

  constructor(scope: Construct, id: string, props: CoreStackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: props.envName === "prod" ? 2 : 1,
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
    this.vpc.addGatewayEndpoint("S3Endpoint", { service: ec2.GatewayVpcEndpointAwsService.S3 });

    this.uploadsBucket = new s3.Bucket(this, "UploadsBucket", {
      bucketName: `ligala-v2-${props.envName}-uploads`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: Duration.days(7),
        },
      ],
      removalPolicy:
        props.envName === "prod" ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: props.envName !== "prod",
    });
  }
}
