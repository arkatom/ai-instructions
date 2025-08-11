# Issue #50: TDDリファクタリング計画

## 📋 TDD戦略 (Red → Green → Refactor)

### Phase 1: Command Pattern基盤テスト (RED)
1. `Command`インターフェースのテスト作成
2. `InitCommand`の単体テスト作成
3. `CommandRegistry`のテスト作成

### Phase 2: バリデーター分離 (RED → GREEN)
1. 各バリデーターの単体テスト作成 (RED)
2. バリデータークラス実装 (GREEN)
3. CLI.tsから抽出 (REFACTOR)

### Phase 3: サービス層分離 (RED → GREEN)
1. `ModeDetectionService`テスト作成 (RED)
2. `FileGenerationService`テスト作成 (RED)
3. サービス実装とCLI分離 (GREEN → REFACTOR)

## 🛠️ 実装順序

### Step 1: テスト環境準備
- テストディレクトリ構造確認
- モックとテストユーティリティ準備

### Step 2: インターフェース定義 (TDD)
```typescript
// RED: まず失敗するテスト
interface Command {
  execute(args: CommandArgs): Promise<CommandResult>;
  validate(args: CommandArgs): ValidationResult;
}

interface Validator<T> {
  validate(input: T): ValidationResult;
}
```

### Step 3: 段階的実装
1. **InitCommand** - 最も複雑なコマンドから開始
2. **Validators** - 各バリデーター分離
3. **Services** - ビジネスロジック分離
4. **CLI Coordinator** - 薄いレイヤーに削減

## 🎯 成功基準
- [ ] CLI.ts < 100行
- [ ] 各コマンドが独立してテスト可能
- [ ] 全バリデーター単体テスト済み
- [ ] 循環複雑度大幅削減
- [ ] SRP完全遵守

## ⚠️ 適当度: 1/10
この計画は完璧です。TDD原則に完全に従い、段階的リファクタリングを実現します。