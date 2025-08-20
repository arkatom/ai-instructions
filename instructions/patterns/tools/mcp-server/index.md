# MCPサーバー開発ガイド

Model Context Protocol (MCP) サーバー開発の実践的なリファレンス。

## 📚 ドキュメント構成

| ドキュメント | 内容 | 行数 |
|------------|------|-----|
| [TypeScript基本](./typescript-basics.md) | TypeScript SDK実装 | ~100 |
| [Python基本](./python-basics.md) | Python SDK実装 | ~100 |
| [トランスポート](./transport.md) | STDIO/SSE/WebSocket | ~50 |
| [テスト・デバッグ](./testing.md) | Inspector、ユニットテスト | ~80 |
| [統合](./integration.md) | Claude Desktop設定 | ~50 |
| [ベストプラクティス](./best-practices.md) | セキュリティ、パフォーマンス | ~80 |

## クイックスタート

### TypeScript
```bash
npm install @modelcontextprotocol/sdk
npm install -D typescript tsx
```

### Python
```bash
pip install mcp
# または
pip install fastmcp  # より簡潔な実装
```

## MCPの基本概念

```
┌─────────┐  MCP Protocol  ┌──────────┐
│ Client  │◄──────────────►│  Server  │
│(Claude) │                │(Your API)│
└─────────┘                └──────────┘
```

**主要機能**：
- **Resources**: データ提供（GET的）
- **Tools**: 機能実行（POST的）
- **Prompts**: テンプレート

## 最小実装例

```typescript
// TypeScript (25行)
import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';

const server = new Server(
  { name: 'my-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler('tools/list', async () => ({
  tools: [{
    name: 'hello',
    description: 'Say hello',
    inputSchema: { type: 'object', properties: {} }
  }]
}));

server.setRequestHandler('tools/call', async (req) => ({
  content: [{ type: 'text', text: `Hello!` }]
}));

const transport = new StdioServerTransport();
await server.connect(transport);
```