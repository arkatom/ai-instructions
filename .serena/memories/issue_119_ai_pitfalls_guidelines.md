# Issue #119: AI失敗防止ガイドライン（pitfalls集）

## 作成日: 2025-08-27

## Issueファイル
`issue_119_content.md` に保存済み

## Issue作成コマンド
```bash
gh issue create --title "feat: AI失敗防止ガイドライン（pitfalls集）の作成" --body-file issue_119_content.md --label "documentation,enhancement,high-priority"
```

## 核心的な設計思想

### AIの実際の挙動（自己分析）
- ✅ 参照するもの：CLAUDE.md、core/base.md（必須指定）
- ❌ 参照しないもの：深い階層、複数分割ファイル

### 解決策
1ファイル100行以内でAIが失敗しやすい具体例に特化

### 対象技術
1. TypeScript - any回避、型安全性
2. React - Server Components時代
3. JavaScript - ES2024+
4. Python - 型ヒント必須
5. Testing - 実効的テスト

### Linter鉄則
- ESLintエラーは100%修正
- TypeScript strict: true必須
- Formatterとの統合

## 実装タスク
- instructions/guidelines/ディレクトリ作成
- 各pitfallsファイル作成（100行以内）
- src内のハードコードパス修正