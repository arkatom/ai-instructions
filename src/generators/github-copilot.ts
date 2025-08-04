import { join } from 'path';
import { FileUtils } from '../utils/file-utils';
import { BaseGenerator, GenerateFilesOptions, ToolConfig } from './base';

export class GitHubCopilotGenerator extends BaseGenerator {
  constructor() {
    const config: ToolConfig = {
      name: 'github-copilot',
      templateDir: 'github-copilot',
      outputStructure: {
        directory: '.github/instructions'
      }
    };
    super(config);
  }

  async generateFiles(targetDir: string, options: GenerateFilesOptions = {}): Promise<void> {
    const force = options.force || false;
    
    // .github/instructions/ ディレクトリを作成
    const instructionsTargetPath = join(targetDir, '.github', 'instructions');
    
    // メインインストラクションファイルを生成（言語対応版）
    const mainInstructionContent = await this.loadTemplate('main.md', options);
    const processedContent = this.replaceTemplateVariables(mainInstructionContent, options);
    await this.safeWriteFile(join(instructionsTargetPath, 'main.md'), processedContent, force);

    // 追加のインストラクションファイルをコピー（言語対応版）
    await this.safeCopyInstructionsDirectory(instructionsTargetPath, options, force);
  }

  /**
   * Language-aware instructions directory copying for GitHub Copilot
   */
  private async safeCopyInstructionsDirectory(instructionsTargetPath: string, options: GenerateFilesOptions, force: boolean): Promise<void> {
    const lang = options.lang || 'en';
    
    try {
      // Try language-specific instructions directory first
      const langInstructionsPath = join(this.templateDir, lang, 'instructions');
      if (await FileUtils.fileExists(langInstructionsPath)) {
        await FileUtils.copyDirectory(langInstructionsPath, instructionsTargetPath);
        return;
      }
      
      // Fallback to English instructions
      if (lang !== 'en') {
        const enInstructionsPath = join(this.templateDir, 'en', 'instructions');
        if (await FileUtils.fileExists(enInstructionsPath)) {
          console.warn(`⚠️  Instructions directory not found for ${lang}, using English version`);
          await FileUtils.copyDirectory(enInstructionsPath, instructionsTargetPath);
          return;
        }
      }
      
      // Legacy fallback
      const legacyInstructionsPath = join(this.templateDir, 'instructions');
      if (await FileUtils.fileExists(legacyInstructionsPath)) {
        if (lang !== 'en') {
          console.warn(`⚠️  Using legacy instructions directory (no language support yet)`);
        }
        await FileUtils.copyDirectory(legacyInstructionsPath, instructionsTargetPath);
        return;
      }
      
      // No instructions directory found - this is normal for GitHub Copilot
      console.warn('No additional instructions directory found for GitHub Copilot');
    } catch (error) {
      console.warn('No additional instructions directory found for GitHub Copilot');
    }
  }
}