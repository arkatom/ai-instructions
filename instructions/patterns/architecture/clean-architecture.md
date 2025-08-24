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
- 依存性は外側から内側へのみ向かう
- 内側のレイヤーは外側のレイヤーを知らない
- データ構造も内側から外側へ渡す際は変換する

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
- 長期的にメンテナンスされる大規模アプリケーション
- ビジネスロジックが複雑で変更が多い
- 複数のUIや外部システムとの統合が必要
- チームが大きく、並行開発が必要

## When NOT to Use
- プロトタイプや短期的なプロジェクト
- シンプルなCRUDアプリケーション
- ビジネスロジックがほとんどない
- 小規模チームで開発速度が優先