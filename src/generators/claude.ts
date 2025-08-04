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
    
    // CLAUDE.md をコピー（言語対応版で変数置換付き）
    const claudeContent = await this.loadTemplate('CLAUDE.md', options);
    const processedClaudeContent = this.replaceTemplateVariables(claudeContent, options);
    const claudePath = join(targetDir, 'CLAUDE.md');
    
    await this.safeWriteFile(claudePath, processedClaudeContent, force);

    // instructions/ ディレクトリをコピー（言語対応版で）
    await this.safeCopyInstructionsDirectory(targetDir, options, force);
    
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

  /**
   * Language-aware instructions directory copying (Issue #19: Templates restructure)
   * Uses templates/shared/instructions/(lang)/ structure
   */
  private async safeCopyInstructionsDirectory(targetDir: string, options: GenerateFilesOptions, force: boolean): Promise<void> {
    const lang = options.lang || 'en';
    const instructionsTargetPath = join(targetDir, 'instructions');
    
    try {
      // NEW: Try shared language-specific instructions directory first (templates/shared/instructions/(lang)/)
      const sharedInstructionsPath = join(__dirname, '../../templates/shared/instructions', lang);
      if (await FileUtils.fileExists(sharedInstructionsPath)) {
        await this.safeCopyDirectory(sharedInstructionsPath, instructionsTargetPath, force);
        return;
      }
      
      // Fallback to English shared instructions
      if (lang !== 'en') {
        const enSharedInstructionsPath = join(__dirname, '../../templates/shared/instructions/en');
        if (await FileUtils.fileExists(enSharedInstructionsPath)) {
          console.warn(`⚠️  Shared instructions directory not found for ${lang}, using English version`);
          await this.safeCopyDirectory(enSharedInstructionsPath, instructionsTargetPath, force);
          return;
        }
      }
      
      // Legacy fallback: Try tool-specific instructions directory (templates/claude/(lang)/instructions/)
      const legacyLangInstructionsPath = join(this.templateDir, lang, 'instructions');
      if (await FileUtils.fileExists(legacyLangInstructionsPath)) {
        console.warn(`⚠️  Using legacy tool-specific instructions directory for ${lang}`);
        await this.safeCopyDirectory(legacyLangInstructionsPath, instructionsTargetPath, force);
        return;
      }
      
      // Final fallback: Legacy structure without language support
      const legacyInstructionsPath = join(this.templateDir, 'instructions');
      if (await FileUtils.fileExists(legacyInstructionsPath)) {
        console.warn(`⚠️  Using legacy instructions directory (no language support)`);
        await this.safeCopyDirectory(legacyInstructionsPath, instructionsTargetPath, force);
        return;
      }
      
      throw new Error(`Instructions directory not found for language ${lang}`);
    } catch (error) {
      throw new Error(`Failed to copy instructions directory: ${error}`);
    }
  }
}