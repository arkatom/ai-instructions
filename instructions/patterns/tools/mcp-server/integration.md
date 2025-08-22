# MCPサーバー 統合

Claude Desktop、Cursor、その他クライアントとの統合。

## Claude Desktop設定

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json (Mac)
// %APPDATA%\Claude\claude_desktop_config.json (Windows)
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": {
        "API_KEY": "your-key",
        "NODE_ENV": "production"
      }
    },
    "python-server": {
      "command": "python",
      "args": ["/path/to/server.py"]
    },
    "npx-server": {
      "command": "npx",
      "args": ["@your-org/mcp-server"]
    }
  }
}
```

## NPMパッケージ配布

```json
// package.json
{
  "name": "@your-org/mcp-server",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "mcp-server": "./dist/index.js"
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc",
    "prepare": "npm run build"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

```bash
# 公開
npm publish

# ユーザー側でインストール
npx @your-org/mcp-server
```

## Cursor統合

```json
// .cursorrules
{
  "mcp": {
    "servers": {
      "custom-server": {
        "enabled": true,
        "command": "node",
        "args": ["./mcp-server/dist/index.js"]
      }
    }
  }
}
```

## Docker化

```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml
services:
  mcp-server:
    build: .
    environment:
      - NODE_ENV=production
      - API_KEY=${API_KEY}
    ports:
      - "8080:8080"
```

## VS Code拡張機能

```typescript
// extension.ts
import * as vscode from 'vscode';
import { MCPClient } from '@modelcontextprotocol/sdk/client';

export function activate(context: vscode.ExtensionContext) {
  const client = new MCPClient();
  
  vscode.commands.registerCommand('mcp.connect', async () => {
    await client.connect('stdio', {
      command: 'node',
      args: ['mcp-server']
    });
  });
}
```

→ 詳細: [ベストプラクティス](./best-practices.md)