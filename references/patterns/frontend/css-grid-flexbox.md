# CSS Grid & Flexbox 実践ガイド 2025

## CSS Grid 完全マスター

### 1. グリッドレイアウトの基礎と応用

```css
/* Grid コンテナの設定 */
.grid-container {
  display: grid;
  
  /* 明示的グリッド定義 */
  grid-template-columns: 
    [full-start] minmax(1rem, 1fr) 
    [main-start] minmax(0, 75rem) 
    [main-end] minmax(1rem, 1fr) 
    [full-end];
  
  grid-template-rows: 
    [header-start] auto 
    [header-end main-start] 1fr 
    [main-end footer-start] auto 
    [footer-end];
  
  /* 暗黙的グリッド */
  grid-auto-rows: minmax(100px, auto);
  grid-auto-columns: 1fr;
  grid-auto-flow: row dense; /* 隙間を埋める配置 */
  
  /* ギャップ（旧grid-gap） */
  gap: clamp(1rem, 2vw, 2rem);
  row-gap: 20px;
  column-gap: 30px;
  
  /* アライメント */
  justify-items: stretch; /* start | end | center | stretch */
  align-items: stretch;
  justify-content: start; /* space-between | space-around | space-evenly */
  align-content: start;
  
  /* ショートハンド */
  place-items: center; /* align-items justify-items */
  place-content: center; /* align-content justify-content */
}

/* レスポンシブグリッドパターン */
.responsive-grid {
  display: grid;
  
  /* Auto-fit: 空のトラックを削除 */
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  
  /* Auto-fill: 空のトラックを保持 */
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  
  /* RAM (Repeat, Auto, Minmax) パターン */
  grid-template-columns: repeat(auto-fit, minmax(
    min(100%, 300px), /* 最小値をビューポート幅に制限 */
    1fr
  ));
  
  /* 可変カラム数 */
  grid-template-columns: repeat(
    auto-fit,
    minmax(
      clamp(200px, 25%, 300px), /* 動的な最小幅 */
      1fr
    )
  );
}

/* グリッドアイテムの配置 */
.grid-item {
  /* 配置指定 */
  grid-column: 1 / 3; /* または span 2 */
  grid-row: 2 / 4;
  
  /* 名前付きライン使用 */
  grid-column: main-start / main-end;
  
  /* ショートハンド */
  grid-area: 2 / 1 / 4 / 3; /* row-start / col-start / row-end / col-end */
  
  /* セルフアライメント */
  justify-self: center;
  align-self: end;
  place-self: center stretch;
  
  /* Zインデックス制御 */
  z-index: 1; /* グリッドアイテム間の重なり順 */
}

/* Grid Template Areas - ビジュアルレイアウト */
.layout-grid {
  display: grid;
  grid-template-areas:
    "header header header"
    "nav    main   aside"
    "nav    main   aside"
    "footer footer footer";
  
  grid-template-columns: 200px 1fr 300px;
  grid-template-rows: auto 1fr auto auto;
  gap: 20px;
  min-height: 100vh;
}

.header { grid-area: header; }
.nav    { grid-area: nav; }
.main   { grid-area: main; }
.aside  { grid-area: aside; }
.footer { grid-area: footer; }

/* Subgrid - 親グリッドの継承 */
.parent-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.subgrid-item {
  display: grid;
  grid-column: span 2;
  
  /* Subgrid: 親のトラックを継承 */
  grid-template-columns: subgrid;
  grid-template-rows: subgrid;
}

/* Container Queries と組み合わせ */
@container (min-width: 700px) {
  .container-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### 2. 高度なグリッドテクニック

```css
/* マソンリーレイアウト（実験的機能） */
.masonry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  grid-template-rows: masonry; /* 実験的 */
  gap: 20px;
}

/* アスペクト比を保つグリッド */
.aspect-ratio-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.aspect-ratio-grid > * {
  aspect-ratio: 16 / 9;
  object-fit: cover;
  width: 100%;
  height: 100%;
}

/* 複雑なレイアウトパターン */
.complex-grid {
  display: grid;
  grid-template-columns: 
    [full-start] 
    minmax(1rem, 1fr) 
    [content-start] 
    repeat(12, [col-start] minmax(0, 6.25rem) [col-end])
    [content-end]
    minmax(1rem, 1fr)
    [full-end];
  
  /* 行の最小・最大高さ */
  grid-template-rows: 
    minmax(100px, max-content)
    fit-content(300px)
    minmax(200px, 1fr);
}

/* グリッドアニメーション */
.animated-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  transition: grid-template-columns 0.3s ease;
}

.animated-grid:hover {
  grid-template-columns: 2fr 1fr 1fr;
}

.animated-grid-item {
  transition: grid-column 0.3s ease, grid-row 0.3s ease;
}

/* レイヤードグリッド */
.layered-grid {
  display: grid;
  grid-template: 1fr / 1fr; /* 1x1グリッド */
}

.layered-grid > * {
  grid-area: 1 / 1; /* 全て同じセルに配置 */
}

.layered-grid > .background {
  z-index: 0;
}

.layered-grid > .content {
  z-index: 1;
  align-self: center;
  justify-self: center;
}
```

## Flexbox 完全マスター

### 1. Flexboxの基礎と応用

```css
/* Flex コンテナ */
.flex-container {
  display: flex; /* または inline-flex */
  
  /* 主軸の方向 */
  flex-direction: row; /* row-reverse | column | column-reverse */
  
  /* 折り返し */
  flex-wrap: wrap; /* nowrap | wrap-reverse */
  
  /* ショートハンド */
  flex-flow: row wrap;
  
  /* 主軸の配置 */
  justify-content: flex-start; 
  /* flex-end | center | space-between | space-around | space-evenly */
  
  /* 交差軸の配置 */
  align-items: stretch;
  /* flex-start | flex-end | center | baseline */
  
  /* 複数行の配置 */
  align-content: flex-start;
  /* flex-end | center | space-between | space-around | stretch */
  
  /* ギャップ */
  gap: 20px;
  row-gap: 10px;
  column-gap: 20px;
}

/* Flex アイテム */
.flex-item {
  /* 伸長係数 */
  flex-grow: 1; /* 0がデフォルト */
  
  /* 収縮係数 */
  flex-shrink: 1; /* 1がデフォルト */
  
  /* ベースサイズ */
  flex-basis: auto; /* または具体的な値 200px, 20% など */
  
  /* ショートハンド */
  flex: 1 1 auto; /* grow shrink basis */
  flex: 1; /* 1 1 0 と同じ */
  flex: auto; /* 1 1 auto */
  flex: initial; /* 0 1 auto */
  flex: none; /* 0 0 auto */
  
  /* セルフアライメント */
  align-self: auto; /* flex-start | flex-end | center | baseline | stretch */
  
  /* 並び順 */
  order: 0; /* デフォルト0、負の値も可能 */
}

/* 一般的なFlexboxパターン */

/* 中央揃え */
.center-flex {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

/* サイドバーレイアウト */
.sidebar-layout {
  display: flex;
  gap: 20px;
}

.sidebar {
  flex: 0 0 250px; /* 固定幅 */
}

.main-content {
  flex: 1; /* 残りの空間を占有 */
  min-width: 0; /* テキストオーバーフロー対策 */
}

/* ヘッダー/フッター固定レイアウト */
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header,
.app-footer {
  flex: 0 0 auto;
}

.app-main {
  flex: 1 0 auto;
}

/* カードグリッド */
.card-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  
  /* 負のマージンテクニック */
  margin: -10px;
}

.card-grid > * {
  flex: 1 1 300px; /* 最小幅300pxで伸縮 */
  margin: 10px;
}

/* ナビゲーションバー */
.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
}

.nav-links {
  display: flex;
  gap: 2rem;
  list-style: none;
}

.nav-actions {
  display: flex;
  gap: 1rem;
  margin-left: auto; /* 右寄せ */
}
```

### 2. 高度なFlexboxテクニック

```css
/* レスポンシブFlexbox */
.responsive-flex {
  display: flex;
  flex-wrap: wrap;
  gap: clamp(1rem, 2vw, 2rem);
}

.responsive-flex > * {
  flex: 1 1 calc(33.333% - 2rem);
}

@media (max-width: 768px) {
  .responsive-flex > * {
    flex: 1 1 calc(50% - 1rem);
  }
}

@media (max-width: 480px) {
  .responsive-flex > * {
    flex: 1 1 100%;
  }
}

/* Flexbox アニメーション */
.animated-flex {
  display: flex;
  transition: gap 0.3s ease;
}

.animated-flex:hover {
  gap: 2rem;
}

.animated-flex-item {
  flex: 1;
  transition: flex 0.3s ease;
}

.animated-flex-item:hover {
  flex: 2;
}

/* Flexbox タブシステム */
.tab-container {
  display: flex;
  flex-direction: column;
}

.tab-list {
  display: flex;
  gap: 1px;
  background: #ddd;
}

.tab-button {
  flex: 1;
  padding: 1rem;
  background: white;
  border: none;
  cursor: pointer;
  transition: background 0.3s;
}

.tab-button[aria-selected="true"] {
  background: #007bff;
  color: white;
}

.tab-panel {
  padding: 2rem;
  display: none;
}

.tab-panel[aria-hidden="false"] {
  display: block;
}

/* Intrinsic サイジング */
.intrinsic-flex {
  display: flex;
  gap: 1rem;
}

.intrinsic-item {
  flex: 0 1 max-content; /* コンテンツに基づくサイズ */
}

.intrinsic-fill {
  flex: 1 1 0; /* 残りの空間を埋める */
}

/* Flexbox マスタリー */
.mastery-container {
  display: flex;
  flex-wrap: wrap;
  
  /* Flexboxでのアスペクト比保持 */
  --columns: 3;
  --gap: 1rem;
}

.mastery-item {
  flex: 0 1 calc((100% - (var(--columns) - 1) * var(--gap)) / var(--columns));
  aspect-ratio: 1;
}
```

## Grid vs Flexbox 使い分け

```css
/* 2次元レイアウト → Grid */
.two-dimensional {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 100px);
}

/* 1次元レイアウト → Flexbox */
.one-dimensional {
  display: flex;
  justify-content: space-between;
}

/* 複雑なレイアウト → Grid + Flexbox組み合わせ */
.hybrid-layout {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 2rem;
}

.hybrid-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.hybrid-main {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

/* パフォーマンス考慮 */
.performance-optimized {
  /* Gridの場合 */
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  contain: layout; /* レイアウト計算の最適化 */
}

.performance-flex {
  /* Flexboxの場合 */
  display: flex;
  flex-wrap: wrap;
  will-change: auto; /* アニメーション時のみwill-change使用 */
}
```

## ベストプラクティス

1. **Grid選択基準**: 2次元レイアウト、複雑な配置、オーバーラップ
2. **Flexbox選択基準**: 1次元配置、動的サイズ調整、コンテンツベースレイアウト
3. **レスポンシブ**: clamp()、minmax()、auto-fit/auto-fillの活用
4. **パフォーマンス**: contain、will-changeの適切な使用
5. **アクセシビリティ**: 論理的な並び順の維持
6. **フォールバック**: @supportsによる段階的強化
7. **デバッグ**: Chrome/Firefox DevToolsのGrid/Flexインスペクター活用