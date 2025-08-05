import { join } from 'path';
import { readdir, stat, readFile } from 'fs/promises';
import { FileUtils } from '../utils/file-utils';
import { BaseGenerator, GenerateFilesOptions, ToolConfig } from './base';
import { ConverterFactory, OutputFormat, ConversionMetadata } from '../converters';

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
    const outputFormat = options.outputFormat || OutputFormat.CLAUDE;
    const projectName = options.projectName || 'ai-project';
    
    // 🚨 EMERGENCY PATCH v0.2.1: Safe file generation with warnings
    try {
      const chalk = (await import('chalk')).default;
      console.log(chalk.blue(`🤖 Generating ${outputFormat} AI instruction files...`));
    } catch (error) {
      console.log(`🤖 Generating ${outputFormat} AI instruction files...`);
    }

    // Generate CLAUDE.md content first (always the source format)
    const claudeContent = await this.loadTemplate('CLAUDE.md', options);
    const processedClaudeContent = this.replaceTemplateVariables(claudeContent, options);
    
    if (outputFormat === OutputFormat.CLAUDE) {
      // Standard Claude format generation
      const claudePath = join(targetDir, 'CLAUDE.md');
      await this.safeWriteFile(claudePath, processedClaudeContent, force);

      // instructions/ ディレクトリをコピー（言語対応版で）
      await this.safeCopyInstructionsDirectory(targetDir, options, force);
    } else {
      // Convert to target format using FormatConverter system
      await this.generateConvertedFormat(targetDir, processedClaudeContent, outputFormat, options, force);
    }
    
    try {
      const chalk = (await import('chalk')).default;
      console.log(chalk.green(`✅ ${outputFormat} template generation completed!`));
      if (outputFormat !== OutputFormat.CLAUDE) {
        console.log(chalk.yellow(`🔄 Converted from Claude format to ${outputFormat}`));
      }
    } catch (error) {
      console.log(`✅ ${outputFormat} template generation completed!`);
      if (outputFormat !== OutputFormat.CLAUDE) {
        console.log(`🔄 Converted from Claude format to ${outputFormat}`);
      }
    }
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
    const projectName = options.projectName || 'ai-project';
    const lang = options.lang || 'en';

    try {
      // Prepare conversion metadata
      const metadata: ConversionMetadata = {
        projectName,
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
      await this.safeWriteFile(targetPath, conversionResult.content, force);

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
      default:
        return false; // These formats are typically self-contained
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