# Vite Build Optimization パターン

高速開発とプロダクション最適化のためのVite設定パターン集。最新のビルドツールチェーンを活用した効率的な開発ワークフローと最適化手法。

## ⚡ 基本設定パターン

### Advanced Vite Configuration

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
import { defineConfig as defineVitestConfig } from 'vitest/config';

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

    // Preview server (for production builds)
    preview: {
      host: '0.0.0.0',
      port: 4173,
      strictPort: true,
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
      postcss: {
        plugins: [
          require('autoprefixer'),
          require('cssnano')({
            preset: ['default', {
              discardComments: { removeAll: true },
              normalizeWhitespace: false,
            }],
          }),
        ],
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
      
      // Rollup options
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          // Multi-page application entries
          admin: resolve(__dirname, 'admin.html'),
        },
        
        output: {
          // Manual chunk splitting
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
            'vendor-utils': ['lodash-es', 'date-fns', 'zod'],
            'vendor-icons': ['lucide-react'],
          },
          
          // Asset naming
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId 
              ? chunkInfo.facadeModuleId.split('/').pop()
              : 'chunk';
            return `js/[name]-[hash].js`;
          },
          entryFileNames: 'js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name!.split('.');
            const ext = info[info.length - 1];
            
            if (/\.(png|jpe?g|gif|svg|webp|avif)$/i.test(assetInfo.name!)) {
              return `images/[name]-[hash][extname]`;
            }
            if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name!)) {
              return `fonts/[name]-[hash][extname]`;
            }
            if (/\.css$/i.test(assetInfo.name!)) {
              return `css/[name]-[hash][extname]`;
            }
            
            return `assets/[name]-[hash][extname]`;
          },
        },

        // External dependencies (for library builds)
        external: isDev ? [] : ['react', 'react-dom'],
        
        // Tree shaking
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
          unknownGlobalSideEffects: false,
        },
      },

      // Asset optimization
      assetsInlineLimit: 4096, // 4kb
      
      // CSS code splitting
      cssCodeSplit: true,
      
      // Generate manifest
      manifest: true,
      
      // Report compressed size
      reportCompressedSize: true,
      
      // Write bundle to disk (useful for analysis)
      write: true,
    },

    // Plugins
    plugins: [
      // React with SWC (faster than Babel)
      react({
        include: '**/*.{jsx,tsx}',
        plugins: [
          ['@swc/plugin-styled-components', {}],
        ],
      }),

      // Vue support
      vue({
        include: [/\.vue$/],
      }),

      // HTML processing
      createHtmlPlugin({
        inject: {
          data: {
            title: env.VITE_APP_TITLE || 'Vite App',
            description: env.VITE_APP_DESCRIPTION || 'Vite application',
          },
        },
        minify: isProd,
      }),

      // PWA configuration
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
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
              },
            },
          ],
        },
        manifest: {
          name: env.VITE_APP_TITLE || 'Vite App',
          short_name: env.VITE_APP_SHORT_NAME || 'Vite',
          description: env.VITE_APP_DESCRIPTION || 'Vite application',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: 'icons/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
      }),

      // Legacy browser support
      ...(isProd ? [
        legacy({
          targets: ['defaults', 'not IE 11'],
          additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
          renderLegacyChunks: true,
          polyfills: [
            'es.symbol',
            'es.array.filter',
            'es.promise',
            'es.promise.finally',
            'es/map',
            'es/set',
            'es.array.for-each',
            'es.object.define-properties',
            'es.object.define-property',
            'es.object.get-own-property-descriptor',
            'es.object.get-own-property-descriptors',
            'es.object.keys',
            'es.object.to-string',
            'web.dom-collections.for-each',
            'esnext.global-this',
            'esnext.string.match-all'
          ],
        }),
      ] : []),

      // Bundle analyzer (only in analysis mode)
      ...(env.ANALYZE === 'true' ? [
        visualizer({
          filename: 'dist/stats.html',
          open: true,
          gzipSize: true,
          brotliSize: true,
          template: 'treemap', // 'treemap', 'sunburst', 'network'
        }),
      ] : []),
    ],

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
        // Exclude problematic dependencies
        '@vite/client',
        '@vite/env',
      ],
      esbuildOptions: {
        target: 'es2020',
      },
    },

    // Worker configuration
    worker: {
      format: 'es',
      plugins: [],
      rollupOptions: {
        output: {
          chunkFileNames: 'worker/[name]-[hash].js',
          entryFileNames: 'worker/[name]-[hash].js',
        },
      },
    },

    // Experimental features
    experimental: {
      renderBuiltUrl(filename, { hostType }) {
        if (hostType === 'js') {
          return { js: `/${filename}` };
        } else {
          return { relative: true };
        }
      },
    },
  };

  // Test configuration (Vitest)
  if (command === 'test') {
    return defineVitestConfig({
      ...config,
      test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
        coverage: {
          provider: 'v8',
          reporter: ['text', 'json', 'html'],
          exclude: [
            'node_modules/',
            'src/test/',
            '**/*.d.ts',
            '**/*.config.*',
            '**/coverage/**',
          ],
        },
      },
    });
  }

  return config;
});

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

### Plugin Development

```typescript
// plugins/vite-plugin-env-validation.ts
import type { Plugin } from 'vite';
import { z } from 'zod';

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url(),
  VITE_APP_TITLE: z.string().min(1),
  VITE_APP_VERSION: z.string().optional(),
  VITE_ENABLE_ANALYTICS: z.enum(['true', 'false']).default('false'),
});

export function envValidationPlugin(): Plugin {
  return {
    name: 'env-validation',
    configResolved(config) {
      try {
        const env = Object.fromEntries(
          Object.entries(process.env).filter(([key]) => key.startsWith('VITE_'))
        );
        
        envSchema.parse(env);
        console.log('✅ Environment variables validated successfully');
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error('❌ Environment validation failed:');
          error.issues.forEach(issue => {
            console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
          });
          process.exit(1);
        }
        throw error;
      }
    },
  };
}

// plugins/vite-plugin-bundle-inspector.ts
import type { Plugin } from 'vite';
import fs from 'fs/promises';
import path from 'path';

interface BundleStats {
  totalSize: number;
  chunks: Array<{
    name: string;
    size: number;
    modules: string[];
  }>;
  assets: Array<{
    name: string;
    size: number;
    type: string;
  }>;
}

export function bundleInspectorPlugin(): Plugin {
  return {
    name: 'bundle-inspector',
    apply: 'build',
    generateBundle(options, bundle) {
      const stats: BundleStats = {
        totalSize: 0,
        chunks: [],
        assets: [],
      };

      Object.entries(bundle).forEach(([fileName, chunk]) => {
        if (chunk.type === 'chunk') {
          stats.chunks.push({
            name: fileName,
            size: chunk.code.length,
            modules: Object.keys(chunk.modules),
          });
          stats.totalSize += chunk.code.length;
        } else if (chunk.type === 'asset') {
          const size = typeof chunk.source === 'string' 
            ? chunk.source.length 
            : chunk.source.byteLength;
          
          stats.assets.push({
            name: fileName,
            size,
            type: path.extname(fileName).slice(1) || 'unknown',
          });
          stats.totalSize += size;
        }
      });

      // Write bundle report
      this.emitFile({
        type: 'asset',
        fileName: 'bundle-report.json',
        source: JSON.stringify(stats, null, 2),
      });

      // Console output
      console.log('\n📊 Bundle Analysis:');
      console.log(`Total bundle size: ${(stats.totalSize / 1024).toFixed(2)} KB`);
      console.log(`Chunks: ${stats.chunks.length}`);
      console.log(`Assets: ${stats.assets.length}`);
      
      // Warn about large chunks
      const largeChunks = stats.chunks.filter(chunk => chunk.size > 500 * 1024);
      if (largeChunks.length > 0) {
        console.warn('\n⚠️  Large chunks detected:');
        largeChunks.forEach(chunk => {
          console.warn(`  - ${chunk.name}: ${(chunk.size / 1024).toFixed(2)} KB`);
        });
      }
    },
  };
}

// plugins/vite-plugin-critical-css.ts
import type { Plugin } from 'vite';
import { generate } from 'critical';

export function criticalCssPlugin(options: {
  width: number;
  height: number;
  inline: boolean;
}): Plugin {
  return {
    name: 'critical-css',
    apply: 'build',
    writeBundle: {
      sequential: true,
      order: 'post',
      async handler(options, bundle) {
        const htmlFiles = Object.keys(bundle).filter(file => file.endsWith('.html'));
        
        for (const htmlFile of htmlFiles) {
          try {
            await generate({
              base: 'dist/',
              src: htmlFile,
              dest: htmlFile,
              width: options.width || 1300,
              height: options.height || 900,
              inline: options.inline !== false,
              minify: true,
              extract: false,
              ignore: {
                atrule: ['@font-face'],
                rule: [/some-regexp/],
                decl: (node, value) => /big-image\.png/.test(value),
              },
            });
            
            console.log(`✅ Critical CSS generated for ${htmlFile}`);
          } catch (error) {
            console.warn(`⚠️  Failed to generate critical CSS for ${htmlFile}:`, error);
          }
        }
      },
    },
  };
}
```

## 📦 Code Splitting Strategies

### Advanced Chunking Patterns

```typescript
// vite.config.chunks.ts
import type { GetManualChunk } from 'rollup';

export const createChunkStrategy = (): GetManualChunk => {
  return (id: string) => {
    // Vendor chunks
    if (id.includes('node_modules')) {
      // React ecosystem
      if (id.includes('react') || id.includes('react-dom')) {
        return 'vendor-react';
      }
      
      // Router
      if (id.includes('react-router')) {
        return 'vendor-router';
      }
      
      // UI libraries
      if (id.includes('@radix-ui') || id.includes('@headlessui') || id.includes('framer-motion')) {
        return 'vendor-ui';
      }
      
      // Utility libraries
      if (id.includes('lodash') || id.includes('date-fns') || id.includes('ramda')) {
        return 'vendor-utils';
      }
      
      // Form libraries
      if (id.includes('react-hook-form') || id.includes('formik') || id.includes('yup') || id.includes('zod')) {
        return 'vendor-forms';
      }
      
      // State management
      if (id.includes('zustand') || id.includes('redux') || id.includes('mobx')) {
        return 'vendor-state';
      }
      
      // Charts and visualization
      if (id.includes('chart') || id.includes('d3') || id.includes('recharts')) {
        return 'vendor-charts';
      }
      
      // Icons
      if (id.includes('lucide') || id.includes('heroicons') || id.includes('@tabler/icons')) {
        return 'vendor-icons';
      }
      
      // HTTP clients
      if (id.includes('axios') || id.includes('ky') || id.includes('fetch')) {
        return 'vendor-http';
      }
      
      // Other vendor dependencies
      return 'vendor-misc';
    }

    // Application chunks
    if (id.includes('/src/pages/')) {
      // Route-based chunking
      if (id.includes('/admin/')) {
        return 'pages-admin';
      }
      if (id.includes('/dashboard/')) {
        return 'pages-dashboard';
      }
      if (id.includes('/auth/')) {
        return 'pages-auth';
      }
      return 'pages-main';
    }

    // Component chunks
    if (id.includes('/src/components/')) {
      if (id.includes('/ui/')) {
        return 'components-ui';
      }
      if (id.includes('/charts/')) {
        return 'components-charts';
      }
      if (id.includes('/forms/')) {
        return 'components-forms';
      }
      return 'components-common';
    }

    // Utility chunks
    if (id.includes('/src/utils/') || id.includes('/src/lib/')) {
      return 'utils';
    }

    // Store chunks
    if (id.includes('/src/stores/') || id.includes('/src/state/')) {
      return 'stores';
    }

    // Worker chunks
    if (id.includes('.worker.')) {
      return 'workers';
    }
  };
};

// Dynamic import patterns
// src/utils/lazy-loading.ts
export const lazyLoadComponent = <T extends React.ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
) => {
  return React.lazy(async () => {
    try {
      const module = await importFunc();
      return module;
    } catch (error) {
      console.error('Component lazy loading failed:', error);
      
      // Fallback component
      if (fallback) {
        return { default: fallback };
      }
      
      // Generic error component
      return {
        default: () => React.createElement('div', {
          className: 'error-boundary',
          children: 'Component failed to load'
        })
      };
    }
  });
};

// Usage examples
export const AdminDashboard = lazyLoadComponent(
  () => import('@/pages/admin/Dashboard'),
  () => <div>Loading admin dashboard...</div>
);

export const UserProfile = lazyLoadComponent(
  () => import('@/pages/user/Profile')
);

// Route-based code splitting
// src/router/routes.tsx
import { createBrowserRouter } from 'react-router-dom';
import { Suspense } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';

// Lazy loaded pages
const HomePage = lazyLoadComponent(() => import('@/pages/Home'));
const AboutPage = lazyLoadComponent(() => import('@/pages/About'));
const ContactPage = lazyLoadComponent(() => import('@/pages/Contact'));

// Admin pages (separate chunk)
const AdminLayout = lazyLoadComponent(() => import('@/layouts/AdminLayout'));
const AdminDashboard = lazyLoadComponent(() => import('@/pages/admin/Dashboard'));
const AdminUsers = lazyLoadComponent(() => import('@/pages/admin/Users'));
const AdminSettings = lazyLoadComponent(() => import('@/pages/admin/Settings'));

// User pages
const UserLayout = lazyLoadComponent(() => import('@/layouts/UserLayout'));
const UserDashboard = lazyLoadComponent(() => import('@/pages/user/Dashboard'));
const UserProfile = lazyLoadComponent(() => import('@/pages/user/Profile'));

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingSpinner />}>
      {children}
    </Suspense>
  </ErrorBoundary>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <SuspenseWrapper><HomePage /></SuspenseWrapper>,
  },
  {
    path: '/about',
    element: <SuspenseWrapper><AboutPage /></SuspenseWrapper>,
  },
  {
    path: '/contact',
    element: <SuspenseWrapper><ContactPage /></SuspenseWrapper>,
  },
  {
    path: '/admin',
    element: <SuspenseWrapper><AdminLayout /></SuspenseWrapper>,
    children: [
      {
        index: true,
        element: <SuspenseWrapper><AdminDashboard /></SuspenseWrapper>,
      },
      {
        path: 'users',
        element: <SuspenseWrapper><AdminUsers /></SuspenseWrapper>,
      },
      {
        path: 'settings',
        element: <SuspenseWrapper><AdminSettings /></SuspenseWrapper>,
      },
    ],
  },
  {
    path: '/user',
    element: <SuspenseWrapper><UserLayout /></SuspenseWrapper>,
    children: [
      {
        index: true,
        element: <SuspenseWrapper><UserDashboard /></SuspenseWrapper>,
      },
      {
        path: 'profile',
        element: <SuspenseWrapper><UserProfile /></SuspenseWrapper>,
      },
    ],
  },
]);
```

## 🔧 Performance Optimization

### Asset and Runtime Optimization

```typescript
// src/utils/performance.ts
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    
    return fn().finally(() => {
      const duration = performance.now() - start;
      this.metrics.set(name, duration);
      
      if (duration > 1000) {
        console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
      }
    });
  }

  measure<T>(name: string, fn: () => T): T {
    const start = performance.now();
    
    try {
      return fn();
    } finally {
      const duration = performance.now() - start;
      this.metrics.set(name, duration);
    }
  }

  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  trackWebVitals(): void {
    // Largest Contentful Paint
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.metrics.set('LCP', lastEntry.startTime);
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        this.metrics.set('FID', entry.processingStart - entry.startTime);
      });
    }).observe({ entryTypes: ['first-input'] });

    // Cumulative Layout Shift
    let clsValue = 0;
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          this.metrics.set('CLS', clsValue);
        }
      });
    }).observe({ entryTypes: ['layout-shift'] });
  }
}

// Image optimization utilities
export class ImageOptimizer {
  static createImageLoader(
    src: string,
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: 'webp' | 'avif' | 'jpg' | 'png';
    } = {}
  ): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => resolve(img);
      img.onerror = reject;
      
      // Progressive enhancement with modern formats
      if (options.format && this.supportsFormat(options.format)) {
        img.src = this.buildOptimizedUrl(src, options);
      } else {
        img.src = src;
      }
    });
  }

  static supportsFormat(format: string): boolean {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    
    return canvas.toDataURL(`image/${format}`).startsWith(`data:image/${format}`);
  }

  static buildOptimizedUrl(
    src: string,
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: string;
    }
  ): string {
    const url = new URL(src, window.location.origin);
    
    if (options.width) url.searchParams.set('w', options.width.toString());
    if (options.height) url.searchParams.set('h', options.height.toString());
    if (options.quality) url.searchParams.set('q', options.quality.toString());
    if (options.format) url.searchParams.set('f', options.format);
    
    return url.toString();
  }

  static preloadCriticalImages(images: string[]): void {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    
    images.forEach(src => {
      const preloadLink = link.cloneNode() as HTMLLinkElement;
      preloadLink.href = src;
      document.head.appendChild(preloadLink);
    });
  }
}

// Resource optimization
export class ResourceOptimizer {
  static prefetchRoute(route: string): void {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = route;
    document.head.appendChild(link);
  }

  static preloadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'script';
      link.href = src;
      link.onload = () => resolve();
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

  static async loadScript(src: string): Promise<void> {
    // Check if script is already loaded
    if (document.querySelector(`script[src="${src}"]`)) {
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  static optimizeScrolling(): void {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          // Scroll handling logic
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  static enableImageLazyLoading(): void {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;
            
            if (src) {
              img.src = src;
              img.classList.remove('lazy');
              imageObserver.unobserve(img);
            }
          }
        });
      });

      document.querySelectorAll('img[data-src]').forEach((img) => {
        imageObserver.observe(img);
      });
    }
  }
}

// Memory management
export class MemoryManager {
  private static cleanupTasks: Array<() => void> = [];

  static addCleanupTask(task: () => void): void {
    this.cleanupTasks.push(task);
  }

  static cleanup(): void {
    this.cleanupTasks.forEach(task => {
      try {
        task();
      } catch (error) {
        console.error('Cleanup task failed:', error);
      }
    });
    this.cleanupTasks = [];
  }

  static monitorMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      
      console.log('Memory usage:', {
        used: `${(memory.usedJSHeapSize / 1048576).toFixed(2)} MB`,
        total: `${(memory.totalJSHeapSize / 1048576).toFixed(2)} MB`,
        limit: `${(memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`,
      });

      // Warn if memory usage is high
      const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
      if (usagePercent > 80) {
        console.warn(`High memory usage detected: ${usagePercent.toFixed(2)}%`);
      }
    }
  }

  static detectMemoryLeaks(): void {
    let baseline = 0;
    
    const checkMemoryGrowth = () => {
      if ('memory' in performance) {
        const current = (performance as any).memory.usedJSHeapSize;
        
        if (baseline === 0) {
          baseline = current;
        } else if (current > baseline * 1.5) {
          console.warn('Potential memory leak detected');
          console.log(`Memory grew from ${baseline} to ${current} bytes`);
        }
      }
    };

    // Check every 30 seconds
    setInterval(checkMemoryGrowth, 30000);
  }
}
```

## 🧪 Testing and Quality Assurance

### Comprehensive Testing Setup

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      'build',
      'e2e',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        '**/*.stories.*',
        '**/*.test.*',
        '**/*.spec.*',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,
      },
    },
    watch: {
      exclude: ['node_modules', 'dist', 'coverage'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@test': resolve(__dirname, 'src/test'),
    },
  },
});

// src/test/setup.ts
import '@testing-library/jest-dom';
import { beforeAll, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
beforeAll(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000');
  vi.stubEnv('VITE_APP_TITLE', 'Test App');
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Performance testing utilities
// src/test/performance.test.ts
import { describe, it, expect } from 'vitest';
import { performance } from 'perf_hooks';

describe('Performance Tests', () => {
  it('should load components quickly', async () => {
    const start = performance.now();
    
    // Dynamically import component
    const { default: Component } = await import('@/components/App');
    
    const loadTime = performance.now() - start;
    
    expect(loadTime).toBeLessThan(100); // Should load in less than 100ms
    expect(Component).toBeDefined();
  });

  it('should have efficient bundle size', async () => {
    // This would be run against the actual build
    const bundleStats = await import('../dist/bundle-report.json');
    
    expect(bundleStats.totalSize).toBeLessThan(1024 * 1024); // 1MB limit
    
    // Check for unexpectedly large chunks
    const largeChunks = bundleStats.chunks.filter(chunk => chunk.size > 500 * 1024);
    expect(largeChunks).toHaveLength(0);
  });

  it('should tree-shake unused code', async () => {
    // Import a module that exports multiple functions
    const utils = await import('@/utils/index');
    
    // Verify only used functions are included
    expect(Object.keys(utils)).toContain('debounce');
    
    // In a real test, you'd check the bundle to ensure
    // unused exports are not included
  });
});

// Bundle analysis script
// scripts/analyze-bundle.mjs
import { promises as fs } from 'fs';
import path from 'path';

async function analyzeBundleSize() {
  try {
    const statsPath = path.resolve('dist/bundle-report.json');
    const stats = JSON.parse(await fs.readFile(statsPath, 'utf-8'));
    
    console.log('📊 Bundle Analysis Results:\n');
    
    // Total size
    const totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);
    console.log(`Total bundle size: ${totalSizeMB} MB`);
    
    // Largest chunks
    const sortedChunks = stats.chunks
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);
    
    console.log('\n🔍 Largest chunks:');
    sortedChunks.forEach((chunk, index) => {
      const sizeMB = (chunk.size / (1024 * 1024)).toFixed(2);
      console.log(`${index + 1}. ${chunk.name}: ${sizeMB} MB`);
    });
    
    // Asset breakdown
    const assetsByType = stats.assets.reduce((acc, asset) => {
      acc[asset.type] = (acc[asset.type] || 0) + asset.size;
      return acc;
    }, {});
    
    console.log('\n📁 Assets by type:');
    Object.entries(assetsByType).forEach(([type, size]) => {
      const sizeMB = (size / (1024 * 1024)).toFixed(2);
      console.log(`${type}: ${sizeMB} MB`);
    });
    
    // Performance recommendations
    console.log('\n💡 Recommendations:');
    
    if (stats.totalSize > 2 * 1024 * 1024) {
      console.log('- Consider code splitting to reduce initial bundle size');
    }
    
    const largeChunks = stats.chunks.filter(chunk => chunk.size > 500 * 1024);
    if (largeChunks.length > 0) {
      console.log('- Some chunks are quite large, consider further splitting');
    }
    
    const jsSize = assetsByType.js || 0;
    const cssSize = assetsByType.css || 0;
    
    if (jsSize > cssSize * 5) {
      console.log('- CSS is significantly smaller than JS, which is good');
    }
    
  } catch (error) {
    console.error('Failed to analyze bundle:', error);
    process.exit(1);
  }
}

analyzeBundleSize();
```

## 🚀 Deployment and CI/CD

### Production Deployment Pipeline

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'
  PNPM_VERSION: '8'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Get pnpm store directory
        shell: bash
        run: echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

      - name: Setup pnpm cache
        uses: actions/cache@v3
        with:
          path: ${{ env.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run type check
        run: pnpm type-check

      - name: Run tests
        run: pnpm test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info

  build:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build application
        run: pnpm build
        env:
          VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}
          VITE_APP_TITLE: ${{ secrets.VITE_APP_TITLE }}

      - name: Analyze bundle
        run: pnpm analyze

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/

  deploy:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: dist
          path: dist/

      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v2.1
        with:
          publish-dir: './dist'
          production-branch: main
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deploy-message: 'Deploy from GitHub Actions'
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}

# package.json scripts
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "build:analyze": "ANALYZE=true vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "type-check": "tsc --noEmit",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint . --ext ts,tsx --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "analyze": "node scripts/analyze-bundle.mjs",
    "clean": "rm -rf dist coverage .vite",
    "prepare": "husky install"
  }
}
```

このVite Build Optimizationパターン集は、最新のViteビルドシステムを最大限活用した高度な最適化手法を提供します。開発効率とプロダクション性能の両方を向上させる包括的なソリューションを実装しています。