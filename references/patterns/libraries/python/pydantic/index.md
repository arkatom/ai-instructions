# Pydantic v2 Data Validation パターン

Pydantic v2の最新機能を活用した高度なデータバリデーション・シリアライゼーションパターン集。型安全性、パフォーマンス、拡張性を重視したモダンなデータ処理手法。

## 📚 ドキュメント構成

| ファイル | 内容 | 主要トピック |
|---------|------|------------|
| [01-basic-setup.md](./01-basic-setup.md) | 基本設定 | BaseModel設定、ConfigDict、カスタム型定義、Annotated型 |
| [02-user-models.md](./02-user-models.md) | ユーザーモデル | 実践的なユーザーモデル実装、フィールドバリデーション、computed fields |
| [03-validation-patterns.md](./03-validation-patterns.md) | バリデーションパターン | 動的バリデーター、ビジネスルール、外部API連携 |
| [04-complex-models.md](./04-complex-models.md) | 複雑なモデル | 決済モデル、ネストしたバリデーション、相互依存 |
| [05-serialization.md](./05-serialization.md) | シリアライゼーション | カスタムシリアライザー、条件付き出力、パフォーマンス最適化 |
| [06-basic-testing.md](./06-basic-testing.md) | 基本テスト | ユーザー・決済・注文バリデーションテスト |
| [07-advanced-testing.md](./07-advanced-testing.md) | 高度なテスト | パフォーマンステスト、エッジケース、統合テスト |

## 🎯 主要機能

### Pydantic v2の新機能
- **ConfigDict**: 新しい設定管理システム
- **field_validator**: フィールドレベルのバリデーション
- **model_validator**: モデル全体のバリデーション
- **computed_field**: 計算フィールドの定義
- **field_serializer**: カスタムシリアライゼーション
- **Annotated型**: 型ヒントによる制約定義

### パフォーマンス最適化
- Rust実装による高速化
- 遅延評価とキャッシング
- 効率的なシリアライゼーション
- メモリ使用量の最適化

## 🚀 クイックスタート

```python
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone

class BaseAPIModel(BaseModel):
    """API用ベースモデル"""
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
        ser_json_timedelta="float"
    )

class UserModel(BaseAPIModel):
    """ユーザーモデル"""
    username: str = Field(min_length=3, max_length=50)
    email: str = Field(pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
```

## 💡 ベストプラクティス

1. **型安全性を重視**: Annotated型とField()を組み合わせて制約を明確に
2. **バリデーションの階層化**: field_validator → model_validator の順で検証
3. **エラーメッセージの日本語化**: ユーザーフレンドリーなエラー表示
4. **パフォーマンスの考慮**: 必要に応じてバリデーションを無効化
5. **テストの充実**: すべてのバリデーションケースをカバー

## 📋 利用シーン

- **Web API開発**: リクエスト/レスポンスのバリデーション
- **データ処理**: ETLパイプラインでのデータ検証
- **設定管理**: アプリケーション設定の型安全な管理
- **フォームバリデーション**: Webフォームの入力検証
- **データベース連携**: ORMモデルとの統合

## 🔗 関連リソース

- [Pydantic v2 公式ドキュメント](https://docs.pydantic.dev/)
- [マイグレーションガイド](https://docs.pydantic.dev/latest/migration/)
- [パフォーマンスガイド](https://docs.pydantic.dev/latest/concepts/performance/)