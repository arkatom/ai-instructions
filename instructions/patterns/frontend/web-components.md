# Web Components 実践ガイド 2025

## Custom Elements 実装

### 1. 基本的なカスタム要素

```javascript
// 基本的なWeb Component
class CustomButton extends HTMLElement {
  // 監視する属性を定義
  static get observedAttributes() {
    return ['variant', 'size', 'disabled', 'loading', 'icon', 'icon-position'];
  }
  
  constructor() {
    super();
    
    // Shadow DOM の作成
    this.attachShadow({ mode: 'open', delegatesFocus: true });
    
    // 内部状態
    this._internals = this.attachInternals ? this.attachInternals() : null;
    this._variant = 'primary';
    this._size = 'medium';
    this._disabled = false;
    this._loading = false;
    
    // イベントハンドラのバインド
    this.handleClick = this.handleClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }
  
  // ライフサイクル: 要素がDOMに追加された時
  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.upgradeProperties();
    
    // アクセシビリティ設定
    if (!this.hasAttribute('role')) {
      this.setAttribute('role', 'button');
    }
    if (!this.hasAttribute('tabindex')) {
      this.setAttribute('tabindex', '0');
    }
  }
  
  // ライフサイクル: 要素がDOMから削除された時
  disconnectedCallback() {
    this.removeEventListeners();
  }
  
  // ライフサイクル: 要素が別のドキュメントに移動した時
  adoptedCallback() {
    console.log('Element moved to new document');
  }
  
  // ライフサイクル: 監視属性が変更された時
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    
    switch (name) {
      case 'variant':
        this._variant = newValue || 'primary';
        break;
      case 'size':
        this._size = newValue || 'medium';
        break;
      case 'disabled':
        this._disabled = newValue !== null;
        this.updateDisabledState();
        break;
      case 'loading':
        this._loading = newValue !== null;
        this.updateLoadingState();
        break;
    }
    
    if (this.shadowRoot) {
      this.render();
    }
  }
  
  // プロパティアップグレード（属性より先にプロパティが設定された場合の対処）
  upgradeProperties() {
    ['variant', 'size', 'disabled', 'loading'].forEach(prop => {
      if (this.hasOwnProperty(prop)) {
        const value = this[prop];
        delete this[prop];
        this[prop] = value;
      }
    });
  }
  
  // レンダリング
  render() {
    if (!this.shadowRoot) return;
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          font-family: system-ui, -apple-system, sans-serif;
          outline: none;
        }
        
        :host([hidden]) {
          display: none !important;
        }
        
        :host([disabled]) {
          pointer-events: none;
          opacity: 0.5;
        }
        
        .button {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: var(--button-padding, 8px 16px);
          border: none;
          border-radius: 6px;
          font-size: inherit;
          font-weight: 500;
          line-height: 1.5;
          cursor: pointer;
          transition: all 0.2s ease;
          user-select: none;
          white-space: nowrap;
        }
        
        /* バリアントスタイル */
        .button--primary {
          background: var(--color-primary, #007bff);
          color: var(--color-primary-text, white);
        }
        
        .button--primary:hover:not(:disabled) {
          background: var(--color-primary-dark, #0056b3);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
        }
        
        .button--secondary {
          background: transparent;
          color: var(--color-primary, #007bff);
          border: 2px solid var(--color-primary, #007bff);
        }
        
        .button--secondary:hover:not(:disabled) {
          background: var(--color-primary, #007bff);
          color: white;
        }
        
        /* サイズスタイル */
        .button--small {
          padding: 4px 12px;
          font-size: 0.875rem;
        }
        
        .button--medium {
          padding: 8px 16px;
          font-size: 1rem;
        }
        
        .button--large {
          padding: 12px 24px;
          font-size: 1.125rem;
        }
        
        /* ローディング状態 */
        :host([loading]) .button {
          color: transparent;
        }
        
        .loading-spinner {
          position: absolute;
          width: 16px;
          height: 16px;
          border: 2px solid currentColor;
          border-radius: 50%;
          border-top-color: transparent;
          animation: spin 0.6s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        /* フォーカススタイル */
        :host(:focus-visible) .button {
          outline: 2px solid var(--color-focus, #4dabf7);
          outline-offset: 2px;
        }
        
        /* スロット */
        ::slotted(*) {
          pointer-events: none;
        }
      </style>
      
      <button 
        class="button button--${this._variant} button--${this._size}"
        ?disabled="${this._disabled}"
        aria-busy="${this._loading}"
      >
        ${this._loading ? '<span class="loading-spinner"></span>' : ''}
        <slot></slot>
      </button>
    `;
  }
  
  // イベントリスナー設定
  setupEventListeners() {
    this.addEventListener('click', this.handleClick);
    this.addEventListener('keydown', this.handleKeyDown);
  }
  
  removeEventListeners() {
    this.removeEventListener('click', this.handleClick);
    this.removeEventListener('keydown', this.handleKeyDown);
  }
  
  handleClick(event) {
    if (this._disabled || this._loading) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    // カスタムイベント発火
    this.dispatchEvent(new CustomEvent('custom-click', {
      detail: { timestamp: Date.now() },
      bubbles: true,
      composed: true,
    }));
  }
  
  handleKeyDown(event) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.click();
    }
  }
  
  // 状態更新メソッド
  updateDisabledState() {
    if (this._disabled) {
      this.setAttribute('aria-disabled', 'true');
      this.setAttribute('tabindex', '-1');
    } else {
      this.setAttribute('aria-disabled', 'false');
      this.setAttribute('tabindex', '0');
    }
  }
  
  updateLoadingState() {
    if (this._loading) {
      this.setAttribute('aria-busy', 'true');
    } else {
      this.setAttribute('aria-busy', 'false');
    }
  }
  
  // プロパティゲッター/セッター
  get variant() {
    return this._variant;
  }
  
  set variant(value) {
    this.setAttribute('variant', value);
  }
  
  get size() {
    return this._size;
  }
  
  set size(value) {
    this.setAttribute('size', value);
  }
  
  get disabled() {
    return this._disabled;
  }
  
  set disabled(value) {
    if (value) {
      this.setAttribute('disabled', '');
    } else {
      this.removeAttribute('disabled');
    }
  }
  
  get loading() {
    return this._loading;
  }
  
  set loading(value) {
    if (value) {
      this.setAttribute('loading', '');
    } else {
      this.removeAttribute('loading');
    }
  }
}

// カスタム要素の登録
customElements.define('custom-button', CustomButton);
```

### 2. 高度なWeb Component（フォーム統合）

```typescript
// TypeScript版の高度なWeb Component
interface FormAssociatedElement extends HTMLElement {
  readonly form: HTMLFormElement | null;
  readonly validity: ValidityState;
  readonly validationMessage: string;
  readonly willValidate: boolean;
  checkValidity(): boolean;
  reportValidity(): boolean;
  setCustomValidity(message: string): void;
}

// フォーム関連Web Component
class CustomInput extends HTMLElement implements FormAssociatedElement {
  static formAssociated = true;
  
  static get observedAttributes() {
    return ['value', 'type', 'placeholder', 'required', 'pattern', 'min', 'max', 'disabled'];
  }
  
  private _internals: ElementInternals;
  private _value: string = '';
  private _input: HTMLInputElement | null = null;
  
  constructor() {
    super();
    this.attachShadow({ mode: 'open', delegatesFocus: true });
    this._internals = this.attachInternals();
    
    // フォーム関連プロパティの設定
    this._internals.setFormValue('');
  }
  
  connectedCallback() {
    this.render();
    this.setupInput();
  }
  
  disconnectedCallback() {
    // クリーンアップ
  }
  
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;
    
    switch (name) {
      case 'value':
        this.value = newValue || '';
        break;
      case 'required':
        this.updateValidity();
        break;
    }
    
    if (this._input && name !== 'value') {
      // 属性を内部inputに転送
      if (newValue !== null) {
        this._input.setAttribute(name, newValue);
      } else {
        this._input.removeAttribute(name);
      }
    }
  }
  
  render() {
    if (!this.shadowRoot) return;
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
        }
        
        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        
        input {
          width: 100%;
          padding: 10px 12px;
          border: 2px solid var(--border-color, #ddd);
          border-radius: 6px;
          font-size: 16px;
          font-family: inherit;
          background: var(--bg-color, white);
          color: var(--text-color, #333);
          transition: all 0.2s ease;
        }
        
        input:focus {
          outline: none;
          border-color: var(--focus-color, #007bff);
          box-shadow: 0 0 0 3px var(--focus-shadow, rgba(0, 123, 255, 0.1));
        }
        
        input:invalid {
          border-color: var(--error-color, #dc3545);
        }
        
        input:disabled {
          background: var(--disabled-bg, #f5f5f5);
          cursor: not-allowed;
        }
        
        .prefix,
        .suffix {
          position: absolute;
          display: flex;
          align-items: center;
          height: 100%;
          padding: 0 12px;
          color: var(--addon-color, #666);
        }
        
        .prefix {
          left: 0;
        }
        
        .suffix {
          right: 0;
        }
        
        :host([has-prefix]) input {
          padding-left: 40px;
        }
        
        :host([has-suffix]) input {
          padding-right: 40px;
        }
        
        .error-message {
          position: absolute;
          bottom: -20px;
          left: 0;
          font-size: 12px;
          color: var(--error-color, #dc3545);
        }
      </style>
      
      <div class="input-wrapper">
        <span class="prefix">
          <slot name="prefix"></slot>
        </span>
        <input 
          type="${this.getAttribute('type') || 'text'}"
          placeholder="${this.getAttribute('placeholder') || ''}"
          value="${this._value}"
        />
        <span class="suffix">
          <slot name="suffix"></slot>
        </span>
      </div>
      <div class="error-message" role="alert" aria-live="polite"></div>
    `;
  }
  
  setupInput() {
    this._input = this.shadowRoot?.querySelector('input') || null;
    
    if (!this._input) return;
    
    // イベントリスナー
    this._input.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this._value = target.value;
      this._internals.setFormValue(this._value);
      
      // バリデーション
      this.updateValidity();
      
      // カスタムイベント発火
      this.dispatchEvent(new CustomEvent('input', {
        detail: { value: this._value },
        bubbles: true,
        composed: true,
      }));
    });
    
    this._input.addEventListener('change', (e) => {
      this.dispatchEvent(new CustomEvent('change', {
        detail: { value: this._value },
        bubbles: true,
        composed: true,
      }));
    });
  }
  
  // バリデーション
  updateValidity() {
    if (!this._input) return;
    
    const validity = this._input.validity;
    const validationMessage = this._input.validationMessage;
    
    // ElementInternalsにバリデーション状態を設定
    if (validity.valid) {
      this._internals.setValidity({});
    } else {
      this._internals.setValidity(
        validity,
        validationMessage,
        this._input
      );
    }
    
    // エラーメッセージ表示
    const errorElement = this.shadowRoot?.querySelector('.error-message');
    if (errorElement) {
      errorElement.textContent = validationMessage;
    }
  }
  
  // フォーム関連API実装
  get form() {
    return this._internals.form;
  }
  
  get validity() {
    return this._internals.validity;
  }
  
  get validationMessage() {
    return this._internals.validationMessage;
  }
  
  get willValidate() {
    return this._internals.willValidate;
  }
  
  checkValidity() {
    return this._internals.checkValidity();
  }
  
  reportValidity() {
    return this._internals.reportValidity();
  }
  
  setCustomValidity(message: string) {
    this._internals.setValidity(
      { customError: true },
      message
    );
  }
  
  // value プロパティ
  get value() {
    return this._value;
  }
  
  set value(val: string) {
    this._value = val;
    if (this._input) {
      this._input.value = val;
    }
    this._internals.setFormValue(val);
  }
  
  // フォームリセット時の処理
  formResetCallback() {
    this.value = this.getAttribute('value') || '';
  }
  
  // フォーム無効化時の処理
  formDisabledCallback(disabled: boolean) {
    if (disabled) {
      this.setAttribute('disabled', '');
    } else {
      this.removeAttribute('disabled');
    }
  }
}

// 登録
customElements.define('custom-input', CustomInput);
```

### 3. Lit を使用した効率的な実装

```typescript
// Lit を使用したWeb Component
import { LitElement, html, css, property, customElement } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { until } from 'lit/directives/until.js';

@customElement('lit-card')
export class LitCard extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: system-ui, -apple-system, sans-serif;
    }
    
    .card {
      background: var(--card-bg, white);
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
    }
    
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }
    
    .card--elevated {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    }
    
    .card--interactive {
      cursor: pointer;
    }
    
    .card__header {
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-color, #eee);
    }
    
    .card__title {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--title-color, #333);
    }
    
    .card__subtitle {
      margin: 4px 0 0;
      font-size: 0.875rem;
      color: var(--subtitle-color, #666);
    }
    
    .card__content {
      color: var(--content-color, #444);
    }
    
    .card__footer {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border-color, #eee);
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    
    .skeleton {
      background: linear-gradient(
        90deg,
        #f0f0f0 25%,
        #e0e0e0 50%,
        #f0f0f0 75%
      );
      background-size: 200% 100%;
      animation: loading 1.5s infinite;
      border-radius: 4px;
    }
    
    @keyframes loading {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  
  @property({ type: String }) title = '';
  @property({ type: String }) subtitle = '';
  @property({ type: Boolean }) elevated = false;
  @property({ type: Boolean }) interactive = false;
  @property({ type: Boolean }) loading = false;
  @property({ type: Object }) customStyles = {};
  
  private async loadContent() {
    // 非同期コンテンツの読み込みシミュレーション
    await new Promise(resolve => setTimeout(resolve, 1000));
    return html`<p>読み込まれたコンテンツ</p>`;
  }
  
  render() {
    const classes = {
      'card': true,
      'card--elevated': this.elevated,
      'card--interactive': this.interactive,
    };
    
    if (this.loading) {
      return this.renderSkeleton();
    }
    
    return html`
      <article 
        class=${classMap(classes)}
        style=${styleMap(this.customStyles)}
        @click=${this.handleClick}
      >
        ${this.title || this.subtitle ? html`
          <header class="card__header">
            ${this.title ? html`<h2 class="card__title">${this.title}</h2>` : ''}
            ${this.subtitle ? html`<p class="card__subtitle">${this.subtitle}</p>` : ''}
          </header>
        ` : ''}
        
        <div class="card__content">
          <slot></slot>
          ${until(this.loadContent(), html`<p>読み込み中...</p>`)}
        </div>
        
        <footer class="card__footer">
          <slot name="footer"></slot>
        </footer>
      </article>
    `;
  }
  
  renderSkeleton() {
    return html`
      <div class="card">
        <div class="card__header">
          <div class="skeleton" style="height: 24px; width: 60%;"></div>
          <div class="skeleton" style="height: 16px; width: 40%; margin-top: 8px;"></div>
        </div>
        <div class="card__content">
          <div class="skeleton" style="height: 16px; width: 100%;"></div>
          <div class="skeleton" style="height: 16px; width: 90%; margin-top: 8px;"></div>
          <div class="skeleton" style="height: 16px; width: 95%; margin-top: 8px;"></div>
        </div>
      </div>
    `;
  }
  
  private handleClick() {
    if (this.interactive) {
      this.dispatchEvent(new CustomEvent('card-click', {
        detail: {
          title: this.title,
          subtitle: this.subtitle,
        },
        bubbles: true,
        composed: true,
      }));
    }
  }
}

// 使用例
// <lit-card 
//   title="カードタイトル" 
//   subtitle="サブタイトル"
//   elevated
//   interactive
// >
//   <p>カードの内容</p>
//   <button slot="footer">アクション</button>
// </lit-card>
```

## Slot と Shadow DOM

```javascript
// 高度なスロット管理
class SlottedComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }
  
  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        
        .container {
          border: 2px solid #ddd;
          border-radius: 8px;
          padding: 16px;
        }
        
        ::slotted(h1),
        ::slotted(h2),
        ::slotted(h3) {
          color: var(--heading-color, #333);
          margin-top: 0;
        }
        
        ::slotted(p) {
          line-height: 1.6;
        }
        
        ::slotted(.highlight) {
          background: yellow;
          padding: 2px 4px;
        }
        
        .header {
          background: #f5f5f5;
          margin: -16px -16px 16px;
          padding: 12px 16px;
          border-radius: 6px 6px 0 0;
        }
        
        .footer {
          background: #f5f5f5;
          margin: 16px -16px -16px;
          padding: 12px 16px;
          border-radius: 0 0 6px 6px;
        }
      </style>
      
      <div class="container">
        <div class="header">
          <slot name="header">デフォルトヘッダー</slot>
        </div>
        
        <main>
          <slot>デフォルトコンテンツ</slot>
        </main>
        
        <div class="footer">
          <slot name="footer">デフォルトフッター</slot>
        </div>
      </div>
    `;
    
    // スロット変更の監視
    const slots = this.shadowRoot.querySelectorAll('slot');
    slots.forEach(slot => {
      slot.addEventListener('slotchange', (e) => {
        const slot = e.target as HTMLSlotElement;
        const nodes = slot.assignedNodes();
        console.log(`Slot "${slot.name || 'default'}" changed:`, nodes);
        
        // スロットコンテンツに基づく処理
        this.processSlottedContent(slot, nodes);
      });
    });
  }
  
  processSlottedContent(slot, nodes) {
    // スロットコンテンツの処理
    nodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // 要素ノードの処理
        console.log('Slotted element:', node.tagName);
      }
    });
  }
}

customElements.define('slotted-component', SlottedComponent);
```

## ベストプラクティス

1. **Shadow DOM**: スタイルのカプセル化と再利用性
2. **Custom Elements**: 標準HTMLのように使える独自要素
3. **属性とプロパティ**: 適切な同期と型変換
4. **ライフサイクル**: 適切なタイミングでの初期化とクリーンアップ
5. **アクセシビリティ**: ARIA属性、キーボード操作対応
6. **パフォーマンス**: 遅延レンダリング、効率的な更新
7. **フレームワーク統合**: React、Vue、Angularとの相互運用性