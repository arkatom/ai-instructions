/**
 * Pattern Preferences Service
 * Handles user preferences for pattern selection
 */

import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { UserPreferences } from '../interfaces/PatternTypes';
import { Logger } from '../../utils/logger';

export class PatternPreferences {
  private static instance: PatternPreferences;
  private preferencesPath: string;
  private preferences: UserPreferences;

  private constructor() {
    const configDir = join(homedir(), '.ai-instructions');
    this.preferencesPath = join(configDir, 'pattern-preferences.json');
    this.preferences = this.loadPreferences();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PatternPreferences {
    if (!PatternPreferences.instance) {
      PatternPreferences.instance = new PatternPreferences();
    }
    return PatternPreferences.instance;
  }

  /**
   * Load preferences from file system
   */
  private loadPreferences(): UserPreferences {
    const defaults: UserPreferences = {
      language: 'ja',
      openMethod: 'code'
    };

    if (!existsSync(this.preferencesPath)) {
      return defaults;
    }

    try {
      const content = readFileSync(this.preferencesPath, 'utf-8');
      const saved = JSON.parse(content);
      return { ...defaults, ...saved };
    } catch (error) {
      Logger.warn(`Failed to load preferences: ${error}`);
      return defaults;
    }
  }

  /**
   * Save preferences to file system
   */
  private savePreferences(): void {
    try {
      const configDir = join(homedir(), '.ai-instructions');
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }

      writeFileSync(this.preferencesPath, JSON.stringify(this.preferences, null, 2));
      Logger.debug('Preferences saved successfully');
    } catch (error) {
      Logger.error(`Failed to save preferences: ${error}`);
    }
  }

  /**
   * Get current preferences
   */
  getPreferences(): UserPreferences {
    return { ...this.preferences };
  }

  /**
   * Update preferences
   */
  updatePreferences(updates: Partial<UserPreferences>): void {
    this.preferences = { ...this.preferences, ...updates };
    this.savePreferences();
  }

  /**
   * Get preferred language
   */
  getLanguage(): 'ja' | 'en' {
    return this.preferences.language;
  }

  /**
   * Set preferred language
   */
  setLanguage(language: 'ja' | 'en'): void {
    this.updatePreferences({ language });
  }

  /**
   * Get last used category
   */
  getLastCategory(): string | undefined {
    return this.preferences.lastCategory;
  }

  /**
   * Set last used category
   */
  setLastCategory(category: string): void {
    this.updatePreferences({ lastCategory: category });
  }

  /**
   * Get last used pattern
   */
  getLastPattern(): string | undefined {
    return this.preferences.lastPattern;
  }

  /**
   * Set last used pattern
   */
  setLastPattern(pattern: string): void {
    this.updatePreferences({ lastPattern: pattern });
  }

  /**
   * Get preferred open method
   */
  getOpenMethod(): 'code' | 'cat' | 'less' | 'browser' {
    return this.preferences.openMethod;
  }

  /**
   * Set preferred open method
   */
  setOpenMethod(method: 'code' | 'cat' | 'less' | 'browser'): void {
    this.updatePreferences({ openMethod: method });
  }

  /**
   * Reset preferences to defaults
   */
  reset(): void {
    this.preferences = {
      language: 'ja',
      openMethod: 'code'
    };
    this.savePreferences();
    Logger.info('Preferences reset to defaults');
  }

  /**
   * Get preferences summary for display
   */
  getSummary(): string {
    const prefs = this.preferences;
    return [
      `Language: ${prefs.language === 'ja' ? '日本語' : 'English'}`,
      `Open method: ${prefs.openMethod}`,
      prefs.lastCategory ? `Last category: ${prefs.lastCategory}` : null,
      prefs.lastPattern ? `Last pattern: ${prefs.lastPattern}` : null
    ].filter(Boolean).join('\\n');
  }
}