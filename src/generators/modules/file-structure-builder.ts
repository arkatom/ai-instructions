/**
 * File structure and directory management module
 * Extracted from BaseGenerator for single responsibility principle
 */

import { join } from 'path';
import { FileUtils } from '../../utils/file-utils';
import { ErrorHandler } from '../../utils/error-handler';
import { 
  ConfigurationManager, 
  type FileStructureConfig 
} from '../config-manager';
import {
  ConfigurationNotFoundError,
  ConfigurationValidationError,
  FileSystemError
} from '../errors';
import {
  TypeGuards,
  type SupportedTool
} from '../types';

/**
 * Tool configuration interface for file structure operations
 */
interface ToolConfigBasic {
  readonly name: string;
  readonly outputStructure: {
    readonly mainFile?: string;
    readonly directory?: string;
  };
}

/**
 * Handles file structure generation and directory management
 * Responsibility: Create output directory structures based on tool configuration
 */
export class FileStructureBuilder {
  
  /**
   * Generate output directory structure based on configurable file structure
   * Creates main directories and subdirectories as specified in tool configuration
   */
  async generateOutputDirectoryStructure(
    toolConfig: ToolConfigBasic, 
    baseOutputDir: string
  ): Promise<string[]> {
    const fileStructure = await this.getFileStructureConfig(toolConfig.name);
    const createdPaths: string[] = [];
    
    try {
      // Create main output directory if specified
      if (fileStructure.outputDirectory) {
        const mainDir = join(baseOutputDir, fileStructure.outputDirectory);
        await FileUtils.ensureDirectory(mainDir);
        createdPaths.push(mainDir);
      }
      
      // Create subdirectories
      for (const subDir of fileStructure.subdirectories) {
        const fullSubDirPath = join(baseOutputDir, subDir);
        await FileUtils.ensureDirectory(fullSubDirPath);
        createdPaths.push(fullSubDirPath);
      }
      
      return createdPaths;
    } catch (error) {
      const normalizedError = ErrorHandler.normalizeToError(error);
      throw new FileSystemError('create_directory_structure', baseOutputDir, normalizedError);
    }
  }

  /**
   * Get configurable file structure for a specific tool
   * Delegates to ConfigurationManager for centralized configuration management
   */
  async getFileStructureConfig(toolName: string): Promise<FileStructureConfig> {
    try {
      if (!TypeGuards.isSupportedTool(toolName)) {
        throw new ConfigurationNotFoundError('tool', toolName, 'not a supported tool');
      }
      
      // Type-safe: we've validated toolName is a SupportedTool above
      return await ConfigurationManager.getFileStructureConfig(toolName as SupportedTool);
    } catch (error) {
      // Fallback to default file structure if configuration fails
      console.warn(`⚠️  Failed to load file structure config for ${toolName}, using defaults`);
      
      // Handle the case where ConfigurationManager might fail
      if (error instanceof ConfigurationNotFoundError || 
          error instanceof ConfigurationValidationError) {
        // Create fallback with any available data
        const fallbackOverrides: Partial<FileStructureConfig> = {
          outputDirectory: '',
          subdirectories: [],
          includeInstructionsDirectory: true
        };
        
        return ConfigurationManager.createCustomFileStructure(fallbackOverrides);
      }
      
      // For other errors, re-throw
      throw error;
    }
  }
}