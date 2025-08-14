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
interface InitOptions {
  interactive?: boolean;
  tool?: string;
  projectName?: string;
  lang?: string;
  outputFormat?: string;
  output?: string;
  force?: boolean;
  preview?: boolean;
  conflictResolution?: string;
  backup?: boolean;
}

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
  const configOptions = ['tool', 'projectName', 'lang', 'outputFormat'] as const;
  const hasConfigOptions = configOptions.some(opt => {
    const originalValue = opt === 'projectName' ? 'my-project' : 
                          opt === 'tool' ? 'claude' :
                          opt === 'lang' ? 'ja' :
                          opt === 'outputFormat' ? 'claude' : undefined;
    return options[opt as keyof InitOptions] && options[opt as keyof InitOptions] !== originalValue;
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

function validateInitOptions(options: unknown): void {
  const opts = options as Record<string, unknown>;
  
  // Validate project name before generating files
  validateProjectName(opts.projectName as string);
  
  // Validate tool option
  if (!GeneratorFactory.isValidTool(opts.tool as string)) {
    throw new Error(`Unsupported tool: ${opts.tool}. Supported tools: ${GeneratorFactory.getSupportedTools().join(', ')}`);
  }
  
  // Validate language option
  validateLanguage(opts.lang as string);
  
  // Validate output format option
  validateOutputFormat(opts.outputFormat as string);
  
  // Validate output directory path
  validateOutputDirectory(opts.output as string);
  
  // Validate conflict resolution strategy
  validateConflictResolution(opts.conflictResolution as string);
}

async function handlePreviewMode(options: unknown): Promise<void> {
  const opts = options as Record<string, unknown>;
  
  try {
    const chalk = (await import('chalk')).default;
    Logger.info(chalk.blue('🔍 Preview mode: Analyzing potential file conflicts...'));
    Logger.warn('Preview functionality will be enhanced in v0.3.0');
    Logger.warn('For now, manually check if CLAUDE.md and instructions/ exist in target directory');
    Logger.item('📍 Target directory:', opts.output as string);
    Logger.item('🤖 Tool:', opts.tool as string);
    Logger.item('📦 Project name:', opts.projectName as string);
    Logger.item('🌍 Language:', opts.lang as string);
  } catch {
    Logger.info('🔍 Preview mode: Analyzing potential file conflicts...');
    Logger.warn('Preview functionality will be enhanced in v0.3.0');
    Logger.warn('For now, manually check if CLAUDE.md and instructions/ exist in target directory');
    Logger.item('📍 Target directory:', opts.output as string);
    Logger.item('🤖 Tool:', opts.tool as string);
    Logger.item('📦 Project name:', opts.projectName as string);
    Logger.item('🌍 Language:', opts.lang as string);
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

async function generateTemplateFiles(validatedOutputDir: string, options: unknown): Promise<void> {
  const opts = options as Record<string, unknown>;
  const generator = GeneratorFactory.createGenerator(opts.tool as SupportedTool);
  await generator.generateFiles(validatedOutputDir, { 
    projectName: opts.projectName as string,
    force: (opts.force as boolean) || false,  // 🚨 EMERGENCY PATCH v0.2.1: Pass force flag
    lang: opts.lang as 'en' | 'ja' | 'ch',  // Issue #11: Multi-language support
    outputFormat: opts.outputFormat as OutputFormat,  // Output format support
    // 🚀 v0.5.0: Advanced file conflict resolution options
    conflictResolution: (opts.conflictResolution as string) || 'backup',
    interactive: opts.interactive !== false,  // Default to true unless --no-interactive
    backup: opts.backup !== false  // Default to true unless --no-backup
  });
  
  Logger.success(`Generated ${generator.getToolName()} template files in ${validatedOutputDir}`);
  Logger.info(`📁 Files created for ${generator.getToolName()} AI tool`);
  Logger.item('🎯 Project name:', opts.projectName as string);
  
  // Show format conversion message when output-format is used
  if (opts.outputFormat && opts.outputFormat !== 'claude') {
    Logger.info(`🔄 Converted from Claude format to ${opts.outputFormat}`);
  }
  
  // 🚨 EMERGENCY PATCH v0.2.1: Safety reminder
  if (!opts.force) {
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
  .action(async (options) => {
    try {
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
      
      // Validate all options
      validateInitOptions(options);
      
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
  .action(async (options) => {
    try {
      // Validate directory path for security
      const validatedPath = PathValidator.validateCliPath(options.directory);
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