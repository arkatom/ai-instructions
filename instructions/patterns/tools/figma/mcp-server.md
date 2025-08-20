# Figma MCPサーバー

FigmaのMCPサーバー実装とClaude統合。

## 基本実装

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

class FigmaMCP {
  constructor(private token: string) {}
  
  async getFile(fileKey: string) {
    const response = await fetch(
      `https://api.figma.com/v1/files/${fileKey}`,
      { headers: { 'X-Figma-Token': this.token } }
    );
    return response.json();
  }
}

const server = new Server(
  { name: 'figma-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);
```

## ツール実装

```typescript
server.setRequestHandler('tools/list', async () => ({
  tools: [{
    name: 'extract-tokens',
    description: 'Extract design tokens',
    inputSchema: {
      type: 'object',
      properties: { fileKey: { type: 'string' } }
    }
  }]
}));

server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'extract-tokens') {
    const tokens = await extractTokens(request.params.arguments.fileKey);
    return {
      content: [{ type: 'text', text: JSON.stringify(tokens) }]
    };
  }
});
```

## トークン抽出

```typescript
async function extractTokens(fileKey: string) {
  const file = await figma.getFile(fileKey);
  
  return {
    colors: extractColors(file),
    typography: extractTypography(file),
    spacing: extractSpacing(file)
  };
}
```

## Claude Desktop設定

```json
{
  "mcpServers": {
    "figma": {
      "command": "node",
      "args": ["figma-mcp-server.js"],
      "env": { "FIGMA_TOKEN": "your-token" }
    }
  }
}
```

→ 詳細: [デザイントークン](./design-tokens.md)