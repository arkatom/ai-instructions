import { join } from 'path';
import { FileUtils } from '../utils/file-utils';
import { BaseGenerator, GenerateFilesOptions, ToolConfig } from './base';

export class GitHubCopilotGenerator extends BaseGenerator {
  constructor() {
    const config: ToolConfig = {
      name: 'github-copilot',
      templateDir: 'github-copilot',
      outputStructure: {
        mainFile: 'copilot-instructions.md',
        directory: '.github'
      }
    };
    super(config);
  }

  async generateFiles(targetDir: string, options: GenerateFilesOptions = {}): Promise<void> {
    const force = options.force || false;
    
    try {
      const chalk = (await import('chalk')).default;
      console.log(chalk.blue('🤖 Generating GitHub Copilot instruction files...'));
    } catch (error) {
      console.log('🤖 Generating GitHub Copilot instruction files...');
    }
    
    // 2024年標準: .github/copilot-instructions.md に直接生成
    const githubTargetPath = join(targetDir, '.github');
    
    // メインインストラクションファイルを生成（言語対応版）
    const mainInstructionContent = await this.loadTemplate('main.md', options);
    const processedContent = this.replaceTemplateVariables(mainInstructionContent, options);
    await this.safeWriteFile(join(githubTargetPath, 'copilot-instructions.md'), processedContent, force, options);

    // 追加のインストラクションファイルをコピー（言語対応版）
    await this.safeCopyInstructionsDirectory(githubTargetPath, options, force);
    
    try {
      const chalk = (await import('chalk')).default;
      console.log(chalk.green('✅ GitHub Copilot template generation completed!'));
      console.log(chalk.yellow('📝 Using 2024 standard: .github/copilot-instructions.md'));
    } catch (error) {
      console.log('✅ GitHub Copilot template generation completed!');
      console.log('📝 Using 2024 standard: .github/copilot-instructions.md');
    }
  }

  /**
   * Language-aware additional instructions copying for GitHub Copilot (2024 standard)
   * Note: With 2024 standard, additional instructions are rare since main file is self-contained
   */
  private async safeCopyInstructionsDirectory(githubTargetPath: string, options: GenerateFilesOptions, force: boolean): Promise<void> {
    const lang = options.lang || 'en';
    
    try {
      // Try language-specific additional instructions directory
      const langInstructionsPath = join(this.templateDir, lang, 'instructions');
      if (await FileUtils.fileExists(langInstructionsPath)) {
        // Copy additional instruction files to .github/ directory
        await FileUtils.copyDirectory(langInstructionsPath, githubTargetPath);
        return;
      }
      
      // Fallback to English additional instructions
      if (lang !== 'en') {
        const enInstructionsPath = join(this.templateDir, 'en', 'instructions');
        if (await FileUtils.fileExists(enInstructionsPath)) {
          console.warn(`⚠️  Additional instructions directory not found for ${lang}, using English version`);
          await FileUtils.copyDirectory(enInstructionsPath, githubTargetPath);
          return;
        }
      }
      
      // Legacy fallback
      const legacyInstructionsPath = join(this.templateDir, 'instructions');
      if (await FileUtils.fileExists(legacyInstructionsPath)) {
        if (lang !== 'en') {
          console.warn(`⚠️  Using legacy additional instructions directory (no language support)`);
        }
        await FileUtils.copyDirectory(legacyInstructionsPath, githubTargetPath);
        return;
      }
      
      // No additional instructions found - this is normal for GitHub Copilot 2024 standard
      console.warn('No additional instructions directory found for GitHub Copilot');
    } catch (error) {
      console.warn('No additional instructions directory found for GitHub Copilot');
    }
  }
}