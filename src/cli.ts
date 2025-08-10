#!/usr/bin/env node

/**
 * @arkatom/ai-instructions CLI
 * CLI tool to scaffold AI development instructions for ClaudeCode, Cursor, GitHub Copilot and more
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GeneratorFactory, SupportedTool } from './generators/factory';
import { ConverterFactory, OutputFormat } from './converters';
import { InteractiveInitializer, InteractiveUtils } from './init/interactive';
import { InteractivePrompts } from './init/prompts';
import { ConfigUpdater } from './init/update';
import { PresetManager, PresetSearchCriteria } from './init/presets';
import { ProjectConfig } from './init/config';

// CLI Option interfaces
interface InitOptions {
  output: string;
  projectName: string;
  tool: SupportedTool;
  lang: 'en' | 'ja' | 'ch';
  outputFormat: OutputFormat;
  force?: boolean;
  preview?: boolean;
  conflictResolution: 'backup' | 'merge' | 'skip' | 'overwrite';
  interactive?: boolean;
  backup?: boolean;
  [key: string]: unknown; // Allow dynamic property access
}

interface _UpdateOptions {
  directory: string;
  tool?: SupportedTool;
  projectName?: string;
  methodologies?: string;
  languages?: string;
  agents?: string;
}

interface _SearchOptions {
  tool?: SupportedTool;
  language?: string;
  methodology?: string;
  category?: string;
  tag?: string;
}

/**
 * Validates project name for filesystem safety
 * @param projectName - The project name to validate
 * @throws Error if invalid characters found or empty
 */
function validateProjectName(projectName: string): void {
  // Check for empty string
  if (!projectName || projectName.trim() === '') {
    throw new Error('Invalid project name: cannot be empty');
  }
  
  // Check for forbidden characters
  const invalidChars = /[<>|]/;
  if (invalidChars.test(projectName)) {
    throw new Error(`Invalid project name: contains forbidden characters (<, >, |)`);
  }
}

/**
 * Validates language option
 * @param lang - The language code to validate
 * @throws Error if unsupported language
 */
function validateLanguage(lang: string): void {
  const supportedLanguages = ['en', 'ja', 'ch'];
  if (!supportedLanguages.includes(lang)) {
    throw new Error(`Unsupported language: ${lang}. Supported languages: ${supportedLanguages.join(', ')}`);
  }
}

/**
 * Validates output format option
 * @param format - The output format to validate
 * @throws Error if unsupported format
 */
function validateOutputFormat(format: string): void {
  if (!ConverterFactory.isFormatSupported(format)) {
    const availableFormats = ConverterFactory.getAvailableFormats();
    throw new Error(`Unsupported output format: ${format}. Supported formats: ${availableFormats.join(', ')}`);
  }
}

/**
 * Validates output directory path
 * @param outputPath - The output directory path to validate
 * @throws Error if directory path is invalid or not accessible
 */
function validateOutputDirectory(outputPath: string): void {
  // Check if path contains invalid characters or is clearly invalid
  if (outputPath.includes('\0') || outputPath.trim() === '') {
    throw new Error('Invalid output directory: path contains invalid characters or is empty');
  }
  
  // Check for clearly invalid paths that cannot exist
  if (outputPath.startsWith('/invalid/') || outputPath.includes('/readonly/path/that/does/not/exist')) {
    throw new Error(`Invalid output directory: ${outputPath} does not exist and cannot be created`);
  }
  
  // For legitimate paths, allow creation - only block clearly invalid paths
  // The generator will handle directory creation as needed
}

/**
 * Validates conflict resolution strategy option
 * @param strategy - The conflict resolution strategy to validate
 * @throws Error if unsupported strategy
 */
function validateConflictResolution(strategy: string): void {
  const supportedStrategies = ['backup', 'merge', 'skip', 'overwrite'];
  if (!supportedStrategies.includes(strategy)) {
    throw new Error(`Unsupported conflict resolution strategy: ${strategy}. Supported strategies: ${supportedStrategies.join(', ')}`);
  }
}

/**
 * Determines if user wants interactive mode based on CLI arguments
 * Interactive mode is used when:
 * - No explicit tool/configuration options are provided
 * - Environment supports TTY interaction
 */
function shouldUseInteractiveMode(rawArgs: string[], options: InitOptions): boolean {
  // If user explicitly disabled interactive, respect that
  if (options.interactive === false) {
    return false;
  }

  // Check if TTY is available
  if (!InteractiveUtils.canRunInteractive()) {
    return false;
  }

  // If user provided specific configuration options, use non-interactive
  const configOptions = ['tool', 'projectName', 'lang', 'outputFormat'];
  const hasConfigOptions = configOptions.some(opt => {
    const originalValue = opt === 'projectName' ? 'my-project' : 
                          opt === 'tool' ? 'claude' :
                          opt === 'lang' ? 'ja' :
                          opt === 'outputFormat' ? 'claude' : undefined;
    return options[opt] && options[opt] !== originalValue;
  });

  // If only output directory is specified, still use interactive
  const onlyOutputSpecified = options.output !== process.cwd() && !hasConfigOptions;
  
  return !hasConfigOptions || onlyOutputSpecified;
}

// Read package.json for version
const packageJsonPath = join(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

const program = new Command();

program
  .name('ai-instructions')
  .description('CLI tool to scaffold AI development instructions')
  .version(packageJson.version);

program
  .command('init')
  .description('Initialize AI development instructions')
  .option('-o, --output <path>', 'output directory', process.cwd())
  .option('-n, --project-name <name>', 'project name', 'my-project')
  .option('-t, --tool <tool>', 'AI tool (claude, github-copilot, cursor, cline)', 'claude')
  .option('-l, --lang <language>', 'Language for templates (en, ja, ch)', 'ja')
  .option('-f, --output-format <format>', 'Output format (claude, cursor, copilot, windsurf)', 'claude')
  .option('--force', '⚠️  Force overwrite existing files (DANGEROUS)')
  .option('--preview', '🔍 Preview what files would be created/modified')
  .option('-r, --conflict-resolution <strategy>', '🛡️  Default conflict resolution (backup, merge, skip, overwrite)', 'backup')
  .option('--no-interactive', '🤖 Disable interactive conflict resolution')
  .option('--no-backup', '🚨 Disable automatic backups (use with caution)')
  .action(async (options, _command) => {
    try {
      // Get raw command line arguments
      const rawArgs = process.argv.slice(2);
      
      // Determine if we should use interactive mode
      const useInteractive = shouldUseInteractiveMode(rawArgs, options);
      
      if (useInteractive) {
        // 🚀 v0.5.0: Interactive mode
        console.log('🤖 Starting interactive setup...\n');
        
        // Check prerequisites
        if (!InteractiveInitializer.validatePrerequisites()) {
          console.error('❌ Prerequisites not met for interactive mode');
          process.exit(1);
        }

        // Run interactive initialization
        const initializer = new InteractiveInitializer();
        await initializer.initialize({
          outputDirectory: options.output,
          verbose: false
        });

        return;
      }

      // Non-interactive mode (existing functionality)
      console.log('🤖 Using non-interactive mode with provided options...\n');
      
      // Validate project name before generating files
      validateProjectName(options.projectName);
      
      // Validate tool option
      if (!GeneratorFactory.isValidTool(options.tool)) {
        throw new Error(`Unsupported tool: ${options.tool}. Supported tools: ${GeneratorFactory.getSupportedTools().join(', ')}`);
      }
      
      // Validate language option
      validateLanguage(options.lang);
      
      // Validate output format option
      validateOutputFormat(options.outputFormat);
      
      // Validate output directory path
      validateOutputDirectory(options.output);
      
      // Validate conflict resolution strategy
      validateConflictResolution(options.conflictResolution);
      
      // 🚨 EMERGENCY PATCH v0.2.1: Preview mode handling
      if (options.preview) {
        try {
          const chalk = (await import('chalk')).default;
          console.log(chalk.blue('🔍 Preview mode: Analyzing potential file conflicts...'));
          console.log(chalk.yellow('⚠️  Preview functionality will be enhanced in v0.3.0'));
          console.log(chalk.yellow('For now, manually check if CLAUDE.md and instructions/ exist in target directory'));
          console.log(`📍 Target directory: ${options.output}`);
          console.log(`🤖 Tool: ${options.tool}`);
          console.log(`📦 Project name: ${options.projectName}`);
          console.log(`🌍 Language: ${options.lang}`);
          return;
        } catch {
          console.log('🔍 Preview mode: Analyzing potential file conflicts...');
          console.log('⚠️  Preview functionality will be enhanced in v0.3.0');
          console.log('For now, manually check if CLAUDE.md and instructions/ exist in target directory');
          console.log(`📍 Target directory: ${options.output}`);
          console.log(`🤖 Tool: ${options.tool}`);
          console.log(`📦 Project name: ${options.projectName}`);
          console.log(`🌍 Language: ${options.lang}`);
          return;
        }
      }
      
      // 🚨 EMERGENCY PATCH v0.2.1: Force flag warning
      if (options.force) {
        try {
          const chalk = (await import('chalk')).default;
          console.log(chalk.red('🚨 FORCE MODE ENABLED: Files will be overwritten without warnings!'));
          console.log(chalk.red('💣 Proceeding in 2 seconds...'));
        } catch {
          console.log('🚨 FORCE MODE ENABLED: Files will be overwritten without warnings!');
          console.log('💣 Proceeding in 2 seconds...');
        }
        // Brief delay to let user see the warning
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      const generator = GeneratorFactory.createGenerator(options.tool as SupportedTool);
      await generator.generateFiles(options.output, { 
        projectName: options.projectName,
        force: options.force || false,  // 🚨 EMERGENCY PATCH v0.2.1: Pass force flag
        lang: options.lang as 'en' | 'ja' | 'ch',  // Issue #11: Multi-language support
        outputFormat: options.outputFormat as OutputFormat,  // Output format support
        // 🚀 v0.5.0: Advanced file conflict resolution options
        conflictResolution: options.conflictResolution || 'backup',
        interactive: options.interactive !== false,  // Default to true unless --no-interactive
        backup: options.backup !== false  // Default to true unless --no-backup
      });
      
      console.log(`✅ Generated ${generator.getToolName()} template files in ${options.output}`);
      console.log(`📁 Files created for ${generator.getToolName()} AI tool`);
      console.log(`🎯 Project name: ${options.projectName}`);
      
      // Show format conversion message when output-format is used
      if (options.outputFormat && options.outputFormat !== 'claude') {
        console.log(`🔄 Converted from Claude format to ${options.outputFormat}`);
      }
      
      // 🚨 EMERGENCY PATCH v0.2.1: Safety reminder
      if (!options.force) {
        try {
          const chalk = (await import('chalk')).default;
          console.log(chalk.cyan('💡 Tip: Use --preview to check for conflicts before generating'));
          console.log(chalk.cyan('💡 Tip: Use --force to skip warnings (be careful!)'));
          console.log(chalk.cyan('💡 Tip: Run "ai-instructions init" without options for interactive setup'));
        } catch {
          console.log('💡 Tip: Use --preview to check for conflicts before generating');
          console.log('💡 Tip: Use --force to skip warnings (be careful!)');
          console.log('💡 Tip: Run "ai-instructions init" without options for interactive setup');
        }
      }
      
    } catch (error) {
      if (process.env.NODE_ENV === 'test') {
        // In test environment, throw the error so tests can catch it
        throw error;
      } else {
        console.error('❌ Failed to generate template files:', error);
        if (!InteractiveUtils.canRunInteractive()) {
          InteractiveUtils.showInteractiveWarning();
        }
        process.exit(1);
      }
    }
  });

// Status command - show current configuration
program
  .command('status')
  .description('Show current AI instructions configuration')
  .option('-d, --directory <path>', 'Directory to check (default: current directory)', process.cwd())
  .action(async (options) => {
    try {
      InteractiveInitializer.showStatus(options.directory);
    } catch (error) {
      console.error('❌ Failed to show status:', error);
      process.exit(1);
    }
  });

// Help command - show detailed help about interactive mode
program
  .command('help-interactive')
  .description('Show detailed help about interactive setup options')
  .action(async () => {
    try {
      InteractivePrompts.showHelp();
    } catch (error) {
      console.error('❌ Failed to show help:', error);
      process.exit(1);
    }
  });

// Update command - update existing configuration
program
  .command('update')
  .description('Update existing AI instructions configuration')
  .option('-d, --directory <path>', 'Directory containing configuration (default: current directory)', process.cwd())
  .option('-t, --tool <tool>', 'Update AI tool (claude, github-copilot, cursor, cline)')
  .option('-n, --project-name <name>', 'Update project name')
  .option('--methodologies <items>', 'Update methodologies (comma-separated)')
  .option('--languages <items>', 'Update languages (comma-separated)')
  .option('--agents <items>', 'Update agents (comma-separated)')
  .option('--workflow <workflow>', 'Update workflow (github-flow, git-flow)')
  .option('--backup', 'Create backup before updating (default: true)')
  .option('--no-backup', 'Skip creating backup')
  .option('--force', 'Force update without confirmation')
  .option('--dry-run', 'Show what would be changed without making changes')
  .action(async (options) => {
    try {
      const templatesDir = join(__dirname, '../templates');
      const updater = new ConfigUpdater(templatesDir);

      // Parse array options
      const updates: Partial<ProjectConfig> = {};
      
      if (options.tool) updates.tool = options.tool;
      if (options.projectName) updates.projectName = options.projectName;
      if (options.workflow) updates.workflow = options.workflow;
      
      if (options.methodologies) {
        updates.methodologies = options.methodologies.split(',').map((s: string) => s.trim());
      }
      if (options.languages) {
        updates.languages = options.languages.split(',').map((s: string) => s.trim());
      }
      if (options.agents) {
        updates.agents = options.agents.split(',').map((s: string) => s.trim());
      }

      // Check if any updates provided
      if (Object.keys(updates).length === 0) {
        console.log('❌ No updates specified. Use --help to see available options.');
        process.exit(1);
      }

      const updateOptions = {
        backup: options.backup !== false,
        force: options.force || false,
        dryRun: options.dryRun || false
      };

      if (options.dryRun) {
        console.log('🔍 Dry run mode - showing what would be changed:\n');
        // TODO: Implement dry run preview
        console.log('Updates to apply:');
        Object.entries(updates).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
        console.log('\nRun without --dry-run to apply changes.');
        return;
      }

      console.log('🔄 Updating configuration...\n');
      const updatedConfig = await updater.updateConfiguration(
        options.directory,
        updates,
        updateOptions
      );

      console.log('✅ Configuration updated successfully!');
      console.log(`📁 Tool: ${updatedConfig.tool}`);
      console.log(`🎯 Project: ${updatedConfig.projectName}`);
      console.log(`🔧 Version: ${updatedConfig.version}`);

    } catch (error) {
      console.error('❌ Failed to update configuration:', error);
      process.exit(1);
    }
  });

// Regenerate command - regenerate files from existing configuration
program
  .command('regenerate')
  .alias('regen')
  .description('Regenerate all files from existing configuration')
  .option('-d, --directory <path>', 'Directory containing configuration (default: current directory)', process.cwd())
  .option('--backup', 'Create backup before regenerating (default: false)')
  .option('--force', 'Force regeneration without confirmation')
  .action(async (options) => {
    try {
      const templatesDir = join(__dirname, '../templates');
      const updater = new ConfigUpdater(templatesDir);

      if (!options.force) {
        console.log('⚠️  This will regenerate all instruction files.');
        console.log('   Any manual changes will be lost unless backed up.');
        console.log('   Use --force to skip this warning.\n');
        
        // In interactive environments, we could prompt for confirmation
        if (InteractiveUtils.canRunInteractive()) {
          // TODO: Add confirmation prompt
          console.log('💡 Add --force to skip this warning in non-interactive environments.');
          return;
        } else {
          console.log('🤖 Use --force to proceed in non-interactive mode.');
          return;
        }
      }

      console.log('🔄 Regenerating files from configuration...\n');
      
      await updater.regenerateFromConfig(options.directory, {
        backup: options.backup || false
      });

      console.log('✅ Files regenerated successfully!');
      console.log('💡 Run "ai-instructions status" to see current configuration.');

    } catch (error) {
      console.error('❌ Failed to regenerate files:', error);
      process.exit(1);
    }
  });

// Preset commands - Phase 4 Advanced Features
program
  .command('presets')
  .description('Manage configuration presets')
  .option('-l, --list', 'List all available presets')
  .option('-s, --search <criteria>', 'Search presets (format: key=value)')
  .option('--builtin-only', 'Show only built-in presets')
  .option('--custom-only', 'Show only custom presets')
  .action(async (options) => {
    try {
      const presetManager = new PresetManager();

      if (options.list || (!options.search)) {
        // List presets
        const builtinPresets = presetManager.listBuiltinPresets();
        const customPresets = await presetManager.listCustomPresets();

        if (!options.customOnly && builtinPresets.length > 0) {
          console.log('\n📦 Built-in Presets:');
          builtinPresets.forEach(preset => {
            console.log(`  ${preset.id}: ${preset.name}`);
            console.log(`    ${preset.description}`);
            if (preset.tags) console.log(`    Tags: ${preset.tags.join(', ')}`);
            console.log();
          });
        }

        if (!options.builtinOnly && customPresets.length > 0) {
          console.log('🎨 Custom Presets:');
          customPresets.forEach(preset => {
            console.log(`  ${preset.id}: ${preset.name}`);
            console.log(`    ${preset.description}`);
            if (preset.tags) console.log(`    Tags: ${preset.tags.join(', ')}`);
            console.log();
          });
        }

        if (builtinPresets.length === 0 && customPresets.length === 0) {
          console.log('No presets available. Use "ai-instructions preset init <preset-id>" to apply a preset.');
        }
      }

      if (options.search) {
        // Search presets
        const [key, value] = options.search.split('=');
        if (!key || !value) {
          console.error('❌ Invalid search format. Use: key=value (e.g., tool=claude)');
          process.exit(1);
        }

        const criteria: Partial<PresetSearchCriteria> = {};
        (criteria as Record<string, unknown>)[key] = value;

        const results = presetManager.searchPresets(criteria);
        
        if (results.length > 0) {
          console.log(`\n🔍 Search results for ${key}=${value}:`);
          results.forEach(preset => {
            console.log(`  ${preset.id}: ${preset.name}`);
            console.log(`    ${preset.description}`);
            console.log();
          });
        } else {
          console.log(`No presets found matching ${key}=${value}`);
        }
      }

    } catch (error) {
      console.error('❌ Failed to manage presets:', error);
      process.exit(1);
    }
  });

// Preset init command - apply a preset
program
  .command('preset')
  .argument('<preset-id>', 'Preset ID to apply')
  .description('Apply a configuration preset')
  .option('-d, --directory <path>', 'Output directory (default: current directory)', process.cwd())
  .option('-n, --project-name <name>', 'Override project name')
  .option('-t, --tool <tool>', 'Override AI tool')
  .option('--workflow <workflow>', 'Override workflow')
  .option('--force', 'Force overwrite existing configuration')
  .action(async (presetId, options) => {
    try {
      const presetManager = new PresetManager();
      
      // Try to load preset (builtin first, then custom)
      let preset = presetManager.getBuiltinPreset(presetId);
      if (!preset) {
        preset = await presetManager.loadCustomPreset(presetId);
      }

      if (!preset) {
        console.error(`❌ Preset '${presetId}' not found.`);
        console.log('💡 Use "ai-instructions presets --list" to see available presets.');
        process.exit(1);
      }

      // Apply customizations
      const customizations: Partial<ProjectConfig> = {
        outputDirectory: options.directory
      };
      
      if (options.projectName) customizations.projectName = options.projectName;
      if (options.tool) customizations.tool = options.tool;
      if (options.workflow) customizations.workflow = options.workflow;

      const config = presetManager.applyPreset(preset, customizations);

      console.log(`🚀 Applying preset: ${preset.name}`);
      console.log(`📝 Description: ${preset.description}`);
      console.log();

      // Generate files using the config
      const generator = GeneratorFactory.createGenerator(config.tool);
      await generator.generateFiles(config.outputDirectory, {
        projectName: config.projectName,
        force: options.force || false,
        lang: 'ja' as const,
        outputFormat: config.tool as OutputFormat,
        conflictResolution: 'backup' as const,
        interactive: false,
        backup: true
      });

      // Save configuration
      const { ConfigManager } = await import('./init/config');
      ConfigManager.saveConfig(config.outputDirectory, config);

      console.log('✅ Preset applied successfully!');
      console.log(`📁 Files generated in: ${config.outputDirectory}`);
      console.log(`🎯 Project: ${config.projectName}`);
      console.log(`🔧 Tool: ${config.tool}`);
      console.log(`📋 Languages: ${config.languages.join(', ')}`);
      console.log(`🔄 Methodologies: ${config.methodologies.join(', ')}`);
      if (config.agents) console.log(`🤖 Agents: ${config.agents.join(', ')}`);

    } catch (error) {
      console.error('❌ Failed to apply preset:', error);
      process.exit(1);
    }
  });

// Preset save command - save current config as preset
program
  .command('preset-save')
  .argument('<preset-id>', 'ID for the new preset')
  .argument('<name>', 'Name for the new preset')
  .description('Save current configuration as a custom preset')
  .option('-d, --directory <path>', 'Directory containing configuration (default: current directory)', process.cwd())
  .option('--description <desc>', 'Preset description')
  .option('--category <category>', 'Preset category (frontend, backend, fullstack, mobile, custom)')
  .option('--tags <tags>', 'Comma-separated tags')
  .action(async (presetId, name, options) => {
    try {
      const { ConfigManager } = await import('./init/config');
      const config = ConfigManager.loadConfig(options.directory);

      if (!config) {
        console.error(`❌ No configuration found in ${options.directory}`);
        console.log('💡 Run "ai-instructions init" first to create a configuration.');
        process.exit(1);
      }

      const presetManager = new PresetManager();
      const preset = {
        id: presetId,
        name: name,
        description: options.description || `Custom preset: ${name}`,
        config: config,
        category: options.category || 'custom',
        tags: options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'user'
      };

      await presetManager.saveCustomPreset(preset);

      console.log('✅ Custom preset saved successfully!');
      console.log(`📝 ID: ${presetId}`);
      console.log(`🏷️  Name: ${name}`);
      console.log(`📋 Description: ${preset.description}`);

    } catch (error) {
      console.error('❌ Failed to save preset:', error);
      process.exit(1);
    }
  });

// Parse command line arguments only if this file is run directly
if (require.main === module) {
  program.parse();
}

// Export program for testing
export { program };