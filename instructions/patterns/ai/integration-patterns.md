# AI統合パターン (2024)

モダンアプリケーションへのAI機能統合のベストプラクティス。

## Vercel AI SDK

### ストリーミングチャット実装
```typescript
// app/api/chat/route.ts
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { Configuration, OpenAIApi } from 'openai-edge';

const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(config);

export const runtime = 'edge';

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const response = await openai.createChatCompletion({
    model: 'gpt-4',
    stream: true,
    messages,
    temperature: 0.7,
    max_tokens: 2000,
  });
  
  const stream = OpenAIStream(response, {
    onStart: async () => {
      // ストリーム開始時の処理
      console.log('Stream started');
    },
    onToken: async (token: string) => {
      // トークンごとの処理
      console.log('Token:', token);
    },
    onCompletion: async (completion: string) => {
      // 完了時の処理（DBへの保存など）
      await saveToDatabase(completion);
    },
  });
  
  return new StreamingTextResponse(stream);
}
```

### クライアント側の実装
```typescript
// app/chat/page.tsx
'use client';

import { useChat } from 'ai/react';

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });
  
  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`mb-4 ${
              message.role === 'user' ? 'text-right' : 'text-left'
            }`}
          >
            <span
              className={`inline-block p-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-black'
              }`}
            >
              {message.content}
            </span>
          </div>
        ))}
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="メッセージを入力..."
            className="flex-1 p-2 border rounded"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            送信
          </button>
        </div>
      </form>
    </div>
  );
}
```

## LangChain統合

### RAG (Retrieval-Augmented Generation) 実装
```typescript
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { HNSWLib } from 'langchain/vectorstores/hnswlib';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { RetrievalQAChain } from 'langchain/chains';

// ベクトルストアの作成
async function createVectorStore(documents: string[]) {
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  
  const docs = await textSplitter.createDocuments(documents);
  
  const vectorStore = await HNSWLib.fromDocuments(
    docs,
    new OpenAIEmbeddings()
  );
  
  return vectorStore;
}

// RAGチェーンの実装
async function createRAGChain(vectorStore: HNSWLib) {
  const model = new ChatOpenAI({
    modelName: 'gpt-4',
    temperature: 0,
  });
  
  const chain = RetrievalQAChain.fromLLM(
    model,
    vectorStore.asRetriever(3), // 上位3件を取得
    {
      returnSourceDocuments: true,
      verbose: true,
    }
  );
  
  return chain;
}

// 使用例
export async function queryDocuments(question: string) {
  const vectorStore = await createVectorStore(documents);
  const chain = await createRAGChain(vectorStore);
  
  const response = await chain.call({
    query: question,
  });
  
  return {
    answer: response.text,
    sources: response.sourceDocuments,
  };
}
```

## OpenAI Function Calling

### 構造化出力の実装
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 関数スキーマの定義
const functions = [
  {
    name: 'get_weather',
    description: '指定された場所の天気を取得',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: '都市名（例：東京）',
        },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
          description: '温度の単位',
        },
      },
      required: ['location'],
    },
  },
];

// Function Callingの実装
async function chatWithFunctions(message: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: message }],
    functions,
    function_call: 'auto',
  });
  
  const message = response.choices[0].message;
  
  if (message.function_call) {
    const functionName = message.function_call.name;
    const functionArgs = JSON.parse(message.function_call.arguments);
    
    // 実際の関数を実行
    let functionResult;
    if (functionName === 'get_weather') {
      functionResult = await getWeather(functionArgs.location, functionArgs.unit);
    }
    
    // 結果を使って再度AIに問い合わせ
    const secondResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'user', content: message },
        message,
        {
          role: 'function',
          name: functionName,
          content: JSON.stringify(functionResult),
        },
      ],
    });
    
    return secondResponse.choices[0].message.content;
  }
  
  return message.content;
}
```

## 画像生成・分析

### DALL-E 3統合
```typescript
async function generateImage(prompt: string) {
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
    style: 'vivid',
  });
  
  return response.data[0].url;
}
```

### Vision API (GPT-4V)
```typescript
async function analyzeImage(imageUrl: string, question: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-vision-preview',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: question },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
    max_tokens: 1000,
  });
  
  return response.choices[0].message.content;
}
```

## エンベディング活用

### セマンティック検索
```typescript
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { SupabaseVectorStore } from 'langchain/vectorstores/supabase';
import { createClient } from '@supabase/supabase-js';

const embeddings = new OpenAIEmbeddings();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

// ドキュメントのインデックス作成
async function indexDocuments(documents: { content: string; metadata: any }[]) {
  const vectorStore = await SupabaseVectorStore.fromTexts(
    documents.map(d => d.content),
    documents.map(d => d.metadata),
    embeddings,
    {
      client: supabase,
      tableName: 'documents',
      queryName: 'match_documents',
    }
  );
  
  return vectorStore;
}

// セマンティック検索の実行
async function semanticSearch(query: string, limit = 5) {
  const vectorStore = new SupabaseVectorStore(embeddings, {
    client: supabase,
    tableName: 'documents',
    queryName: 'match_documents',
  });
  
  const results = await vectorStore.similaritySearchWithScore(query, limit);
  
  return results.map(([doc, score]) => ({
    content: doc.pageContent,
    metadata: doc.metadata,
    similarity: score,
  }));
}
```

## プロンプトエンジニアリング

### Few-Shot Learning
```typescript
const fewShotExamples = [
  { input: '今日は晴れです', output: 'positive' },
  { input: '雨が降っていて憂鬱', output: 'negative' },
  { input: '普通の一日', output: 'neutral' },
];

function createFewShotPrompt(examples: any[], input: string) {
  const exampleText = examples
    .map(e => `入力: ${e.input}\\n出力: ${e.output}`)
    .join('\\n\\n');
  
  return `以下の例を参考に、感情を分類してください。

${exampleText}

入力: ${input}
出力:`;
}
```

### Chain of Thought (CoT)
```typescript
function createCoTPrompt(problem: string) {
  return `問題: ${problem}

この問題を段階的に解いてください：
1. まず問題を理解する
2. 必要な情報を整理する
3. 解決策を考える
4. 実装方法を説明する
5. 最終的な答えを提示する

段階的な思考過程:`;
}
```

## エラーハンドリングとレート制限

### リトライ戦略
```typescript
import { RateLimiter } from 'limiter';
import retry from 'async-retry';

const limiter = new RateLimiter({
  tokensPerInterval: 60,
  interval: 'minute',
});

async function callAIWithRetry(fn: () => Promise<any>) {
  await limiter.removeTokens(1);
  
  return retry(
    async () => {
      try {
        return await fn();
      } catch (error: any) {
        if (error?.status === 429) {
          // レート制限エラー
          throw new Error('Rate limit exceeded');
        }
        if (error?.status >= 500) {
          // サーバーエラーはリトライ
          throw error;
        }
        // その他のエラーはリトライしない
        throw new Error(`Permanent error: ${error.message}`);
      }
    },
    {
      retries: 3,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 10000,
      onRetry: (error, attempt) => {
        console.log(`Retry attempt ${attempt}:`, error.message);
      },
    }
  );
}
```

## チェックリスト
- [ ] APIキーの安全な管理（環境変数）
- [ ] エラーハンドリングの実装
- [ ] レート制限の考慮
- [ ] ストリーミング対応
- [ ] コスト最適化（キャッシュ等）
- [ ] プロンプトの最適化
- [ ] セキュリティ対策（インジェクション防止）
- [ ] ユーザー体験の最適化