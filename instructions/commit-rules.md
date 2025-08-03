# コミット規約

## コミットメッセージ規約

### 基本形式

```
type(scope): #issue description [domain:xxx] [tags:keyword1,keyword2]
```

### 例

```bash
feat(authentication): #123 implement JWT user authentication [domain:authentication] [tags:jwt,login,session]
fix(session): #456 resolve session timeout issue [domain:session] [tags:timeout,cleanup]
refactor(user): #789 extract user profile service [domain:user] [tags:service,extraction]
```

### 必須要素

- **Issue番号**: 自動挿入される
- **ドメインタグ**: `[domain:xxx]` (feat/fixで必須)
- **AIタグ**: `[tags:xxx,yyy]` (検索性向上のため推奨)
- **統一用語**: 略語禁止、domain-terms.mdに従う

## コミット手順(MUST)

- git status で変更点を確認
- git add ... で、適切な文脈を保った粒度でステージング
- git commit -m "..." でコミット

## コミット粒度の原則(MUST)

- 可能な限りコミット粒度は小さくする
- 何かあったらここまで戻りたい！という単位でコミット
- あとから振り返ったときに「変更の意図や目的」がわかる単位でコミット（コミットメッセージに書く）
- 正常に動く単位でコミット（ロールバックしたら壊れた！とならないために）
