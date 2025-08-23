/**
 * Patterns Command
 * Interactive pattern selection and management command
 */

import { Command } from '../interfaces/Command';
import { CommandResult } from '../interfaces/CommandResult';
import { ValidationResult } from '../interfaces/ValidationResult';
import { PatternCommandArgs } from '../interfaces/PatternTypes';
import { InteractivePatternSelector } from '../services/InteractivePatternSelector';
import { PatternRegistry } from '../services/PatternRegistry';
import { PatternPreferences } from '../services/PatternPreferences';
import { Logger } from '../../utils/logger';
import chalk from 'chalk';

export class PatternsCommand implements Command {
  private selector: InteractivePatternSelector;
  private registry: PatternRegistry;
  private preferences: PatternPreferences;

  constructor() {
    this.selector = new InteractivePatternSelector();
    this.registry = new PatternRegistry();
    this.preferences = PatternPreferences.getInstance();
  }

  /**
   * Validate patterns command arguments
   */
  validate(args: any): ValidationResult {
    if (args.command !== 'patterns') {
      return {
        isValid: false,
        errors: ['Invalid command type for patterns command']
      };
    }

    const validSubcommands = ['select', 'list', 'search', 'preferences'];
    if (args.subcommand && !validSubcommands.includes(args.subcommand)) {
      return {
        isValid: false,
        errors: [`Invalid subcommand: ${args.subcommand}. Valid options: ${validSubcommands.join(', ')}`]
      };
    }

    if (args.subcommand === 'search' && !args.query) {
      return {
        isValid: false,
        errors: ['Search subcommand requires a query parameter']
      };
    }

    const validLanguages = ['ja', 'en'];
    if (args.language && !validLanguages.includes(args.language)) {
      return {
        isValid: false,
        errors: [`Invalid language: ${args.language}. Valid options: ${validLanguages.join(', ')}`]
      };
    }

    const validFormats = ['table', 'json', 'tree'];
    if (args.format && !validFormats.includes(args.format)) {
      return {
        isValid: false,
        errors: [`Invalid format: ${args.format}. Valid options: ${validFormats.join(', ')}`]
      };
    }

    return { isValid: true, errors: [] };
  }

  /**
   * Execute patterns command
   */
  async execute(args: PatternCommandArgs): Promise<CommandResult> {
    try {
      Logger.debug(`Executing patterns command with args: ${JSON.stringify(args)}`);

      // Initialize services
      await this.selector.initialize();

      switch (args.subcommand || 'select') {
        case 'select':
          return await this.executeSelect(args);
        case 'list':
          return await this.executeList(args);
        case 'search':
          return await this.executeSearch(args);
        case 'preferences':
          return await this.executePreferences(args);
        default:
          return {
            success: false,
            error: `Unknown subcommand: ${args.subcommand}`
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error(`Patterns command failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Execute interactive pattern selection
   */
  private async executeSelect(args: PatternCommandArgs): Promise<CommandResult> {
    try {
      // Apply any provided preferences
      if (args.language) {
        this.preferences.setLanguage(args.language);
      }

      // Start interactive selection
      await this.selector.selectPattern();

      return {
        success: true,
        message: 'Pattern selection completed'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Pattern selection failed: ${errorMessage}`
      };
    }
  }

  /**
   * Execute pattern listing
   */
  private async executeList(args: PatternCommandArgs): Promise<CommandResult> {
    try {
      await this.registry.initialize();

      const categories = this.registry.getCategories();
      const language = args.language || this.preferences.getLanguage();
      const format = args.format || 'table';

      if (args.category) {
        // List patterns in specific category
        const patterns = this.registry.getPatternsByCategory(args.category, language);
        await this.displayPatterns(patterns, args.category, format);
      } else {
        // List all categories
        await this.displayCategories(categories, format);
      }

      return {
        success: true,
        message: `Listed patterns (${format} format)`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Pattern listing failed: ${errorMessage}`
      };
    }
  }

  /**
   * Execute pattern search
   */
  private async executeSearch(args: PatternCommandArgs): Promise<CommandResult> {
    if (!args.query) {
      return {
        success: false,
        error: 'Search query is required'
      };
    }

    try {
      await this.registry.initialize();

      const language = args.language || this.preferences.getLanguage();
      const results = this.registry.searchPatterns(args.query, language);
      const format = args.format || 'table';

      await this.displaySearchResults(results, args.query, format);

      return {
        success: true,
        message: `Found ${results.length} results for "${args.query}"`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Pattern search failed: ${errorMessage}`
      };
    }
  }

  /**
   * Execute preferences management
   */
  private async executePreferences(args: PatternCommandArgs): Promise<CommandResult> {
    try {
      if (args.reset) {
        this.preferences.reset();
        Logger.info(chalk.green('✅ Preferences reset to defaults'));
        return {
          success: true,
          message: 'Preferences reset successfully'
        };
      }

      // Apply any provided preference updates
      if (args.language) {
        this.preferences.setLanguage(args.language);
        Logger.info(chalk.green(`✅ Language set to: ${args.language}`));
      }

      // Display current preferences
      Logger.info(chalk.blue('\\nCurrent Preferences:'));
      Logger.info(this.preferences.getSummary());

      return {
        success: true,
        message: 'Preferences displayed'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Preferences management failed: ${errorMessage}`
      };
    }
  }

  /**
   * Display categories
   */
  private async displayCategories(categories: any[], format: string): Promise<void> {
    Logger.info(chalk.cyan('📂 Available Pattern Categories:\\n'));

    switch (format) {
      case 'json':
        console.log(JSON.stringify(categories, null, 2));
        break;
      case 'tree':
        categories.forEach(cat => {
          Logger.info(`├── ${cat.icon} ${chalk.bold(cat.name)}`);
          Logger.info(`│   ${chalk.gray(cat.description)}`);
        });
        break;
      default: // table
        categories.forEach(cat => {
          Logger.info(`${cat.icon} ${chalk.bold(cat.name)}`);
          Logger.info(`   ${chalk.gray(cat.description)}\\n`);
        });
        break;
    }
  }

  /**
   * Display patterns
   */
  private async displayPatterns(patterns: any[], category: string, format: string): Promise<void> {
    Logger.info(chalk.cyan(`📋 Patterns in category: ${category}\\n`));

    if (patterns.length === 0) {
      Logger.warn('No patterns found in this category');
      return;
    }

    switch (format) {
      case 'json':
        console.log(JSON.stringify(patterns, null, 2));
        break;
      case 'tree':
        patterns.forEach((pattern, index) => {
          const isLast = index === patterns.length - 1;
          const prefix = isLast ? '└──' : '├──';
          const icon = 'files' in pattern ? '📂' : '📄';
          Logger.info(`${prefix} ${icon} ${chalk.bold(pattern.name)}`);
          Logger.info(`${isLast ? '   ' : '│  '} ${chalk.gray(pattern.description)}`);
        });
        break;
      default: // table
        patterns.forEach(pattern => {
          const icon = 'files' in pattern ? '📂' : '📄';
          const type = 'files' in pattern ? 'collection' : 'file';
          const extra = 'files' in pattern 
            ? `${pattern.files.length} files` 
            : `${pattern.lineCount} lines`;
          
          Logger.info(`${icon} ${chalk.bold(pattern.name)} (${type}, ${extra})`);
          Logger.info(`   ${chalk.gray(pattern.description)}`);
          Logger.info(`   ${chalk.dim(pattern.path)}\\n`);
        });
        break;
    }
  }

  /**
   * Display search results
   */
  private async displaySearchResults(results: any[], query: string, format: string): Promise<void> {
    Logger.info(chalk.cyan(`🔍 Search results for: "${query}"\\n`));

    if (results.length === 0) {
      Logger.warn('No patterns found matching your search');
      return;
    }

    switch (format) {
      case 'json':
        console.log(JSON.stringify(results, null, 2));
        break;
      case 'tree':
        results.slice(0, 10).forEach((result, index) => {
          const pattern = result.pattern;
          const isLast = index === results.length - 1 || index === 9;
          const prefix = isLast ? '└──' : '├──';
          const icon = 'files' in pattern ? '📂' : '📄';
          Logger.info(`${prefix} ${icon} ${chalk.bold(pattern.name)} (score: ${result.score})`);
          Logger.info(`${isLast ? '   ' : '│  '} ${chalk.gray(pattern.description)}`);
          Logger.info(`${isLast ? '   ' : '│  '} ${chalk.dim('matches: ' + result.matches.join(', '))}`);
        });
        break;
      default: // table
        results.slice(0, 10).forEach(result => {
          const pattern = result.pattern;
          const icon = 'files' in pattern ? '📂' : '📄';
          Logger.info(`${icon} ${chalk.bold(pattern.name)} ${chalk.yellow(`(${result.score})`)}`);
          Logger.info(`   ${chalk.gray(pattern.description)}`);
          Logger.info(`   ${chalk.dim('matches: ' + result.matches.join(', '))}\\n`);
        });
        break;
    }

    if (results.length > 10) {
      Logger.info(chalk.dim(`... and ${results.length - 10} more results`));
    }
  }
}