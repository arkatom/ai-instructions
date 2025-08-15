import { CommandResult } from '../interfaces/CommandResult';
import { GeneratorFactory, SupportedTool } from '../../generators/factory';
import { OutputFormat } from '../../converters';
import { Logger } from '../../utils/logger';

export interface FileGenerationOptions {
  tool: string;
  outputDir: string;
  projectName: string;
  force: boolean;
  lang: 'en' | 'ja' | 'ch';
  outputFormat: OutputFormat;
  conflictResolution: string;
  interactive: boolean;
  backup: boolean;
}

/**
 * Service responsible for orchestrating file generation process
 * Single Responsibility: File generation coordination and feedback
 */
export class FileGenerationOrchestrator {
  
  /**
   * Orchestrate the complete file generation process
   */
  async generateFiles(options: FileGenerationOptions): Promise<CommandResult> {
    try {
      // Create generator and generate files
      if (!GeneratorFactory.isValidTool(options.tool)) {
        throw new Error(`Invalid tool: ${options.tool}. Supported tools: ${GeneratorFactory.getSupportedTools().join(', ')}`);
      }
      const generator = GeneratorFactory.createGenerator(options.tool);
      await generator.generateFiles(options.outputDir, {
        projectName: options.projectName,
        force: options.force,
        lang: options.lang,
        outputFormat: options.outputFormat,
        conflictResolution: options.conflictResolution,
        interactive: options.interactive,
        backup: options.backup
      });

      // Success logging
      Logger.success(`Generated ${generator.getToolName()} template files in ${options.outputDir}`);
      Logger.info(`📁 Files created for ${generator.getToolName()} AI tool`);
      Logger.item('🎯 Project name:', options.projectName);
      
      // Show format conversion message when output-format is used
      if (options.outputFormat && options.outputFormat !== 'claude') {
        Logger.info(`🔄 Converted from Claude format to ${options.outputFormat}`);
      }

      // Safety reminders (only when not in force mode)
      if (!options.force) {
        Logger.tip('Use --preview to check for conflicts before generating');
        Logger.tip('Use --force to skip warnings (be careful!)');
        Logger.tip('Run "ai-instructions init" without options for interactive setup');
      }

      return { success: true };

    } catch (error) {
      const errorMessage = `Failed to generate template files: ${error}`;
      return {
        success: false,
        error: errorMessage
      };
    }
  }
}