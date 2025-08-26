# FastAPI 非同期処理とバックグラウンドタスク

Celery統合、WebSocket、ストリーミング、非同期処理パターンの包括的な実装ガイド。

## 🔄 バックグラウンドタスク

### FastAPI BackgroundTasks

```python
# app/core/background_tasks.py
from fastapi import BackgroundTasks
from typing import Any, Dict, List
import asyncio
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class TaskManager:
    """バックグラウンドタスクマネージャー"""
    
    def __init__(self):
        self.running_tasks: Dict[str, asyncio.Task] = {}
    
    async def add_task(
        self, 
        task_id: str, 
        coro, 
        *args, 
        **kwargs
    ) -> str:
        """非同期タスク追加"""
        if task_id in self.running_tasks:
            if not self.running_tasks[task_id].done():
                return f"Task {task_id} is already running"
        
        task = asyncio.create_task(coro(*args, **kwargs))
        self.running_tasks[task_id] = task
        
        # タスク完了時のクリーンアップ
        task.add_done_callback(lambda t: self._cleanup_task(task_id, t))
        
        return task_id
    
    def _cleanup_task(self, task_id: str, task: asyncio.Task):
        """タスクのクリーンアップ"""
        try:
            if task.exception():
                logger.error(f"Task {task_id} failed: {task.exception()}")
            else:
                logger.info(f"Task {task_id} completed successfully")
        finally:
            self.running_tasks.pop(task_id, None)
    
    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """タスクステータス取得"""
        if task_id not in self.running_tasks:
            return {"status": "not_found"}
        
        task = self.running_tasks[task_id]
        
        if task.done():
            if task.exception():
                return {
                    "status": "failed",
                    "error": str(task.exception())
                }
            else:
                return {
                    "status": "completed",
                    "result": task.result() if hasattr(task, 'result') else None
                }
        else:
            return {"status": "running"}
    
    async def cancel_task(self, task_id: str) -> bool:
        """タスクキャンセル"""
        if task_id in self.running_tasks:
            self.running_tasks[task_id].cancel()
            return True
        return False


task_manager = TaskManager()


# 共通バックグラウンドタスク
async def send_email_task(
    to_email: str,
    subject: str,
    body: str,
    template: str = None
):
    """メール送信タスク"""
    try:
        # メール送信処理
        await asyncio.sleep(2)  # シミュレーション
        logger.info(f"Email sent to {to_email}: {subject}")
        return {"status": "sent", "to": to_email}
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        raise


async def generate_report_task(
    user_id: int,
    report_type: str,
    parameters: Dict[str, Any]
) -> Dict[str, Any]:
    """レポート生成タスク"""
    try:
        # レポート生成処理（時間のかかる処理をシミュレート）
        await asyncio.sleep(10)
        
        report_data = {
            "user_id": user_id,
            "type": report_type,
            "generated_at": datetime.now().isoformat(),
            "data": parameters
        }
        
        logger.info(f"Report generated for user {user_id}")
        return report_data
        
    except Exception as e:
        logger.error(f"Failed to generate report for user {user_id}: {e}")
        raise


async def cleanup_expired_sessions_task():
    """期限切れセッションのクリーンアップ"""
    try:
        # データベースから期限切れセッションを削除
        # 実際の実装では適切なクエリを使用
        await asyncio.sleep(1)
        logger.info("Expired sessions cleaned up")
        return {"cleaned": True}
        
    except Exception as e:
        logger.error(f"Failed to cleanup sessions: {e}")
        raise
```

## 🚀 Celery統合

### Celeryワーカー設定

```python
# app/core/celery.py
from celery import Celery
from kombu import Queue
import os

from app.core.config import settings


# Celeryアプリケーション作成
celery_app = Celery(
    "fastapi_app",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.email_tasks",
        "app.tasks.report_tasks",
        "app.tasks.cleanup_tasks"
    ]
)

# Celery設定
celery_app.conf.update(
    # タスク設定
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    
    # ワーカー設定
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    
    # ルーティング設定
    task_routes={
        "app.tasks.email_tasks.*": {"queue": "email"},
        "app.tasks.report_tasks.*": {"queue": "reports"},
        "app.tasks.cleanup_tasks.*": {"queue": "cleanup"}
    },
    
    # キュー設定
    task_default_queue="default",
    task_queues=(
        Queue("default"),
        Queue("email", routing_key="email"),
        Queue("reports", routing_key="reports"),
        Queue("cleanup", routing_key="cleanup"),
    ),
    
    # 結果設定
    result_expires=3600,
    result_backend_max_retries=10,
    
    # 再試行設定
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)


# app/tasks/email_tasks.py
from celery import Task
from typing import Dict, Any, List
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

from app.core.celery import celery_app
from app.core.config import settings

logger = logging.getLogger(__name__)


class CallbackTask(Task):
    """コールバック付きタスク基底クラス"""
    
    def on_success(self, retval, task_id, args, kwargs):
        """タスク成功時の処理"""
        logger.info(f"Task {task_id} succeeded: {retval}")
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """タスク失敗時の処理"""
        logger.error(f"Task {task_id} failed: {exc}")


@celery_app.task(bind=True, base=CallbackTask, max_retries=3)
def send_email_celery(
    self,
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str = None
):
    """Celeryメール送信タスク"""
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = settings.EMAIL_FROM
        msg['To'] = to_email
        
        # テキスト版
        if text_content:
            text_part = MIMEText(text_content, 'plain', 'utf-8')
            msg.attach(text_part)
        
        # HTML版
        html_part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(html_part)
        
        # SMTP送信
        with smtplib.SMTP(settings.EMAIL_SMTP_HOST, settings.EMAIL_SMTP_PORT) as server:
            if settings.EMAIL_SMTP_TLS:
                server.starttls()
            if settings.EMAIL_SMTP_USER:
                server.login(settings.EMAIL_SMTP_USER, settings.EMAIL_SMTP_PASSWORD)
            
            server.send_message(msg)
        
        return {"status": "sent", "to": to_email}
        
    except Exception as exc:
        logger.error(f"Email sending failed: {exc}")
        # 指数バックオフで再試行
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@celery_app.task
def send_bulk_email(
    email_list: List[str],
    subject: str,
    html_content: str,
    text_content: str = None
):
    """一括メール送信"""
    results = []
    
    for email in email_list:
        result = send_email_celery.delay(
            to_email=email,
            subject=subject,
            html_content=html_content,
            text_content=text_content
        )
        results.append({
            "email": email,
            "task_id": result.id
        })
    
    return {"total": len(email_list), "tasks": results}


# app/tasks/report_tasks.py
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
import io
import base64

from app.core.celery import celery_app
from app.core.database import database_manager


@celery_app.task(bind=True)
def generate_user_activity_report(self, user_id: int, days: int = 30):
    """ユーザーアクティビティレポート生成"""
    try:
        # 非同期処理を同期的に実行（Celeryワーカー内）
        import asyncio
        
        async def _generate_report():
            async with database_manager.get_session() as session:
                # データ取得クエリ
                end_date = datetime.now()
                start_date = end_date - timedelta(days=days)
                
                # 実際の実装では適切なクエリを使用
                data = {
                    "user_id": user_id,
                    "period": f"{start_date.date()} to {end_date.date()}",
                    "login_count": 15,
                    "posts_created": 5,
                    "comments_made": 12
                }
                
                # PDF生成（シミュレーション）
                report_content = f"User Activity Report\nUser ID: {user_id}\n"
                report_content += f"Period: {data['period']}\n"
                report_content += f"Logins: {data['login_count']}\n"
                report_content += f"Posts: {data['posts_created']}\n"
                report_content += f"Comments: {data['comments_made']}"
                
                return {
                    "report_id": f"report_{user_id}_{int(datetime.now().timestamp())}",
                    "content": base64.b64encode(report_content.encode()).decode(),
                    "format": "text",
                    "generated_at": datetime.now().isoformat()
                }
        
        # 非同期関数を実行
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(_generate_report())
        loop.close()
        
        return result
        
    except Exception as exc:
        logger.error(f"Report generation failed: {exc}")
        raise


# FastAPI側での使用例
# app/api/v1/endpoints/tasks.py
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from celery.result import AsyncResult
from typing import List

from app.tasks.email_tasks import send_email_celery, send_bulk_email
from app.tasks.report_tasks import generate_user_activity_report
from app.core.background_tasks import task_manager

router = APIRouter()


@router.post("/send-email/")
async def send_email_endpoint(
    to_email: str,
    subject: str,
    content: str,
    background_tasks: BackgroundTasks
):
    """非同期メール送信"""
    # バックグラウンドタスクとして実行
    background_tasks.add_task(
        send_email_task,
        to_email=to_email,
        subject=subject,
        body=content
    )
    
    return {"message": "Email task queued"}


@router.post("/send-email-celery/")
async def send_email_celery_endpoint(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str = None
):
    """Celeryメール送信"""
    task = send_email_celery.delay(
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        text_content=text_content
    )
    
    return {"task_id": task.id, "status": "queued"}


@router.get("/task-status/{task_id}")
async def get_task_status(task_id: str):
    """Celeryタスクステータス確認"""
    result = AsyncResult(task_id, app=celery_app)
    
    return {
        "task_id": task_id,
        "status": result.status,
        "result": result.result if result.ready() else None
    }


@router.post("/generate-report/")
async def generate_report_endpoint(
    user_id: int,
    days: int = 30
):
    """レポート生成"""
    task = generate_user_activity_report.delay(
        user_id=user_id,
        days=days
    )
    
    return {"task_id": task.id, "message": "Report generation started"}
```

## 🔌 WebSocket接続

### リアルタイム通信実装

```python
# app/api/v1/websockets.py
from fastapi import WebSocket, WebSocketDisconnect, Depends, HTTPException
from typing import List, Dict, Any
import json
import asyncio
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class ConnectionManager:
    """WebSocket接続マネージャー"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.user_connections: Dict[int, WebSocket] = {}
        self.room_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: int = None, room: str = None):
        """接続受け入れ"""
        await websocket.accept()
        self.active_connections.append(websocket)
        
        if user_id:
            self.user_connections[user_id] = websocket
        
        if room:
            if room not in self.room_connections:
                self.room_connections[room] = []
            self.room_connections[room].append(websocket)
        
        logger.info(f"WebSocket connected. User: {user_id}, Room: {room}")
    
    def disconnect(self, websocket: WebSocket, user_id: int = None, room: str = None):
        """接続切断"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        
        if user_id and user_id in self.user_connections:
            del self.user_connections[user_id]
        
        if room and room in self.room_connections:
            if websocket in self.room_connections[room]:
                self.room_connections[room].remove(websocket)
                if not self.room_connections[room]:
                    del self.room_connections[room]
        
        logger.info(f"WebSocket disconnected. User: {user_id}, Room: {room}")
    
    async def send_personal_message(self, message: Dict[str, Any], user_id: int):
        """個人宛メッセージ送信"""
        if user_id in self.user_connections:
            websocket = self.user_connections[user_id]
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Failed to send message to user {user_id}: {e}")
                self.disconnect(websocket, user_id=user_id)
    
    async def send_room_message(self, message: Dict[str, Any], room: str):
        """ルーム内ブロードキャスト"""
        if room in self.room_connections:
            disconnected = []
            
            for websocket in self.room_connections[room]:
                try:
                    await websocket.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Failed to send message to room {room}: {e}")
                    disconnected.append(websocket)
            
            # 切断された接続をクリーンアップ
            for websocket in disconnected:
                self.disconnect(websocket, room=room)
    
    async def broadcast_message(self, message: Dict[str, Any]):
        """全体ブロードキャスト"""
        disconnected = []
        
        for websocket in self.active_connections:
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Failed to broadcast message: {e}")
                disconnected.append(websocket)
        
        # 切断された接続をクリーンアップ
        for websocket in disconnected:
            self.disconnect(websocket)


# グローバル接続マネージャー
manager = ConnectionManager()


# WebSocketエンドポイント
from fastapi import APIRouter, WebSocket
from app.core.security import get_current_user_websocket

ws_router = APIRouter()


@ws_router.websocket("/ws/notifications/{user_id}")
async def websocket_notifications(
    websocket: WebSocket,
    user_id: int
):
    """個人通知用WebSocket"""
    await manager.connect(websocket, user_id=user_id)
    
    try:
        while True:
            # クライアントからのメッセージ受信
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # ハートビート処理
            if message_data.get("type") == "ping":
                await websocket.send_text(json.dumps({
                    "type": "pong",
                    "timestamp": datetime.now().isoformat()
                }))
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id=user_id)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        manager.disconnect(websocket, user_id=user_id)


@ws_router.websocket("/ws/chat/{room_name}")
async def websocket_chat(
    websocket: WebSocket,
    room_name: str
):
    """チャットルーム用WebSocket"""
    await manager.connect(websocket, room=room_name)
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # チャットメッセージの処理
            if message_data.get("type") == "chat":
                chat_message = {
                    "type": "chat",
                    "user": message_data.get("user", "Anonymous"),
                    "message": message_data.get("message", ""),
                    "timestamp": datetime.now().isoformat(),
                    "room": room_name
                }
                
                # ルーム内にブロードキャスト
                await manager.send_room_message(chat_message, room_name)
    
    except WebSocketDisconnect:
        # 離脱通知
        leave_message = {
            "type": "user_left",
            "message": f"User left the room",
            "timestamp": datetime.now().isoformat(),
            "room": room_name
        }
        await manager.send_room_message(leave_message, room_name)
        manager.disconnect(websocket, room=room_name)


# 通知送信サービス
class NotificationService:
    """通知送信サービス"""
    
    @staticmethod
    async def send_user_notification(
        user_id: int,
        notification_type: str,
        title: str,
        message: str,
        data: Dict[str, Any] = None
    ):
        """ユーザー通知送信"""
        notification = {
            "type": "notification",
            "notification_type": notification_type,
            "title": title,
            "message": message,
            "data": data or {},
            "timestamp": datetime.now().isoformat()
        }
        
        await manager.send_personal_message(notification, user_id)
    
    @staticmethod
    async def broadcast_system_notification(
        title: str,
        message: str,
        data: Dict[str, Any] = None
    ):
        """システム通知ブロードキャスト"""
        notification = {
            "type": "system_notification",
            "title": title,
            "message": message,
            "data": data or {},
            "timestamp": datetime.now().isoformat()
        }
        
        await manager.broadcast_message(notification)


notification_service = NotificationService()
```

## 📊 ストリーミングレスポンス

### 大容量データの効率的な配信

```python
# app/api/v1/endpoints/streaming.py
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import asyncio
import json
import csv
from io import StringIO
from typing import AsyncGenerator, Dict, Any

router = APIRouter()


async def generate_csv_data() -> AsyncGenerator[str, None]:
    """CSV データストリーミング生成"""
    # ヘッダー
    yield "id,name,email,created_at\n"
    
    # データを順次生成（大量データをシミュレート）
    for i in range(10000):
        await asyncio.sleep(0.001)  # 少し待機
        yield f"{i},User{i},user{i}@example.com,2024-01-01\n"


@router.get("/export/users-csv")
async def export_users_csv():
    """ユーザーデータのCSVストリーミングエクスポート"""
    
    return StreamingResponse(
        generate_csv_data(),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=users_export.csv"
        }
    )


async def generate_json_stream() -> AsyncGenerator[str, None]:
    """JSON ストリーミング"""
    yield '{"users": ['
    
    for i in range(1000):
        if i > 0:
            yield ","
        
        user_data = {
            "id": i,
            "username": f"user{i}",
            "email": f"user{i}@example.com"
        }
        
        yield json.dumps(user_data)
        await asyncio.sleep(0.01)
    
    yield "]}"


@router.get("/stream/users")
async def stream_users():
    """ユーザーデータのJSONストリーミング"""
    return StreamingResponse(
        generate_json_stream(),
        media_type="application/json"
    )


async def generate_server_sent_events() -> AsyncGenerator[str, None]:
    """Server-Sent Events生成"""
    for i in range(100):
        data = {
            "id": i,
            "message": f"Event {i}",
            "timestamp": datetime.now().isoformat()
        }
        
        # SSE形式で出力
        yield f"data: {json.dumps(data)}\n\n"
        await asyncio.sleep(1)  # 1秒間隔


@router.get("/events/stream")
async def stream_events():
    """Server-Sent Eventsエンドポイント"""
    return StreamingResponse(
        generate_server_sent_events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
```