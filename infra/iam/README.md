# Manual IAM artifacts

Policies in this folder are **not** managed by CDK. They configure the
boundary between GitHub Actions and the CDK toolchain itself — the role
that runs `cdk deploy` cannot manage its own policies via the stack it
deploys.

## `gha-deploy-role-policy.json`

The inline policy attached to `GithubActionsDeploy-Ligala-dev`. Grants
exactly the `sts:AssumeRole` permissions needed to run `cdk deploy` end
to end:

- `cdk-hnb659fds-deploy-role-<acct>-<region>` — CloudFormation create /
  update / delete operations against the stacks. This role itself holds
  the broad IAM/EC2/S3/etc. permissions; the GHA role only borrows them
  via this assume.
- `cdk-hnb659fds-file-publishing-role-<acct>-<region>` — uploads the
  bundled Lambda asset to the CDK bootstrap S3 bucket.
- `cdk-hnb659fds-image-publishing-role-<acct>-<region>` — declared in
  case we add a container Lambda or ECS service later; harmless until
  used.

There is no `cdk-hnb659fds-lookup-role` in this account (CDK falls back
to the deploy role for context lookups when none exists).

## Apply / re-apply

```bash
aws iam put-role-policy \
  --role-name GithubActionsDeploy-Ligala-dev \
  --policy-name CdkBootstrapAssume \
  --policy-document file://infra/iam/gha-deploy-role-policy.json \
  --region ap-southeast-1
```

Then detach the broad managed policy that the role started with:

```bash
aws iam detach-role-policy \
  --role-name GithubActionsDeploy-Ligala-dev \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

If a future deploy fails on permissions, **first** add the missing
action to this file (commit the change so it's auditable), then
re-apply — don't fall back to `AdministratorAccess`.
