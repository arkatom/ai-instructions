# CSS Performance 最適化ガイド 2025

## Critical CSS とレンダリング最適化

### 1. Critical CSS の抽出と実装

```javascript
// critical-css-extractor.js
const critical = require('critical');
const fs = require('fs').promises;
const path = require('path');

class CriticalCSSExtractor {
  constructor(options = {}) {
    this.options = {
      inline: true,
      minify: true,
      extract: true,
      width: 1300,
      height: 900,
      penthouse: {
        blockJSRequests: false,
        renderWaitTime: 100,
        timeout: 30000,
      },
      ...options
    };
  }
  
  async extractCriticalCSS(htmlPath, outputPath) {
    try {
      const result = await critical.generate({
        ...this.options,
        src: htmlPath,
        target: {
          html: outputPath,
          css: path.join(path.dirname(outputPath), 'critical.css'),
        },
      });
      
      // インライン化とプリロード設定
      const optimizedHTML = await this.optimizeHTML(result.html, result.css);
      await fs.writeFile(outputPath, optimizedHTML);
      
      return {
        criticalCSS: result.css,
        uncriticalCSS: result.uncritical,
        originalSize: result.original.length,
        criticalSize: result.css.length,
        savings: ((1 - result.css.length / result.original.length) * 100).toFixed(2),
      };
    } catch (error) {
      console.error('Critical CSS extraction failed:', error);
      throw error;
    }
  }
  
  async optimizeHTML(html, criticalCSS) {
    // Critical CSS のインライン化
    const criticalInline = `
      <style id="critical-css">
        ${criticalCSS}
      </style>
    `;
    
    // 非Critical CSS の遅延読み込み
    const lazyLoadCSS = `
      <link rel="preload" href="/css/main.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
      <noscript><link rel="stylesheet" href="/css/main.css"></noscript>
      <script>
        // CSS読み込みポリフィル
        !function(w){"use strict";w.loadCSS||(w.loadCSS=function(){});var rp=loadCSS.relpreload={};if(rp.support=function(){var ret;try{ret=w.document.createElement("link").relList.supports("preload")}catch(e){ret=!1}return function(){return ret}}(),rp.bindMediaToggle=function(link){var finalMedia=link.media||"all";function enableStylesheet(){link.media=finalMedia}if(link.addEventListener){link.addEventListener("load",enableStylesheet)}else if(link.attachEvent){link.attachEvent("onload",enableStylesheet)}setTimeout(function(){link.rel="stylesheet";link.media="only x"}),setTimeout(enableStylesheet,3000)},!rp.support()){var links=w.document.getElementsByTagName("link");for(var i=0;i<links.length;i++){var link=links[i];if("preload"===link.rel&&"style"===link.as&&!link.getAttribute("data-loadcss")){link.setAttribute("data-loadcss",!0),rp.bindMediaToggle(link)}}}}(window);
      </script>
    `;
    
    // HTMLに挿入
    return html
      .replace('</head>', `${criticalInline}${lazyLoadCSS}</head>`)
      .replace(/<link[^>]*stylesheet[^>]*>/gi, ''); // 既存のスタイルシートリンクを削除
  }
}

// 使用例
const extractor = new CriticalCSSExtractor();
await extractor.extractCriticalCSS('./dist/index.html', './dist/optimized.html');
```

### 2. CSS最小化とツリーシェイキング

```javascript
// css-optimizer.js
const postcss = require('postcss');
const cssnano = require('cssnano');
const purgecss = require('@fullhuman/postcss-purgecss');
const autoprefixer = require('autoprefixer');

class CSSOptimizer {
  constructor() {
    this.plugins = [
      // 未使用CSSの削除
      purgecss({
        content: [
          './src/**/*.html',
          './src/**/*.js',
          './src/**/*.jsx',
          './src/**/*.ts',
          './src/**/*.tsx',
        ],
        defaultExtractor: content => {
          // Tailwind CSS対応
          const broadMatches = content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || [];
          const innerMatches = content.match(/[^<>"'`\s.()]*[^<>"'`\s.():]/g) || [];
          return broadMatches.concat(innerMatches);
        },
        safelist: {
          standard: [
            /^(hover|focus|active|visited|disabled):/,
            /^(sm|md|lg|xl|2xl):/,
            /^animate-/,
            /data-/,
          ],
          deep: [/^npm-/, /^v-/],
          greedy: [/tooltip/, /modal/, /dropdown/],
        },
        fontFace: true,
        keyframes: true,
        variables: true,
      }),
      
      // ベンダープレフィックス
      autoprefixer({
        grid: 'autoplace',
        flexbox: true,
      }),
      
      // CSS最小化
      cssnano({
        preset: ['advanced', {
          discardComments: { removeAll: true },
          reduceIdents: false, // アニメーション名を保持
          zindex: false, // z-indexの再計算を無効化
          cssDeclarationSorter: { order: 'smacss' },
          calc: { precision: 5 },
          colormin: { legacy: true },
          convertValues: {
            length: false, // 単位変換を無効化（精度の問題）
          },
          minifyFontValues: { removeQuotes: false },
          minifyGradients: true,
          minifyParams: true,
          minifySelectors: true,
          normalizeCharset: true,
          normalizeDisplayValues: true,
          normalizePositions: true,
          normalizeRepeatStyle: true,
          normalizeString: true,
          normalizeTimingFunctions: true,
          normalizeUnicode: true,
          normalizeUrl: true,
          normalizeWhitespace: true,
          orderedValues: true,
          reduceInitial: true,
          reduceTransforms: true,
          svgo: true,
          uniqueSelectors: true,
          mergeRules: true,
          mergeLonghand: true,
        }],
      }),
    ];
  }
  
  async optimize(css, options = {}) {
    const result = await postcss(this.plugins)
      .process(css, { from: undefined, ...options });
    
    return {
      css: result.css,
      map: result.map,
      warnings: result.warnings(),
      stats: {
        originalSize: css.length,
        optimizedSize: result.css.length,
        reduction: ((1 - result.css.length / css.length) * 100).toFixed(2),
      },
    };
  }
}
```

## セレクタとレンダリング最適化

### 1. 高性能セレクタパターン

```css
/* ❌ 避けるべきセレクタ */
* { } /* ユニバーサルセレクタ */
div > * { } /* 子セレクタ + ユニバーサル */
[data-*] { } /* 部分属性セレクタ */
.class1.class2.class3.class4 { } /* 過度な詳細度 */
body .container .row .col .card .header .title { } /* 深いネスト */
div:nth-child(3n+1) { } /* 複雑な擬似クラス */

/* ✅ 推奨セレクタ */
.specific-class { } /* 単一クラス */
#unique-id { } /* ID（控えめに使用） */
.parent > .direct-child { } /* 直接の子のみ */
.component__element { } /* BEM命名 */
[data-state="active"] { } /* 完全一致属性 */

/* セレクタ最適化のベストプラクティス */
/* 1. 右から左への評価を意識 */
.navigation li a { } /* ❌ 全aタグを評価後、親を確認 */
.nav-link { } /* ✅ 直接クラスで指定 */

/* 2. 詳細度の管理 */
.btn { 
  /* ベーススタイル */
  padding: 10px 20px;
}

.btn--primary {
  /* バリアント（詳細度同じ） */
  background: blue;
}

/* 3. レイヤーによる詳細度制御 */
@layer reset, base, components, utilities;

@layer reset {
  * {
    margin: 0;
    padding: 0;
  }
}

@layer components {
  .btn {
    /* コンポーネントスタイル */
  }
}

@layer utilities {
  .mt-4 {
    margin-top: 1rem !important; /* utilityレイヤーでのみ!important許可 */
  }
}
```

### 2. レンダリングパフォーマンス最適化

```css
/* Compositing Layer の活用 */
.gpu-accelerated {
  /* GPU レイヤー生成 */
  transform: translateZ(0); /* または translate3d(0,0,0) */
  will-change: transform; /* 事前最適化ヒント */
  backface-visibility: hidden; /* 裏面計算スキップ */
  perspective: 1000px; /* 3D コンテキスト */
}

/* Paint と Layout の最適化 */
.optimized-animation {
  /* Composite のみ影響するプロパティ */
  transform: scale(1.1); /* ✅ */
  opacity: 0.8; /* ✅ */
  
  /* 避けるべきプロパティ（Paint/Layout発生） */
  /* width, height ❌ */
  /* top, left (position: absolute時) ❌ */
  /* background-color ❌ */
}

/* Contain プロパティによる最適化 */
.contained-element {
  contain: layout; /* レイアウト計算を要素内に限定 */
  contain: paint; /* ペイント領域を要素内に限定 */
  contain: size; /* サイズ計算を独立 */
  contain: style; /* スタイル継承をブロック */
  
  /* ショートハンド */
  contain: layout paint; /* 複数指定 */
  contain: strict; /* layout paint size の組み合わせ */
  contain: content; /* layout paint の組み合わせ */
}

/* Content-visibility による遅延レンダリング */
.lazy-render {
  content-visibility: auto; /* ビューポート外の要素を遅延レンダリング */
  contain-intrinsic-size: 0 500px; /* プレースホルダーサイズ */
}

/* Scroll-driven Animations */
@keyframes reveal {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.scroll-animated {
  animation: reveal linear;
  animation-timeline: view();
  animation-range: entry 0% cover 30%;
}
```

## ロードストラテジー

### 1. CSS読み込み最適化

```html
<!-- Critical CSS インライン -->
<style>
  /* ファーストビューに必要な最小限のCSS */
  body { margin: 0; font-family: system-ui; }
  .header { background: #fff; padding: 1rem; }
  /* ... */
</style>

<!-- プリロード（高優先度） -->
<link rel="preload" href="/css/main.css" as="style">

<!-- プリフェッチ（低優先度） -->
<link rel="prefetch" href="/css/page-specific.css">

<!-- メディアクエリ分割 -->
<link rel="stylesheet" href="/css/mobile.css" media="(max-width: 768px)">
<link rel="stylesheet" href="/css/desktop.css" media="(min-width: 769px)">
<link rel="stylesheet" href="/css/print.css" media="print">

<!-- 条件付き読み込み -->
<link rel="stylesheet" href="/css/dark-theme.css" 
      media="(prefers-color-scheme: dark)">

<!-- 遅延読み込み -->
<link rel="stylesheet" href="/css/below-fold.css" 
      media="print" onload="this.media='all'">
```

### 2. JavaScript での動的CSS管理

```javascript
// CSS動的読み込みクラス
class CSSLoader {
  constructor() {
    this.loadedStyles = new Set();
    this.observer = null;
    this.initIntersectionObserver();
  }
  
  // 遅延読み込み
  async loadCSS(href, options = {}) {
    if (this.loadedStyles.has(href)) {
      return Promise.resolve();
    }
    
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      
      if (options.media) {
        link.media = options.media;
      }
      
      if (options.integrity) {
        link.integrity = options.integrity;
        link.crossOrigin = 'anonymous';
      }
      
      link.onload = () => {
        this.loadedStyles.add(href);
        resolve(link);
      };
      
      link.onerror = reject;
      
      document.head.appendChild(link);
    });
  }
  
  // Intersection Observer による遅延読み込み
  initIntersectionObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const element = entry.target;
            const cssFile = element.dataset.css;
            
            if (cssFile) {
              this.loadCSS(cssFile);
              this.observer.unobserve(element);
            }
          }
        });
      },
      {
        rootMargin: '50px',
      }
    );
  }
  
  // 要素監視
  observe(element) {
    if (this.observer && element.dataset.css) {
      this.observer.observe(element);
    }
  }
  
  // CSSの削除
  removeCSS(href) {
    const link = document.querySelector(`link[href="${href}"]`);
    if (link) {
      link.remove();
      this.loadedStyles.delete(href);
    }
  }
  
  // 条件付き読み込み
  async loadConditionalCSS() {
    // デバイス判定
    if ('ontouchstart' in window) {
      await this.loadCSS('/css/touch.css');
    }
    
    // ネットワーク速度判定
    if (navigator.connection) {
      const connection = navigator.connection;
      if (connection.saveData || connection.effectiveType === 'slow-2g') {
        await this.loadCSS('/css/low-bandwidth.css');
      }
    }
    
    // Viewport サイズ
    if (window.innerWidth > 1920) {
      await this.loadCSS('/css/large-screen.css');
    }
  }
}

// 使用例
const cssLoader = new CSSLoader();

// ページ読み込み後
document.addEventListener('DOMContentLoaded', () => {
  // 遅延読み込み要素を監視
  document.querySelectorAll('[data-css]').forEach(el => {
    cssLoader.observe(el);
  });
  
  // 条件付きCSS読み込み
  cssLoader.loadConditionalCSS();
});

// ルート変更時の動的読み込み（SPA）
function onRouteChange(route) {
  // 古いルートのCSSを削除
  cssLoader.removeCSS(`/css/routes/${previousRoute}.css`);
  
  // 新しいルートのCSSを読み込み
  cssLoader.loadCSS(`/css/routes/${route}.css`);
}
```

## 計測とモニタリング

```javascript
// パフォーマンス計測
class CSSPerformanceMonitor {
  measure() {
    const metrics = {
      stylesheets: this.measureStylesheets(),
      cssRules: this.countCSSRules(),
      renderBlocking: this.checkRenderBlocking(),
      unusedCSS: this.estimateUnusedCSS(),
    };
    
    return metrics;
  }
  
  measureStylesheets() {
    const stylesheets = Array.from(document.styleSheets);
    return stylesheets.map(sheet => ({
      href: sheet.href,
      rules: sheet.cssRules?.length || 0,
      size: this.estimateSize(sheet),
      renderBlocking: !sheet.media || sheet.media.mediaText === 'all',
    }));
  }
  
  countCSSRules() {
    let total = 0;
    Array.from(document.styleSheets).forEach(sheet => {
      try {
        total += sheet.cssRules?.length || 0;
      } catch (e) {
        // Cross-origin
      }
    });
    return total;
  }
  
  checkRenderBlocking() {
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    return Array.from(links).filter(link => 
      !link.media || link.media === 'all' || link.media === 'screen'
    ).length;
  }
  
  async estimateUnusedCSS() {
    if (!window.chrome?.devtools) return null;
    
    // Chrome DevTools Protocol使用（開発環境のみ）
    const coverage = await startCSSCoverage();
    const unused = coverage.reduce((acc, entry) => {
      const unusedBytes = entry.ranges.reduce((sum, range) => 
        sum + (range.end - range.start), 0
      );
      return acc + unusedBytes;
    }, 0);
    
    return {
      totalBytes: coverage.reduce((sum, e) => sum + e.text.length, 0),
      unusedBytes: unused,
      percentage: (unused / totalBytes * 100).toFixed(2),
    };
  }
  
  estimateSize(stylesheet) {
    let size = 0;
    try {
      Array.from(stylesheet.cssRules).forEach(rule => {
        size += rule.cssText.length;
      });
    } catch (e) {
      // 推定値
      size = stylesheet.cssRules?.length * 50 || 0;
    }
    return size;
  }
}
```

## ベストプラクティス

1. **Critical CSS**: ファーストビューに必要な最小限をインライン化
2. **コード分割**: ルート/コンポーネント単位でCSS分割
3. **未使用CSS削除**: PurgeCSS、TreeShakingの活用
4. **セレクタ最適化**: 単純で効率的なセレクタ使用
5. **GPU活用**: transform、opacityでのアニメーション
6. **遅延読み込み**: Intersection Observerでの動的読み込み
7. **キャッシング**: 長期キャッシュとバージョニング戦略