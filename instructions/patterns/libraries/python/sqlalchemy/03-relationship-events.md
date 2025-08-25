# SQLAlchemy 2.0 イベントと制約

カスケード操作、イベントリスナー、制約管理によるデータ整合性の実装パターン。

## 🔄 カスケード操作

```python
# models/cascading.py
from sqlalchemy.orm import relationship
from sqlalchemy import event, text

class User(Base):
    """カスケード設定パターン"""
    __tablename__ = "users"
    
    # 削除時に子レコードも削除
    posts: Mapped[List["Post"]] = relationship(
        "Post",
        cascade="all, delete-orphan",  # ユーザー削除時に投稿も削除
        passive_deletes=True,  # DB側のON DELETE CASCADEを使用
    )
    
    # 削除時にNULLを設定
    moderated_posts: Mapped[List["Post"]] = relationship(
        "Post",
        foreign_keys="Post.moderator_id",
        cascade="save-update",  # 削除はカスケードしない
    )
    
    # 論理削除のカスケード
    comments: Mapped[List["Comment"]] = relationship(
        "Comment",
        cascade="save-update, merge",  # 物理削除はしない
    )

# カスケードオプション:
# - all: 全操作をカスケード
# - delete: 削除のみカスケード
# - delete-orphan: 親から切り離された子を削除
# - save-update: 保存・更新のみ
# - merge: マージ操作のみ
# - refresh-expire: リフレッシュのみ
```

## 🎯 イベントリスナー

```python
# models/events.py
from sqlalchemy import event
from sqlalchemy.orm import Session

# イベントタイプ別リスナー
@event.listens_for(User, 'before_insert')
def user_before_insert(mapper, connection, target):
    """挿入前処理"""
    target.uuid = str(uuid.uuid4())
    if hasattr(target, '_plain_password'):
        target.password = hash_password(target._plain_password)

@event.listens_for(User, 'before_delete')
def user_before_delete(mapper, connection, target):
    """削除前処理 - 論理削除のカスケード"""
    # 関連データの論理削除
    connection.execute(
        text("UPDATE posts SET is_deleted = true WHERE author_id = :id"),
        {"id": target.id}
    )

@event.listens_for(Post, 'after_insert')
def post_after_insert(mapper, connection, target):
    """挿入後処理 - カウンター更新"""
    connection.execute(
        text("UPDATE users SET post_count = post_count + 1 WHERE id = :id"),
        {"id": target.author_id}
    )

@event.listens_for(Session, 'before_commit')
def session_before_commit(session):
    """コミット前検証"""
    for instance in session.new | session.dirty:
        if hasattr(instance, 'validate'):
            instance.validate()

# イベント応用パターン
class AuditEventListener:
    """監査ログリスナー"""
    
    @staticmethod
    def register(model_class):
        """モデルに監査イベントを登録"""
        
        @event.listens_for(model_class, 'after_insert')
        def audit_insert(mapper, connection, target):
            connection.execute(
                text("""
                    INSERT INTO audit_logs (table_name, action, record_id, changes)
                    VALUES (:table, 'INSERT', :id, :changes)
                """),
                {
                    "table": model_class.__tablename__,
                    "id": target.id,
                    "changes": json.dumps(target.to_dict())
                }
            )
        
        @event.listens_for(model_class, 'after_update')
        def audit_update(mapper, connection, target):
            # 変更されたフィールドのみ記録
            changes = {}
            for attr in target.__mapper__.attrs:
                hist = attr.history
                if hist.has_changes():
                    changes[attr.key] = {
                        "old": hist.deleted[0] if hist.deleted else None,
                        "new": hist.added[0] if hist.added else None
                    }
            
            if changes:
                connection.execute(
                    text("""
                        INSERT INTO audit_logs (table_name, action, record_id, changes)
                        VALUES (:table, 'UPDATE', :id, :changes)
                    """),
                    {
                        "table": model_class.__tablename__,
                        "id": target.id,
                        "changes": json.dumps(changes)
                    }
                )
```

## 🔒 制約管理

```python
# models/constraints.py
from sqlalchemy import UniqueConstraint, CheckConstraint, Index

class Post(Base):
    """制約定義パターン"""
    __tablename__ = "posts"
    
    # カラム定義
    slug: Mapped[str] = mapped_column(String(100))
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    published_at: Mapped[datetime] = mapped_column(nullable=True)
    
    # テーブル制約
    __table_args__ = (
        # 複合ユニーク制約
        UniqueConstraint('author_id', 'slug', name='uq_author_slug'),
        
        # チェック制約
        CheckConstraint('published_at IS NULL OR published_at <= NOW()', 
                       name='ck_published_date'),
        
        # 条件付きユニークインデックス
        Index('idx_unique_published_slug', 'slug',
              unique=True,
              postgresql_where='is_published = true'),
    )

# 動的制約管理
class ConstraintManager:
    """制約の動的管理"""
    
    @staticmethod
    async def add_constraint(session: AsyncSession, constraint_sql: str):
        """制約追加"""
        await session.execute(text(constraint_sql))
        await session.commit()
    
    @staticmethod
    async def validate_constraint(session: AsyncSession, table: str, constraint: str):
        """既存データの制約チェック"""
        result = await session.execute(
            text(f"""
                SELECT COUNT(*) as violations
                FROM {table}
                WHERE NOT ({constraint})
            """)
        )
        violations = result.scalar()
        if violations > 0:
            raise ValueError(f"{violations} rows violate constraint")
```

## 🔄 論理削除パターン

```python
class SoftDeleteMixin:
    """論理削除ミックスイン"""
    
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    
    async def soft_delete(self, session: AsyncSession):
        """論理削除実行"""
        self.is_deleted = True
        self.deleted_at = func.now()
        
        # カスケード処理
        await self._cascade_soft_delete(session)
        
        await session.commit()
    
    async def _cascade_soft_delete(self, session: AsyncSession):
        """子レコードの論理削除"""
        # 各リレーションに対して論理削除を実行
        for rel in self.__mapper__.relationships:
            if rel.cascade.delete:
                children = getattr(self, rel.key)
                if children:
                    for child in children:
                        if hasattr(child, 'soft_delete'):
                            await child.soft_delete(session)
```

## 💡 ベストプラクティス

### カスケード戦略
- **親子関係明確化**: 所有関係がある場合のみdelete-orphan使用
- **論理削除優先**: 物理削除より論理削除を選択
- **DB制約活用**: passive_deletes=TrueでDB側のカスケード利用

### イベント活用
- **自動処理**: UUID生成、タイムスタンプ、ハッシュ化
- **監査ログ**: 全変更の自動記録
- **検証**: コミット前の整合性チェック
- **統計更新**: カウンターの自動更新

### 制約設計
- **DB側制約**: パフォーマンスと確実性のため
- **アプリ側検証**: ユーザーフレンドリーなエラー
- **条件付き制約**: ビジネスロジックの表現