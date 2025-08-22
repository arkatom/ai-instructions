# LLMカスタムインストラクション ベストプラクティス (2024)

各種LLMモデル（Claude、GPT-4、Gemini等）向けの効果的なカスタムインストラクション設計パターン。

## 基本原則

### インストラクション構造
```markdown
# システムプロンプト構造（推奨順序）

1. **ロール定義** - AIのペルソナと専門性
2. **コンテキスト** - 背景情報と制約
3. **タスク説明** - 具体的な目標と期待
4. **出力形式** - 応答のフォーマット指定
5. **例示** - Few-shot例の提供
6. **制約事項** - 避けるべき行動
7. **思考プロセス** - 推論手順の指示
```

## Claude向け最適化

### XMLタグ構造
```xml
<!-- Claude用XMLタグ構造 -->
<system>
あなたは経験豊富なソフトウェアアーキテクトです。
TypeScriptとReactの専門知識を持ち、クリーンコードの原則を重視します。
</system>

<task>
提供されたコードをレビューし、以下の観点で改善提案を行ってください：
- パフォーマンス最適化
- 型安全性の向上
- 保守性の改善
</task>

<context>
プロジェクト: Eコマースプラットフォーム
技術スタック: Next.js 14, TypeScript 5, Tailwind CSS
チーム規模: 5名
</context>

<instructions>
1. コードの問題点を特定
2. 具体的な改善案を提示
3. ベストプラクティスを説明
4. 実装例を提供
</instructions>

<output_format>
## 問題点
- 箇条書きで列挙

## 改善提案
### 1. [改善項目]
- 理由:
- 実装例:
```typescript
// コード例
```

## ベストプラクティス
- 推奨事項の説明
</output_format>

<examples>
<example>
入力: const data = await fetch(url).then(r => r.json())
改善: 
```typescript
try {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return data;
} catch (error) {
  console.error('Fetch error:', error);
  throw error;
}
```
</example>
</examples>
```

### Chain of Thought促進
```markdown
<thinking>
このセクションで段階的に思考してください：
1. 問題の理解と分析
2. 可能な解決策の検討
3. トレードオフの評価
4. 最適解の選択理由
</thinking>

<answer>
最終的な回答をここに記述
</answer>
```

### CLAUDE.md形式
```markdown
---
description: プロジェクト固有の指示
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: true
---

# カスタムインストラクション

## 基本ルール
- TypeScriptの厳格モードを前提とする
- 関数型プログラミングを優先
- 副作用を最小限に抑える
- 早期リターンパターンを使用

## コーディング規約
```typescript
// 良い例
export const calculateTotal = (items: Item[]): number => {
  if (!items.length) return 0;
  return items.reduce((sum, item) => sum + item.price, 0);
};

// 避けるべき例
export function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price;
  }
  return total;
}
```

## アーキテクチャパターン
- Clean Architecture準拠
- ドメイン駆動設計の原則
- SOLID原則の遵守
```

## GPT-4向け最適化

### システムプロンプト設計
```markdown
# System Prompt for GPT-4

You are an expert full-stack developer specializing in modern web technologies.

## Core Competencies:
- Frontend: React, Next.js, TypeScript, Tailwind CSS
- Backend: Node.js, PostgreSQL, Redis
- DevOps: Docker, Kubernetes, GitHub Actions
- Testing: Jest, Playwright, Cypress

## Response Guidelines:
1. **Be Concise**: Provide direct, actionable answers
2. **Code First**: Lead with code examples when applicable
3. **Explain Decisions**: Brief rationale for technical choices
4. **Consider Trade-offs**: Mention pros/cons of approaches
5. **Security Aware**: Always consider security implications

## Output Format:
- Use markdown for formatting
- Include code blocks with syntax highlighting
- Provide runnable examples when possible
- Add comments only for complex logic

## Constraints:
- No deprecated APIs or patterns
- Prefer modern ES6+ syntax
- Avoid over-engineering simple solutions
- Focus on production-ready code
```

### Few-Shot Examples
```markdown
## Examples of Expected Behavior

### Example 1: API Route Implementation
User: "Create a REST API endpoint for user authentication"

Assistant:
```typescript
// app/api/auth/login/route.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);
    
    // Verify user credentials
    const user = await getUserByEmail(email);
    if (!user || !await bcrypt.compare(password, user.hashedPassword)) {
      return Response.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );
    
    return Response.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Example 2: Component Optimization
User: "Optimize this React component for performance"

Assistant:
```typescript
// Optimized with memo, useMemo, and useCallback
import { memo, useMemo, useCallback } from 'react';

interface DataTableProps {
  data: Item[];
  onSort: (column: string) => void;
  sortColumn: string;
}

export const DataTable = memo<DataTableProps>(({ 
  data, 
  onSort, 
  sortColumn 
}) => {
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      if (a[sortColumn] < b[sortColumn]) return -1;
      if (a[sortColumn] > b[sortColumn]) return 1;
      return 0;
    });
  }, [data, sortColumn]);
  
  const handleSort = useCallback((column: string) => {
    onSort(column);
  }, [onSort]);
  
  return (
    <table>
      {/* Table implementation */}
    </table>
  );
});

DataTable.displayName = 'DataTable';
```
```

## プロンプトエンジニアリング技法

### 1. Zero-Shot Chain of Thought
```markdown
Let's approach this step-by-step:

1. First, understand the problem
2. Break it down into components
3. Consider edge cases
4. Implement the solution
5. Verify correctness

Think through each step before proceeding.
```

### 2. Few-Shot Learning
```markdown
Here are examples of the desired output format:

Example 1:
Input: "user authentication"
Output: JWT-based authentication with refresh tokens

Example 2:
Input: "data caching"
Output: Redis with TTL and cache invalidation strategy

Now, for the input: "session management"
Output: [AI will follow the pattern]
```

### 3. Role Prompting
```markdown
You are a senior DevOps engineer with 10 years of experience in:
- Kubernetes orchestration
- CI/CD pipeline optimization
- Infrastructure as Code (Terraform)
- Cloud architecture (AWS, GCP, Azure)
- Security best practices

Provide recommendations from this expert perspective.
```

### 4. Structured Output
```markdown
Provide your response in the following JSON structure:
```json
{
  "analysis": {
    "problem": "string",
    "complexity": "low|medium|high",
    "estimatedTime": "string"
  },
  "solution": {
    "approach": "string",
    "implementation": "code",
    "alternatives": ["string"]
  },
  "considerations": {
    "performance": "string",
    "security": "string",
    "scalability": "string"
  }
}
```
```

### 5. Prompt Chaining
```markdown
Step 1: "Analyze the requirements and identify key components"
→ Output: Component list

Step 2: "Design the architecture for [components from Step 1]"
→ Output: Architecture diagram

Step 3: "Implement the core functionality for [architecture from Step 2]"
→ Output: Code implementation

Step 4: "Write tests for [implementation from Step 3]"
→ Output: Test suite
```

## マルチモデル戦略

### モデル別最適化
```yaml
Claude:
  strengths:
    - 長文コンテキスト処理
    - コード生成精度
    - 論理的推論
  best_for:
    - コードレビュー
    - アーキテクチャ設計
    - 技術文書作成
  prompting_style:
    - XMLタグ活用
    - 明確な構造化
    - Chain of Thought

GPT-4:
  strengths:
    - 創造的タスク
    - 多言語対応
    - 一般知識
  best_for:
    - アイデア生成
    - コンテンツ作成
    - 問題解決
  prompting_style:
    - システムメッセージ重視
    - Few-shot examples
    - 温度パラメータ調整

Gemini:
  strengths:
    - マルチモーダル処理
    - リアルタイム情報
    - 数学的推論
  best_for:
    - 画像解析
    - データ分析
    - 研究タスク
  prompting_style:
    - 具体的な指示
    - 視覚的コンテキスト
    - 段階的処理
```

## 高度なテクニック

### 感情プロンプト
```markdown
「これは非常に重要なタスクです。慎重に、そして正確に対応してください。
あなたの回答の質が、プロジェクトの成功を左右します。」
```

### 自己一貫性プロンプト
```markdown
「3つの異なるアプローチで解決策を考え、
それぞれの長所と短所を比較し、
最適な解決策を選択してください。」
```

### メタプロンプト
```markdown
「まず、この問題を解決するための最適なプロンプトを生成してください。
その後、生成したプロンプトを使用して実際の解決策を提供してください。」
```

## 制約と安全性

### 倫理的ガイドライン
```markdown
## 制約事項
- 個人情報の取り扱いに注意
- セキュリティリスクのあるコードを生成しない
- 偏見や差別的な内容を避ける
- 著作権を尊重する
- 正確性を優先し、不確実な場合は明示
```

### エラーハンドリング
```markdown
「不明確な要求の場合：
1. 明確化のための質問をする
2. 仮定を明示する
3. 複数の解釈を提示する
4. リスクを警告する」
```

## プロジェクト固有設定

### .clauderc / .gptrc 形式
```json
{
  "version": "1.0.0",
  "project": "ecommerce-platform",
  "preferences": {
    "language": "typescript",
    "framework": "nextjs",
    "style": "functional",
    "testing": "jest"
  },
  "rules": [
    "Use TypeScript strict mode",
    "Prefer composition over inheritance",
    "Write tests for all functions",
    "Document complex logic"
  ],
  "context": {
    "team_size": 5,
    "experience_level": "intermediate",
    "deployment": "vercel"
  }
}
```

### プロジェクトコンテキスト
```markdown
# Project Context

## Overview
E-commerce platform for B2B customers

## Tech Stack
- Frontend: Next.js 14, React 18, TypeScript 5
- Styling: Tailwind CSS, Shadcn/ui
- State: Zustand, TanStack Query
- Backend: Supabase, PostgreSQL
- Deployment: Vercel

## Conventions
- File naming: kebab-case
- Component naming: PascalCase
- Function naming: camelCase
- Test files: *.test.ts

## Architecture
```
/src
  /app          # Next.js app router
  /components   # Reusable components
  /lib          # Utilities and helpers
  /hooks        # Custom React hooks
  /stores       # Zustand stores
  /types        # TypeScript types
```
```

## 評価と改善

### プロンプト効果測定
```markdown
## Metrics to Track:
1. **Accuracy**: 正答率
2. **Relevance**: 関連性スコア
3. **Completeness**: 完全性評価
4. **Efficiency**: トークン効率
5. **Consistency**: 一貫性チェック

## A/B Testing:
- Version A: 基本プロンプト
- Version B: 改善プロンプト
- 比較指標: 上記メトリクス
```

### 継続的改善
```markdown
## Improvement Cycle:
1. **Collect**: フィードバック収集
2. **Analyze**: パフォーマンス分析
3. **Refine**: プロンプト調整
4. **Test**: A/Bテスト実施
5. **Deploy**: 本番環境適用
6. **Monitor**: 継続的監視
```

## チェックリスト
- [ ] 明確なロール定義
- [ ] 構造化された指示
- [ ] 具体的な例示（Few-shot）
- [ ] 適切な出力形式指定
- [ ] Chain of Thought促進
- [ ] エラーハンドリング考慮
- [ ] モデル特性に応じた最適化
- [ ] セキュリティと倫理の考慮
- [ ] 継続的な評価と改善