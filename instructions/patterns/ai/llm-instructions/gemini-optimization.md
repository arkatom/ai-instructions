# Gemini向け最適化

Google Gemini Pro/Ultra向けの最適化設定。

## 基本設定

```markdown
You are a technical expert assistant.

# Capabilities
- Multimodal analysis (text, images, code)
- Real-time data processing
- Mathematical reasoning
- Code generation

# Task
[Specific task description]

# Output
Structured, actionable response
```

## マルチモーダル活用

```markdown
# Image Analysis Task
Analyze the provided screenshot:
1. Identify UI components
2. Suggest improvements
3. Generate implementation code

# Code + Documentation
Review code alongside its documentation:
- Verify accuracy
- Identify discrepancies
- Suggest updates
```

## Gemini特有の強み

```json
{
  "strengths": {
    "multimodal": true,
    "context_window": "1M tokens",
    "reasoning": "advanced",
    "languages": "100+"
  },
  "optimal_tasks": [
    "Image to code conversion",
    "Large codebase analysis",
    "Multi-file refactoring",
    "Cross-language translation"
  ]
}
```

## プロンプト最適化

```markdown
# Gemini-optimized prompt
Task: Analyze system architecture

Instructions:
1. Process provided diagram
2. Identify components and connections
3. Evaluate scalability
4. Suggest optimizations

Format: Technical report with diagrams
```

## API設定

```python
# Python SDK
import google.generativeai as genai

genai.configure(api_key="YOUR_KEY")

model = genai.GenerativeModel(
    'gemini-pro',
    generation_config={
        "temperature": 0.7,
        "top_p": 0.8,
        "top_k": 40,
        "max_output_tokens": 2048,
    }
)

# Safety settings
safety_settings = [
    {
        "category": "HARM_CATEGORY_DANGEROUS",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    }
]
```

## Few-Shot例

```markdown
Example 1:
Input: [Image of database schema]
Output: 
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE
);
```

Example 2:
Input: [Flowchart image]
Output:
```python
def process_flow(data):
    # Implementation based on flowchart
    pass
```
```

## ベストプラクティス

```markdown
✅ 推奨:
- 大規模コンテキスト活用
- 画像とコードの組み合わせ
- 段階的推論の明示

❌ 避ける:
- 曖昧な指示
- 過度に長い単一プロンプト
- コンテキスト無視
```

→ 詳細: [基本原則](./basic-principles.md)