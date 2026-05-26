#!/usr/bin/env node
import "source-map-support/register";
import { App, Tags } from "aws-cdk-lib";
import { CoreStack } from "../lib/core-stack";
import { AppStack } from "../lib/app-stack";

const app = new App();

const envName = (app.node.tryGetContext("env") as string | undefined) ?? "dev";
// Public custom domain in front of the Amplify default domain, if any. Drives
// the API Lambda's BETTER_AUTH_URL + trusted origins so auth (esp. sign-out)
// works from it. Overridable with `-c webCustomDomain=...`; the dev env defaults
// to its known custom domain so every cdk command (synth/diff/deploy) is
// consistent without an extra flag.
const webCustomDomain =
  (app.node.tryGetContext("webCustomDomain") as string | undefined) ??
  (envName === "dev" ? "dev.ligalaoffice.mymunus.com" : undefined);
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION ?? "ap-southeast-1";

const env = { account, region };
const prefix = `Ligala-${envName}`;

const core = new CoreStack(app, `${prefix}-Core`, { env, envName });
new AppStack(app, `${prefix}-App`, {
  env,
  envName,
  vpc: core.vpc,
  uploadsBucket: core.uploadsBucket,
  dbCluster: core.dbCluster,
  dbProxy: core.dbProxy,
  dbClientSecurityGroup: core.dbClientSecurityGroup,
  appSecret: core.appSecret,
  alarmEmail: process.env.ALARM_EMAIL,
  webCustomDomain,
});

Tags.of(app).add("Project", "ligala-v2");
Tags.of(app).add("Environment", envName);
