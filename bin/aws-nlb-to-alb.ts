#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsNlbToAlbStack } from '../lib/aws-nlb-to-alb-stack';

const app = new cdk.App();
new AwsNlbToAlbStack(app, 'AwsNlbToAlbStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});