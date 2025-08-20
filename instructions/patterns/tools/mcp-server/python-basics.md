# MCPサーバー Python基本実装

MCPサーバーをPythonで実装する最小構成。

## セットアップ

```bash
pip install mcp
# または高速版
pip install fastmcp
```

## 基本実装（公式SDK）

```python
# server.py
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Resource, Tool, TextContent
import asyncio

server = Server("my-python-server")

@server.list_resources()
async def list_resources():
    return [
        Resource(
            uri="data://example",
            name="Example Resource",
            mime_type="application/json"
        )
    ]

@server.read_resource()
async def read_resource(uri: str):
    return TextContent(
        type="text",
        text='{"data": "example"}'
    )

@server.list_tools()
async def list_tools():
    return [
        Tool(
            name="hello",
            description="Say hello",
            input_schema={
                "type": "object",
                "properties": {
                    "name": {"type": "string"}
                }
            }
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "hello":
        return TextContent(
            type="text",
            text=f"Hello, {arguments.get('name', 'World')}!"
        )
    raise ValueError(f"Unknown tool: {name}")

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream)

if __name__ == "__main__":
    asyncio.run(main())
```

## FastMCP版（簡潔）

```python
# fastmcp_server.py
from fastmcp import FastMCP

mcp = FastMCP("my-server")

@mcp.resource("data://example")
async def get_example():
    """Example resource"""
    return {"data": "example"}

@mcp.tool()
async def hello(name: str = "World") -> str:
    """Say hello"""
    return f"Hello, {name}!"

if __name__ == "__main__":
    mcp.run()
```

## Claude Desktop設定

```json
{ "mcpServers": { "my-python-server": { "command": "python", "args": ["/path/to/server.py"] } } }
```

→ 詳細: [Python高度な実装](./python-advanced.md)