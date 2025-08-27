/**
 * Interactive Pattern Selector
 * Provides interactive CLI interface for pattern selection
 */

import inquirer from 'inquirer';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { PatternRegistry } from './PatternRegistry';
import { PatternPreferences } from './PatternPreferences';
import { PatternFile, PatternDirectory, PatternCategory, UserPreferences } from '../interfaces/PatternTypes';
import { Logger } from '../../utils/logger';

export class InteractivePatternSelector {
  private registry: PatternRegistry;
  private preferences: PatternPreferences;

  constructor() {
    this.registry = new PatternRegistry();
    this.preferences = PatternPreferences.getInstance();
  }

  /**
   * Initialize the selector
   */
  async initialize(): Promise<void> {
    await this.registry.initialize();
  }

  /**
   * Start interactive pattern selection flow
   */
  async selectPattern(): Promise<void> {
    try {
      Logger.info(chalk.cyan('🎯 AI Instructions Pattern Selector'));
      Logger.info(chalk.gray('Navigate through patterns with ease\\n'));

      // Show welcome and current preferences
      await this.showWelcome();

      // Main selection loop
      let continueSelecting = true;
      while (continueSelecting) {
        const action = await this.selectMainAction();
        
        switch (action) {
          case 'browse':
            await this.browsePatterns();
            break;
          case 'search':
            await this.searchPatterns();
            break;
          case 'recent':
            await this.showRecentPatterns();
            break;
          case 'preferences':
            await this.configurePreferences();
            break;
          case 'exit':
            continueSelecting = false;
            break;
        }
      }

      Logger.info(chalk.green('👋 Happy coding!'));
    } catch (error) {
      Logger.error(`Pattern selection failed: ${error}`);
      throw error;
    }
  }

  /**
   * Show welcome message with current preferences
   */
  private async showWelcome(): Promise<void> {
    const prefs = this.preferences.getPreferences();
    const counts = this.registry.getTotalCount();
    
    Logger.info(chalk.blue('Current Settings:'));
    Logger.info(`  Language: ${prefs.language === 'ja' ? '🇯🇵 日本語' : '🇺🇸 English'}`);
    Logger.info(`  Open method: ${this.getOpenMethodIcon(prefs.openMethod)} ${prefs.openMethod}`);
    Logger.info(`  Available: ${counts.files} files, ${counts.directories} collections\\n`);
  }

  /**
   * Select main action
   */
  private async selectMainAction(): Promise<string> {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '📂 Browse by category', value: 'browse' },
          { name: '🔍 Search patterns', value: 'search' },
          { name: '📖 Recent patterns', value: 'recent' },
          { name: '⚙️  Configure preferences', value: 'preferences' },
          { name: '🚪 Exit', value: 'exit' }
        ]
      }
    ]);
    
    return action;
  }

  /**
   * Browse patterns by category
   */
  private async browsePatterns(): Promise<void> {
    const language = this.preferences.getLanguage();
    const categories = this.registry.getCategories();
    
    // Select category
    const { categoryId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'categoryId',
        message: 'Select a category:',
        choices: categories.map(cat => ({
          name: `${cat.icon} ${cat.name} - ${cat.description}`,
          value: cat.id
        })),
        default: this.preferences.getLastCategory()
      }
    ]);

    this.preferences.setLastCategory(categoryId);
    const patterns = this.registry.getPatternsByCategory(categoryId, language);

    if (patterns.length === 0) {
      Logger.warn(`No patterns found in category: ${categoryId}`);
      return;
    }

    // Select pattern
    const { patternId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'patternId',
        message: 'Select a pattern:',
        choices: [
          { name: chalk.gray('← Back to categories'), value: 'back' },
          ...patterns.map(pattern => ({
            name: this.formatPatternChoice(pattern),
            value: pattern.id
          }))
        ]
      }
    ]);

    if (patternId === 'back') {
      return await this.browsePatterns();
    }

    const selectedPattern = this.registry.getPatternById(patternId);
    if (selectedPattern) {
      this.preferences.setLastPattern(patternId);
      await this.handlePatternSelection(selectedPattern);
    }
  }

  /**
   * Search patterns
   */
  private async searchPatterns(): Promise<void> {
    const { query } = await inquirer.prompt([
      {
        type: 'input',
        name: 'query',
        message: 'Enter search term:',
        validate: (input: string) => input.trim().length > 0 || 'Please enter a search term'
      }
    ]);

    const language = this.preferences.getLanguage();
    const results = this.registry.searchPatterns(query, language);

    if (results.length === 0) {
      Logger.warn(`No patterns found for: ${query}`);
      return;
    }

    Logger.info(`\\n🔍 Found ${results.length} results for "${query}":`);

    const { patternId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'patternId',
        message: 'Select a pattern:',
        choices: [
          { name: chalk.gray('← New search'), value: 'search_again' },
          ...results.slice(0, 10).map(result => ({
            name: this.formatSearchResult(result),
            value: result.pattern.id
          }))
        ]
      }
    ]);

    if (patternId === 'search_again') {
      return await this.searchPatterns();
    }

    const selectedPattern = this.registry.getPatternById(patternId);
    if (selectedPattern) {
      await this.handlePatternSelection(selectedPattern);
    }
  }

  /**
   * Show recent patterns
   */
  private async showRecentPatterns(): Promise<void> {
    const lastCategory = this.preferences.getLastCategory();
    const lastPattern = this.preferences.getLastPattern();

    if (!lastCategory && !lastPattern) {
      Logger.info('No recent patterns found.');
      return;
    }

    Logger.info('📖 Recent activity:');
    if (lastCategory) Logger.info(`  Last category: ${lastCategory}`);
    if (lastPattern) {
      const pattern = this.registry.getPatternById(lastPattern);
      if (pattern) {
        Logger.info(`  Last pattern: ${pattern.name}`);
        
        const { openLast } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'openLast',
            message: 'Open last used pattern?',
            default: true
          }
        ]);

        if (openLast) {
          await this.handlePatternSelection(pattern);
        }
      }
    }
  }

  /**
   * Configure user preferences
   */
  private async configurePreferences(): Promise<void> {
    const currentPrefs = this.preferences.getPreferences();

    Logger.info('\\n⚙️  Current Preferences:');
    Logger.info(this.preferences.getSummary());

    const { setting } = await inquirer.prompt([
      {
        type: 'list',
        name: 'setting',
        message: 'What would you like to configure?',
        choices: [
          { name: '🌐 Language', value: 'language' },
          { name: '📖 Open method', value: 'openMethod' },
          { name: '🗑️  Reset all preferences', value: 'reset' },
          { name: '← Back', value: 'back' }
        ]
      }
    ]);

    switch (setting) {
      case 'language':
        await this.configureLanguage();
        break;
      case 'openMethod':
        await this.configureOpenMethod();
        break;
      case 'reset':
        await this.resetPreferences();
        break;
      case 'back':
        return;
    }
  }

  /**
   * Configure language preference
   */
  private async configureLanguage(): Promise<void> {
    const { language } = await inquirer.prompt([
      {
        type: 'list',
        name: 'language',
        message: 'Select preferred language:',
        choices: [
          { name: '🇯🇵 日本語 (Japanese)', value: 'ja' },
          { name: '🇺🇸 English', value: 'en' }
        ],
        default: this.preferences.getLanguage()
      }
    ]);

    this.preferences.setLanguage(language);
    Logger.info(chalk.green(`✅ Language set to: ${language === 'ja' ? '日本語' : 'English'}`));
  }

  /**
   * Configure open method preference
   */
  private async configureOpenMethod(): Promise<void> {
    const { method } = await inquirer.prompt([
      {
        type: 'list',
        name: 'method',
        message: 'How should patterns be opened?',
        choices: [
          { name: '💻 VS Code (code)', value: 'code' },
          { name: '📄 Terminal display (cat)', value: 'cat' },
          { name: '📖 Pager (less)', value: 'less' },
          { name: '🌐 Browser', value: 'browser' }
        ],
        default: this.preferences.getOpenMethod()
      }
    ]);

    this.preferences.setOpenMethod(method);
    Logger.info(chalk.green(`✅ Open method set to: ${method}`));
  }

  /**
   * Reset all preferences
   */
  private async resetPreferences(): Promise<void> {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to reset all preferences?',
        default: false
      }
    ]);

    if (confirm) {
      this.preferences.reset();
      Logger.info(chalk.green('✅ Preferences reset to defaults'));
    }
  }

  /**
   * Handle pattern selection and opening
   */
  private async handlePatternSelection(pattern: PatternFile | PatternDirectory): Promise<void> {
    Logger.info(`\\n📋 Selected: ${chalk.cyan(pattern.name)}`);
    Logger.info(`   ${pattern.description}`);
    Logger.info(`   Path: ${pattern.path}`);

    if ('files' in pattern) {
      // Directory - show files
      Logger.info(`   Contains: ${pattern.files.length} files`);
      
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '📂 Browse files in this collection', value: 'browse_files' },
            { name: '📖 Open index file', value: 'open_index' },
            { name: '💻 Open entire directory', value: 'open_directory' }
          ]
        }
      ]);

      switch (action) {
        case 'browse_files':
          await this.browseDirectoryFiles(pattern);
          break;
        case 'open_index':
          if (pattern.indexFile) {
            await this.openPattern(pattern.indexFile);
          } else {
            Logger.warn('No index file found');
          }
          break;
        case 'open_directory':
          await this.openDirectory(pattern);
          break;
      }
    } else {
      // Individual file
      Logger.info(`   Lines: ${pattern.lineCount}`);
      Logger.info(`   Tags: ${pattern.tags.join(', ')}`);
      
      await this.openPattern(pattern);
    }
  }

  /**
   * Browse files within a directory
   */
  private async browseDirectoryFiles(directory: PatternDirectory): Promise<void> {
    const { fileId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'fileId',
        message: 'Select a file:',
        choices: [
          { name: chalk.gray('← Back'), value: 'back' },
          ...directory.files.map(file => ({
            name: `📄 ${file.name} (${file.lineCount} lines)`,
            value: file.id
          }))
        ]
      }
    ]);

    if (fileId === 'back') {
      return;
    }

    const file = directory.files.find(f => f.id === fileId);
    if (file) {
      await this.openPattern(file);
    }
  }

  /**
   * Open a pattern file
   */
  private async openPattern(pattern: PatternFile): Promise<void> {
    const method = this.preferences.getOpenMethod();
    const fullPath = this.getFullPath(pattern.path);

    if (!existsSync(fullPath)) {
      Logger.error(`File not found: ${fullPath}`);
      return;
    }

    Logger.info(`\\n📖 Opening ${pattern.name} with ${method}...`);

    try {
      switch (method) {
        case 'code':
          spawn('code', [fullPath], { detached: true, stdio: 'ignore' });
          break;
        case 'cat':
          spawn('cat', [fullPath], { stdio: 'inherit' });
          break;
        case 'less':
          spawn('less', [fullPath], { stdio: 'inherit' });
          break;
        case 'browser':
          const url = `file://${fullPath}`;
          spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' });
          break;
      }
    } catch (error) {
      Logger.error(`Failed to open pattern: ${error}`);
    }
  }

  /**
   * Open a pattern directory
   */
  private async openDirectory(directory: PatternDirectory): Promise<void> {
    const method = this.preferences.getOpenMethod();
    const fullPath = this.getFullPath(directory.path);

    Logger.info(`\\n📂 Opening directory with ${method}...`);

    try {
      switch (method) {
        case 'code':
          spawn('code', [fullPath], { detached: true, stdio: 'ignore' });
          break;
        default:
          // For other methods, just open the index file
          if (directory.indexFile) {
            await this.openPattern(directory.indexFile);
          }
          break;
      }
    } catch (error) {
      Logger.error(`Failed to open directory: ${error}`);
    }
  }

  /**
   * Get full file path
   */
  private getFullPath(relativePath: string): string {
    // Check if it's an English template path
    if (relativePath.startsWith('templates/')) {
      return relativePath;
    } else {
      return join('references/patterns', relativePath);
    }
  }

  /**
   * Format pattern choice for display
   */
  private formatPatternChoice(pattern: PatternFile | PatternDirectory): string {
    const icon = 'files' in pattern ? '📂' : '📄';
    const type = 'files' in pattern ? 'collection' : 'file';
    const extra = 'files' in pattern 
      ? `${pattern.files.length} files` 
      : `${pattern.lineCount} lines`;
    
    return `${icon} ${pattern.name} (${type}, ${extra})`;
  }

  /**
   * Format search result for display
   */
  private formatSearchResult(result: any): string {
    const pattern = result.pattern;
    const score = result.score;
    const matches = result.matches.join(', ');
    const icon = 'files' in pattern ? '📂' : '📄';
    
    return `${icon} ${pattern.name} (score: ${score}, matches: ${matches})`;
  }

  /**
   * Get open method icon
   */
  private getOpenMethodIcon(method: string): string {
    const icons = {
      'code': '💻',
      'cat': '📄',
      'less': '📖',
      'browser': '🌐'
    };
    return icons[method as keyof typeof icons] || '📄';
  }
}