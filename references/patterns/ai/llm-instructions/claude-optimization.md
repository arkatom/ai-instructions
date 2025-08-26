# Claude向け最適化（2024最新）

Claude 3.5 Sonnet/Opus向けの実用的な設定。XMLタグは任意。

## 基本フォーマット

```markdown
# Role
経験豊富なソフトウェアアーキテクト

# Context
- プロジェクト: Eコマース
- 技術: TypeScript, React, Next.js
- チーム: 5名

# Task
コードレビューと改善提案

# Instructions
1. 問題点を特定
2. 改善案を提示
3. 実装例を提供

# Output Format
## 問題点
- 箇条書き

## 改善提案
具体的なコード例付き

# Constraints
- TypeScript厳格モード前提
- 関数型プログラミング優先
```

## Chain of Thought促進

```markdown
# Thinking Process
以下の順序で考えてください：
1. 問題の理解
2. 解決策の検討
3. トレードオフ評価
4. 最適解の選択

回答前に思考過程を示してください。
```

## CLAUDE.md形式

```markdown
---
description: プロジェクト固有の指示
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: true
---

# 基本ルール
- TypeScript厳格モード
- 早期リターン
- 副作用最小化

# コーディング規約
export const func = () => {
  // アロー関数使用
  // 関数型優先
};
```

## Few-Shot例

```markdown
# Examples

入力: fetch処理
出力:
try {
  const response = await fetch(url);
  if (!response.ok) throw new Error();
  return await response.json();
} catch (error) {
  console.error(error);
  throw error;
}
```

## ヒント
- 簡潔さを重視
- 構造化は維持
- 必要に応じてXMLタグ使用可