import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as s3 from "aws-cdk-lib/aws-s3";

export interface AppStackProps extends StackProps {
  envName: string;
  vpc: ec2.IVpc;
  uploadsBucket: s3.IBucket;
}

/**
 * AppStack: everything that ships with each app deploy.
 *
 * Phase 0 is intentionally empty — the stack exists so cdk synth produces both
 * stacks and the deploy pipeline already addresses the right names.
 *
 * Phase 0/1 adds:
 *   - Hono API Lambda (NodejsFunction) + HTTP API Gateway
 *   - Sharp Lambda layer
 *   - SQS queues + DLQs (webhooks-paymongo, webhooks-paypal, webhooks-idmeta,
 *     email-outbound, image-process, notifications)
 *   - Worker Lambdas wired to each queue
 *   - EventBridge Scheduler rules for cron jobs
 *   - Amplify app (or SST Next adapter) hosting apps/web
 *   - CloudWatch dashboards + alarms
 */
export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    // Touch props so unused warnings don't trip CI; resources arrive in Phase 0/1.
    void props.vpc;
    void props.uploadsBucket;
    void props.envName;
  }
}
