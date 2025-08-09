# トラブルシューティング

## 検索でヒットしない場合

### 1. 表記揺れをチェック

- 略語が使われていないか確認
- domain-terms.mdの統一用語を使用

### 2. 類義語で検索

```bash
# authentication関連
git log --grep="\[tags:.*login.*\]" --oneline
git log --grep="\[tags:.*jwt.*\]" --oneline
git log --grep="\[tags:.*auth.*\]" --oneline  # 古いコミット用
```

### 3. ファイルパスで検索

```bash
git log --name-only | grep auth
git log -- "src/auth/*"
```

### 4. 時期を広げる

```bash
git log --grep="\[domain:authentication\]" --since="1 month ago"
git log --grep="\[domain:authentication\]" --since="3 months ago"
```

## 関連情報が見つからない場合

### 1. 上位ドメインで検索

具体的すぎる場合は抽象度を上げる

```bash
# 具体的 → 抽象的
git log --grep="\[domain:jwt\]"           # なし
git log --grep="\[domain:authentication\]" # あり
```

### 2. クロスドメイン検索

複数ドメインにまたがる場合

```bash
git log --grep="\[domain:user\].*\[domain:session\]"
```

### 3. Issue番号から追跡

関連するIssueから芋づる式に

```bash
git log --grep="#123"
```
