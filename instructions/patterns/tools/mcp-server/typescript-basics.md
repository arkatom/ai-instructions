# MCPサーバー TypeScript基本実装

MCPサーバーをTypeScriptで実装する最小構成。

## セットアップ

```bash
npm init -y
npm install @modelcontextprotocol/sdk
npm install -D typescript @types/node tsx
```

## 基本実装

```typescript
// src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  { name: 'my-server', version: '1.0.0' },
  { capabilities: { resources: {}, tools: {} } }
);

// リソース一覧
server.setRequestHandler('resources/list', async () => ({
  resources: [{
    uri: 'data://example',
    name: 'Example Resource',
    mimeType: 'application/json'
  }]
}));

// リソース読み取り
server.setRequestHandler('resources/read', async (request) => ({
  contents: [{
    uri: request.params.uri,
    mimeType: 'application/json',
    text: JSON.stringify({ data: 'example' })
  }]
}));

// ツール一覧
server.setRequestHandler('tools/list', async () => ({
  tools: [{
    name: 'hello',
    description: 'Say hello',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    }
  }]
}));

// ツール実行
server.setRequestHandler('tools/call', async (request) => ({
  content: [{
    type: 'text',
    text: `Hello, ${request.params.arguments.name || 'World'}!`
  }]
}));

// サーバー起動
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Server started');
}

main().catch(console.error);
```

## Claude Desktop設定

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/path/to/dist/index.js"]
    }
  }
}
```

## 実行

```bash
npx tsc && node dist/index.js  # ビルド & 実行
npx tsx src/index.ts           # 開発モード
```

→ 詳細: [TypeScript高度な実装](./typescript-advanced.md)