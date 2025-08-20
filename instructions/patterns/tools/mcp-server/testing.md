# MCPサーバー テスト

MCPインスペクター、ユニットテスト、統合テスト。

## MCPインスペクター

```bash
# インスペクター起動
npx @modelcontextprotocol/inspector

# サーバー接続（UIで入力）
node dist/index.js

# 開発モード
npx tsx src/index.ts
```

## TypeScriptユニットテスト

```typescript
// __tests__/server.test.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { MemoryTransport } from './helpers/memory-transport.js';

describe('MCP Server', () => {
  let server: Server;
  let transport: MemoryTransport;
  
  beforeEach(() => {
    server = new Server(
      { name: 'test-server', version: '1.0.0' },
      { capabilities: { resources: {}, tools: {} } }
    );
    transport = new MemoryTransport();
  });
  
  test('should list tools', async () => {
    server.setRequestHandler('tools/list', async () => ({
      tools: [{
        name: 'test-tool',
        description: 'Test tool',
        inputSchema: { type: 'object' }
      }]
    }));
    
    await server.connect(transport);
    const response = await transport.request('tools/list', {});
    
    expect(response.tools).toHaveLength(1);
    expect(response.tools[0].name).toBe('test-tool');
  });
});
```

## Pythonユニットテスト

```python
# test_server.py
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from your_server import server

@pytest.mark.asyncio
async def test_list_tools():
    # モックトランスポート
    mock_transport = AsyncMock()
    
    # ツール一覧取得
    tools = await server.list_tools()
    
    assert len(tools) > 0
    assert tools[0].name == 'expected-tool'

@pytest.mark.asyncio
async def test_call_tool():
    result = await server.call_tool(
        'test-tool',
        {'param': 'value'}
    )
    
    assert result.type == 'text'
    assert 'expected' in result.text
```

## 統合テスト

```typescript
// integration.test.ts
import { spawn } from 'child_process';
import { MCPClient } from '@modelcontextprotocol/sdk/client';

describe('Integration', () => {
  test('end-to-end flow', async () => {
    // サーバー起動
    const server = spawn('node', ['dist/index.js']);
    
    // クライアント接続
    const client = new MCPClient();
    await client.connect();
    
    // ツール実行
    const result = await client.callTool('hello', { name: 'World' });
    expect(result.content[0].text).toBe('Hello, World!');
    
    // クリーンアップ
    server.kill();
  });
});
```

## CI/CD設定

```yaml
# .github/workflows/test.yml
name: Test MCP Server
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npx @modelcontextprotocol/inspector --test
```

→ 詳細: [統合](./integration.md) | [ベストプラクティス](./best-practices.md)