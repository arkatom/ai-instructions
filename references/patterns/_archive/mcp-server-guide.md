# MCPサーバー開発ガイド (2024)

Model Context Protocol (MCP) サーバーの設計・実装・デバッグのベストプラクティス。

## MCPの基本概念

### MCPとは
```
Model Context Protocol (MCP) は、LLMアプリケーションが外部システムと
データや機能を共有するための標準化されたオープンプロトコル。

主要機能:
- Resources: データやコンテキストの提供（GET的な操作）
- Tools: 外部システムの機能実行（POST的な操作）
- Prompts: 再利用可能なプロンプトテンプレート
```

### アーキテクチャ
```
┌─────────────┐     MCP Protocol    ┌──────────────┐
│   Client    │◄──────────────────►│    Server    │
│ (Claude等)  │                     │ (Your API)   │
└─────────────┘                     └──────────────┘
      │                                    │
      ▼                                    ▼
   LLM Context                      External Systems
```

## TypeScript SDK開発

### プロジェクト初期設定
```bash
# プロジェクト作成
mkdir my-mcp-server
cd my-mcp-server
npm init -y

# 必要パッケージインストール
npm install @modelcontextprotocol/sdk
npm install -D typescript @types/node tsx

# TypeScript設定
npx tsc --init
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 基本的なサーバー実装
```typescript
// src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  ReadResourceRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// サーバーインスタンス作成
const server = new Server(
  {
    name: 'my-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

// エラーハンドリング
server.onerror = (error) => {
  console.error('[MCP Error]', error);
};

// リソース一覧
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'data://config',
        name: 'Configuration',
        description: 'Current server configuration',
        mimeType: 'application/json',
      },
      {
        uri: 'data://status',
        name: 'System Status',
        description: 'Real-time system status',
        mimeType: 'application/json',
      },
    ],
  };
});

// リソース読み取り
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  
  switch (uri) {
    case 'data://config':
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              environment: process.env.NODE_ENV || 'development',
              version: '1.0.0',
              features: {
                analytics: true,
                logging: true,
              },
            }, null, 2),
          },
        ],
      };
    
    case 'data://status':
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              status: 'operational',
              uptime: process.uptime(),
              memory: process.memoryUsage(),
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    
    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// ツール一覧
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'calculate',
        description: 'Perform mathematical calculations',
        inputSchema: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'Mathematical expression to evaluate',
            },
          },
          required: ['expression'],
        },
      },
      {
        name: 'fetchData',
        description: 'Fetch data from external API',
        inputSchema: {
          type: 'object',
          properties: {
            endpoint: {
              type: 'string',
              description: 'API endpoint URL',
            },
            method: {
              type: 'string',
              enum: ['GET', 'POST', 'PUT', 'DELETE'],
              default: 'GET',
            },
            body: {
              type: 'object',
              description: 'Request body for POST/PUT',
            },
          },
          required: ['endpoint'],
        },
      },
    ],
  };
});

// ツール実行
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case 'calculate':
      try {
        // 安全な数式評価（実際は適切なライブラリ使用推奨）
        const result = eval(args.expression);
        return {
          content: [
            {
              type: 'text',
              text: `Result: ${result}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Invalid expression`,
            },
          ],
          isError: true,
        };
      }
    
    case 'fetchData':
      try {
        const response = await fetch(args.endpoint, {
          method: args.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          body: args.body ? JSON.stringify(args.body) : undefined,
        });
        
        const data = await response.json();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching data: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// プロンプト一覧
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'analyze-data',
        description: 'Analyze provided data and generate insights',
        arguments: [
          {
            name: 'data',
            description: 'The data to analyze',
            required: true,
          },
          {
            name: 'format',
            description: 'Output format (summary, detailed, bullet-points)',
            required: false,
          },
        ],
      },
      {
        name: 'code-review',
        description: 'Review code and provide feedback',
        arguments: [
          {
            name: 'code',
            description: 'Code to review',
            required: true,
          },
          {
            name: 'language',
            description: 'Programming language',
            required: true,
          },
        ],
      },
    ],
  };
});

// プロンプト取得
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case 'analyze-data':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please analyze the following data and provide ${args?.format || 'summary'} insights:\n\n${args?.data}`,
            },
          },
        ],
      };
    
    case 'code-review':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please review the following ${args?.language} code and provide feedback on:
- Code quality
- Potential bugs
- Performance improvements
- Best practices

Code:
\`\`\`${args?.language}
${args?.code}
\`\`\``,
            },
          },
        ],
      };
    
    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

// サーバー起動
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Server started');
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
```

## Python SDK開発

### インストール
```bash
# 公式SDK
pip install mcp

# または FastMCP（より簡潔な実装）
pip install fastmcp
```

### 基本的なPythonサーバー
```python
# server.py
from mcp.server import Server, NotificationOptions
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import Resource, Tool, Prompt, TextContent
import asyncio
import json

# サーバーインスタンス
server = Server("my-python-server")

# リソース提供
@server.list_resources()
async def handle_list_resources():
    return [
        Resource(
            uri="data://config",
            name="Configuration",
            description="Server configuration",
            mime_type="application/json",
        ),
        Resource(
            uri="data://metrics",
            name="Metrics",
            description="System metrics",
            mime_type="application/json",
        ),
    ]

@server.read_resource()
async def handle_read_resource(uri: str):
    if uri == "data://config":
        config = {
            "version": "1.0.0",
            "environment": "production",
            "features": ["logging", "monitoring"],
        }
        return TextContent(
            type="text",
            text=json.dumps(config, indent=2),
        )
    
    elif uri == "data://metrics":
        import psutil
        metrics = {
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_usage": psutil.disk_usage('/').percent,
        }
        return TextContent(
            type="text",
            text=json.dumps(metrics, indent=2),
        )
    
    raise ValueError(f"Unknown resource: {uri}")

# ツール提供
@server.list_tools()
async def handle_list_tools():
    return [
        Tool(
            name="execute_query",
            description="Execute a database query",
            input_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "params": {"type": "array"},
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="send_notification",
            description="Send a notification",
            input_schema={
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "message": {"type": "string"},
                    "priority": {
                        "type": "string",
                        "enum": ["low", "medium", "high"],
                    },
                },
                "required": ["title", "message"],
            },
        ),
    ]

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict):
    if name == "execute_query":
        # データベースクエリ実行（例）
        query = arguments["query"]
        params = arguments.get("params", [])
        
        # 実際のDB接続処理
        result = f"Executed: {query} with params: {params}"
        
        return TextContent(
            type="text",
            text=result,
        )
    
    elif name == "send_notification":
        # 通知送信（例）
        title = arguments["title"]
        message = arguments["message"]
        priority = arguments.get("priority", "medium")
        
        # 実際の通知処理
        result = f"Notification sent: {title} - {message} (Priority: {priority})"
        
        return TextContent(
            type="text",
            text=result,
        )
    
    raise ValueError(f"Unknown tool: {name}")

# プロンプト提供
@server.list_prompts()
async def handle_list_prompts():
    return [
        Prompt(
            name="sql_explain",
            description="Explain SQL query",
            arguments=[
                {"name": "query", "description": "SQL query to explain", "required": True},
            ],
        ),
        Prompt(
            name="error_analysis",
            description="Analyze error message",
            arguments=[
                {"name": "error", "description": "Error message", "required": True},
                {"name": "context", "description": "Additional context", "required": False},
            ],
        ),
    ]

@server.get_prompt()
async def handle_get_prompt(name: str, arguments: dict):
    if name == "sql_explain":
        query = arguments["query"]
        return {
            "messages": [
                {
                    "role": "user",
                    "content": f"Please explain this SQL query in detail:\n\n```sql\n{query}\n```",
                }
            ]
        }
    
    elif name == "error_analysis":
        error = arguments["error"]
        context = arguments.get("context", "")
        return {
            "messages": [
                {
                    "role": "user",
                    "content": f"Analyze this error and suggest solutions:\n\nError: {error}\n\nContext: {context}",
                }
            ]
        }
    
    raise ValueError(f"Unknown prompt: {name}")

# メイン関数
async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="my-python-server",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )

if __name__ == "__main__":
    asyncio.run(main())
```

### FastMCP使用例
```python
# fastmcp_server.py
from fastmcp import FastMCP
import psutil

# FastMCPインスタンス
mcp = FastMCP("system-monitor")

@mcp.resource("system://cpu")
async def get_cpu_info():
    """Get CPU usage information"""
    return {
        "cpu_percent": psutil.cpu_percent(interval=1),
        "cpu_count": psutil.cpu_count(),
        "cpu_freq": psutil.cpu_freq()._asdict() if psutil.cpu_freq() else None,
    }

@mcp.resource("system://memory")
async def get_memory_info():
    """Get memory usage information"""
    mem = psutil.virtual_memory()
    return {
        "total": mem.total,
        "available": mem.available,
        "percent": mem.percent,
        "used": mem.used,
        "free": mem.free,
    }

@mcp.tool()
async def kill_process(pid: int) -> str:
    """Kill a process by PID"""
    try:
        process = psutil.Process(pid)
        process.terminate()
        return f"Process {pid} terminated successfully"
    except psutil.NoSuchProcess:
        return f"Process {pid} not found"
    except psutil.AccessDenied:
        return f"Access denied to terminate process {pid}"

@mcp.tool()
async def list_processes(limit: int = 10) -> list:
    """List running processes"""
    processes = []
    for proc in psutil.process_iter(['pid', 'name', 'cpu_percent']):
        processes.append(proc.info)
        if len(processes) >= limit:
            break
    return processes

# サーバー実行
if __name__ == "__main__":
    mcp.run()
```

## トランスポート実装

### STDIO Transport（標準）
```typescript
// stdio-transport.ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const transport = new StdioServerTransport();
await server.connect(transport);
```

### SSE Transport（Server-Sent Events）
```typescript
// sse-transport.ts
import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const app = express();
const transport = new SSEServerTransport('/mcp', response);

app.get('/mcp', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  await server.connect(transport);
});

app.listen(3000);
```

### WebSocket Transport
```typescript
// websocket-transport.ts
import WebSocket from 'ws';
import { WebSocketServerTransport } from '@modelcontextprotocol/sdk/server/websocket.js';

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', async (ws) => {
  const transport = new WebSocketServerTransport(ws);
  await server.connect(transport);
});
```

## デバッグとテスト

### MCPインスペクター使用
```bash
# インスペクター起動
npx @modelcontextprotocol/inspector

# サーバー接続
# UIでサーバーコマンドを入力
node dist/index.js

# または開発モード
npx tsx src/index.ts
```

### ユニットテスト
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
  
  test('should list resources', async () => {
    server.setRequestHandler('resources/list', async () => ({
      resources: [
        {
          uri: 'test://resource',
          name: 'Test Resource',
          mimeType: 'text/plain',
        },
      ],
    }));
    
    await server.connect(transport);
    
    const response = await transport.request('resources/list', {});
    expect(response.resources).toHaveLength(1);
    expect(response.resources[0].uri).toBe('test://resource');
  });
  
  test('should execute tool', async () => {
    server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;
      
      if (name === 'echo') {
        return {
          content: [
            {
              type: 'text',
              text: args.message,
            },
          ],
        };
      }
      
      throw new Error(`Unknown tool: ${name}`);
    });
    
    await server.connect(transport);
    
    const response = await transport.request('tools/call', {
      name: 'echo',
      arguments: { message: 'Hello, World!' },
    });
    
    expect(response.content[0].text).toBe('Hello, World!');
  });
});
```

### ロギングとモニタリング
```typescript
// logging.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// サーバーに統合
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const startTime = Date.now();
  
  try {
    logger.info('Tool call started', {
      tool: request.params.name,
      arguments: request.params.arguments,
    });
    
    const result = await executeT
    
    logger.info('Tool call completed', {
      tool: request.params.name,
      duration: Date.now() - startTime,
    });
    
    return result;
  } catch (error) {
    logger.error('Tool call failed', {
      tool: request.params.name,
      error: error.message,
      duration: Date.now() - startTime,
    });
    
    throw error;
  }
});
```

## Claude Desktop統合

### 設定ファイル
```json
// ~/Library/Application Support/Claude/claude_desktop_config.json (Mac)
// %APPDATA%\Claude\claude_desktop_config.json (Windows)
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/path/to/your/server/dist/index.js"],
      "env": {
        "NODE_ENV": "production",
        "API_KEY": "your-api-key"
      }
    },
    "python-server": {
      "command": "python",
      "args": ["/path/to/your/server/server.py"],
      "env": {
        "PYTHON_ENV": "production"
      }
    }
  }
}
```

### パッケージ配布
```json
// package.json
{
  "name": "@your-org/mcp-server",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "mcp-server": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "jest",
    "prepare": "npm run build"
  },
  "files": [
    "dist",
    "README.md"
  ],
  "publishConfig": {
    "access": "public"
  }
}
```

## ベストプラクティス

### エラーハンドリング
```typescript
// エラー処理のベストプラクティス
class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    // バリデーション
    if (!request.params.name) {
      throw new MCPError('Tool name is required', 'INVALID_REQUEST');
    }
    
    // 実行
    const result = await executeT
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result),
        },
      ],
    };
  } catch (error) {
    // エラーレスポンス
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});
```

### レート制限
```typescript
// rate-limiting.ts
import { RateLimiter } from 'limiter';

const limiter = new RateLimiter({
  tokensPerInterval: 100,
  interval: 'minute',
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // レート制限チェック
  const remainingRequests = await limiter.removeTokens(1);
  
  if (remainingRequests < 0) {
    throw new MCPError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
  }
  
  // 通常処理
  return await processToolCall(request);
});
```

### セキュリティ
```typescript
// security.ts
import crypto from 'crypto';

// APIキー検証
function validateApiKey(key: string): boolean {
  const validKeys = new Set(process.env.VALID_API_KEYS?.split(',') || []);
  return validKeys.has(key);
}

// 入力サニタイゼーション
function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // SQLインジェクション対策
    return input.replace(/[';\\]/g, '');
  }
  if (typeof input === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return input;
}

// HMAC署名検証
function verifySignature(payload: string, signature: string): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

## パフォーマンス最適化

### キャッシング
```typescript
// caching.ts
import { LRUCache } from 'lru-cache';

const cache = new LRUCache<string, any>({
  max: 500,
  ttl: 1000 * 60 * 5, // 5分
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  
  // キャッシュチェック
  const cached = cache.get(uri);
  if (cached) {
    return cached;
  }
  
  // データ取得
  const data = await fetchResourceData(uri);
  
  // キャッシュ保存
  cache.set(uri, data);
  
  return data;
});
```

### 非同期処理
```typescript
// async-processing.ts
import { Worker } from 'worker_threads';
import pLimit from 'p-limit';

// 同時実行数制限
const limit = pLimit(5);

// ワーカープール
const workerPool = [];

async function processHeavyTask(data: any) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./worker.js', {
      workerData: data,
    });
    
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

// バッチ処理
async function processBatch(items: any[]) {
  const tasks = items.map((item) =>
    limit(() => processHeavyTask(item))
  );
  
  return await Promise.all(tasks);
}
```

## チェックリスト
- [ ] 基本的なMCPサーバー実装
- [ ] Resources、Tools、Promptsの実装
- [ ] エラーハンドリング
- [ ] ロギングとモニタリング
- [ ] テスト（ユニット、統合）
- [ ] デバッグ（Inspector使用）
- [ ] セキュリティ対策
- [ ] パフォーマンス最適化
- [ ] ドキュメント作成
- [ ] パッケージ配布準備