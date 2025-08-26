# SQLAlchemy 2.0 Loading Optimization & Bulk Operations

Essential patterns for solving N+1 problems and implementing high-performance bulk operations.

## ⚡ N+1 Problem Solutions

### selectinload Pattern

```python
# Core loading optimization patterns
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Dict, Any

class OptimizedLoadingRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_posts_with_relations(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Efficiently load posts with all relations - prevents N+1"""
        
        stmt = (
            select(Post)
            .options(
                selectinload(Post.author),           # 1:1 relation
                selectinload(Post.category),         # N:1 relation  
                selectinload(Post.tags),             # N:M relation
                # Nested loading: comments + their authors
                selectinload(Post.comments.and_(
                    Comment.is_deleted == False
                )).selectinload(Comment.author),
                # Deep nesting: comment replies + authors
                selectinload(Post.comments).selectinload(Comment.replies.and_(
                    Comment.is_deleted == False
                )).selectinload(Comment.author)
            )
            .where(Post.is_published == True)
            .order_by(Post.created_at.desc())
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        posts = result.scalars().all()
        
        # Separate aggregation query for statistics
        post_ids = [post.id for post in posts]
        stats_stmt = (
            select(
                Post.id,
                func.count(Comment.id).label("comment_count"),
                func.count(PostLike.id).label("like_count")
            )
            .outerjoin(Comment, and_(Comment.post_id == Post.id, Comment.is_deleted == False))
            .outerjoin(PostLike)
            .where(Post.id.in_(post_ids))
            .group_by(Post.id)
        )
        
        stats_result = await self.session.execute(stats_stmt)
        stats_by_id = {row.id: {"comments": row.comment_count, "likes": row.like_count} 
                       for row in stats_result}
        
        return [{"post": post, "stats": stats_by_id.get(post.id, {})} 
                for post in posts]

    # Additional loading strategies:
    # - joinedload: Use for 1:1 or small N:1 relations  
    # - contains_eager: For custom JOIN queries
    # - raiseload: Explicitly prevent lazy loading
```

## 🚀 Bulk Operations

### High-Performance Bulk Patterns

```python
from sqlalchemy import update, delete, text, bindparam
from sqlalchemy.dialects.postgresql import insert

class BulkOperationsRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def bulk_upsert(self, users_data: List[Dict[str, Any]]) -> List[int]:
        """PostgreSQL UPSERT pattern - handles conflicts efficiently"""
        
        stmt = insert(User).values(users_data)
        stmt = stmt.on_conflict_do_update(
            index_elements=['email'],
            set_={
                'updated_at': func.now(),
                'first_name': stmt.excluded.first_name,
                # Add other fields to update on conflict
            }
        ).returning(User.id)
        
        result = await self.session.execute(stmt)
        await self.session.commit()
        return [row.id for row in result]
    
    async def bulk_update_with_binds(self, updates: List[Dict[str, Any]]) -> int:
        """Efficient bulk updates using bindparam"""
        
        stmt = (
            update(Post)
            .where(Post.id == bindparam('post_id'))
            .values(
                view_count=bindparam('view_count'),
                like_count=bindparam('like_count'),
                updated_at=func.now()
            )
        )
        
        result = await self.session.execute(stmt, updates)
        await self.session.commit()
        return result.rowcount
    
    async def bulk_soft_delete(self, ids: List[int]) -> int:
        """Cascade soft delete pattern"""
        
        # Main entity
        main_stmt = (
            update(Post)
            .where(Post.id.in_(ids))
            .values(is_deleted=True, deleted_at=func.now())
        )
        
        # Related entities  
        related_stmt = (
            update(Comment)
            .where(Comment.post_id.in_(ids))
            .values(is_deleted=True, deleted_at=func.now())
        )
        
        await self.session.execute(main_stmt)
        await self.session.execute(related_stmt)
        await self.session.commit()
        return len(ids)
    
    async def complex_bulk_analysis(self, user_ids: List[int]) -> Dict[int, Dict[str, Any]]:
        """CTE-based bulk analytics - single query for complex aggregations"""
        
        stmt = text("""
            WITH user_stats AS (
                SELECT 
                    u.id as user_id,
                    COUNT(DISTINCT p.id) as post_count,
                    COUNT(DISTINCT c.id) as comment_count,
                    AVG(p.view_count) as avg_views,
                    MAX(p.created_at) as last_activity
                FROM users u
                LEFT JOIN posts p ON u.id = p.author_id AND p.is_deleted = false
                LEFT JOIN comments c ON u.id = c.author_id AND c.is_deleted = false
                WHERE u.id = ANY(:user_ids)
                GROUP BY u.id
            )
            SELECT user_id, post_count, comment_count, 
                   COALESCE(avg_views, 0) as avg_views, last_activity
            FROM user_stats
        """)
        
        result = await self.session.execute(stmt, {"user_ids": user_ids})
        return {
            row.user_id: {
                "posts": row.post_count, 
                "comments": row.comment_count,
                "avg_views": float(row.avg_views),
                "last_activity": row.last_activity
            }
            for row in result
        }

# Performance Tips:
# 1. Use selectinload for collections, joinedload for scalars
# 2. Combine related queries when possible  
# 3. Use bindparam for bulk updates
# 4. Prefer UPSERT over SELECT-then-INSERT/UPDATE
# 5. Leverage database-specific features (PostgreSQL RETURNING, etc.)
# 6. Use CTEs for complex aggregations
```

## 🔧 Advanced Loading Strategies

### Dynamic Loading with Conditions

```python
# Dynamic loading based on context
from sqlalchemy.orm import Load

async def get_posts_contextual(self, user_id: Optional[int] = None, 
                              include_stats: bool = False) -> List[Post]:
    """Context-aware loading - only load what's needed"""
    
    options = [selectinload(Post.author)]
    
    # Conditional loading based on user context
    if user_id:
        options.append(selectinload(Post.comments.and_(
            Comment.author_id == user_id
        )).selectinload(Comment.author))
    
    # Load category only when needed
    if include_stats:
        options.extend([
            selectinload(Post.category),
            selectinload(Post.tags)
        ])
    
    stmt = select(Post).options(*options).limit(20)
    result = await self.session.execute(stmt)
    return result.scalars().all()

# Avoid common N+1 antipatterns:
# - Don't use lazy='select' in relationships  
# - Don't access relationship attributes in loops without preloading
# - Don't use joinedload with collections (causes duplicates)
# - Do use selectinload for most collections
# - Do batch related queries when selectinload isn't suitable
```

## 📊 Query Monitoring

```python
# Monitor query performance
import time
from sqlalchemy import event
from sqlalchemy.engine import Engine

@event.listens_for(Engine, "before_cursor_execute")
def receive_before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    context._query_start_time = time.time()

@event.listens_for(Engine, "after_cursor_execute") 
def receive_after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    total = time.time() - context._query_start_time
    if total > 0.1:  # Log slow queries (>100ms)
        print(f"Slow query: {total:.3f}s - {statement[:100]}...")

# Use EXPLAIN for query analysis:
# await session.execute(text("EXPLAIN ANALYZE SELECT ..."))
```