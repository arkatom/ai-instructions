import { join } from 'path';
import { FileUtils } from '../utils/file-utils';
import { BaseGenerator, GenerateFilesOptions, ToolConfig } from './base';

export class CursorGenerator extends BaseGenerator {
  constructor() {
    const config: ToolConfig = {
      name: 'cursor',
      templateDir: 'core',
      outputStructure: {
        directory: '.cursor/rules'
      }
    };
    super(config);
  }

  async generateFiles(targetDir: string, options: GenerateFilesOptions = {}): Promise<void> {
    const _force = options.force || false;
    
    // Cursor generator started

    // Use ClaudeGenerator with CURSOR output format for proper conversion
    const { ClaudeGenerator } = await import('./claude');
    const { OutputFormat } = await import('../converters');
    
    const claudeGenerator = new ClaudeGenerator();
    await claudeGenerator.generateFiles(targetDir, {
      ...options,
      outputFormat: OutputFormat.CURSOR
    });

    // Cursor generator completed
  }

  /**
   * Language-aware rules directory copying for Cursor
   */
  private async safeCopyRulesDirectory(rulesTargetPath: string, options: GenerateFilesOptions, _force: boolean): Promise<void> {
    const lang = options.lang || 'en';
    
    try {
      // Try language-specific rules directory first
      const langRulesPath = join(this.templateDir, lang, 'rules');
      if (await FileUtils.fileExists(langRulesPath)) {
        await FileUtils.copyDirectory(langRulesPath, rulesTargetPath);
        return;
      }
      
      // Fallback to English rules
      if (lang !== 'en') {
        const enRulesPath = join(this.templateDir, 'en', 'rules');
        if (await FileUtils.fileExists(enRulesPath)) {
          console.warn(`⚠️  Rules directory not found for ${lang}, using English version`);
          await FileUtils.copyDirectory(enRulesPath, rulesTargetPath);
          return;
        }
      }
      
      // Legacy fallback
      const legacyRulesPath = join(this.templateDir, 'rules');
      if (await FileUtils.fileExists(legacyRulesPath)) {
        if (lang !== 'en') {
          console.warn(`⚠️  Using legacy rules directory (no language support yet)`);
        }
        await FileUtils.copyDirectory(legacyRulesPath, rulesTargetPath);
        return;
      }
      
      // No rules directory found - this is normal for Cursor
      console.warn('No additional rules directory found for Cursor');
    } catch {
      console.warn('No additional rules directory found for Cursor');
    }
  }
}