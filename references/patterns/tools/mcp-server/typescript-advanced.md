# MCPサーバー TypeScript高度な実装

エラーハンドリング、型安全性、プロンプト実装。

## 型安全なハンドラー

```typescript
import { z } from 'zod';
import { 
  CallToolRequest,
  CallToolResult 
} from '@modelcontextprotocol/sdk/types.js';

// 入力スキーマ定義
const QuerySchema = z.object({
  query: z.string().min(1),
  limit: z.number().optional().default(10)
});

// 型安全なツール実行
server.setRequestHandler('tools/call', async (req: CallToolRequest): Promise<CallToolResult> => {
  try {
    const parsed = QuerySchema.parse(req.params.arguments);
    const result = await executeQuery(parsed);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result)
      }]
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        content: [{
          type: 'text',
          text: `Validation error: ${error.message}`
        }],
        isError: true
      };
    }
    throw error;
  }
});
```

## プロンプト実装

```typescript
// プロンプト一覧
server.setRequestHandler('prompts/list', async () => ({
  prompts: [{
    name: 'code-review',
    description: 'Review code with best practices',
    arguments: [
      { name: 'code', required: true },
      { name: 'language', required: true }
    ]
  }]
}));

// プロンプト取得
server.setRequestHandler('prompts/get', async (req) => ({
  messages: [{
    role: 'user',
    content: {
      type: 'text',
      text: `Review this ${req.params.arguments.language} code:
\`\`\`${req.params.arguments.language}
${req.params.arguments.code}
\`\`\`

Focus on:
- Security issues
- Performance
- Best practices`
    }
  }]
}));
```

## エラーハンドリング

```typescript
class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
  }
}

// グローバルエラーハンドラー
server.onerror = (error) => {
  console.error('[MCP Error]', {
    message: error.message,
    code: error.code || 'UNKNOWN',
    timestamp: new Date().toISOString()
  });
};
```

## 非同期リソース

```typescript
// ストリーミングリソース
server.setRequestHandler('resources/read', async function* (req) {
  const stream = await fetchDataStream(req.params.uri);
  
  for await (const chunk of stream) {
    yield {
      contents: [{
        uri: req.params.uri,
        mimeType: 'text/plain',
        text: chunk
      }]
    };
  }
});
```

→ 詳細: [テスト](./testing.md) | [統合](./integration.md)