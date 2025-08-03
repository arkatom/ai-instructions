#!/usr/bin/env node

/**
 * @arkatom/ai-instructions CLI
 * CLI tool to scaffold AI development instructions for ClaudeCode, Cursor, GitHub Copilot and more
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ClaudeGenerator } from './generators/claude';

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
  .action(async (options) => {
    try {
      // Validate project name before generating files
      validateProjectName(options.projectName);
      
      const generator = new ClaudeGenerator();
      await generator.generateFiles(options.output, { 
        projectName: options.projectName 
      });
      
      console.log(`✅ Generated Claude Code template files in ${options.output}`);
      console.log(`📁 CLAUDE.md and instructions/ directory created`);
      console.log(`🎯 Project name: ${options.projectName}`);
    } catch (error) {
      console.error('❌ Failed to generate template files:', error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();