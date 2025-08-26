# スタイルガイド実装計画 (2025-08-27)

## 🚨 発見した根本問題

### instructions/patterns自動生成の原因
以下のソースコードでパスがハードコードされている：
1. `src/init/interactive.ts:129`
2. `src/cli/services/InteractivePatternSelector.ts:496`
3. `src/cli/services/PatternRegistry.ts:34`

これらが原因で、CLIツール実行時にディレクトリが自動生成される。

## 📐 正しいディレクトリ構造

```
instructions/
├── core/              # 思考プロセス（既存）
├── methodologies/     # 方法論（既存）
├── workflows/         # ワークフロー（既存）
├── guidelines/        # スタイルガイド（新規）
│   ├── languages/
│   │   ├── typescript/
│   │   │   ├── index.md
│   │   │   ├── 01-types-and-interfaces.md
│   │   │   ├── 02-functions-and-classes.md
│   │   │   ├── 03-modules-and-namespaces.md
│   │   │   └── 04-best-practices.md
│   │   ├── javascript/
│   │   ├── python/
│   │   └── ...
│   ├── frameworks/
│   │   ├── react/
│   │   └── ...
│   └── practices/
│       └── testing/
└── references/        # 実装例（instructions/配下に移動）
    └── patterns/

```

## 🎯 スタイルガイド作成の優先順位

1. **TypeScript** - Google TypeScript Style Guideベース
2. **React** - Airbnb React/JSX Style Guide + Hooksベストプラクティス
3. **JavaScript** - Airbnb JavaScript Style Guide
4. **Python** - PEP 8 + Google Python Style Guide
5. **テスト戦略** - Testing Trophy + TDD/BDD原則

## 📊 参考にすべきスタイルガイド

### 必須参照
- Google Style Guides: https://google.github.io/styleguide/
- Airbnb JavaScript: https://github.com/airbnb/javascript
- Redux Style Guide: https://redux.js.org/style-guide/
- React TypeScript Cheatsheet: https://react-typescript-cheatsheet.netlify.app/

### 各言語・フレームワーク固有
- TypeScript Deep Dive
- Python PEP 8, PEP 484 (Type Hints)
- Jest Best Practices
- Testing Library Principles

## 🔧 実装ステップ

### Phase 1: 基盤修正
1. src内のハードコードパス修正
2. references/をinstructions/references/へ移動
3. .gitignore更新

### Phase 2: TypeScriptガイドライン
- 200-300行 × 4-5ファイル分割
- 型システム、関数、クラス、モジュール、ベストプラクティス

### Phase 3: Reactガイドライン
- コンポーネント設計
- Hooks原則
- パフォーマンス最適化
- テスト戦略

### Phase 4: 他言語・フレームワーク
- JavaScript (ES2024+)
- Python (3.10+)
- テスト戦略全般

## ⚠️ 品質基準

- **抽象度**: Google Style Guideレベル
- **具体性**: 原則と理由を明確に
- **実装例**: 最小限のみ（理解補助用）
- **分割**: 1ファイル200-400行
- **総量**: 各言語2000行程度

## 💡 カスタムインストラクションの本質

「ブログの実装を書き切る」のような具体例ではなく、
「なぜそう書くべきか」の原則と理由を示す。

これが真のカスタムインストラクション。