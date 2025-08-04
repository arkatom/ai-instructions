# 検索パターン集

## 基本検索コマンド

### ドメイン別検索

```bash
git log --grep="\[domain:authentication\]" --oneline
git log --grep="\[domain:user\]" --oneline
git log --grep="\[domain:session\]" --oneline
git log --grep="\[domain:agent\]" --oneline
```

### 機能別検索

```bash
git log --grep="\[tags:.*login.*\]" --oneline
git log --grep="\[tags:.*jwt.*\]" --oneline
git log --grep="\[tags:.*timeout.*\]" --oneline
```

### 問題調査

```bash
git log --grep="fix.*\[domain:.*\]" --oneline        # バグ修正履歴
git log --grep="feat.*\[domain:.*\]" --oneline       # 機能追加履歴
```

## シナリオ別検索

### バグ調査時

```bash
# 1. エラーメッセージから関連ドメインを特定
# 2. そのドメインの最近の変更を確認
git log --grep="\[domain:DOMAIN_NAME\]" --since="1 week ago"

# 3. 関連するfixコミットを調査
git log --grep="fix.*\[domain:DOMAIN_NAME\]" --oneline
```

### 機能追加時

```bash
# 1. 類似機能の実装を確認
git log --grep="\[tags:.*FEATURE_NAME.*\]" --oneline

# 2. 関連ドメインの設計パターンを確認
git log --grep="\[domain:DOMAIN_NAME\]" --oneline
```
