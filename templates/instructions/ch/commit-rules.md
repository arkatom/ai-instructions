# 提交规约

## 提交消息规约

### 基本格式

```
type(scope): #issue description [domain:xxx] [tags:keyword1,keyword2]
```

### 示例

```bash
feat(authentication): #123 implement JWT user authentication [domain:authentication] [tags:jwt,login,session]
fix(session): #456 resolve session timeout issue [domain:session] [tags:timeout,cleanup]
refactor(user): #789 extract user profile service [domain:user] [tags:service,extraction]
```

### 必需要素

- **Issue编号**: 自动插入
- **领域标签**: `[domain:xxx]` (feat/fix时必须)
- **AI标签**: `[tags:xxx,yyy]` (推荐用于提高可搜索性)
- **统一术语**: 禁止缩写，遵循domain-terms.md

## 提交步骤(必须)

- git status 确认变更点
- git add ... 以适当的上下文保持粒度进行暂存
- git commit -m "..." 进行提交

## 提交粒度原则(必须)

- 尽可能使提交粒度小
- 以"出了问题想回到这里！"的单位进行提交
- 以事后回顾时能理解"变更意图和目的"的单位进行提交（写在提交消息中）
- 以正常运行的单位进行提交（避免回滚后损坏的情况）