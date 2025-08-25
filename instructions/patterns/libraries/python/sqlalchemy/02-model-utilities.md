# SQLAlchemy 2.0 モデルユーティリティ

バリデーション、イベントリスナー、セキュリティ機能の実装パターン。

## 📊 カスタムバリデーション

```python
# models/validators.py
from sqlalchemy.orm import validates
from sqlalchemy.exc import ValidationError
import re

class UserValidationMixin:
    """ユーザーバリデーションミックスイン"""
    
    @validates('email')
    def validate_email(self, key, email):
        """メールアドレス検証"""
        if not re.match(r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$', email):
            raise ValidationError("Invalid email format")
        return email.lower()
    
    @validates('username')
    def validate_username(self, key, username):
        """ユーザー名検証 - 3-50文字、英数字と_のみ"""
        if not re.match(r'^[a-zA-Z0-9_]{3,50}$', username):
            raise ValidationError("Invalid username format")
        return username.lower()
    
    @validates('password')
    def validate_password(self, key, password):
        """パスワード強度検証"""
        # 最小8文字、大文字、小文字、数字を含む
        validations = [
            (len(password) >= 8, "At least 8 characters"),
            (re.search(r'[A-Z]', password), "One uppercase letter"),
            (re.search(r'[a-z]', password), "One lowercase letter"),
            (re.search(r'\d', password), "One number")
        ]
        
        for check, msg in validations:
            if not check:
                raise ValidationError(f"Password must contain: {msg}")
        return password

# 使用例
class User(Base, TimestampMixin, UserValidationMixin):
    __tablename__ = 'users'
    
    # カラム定義...
    
    def validate_before_save(self):
        """保存前の総合検証"""
        if self.role == UserRole.ADMIN and not self.is_verified:
            raise ValidationError("Admin users must be verified")
```

## 🎭 イベントリスナー

```python
# models/events.py
from sqlalchemy import event
from sqlalchemy.orm import Session
import uuid
from passlib.hash import bcrypt

@event.listens_for(User, 'before_insert')
def user_before_insert(mapper, connection, target):
    """ユーザー挿入前処理"""
    # UUID生成
    if not target.uuid:
        target.uuid = str(uuid.uuid4())
    
    # パスワードハッシュ化
    if hasattr(target, '_plain_password'):
        target.hashed_password = bcrypt.hash(target._plain_password)
        delattr(target, '_plain_password')
    
    # デフォルト設定
    if not target.settings:
        target.settings = {
            'theme': 'light',
            'language': 'ja',
            'email_notifications': True
        }

@event.listens_for(Post, 'before_insert')
def post_before_insert(mapper, connection, target):
    """投稿挿入前処理"""
    # スラッグ自動生成
    if not target.slug and target.title:
        slug = re.sub(r'[^a-zA-Z0-9\s-]', '', target.title)
        slug = re.sub(r'[\s-]+', '-', slug).strip('-').lower()[:50]
        target.slug = slug
    
    # 抜粋自動生成（HTMLタグ除去）
    if not target.excerpt and target.content:
        clean_content = re.sub(r'<[^>]+>', '', target.content)
        target.excerpt = clean_content[:200] + "..." if len(clean_content) > 200 else clean_content

@event.listens_for(Session, 'before_commit')
def session_before_commit(session):
    """コミット前の最終検証"""
    for instance in session.new | session.dirty:
        if hasattr(instance, 'validate_before_save'):
            instance.validate_before_save()

# イベントリスナーの種類:
# - before_insert, after_insert: 挿入前後
# - before_update, after_update: 更新前後
# - before_delete, after_delete: 削除前後
# - before_commit, after_commit: コミット前後
# - before_flush, after_flush: フラッシュ前後
```

## 🔒 セキュリティとアクセス制御

```python
# models/security.py
from enum import Enum
import jwt
from datetime import datetime, timedelta

class Permission(Enum):
    """権限定義"""
    READ_POST = "read_post"
    WRITE_POST = "write_post"
    DELETE_POST = "delete_post"
    MODERATE_COMMENT = "moderate_comment"
    MANAGE_USER = "manage_user"

class SecurityMixin:
    """セキュリティ機能ミックスイン"""
    
    # ロール別権限マッピング
    ROLE_PERMISSIONS = {
        UserRole.USER: [Permission.READ_POST, Permission.WRITE_POST],
        UserRole.MODERATOR: [Permission.READ_POST, Permission.WRITE_POST, Permission.MODERATE_COMMENT],
        UserRole.ADMIN: list(Permission),  # 全権限
    }
    
    def has_permission(self, permission: Permission) -> bool:
        """権限チェック"""
        return permission in self.ROLE_PERMISSIONS.get(self.role, [])
    
    def can_edit(self, resource) -> bool:
        """リソース編集権限チェック"""
        # 所有者または管理者
        return self.id == resource.author_id or self.has_permission(Permission.DELETE_POST)
    
    def generate_token(self, expires_in: int = 3600) -> str:
        """JWTトークン生成"""
        payload = {
            'user_id': self.id,
            'role': self.role.value,
            'exp': datetime.utcnow() + timedelta(seconds=expires_in)
        }
        return jwt.encode(payload, 'secret_key', algorithm='HS256')
    
    # ログイン試行管理
    def record_failed_login(self):
        """ログイン失敗記録 - 5回でロック"""
        self.failed_attempts += 1
        if self.failed_attempts >= 5:
            self.locked_until = datetime.utcnow() + timedelta(minutes=30)
    
    def is_locked(self) -> bool:
        """アカウントロック状態確認"""
        return self.locked_until and datetime.utcnow() < self.locked_until
```

## 🔍 クエリヘルパー

```python
# models/query_helpers.py
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload

class QueryHelperMixin:
    """クエリヘルパーミックスイン"""
    
    @classmethod
    async def find_by_id(cls, session, id: int):
        """ID検索"""
        result = await session.execute(
            select(cls).where(cls.id == id)
        )
        return result.scalar_one_or_none()
    
    @classmethod
    async def find_active(cls, session, limit: int = 100):
        """アクティブレコード取得"""
        stmt = select(cls).where(cls.is_active == True)
        if hasattr(cls, 'is_deleted'):
            stmt = stmt.where(cls.is_deleted == False)
        
        result = await session.execute(stmt.limit(limit))
        return result.scalars().all()
    
    @classmethod
    async def search(cls, session, query: str, fields: list):
        """テキスト検索"""
        conditions = [
            getattr(cls, field).ilike(f"%{query}%")
            for field in fields 
            if hasattr(cls, field)
        ]
        
        stmt = select(cls).where(or_(*conditions))
        result = await session.execute(stmt)
        return result.scalars().all()

class PostQueryMixin(QueryHelperMixin):
    """投稿専用クエリ"""
    
    @classmethod
    async def find_published(cls, session, limit: int = 10):
        """公開済み投稿取得（関連データ含む）"""
        stmt = (
            select(cls)
            .options(
                selectinload(cls.author),
                selectinload(cls.category),
                selectinload(cls.tags)
            )
            .where(cls.is_published == True)
            .order_by(cls.created_at.desc())
            .limit(limit)
        )
        
        result = await session.execute(stmt)
        return result.scalars().all()
    
    @classmethod
    async def find_popular(cls, session, days: int = 7):
        """人気投稿取得"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        # ビュー数 + いいね数×2 でスコア計算
        stmt = (
            select(cls)
            .where(cls.created_at >= cutoff)
            .order_by((cls.view_count + cls.like_count * 2).desc())
            .limit(10)
        )
        
        result = await session.execute(stmt)
        return result.scalars().all()
```

## 💡 実装のポイント

### バリデーション戦略
- **@validates**: フィールドレベル検証
- **validate_before_save**: エンティティレベル検証
- **カスタム例外**: 詳細なエラーメッセージ

### イベントリスナー活用
- **自動処理**: UUID生成、タイムスタンプ更新
- **データ変換**: パスワードハッシュ化、スラッグ生成
- **関連更新**: カウンター更新、キャッシュ無効化

### セキュリティ実装
- **RBAC**: ロールベースアクセス制御
- **トークン管理**: JWT生成・検証
- **アカウント保護**: ログイン試行制限、ロック機能

### クエリ最適化
- **共通パターン**: ミックスインで再利用
- **Eager Loading**: selectinloadで関連データ取得
- **インデックス活用**: 検索フィールドにインデックス