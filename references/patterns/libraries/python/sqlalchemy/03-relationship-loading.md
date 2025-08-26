# SQLAlchemy 2.0 リレーションシップローディング

遅延読み込み戦略とN+1問題の解決パターン。

## ⚡ ローディング戦略

```python
# models/relationships.py
from sqlalchemy.orm import relationship, selectinload, joinedload

class User(Base):
    """最適化されたリレーションシップ設定"""
    __tablename__ = "users"
    
    # 即座に読み込み（常に必要な小データ）
    profile: Mapped["UserProfile"] = relationship(
        lazy="selectin",  # 別クエリで即読み込み
        uselist=False
    )
    
    # 動的読み込み（大量データ）
    posts: Mapped[List["Post"]] = relationship(
        lazy="dynamic",  # クエリオブジェクトとして返す
        cascade="all, delete-orphan"
    )
    
    # 条件付きリレーション（特定条件のみ）
    recent_posts: Mapped[List["Post"]] = relationship(
        primaryjoin="and_(User.id == Post.author_id, "
                   "Post.created_at >= func.date_sub(func.now(), text('INTERVAL 30 DAY')))",
        lazy="selectin",
        viewonly=True  # 読み取り専用
    )

# ローディング戦略:
# - lazy="select": デフォルト、アクセス時に読み込み（N+1注意）
# - lazy="selectin": IN句で一括読み込み（推奨）
# - lazy="joined": JOINで一度に読み込み
# - lazy="subquery": サブクエリで読み込み
# - lazy="dynamic": クエリオブジェクトを返す
# - lazy="noload": 読み込まない
```

## 🎯 N+1問題の解決

```python
# repositories/optimized_repository.py
from sqlalchemy import select
from sqlalchemy.orm import selectinload, joinedload, contains_eager

class PostRepository:
    """最適化されたクエリパターン"""
    
    async def get_posts_with_related(
        self,
        include_author: bool = True,
        include_comments: bool = False,
        limit: int = 10
    ) -> List[Post]:
        """関連データを含む投稿取得"""
        
        # 動的オプション構築
        options = []
        
        if include_author:
            # selectinload: 別クエリで効率的に取得
            options.append(selectinload(Post.author))
        
        if include_comments:
            # ネストした関連も一括取得
            options.append(
                selectinload(Post.comments)
                .selectinload(Comment.author)
            )
        
        stmt = (
            select(Post)
            .options(*options)
            .where(Post.is_published == True)
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        return result.scalars().all()
    
    async def get_posts_with_stats(self) -> List[Post]:
        """統計情報付き投稿取得（JOIN使用）"""
        
        stmt = (
            select(Post, func.count(Comment.id).label("comment_count"))
            .outerjoin(Comment)
            .options(contains_eager(Post.comments))  # JOINしたデータを活用
            .group_by(Post.id)
            .limit(10)
        )
        
        result = await self.session.execute(stmt)
        return result.all()
```

## 🔄 動的ローディング

```python
class DynamicLoader:
    """動的ローディングパターン"""
    
    async def load_user_with_options(
        self,
        user_id: int,
        load_posts: bool = False,
        load_followers: bool = False,
        posts_limit: int = 10
    ) -> User:
        """必要なデータのみ動的に読み込み"""
        
        # ベースクエリ
        stmt = select(User).where(User.id == user_id)
        
        # 条件に応じてローディング戦略を追加
        if load_posts:
            stmt = stmt.options(
                selectinload(User.posts).options(
                    selectinload(Post.tags),
                    selectinload(Post.category)
                )
            )
        
        if load_followers:
            stmt = stmt.options(
                selectinload(User.followers).selectinload(UserFollow.follower)
            )
        
        result = await self.session.execute(stmt)
        user = result.scalar_one()
        
        # 動的リレーションシップの処理
        if user.posts.options(lazyload='dynamic'):
            # 動的クエリで条件付き取得
            user.recent_posts = await self.session.execute(
                user.posts.filter(Post.created_at >= thirty_days_ago)
                .limit(posts_limit)
            ).scalars().all()
        
        return user
```

## 📊 ローディング最適化

```python
class LoadingOptimizer:
    """ローディング最適化ヘルパー"""
    
    @staticmethod
    def optimize_query(base_query, relationships: dict):
        """関連データのローディング最適化"""
        
        for rel_name, strategy in relationships.items():
            if strategy == "select":
                # 個別クエリ（大量データ用）
                base_query = base_query.options(selectinload(rel_name))
            elif strategy == "join":
                # JOIN（小データ用）
                base_query = base_query.options(joinedload(rel_name))
            elif strategy == "subquery":
                # サブクエリ（中規模データ用）
                base_query = base_query.options(subqueryload(rel_name))
            elif strategy == "none":
                # 読み込まない
                base_query = base_query.options(noload(rel_name))
        
        return base_query

# 使用例
relationships = {
    "author": "select",      # 別クエリで取得
    "tags": "join",          # JOINで取得
    "comments": "none"       # 読み込まない
}

query = LoadingOptimizer.optimize_query(select(Post), relationships)
```

## 💡 ベストプラクティス

### ローディング戦略選択
| データ量 | 関係性 | 推奨戦略 |
|---------|--------|----------|
| 小（1-10） | 1対1 | joinedload |
| 中（10-100） | 1対多 | selectinload |
| 大（100+） | 1対多 | dynamic/select |
| 巨大 | 多対多 | 明示的クエリ |

### パフォーマンス最適化
- **selectinload優先**: ほとんどの場合で最適
- **joinedload注意**: 重複データに注意
- **dynamic活用**: 大量データには必須
- **バッチサイズ調整**: selectinloadのIN句サイズ

### N+1問題チェックリスト
1. ループ内でのリレーション アクセス確認
2. 適切なローディング戦略選択
3. クエリログで実行回数確認
4. 必要最小限のデータ取得