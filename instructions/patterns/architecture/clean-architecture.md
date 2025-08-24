# Clean Architecture

## What
同心円状のレイヤー構造により、ビジネスロジックを外部の詳細から隔離するアーキテクチャパターン。依存性は常に外側から内側へ向かう。

## Why
- ビジネスロジックがフレームワーク、UI、データベース、外部サービスから独立
- テスタビリティの向上（ビジネスロジックを単独でテスト可能）
- 技術的な変更（DB変更、フレームワーク更新）がビジネスロジックに影響しない
- 並行開発が可能（各レイヤーを独立して開発）

## Core Principles

### 1. 依存性ルール  
- ソースコードの依存性は外側から内側へのみ向かう（importやusingの方向）
- 内側のレイヤーは外側のレイヤーの具象クラス、関数、変数を一切参照しない
- 内側で定義したインターフェースを外側が実装（依存性逆転の原則）
- データ構造も各レイヤー専用のものを使用し、境界で変換

### 2. レイヤー構造
```
[Entities] <- [Use Cases] <- [Interface Adapters] <- [Frameworks & Drivers]
   (内側)                                                    (外側)
```

### 3. 各レイヤーの責務
- **Entities**: 企業全体のビジネスルール、最も変更されにくい
- **Use Cases**: アプリケーション固有のビジネスルール
- **Interface Adapters**: データ変換、プレゼンター、コントローラー
- **Frameworks & Drivers**: UI、DB、外部サービス、フレームワーク

## Best Practices

1. **依存性の逆転を活用**
   - インターフェースを内側で定義し、実装を外側で行う
   - Repository パターンで DB アクセスを抽象化

2. **データ構造の分離**
   - 各レイヤーで独自のデータ構造を持つ
   - DTOやViewModelで境界を越える

3. **ビジネスロジックの配置**
   - エンティティ固有のルールは Entities に
   - ユースケース固有のルールは Use Cases に
   - UI固有のロジックは Interface Adapters に

4. **テストの独立性**
   - Use Cases は外部依存なしでテスト可能に
   - モックは Interface 境界で使用

5. **フレームワークは詳細**
   - フレームワークに依存するコードは最外層に
   - ビジネスロジックはフレームワークを知らない

## Simple Example

```pseudocode
// Entity (内側)
Entity User {
  validateEmail()
  changePassword()
}

// Use Case
UseCase CreateUser {
  execute(userData) {
    user = new User(userData)
    if (user.isValid()) {
      repository.save(user)  // repository は interface
    }
  }
}

// Interface Adapter
Controller UserController {
  createUser(request) {
    useCase.execute(request.body)
    return response
  }
}
```

## Anti-patterns

1. **内側が外側に依存**
   - Entity が DB ライブラリを import
   - Use Case が HTTP リクエストを直接扱う

2. **レイヤーのスキップ**
   - Controller が直接 Entity を操作
   - Framework が Use Case をバイパス

3. **データ構造の共有**
   - DB のテーブル構造を Entity として使用
   - API のレスポンスをそのまま Use Case に渡す

4. **ビジネスロジックの漏洩**
   - Controller にビジネスルールを記述
   - DB のストアドプロシージャにロジックを配置

5. **過度な抽象化**
   - 単純な CRUD に全レイヤーを適用
   - 1対1のインターフェースとクラス

## When to Use
- **大規模アプリ**: 10万行以上のコードベース、または年間成長率50%以上
- **複雑なビジネスロジック**: 10以上のビジネスエンティティ、複雑な計算処理
- **長期メンテナンス**: 3年以上の運用予定
- **チーム規模**: 5人以上の開発チーム、並行開発が必要
- **複数UI/統合**: 3つ以上の異なるUIまたは外部システム連携

## When NOT to Use  
- **小規模アプリ**: 1万行未満のコードベース
- **単純なCRUD**: ビジネスロジックが基本的なCRUD操作のみ
- **短期プロジェクト**: 6ヶ月未満の運用予定
- **小規模チーム**: 1-2人の開発者
- **プロトタイプ**: POCや検証目的

## Security Considerations
- **入力検証**: 各レイヤー境界での検証実装
- **認証・認可**: Use Case層での権限チェック
- **データ保護**: Entity層でのPII（個人識別情報）暗号化
- **監査ログ**: Use Case層での操作記録
- **依存性管理**: 外部ライブラリの脆弱性チェック

## Progressive Adoption
1. **Phase 1 - Core Domain** (2-4週間)
   - 最重要ビジネスロジックをEntityとUse Caseに分離
   - 単体テストの実装

2. **Phase 2 - Interface Adapters** (2-3週間) 
   - ControllerとPresenterの実装
   - Repositoryインターフェースの定義

3. **Phase 3 - Infrastructure** (1-2週間)
   - DB実装とフレームワーク統合
   - 外部サービス連携

4. **Phase 4 - Refinement** (継続的)
   - レイヤー境界の調整
   - パフォーマンス最適化

## Related Patterns
- **DDD との組み合わせ**: EntityとValue Objectの設計にDDDを活用
- **Microservices**: 各サービス内部でClean Architectureを適用
- **CQRS**: Use Case層でCommand/Query分離を実装
- **Event Sourcing**: Use Case層でのイベント発行