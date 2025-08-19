# CSS Architecture Patterns

Scalable and maintainable CSS architecture patterns.

## CSS Methodologies

### Tailwind CSS (最も人気のあるユーティリティファースト)
```jsx
// 採用率68% (State of CSS 2024)
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
  <h3 className="text-lg font-semibold text-gray-900">タイトル</h3>
  <button className="px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600">
    アクション
  </button>
</div>

// JIT（Just-In-Time）で任意の値も使用可能
<div className="w-[137px] h-[69px] bg-[#1da1f2]" />
```

### CSS Modules (スコープ化されたCSS)
```typescript
// styles.module.css
.container {
  display: flex;
  padding: 1rem;
  background: white;
}

.title {
  font-size: 1.5rem;
  color: var(--color-primary);
}

// Component.tsx
import styles from './styles.module.css';

<div className={styles.container}>
  <h1 className={styles.title}>Title</h1>
</div>
```

### Atomic CSS
```css
/* Utility classes */
.m-0 { margin: 0; }
.m-1 { margin: 0.25rem; }
.p-2 { padding: 0.5rem; }
.text-center { text-align: center; }
.flex { display: flex; }
.hidden { display: none; }
```

## CSS-in-JS Patterns

### Styled Components
```typescript
import styled from 'styled-components';

const Button = styled.button<{ variant: 'primary' | 'secondary' }>`
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 1rem;
  
  ${({ variant }) => variant === 'primary' && `
    background: #007bff;
    color: white;
  `}
  
  &:hover {
    opacity: 0.9;
  }
`;
```

### CSS Modules
```typescript
// styles.module.css
.button {
  padding: 0.5rem 1rem;
  border-radius: 4px;
}

.primary {
  background: #007bff;
  color: white;
}

// Component.tsx
import styles from './styles.module.css';

<button className={`${styles.button} ${styles.primary}`}>
  Click me
</button>
```

## Responsive Design

### Mobile-First Approach
```css
/* Base (mobile) styles */
.container {
  width: 100%;
  padding: 1rem;
}

/* Tablet and up */
@media (min-width: 768px) {
  .container {
    max-width: 750px;
    margin: 0 auto;
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .container {
    max-width: 1200px;
  }
}
```

### Container Queries
```css
/* Modern container queries */
.card-container {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 1fr 2fr;
  }
}
```

## CSS Custom Properties

### Theme System
```css
:root {
  /* Colors */
  --color-primary: #007bff;
  --color-secondary: #6c757d;
  --color-danger: #dc3545;
  
  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 2rem;
  
  /* Typography */
  --font-base: 1rem;
  --font-scale: 1.25;
}

/* Dark mode */
[data-theme="dark"] {
  --color-primary: #4dabf7;
  --color-bg: #1a1a1a;
  --color-text: #ffffff;
}
```

## Layout Patterns

### Grid System
```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

/* Named grid areas */
.app-layout {
  display: grid;
  grid-template-areas:
    "header header header"
    "sidebar main aside"
    "footer footer footer";
  grid-template-columns: 200px 1fr 200px;
}

.header { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main { grid-area: main; }
```

### Flexbox Patterns
```css
/* Center content */
.center {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Sidebar layout */
.sidebar-layout {
  display: flex;
  gap: 1rem;
}

.sidebar-layout__aside {
  flex: 0 0 250px;
}

.sidebar-layout__main {
  flex: 1;
}
```

## Performance Optimization

### Critical CSS
```html
<!-- Inline critical CSS -->
<style>
  /* Above-the-fold styles */
  body { margin: 0; font-family: system-ui; }
  .header { background: #fff; height: 60px; }
</style>

<!-- Load non-critical CSS async -->
<link rel="preload" href="styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
```

### CSS Containment
```css
/* Improve render performance */
.card {
  contain: layout style paint;
}

/* Size containment for predictable layout */
.widget {
  contain: size layout;
  width: 300px;
  height: 200px;
}
```

## Animation Patterns

### Performance-Optimized Animations
```css
/* Use transform and opacity for best performance */
.slide-in {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Will-change for heavy animations */
.animated-element {
  will-change: transform;
}
```

## Modern CSS Features (2024)

### Container Queries
```css
/* コンテナベースのレスポンシブデザイン */
.card-container {
  container-type: inline-size;
  container-name: card;
}

@container card (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 150px 1fr;
  }
}

@container card (max-width: 399px) {
  .card {
    display: block;
  }
}
```

### View Transitions API
```javascript
// ページ遷移アニメーション
if (document.startViewTransition) {
  document.startViewTransition(() => {
    updateDOM();
  });
} else {
  updateDOM();
}
```

```css
/* トランジション設定 */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 0.3s;
}
```

### CSS Cascade Layers
```css
/* レイヤーで詳細度を管理 */
@layer reset, base, components, utilities;

@layer reset {
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
}

@layer base {
  body {
    font-family: system-ui;
    line-height: 1.5;
  }
}

@layer components {
  .btn {
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
  }
}

@layer utilities {
  .mt-4 {
    margin-top: 1rem;
  }
}
```

## Checklist
- [ ] Choose CSS methodology (Tailwind CSS推奨)
- [ ] Set up CSS custom properties
- [ ] Implement Container Queries
- [ ] Optimize critical CSS
- [ ] Use modern layout (Grid/Flexbox)
- [ ] Implement View Transitions
- [ ] Consider CSS-in-JS (Emotion/styled-components) for React