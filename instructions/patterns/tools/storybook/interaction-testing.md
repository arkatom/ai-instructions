# Storybook インタラクションテスト

Play関数による自動テスト実装。

## 基本テスト

```typescript
import { within, userEvent, expect } from '@storybook/test';

export const LoginFlow: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // 入力フィールドを取得
    const email = canvas.getByLabelText('Email');
    const password = canvas.getByLabelText('Password');
    const submit = canvas.getByRole('button', { name: /login/i });
    
    // ユーザーアクションを実行
    await userEvent.type(email, 'user@example.com');
    await userEvent.type(password, 'password123');
    await userEvent.click(submit);
    
    // 結果を検証
    await expect(canvas.getByText('Welcome')).toBeInTheDocument();
  }
};
```

## 段階的テスト

```typescript
export const MultiStepForm: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    
    await step('Fill personal info', async () => {
      await userEvent.type(canvas.getByLabelText('Name'), 'John Doe');
      await userEvent.type(canvas.getByLabelText('Email'), 'john@example.com');
      await userEvent.click(canvas.getByText('Next'));
    });
    
    await step('Fill preferences', async () => {
      await userEvent.click(canvas.getByLabelText('Newsletter'));
      await userEvent.selectOptions(canvas.getByLabelText('Country'), 'US');
      await userEvent.click(canvas.getByText('Submit'));
    });
    
    await step('Verify completion', async () => {
      await expect(canvas.getByText('Registration complete')).toBeInTheDocument();
    });
  }
};
```

## フォームテスト

```typescript
export const FormValidation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // 空のフォーム送信
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }));
    
    // エラーメッセージ確認
    await expect(canvas.getByText('Email is required')).toBeInTheDocument();
    
    // 不正な入力
    await userEvent.type(canvas.getByLabelText('Email'), 'invalid-email');
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }));
    
    await expect(canvas.getByText('Invalid email format')).toBeInTheDocument();
  }
};
```

## ドラッグ&ドロップ

```typescript
export const DragAndDrop: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    const draggable = canvas.getByTestId('draggable-item');
    const dropZone = canvas.getByTestId('drop-zone');
    
    // ドラッグ&ドロップを実行
    await userEvent.dragAndDrop(draggable, dropZone);
    
    // 結果を確認
    await expect(dropZone).toContainElement(draggable);
  }
};
```

## 非同期処理

```typescript
export const AsyncData: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // データ読み込み開始
    await userEvent.click(canvas.getByText('Load Data'));
    
    // ローディング状態確認
    expect(canvas.getByText('Loading...')).toBeInTheDocument();
    
    // データ表示を待機
    await waitFor(() => {
      expect(canvas.getByText('Data loaded')).toBeInTheDocument();
    }, { timeout: 3000 });
  }
};
```

→ 詳細: [ビジュアルテスト](./visual-testing.md)