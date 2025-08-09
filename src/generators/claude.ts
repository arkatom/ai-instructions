import { join } from 'path';
import { readdir, stat, readFile } from 'fs/promises';
import { FileUtils } from '../utils/file-utils';
import { BaseGenerator, GenerateFilesOptions, ToolConfig } from './base';
import { ConverterFactory, OutputFormat, ConversionMetadata } from '../converters';
import { 
  ParallelGeneratorOperations
} from './parallel-generator';

export class ClaudeGenerator extends BaseGenerator {
  constructor() {
    const config: ToolConfig = {
      name: 'claude',
      templateDir: 'core',
      outputStructure: {
        mainFile: 'CLAUDE.md',
        directory: 'instructions'
      }
    };
    super(config);
  }

  async generateFiles(targetDir: string, options: GenerateFilesOptions = {}): Promise<void> {
    const force = options.force || false;
    const outputFormat = options.outputFormat || OutputFormat.CLAUDE;
    const _projectName = options.projectName || 'ai-project';
    
    // 🚨 EMERGENCY PATCH v0.2.1: Safe file generation with warnings
    // Generator started

    // Generate CLAUDE.md content first (always the source format)
    const claudeContent = await this.loadDynamicTemplate('main.md', options);
    
    if (outputFormat === OutputFormat.CLAUDE) {
      // Standard Claude format generation
      const claudePath = join(targetDir, 'CLAUDE.md');
      await this.safeWriteFile(claudePath, claudeContent, force, options);

      // instructions/ ディレクトリをコピー（言語対応版で）
      await this.safeCopyInstructionsDirectory(targetDir, options, force);
    } else {
      // Convert to target format using FormatConverter system
      await this.generateConvertedFormat(targetDir, claudeContent, outputFormat, options, force);
    }
    
    // Generator completed
  }

  /**
   * Generate files in converted format using FormatConverter system
   */
  private async generateConvertedFormat(
    targetDir: string, 
    sourceContent: string, 
    outputFormat: OutputFormat, 
    options: GenerateFilesOptions,
    force: boolean
  ): Promise<void> {
    const _projectName = options.projectName || 'ai-project';
    const lang = options.lang || 'en';

    try {
      // Prepare conversion metadata
      const metadata: ConversionMetadata = {
        projectName: _projectName,
        lang,
        sourceContent,
        targetFormat: outputFormat,
        templateVariables: {
          // Add any additional template variables here
        }
      };

      // Convert content using the appropriate converter
      const conversionResult = await ConverterFactory.convert(outputFormat, metadata);
      
      // Write the converted file to the correct location
      const targetPath = join(targetDir, conversionResult.targetPath);
      await this.safeWriteFile(targetPath, conversionResult.content, force, options);

      // For some formats, we might need to copy additional instruction files
      // This depends on the specific format requirements
      if (this.shouldCopyInstructionsForFormat(outputFormat)) {
        await this.safeCopyInstructionsDirectory(targetDir, options, force);
      }

    } catch (error) {
      throw new Error(`Failed to generate ${outputFormat} format: ${error}`);
    }
  }

  /**
   * Determine if instruction files should be copied for the given format
   */
  private shouldCopyInstructionsForFormat(format: OutputFormat): boolean {
    // Most formats are self-contained, but some might need additional files
    switch (format) {
      case OutputFormat.CLAUDE:
        return true; // Claude format always includes instructions directory
      case OutputFormat.CURSOR:
      case OutputFormat.COPILOT:  
      case OutputFormat.WINDSURF:
        return true; // These formats also need instructions directory for references
      default:
        return false;
    }
  }

  /**
   * 🚨 EMERGENCY PATCH v0.2.1: Safe directory copying with conflict warnings
   * 🚀 v0.5.0: Enhanced with advanced conflict resolution options
   */
  private async safeCopyDirectory(sourcePath: string, targetPath: string, force: boolean, options?: GenerateFilesOptions): Promise<void> {
    await FileUtils.ensureDirectory(targetPath);
    
    const items = await readdir(sourcePath);
    
    for (const item of items) {
      const sourceItemPath = join(sourcePath, item);
      const targetItemPath = join(targetPath, item);
      
      const itemStat = await stat(sourceItemPath);
      
      if (itemStat.isDirectory()) {
        await this.safeCopyDirectory(sourceItemPath, targetItemPath, force, options);
      } else {
        const content = await readFile(sourceItemPath, 'utf-8');
        await this.safeWriteFile(targetItemPath, content, force, options);
      }
    }
  }

  /**
   * Language-aware instructions directory copying (Issue #19: Templates restructure)
   * Uses templates/instructions/(lang)/ structure
   */
  private async safeCopyInstructionsDirectory(targetDir: string, options: GenerateFilesOptions, force: boolean): Promise<void> {
    const lang = options.lang || 'en';
    
    try {
      // Use parallel operations for improved performance
      const stats = await ParallelGeneratorOperations.copyInstructionsDirectoryParallel(
        targetDir, 
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
      // Fallback to original sequential implementation
      console.warn('⚠️  Parallel copy failed, falling back to sequential copy');
      await this.safeCopyInstructionsDirectorySequential(targetDir, options, force);
    }
  }

  /**
   * Fallback sequential copy for instructions directory
   */
  private async safeCopyInstructionsDirectorySequential(targetDir: string, options: GenerateFilesOptions, force: boolean): Promise<void> {
    const lang = options.lang || 'en';
    const instructionsTargetPath = join(targetDir, 'instructions');
    
    try {
      // NEW: Try language-specific instructions directory first (templates/instructions/(lang)/)
      const instructionsPath = join(__dirname, '../../templates/instructions', lang);
      if (await FileUtils.fileExists(instructionsPath)) {
        await this.safeCopyDirectory(instructionsPath, instructionsTargetPath, force, options);
        return;
      }
      
      // Fallback to English instructions
      if (lang !== 'en') {
        const enInstructionsPath = join(__dirname, '../../templates/instructions/en');
        if (await FileUtils.fileExists(enInstructionsPath)) {
          console.warn(`⚠️  Instructions directory not found for ${lang}, using English version`);
          await this.safeCopyDirectory(enInstructionsPath, instructionsTargetPath, force, options);
          return;
        }
      }
      
      // Legacy fallback: Try tool-specific instructions directory (templates/claude/(lang)/instructions/)
      const legacyLangInstructionsPath = join(this.templateDir, lang, 'instructions');
      if (await FileUtils.fileExists(legacyLangInstructionsPath)) {
        console.warn(`⚠️  Using legacy tool-specific instructions directory for ${lang}`);
        await this.safeCopyDirectory(legacyLangInstructionsPath, instructionsTargetPath, force, options);
        return;
      }
      
      // Final fallback: Legacy structure without language support
      const legacyInstructionsPath = join(this.templateDir, 'instructions');
      if (await FileUtils.fileExists(legacyInstructionsPath)) {
        console.warn(`⚠️  Using legacy instructions directory (no language support)`);
        await this.safeCopyDirectory(legacyInstructionsPath, instructionsTargetPath, force, options);
        return;
      }
      
      throw new Error(`Instructions directory not found for language ${lang}`);
    } catch (error) {
      throw new Error(`Failed to copy instructions directory: ${error}`);
    }
  }
}