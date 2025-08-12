# Template Flexibility Guide

## 概要 / Overview

`ai-instructions` v0.5.1以降では、テンプレートの完全な編集自由度を提供しています。システムはファイル生成のみを保証し、内容の検証は行いません。

Starting from v0.5.1, `ai-instructions` provides complete template editing flexibility. The system only ensures file generation works, without validating content.

## 設計思想 / Design Philosophy

### 非干渉原則 / Non-Interference Principle

システムは以下の原則に従います：
- **ファイル生成器** として機能（内容検証器ではない）
- ユーザーのテンプレート編集を一切制限しない
- プレースホルダーの置換は任意（必須ではない）
- 特定のセクションや内容を強制しない

The system follows these principles:
- Acts as a **file generator** (not a content validator)
- Never restricts user template editing
- Placeholder replacement is optional (not required)
- Does not enforce specific sections or content

## テンプレートの自由な編集 / Free Template Editing

### 何を変更できるか / What Can Be Changed

**すべて変更可能です / Everything is editable:**

1. **セクション構造** / Section Structure
   - 必須マーカー（🚨）を削除可能
   - 基本ルールセクションを削除可能
   - 深層思考セクションを削除可能
   - 独自のセクションを追加可能

2. **プレースホルダー** / Placeholders
   - `{{projectName}}` をそのまま残すことも可能
   - 独自のプレースホルダーを追加可能
   - システムは置換可能なもののみ置換

3. **メタデータ** / Metadata
   - YAML frontmatterは必須ではない（Cursor以外）
   - メタデータフォーマットを自由に変更可能

4. **言語と内容** / Language and Content
   - 任意の言語で記述可能
   - 技術文書以外の内容も可能
   - 空のテンプレートも許可

### 例：最小限のテンプレート / Example: Minimal Template

```markdown
# My Custom Instructions

Do whatever you want.
```

このような最小限のテンプレートも完全に有効です。

### 例：プレースホルダーを残す / Example: Keeping Placeholders

```markdown
# Instructions for {{projectName}}

This template keeps the placeholder as-is.
The system won't fail if {{projectName}} remains.
```

## ツール固有の要件 / Tool-Specific Requirements

### 必須要件はツールごと / Requirements Vary by Tool

| ツール / Tool | 必須要件 / Requirements | 任意要件 / Optional |
|--------------|------------------------|-------------------|
| Claude | なし / None | すべて任意 / All optional |
| Cursor | YAML frontmatter | その他すべて / Everything else |
| GitHub Copilot | なし / None | すべて任意 / All optional |
| Windsurf | なし / None | すべて任意 / All optional |

### Cursor の YAML frontmatter

Cursorのみ、以下の形式のYAML frontmatterが必要です：

```yaml
---
description: 任意の説明
globs: ["**/*.md"]  # 任意のパターン
alwaysApply: true   # または false
---
```

## テスト戦略 / Test Strategy

### システムが検証すること / What System Validates

1. **ファイル生成の成功** / Successful file generation
2. **ファイルが存在すること** / File existence
3. **ファイルが空でないこと** / Non-empty files
4. **エラーが発生しないこと** / No errors occur

### システムが検証しないこと / What System Does NOT Validate

1. **特定の内容の存在** / Specific content presence
2. **セクション構造** / Section structure  
3. **プレースホルダーの置換** / Placeholder replacement
4. **言語固有の文言** / Language-specific text
5. **マーカーやアイコン** / Markers or icons

## 移行ガイド / Migration Guide

### 既存プロジェクトの更新 / Updating Existing Projects

既存のテンプレートはそのまま動作しますが、以下の自由度があります：

1. **不要なセクションの削除**
   ```diff
   - ## 🚨 核心原則（必須）
   - ### 基本ルール
   - ### 深層思考
   + ## 私のルール
   ```

2. **独自構造への変更**
   ```markdown
   # シンプルな指示

   1. コードを書く
   2. テストする
   3. 完了
   ```

3. **プレースホルダーの活用**
   ```markdown
   Project: {{projectName}}
   Tool: {{toolName}}
   My Variable: {{myCustomVar}}
   ```

## FAQ

### Q: テンプレートを空にできますか？
A: はい、ただしファイルは生成される必要があります。

### Q: 日本語以外の言語で書けますか？
A: はい、任意の言語で記述可能です。

### Q: 必須セクションはありますか？
A: Cursor用のYAML frontmatter以外、必須セクションはありません。

### Q: プレースホルダーを削除する必要がありますか？
A: いいえ、そのまま残しても問題ありません。

## まとめ / Summary

`ai-instructions`は真の柔軟性を提供します。システムはファイル生成のみを保証し、内容についてはユーザーの完全な自由を尊重します。

The system provides true flexibility. It only ensures file generation works while respecting complete user freedom for content.