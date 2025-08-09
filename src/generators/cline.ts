import { BaseGenerator, GenerateFilesOptions, ToolConfig } from './base';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { FileUtils } from '../utils/file-utils';

/**
 * Cline AI tool generator (Issue #23)
 * Generates .clinerules directory with multiple markdown files
 * 
 * Cline uses a directory-based approach with multiple specialized files:
 * - 01-coding.md: Core development rules
 * - 02-documentation.md: Documentation standards
 * - 03-testing.md: Testing guidelines
 * - project-specific rules files
 */
export class ClineGenerator extends BaseGenerator {
  constructor() {
    const config: ToolConfig = {
      name: 'cline',
      templateDir: 'cline',
      outputStructure: {
        directory: '.clinerules'
      }
    };
    super(config);
  }

  /**
   * Get the display name for this generator
   */
  getToolName(): string {
    return 'Cline';
  }

  /**
   * Generate Cline configuration files
   * Creates .clinerules directory with multiple markdown files
   */
  async generateFiles(outputDir: string, options: GenerateFilesOptions = {}): Promise<void> {
    const { 
      projectName: _projectName = '',
      lang = 'en',
      force: _force = false
    } = options;

    // Validate language support
    const supportedLanguages = ['en', 'ja', 'ch'];
    if (!supportedLanguages.includes(lang)) {
      throw new Error(`Unsupported language: ${lang}. Supported languages: ${supportedLanguages.join(', ')}`);
    }

    // Create .clinerules directory
    const clinerulesDirPath = join(outputDir, '.clinerules');
    await mkdir(clinerulesDirPath, { recursive: true });

    // Copy instructions directory (shared across all tools) - using Claude's method
    const instructionsSourcePath = join(__dirname, '../../templates/instructions', lang);
    const instructionsTargetPath = join(outputDir, 'instructions');
    
    if (await FileUtils.fileExists(instructionsSourcePath)) {
      await FileUtils.copyDirectory(instructionsSourcePath, instructionsTargetPath);
    }

    // Generate multiple Cline rule files using core templates
    await this.generateClineRuleFiles(clinerulesDirPath, options);
  }

  /**
   * Generate multiple markdown rule files for Cline using core templates
   */
  private async generateClineRuleFiles(
    clinerulesDirPath: string, 
    options: GenerateFilesOptions
  ): Promise<void> {
    // Load core template content
    const coreContent = await this.loadDynamicTemplate('main.md', options);
    
    // Define the rule files to generate with specialized content
    const ruleFiles = [
      { filename: '01-coding.md', title: 'Coding Rules and Standards' },
      { filename: '02-documentation.md', title: 'Documentation Guidelines' }
    ];

    // Generate each rule file with core content
    for (const ruleFile of ruleFiles) {
      const specializedContent = this.createSpecializedContent(coreContent, ruleFile.title);
      const outputPath = join(clinerulesDirPath, ruleFile.filename);
      await this.safeWriteFile(outputPath, specializedContent, options.force || false, options);
    }
  }

  /**
   * Create specialized content for Cline rule files
   */
  private createSpecializedContent(coreContent: string, title: string): string {
    // Add Cline-specific header and maintain core content
    const clineHeader = `# ${title} - Cline Integration

This file contains the core development instructions optimized for Cline AI.

---

`;
    
    return clineHeader + coreContent;
  }
}