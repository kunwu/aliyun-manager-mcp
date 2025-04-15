# Aliyun Manager MCP

A Model Context Protocol (MCP) server for managing Alibaba Cloud (Aliyun) resources. This server provides tools to monitor ECS instances and track billing information through the MCP interface.

## Features

- List ECS instances across regions with detailed information
- Get daily billing breakdowns for all Aliyun services
- Generate formatted HTML billing reports with Tailwind CSS styling

## Prerequisites

- Node.js (v16 or higher)
- npm (Node Package Manager)
- Aliyun Account with API access
- Access Key ID and Secret from Aliyun RAM Console

## Installation

### Method 1: Install from GitHub

```bash
npx @modelcontextprotocol/sdk install-repo kunwu/aliyun-manager-mcp
```

### Method 2: Install from Local Clone

```bash
git clone https://github.com/kunwu/aliyun-manager-mcp.git
cd aliyun-manager-mcp
npm install
npm run build
npx @modelcontextprotocol/sdk install-local ./
```

### Configure MCP Server

Add the server configuration to your MCP settings file:

```json
{
  "mcpServers": {
    "aliyun-manager": {
      "command": "node",
      "args": ["path/to/aliyun-manager-mcp/build/index.js"],
      "env": {
        "ALIBABA_CLOUD_ACCESS_KEY_ID": "your_access_key_id",
        "ALIBABA_CLOUD_ACCESS_KEY_SECRET": "your_access_key_secret",
        "ALIBABA_CLOUD_REGION": "cn-beijing"
      },
      "disabled": false,
      "alwaysAllow": []
    }
  }
}
```

Restart your MCP server after modifying the settings.

## Usage

### Available Tools

1. `list_instances`: List ECS instances
```json
{
  "region": "cn-beijing",
  "pageSize": 100
}
```

2. `get_billing_info`: Get billing data
```json
{
  "days": 7
}
```

3. `export_billing_report`: Generate HTML report
```json
{
  "days": 7,
  "output_path": "exported/aliyun_billing_report.html"
}
```

## Tool Details

### list_instances
Lists ECS instances in a specified region with details including:
- Instance ID and name
- Status and instance type
- Public and private IP addresses
- Creation time and region
- CPU and memory specifications

### get_billing_info
Retrieves detailed daily billing information:
- Original cost
- Discount amount
- Actual cost (after discounts)
- Grouped by service (FC, RDS, OSS, etc.)
- Data for up to 30 days

### export_billing_report
Generates a formatted HTML report:
- Tailwind CSS styling
- Daily breakdown by service
- Cost comparison charts
- Discount analysis

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| ALIBABA_CLOUD_ACCESS_KEY_ID | Aliyun Access Key ID | Yes |
| ALIBABA_CLOUD_ACCESS_KEY_SECRET | Aliyun Access Key Secret | Yes |
| ALIBABA_CLOUD_REGION | Default region for operations | No |

## Development

For development purposes, you can run the server standalone:
```bash
npm run dev
```

## License

MIT License

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request
