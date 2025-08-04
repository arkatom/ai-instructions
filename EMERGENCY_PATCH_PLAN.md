# 🚨 Emergency Patch v0.2.1 - File Safety Implementation Plan

## 緊急度: CRITICAL (P0)
**対象:** ユーザーデータ保護のための緊急措置
**影響:** 既存の危険な無条件上書き動作に対する安全装置追加

---

## Phase 0: 緊急パッチ v0.2.1 実装内容

### 1. 危険操作警告システム追加

#### A. FileUtils 改修
**対象ファイル:** `src/utils/file-utils.ts`

```typescript
import { existsSync } from 'fs';
import chalk from 'chalk';

export class FileUtils {
  /**
   * 緊急パッチ: 既存ファイル存在時の警告表示
   */
  static async checkFileExists(filePath: string): Promise<boolean> {
    return existsSync(filePath);
  }

  static async writeFileContentWithWarning(filePath: string, content: string, force: boolean = false): Promise<void> {
    const fileExists = await this.checkFileExists(filePath);
    
    if (fileExists && !force) {
      console.log(chalk.red('⚠️  WARNING: File already exists and will be OVERWRITTEN!'));
      console.log(chalk.red(`📄 Target: ${filePath}`));
      console.log(chalk.yellow('💡 Use --force flag to suppress this warning'));
      console.log(chalk.yellow('💡 Or wait for v0.3.0 for interactive conflict resolution'));
      console.log('');
    }
    
    const dirPath = join(filePath, '..');
    await this.ensureDirectory(dirPath);
    await writeFile(filePath, content, 'utf-8');
    
    if (fileExists) {
      console.log(chalk.green(`✅ File overwritten: ${filePath}`));
    } else {
      console.log(chalk.green(`✅ File created: ${filePath}`));
    }
  }
}
```

#### B. CLI オプション追加
**対象ファイル:** `src/cli.ts`

```typescript
program
  .command('init')
  .description('Initialize AI development instructions')
  .option('-o, --output <path>', 'output directory', process.cwd())
  .option('-n, --project-name <name>', 'project name', 'my-project')
  .option('-t, --tool <tool>', 'AI tool (claude, github-copilot, cursor)', 'claude')
  .option('--force', '⚠️  Force overwrite existing files (DANGEROUS)')
  .option('--preview', '🔍 Preview what files would be created/modified')
  .action(async (options) => {
    try {
      // バリデーション処理...
      
      if (options.preview) {
        await previewGeneration(options);
        return;
      }
      
      const generator = GeneratorFactory.createGenerator(options.tool as SupportedTool);
      await generator.generateFiles(options.output, { 
        projectName: options.projectName,
        force: options.force || false  // 新規オプション
      });
      
      // 成功メッセージ...
    } catch (error) {
      // エラーハンドリング...
    }
  });
```

### 2. Generator クラス改修

#### A. BaseGenerator インターフェース拡張
**対象ファイル:** `src/generators/base.ts`

```typescript
export interface GenerateFilesOptions {
  projectName?: string;
  force?: boolean;          // 新規: 強制上書きフラグ
}

export abstract class BaseGenerator {
  // ... 既存コード

  /**
   * 緊急パッチ: 安全な ファイル書き込み
   */
  protected async safeWriteFile(targetPath: string, content: string, force: boolean = false): Promise<void> {
    await FileUtils.writeFileContentWithWarning(targetPath, content, force);
  }
}
```

#### B. ClaudeGenerator 改修
**対象ファイル:** `src/generators/claude.ts`

```typescript
export class ClaudeGenerator extends BaseGenerator {
  async generateFiles(targetDir: string, options: GenerateFilesOptions = {}): Promise<void> {
    const force = options.force || false;
    
    // 緊急パッチ: 警告付きファイル作成
    console.log(chalk.blue('🤖 Generating Claude AI instruction files...'));
    
    // CLAUDE.md をコピー（警告付き）
    const claudeContent = await this.loadTemplate('CLAUDE.md');
    const processedClaudeContent = this.replaceTemplateVariables(claudeContent, options);
    const claudePath = join(targetDir, 'CLAUDE.md');
    
    await this.safeWriteFile(claudePath, processedClaudeContent, force);

    // instructions/ ディレクトリをコピー（警告付き）
    const instructionsSourcePath = join(this.templateDir, 'instructions');
    const instructionsTargetPath = join(targetDir, 'instructions');
    await this.safeCopyDirectory(instructionsSourcePath, instructionsTargetPath, force);
    
    console.log(chalk.green('✅ Claude template generation completed!'));
    console.log(chalk.yellow('💡 For safer conflict resolution, upgrade to v0.3.0 when available'));
  }

  private async safeCopyDirectory(sourcePath: string, targetPath: string, force: boolean): Promise<void> {
    await FileUtils.ensureDirectory(targetPath);
    
    const items = await readdir(sourcePath);
    
    for (const item of items) {
      const sourceItemPath = join(sourcePath, item);
      const targetItemPath = join(targetPath, item);
      
      const itemStat = await stat(sourceItemPath);
      
      if (itemStat.isDirectory()) {
        await this.safeCopyDirectory(sourceItemPath, targetItemPath, force);
      } else {
        const content = await readFile(sourceItemPath, 'utf-8');
        await this.safeWriteFile(targetItemPath, content, force);
      }
    }
  }
}
```

### 3. プレビュー機能実装

#### A. Preview機能追加
**新規ファイル:** `src/utils/preview-utils.ts`

```typescript
import { existsSync, statSync } from 'fs';
import chalk from 'chalk';

export interface PreviewItem {
  path: string;
  action: 'create' | 'overwrite';
  size?: number;
  lastModified?: Date;
}

export class PreviewUtils {
  static async analyzeFileChanges(targetDir: string, filesToGenerate: string[]): Promise<PreviewItem[]> {
    const items: PreviewItem[] = [];
    
    for (const filePath of filesToGenerate) {
      const fullPath = join(targetDir, filePath);
      
      if (existsSync(fullPath)) {
        const stats = statSync(fullPath);
        items.push({
          path: filePath,
          action: 'overwrite',
          size: stats.size,
          lastModified: stats.mtime
        });
      } else {
        items.push({
          path: filePath,
          action: 'create'
        });
      }
    }
    
    return items;
  }

  static displayPreview(items: PreviewItem[]): void {
    console.log(chalk.blue('🔍 Preview: Files that would be affected:'));
    console.log('');
    
    const createItems = items.filter(item => item.action === 'create');
    const overwriteItems = items.filter(item => item.action === 'overwrite');
    
    if (createItems.length > 0) {
      console.log(chalk.green('📝 Files to be created:'));
      createItems.forEach(item => {
        console.log(chalk.green(`  ✅ ${item.path}`));
      });
      console.log('');
    }
    
    if (overwriteItems.length > 0) {
      console.log(chalk.red('⚠️  Files to be OVERWRITTEN:'));
      overwriteItems.forEach(item => {
        console.log(chalk.red(`  💥 ${item.path} (${item.size} bytes, modified ${item.lastModified?.toLocaleString()})`));
      });
      console.log('');
      console.log(chalk.yellow('💡 Use --force to proceed with overwriting'));
      console.log(chalk.yellow('💡 Or wait for v0.3.0 for interactive conflict resolution'));
    }
  }
}
```

### 4. package.json 更新

```json
{
  "version": "0.2.1",
  "dependencies": {
    "chalk": "^4.1.2",
    "commander": "^14.0.0",
    "fs-extra": "^11.3.0",
    "inquirer": "^12.9.0",
    "ora": "^8.2.0"
  }
}
```

### 5. README 緊急更新

```markdown
## ⚠️ Important Safety Notice (v0.2.1)

**CAUTION:** This tool will overwrite existing files without confirmation.

### Safe Usage
```bash
# Preview changes before applying
ai-instructions init --preview

# Force overwrite (use with caution)
ai-instructions init --force

# Default behavior now shows warnings
ai-instructions init  # Will show warnings for existing files
```

### Upcoming Improvements
- **v0.3.0**: Interactive conflict resolution
- Safe merge options
- Backup creation
- Intelligent conflict handling
```

---

## 実装スケジュール

### 即日対応（本日中）
- [ ] FileUtils 警告システム実装
- [ ] CLI オプション追加（--force, --preview）
- [ ] ClaudeGenerator 安全化改修
- [ ] 基本テスト追加

### 明日対応
- [ ] 他Generator（cursor, github-copilot）安全化
- [ ] プレビュー機能完成
- [ ] 包括的テスト実装
- [ ] README 更新

### 2日後リリース
- [ ] v0.2.1 パッケージング
- [ ] npm publish
- [ ] GitHub Release作成
- [ ] Issue #16 更新

---

## テスト戦略

### 緊急テストケース
1. **既存ファイルなし**: 正常作成動作確認
2. **既存ファイルあり + --force無し**: 警告表示確認
3. **既存ファイルあり + --force有り**: 上書き動作確認
4. **--preview オプション**: プレビュー表示確認

### 回帰テスト
- 既存の全テストケースが通過することを確認
- 新機能が既存機能を破壊しないことを確認

---

**適当度評価: 1/10** - 最重要安全機能として完璧に設計