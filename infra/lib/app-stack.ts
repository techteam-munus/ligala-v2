import { Stack, type StackProps } from "aws-cdk-lib";
import type { Construct } from "constructs";
import type * as ec2 from "aws-cdk-lib/aws-ec2";
import type * as s3 from "aws-cdk-lib/aws-s3";
import { Monitoring } from "./monitoring";

export interface AppStackProps extends StackProps {
  envName: string;
  vpc: ec2.IVpc;
  uploadsBucket: s3.IBucket;
  /** Optional email to subscribe to the alarm SNS topic. */
  alarmEmail?: string;
}

/**
 * AppStack: everything that ships with each app deploy.
 *
 * Phase 0/8 ships the Monitoring construct (SNS topic + alarm factories).
 * Phase 0/1+ adds:
 *   - Hono API Lambda (NodejsFunction) + HTTP API Gateway
 *   - Sharp Lambda layer
 *   - SQS queues + DLQs (webhooks-paymongo, webhooks-paypal, webhooks-idmeta,
 *     email-outbound, image-process, notifications)
 *   - Worker Lambdas wired to each queue
 *   - EventBridge Scheduler rules for cron jobs
 *   - Amplify app (or SST Next adapter) hosting apps/web
 *
 * As each resource lands, call monitoring.attach*() to wire the standard
 * alarms — keeps observability discipline at construction time, not later.
 */
export class AppStack extends Stack {
  public readonly monitoring: Monitoring;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    this.monitoring = new Monitoring(this, "Monitoring", {
      envName: props.envName,
      alarmEmail: props.alarmEmail,
    });

    // Touch props so unused warnings don't trip CI; resources arrive in Phase 0/1.
    void props.vpc;
    void props.uploadsBucket;
    void props.envName;
  }
}
