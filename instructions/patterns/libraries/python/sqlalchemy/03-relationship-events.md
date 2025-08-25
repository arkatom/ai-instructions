# SQLAlchemy 2.0 イベントと制約

SQLAlchemy 2.0におけるカスケード操作、イベントリスナー、制約管理。データ整合性とライフサイクル管理の高度な実装パターン。

## 🔄 カスケード操作

### 効率的なカスケード設定

```python
# models/cascading.py
from sqlalchemy.orm import relationship
from sqlalchemy import ForeignKey, event
from sqlalchemy.orm.events import InstanceEvents


class UserWithCascading(Base, TimestampMixin):
    """カスケード操作を含むユーザーモデル"""
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    username: Mapped[str] = mapped_column(String(50), unique=True)
    
    # カスケード設定パターン
    
    # 1. 削除時に子レコードも削除
    posts: Mapped[List["Post"]] = relationship(
        "Post",
        back_populates="author",
        cascade="all, delete-orphan",  # ユーザー削除時に投稿も削除
        passive_deletes=True,  # DB側のON DELETE CASCADEを使用
        init=False
    )
    
    # 2. 削除時にNULLを設定
    moderated_posts: Mapped[List["Post"]] = relationship(
        "Post",
        foreign_keys="Post.moderator_id",
        cascade="save-update",  # 削除はカスケードしない
        passive_deletes=True,
        init=False
    )
    
    # 3. 論理削除のカスケード
    comments: Mapped[List["Comment"]] = relationship(
        "Comment",
        back_populates="author",
        cascade="save-update, merge",
        init=False
    )


@event.listens_for(UserWithCascading, 'before_delete')
def before_user_delete(mapper, connection, target):
    """ユーザー削除前の処理"""
    # 論理削除のカスケード
    connection.execute(
        text("UPDATE comments SET is_deleted = true WHERE author_id = :user_id"),
        {"user_id": target.id}
    )
    
    # 統計情報の更新
    connection.execute(
        text("UPDATE posts SET author_display_name = :name WHERE author_id = :user_id"),
        {"name": f"削除されたユーザー({target.username})", "user_id": target.id}
    )


class SoftDeleteCascade:
    """論理削除のカスケード処理"""
    
    @staticmethod
    async def soft_delete_user(session: AsyncSession, user_id: int):
        """ユーザーの論理削除（関連データも含む）"""
        # ユーザーの論理削除
        await session.execute(
            update(User)
            .where(User.id == user_id)
            .values(is_deleted=True, deleted_at=func.now())
        )
        
        # 関連する投稿の論理削除
        await session.execute(
            update(Post)
            .where(Post.author_id == user_id)
            .values(is_deleted=True, deleted_at=func.now())
        )
        
        # 関連するコメントの論理削除
        await session.execute(
            update(Comment)
            .where(Comment.author_id == user_id)
            .values(is_deleted=True, deleted_at=func.now())
        )
        
        await session.commit()
```

## 🎯 イベントリスナーとライフサイクル

### モデルライフサイクル管理

```python
# models/events.py
from sqlalchemy import event
from sqlalchemy.orm import Session
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


@event.listens_for(User, 'before_insert')
def receive_before_insert(mapper, connection, target):
    """ユーザー挿入前処理"""
    # UUID生成
    if not target.uuid:
        target.uuid = str(uuid.uuid4())
    
    # パスワードハッシュ化
    if hasattr(target, '_plain_password'):
        target.hashed_password = hash_password(target._plain_password)
        delattr(target, '_plain_password')
    
    logger.info(f"Creating new user: {target.username}")


@event.listens_for(User, 'before_update')
def receive_before_update(mapper, connection, target):
    """ユーザー更新前処理"""
    target.updated_at = datetime.utcnow()
    target.version += 1
    
    logger.info(f"Updating user: {target.username}")


@event.listens_for(Post, 'after_insert')
def receive_post_after_insert(mapper, connection, target):
    """投稿挿入後処理"""
    # 通知送信、インデックス更新など
    logger.info(f"New post created: {target.title} by user {target.author_id}")


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
    # キャッシュクリア、通知送信など
    for instance in session.identity_map.all_states():
        if hasattr(instance.object, 'after_commit_hook'):
            instance.object.after_commit_hook()
```

## 🛡️ 制約管理とバリデーション

### 高度な制約パターン

```python
# models/constraints.py
from sqlalchemy import CheckConstraint, UniqueConstraint, Index, func
from sqlalchemy.schema import DDL
from sqlalchemy.orm import validates


class AdvancedConstraintsModel(Base, TimestampMixin):
    """高度な制約を含むモデル"""
    __tablename__ = "advanced_model"
    
    id: Mapped[int] = mapped_column(primary_key=True, init=False)
    
    # 基本フィールド
    email: Mapped[str] = mapped_column(String(255))
    age: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20))
    priority: Mapped[int] = mapped_column(Integer)
    score: Mapped[float] = mapped_column(Float)
    
    # 複雑な制約定義
    __table_args__ = (
        # 複合制約
        CheckConstraint(
            "age >= 0 AND age <= 150",
            name="check_valid_age"
        ),
        
        # 条件付き制約
        CheckConstraint(
            "CASE WHEN status = 'active' THEN priority > 0 ELSE true END",
            name="check_active_priority"
        ),
        
        # 正規表現制約
        CheckConstraint(
            "email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'",
            name="check_email_format"
        ),
        
        # 複合ユニーク制約
        UniqueConstraint("email", "status", name="uq_email_status"),
        
        # 部分インデックス（PostgreSQL）
        Index(
            "idx_active_high_priority", 
            "priority", 
            postgresql_where=(status == 'active')
        ),
        
        # 式ベースのインデックス
        Index(
            "idx_email_domain",
            func.split_part(email, '@', 2)
        ),
    )
    
    @validates('email')
    def validate_email(self, key, email):
        """メールアドレス検証"""
        import re
        pattern = r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
        if not re.match(pattern, email):
            raise ValueError("Invalid email format")
        return email.lower()
    
    @validates('age')
    def validate_age(self, key, age):
        """年齢検証"""
        if not 0 <= age <= 150:
            raise ValueError("Age must be between 0 and 150")
        return age
    
    @validates('status')
    def validate_status(self, key, status):
        """ステータス検証"""
        valid_statuses = ['active', 'inactive', 'pending', 'suspended']
        if status not in valid_statuses:
            raise ValueError(f"Status must be one of: {valid_statuses}")
        return status


# データベース関数とトリガー
create_audit_trigger = DDL("""
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, operation, new_values, timestamp)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(NEW), NOW());
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, operation, old_values, new_values, timestamp)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), row_to_json(NEW), NOW());
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, operation, old_values, timestamp)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), NOW());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
""")

# テーブル作成後にトリガーを作成
@event.listens_for(AdvancedConstraintsModel.__table__, 'after_create')
def create_audit_trigger_for_table(target, connection, **kw):
    """監査トリガーの作成"""
    create_audit_trigger.execute(connection)
    
    trigger_sql = f"""
    CREATE TRIGGER audit_trigger_{target.name}
    AFTER INSERT OR UPDATE OR DELETE ON {target.name}
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
    """
    
    connection.execute(text(trigger_sql))
```

## ⚙️ カスタムイベントハンドラー

### 高度なイベント処理

```python
# events/handlers.py
from sqlalchemy import event
from sqlalchemy.pool import Pool
from sqlalchemy.engine import Engine
import logging
import asyncio
from datetime import datetime

logger = logging.getLogger(__name__)


class EventHandlers:
    """カスタムイベントハンドラー集約"""
    
    def __init__(self):
        self.performance_stats = {
            'query_count': 0,
            'slow_queries': 0,
            'connection_count': 0
        }
    
    def setup_all_handlers(self, engine: Engine):
        """全イベントハンドラーの設定"""
        self.setup_connection_handlers(engine)
        self.setup_query_handlers(engine)
        self.setup_model_handlers()
    
    def setup_connection_handlers(self, engine: Engine):
        """接続関連ハンドラー"""
        
        @event.listens_for(Pool, "connect")
        def on_connect(dbapi_connection, connection_record):
            """接続時の処理"""
            self.performance_stats['connection_count'] += 1
            logger.debug(f"New connection established. Total: {self.performance_stats['connection_count']}")
        
        @event.listens_for(Pool, "checkout")
        def on_checkout(dbapi_connection, connection_record, connection_proxy):
            """接続チェックアウト時の処理"""
            connection_proxy.info['checkout_time'] = datetime.utcnow()
        
        @event.listens_for(Pool, "checkin")
        def on_checkin(dbapi_connection, connection_record):
            """接続チェックイン時の処理"""
            if 'checkout_time' in connection_record.info:
                usage_time = datetime.utcnow() - connection_record.info['checkout_time']
                if usage_time.total_seconds() > 30:  # 30秒以上の長時間使用
                    logger.warning(f"Long connection usage: {usage_time}")
    
    def setup_query_handlers(self, engine: Engine):
        """クエリ関連ハンドラー"""
        
        @event.listens_for(engine, "before_cursor_execute")
        def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            """クエリ実行前の処理"""
            context._query_start_time = datetime.utcnow()
            self.performance_stats['query_count'] += 1
        
        @event.listens_for(engine, "after_cursor_execute")
        def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            """クエリ実行後の処理"""
            total_time = datetime.utcnow() - context._query_start_time
            
            if total_time.total_seconds() > 1.0:  # 1秒以上のクエリ
                self.performance_stats['slow_queries'] += 1
                logger.warning(f"Slow query ({total_time.total_seconds():.2f}s): {statement[:100]}")
    
    def setup_model_handlers(self):
        """モデル関連ハンドラー"""
        
        @event.listens_for(User, "load")
        def user_load_handler(target, context):
            """ユーザーロード時の処理"""
            # キャッシュ更新、統計更新など
            logger.debug(f"User loaded: {target.username}")
        
        @event.listens_for(Post, "before_insert")
        def post_before_insert(mapper, connection, target):
            """投稿挿入前の処理"""
            # 自動タグ付け、スパム検出など
            if not target.excerpt and target.content:
                target.excerpt = target.content[:200] + "..." if len(target.content) > 200 else target.content
        
        @event.listens_for(Post, "after_update")
        def post_after_update(mapper, connection, target):
            """投稿更新後の処理"""
            # 検索インデックス更新、通知送信など
            logger.info(f"Post updated: {target.title}")
```