export interface EcsInstance {
  instanceId?: string;
  instanceName?: string;
  status?: string;
  instanceType?: string;
  publicIpAddress?: {
    ipAddress?: string[];
  };
  networkInterfaces?: {
    networkInterface?: Array<{
      primaryIpAddress?: string;
    }>;
  };
  creationTime?: string;
  osType?: string;
  osName?: string;
  cpu?: number;
  memory?: number;
}

export interface DescribeInstancesResponse {
  instances?: {
    instance?: EcsInstance[];
  };
}
