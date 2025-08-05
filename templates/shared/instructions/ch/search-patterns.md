# 搜索模式集

## 基本搜索命令

### 领域别搜索

```bash
git log --grep="\[domain:authentication\]" --oneline
git log --grep="\[domain:user\]" --oneline
git log --grep="\[domain:session\]" --oneline
git log --grep="\[domain:agent\]" --oneline
```

### 功能别搜索

```bash
git log --grep="\[tags:.*login.*\]" --oneline
git log --grep="\[tags:.*jwt.*\]" --oneline
git log --grep="\[tags:.*timeout.*\]" --oneline
```

### 问题调查

```bash
git log --grep="fix.*\[domain:.*\]" --oneline        # Bug修复历史
git log --grep="feat.*\[domain:.*\]" --oneline       # 功能追加历史
```

## 场景别搜索

### Bug调查时

```bash
# 1. 从错误消息特定相关领域
# 2. 确认该领域的最近变更
git log --grep="\[domain:DOMAIN_NAME\]" --since="1 week ago"

# 3. 调查相关的fix提交
git log --grep="fix.*\[domain:DOMAIN_NAME\]" --oneline
```

### 功能追加时

```bash
# 1. 确认类似功能的实现
git log --grep="\[tags:.*FEATURE_NAME.*\]" --oneline

# 2. 确认相关领域的设计模式
git log --grep="\[domain:DOMAIN_NAME\]" --oneline
```