# CSS Architecture Patterns

Scalable and maintainable CSS architecture patterns.

## CSS Methodologies

### BEM (Block Element Modifier)
```css
/* Block */
.card {}

/* Element */
.card__header {}
.card__body {}
.card__footer {}

/* Modifier */
.card--featured {}
.card--disabled {}

/* Full example */
.card--featured .card__header {}
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

## Checklist
- [ ] Choose CSS methodology (BEM recommended)
- [ ] Set up CSS custom properties
- [ ] Implement responsive design
- [ ] Optimize critical CSS
- [ ] Use modern layout (Grid/Flexbox)
- [ ] Optimize animations
- [ ] Consider CSS-in-JS for React