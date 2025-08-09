import { join } from 'path';
import { FileUtils } from '../utils/file-utils';
import { BaseGenerator, GenerateFilesOptions, ToolConfig } from './base';

export class GitHubCopilotGenerator extends BaseGenerator {
  constructor() {
    const config: ToolConfig = {
      name: 'github-copilot',
      templateDir: 'core',
      outputStructure: {
        mainFile: 'copilot-instructions.md',
        directory: '.github'
      }
    };
    super(config);
  }

  async generateFiles(targetDir: string, options: GenerateFilesOptions = {}): Promise<void> {
    const _force = options.force || false;
    
    // GitHub Copilot generator started

    // Use ClaudeGenerator with COPILOT output format for proper conversion
    const { ClaudeGenerator } = await import('./claude');
    const { OutputFormat } = await import('../converters');
    
    const claudeGenerator = new ClaudeGenerator();
    await claudeGenerator.generateFiles(targetDir, {
      ...options,
      outputFormat: OutputFormat.COPILOT
    });

    // GitHub Copilot generator completed
  }

  /**
   * Language-aware additional instructions copying for GitHub Copilot (2024 standard)
   * Note: With 2024 standard, additional instructions are rare since main file is self-contained
   */
  private async safeCopyInstructionsDirectory(githubTargetPath: string, options: GenerateFilesOptions, _force: boolean): Promise<void> {
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
    } catch {
      console.warn('No additional instructions directory found for GitHub Copilot');
    }
  }
}