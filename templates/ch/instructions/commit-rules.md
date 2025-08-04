# 提交约定

## 提交消息约定

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
- **域标签**: `[domain:xxx]` (feat/fix时必需)
- **AI标签**: `[tags:xxx,yyy]` (为提高搜索性推荐)
- **统一术语**: 禁止缩写，遵循domain-terms.md

## 提交步骤(必须)

- 用git status确认变更点
- 用git add ...以保持适当上下文的粒度进行暂存
- 用git commit -m "..."提交

## 提交粒度原则(必须)

- 尽可能使提交粒度小
- 以"出现问题时想回到这里！"的单位提交
- 以事后回顾时能明白"变更意图和目的"的单位提交（写在提交消息中）
- 以正常运行的单位提交（避免回滚后损坏的情况）