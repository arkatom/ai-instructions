# MCPサーバー Python高度な実装

非同期処理、バリデーション、高度なパターン。

## 型ヒントとバリデーション

```python
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, validator
from mcp.server import Server
from mcp.types import TextContent, Tool

class QueryParams(BaseModel):
    query: str
    limit: Optional[int] = 10
    
    @validator('query')
    def validate_query(cls, v):
        if len(v) < 1:
            raise ValueError('Query must not be empty')
        return v

server = Server("advanced-server")

@server.call_tool()
async def handle_tool(name: str, arguments: dict) -> TextContent:
    try:
        params = QueryParams(**arguments)
        result = await execute_query(params)
        return TextContent(
            type="text",
            text=json.dumps(result)
        )
    except ValidationError as e:
        return TextContent(
            type="text",
            text=f"Validation error: {e}",
            isError=True
        )
```

## 非同期ストリーミング

```python
import asyncio
from typing import AsyncGenerator

@server.read_resource()
async def stream_resource(uri: str) -> AsyncGenerator[TextContent, None]:
    """ストリーミングリソース"""
    async with aiohttp.ClientSession() as session:
        async with session.get(uri) as response:
            async for chunk in response.content.iter_chunked(1024):
                yield TextContent(
                    type="text",
                    text=chunk.decode('utf-8')
                )
                await asyncio.sleep(0.1)  # Rate limiting
```

## コンテキストマネージャー

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def database_connection():
    """データベース接続管理"""
    conn = await asyncpg.connect('postgresql://...')
    try:
        yield conn
    finally:
        await conn.close()

@server.call_tool()
async def query_database(name: str, arguments: dict):
    async with database_connection() as conn:
        result = await conn.fetch(arguments['query'])
        return TextContent(
            type="text",
            text=json.dumps([dict(r) for r in result])
        )
```

## エラーハンドリング

```python
class MCPError(Exception):
    def __init__(self, message: str, code: str, details: Any = None):
        super().__init__(message)
        self.code = code
        self.details = details

# デコレーターでエラーハンドリング
def handle_errors(func):
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except MCPError as e:
            logger.error(f"MCP Error: {e.code} - {e.message}")
            return TextContent(
                type="text",
                text=f"Error: {e.message}",
                isError=True
            )
        except Exception as e:
            logger.exception("Unexpected error")
            return TextContent(
                type="text",
                text="Internal server error",
                isError=True
            )
    return wrapper

@server.call_tool()
@handle_errors
async def safe_tool(name: str, arguments: dict):
    # ツール実装
    pass
```

→ 詳細: [テスト](./testing.md) | [統合](./integration.md)