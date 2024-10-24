import * as cdk from 'aws-cdk-lib';
import { InterfaceVpcEndpointAwsService, Port, SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster, ContainerImage, FargateService, FargateTaskDefinition, LogDrivers } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancer, NetworkListenerAction, NetworkLoadBalancer, NetworkTargetGroup, TargetType } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { AlbArnTarget } from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import { Construct } from 'constructs';

export class AwsNlbToAlbStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, 'app-vpc');
    
    vpc.addInterfaceEndpoint('nlb-to-alb-vpce', {
      service: InterfaceVpcEndpointAwsService.ELASTIC_LOAD_BALANCING,
      open: true,
      privateDnsEnabled: true,
    });

    const cluster = new Cluster(this, 'Cluster', { vpc });

    const taskDefinition = new FargateTaskDefinition(this, 'taskDef');

    const container = taskDefinition.addContainer('myContainer', {
      image: ContainerImage.fromRegistry('nginx'),
      memoryLimitMiB: 256,
      cpu: 256,
      portMappings: [{
        containerPort: 80,
        hostPort: 80
      }],
      logging: LogDrivers.awsLogs({streamPrefix: 'my-service'}),
    });

    const ecsService = new FargateService(this, 'Service', {
      cluster,
      taskDefinition,
      desiredCount: 1,
      capacityProviderStrategies: [
        { capacityProvider: 'FARGATE_SPOT', weight: 100 }
      ]
    });

    const alb = new ApplicationLoadBalancer(this, 'alb', {
      vpc
    });

    const listener = alb.addListener('alb-listener', {
      port: 80
    });

    listener.addTargets('alb-target', {
      port: 80,
      targets: [ecsService],
      healthCheck: {
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 5,
        timeout: cdk.Duration.seconds(10),
        interval: cdk.Duration.seconds(20)
      }
    });

    const alb_tg = new AlbArnTarget(alb.loadBalancerArn, 80);
    const net_tg = new NetworkTargetGroup(this, 'nlb-tg-alb', {
      vpc,
      port: 80,
      targetType: TargetType.ALB,
      targets: [alb_tg], 
    });

    const nlb_sg = new SecurityGroup(this, 'nlb-sg', { vpc });
    const nlb = new NetworkLoadBalancer(this, 'public-nlb', { 
      vpc,
      securityGroups: [nlb_sg],
      crossZoneEnabled: true,
      internetFacing: true,
    });
    const nlbHttpListener = nlb.addListener('http-listener', {
      port: 80,
      defaultAction: NetworkListenerAction.forward([net_tg])
    });
    
    new cdk.CfnOutput(this, 'nlb-url', {
      value: `http://${nlb.loadBalancerDnsName}`,
      exportName: 'nlb-domainName'
    });
    
    alb.connections.allowFrom(nlb, Port.tcp(80));
    
  }
}
