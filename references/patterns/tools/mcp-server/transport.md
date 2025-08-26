# MCPサーバー トランスポート実装

STDIO、SSE、WebSocketの各トランスポート設定。

## STDIO（標準）

```typescript
// TypeScript
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const transport = new StdioServerTransport();
await server.connect(transport);
```

```python
# Python
from mcp.server.stdio import stdio_server

async with stdio_server() as (read_stream, write_stream):
    await server.run(read_stream, write_stream)
```

## SSE（Server-Sent Events）

```typescript
// TypeScript - Express統合
import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const app = express();

app.get('/mcp', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const transport = new SSEServerTransport('/mcp', res);
  await server.connect(transport);
  
  req.on('close', () => transport.close());
});

app.listen(3000);
```

## WebSocket

```typescript
// TypeScript - ws実装
import WebSocket from 'ws';
import { WebSocketServerTransport } from '@modelcontextprotocol/sdk/server/websocket.js';

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', async (ws) => {
  const transport = new WebSocketServerTransport(ws);
  
  await server.connect(transport);
  
  ws.on('error', console.error);
  ws.on('close', () => console.log('Client disconnected'));
});
```

```python
# Python - websockets実装
import websockets
from mcp.server.websocket import WebSocketServerTransport

async def handle_client(websocket, path):
    transport = WebSocketServerTransport(websocket)
    await server.run_with_transport(transport)

start_server = websockets.serve(handle_client, 'localhost', 8080)
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
```

## トランスポート選択基準

| トランスポート | 用途 | メリット | デメリット |
|--------------|------|---------|----------|
| STDIO | Claude Desktop | シンプル | 単一接続 |
| SSE | Web統合 | HTTPベース | 単方向 |
| WebSocket | リアルタイム | 双方向通信 | 複雑 |

## カスタムトランスポート

```typescript
// 独自トランスポート実装
class CustomTransport extends Transport {
  async send(message: any): Promise<void> { /* カスタム送信ロジック */ }
  async receive(): Promise<any> { /* カスタム受信ロジック */ }
}
```

→ 詳細: [統合](./integration.md) | [ベストプラクティス](./best-practices.md)