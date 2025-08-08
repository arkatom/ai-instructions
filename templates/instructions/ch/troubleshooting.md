# 故障排除

## 搜索无结果的情况

### 1. 检查表记差异

- 确认是否使用了缩写
- 使用domain-terms.md的统一术语

### 2. 用同义词搜索

```bash
# authentication相关
git log --grep="\[tags:.*login.*\]" --oneline
git log --grep="\[tags:.*jwt.*\]" --oneline
git log --grep="\[tags:.*auth.*\]" --oneline  # 用于旧提交
```

### 3. 用文件路径搜索

```bash
git log --name-only | grep auth
git log -- "src/auth/*"
```

### 4. 扩大时期范围

```bash
git log --grep="\[domain:authentication\]" --since="1 month ago"
git log --grep="\[domain:authentication\]" --since="3 months ago"
```

## 找不到相关信息的情况

### 1. 用上位领域搜索

过于具体的情况下提高抽象度

```bash
# 具体 → 抽象
git log --grep="\[domain:jwt\]"           # 无
git log --grep="\[domain:authentication\]" # 有
```

### 2. 跨领域搜索

跨越多个领域的情况

```bash
git log --grep="\[domain:user\].*\[domain:session\]"
```

### 3. 从Issue编号追踪

从相关Issue顺藤摸瓜

```bash
git log --grep="#123"
```