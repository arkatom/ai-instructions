# HTML Forms 実践ガイド 2025

## モダンフォーム実装パターン

### 1. ネイティブHTML5バリデーション活用

```html
<!-- 基本的なHTML5フォーム -->
<form id="advanced-form" novalidate>
  <!-- カスタムバリデーションメッセージ制御のためnovalidate -->
  
  <!-- テキスト入力（必須、パターンマッチング） -->
  <div class="form-group">
    <label for="username">
      ユーザー名
      <span class="required" aria-label="必須">*</span>
    </label>
    <input 
      type="text" 
      id="username" 
      name="username"
      required
      minlength="3"
      maxlength="20"
      pattern="^[a-zA-Z0-9_]+$"
      title="英数字とアンダースコアのみ使用可能"
      autocomplete="username"
      spellcheck="false"
      aria-describedby="username-hint username-error"
      aria-invalid="false"
    />
    <span id="username-hint" class="hint">3-20文字の英数字</span>
    <span id="username-error" class="error" role="alert"></span>
  </div>
  
  <!-- メールアドレス（複数バリデーション） -->
  <div class="form-group">
    <label for="email">メールアドレス</label>
    <input 
      type="email" 
      id="email" 
      name="email"
      required
      multiple
      pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
      autocomplete="email"
      list="email-suggestions"
      aria-describedby="email-error"
    />
    <datalist id="email-suggestions">
      <option value="@gmail.com">
      <option value="@yahoo.co.jp">
      <option value="@outlook.com">
    </datalist>
  </div>
  
  <!-- パスワード（強度インジケータ付き） -->
  <div class="form-group">
    <label for="password">パスワード</label>
    <div class="password-wrapper">
      <input 
        type="password" 
        id="password" 
        name="password"
        required
        minlength="8"
        pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}"
        autocomplete="new-password"
        aria-describedby="password-strength"
      />
      <button 
        type="button" 
        class="toggle-password"
        aria-label="パスワードを表示"
        data-toggle="password"
      >
        <span aria-hidden="true">👁</span>
      </button>
    </div>
    <div id="password-strength" class="password-strength">
      <meter 
        value="0" 
        min="0" 
        max="4"
        low="1"
        high="3"
        optimum="4"
      ></meter>
      <span class="strength-text">弱い</span>
    </div>
  </div>
  
  <!-- 日付・時刻入力 -->
  <div class="form-group">
    <label for="appointment">予約日時</label>
    <input 
      type="datetime-local" 
      id="appointment" 
      name="appointment"
      min="2025-01-01T00:00"
      max="2025-12-31T23:59"
      step="900"
      required
    />
  </div>
  
  <!-- 範囲選択（リアルタイム表示） -->
  <div class="form-group">
    <label for="price-range">
      価格帯: <output for="price-range" id="price-output">¥5,000</output>
    </label>
    <input 
      type="range" 
      id="price-range" 
      name="price"
      min="1000"
      max="50000"
      step="1000"
      value="5000"
      list="price-marks"
      oninput="document.getElementById('price-output').value = '¥' + this.value.toLocaleString()"
    />
    <datalist id="price-marks">
      <option value="1000" label="¥1,000">
      <option value="10000" label="¥10,000">
      <option value="25000" label="¥25,000">
      <option value="50000" label="¥50,000">
    </datalist>
  </div>
  
  <!-- ファイルアップロード（プレビュー付き） -->
  <div class="form-group">
    <label for="avatar">プロフィール画像</label>
    <input 
      type="file" 
      id="avatar" 
      name="avatar"
      accept="image/jpeg,image/png,image/webp"
      capture="user"
      multiple
      data-max-size="5242880"
      aria-describedby="file-requirements"
    />
    <span id="file-requirements" class="hint">
      JPEG、PNG、WebP形式（最大5MB）
    </span>
    <div id="image-preview" class="preview-container"></div>
  </div>
</form>
```

### 2. 高度なJavaScriptバリデーション

```typescript
// フォームバリデーションクラス
class FormValidator {
  private form: HTMLFormElement;
  private fields: Map<string, ValidationRule[]> = new Map();
  private errors: Map<string, string[]> = new Map();
  private touched: Set<string> = new Set();
  
  constructor(form: HTMLFormElement) {
    this.form = form;
    this.init();
  }
  
  private init() {
    // フォーム送信イベント
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.validateAll()) {
        this.submit();
      }
    });
    
    // フィールドイベント
    const inputs = this.form.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      // リアルタイムバリデーション
      input.addEventListener('input', () => {
        if (this.touched.has(input.id)) {
          this.validateField(input.id);
        }
      });
      
      // フォーカスアウト時バリデーション
      input.addEventListener('blur', () => {
        this.touched.add(input.id);
        this.validateField(input.id);
      });
    });
  }
  
  // バリデーションルール登録
  addRule(fieldId: string, rules: ValidationRule[]) {
    this.fields.set(fieldId, rules);
  }
  
  // 単一フィールドバリデーション
  validateField(fieldId: string): boolean {
    const field = this.form.querySelector(`#${fieldId}`) as HTMLInputElement;
    if (!field) return false;
    
    const rules = this.fields.get(fieldId) || [];
    const errors: string[] = [];
    
    for (const rule of rules) {
      const result = rule.validate(field.value, field);
      if (!result.valid) {
        errors.push(result.message);
      }
    }
    
    if (errors.length > 0) {
      this.errors.set(fieldId, errors);
      this.showErrors(fieldId, errors);
      field.setAttribute('aria-invalid', 'true');
    } else {
      this.errors.delete(fieldId);
      this.clearErrors(fieldId);
      field.setAttribute('aria-invalid', 'false');
    }
    
    return errors.length === 0;
  }
  
  // 全フィールドバリデーション
  validateAll(): boolean {
    let isValid = true;
    
    this.fields.forEach((_, fieldId) => {
      this.touched.add(fieldId);
      if (!this.validateField(fieldId)) {
        isValid = false;
      }
    });
    
    if (!isValid) {
      this.announceErrors();
    }
    
    return isValid;
  }
  
  // エラー表示
  private showErrors(fieldId: string, errors: string[]) {
    const errorElement = document.querySelector(`#${fieldId}-error`);
    if (errorElement) {
      errorElement.textContent = errors[0];
      errorElement.classList.add('visible');
    }
    
    const field = document.querySelector(`#${fieldId}`);
    field?.classList.add('invalid');
  }
  
  // エラークリア
  private clearErrors(fieldId: string) {
    const errorElement = document.querySelector(`#${fieldId}-error`);
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.classList.remove('visible');
    }
    
    const field = document.querySelector(`#${fieldId}`);
    field?.classList.remove('invalid');
  }
  
  // スクリーンリーダー用エラーアナウンス
  private announceErrors() {
    const totalErrors = this.errors.size;
    if (totalErrors > 0) {
      const announcement = `フォームに${totalErrors}個のエラーがあります`;
      this.announce(announcement, 'assertive');
    }
  }
  
  private announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.className = 'sr-only';
    liveRegion.textContent = message;
    document.body.appendChild(liveRegion);
    
    setTimeout(() => {
      document.body.removeChild(liveRegion);
    }, 1000);
  }
  
  // フォーム送信
  private async submit() {
    const formData = new FormData(this.form);
    
    try {
      // 送信前処理
      this.form.classList.add('submitting');
      this.disableForm(true);
      
      const response = await fetch(this.form.action, {
        method: this.form.method || 'POST',
        body: formData,
      });
      
      if (response.ok) {
        this.announce('フォームが正常に送信されました', 'polite');
        this.form.reset();
        this.touched.clear();
        this.errors.clear();
      } else {
        throw new Error('送信に失敗しました');
      }
    } catch (error) {
      this.announce('エラーが発生しました。もう一度お試しください', 'assertive');
    } finally {
      this.form.classList.remove('submitting');
      this.disableForm(false);
    }
  }
  
  private disableForm(disabled: boolean) {
    const elements = this.form.querySelectorAll('input, button, select, textarea');
    elements.forEach(el => {
      (el as HTMLInputElement).disabled = disabled;
    });
  }
}

// バリデーションルール
interface ValidationRule {
  validate: (value: string, field: HTMLInputElement) => ValidationResult;
}

interface ValidationResult {
  valid: boolean;
  message: string;
}

// 共通バリデーションルール
const ValidationRules = {
  required: (message = '必須項目です'): ValidationRule => ({
    validate: (value) => ({
      valid: value.trim().length > 0,
      message,
    }),
  }),
  
  minLength: (length: number, message?: string): ValidationRule => ({
    validate: (value) => ({
      valid: value.length >= length,
      message: message || `${length}文字以上で入力してください`,
    }),
  }),
  
  maxLength: (length: number, message?: string): ValidationRule => ({
    validate: (value) => ({
      valid: value.length <= length,
      message: message || `${length}文字以下で入力してください`,
    }),
  }),
  
  pattern: (regex: RegExp, message: string): ValidationRule => ({
    validate: (value) => ({
      valid: regex.test(value),
      message,
    }),
  }),
  
  email: (message = '有効なメールアドレスを入力してください'): ValidationRule => ({
    validate: (value) => ({
      valid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      message,
    }),
  }),
  
  passwordStrength: (): ValidationRule => ({
    validate: (value) => {
      const hasLower = /[a-z]/.test(value);
      const hasUpper = /[A-Z]/.test(value);
      const hasNumber = /\d/.test(value);
      const hasSpecial = /[@$!%*?&]/.test(value);
      const isLongEnough = value.length >= 8;
      
      const strength = [hasLower, hasUpper, hasNumber, hasSpecial, isLongEnough]
        .filter(Boolean).length;
      
      if (strength < 3) {
        return {
          valid: false,
          message: 'パスワードが弱すぎます。大文字・小文字・数字・特殊文字を含めてください',
        };
      }
      
      return { valid: true, message: '' };
    },
  }),
  
  fileSize: (maxSize: number): ValidationRule => ({
    validate: (_, field) => {
      const files = (field as HTMLInputElement).files;
      if (!files || files.length === 0) return { valid: true, message: '' };
      
      const totalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
      const maxSizeMB = maxSize / (1024 * 1024);
      
      return {
        valid: totalSize <= maxSize,
        message: `ファイルサイズは${maxSizeMB}MB以下にしてください`,
      };
    },
  }),
  
  fileType: (acceptedTypes: string[]): ValidationRule => ({
    validate: (_, field) => {
      const files = (field as HTMLInputElement).files;
      if (!files || files.length === 0) return { valid: true, message: '' };
      
      const invalidFiles = Array.from(files).filter(
        file => !acceptedTypes.includes(file.type)
      );
      
      return {
        valid: invalidFiles.length === 0,
        message: `許可されているファイル形式: ${acceptedTypes.join(', ')}`,
      };
    },
  }),
};
```

### 3. 非同期バリデーションとデバウンス

```typescript
// 非同期バリデーションクラス
class AsyncValidator {
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private cache: Map<string, boolean> = new Map();
  
  // ユーザー名の重複チェック
  async checkUsername(username: string): Promise<ValidationResult> {
    // キャッシュチェック
    const cacheKey = `username:${username}`;
    if (this.cache.has(cacheKey)) {
      return {
        valid: this.cache.get(cacheKey)!,
        message: this.cache.get(cacheKey) ? '' : 'このユーザー名は既に使用されています',
      };
    }
    
    try {
      const response = await fetch(`/api/check-username?username=${encodeURIComponent(username)}`);
      const data = await response.json();
      
      this.cache.set(cacheKey, data.available);
      
      return {
        valid: data.available,
        message: data.available ? '' : 'このユーザー名は既に使用されています',
      };
    } catch (error) {
      return {
        valid: false,
        message: 'ユーザー名の確認中にエラーが発生しました',
      };
    }
  }
  
  // デバウンス付きバリデーション
  debounceValidate(
    fieldId: string,
    validator: () => Promise<ValidationResult>,
    delay: number = 500
  ): Promise<ValidationResult> {
    return new Promise((resolve) => {
      // 既存のタイマーをクリア
      const existingTimer = this.debounceTimers.get(fieldId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      // 新しいタイマーをセット
      const timer = setTimeout(async () => {
        const result = await validator();
        resolve(result);
        this.debounceTimers.delete(fieldId);
      }, delay);
      
      this.debounceTimers.set(fieldId, timer);
    });
  }
}

// 使用例
const asyncValidator = new AsyncValidator();
const usernameInput = document.getElementById('username') as HTMLInputElement;

usernameInput.addEventListener('input', async () => {
  const username = usernameInput.value;
  
  // ローディング表示
  const loader = document.getElementById('username-loader');
  if (loader) loader.classList.add('visible');
  
  // デバウンス付き非同期バリデーション
  const result = await asyncValidator.debounceValidate(
    'username',
    () => asyncValidator.checkUsername(username),
    500
  );
  
  // 結果表示
  if (loader) loader.classList.remove('visible');
  
  if (!result.valid) {
    showError('username', result.message);
  } else {
    clearError('username');
  }
});
```

## フォームUXパターン

### マルチステップフォーム

```typescript
// components/MultiStepForm.tsx
interface Step {
  id: string;
  title: string;
  fields: string[];
  validate: () => boolean;
}

class MultiStepForm {
  private currentStep: number = 0;
  private steps: Step[];
  private formData: Map<string, any> = new Map();
  
  constructor(steps: Step[]) {
    this.steps = steps;
    this.init();
  }
  
  private init() {
    this.renderStep();
    this.updateProgress();
    this.updateNavigation();
  }
  
  private renderStep() {
    const step = this.steps[this.currentStep];
    const container = document.getElementById('step-container');
    
    if (!container) return;
    
    // ステップのフィールドを表示
    container.innerHTML = '';
    step.fields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        container.appendChild(field.parentElement!);
      }
    });
    
    // ARIA更新
    container.setAttribute('aria-label', `ステップ ${this.currentStep + 1}: ${step.title}`);
  }
  
  private updateProgress() {
    const progress = ((this.currentStep + 1) / this.steps.length) * 100;
    const progressBar = document.querySelector('[role="progressbar"]');
    
    if (progressBar) {
      progressBar.setAttribute('aria-valuenow', progress.toString());
      progressBar.setAttribute('aria-valuetext', `${Math.round(progress)}% 完了`);
      (progressBar as HTMLElement).style.width = `${progress}%`;
    }
  }
  
  private updateNavigation() {
    const prevBtn = document.getElementById('prev-step') as HTMLButtonElement;
    const nextBtn = document.getElementById('next-step') as HTMLButtonElement;
    const submitBtn = document.getElementById('submit-form') as HTMLButtonElement;
    
    // 前へボタン
    if (prevBtn) {
      prevBtn.disabled = this.currentStep === 0;
      prevBtn.setAttribute('aria-disabled', (this.currentStep === 0).toString());
    }
    
    // 次へ/送信ボタン
    const isLastStep = this.currentStep === this.steps.length - 1;
    if (nextBtn) nextBtn.style.display = isLastStep ? 'none' : 'block';
    if (submitBtn) submitBtn.style.display = isLastStep ? 'block' : 'none';
  }
  
  async nextStep() {
    // 現在のステップをバリデーション
    if (!this.steps[this.currentStep].validate()) {
      this.announceError('このステップにエラーがあります');
      return;
    }
    
    // データを保存
    this.saveStepData();
    
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this.renderStep();
      this.updateProgress();
      this.updateNavigation();
      this.announceStepChange();
    }
  }
  
  prevStep() {
    if (this.currentStep > 0) {
      this.saveStepData();
      this.currentStep--;
      this.renderStep();
      this.updateProgress();
      this.updateNavigation();
      this.announceStepChange();
    }
  }
  
  private saveStepData() {
    const step = this.steps[this.currentStep];
    step.fields.forEach(fieldId => {
      const field = document.getElementById(fieldId) as HTMLInputElement;
      if (field) {
        this.formData.set(fieldId, field.value);
      }
    });
  }
  
  private announceStepChange() {
    const step = this.steps[this.currentStep];
    const announcement = `ステップ ${this.currentStep + 1} / ${this.steps.length}: ${step.title}`;
    
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.className = 'sr-only';
    liveRegion.textContent = announcement;
    document.body.appendChild(liveRegion);
    
    setTimeout(() => {
      document.body.removeChild(liveRegion);
    }, 1000);
  }
  
  private announceError(message: string) {
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('role', 'alert');
    liveRegion.setAttribute('aria-live', 'assertive');
    liveRegion.className = 'sr-only';
    liveRegion.textContent = message;
    document.body.appendChild(liveRegion);
    
    setTimeout(() => {
      document.body.removeChild(liveRegion);
    }, 3000);
  }
}
```

## ベストプラクティス

1. **プログレッシブエンハンスメント**: HTML5ネイティブ機能を基盤に
2. **アクセシビリティ**: ARIA属性、キーボード操作、エラーアナウンス
3. **バリデーション**: クライアント側とサーバー側の二重チェック
4. **UX最適化**: リアルタイムフィードバック、デバウンス、オートコンプリート
5. **パフォーマンス**: 非同期処理、キャッシング、遅延読み込み
6. **セキュリティ**: CSRF対策、XSS防止、入力サニタイゼーション
7. **モバイル対応**: タッチフレンドリー、適切な入力タイプ