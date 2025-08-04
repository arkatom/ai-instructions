import { join } from 'path';
import { readdir, stat, readFile } from 'fs/promises';
import { FileUtils } from '../utils/file-utils';
import { BaseGenerator, GenerateFilesOptions, ToolConfig } from './base';

export class ClaudeGenerator extends BaseGenerator {
  constructor() {
    const config: ToolConfig = {
      name: 'claude',
      templateDir: 'claude',
      outputStructure: {
        mainFile: 'CLAUDE.md',
        directory: 'instructions'
      }
    };
    super(config);
  }

  async generateFiles(targetDir: string, options: GenerateFilesOptions = {}): Promise<void> {
    const force = options.force || false;
    
    // 🚨 EMERGENCY PATCH v0.2.1: Safe file generation with warnings
    try {
      const chalk = (await import('chalk')).default;
      console.log(chalk.blue('🤖 Generating Claude AI instruction files...'));
    } catch (error) {
      console.log('🤖 Generating Claude AI instruction files...');
    }
    
    // CLAUDE.md をコピー（安全な方式で変数置換付き）
    const claudeContent = await this.loadTemplate('CLAUDE.md');
    const processedClaudeContent = this.replaceTemplateVariables(claudeContent, options);
    const claudePath = join(targetDir, 'CLAUDE.md');
    
    await this.safeWriteFile(claudePath, processedClaudeContent, force);

    // instructions/ ディレクトリをコピー（安全な方式で）
    const instructionsSourcePath = join(this.templateDir, 'instructions');
    const instructionsTargetPath = join(targetDir, 'instructions');
    await this.safeCopyDirectory(instructionsSourcePath, instructionsTargetPath, force);
    
    try {
      const chalk = (await import('chalk')).default;
      console.log(chalk.green('✅ Claude template generation completed!'));
      console.log(chalk.yellow('💡 For safer conflict resolution, upgrade to v0.3.0 when available'));
    } catch (error) {
      console.log('✅ Claude template generation completed!');
      console.log('💡 For safer conflict resolution, upgrade to v0.3.0 when available');
    }
  }

  /**
   * 🚨 EMERGENCY PATCH v0.2.1: Safe directory copying with conflict warnings
   */
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