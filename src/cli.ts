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
import { AgentsCommand } from './cli/commands/AgentsCommand';
import { EnvironmentService } from './services/EnvironmentService';
import { InitCommandArgs, CommanderInitOptions, AgentCommandArgs } from './cli/interfaces/CommandArgs';
import { Logger } from './utils/logger';
import { ErrorHandler } from './utils/error-handler';
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

    // Register AgentsCommand
    const agentsCommand = new AgentsCommand();
    this.registry.register('agents', agentsCommand);

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

    // Setup agents command with subcommands
    const agentsCmd = this.program
      .command('agents')
      .description('Agent deployment and management commands');

    // agents list subcommand
    agentsCmd
      .command('list')
      .description('List available agents')
      .option('-c, --category <category>', 'filter by category')
      .option('-f, --format <format>', 'output format (table, json, tree)', 'table')
      .action(async (options) => {
        await this.executeAgentsCommand('list', options);
      });

    // agents recommend subcommand
    agentsCmd
      .command('recommend')
      .description('Recommend agents for your project')
      .option('-c, --category <category>', 'filter by category')
      .option('-f, --format <format>', 'output format (table, json, tree)', 'table')
      .action(async (options) => {
        await this.executeAgentsCommand('recommend', options);
      });

    // agents info subcommand
    agentsCmd
      .command('info <name>')
      .description('Show detailed information about an agent')
      .option('-f, --format <format>', 'output format (table, json, tree)', 'table')
      .action(async (name, options) => {
        await this.executeAgentsCommand('info', { ...options, name });
      });

    // agents deploy subcommand
    agentsCmd
      .command('deploy <agents...>')
      .description('Deploy agents to your project')
      .option('-o, --output <path>', 'output directory', './.claude/agents')
      .option('--action <action>', 'deployment action')
      .action(async (agents, options) => {
        await this.executeAgentsCommand('deploy', { ...options, agents });
      });

    // agents deploy-all subcommand
    agentsCmd
      .command('deploy-all')
      .description('Deploy all available agents to your project')
      .option('-o, --output <path>', 'output directory', './.claude/agents')
      .action(async (options) => {
        await this.executeAgentsCommand('deploy-all', options);
      });

    // agents profile subcommand
    agentsCmd
      .command('profile <project>')
      .description('Profile project and recommend agents')
      .option('-f, --format <format>', 'output format (table, json, tree)', 'table')
      .option('-v, --verbose', 'show detailed analysis')
      .action(async (project, options) => {
        await this.executeAgentsCommand('profile', { ...options, project });
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
  private async executeInitCommand(options: CommanderInitOptions): Promise<void> {
    try {
      const command = this.registry.get('init');
      if (!command) {
        Logger.error('Init command not found');
        process.exit(1);
      }

      // Convert Commander options to InitCommandArgs
      const args: InitCommandArgs = {
        command: 'init',
        ...(options.output !== undefined && { output: options.output }),
        ...(options.projectName !== undefined && { projectName: options.projectName }),
        ...(options.tool !== undefined && { tool: options.tool }),
        ...(options.lang !== undefined && { lang: options.lang }),
        ...(options.outputFormat !== undefined && { outputFormat: options.outputFormat }),
        ...(options.force !== undefined && { force: options.force }),
        ...(options.preview !== undefined && { preview: options.preview }),
        ...(options.conflictResolution !== undefined && { conflictResolution: options.conflictResolution }),
        ...(options.interactive !== undefined && { interactive: options.interactive }),
        ...(options.backup !== undefined && { backup: options.backup })
      };

      const result = await command.execute(args);
      
      if (!result.success) {
        Logger.error(result.error || 'Command execution failed');
        process.exit(1);
      }

    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      ErrorHandler.handleError(errorObj);
    }
  }

  /**
   * Execute agents command
   */
  private async executeAgentsCommand(
    subcommand: string,
    options: any
  ): Promise<void> {
    try {
      const command = this.registry.get('agents');
      if (!command) {
        Logger.error('Agents command not found');
        process.exit(1);
      }

      // Convert options to AgentCommandArgs
      const args: AgentCommandArgs = {
        command: 'agents',
        subcommand: subcommand as 'list' | 'recommend' | 'deploy' | 'deploy-all' | 'info' | 'profile',
        ...options
      };

      const result = await command.execute(args);

      if (!result.success) {
        Logger.error(result.error || 'Command execution failed');
        process.exit(1);
      }

    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      ErrorHandler.handleError(errorObj);
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
    const errorObj = error instanceof Error ? error : new Error(String(error));
    ErrorHandler.handleError(errorObj);
  });
}