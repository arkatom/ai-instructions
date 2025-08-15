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
import { Logger } from './utils/logger';
import { PathValidator, SecurityError } from './utils/security';
import { EnvironmentService } from './services/EnvironmentService';
import { validateCliOptions, hasValidatedOptions } from './utils/type-guards';
import { RawInitOptions, ValidatedInitOptions } from './types/cli-types';

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

function shouldUseInteractiveMode(rawArgs: string[], options: ValidatedInitOptions): boolean {
  // If user explicitly disabled interactive, respect that
  if (options.interactive === false) {
    return false;
  }

  // Check if TTY is available
  if (!InteractiveUtils.canRunInteractive()) {
    return false;
  }

  // If user provided specific configuration options, use non-interactive
  const configOptions = ['tool', 'projectName', 'lang', 'outputFormat'] as const;
  const hasConfigOptions = configOptions.some(opt => {
    const originalValue = opt === 'projectName' ? 'my-project' : 
                          opt === 'tool' ? 'claude' :
                          opt === 'lang' ? 'ja' :
                          opt === 'outputFormat' ? 'claude' : undefined;
    return options[opt] && options[opt] !== originalValue;
  });

  // If only output directory is specified, still use interactive
  const onlyOutputSpecified = options.output !== environmentService.getCurrentWorkingDirectory() && !hasConfigOptions;
  
  return !hasConfigOptions || onlyOutputSpecified;
}

// Helper functions to reduce cognitive complexity
async function handleInteractiveMode(validatedOutputDir: string): Promise<void> {
  Logger.info('🤖 Starting interactive setup...\n');
  
  // Check prerequisites
  if (!InteractiveInitializer.validatePrerequisites()) {
    Logger.error('Prerequisites not met for interactive mode');
    process.exit(1);
  }

  // Run interactive initialization
  const initializer = new InteractiveInitializer();
  await initializer.initialize({
    outputDirectory: validatedOutputDir,
    verbose: false
  });
}

function validateInitOptionsLegacy(options: ValidatedInitOptions): void {
  // These validations are now redundant since options are already validated
  // Keeping for backward compatibility but using validated options
  
  // Validate project name before generating files
  validateProjectName(options.projectName);
  
  // Validate tool option - already validated in type guard
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
}

async function handlePreviewMode(options: ValidatedInitOptions): Promise<void> {
  try {
    const chalk = (await import('chalk')).default;
    Logger.info(chalk.blue('🔍 Preview mode: Analyzing potential file conflicts...'));
    Logger.warn('Preview functionality will be enhanced in v0.3.0');
    Logger.warn('For now, manually check if CLAUDE.md and instructions/ exist in target directory');
    Logger.item('📍 Target directory:', options.output);
    Logger.item('🤖 Tool:', options.tool);
    Logger.item('📦 Project name:', options.projectName);
    Logger.item('🌍 Language:', options.lang);
  } catch {
    Logger.info('🔍 Preview mode: Analyzing potential file conflicts...');
    Logger.warn('Preview functionality will be enhanced in v0.3.0');
    Logger.warn('For now, manually check if CLAUDE.md and instructions/ exist in target directory');
    Logger.item('📍 Target directory:', options.output);
    Logger.item('🤖 Tool:', options.tool);
    Logger.item('📦 Project name:', options.projectName);
    Logger.item('🌍 Language:', options.lang);
  }
}

async function handleForceMode(): Promise<void> {
  try {
    const chalk = (await import('chalk')).default;
    Logger.raw(chalk.red('🚨 FORCE MODE ENABLED: Files will be overwritten without warnings!'));
    Logger.raw(chalk.red('💣 Proceeding in 2 seconds...'));
  } catch {
    Logger.raw('🚨 FORCE MODE ENABLED: Files will be overwritten without warnings!');
    Logger.raw('💣 Proceeding in 2 seconds...');
  }
  // Brief delay to let user see the warning
  await new Promise(resolve => setTimeout(resolve, 2000));
}

async function generateTemplateFiles(validatedOutputDir: string, options: ValidatedInitOptions): Promise<void> {
  const generator = GeneratorFactory.createGenerator(options.tool);
  await generator.generateFiles(validatedOutputDir, { 
    projectName: options.projectName,
    force: options.force,  // 🚨 EMERGENCY PATCH v0.2.1: Pass force flag
    lang: options.lang,  // Issue #11: Multi-language support
    outputFormat: options.outputFormat,  // Output format support
    // 🚀 v0.5.0: Advanced file conflict resolution options
    conflictResolution: options.conflictResolution,
    interactive: options.interactive,  // Default to true unless --no-interactive
    backup: options.backup  // Default to true unless --no-backup
  });
  
  Logger.success(`Generated ${generator.getToolName()} template files in ${validatedOutputDir}`);
  Logger.info(`📁 Files created for ${generator.getToolName()} AI tool`);
  Logger.item('🎯 Project name:', options.projectName);
  
  // Show format conversion message when output-format is used
  if (options.outputFormat && options.outputFormat !== 'claude') {
    Logger.info(`🔄 Converted from Claude format to ${options.outputFormat}`);
  }
  
  // 🚨 EMERGENCY PATCH v0.2.1: Safety reminder
  if (!options.force) {
    try {
      Logger.tip('Use --preview to check for conflicts before generating');
      Logger.tip('Use --force to skip warnings (be careful!)');
      Logger.tip('Run "ai-instructions init" without options for interactive setup');
    } catch {
      Logger.tip('Use --preview to check for conflicts before generating');
      Logger.tip('Use --force to skip warnings (be careful!)');
      Logger.tip('Run "ai-instructions init" without options for interactive setup');
    }
  }
}

function handleInitError(error: unknown): void {
  if (process.env.NODE_ENV === 'test') {
    // In test environment, throw the error so tests can catch it
    throw error;
  } else {
    if (error instanceof SecurityError) {
      Logger.error('Security violation:', error.message);
      if (error.context) {
        Logger.debug(`Security details: ${error.context}`);
      }
      process.exit(1);
    }
    Logger.error('Failed to generate template files:', error);
    if (!InteractiveUtils.canRunInteractive()) {
      InteractiveUtils.showInteractiveWarning();
    }
    process.exit(1);
  }
}

// Read package.json for version
const packageJsonPath = join(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

const environmentService = new EnvironmentService();
const program = new Command();

program
  .name('ai-instructions')
  .description('CLI tool to scaffold AI development instructions')
  .version(packageJson.version);

program
  .command('init')
  .description('Initialize AI development instructions')
  .option('-o, --output <path>', 'output directory', environmentService.getCurrentWorkingDirectory())
  .option('-n, --project-name <name>', 'project name', 'my-project')
  .option('-t, --tool <tool>', 'AI tool (claude, github-copilot, cursor, cline)', 'claude')
  .option('-l, --lang <language>', 'Language for templates (en, ja, ch)', 'ja')
  .option('-f, --output-format <format>', 'Output format (claude, cursor, copilot, windsurf)', 'claude')
  .option('--force', '⚠️  Force overwrite existing files (DANGEROUS)')
  .option('--preview', '🔍 Preview what files would be created/modified')
  .option('-r, --conflict-resolution <strategy>', '🛡️  Default conflict resolution (backup, merge, skip, overwrite)', 'backup')
  .option('--no-interactive', '🤖 Disable interactive conflict resolution')
  .option('--no-backup', '🚨 Disable automatic backups (use with caution)')
  .action(async (rawOptions: RawInitOptions) => {
    try {
      // Validate and convert raw options to type-safe options
      const currentWorkingDir = environmentService.getCurrentWorkingDirectory();
      const validationResult = validateCliOptions(rawOptions, currentWorkingDir);
      
      if (!hasValidatedOptions(validationResult)) {
        Logger.error('Invalid CLI options:');
        for (const error of validationResult.errors) {
          Logger.error(`  ${error.field}: ${error.message}`);
          if (error.expected) {
            Logger.error(`    Expected: ${error.expected.join(', ')}`);
          }
          if (error.received !== undefined) {
            Logger.error(`    Received: ${error.received}`);
          }
        }
        process.exit(1);
      }
      
      const options = validationResult.validatedOptions;
      
      // Validate output directory for security
      const validatedOutputDir = PathValidator.validateCliPath(options.output);
      
      // Get raw command line arguments
      const rawArgs = process.argv.slice(2);
      
      // Determine if we should use interactive mode
      const useInteractive = shouldUseInteractiveMode(rawArgs, options);
      
      if (useInteractive) {
        await handleInteractiveMode(validatedOutputDir);
        return;
      }

      // Non-interactive mode (existing functionality)
      Logger.info('🤖 Using non-interactive mode with provided options...\n');
      
      // Legacy validation (now redundant but kept for safety)
      validateInitOptionsLegacy(options);
      
      // Handle preview mode
      if (options.preview) {
        await handlePreviewMode(options);
        return;
      }
      
      // Handle force mode warning
      if (options.force) {
        await handleForceMode();
      }
      
      // Generate files
      await generateTemplateFiles(validatedOutputDir, options);
      
    } catch (error) {
      handleInitError(error);
    }
  });

// Status command - show current configuration
program
  .command('status')
  .description('Show current AI instructions configuration')
  .option('-d, --directory <path>', 'Directory to check (default: current directory)', environmentService.getCurrentWorkingDirectory())
  .action(async (rawOptions: RawInitOptions) => {
    try {
      // Get directory path with fallback
      const directory = typeof rawOptions.directory === 'string' 
        ? rawOptions.directory 
        : environmentService.getCurrentWorkingDirectory();
      
      // Validate directory path for security
      const validatedPath = PathValidator.validateCliPath(directory);
      InteractiveInitializer.showStatus(validatedPath);
    } catch (error) {
      if (error instanceof SecurityError) {
        Logger.error('Security violation:', error.message);
        if (error.context) {
          Logger.debug(`Security details: ${error.context}`);
        }
        process.exit(1);
      }
      Logger.error('Failed to show status:', error);
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
      Logger.error('Failed to show help:', error);
      process.exit(1);
    }
  });

// Parse command line arguments only if this file is run directly
if (require.main === module) {
  program.parse();
}

// Export program for testing
export { program };