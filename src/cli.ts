/**
 * @arkatom/ai-instructions CLI - Refactored Thin Layer
 * Issue #50: Single Responsibility Principle Fix
 * CLI tool to scaffold AI development instructions
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CommandRegistry } from './cli/CommandRegistry';
import { InitCommand } from './cli/commands/InitCommand';
import { EnvironmentService } from './services/EnvironmentService';
import { InitCommandArgs } from './cli/interfaces/CommandArgs';
import { Logger } from './utils/logger';
import { InteractivePrompts } from './init/prompts';
import { InteractiveInitializer } from './init/interactive';

/**
 * CLI Coordinator - Thin layer for command dispatch
 */
class CLICoordinator {
  private registry: CommandRegistry;
  private program: Command;
  private environmentService: EnvironmentService;

  constructor() {
    this.registry = new CommandRegistry();
    this.program = new Command();
    this.environmentService = new EnvironmentService();
    this.setupProgram();
    this.registerCommands();
  }

  /**
   * Setup basic program configuration
   */
  private setupProgram(): void {
    // Load package.json for version info
    const packageJsonPath = join(__dirname, '../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    this.program
      .name('ai-instructions')
      .description('CLI tool to scaffold AI development instructions')
      .version(packageJson.version, '-v, --version', 'output the current version');
  }

  /**
   * Register all available commands
   */
  private registerCommands(): void {
    // Register InitCommand
    const initCommand = new InitCommand();
    this.registry.register('init', initCommand);

    // Setup init command
    this.program
      .command('init')
      .description('Initialize AI development instructions')
      .option('-o, --output <path>', 'output directory', this.environmentService.getCurrentWorkingDirectory())
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
        await this.executeInitCommand(options);
      });

    // Setup help-interactive command
    this.program
      .command('help-interactive')
      .description('Interactive help and setup guide')
      .action(() => {
        this.showInteractiveHelp();
      });

    // Setup status command  
    this.program
      .command('status')
      .description('Show current configuration status')
      .option('-d, --directory <path>', 'directory to check', this.environmentService.getCurrentWorkingDirectory())
      .action((options) => {
        this.showStatus(options.directory);
      });
  }

  /**
   * Execute init command
   */
  private async executeInitCommand(options: any): Promise<void> {
    try {
      const command = this.registry.get('init');
      if (!command) {
        Logger.error('Init command not found');
        process.exit(1);
      }

      // Convert Commander options to InitCommandArgs
      const args: InitCommandArgs = {
        command: 'init',
        output: options.output,
        projectName: options.projectName,
        tool: options.tool,
        lang: options.lang,
        outputFormat: options.outputFormat,
        force: options.force,
        preview: options.preview,
        conflictResolution: options.conflictResolution,
        interactive: options.interactive,
        backup: options.backup
      };

      const result = await command.execute(args);
      
      if (!result.success) {
        Logger.error(result.error || 'Command execution failed');
        process.exit(1);
      }

    } catch (error) {
      Logger.error('Unexpected error:', error);
      process.exit(1);
    }
  }

  /**
   * Show interactive help
   */
  private showInteractiveHelp(): void {
    InteractivePrompts.showHelp();
  }

  /**
   * Show configuration status
   */
  private showStatus(directory: string): void {
    InteractiveInitializer.showStatus(directory);
  }

  /**
   * Parse and execute CLI
   */
  async run(): Promise<void> {
    await this.program.parseAsync(process.argv);
  }
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const cli = new CLICoordinator();
  await cli.run();
}

// Export for testing
export { CLICoordinator };

// Run CLI if called directly
if (require.main === module) {
  main().catch((error) => {
    Logger.error('CLI execution failed:', error);
    process.exit(1);
  });
}