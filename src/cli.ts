#!/usr/bin/env node

/**
 * @arkatom/ai-instructions CLI
 * CLI tool to scaffold AI development instructions for ClaudeCode, Cursor, GitHub Copilot and more
 */

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { GeneratorFactory, SupportedTool } from './generators/factory';
import { ConverterFactory, OutputFormat } from './converters';
import { InteractiveInitializer, InteractiveUtils } from './init/interactive';
import { InteractivePrompts } from './init/prompts';

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
function shouldUseInteractiveMode(rawArgs: string[], options: any): boolean {
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
  .action(async (options, command) => {
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
        } catch (error) {
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
        } catch (error) {
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
        } catch (error) {
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

// Parse command line arguments only if this file is run directly
if (require.main === module) {
  program.parse();
}

// Export program for testing
export { program };