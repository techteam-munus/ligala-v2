import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cwActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubs from "aws-cdk-lib/aws-sns-subscriptions";
import type * as lambda from "aws-cdk-lib/aws-lambda";
import type * as sqs from "aws-cdk-lib/aws-sqs";
import type * as apigw2 from "aws-cdk-lib/aws-apigatewayv2";

export interface MonitoringProps {
  envName: string;
  /** Email to subscribe to the alarm SNS topic. Optional. */
  alarmEmail?: string;
}

/**
 * Monitoring: shared SNS topic + factories for the alarms every Lambda /
 * queue / API Gateway in AppStack should attach. AppStack instantiates this
 * once and calls the attach* helpers as the resources are created.
 *
 * Defaults are intentionally tight for an MVP — tune after Phase 8 load tests.
 */
export class Monitoring extends Construct {
  public readonly topic: sns.Topic;
  private readonly action: cwActions.SnsAction;

  constructor(scope: Construct, id: string, props: MonitoringProps) {
    super(scope, id);

    this.topic = new sns.Topic(this, "AlarmTopic", {
      displayName: `Ligala ${props.envName} alarms`,
    });

    if (props.alarmEmail) {
      this.topic.addSubscription(new snsSubs.EmailSubscription(props.alarmEmail));
    }

    this.action = new cwActions.SnsAction(this.topic);
  }

  /** Lambda function errors → alarm on >0 errors in 5 minutes. */
  attachLambdaErrors(fn: lambda.IFunction, name: string) {
    const alarm = new cloudwatch.Alarm(this, `${name}-Errors`, {
      alarmName: `${name}-errors`,
      alarmDescription: `${name} returned 1+ errors in 5 minutes`,
      metric: fn.metricErrors({ period: Duration.minutes(5), statistic: "sum" }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    alarm.addAlarmAction(this.action);
    return alarm;
  }

  /** Lambda throttles → alarm on any throttle in 5 minutes. */
  attachLambdaThrottles(fn: lambda.IFunction, name: string) {
    const alarm = new cloudwatch.Alarm(this, `${name}-Throttles`, {
      alarmName: `${name}-throttles`,
      alarmDescription: `${name} was throttled in 5 minutes`,
      metric: fn.metricThrottles({ period: Duration.minutes(5), statistic: "sum" }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    alarm.addAlarmAction(this.action);
    return alarm;
  }

  /** Lambda duration p95 → alarm when over thresholdMs. */
  attachLambdaDurationP95(fn: lambda.IFunction, name: string, thresholdMs = 3000) {
    const alarm = new cloudwatch.Alarm(this, `${name}-DurationP95`, {
      alarmName: `${name}-duration-p95`,
      alarmDescription: `${name} p95 duration > ${thresholdMs}ms`,
      metric: fn.metricDuration({ period: Duration.minutes(5), statistic: "p95" }),
      threshold: thresholdMs,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    alarm.addAlarmAction(this.action);
    return alarm;
  }

  /** SQS DLQ depth → alarm when any message lands. */
  attachDlqDepth(queue: sqs.IQueue, name: string) {
    const alarm = new cloudwatch.Alarm(this, `${name}-Depth`, {
      alarmName: `${name}-depth`,
      alarmDescription: `${name} has 1+ messages — investigate failed processing`,
      metric: queue.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(5),
        statistic: "max",
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    alarm.addAlarmAction(this.action);
    return alarm;
  }

  /** HTTP API 5xx rate → alarm when >1% of requests fail server-side. */
  attachApi5xx(api: apigw2.IHttpApi, name: string) {
    const errors = new cloudwatch.Metric({
      namespace: "AWS/ApiGateway",
      metricName: "5xx",
      dimensionsMap: { ApiId: api.apiId },
      statistic: "sum",
      period: Duration.minutes(5),
    });
    const requests = new cloudwatch.Metric({
      namespace: "AWS/ApiGateway",
      metricName: "Count",
      dimensionsMap: { ApiId: api.apiId },
      statistic: "sum",
      period: Duration.minutes(5),
    });
    const rate = new cloudwatch.MathExpression({
      expression: "100 * (errors / IF(requests, requests, 1))",
      usingMetrics: { errors, requests },
      period: Duration.minutes(5),
      label: "5xx %",
    });
    const alarm = new cloudwatch.Alarm(this, `${name}-5xxRate`, {
      alarmName: `${name}-5xx-rate`,
      alarmDescription: `${name} 5xx rate > 1% over 5 minutes`,
      metric: rate,
      threshold: 1,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    alarm.addAlarmAction(this.action);
    return alarm;
  }

  /** HTTP API latency p95 → alarm when over thresholdMs. */
  attachApiLatencyP95(api: apigw2.IHttpApi, name: string, thresholdMs = 1000) {
    const metric = new cloudwatch.Metric({
      namespace: "AWS/ApiGateway",
      metricName: "Latency",
      dimensionsMap: { ApiId: api.apiId },
      statistic: "p95",
      period: Duration.minutes(5),
    });
    const alarm = new cloudwatch.Alarm(this, `${name}-LatencyP95`, {
      alarmName: `${name}-latency-p95`,
      alarmDescription: `${name} p95 latency > ${thresholdMs}ms`,
      metric,
      threshold: thresholdMs,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    alarm.addAlarmAction(this.action);
    return alarm;
  }
}
