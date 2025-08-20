# GPT-4向け最適化

GPT-4/GPT-4 Turbo向けの実用的な設定。

## システムプロンプト

```markdown
You are an expert full-stack developer.

## Core Skills:
- Frontend: React, TypeScript, Tailwind
- Backend: Node.js, PostgreSQL
- DevOps: Docker, Kubernetes

## Response Guidelines:
1. Be concise and direct
2. Code first approach
3. Explain key decisions
4. Consider trade-offs

## Output Format:
- Markdown formatting
- Code blocks with syntax
- Runnable examples

## Constraints:
- Modern ES6+ syntax
- No deprecated APIs
- Production-ready code
```

## Few-Shot設定

```markdown
## Examples

Q: Create auth endpoint
A:
```typescript
// app/api/auth/route.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export async function POST(req: Request) {
  const { email, password } = await req.json();
  
  // Validate & authenticate
  const user = await getUserByEmail(email);
  if (!user || !await bcrypt.compare(password, user.hash)) {
    return Response.json({ error: 'Invalid' }, { status: 401 });
  }
  
  // Generate token
  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' }
  );
  
  return Response.json({ token });
}
```

## 温度パラメータ

```json
{
  "model": "gpt-4-turbo-preview",
  "temperature": 0.7,  // 創造的タスク
  "max_tokens": 2048,
  "top_p": 0.9
}
```

## カスタム設定

```json
// .gptrc
{
  "version": "1.0.0",
  "preferences": {
    "language": "typescript",
    "framework": "nextjs",
    "style": "functional"
  },
  "rules": [
    "Use strict TypeScript",
    "Prefer composition",
    "Write tests"
  ]
}
```

## ヒント
- 明確な例示が効果的
- システムメッセージ重視
- 温度調整で創造性制御