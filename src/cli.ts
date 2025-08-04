#!/usr/bin/env node

/**
 * @arkatom/ai-instructions CLI
 * CLI tool to scaffold AI development instructions for ClaudeCode, Cursor, GitHub Copilot and more
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GeneratorFactory, SupportedTool } from './generators/factory';

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
  .option('-t, --tool <tool>', 'AI tool (claude, github-copilot, cursor)', 'claude')
  .option('-l, --lang <language>', 'Language for templates (en, ja, ch)', 'en')
  .option('--force', '⚠️  Force overwrite existing files (DANGEROUS)')
  .option('--preview', '🔍 Preview what files would be created/modified')
  .action(async (options) => {
    try {
      // Validate project name before generating files
      validateProjectName(options.projectName);
      
      // Validate tool option
      if (!GeneratorFactory.isValidTool(options.tool)) {
        throw new Error(`Unsupported tool: ${options.tool}. Supported tools: ${GeneratorFactory.getSupportedTools().join(', ')}`);
      }
      
      // Validate language option
      validateLanguage(options.lang);
      
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
        lang: options.lang as 'en' | 'ja' | 'ch'  // Issue #11: Multi-language support
      });
      
      console.log(`✅ Generated ${generator.getToolName()} template files in ${options.output}`);
      console.log(`📁 Files created for ${generator.getToolName()} AI tool`);
      console.log(`🎯 Project name: ${options.projectName}`);
      
      // 🚨 EMERGENCY PATCH v0.2.1: Safety reminder
      if (!options.force) {
        try {
          const chalk = (await import('chalk')).default;
          console.log(chalk.cyan('💡 Tip: Use --preview to check for conflicts before generating'));
          console.log(chalk.cyan('💡 Tip: Use --force to skip warnings (be careful!)'));
        } catch (error) {
          console.log('💡 Tip: Use --preview to check for conflicts before generating');
          console.log('💡 Tip: Use --force to skip warnings (be careful!)');
        }
      }
    } catch (error) {
      console.error('❌ Failed to generate template files:', error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();