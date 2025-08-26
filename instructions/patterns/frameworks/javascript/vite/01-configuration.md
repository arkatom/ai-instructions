# Vite 基本設定パターン

## ⚡ Advanced Vite Configuration

```typescript
// vite.config.ts
import { defineConfig, loadEnv, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';
import { createHtmlPlugin } from 'vite-plugin-html';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig(({ command, mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');
  const isDev = command === 'serve';
  const isProd = command === 'build';

  const config: UserConfig = {
    // Base configuration
    base: env.VITE_BASE_URL || '/',
    publicDir: 'public',
    
    // Environment variables
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __DEV__: isDev,
      __PROD__: isProd,
    },

    // Development server
    server: {
      host: '0.0.0.0',
      port: 3000,
      open: true,
      cors: true,
      strictPort: false,
      hmr: {
        overlay: true,
        clientPort: 3000,
      },
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:8080',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/ws': {
          target: env.VITE_WS_URL || 'ws://localhost:8080',
          ws: true,
        },
      },
    },

    // Path resolution
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@components': resolve(__dirname, 'src/components'),
        '@utils': resolve(__dirname, 'src/utils'),
        '@assets': resolve(__dirname, 'src/assets'),
        '@types': resolve(__dirname, 'src/types'),
        '@stores': resolve(__dirname, 'src/stores'),
        '@hooks': resolve(__dirname, 'src/hooks'),
        '@styles': resolve(__dirname, 'src/styles'),
      },
    },

    // CSS configuration
    css: {
      modules: {
        scopeBehaviour: 'local',
        generateScopedName: isDev 
          ? '[local]_[hash:base64:5]' 
          : '[hash:base64:8]',
        hashPrefix: 'app',
      },
      preprocessorOptions: {
        scss: {
          additionalData: `
            @import "@/styles/variables.scss";
            @import "@/styles/mixins.scss";
          `,
        },
        less: {
          additionalData: `@import "@/styles/variables.less";`,
        },
      },
    },

    // Build configuration
    build: {
      target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari13.1'],
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: env.VITE_SOURCEMAP === 'true',
      minify: 'esbuild',
      chunkSizeWarningLimit: 1000,
    },

    // Optimization
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'lodash-es',
        'date-fns',
        'zod',
      ],
      exclude: [
        '@vite/client',
        '@vite/env',
      ],
      esbuildOptions: {
        target: 'es2020',
      },
    },
  };

  return config;
});
```

## 🔧 環境別設定

```typescript
// Environment-specific configurations
export const developmentConfig = defineConfig({
  // Development-specific optimizations
  server: {
    hmr: {
      overlay: true,
    },
  },
  esbuild: {
    drop: [], // Keep console.log in development
  },
});

export const productionConfig = defineConfig({
  // Production-specific optimizations
  esbuild: {
    drop: ['console', 'debugger'], // Remove console.log in production
    legalComments: 'none',
  },
  build: {
    minify: 'esbuild',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
      },
    },
  },
});
```

## 📦 プラグイン基本設定

```typescript
// PWA Configuration
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/api\.example\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24, // 24 hours
          },
        },
      },
    ],
  },
  manifest: {
    name: 'Vite App',
    short_name: 'Vite',
    description: 'Vite application',
    theme_color: '#ffffff',
    background_color: '#ffffff',
    display: 'standalone',
    scope: '/',
    start_url: '/',
  },
})
```

## 💡 設定のベストプラクティス

```typescript
// 要実装: 設定最適化のポイント
// - 環境変数の管理
// - エイリアスの構造化
// - CSSモジュールの戦略
// - ビルドターゲットの選定
```