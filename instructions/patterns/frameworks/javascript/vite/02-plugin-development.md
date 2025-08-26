# Vite プラグイン開発パターン

## 🔧 カスタムプラグイン基本構造

```typescript
import type { Plugin, ResolvedConfig } from 'vite';

export interface CustomPluginOptions {
  pattern?: RegExp;
  transform?: boolean;
  include?: string[];
  exclude?: string[];
}

export function customPlugin(options: CustomPluginOptions = {}): Plugin {
  let config: ResolvedConfig;
  
  return {
    name: 'custom-plugin',
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    
    // ファイル解決フック
    resolveId(id, importer) {
      if (options.pattern?.test(id)) {
        return id; // カスタム解決ロジック
      }
    },
    
    // ファイル読み込みフック
    load(id) {
      if (options.pattern?.test(id)) {
        return `export default "custom-content";`;
      }
    },
    
    // コード変換フック
    transform(code, id) {
      if (shouldTransform(id, options)) {
        return {
          code: transformCode(code),
          map: null, // ソースマップ生成
        };
      }
    },
  };
}
```

## 🏗️ ビルドフック実装

```typescript
export function buildHooksPlugin(): Plugin {
  return {
    name: 'build-hooks',
    
    // ビルド開始
    buildStart(opts) {
      console.log('Build started with options:', opts);
    },
    
    // チャンク生成
    generateBundle(opts, bundle) {
      // バンドル内容の調整
      Object.keys(bundle).forEach(fileName => {
        const chunk = bundle[fileName];
        if (chunk.type === 'chunk') {
          // チャンクの最適化
          optimizeChunk(chunk);
        }
      });
    },
    
    // アセット処理
    writeBundle(opts, bundle) {
      // 追加アセットの生成
      generateAdditionalAssets(opts, bundle);
    },
  };
}
```

## 📝 ファイル変換プラグイン

```typescript
export function fileTransformPlugin(): Plugin {
  return {
    name: 'file-transform',
    
    transform(code, id) {
      // .special ファイルの変換
      if (id.endsWith('.special')) {
        return {
          code: `
            // 変換されたコード
            const transformed = ${JSON.stringify(parseSpecialFile(code))};
            export default transformed;
          `,
          map: null,
        };
      }
      
      // TypeScript装飾子の処理
      if (id.endsWith('.ts') && code.includes('@decorator')) {
        return {
          code: processDecorators(code),
          map: generateSourceMap(code, id),
        };
      }
    },
    
    // 仮想モジュール
    resolveId(id) {
      if (id === 'virtual:my-module') {
        return id;
      }
    },
    
    load(id) {
      if (id === 'virtual:my-module') {
        return 'export const msg = "hello from virtual module"';
      }
    },
  };
}
```

## 🔄 開発サーバープラグイン

```typescript
export function devServerPlugin(): Plugin {
  return {
    name: 'dev-server',
    
    configureServer(server) {
      // カスタムミドルウェア
      server.middlewares.use('/api/dev', (req, res, next) => {
        if (req.url?.startsWith('/api/dev')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Dev API response' }));
        } else {
          next();
        }
      });
      
      // ファイル監視
      server.watcher.add('custom-config.json');
      server.watcher.on('change', (file) => {
        if (file.endsWith('custom-config.json')) {
          server.ws.send({
            type: 'full-reload',
            path: '*',
          });
        }
      });
    },
    
    handleHotUpdate({ file, server }) {
      if (file.endsWith('.special')) {
        // カスタムHMR処理
        server.ws.send({
          type: 'update',
          updates: [{
            type: 'js-update',
            path: file,
            acceptedPath: file,
            timestamp: Date.now(),
          }],
        });
        return [];
      }
    },
  };
}
```

## 🎨 CSS処理プラグイン

```typescript
export function cssProcessorPlugin(): Plugin {
  return {
    name: 'css-processor',
    
    transform(code, id) {
      // CSS変数の動的生成
      if (id.endsWith('.css') && code.includes('@theme')) {
        return {
          code: processThemeVariables(code),
          map: null,
        };
      }
      
      // SCSS関数の拡張
      if (id.endsWith('.scss')) {
        return {
          code: extendScssFunction(code),
          map: null,
        };
      }
    },
  };
}

function processThemeVariables(css: string): string {
  return css.replace(/@theme\s+(\w+)/g, (match, theme) => {
    const variables = getThemeVariables(theme);
    return Object.entries(variables)
      .map(([key, value]) => `--${key}: ${value};`)
      .join('\n');
  });
}
```

## 🗜️ バンドル最適化プラグイン

```typescript
export function bundleOptimizerPlugin(): Plugin {
  return {
    name: 'bundle-optimizer',
    
    generateBundle(opts, bundle) {
      // 重複依存の除去
      removeDuplicateDependencies(bundle);
      
      // チャンクサイズの最適化
      optimizeChunkSizes(bundle);
      
      // 未使用コードの削除
      removeUnusedCode(bundle);
    },
    
    writeBundle() {
      // バンドルサイズレポート生成
      generateBundleReport();
    },
  };
}
```

## 💡 プラグイン開発のベストプラクティス

```typescript
// デバッグプラグイン
export function debugPlugin(): Plugin {
  return {
    name: 'debug',
    buildStart() {
      if (process.env.VITE_DEBUG) {
        console.log('🔍 Debug mode enabled');
      }
    },
    transform(code, id) {
      if (process.env.VITE_DEBUG) {
        console.log(`Transforming: ${id}`);
      }
    },
  };
}

// プラグインテスト例
// - build()関数でのプラグイン統合テスト
// - transform結果の検証
// - 仮想モジュールの動作確認
```