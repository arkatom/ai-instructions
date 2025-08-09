import { BaseGenerator, GenerateFilesOptions, ToolConfig } from './base';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { FileUtils } from '../utils/file-utils';
import { 
  ParallelGeneratorOperations
} from './parallel-generator';
import { SharedTemplateProcessor } from './shared-processor';

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
    const _force = options.force || false;
    
    // Cline generator started

    // Use shared template processor for consistent template loading
    const claudeContent = await SharedTemplateProcessor.loadAndProcessDynamicTemplate('main.md', 'cline', options);
    
    // Create .clinerules directory structure with specialized files
    await this.generateClineRuleFiles(outputDir, claudeContent, options);
    
    // Copy shared instructions directory using shared processor
    await SharedTemplateProcessor.copyInstructionsDirectory(outputDir, options.lang, options);
    
    // Cline generator completed
  }

  /**
   * Generate multiple markdown rule files for Cline using core templates
   */
  private async generateClineRuleFiles(
    outputDir: string,
    coreContent: string, 
    options: GenerateFilesOptions
  ): Promise<void> {
    // Create .clinerules directory
    const clinerulesDirPath = join(outputDir, '.clinerules');
    await mkdir(clinerulesDirPath, { recursive: true });
    
    // Define the rule files to generate with specialized content
    const ruleFiles = [
      { filename: '01-coding.md', title: 'Coding Rules and Standards', outputDirectory: clinerulesDirPath },
      { filename: '02-documentation.md', title: 'Documentation Guidelines', outputDirectory: clinerulesDirPath }
    ];

    // Generate all rule files in parallel for improved performance
    try {
      const stats = await ParallelGeneratorOperations.generateMultipleSpecializedFilesParallel(
        coreContent, 
        ruleFiles, 
        options
      );
      
      // Log performance improvement if enabled
      if (process.env.NODE_ENV === 'development') {
        console.warn(`🚀 Generated ${stats.totalTasks} Cline rule files in parallel (${stats.totalExecutionTimeMs.toFixed(2)}ms)`);
      }
      
      // Handle any failures
      if (stats.failedTasks > 0) {
        console.warn(`⚠️  ${stats.failedTasks} out of ${stats.totalTasks} Cline rule files failed to generate`);
      }
      
    } catch {
      // Fallback to sequential generation if parallel generation fails
      console.warn('⚠️  Parallel generation failed, falling back to sequential generation');
      await this.generateClineRuleFilesSequential(clinerulesDirPath, coreContent, options);
    }
  }

  /**
   * Fallback sequential generation for Cline rule files
   */
  private async generateClineRuleFilesSequential(
    clinerulesDirPath: string,
    coreContent: string, 
    options: GenerateFilesOptions
  ): Promise<void> {
    // Define the rule files to generate with specialized content
    const ruleFiles = [
      { filename: '01-coding.md', title: 'Coding Rules and Standards' },
      { filename: '02-documentation.md', title: 'Documentation Guidelines' }
    ];

    // Generate each rule file sequentially (original implementation)
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

  /**
   * Copy shared instructions directory using ClaudeGenerator's proven method
   */
  private async copySharedInstructions(outputDir: string, options: GenerateFilesOptions): Promise<void> {
    const lang = options.lang || 'en';
    
    try {
      // Use parallel operations for better performance
      const stats = await ParallelGeneratorOperations.copyInstructionsDirectoryParallel(
        outputDir, 
        lang, 
        options
      );
      
      // Log performance improvement if enabled
      if (process.env.NODE_ENV === 'development' && stats.totalTasks > 0) {
        console.warn(`🚀 Copied ${stats.totalTasks} instruction files in parallel (${stats.totalExecutionTimeMs.toFixed(2)}ms)`);
      }
      
      // Handle any failures
      if (stats.failedTasks > 0) {
        console.warn(`⚠️  ${stats.failedTasks} out of ${stats.totalTasks} instruction files failed to copy`);
      }
      
    } catch {
      // Fallback to original implementation
      console.warn('⚠️  Parallel copy failed, falling back to sequential copy');
      await this.copySharedInstructionsSequential(outputDir, options);
    }
  }

  /**
   * Fallback sequential copy for shared instructions
   */
  private async copySharedInstructionsSequential(outputDir: string, options: GenerateFilesOptions): Promise<void> {
    const lang = options.lang || 'en';
    const instructionsSourcePath = join(__dirname, '../../templates/instructions', lang);
    const instructionsTargetPath = join(outputDir, 'instructions');
    
    if (await FileUtils.fileExists(instructionsSourcePath)) {
      await FileUtils.copyDirectory(instructionsSourcePath, instructionsTargetPath);
    } else if (lang !== 'en') {
      // Fallback to English instructions
      const enInstructionsPath = join(__dirname, '../../templates/instructions/en');
      if (await FileUtils.fileExists(enInstructionsPath)) {
        console.warn(`⚠️  Instructions directory not found for ${lang}, using English version`);
        await FileUtils.copyDirectory(enInstructionsPath, instructionsTargetPath);
      }
    }
  }
}