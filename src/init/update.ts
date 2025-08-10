import { ProjectConfig, ConfigManager, AVAILABLE_TOOLS } from './config';
import { GeneratorFactory } from '../generators/factory';
import { OutputFormat } from '../converters';
import { join } from 'path';
import { existsSync, copyFileSync, mkdirSync } from 'fs';

export interface UpdateOptions {
  backup?: boolean;
  force?: boolean;
  interactive?: boolean;
  dryRun?: boolean;
}

export interface UpdateSummary {
  hasChanges: boolean;
  changes: string[];
  addedFiles: string[];
  modifiedFiles: string[];
  removedFiles: string[];
}

export class ConfigUpdater {
  constructor(private templatesDir: string) {}

  /**
   * Validate path to prevent directory traversal
   */
  private static validatePath(path: string): boolean {
    // Normalize the path
    const normalizedPath = path.replace(/\\/g, '/');
    
    // Check for path traversal attempts
    if (normalizedPath.includes('../') || normalizedPath.includes('..\\')) {
      return false;
    }
    
    // Check for absolute paths outside project
    if (normalizedPath.startsWith('/etc') || 
        normalizedPath.startsWith('/root') ||
        normalizedPath.startsWith('/home') ||
        normalizedPath.includes(':/')) {
      return false;
    }
    
    return true;
  }

  /**
   * Update existing configuration with new values
   */
  async updateConfiguration(
    outputDirectory: string,
    updates: Partial<ProjectConfig>,
    options: UpdateOptions = {}
  ): Promise<ProjectConfig> {
    try {
      // Validate output directory for security
      if (!ConfigUpdater.validatePath(outputDirectory)) {
        throw new Error(`Invalid output directory path: ${outputDirectory}`);
      }
      
      // Load existing configuration
      const existingConfig = ConfigManager.loadConfig(outputDirectory);
      if (!existingConfig) {
        throw new Error(`No configuration found in ${outputDirectory}`);
      }

      // Validate the update
      await this.validateUpdate(existingConfig, updates);

      // Create backup if requested
      if (options.backup) {
        await this.createBackup(outputDirectory);
      }

      // Merge configurations
      const updatedConfig = this.mergeConfigurations(existingConfig, updates);

      // Always update version to current
      const currentVersion = '0.5.0';
      updatedConfig.version = currentVersion;
      if (existingConfig.version !== currentVersion) {
        console.log(
          `Configuration updated from v${existingConfig.version} to v${currentVersion}`
        );
      }

      // Generate files with new configuration
      const generator = GeneratorFactory.createGenerator(updatedConfig.tool);

      const outputFormat = this.toolToOutputFormat(updatedConfig.tool);
      const generationOptions = {
        projectName: updatedConfig.projectName,
        force: options.force ?? true,
        lang: 'ja' as const,
        outputFormat,
        conflictResolution: 'backup' as const,
        interactive: false,
        backup: options.backup ?? false
      };

      console.log(`Updating configuration with ${generator.getToolName()}...`);
      await generator.generateFiles(outputDirectory, generationOptions);

      // Save updated configuration
      ConfigManager.saveConfig(outputDirectory, updatedConfig);

      console.log('Configuration updated successfully!');
      return updatedConfig;

    } catch (error) {
      console.error('Failed to update configuration', error);
      throw error;
    }
  }

  /**
   * Regenerate all files from existing configuration
   */
  async regenerateFromConfig(
    outputDirectory: string,
    options: UpdateOptions = {}
  ): Promise<void> {
    // Validate output directory for security
    if (!ConfigUpdater.validatePath(outputDirectory)) {
      throw new Error(`Invalid output directory path: ${outputDirectory}`);
    }
    
    const config = ConfigManager.loadConfig(outputDirectory);
    if (!config) {
      throw new Error(`No configuration found in ${outputDirectory}`);
    }

    console.log('Regenerating configuration files...');
    
    const generator = GeneratorFactory.createGenerator(config.tool);

    const outputFormat = this.toolToOutputFormat(config.tool);
    const generationOptions = {
      projectName: config.projectName,
      force: true, // Always force regeneration
      lang: 'ja' as const,
      outputFormat,
      conflictResolution: 'backup' as const,
      interactive: false,
      backup: options.backup ?? false
    };

    await generator.generateFiles(outputDirectory, generationOptions);
    console.log('Files regenerated successfully!');
  }

  /**
   * Validate update constraints
   */
  async validateUpdate(
    existingConfig: ProjectConfig,
    updates: Partial<ProjectConfig>
  ): Promise<void> {
    // Validate tool selection
    if (updates.tool && !AVAILABLE_TOOLS[updates.tool]) {
      throw new Error(`Invalid tool selection: ${updates.tool}`);
    }

    // Validate methodologies are not empty
    if (updates.methodologies && updates.methodologies.length === 0) {
      throw new Error('At least one methodology must be selected');
    }

    // Validate languages are not empty
    if (updates.languages && updates.languages.length === 0) {
      throw new Error('At least one language must be selected');
    }

    // Additional validation can be added here
  }

  /**
   * Merge existing configuration with updates
   */
  private mergeConfigurations(
    existing: ProjectConfig,
    updates: Partial<ProjectConfig>
  ): ProjectConfig {
    const merged = { ...existing };

    // Update primitive fields
    if (updates.tool) merged.tool = updates.tool;
    if (updates.workflow) merged.workflow = updates.workflow;
    if (updates.projectName) merged.projectName = updates.projectName;
    if (updates.outputDirectory) merged.outputDirectory = updates.outputDirectory;

    // Update array fields
    if (updates.methodologies) merged.methodologies = [...updates.methodologies];
    if (updates.languages) merged.languages = [...updates.languages];
    if (updates.agents) merged.agents = [...updates.agents];

    // Update metadata
    merged.generatedAt = new Date().toISOString();

    return merged;
  }

  /**
   * Create backup of current configuration
   */
  private async createBackup(outputDirectory: string): Promise<void> {
    // Validate output directory for security
    if (!ConfigUpdater.validatePath(outputDirectory)) {
      throw new Error(`Invalid output directory path: ${outputDirectory}`);
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = join(outputDirectory, '.ai-instructions-backup', timestamp);

    console.log(`Creating backup in ${backupDir}...`);
    
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    const configFile = join(outputDirectory, '.ai-instructions.json');
    if (existsSync(configFile)) {
      copyFileSync(configFile, join(backupDir, '.ai-instructions.json'));
    }

    // Backup other important files
    const filesToBackup = [
      'CLAUDE.md',
      '.cursor/rules/main.mdc',
      '.cline/instructions.md',
      '.github/copilot-instructions.md'
    ];

    for (const file of filesToBackup) {
      const filePath = join(outputDirectory, file);
      if (existsSync(filePath)) {
        const backupPath = join(backupDir, file);
        const backupFileDir = join(backupDir, file, '..');
        if (!existsSync(backupFileDir)) {
          mkdirSync(backupFileDir, { recursive: true });
        }
        copyFileSync(filePath, backupPath);
      }
    }
  }

  /**
   * Map tool name to OutputFormat enum value
   */
  private toolToOutputFormat(tool: string): OutputFormat {
    switch (tool) {
      case 'claude':
        return OutputFormat.CLAUDE;
      case 'cursor':
        return OutputFormat.CURSOR;
      case 'github-copilot':
        return OutputFormat.COPILOT;
      case 'cline':
        return OutputFormat.CLAUDE; // Cline uses Claude format
      default:
        return OutputFormat.CLAUDE; // Default fallback
    }
  }

  /**
   * Get detailed summary of configuration changes
   */
  static getUpdateSummary(
    oldConfig: ProjectConfig,
    newConfig: ProjectConfig
  ): UpdateSummary {
    const changes: string[] = [];

    // Check tool changes
    if (oldConfig.tool !== newConfig.tool) {
      changes.push(`Tool: ${oldConfig.tool} → ${newConfig.tool}`);
    }

    // Check workflow changes
    if (oldConfig.workflow !== newConfig.workflow) {
      changes.push(`Workflow: ${oldConfig.workflow} → ${newConfig.workflow}`);
    }

    // Check methodology changes
    const oldMethodologies = oldConfig.methodologies.sort().join(', ');
    const newMethodologies = newConfig.methodologies.sort().join(', ');
    if (oldMethodologies !== newMethodologies) {
      changes.push(`Methodologies: ${oldMethodologies} → ${newMethodologies}`);
    }

    // Check language changes
    const oldLanguages = oldConfig.languages.sort().join(', ');
    const newLanguages = newConfig.languages.sort().join(', ');
    if (oldLanguages !== newLanguages) {
      changes.push(`Languages: ${oldLanguages} → ${newLanguages}`);
    }

    // Check agent changes
    const oldAgents = (oldConfig.agents || []).sort().join(', ') || 'none';
    const newAgents = (newConfig.agents || []).sort().join(', ') || 'none';
    if (oldAgents !== newAgents) {
      changes.push(`Agents: ${oldAgents} → ${newAgents}`);
    }

    // Check project name changes
    if (oldConfig.projectName !== newConfig.projectName) {
      changes.push(`Project: ${oldConfig.projectName} → ${newConfig.projectName}`);
    }

    return {
      hasChanges: changes.length > 0,
      changes,
      addedFiles: [], // TODO: Implement file tracking
      modifiedFiles: [], // TODO: Implement file tracking  
      removedFiles: [] // TODO: Implement file tracking
    };
  }
}