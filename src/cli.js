#!/usr/bin/env node

/**
 * @arkatom/ai-instructions CLI
 * CLI tool to scaffold AI development instructions for ClaudeCode, Cursor, GitHub Copilot and more
 */

const { Command } = require('commander');
const chalk = require('chalk');
const package = require('../package.json');

const program = new Command();

program
  .name('ai-instructions')
  .description('CLI tool to scaffold AI development instructions')
  .version(package.version);

program
  .command('init')
  .description('Initialize AI development instructions')
  .option('--tool <tool>', 'specific AI tool (claude, cursor, copilot)')
  .option('--all', 'generate for all supported tools')
  .option('--interactive', 'interactive mode')
  .action((options) => {
    console.log(chalk.green('🚧 This functionality will be implemented in Issue #3'));
    console.log(chalk.blue('Options received:'), options);
  });

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

program.parse();