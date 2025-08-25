# SQLAlchemy 2.0 モデルユーティリティ

SQLAlchemy 2.0におけるバリデーション、イベントリスナー、セキュリティ機能の実装。モデルの拡張性と保守性を向上させる実用的なユーティリティ集。

## 📊 高度なモデル機能

### カスタムバリデーション

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
        """ユーザー名検証"""
        if not re.match(r'^[a-zA-Z0-9_]{3,50}$', username):
            raise ValidationError("Username must be 3-50 characters, alphanumeric and underscore only")
        return username.lower()
    
    @validates('password')
    def validate_password(self, key, password):
        """パスワード検証"""
        if len(password) < 8:
            raise ValidationError("Password must be at least 8 characters long")
        if not re.search(r'[A-Z]', password):
            raise ValidationError("Password must contain at least one uppercase letter")
        if not re.search(r'[a-z]', password):
            raise ValidationError("Password must contain at least one lowercase letter")
        if not re.search(r'\d', password):
            raise ValidationError("Password must contain at least one number")
        return password


class ContentValidationMixin:
    """コンテンツバリデーションミックスイン"""
    
    @validates('title')
    def validate_title(self, key, title):
        """タイトル検証"""
        if not title or len(title.strip()) < 3:
            raise ValidationError("Title must be at least 3 characters long")
        if len(title) > 255:
            raise ValidationError("Title cannot exceed 255 characters")
        return title.strip()
    
    @validates('slug')
    def validate_slug(self, key, slug):
        """スラッグ検証"""
        if not re.match(r'^[a-z0-9-]+$', slug):
            raise ValidationError("Slug can only contain lowercase letters, numbers, and hyphens")
        if len(slug) < 3 or len(slug) > 100:
            raise ValidationError("Slug must be between 3 and 100 characters")
        return slug


# 改良されたUserモデル
class User(Base, TimestampMixin, SoftDeleteMixin, UserValidationMixin):
    # ... 既存のフィールド定義 ...
    
    @validates('first_name', 'last_name')
    def validate_name(self, key, name):
        """名前検証"""
        if len(name.strip()) < 1:
            raise ValidationError(f"{key} cannot be empty")
        if len(name) > 50:
            raise ValidationError(f"{key} cannot exceed 50 characters")
        return name.strip().title()
    
    @validates('bio')
    def validate_bio(self, key, bio):
        """経歴検証"""
        if bio and len(bio) > 1000:
            raise ValidationError("Bio cannot exceed 1000 characters")
        return bio.strip() if bio else None
    
    def validate_before_save(self):
        """保存前の総合検証"""
        if self.role == UserRole.ADMIN and not self.is_verified:
            raise ValidationError("Admin users must be verified")
        
        if self.status == UserStatus.ACTIVE and not self.email:
            raise ValidationError("Active users must have an email address")
```

### イベントリスナーとライフサイクル

```python
# models/events.py
from sqlalchemy import event
from sqlalchemy.orm import Session
from datetime import datetime
import logging
import uuid
from passlib.hash import bcrypt

logger = logging.getLogger(__name__)


@event.listens_for(User, 'before_insert')
def receive_before_insert(mapper, connection, target):
    """ユーザー挿入前処理"""
    # UUID生成
    if not target.uuid:
        target.uuid = str(uuid.uuid4())
    
    # パスワードハッシュ化
    if hasattr(target, '_plain_password'):
        target.hashed_password = bcrypt.hash(target._plain_password)
        delattr(target, '_plain_password')
    
    # デフォルト設定の適用
    if not target.settings:
        target.settings = {
            'theme': 'light',
            'language': 'ja',
            'email_notifications': True,
            'privacy_level': 'friends_only'
        }
    
    logger.info(f"Creating new user: {target.username}")


@event.listens_for(User, 'before_update')
def receive_before_update(mapper, connection, target):
    """ユーザー更新前処理"""
    target.updated_at = datetime.utcnow()
    target.version += 1
    
    # パスワード変更時の処理
    if hasattr(target, '_plain_password'):
        target.hashed_password = bcrypt.hash(target._plain_password)
        delattr(target, '_plain_password')
        logger.info(f"Password updated for user: {target.username}")
    
    logger.info(f"Updating user: {target.username}")


@event.listens_for(Post, 'before_insert')
def receive_post_before_insert(mapper, connection, target):
    """投稿挿入前処理"""
    # スラッグの自動生成
    if not target.slug and target.title:
        import re
        slug = re.sub(r'[^a-zA-Z0-9\s-]', '', target.title)
        slug = re.sub(r'[\s-]+', '-', slug).strip('-').lower()
        target.slug = slug[:50]  # 最大50文字
    
    # 抜粋の自動生成
    if not target.excerpt and target.content:
        # HTMLタグを除去して抜粋を作成
        import re
        clean_content = re.sub(r'<[^>]+>', '', target.content)
        target.excerpt = clean_content[:200] + "..." if len(clean_content) > 200 else clean_content


@event.listens_for(Post, 'after_insert')
def receive_post_after_insert(mapper, connection, target):
    """投稿挿入後処理"""
    logger.info(f"New post created: {target.title} by user {target.author_id}")
    
    # 統計情報の更新
    connection.execute(
        text("UPDATE users SET post_count = post_count + 1 WHERE id = :user_id"),
        {"user_id": target.author_id}
    )


@event.listens_for(Comment, 'before_insert')
def receive_comment_before_insert(mapper, connection, target):
    """コメント挿入前処理"""
    # スパム検出（簡単な例）
    spam_keywords = ['spam', 'viagra', 'casino']
    if any(keyword in target.content.lower() for keyword in spam_keywords):
        target.is_spam = True
        target.is_approved = False
        logger.warning(f"Potential spam comment detected: {target.content[:50]}")


@event.listens_for(Session, 'before_commit')
def receive_before_commit(session):
    """コミット前の最終検証"""
    for instance in session.new:
        if hasattr(instance, 'validate_before_save'):
            instance.validate_before_save()
    
    for instance in session.dirty:
        if hasattr(instance, 'validate_before_update'):
            instance.validate_before_update()


@event.listens_for(Session, 'after_commit')
def receive_after_commit(session):
    """コミット後の処理"""
    for instance in session.identity_map.all_states():
        if hasattr(instance.object, 'after_commit_hook'):
            try:
                instance.object.after_commit_hook()
            except Exception as e:
                logger.error(f"Error in after_commit_hook: {e}")
```

## 🔒 セキュリティとアクセス制御

### ロールベースアクセス制御

```python
# models/security.py
from enum import Enum
from functools import wraps
from typing import List, Optional
import jwt
from datetime import datetime, timedelta


class Permission(Enum):
    """権限定義"""
    READ_POST = "read_post"
    WRITE_POST = "write_post"
    DELETE_POST = "delete_post"
    MODERATE_COMMENT = "moderate_comment"
    MANAGE_USER = "manage_user"
    ADMIN_ACCESS = "admin_access"


class SecurityMixin:
    """セキュリティ機能ミックスイン"""
    
    def has_permission(self, permission: Permission) -> bool:
        """権限チェック"""
        role_permissions = {
            UserRole.USER: [
                Permission.READ_POST,
                Permission.WRITE_POST,
            ],
            UserRole.MODERATOR: [
                Permission.READ_POST,
                Permission.WRITE_POST,
                Permission.MODERATE_COMMENT,
            ],
            UserRole.ADMIN: [
                Permission.READ_POST,
                Permission.WRITE_POST,
                Permission.DELETE_POST,
                Permission.MODERATE_COMMENT,
                Permission.MANAGE_USER,
            ],
            UserRole.SUPERUSER: list(Permission),  # すべての権限
        }
        
        return permission in role_permissions.get(self.role, [])
    
    def can_edit_post(self, post: "Post") -> bool:
        """投稿編集権限チェック"""
        # 投稿者本人または管理者
        return (
            self.id == post.author_id or
            self.has_permission(Permission.DELETE_POST)
        )
    
    def can_moderate_comment(self, comment: "Comment") -> bool:
        """コメント管理権限チェック"""
        return (
            self.has_permission(Permission.MODERATE_COMMENT) or
            (comment.post and self.id == comment.post.author_id)
        )
    
    def generate_access_token(self, expires_in: int = 3600) -> str:
        """アクセストークン生成"""
        payload = {
            'user_id': self.id,
            'username': self.username,
            'role': self.role.value,
            'exp': datetime.utcnow() + timedelta(seconds=expires_in),
            'iat': datetime.utcnow(),
        }
        return jwt.encode(payload, 'secret_key', algorithm='HS256')
    
    @classmethod
    def verify_access_token(cls, token: str) -> Optional[dict]:
        """アクセストークン検証"""
        try:
            payload = jwt.decode(token, 'secret_key', algorithms=['HS256'])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None


# セキュリティ強化されたUserモデル
class SecureUser(User, SecurityMixin):
    """セキュリティ機能付きユーザーモデル"""
    
    # ログイン試行回数制限
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_failed_login: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        default=None
    )
    
    # アカウントロック
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    locked_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        default=None
    )
    
    def is_account_locked(self) -> bool:
        """アカウントロック状態チェック"""
        if not self.is_locked:
            return False
        
        if self.locked_until and datetime.utcnow() > self.locked_until:
            # ロック期間が過ぎた場合は自動解除
            self.is_locked = False
            self.locked_until = None
            self.failed_login_attempts = 0
            return False
        
        return True
    
    def record_failed_login(self):
        """ログイン失敗を記録"""
        self.failed_login_attempts += 1
        self.last_failed_login = datetime.utcnow()
        
        # 5回失敗でアカウントロック（30分間）
        if self.failed_login_attempts >= 5:
            self.is_locked = True
            self.locked_until = datetime.utcnow() + timedelta(minutes=30)
    
    def record_successful_login(self):
        """ログイン成功を記録"""
        self.failed_login_attempts = 0
        self.last_failed_login = None
        self.last_login_at = datetime.utcnow()
        self.login_count += 1
        
        # ロック状態を解除
        if self.is_locked:
            self.is_locked = False
            self.locked_until = None
```

## 🔍 クエリヘルパーとスコープ

### 便利なクエリメソッド

```python
# models/query_helpers.py
from sqlalchemy import select, and_, or_, func, text
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any


class QueryHelperMixin:
    """クエリヘルパーミックスイン"""
    
    @classmethod
    async def find_by_id(cls, session, id: int):
        """IDによる検索"""
        result = await session.execute(
            select(cls).where(cls.id == id)
        )
        return result.scalar_one_or_none()
    
    @classmethod
    async def find_all_active(cls, session, limit: int = 100):
        """アクティブなレコードを全取得"""
        stmt = select(cls).where(cls.is_active == True).limit(limit)
        if hasattr(cls, 'is_deleted'):
            stmt = stmt.where(cls.is_deleted == False)
        
        result = await session.execute(stmt)
        return result.scalars().all()
    
    @classmethod
    async def search_by_text(cls, session, query: str, fields: List[str]):
        """テキスト検索"""
        conditions = []
        for field in fields:
            if hasattr(cls, field):
                field_attr = getattr(cls, field)
                conditions.append(field_attr.ilike(f"%{query}%"))
        
        if not conditions:
            return []
        
        stmt = select(cls).where(or_(*conditions))
        result = await session.execute(stmt)
        return result.scalars().all()


class PostQueryMixin(QueryHelperMixin):
    """投稿専用クエリメソッド"""
    
    @classmethod
    async def find_published(cls, session, limit: int = 10):
        """公開済み投稿取得"""
        stmt = (
            select(cls)
            .options(
                selectinload(cls.author),
                selectinload(cls.category)
            )
            .where(and_(
                cls.is_published == True,
                cls.is_deleted == False
            ))
            .order_by(cls.created_at.desc())
            .limit(limit)
        )
        
        result = await session.execute(stmt)
        return result.scalars().all()
    
    @classmethod
    async def find_by_author(cls, session, author_id: int):
        """著者による投稿検索"""
        stmt = (
            select(cls)
            .where(and_(
                cls.author_id == author_id,
                cls.is_deleted == False
            ))
            .order_by(cls.created_at.desc())
        )
        
        result = await session.execute(stmt)
        return result.scalars().all()
    
    @classmethod
    async def find_popular(cls, session, days: int = 30, limit: int = 10):
        """人気投稿取得"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        stmt = (
            select(cls)
            .where(and_(
                cls.is_published == True,
                cls.created_at >= cutoff_date
            ))
            .order_by(cls.view_count.desc())
            .limit(limit)
        )
        
        result = await session.execute(stmt)
        return result.scalars().all()
```