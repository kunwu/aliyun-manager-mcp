#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { DescribeInstancesRequest } from '@alicloud/ecs20140526';
import { createEcsClient, getBillingDetails, generateBillingHtmlReport } from './clients/aliyun.js'; 
import { writeFile, mkdir } from 'fs/promises';
import path from 'path'; // Node.js path module

class AliyunManagerServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'aliyun-manager-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    
    // Error handling
    this.server.onerror = (error: Error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_instances',
          description: 'List Aliyun ECS instances',
          inputSchema: {
            type: 'object',
            properties: {
              region: {
                type: 'string',
                description: 'Aliyun region ID',
                default: 'cn-hangzhou'
              },
              pageSize: {
                type: 'number',
                description: 'Number of instances per page',
                default: 100,
                minimum: 1,
                maximum: 100
              }
            }
          }
        },
        // definition for detailed billing info
        {
          name: 'get_billing_info',
          description: 'Get detailed daily Aliyun billing breakdown (original, discount, actual) for the last N days, aggregated by date and product code.',
          inputSchema: {
            type: 'object',
            properties: {
              days: {
                type: 'number',
                description: 'Number of past days to fetch billing for (1-30)',
                default: 7,
                minimum: 1,
                maximum: 30
              }
            }
          }
        },
        // tool definition for detailed billing report export
        {
          name: 'export_billing_report',
          description: 'Fetch detailed Aliyun billing data (original, discount, actual) and export it as an HTML report styled with Tailwind CSS.',
          inputSchema: {
            type: 'object',
            properties: {
              days: {
                type: 'number',
                description: 'Number of past days to fetch billing for (1-30)',
                default: 7,
                minimum: 1,
                maximum: 30
              },
                output_path: {
                  type: 'string',
                  description: 'Path to save the HTML report file (relative to project root).',
                  default: 'exported/aliyun_billing_report.html' // Changed default subfolder
                }
              }
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (toolRequest) => {
      const toolName = toolRequest.params.name;
      const args = toolRequest.params.arguments || {};

      // Handle list_instances tool
      if (toolName === 'list_instances') {
        try {
          console.error('Debug: Creating ECS client...');
          const client = createEcsClient();
          console.error('Debug: Client created successfully');
          
          console.error('Debug: Creating ECS request with region:', args.region || process.env.ALIBABA_CLOUD_REGION);
          const ecsRequest = new DescribeInstancesRequest({
            regionId: args.region || process.env.ALIBABA_CLOUD_REGION,
            pageSize: args.pageSize || 100
          });
          
          console.error('Debug: Sending request to Aliyun API...');
          const response = await client.describeInstances(ecsRequest);
          console.error('Debug: Response received, instances count:', response.body.instances?.instance?.length || 0);
          const instances = response.body.instances?.instance || [];
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                instances: instances.map((instance: any) => ({
                  id: instance.instanceId,
                  name: instance.instanceName,
                  status: instance.status,
                  type: instance.instanceType,
                  publicIp: instance.publicIpAddress?.ipAddress?.[0] || null,
                  privateIp: instance.networkInterfaces?.networkInterface?.[0]?.primaryIpAddress || null,
                  region: args.region || process.env.ALIBABA_CLOUD_REGION,
                  creationTime: instance.creationTime,
                  osType: instance.osType,
                  osName: instance.osName,
                  cpu: instance.cpu,
                  memory: instance.memory
                })),
                total: instances.length,
                region: args.region || process.env.ALIBABA_CLOUD_REGION
              }, null, 2)
            }]
          };

        } catch (error) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to list ECS instances: ${error instanceof Error ? error.message : error}`
          );
        }
      } 
      // Handle get_billing_info tool
      else if (toolName === 'get_billing_info') {
        try {
          // More robust type check for days argument
          const days = typeof args.days === 'number' && args.days >= 1 && args.days <= 30 ? args.days : 7; 
          console.error(`Debug: Calling getBillingDetails for ${days} days...`);
          const billingData = await getBillingDetails(days);
          console.error('Debug: Billing data received successfully.');
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(billingData, null, 2)
            }]
          };
        } catch (error) {
           throw new McpError(
            ErrorCode.InternalError,
            `Failed to get billing info: ${error instanceof Error ? error.message : error}`
          );
        }
      } 
       // Handle export_billing_report tool 
       else if (toolName === 'export_billing_report') {
         try {
           // Type checking for arguments
           const days = (typeof args.days === 'number' && args.days >= 1 && args.days <= 30) ? args.days : 7;
           // Correct fallback to use the schema's default path structure
           const outputPath = (typeof args.output_path === 'string' && args.output_path.trim() !== '') ? args.output_path : 'exported/aliyun_billing_report.html'; // Ensure this matches schema default
           
           console.error(`Debug: Calling getBillingDetails for report (${days} days)...`);
           const billingData = await getBillingDetails(days);
           console.error('Debug: Billing data received for report.');

           console.error('Debug: Generating HTML report...');
           const htmlContent = generateBillingHtmlReport(billingData);
           console.error('Debug: HTML report generated.');

           // Resolve path relative to the project directory using __dirname and path.join
           const projectRoot = path.resolve(__dirname, '..'); // Go up one level from build/ to project root
           const finalOutputPath = path.join(projectRoot, outputPath); // Use path.join
           
           console.error(`Debug: Writing HTML report to ${finalOutputPath}...`);
           // Ensure the directory exists before writing
           await mkdir(path.dirname(finalOutputPath), { recursive: true }); 
           await writeFile(finalOutputPath, htmlContent, 'utf8');
           console.error('Debug: HTML report saved successfully.');

           return {
             content: [{
               type: 'text',
               text: `Successfully exported billing report to: ${finalOutputPath}`
             }]
           };

         } catch (error) {
           // Type check for error
           const errorMessage = error instanceof Error ? error.message : String(error);
           throw new McpError(
             ErrorCode.InternalError,
             `Failed to export billing report: ${errorMessage}`
           );
         }
       } // End of else if for export_billing_report
       // Handle unknown tool (final else) - Corrected placement
       else {
          throw new McpError(
           ErrorCode.MethodNotFound,
           `Unknown tool: ${toolName}`
         ); 
       } // End of final else for unknown tool
    }); // End of setRequestHandler for CallToolRequestSchema
  } // End of setupHandlers method

  // Restore the run method
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Aliyun Manager MCP server running on stdio');
  } // End of run method

} // End of AliyunManagerServer class

const server = new AliyunManagerServer();
server.run().catch(console.error);
