/**
 * Pattern Registry
 * Scans and catalogs available patterns from both Japanese and English versions
 */

import { join, basename } from 'path';
import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { PatternFile, PatternDirectory, PatternCategory, PATTERN_CATEGORIES, PatternSearchResult } from '../interfaces/PatternTypes';
import { Logger } from '../../utils/logger';

export class PatternRegistry {
  private patterns: Map<string, PatternFile> = new Map();
  private directories: Map<string, PatternDirectory> = new Map();
  private categories: Map<string, PatternCategory> = new Map();
  private isInitialized = false;

  constructor() {
    // Initialize categories map
    PATTERN_CATEGORIES.forEach(category => {
      this.categories.set(category.id, category);
    });
  }

  /**
   * Initialize the registry by scanning pattern directories
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      Logger.info('🔍 Scanning pattern directories...');
      
      // Scan Japanese patterns
      await this.scanPatternDirectory('instructions/patterns', 'ja');
      
      // Scan English patterns
      await this.scanPatternDirectory('templates/instructions/patterns', 'en');

      this.isInitialized = true;
      Logger.info(`✅ Pattern registry initialized: ${this.patterns.size} files, ${this.directories.size} directories`);
    } catch (error) {
      Logger.error(`Failed to initialize pattern registry: ${error}`);
      throw error;
    }
  }

  /**
   * Scan a pattern directory recursively
   */
  private async scanPatternDirectory(basePath: string, language: 'ja' | 'en'): Promise<void> {
    if (!existsSync(basePath)) {
      Logger.warn(`Pattern directory not found: ${basePath}`);
      return;
    }

    await this.scanDirectoryRecursive(basePath, basePath, language);
  }

  /**
   * Recursively scan directory for patterns
   */
  private async scanDirectoryRecursive(currentPath: string, basePath: string, language: 'ja' | 'en'): Promise<void> {
    const items = readdirSync(currentPath);
    
    for (const item of items) {
      const fullPath = join(currentPath, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Check if this directory contains pattern files
        const hasPatternFiles = this.hasPatternFiles(fullPath);
        
        if (hasPatternFiles) {
          await this.registerPatternDirectory(fullPath, basePath, language);
        }
        
        // Continue scanning subdirectories
        await this.scanDirectoryRecursive(fullPath, basePath, language);
      } else if (item.endsWith('.md')) {
        await this.registerPatternFile(fullPath, basePath, language);
      }
    }
  }

  /**
   * Check if directory contains markdown pattern files
   */
  private hasPatternFiles(dirPath: string): boolean {
    try {
      const items = readdirSync(dirPath);
      return items.some(item => item.endsWith('.md') && !item.startsWith('.'));
    } catch {
      return false;
    }
  }

  /**
   * Register a pattern directory
   */
  private async registerPatternDirectory(dirPath: string, basePath: string, language: 'ja' | 'en'): Promise<void> {
    const relativePath = this.getRelativePath(dirPath, basePath);
    const dirName = basename(dirPath);
    const category = this.extractCategory(relativePath);
    
    // Find index file
    const indexPath = join(dirPath, 'index.md');
    let indexFile: PatternFile | undefined;
    
    if (existsSync(indexPath)) {
      indexFile = await this.createPatternFile(indexPath, basePath, language);
    }

    // Get all pattern files in directory
    const files: PatternFile[] = [];
    const items = readdirSync(dirPath);
    
    for (const item of items) {
      if (item.endsWith('.md')) {
        const filePath = join(dirPath, item);
        const patternFile = await this.createPatternFile(filePath, basePath, language);
        files.push(patternFile);
      }
    }

    const directory: PatternDirectory = {
      id: `${language}-${relativePath.replace(/[\/\\]/g, '-')}`,
      name: this.formatDirectoryName(dirName),
      description: indexFile?.description || `${dirName} パターン集`,
      path: relativePath,
      category,
      files,
      language,
      ...(indexFile && { indexFile })
    };

    this.directories.set(directory.id, directory);
  }

  /**
   * Register a pattern file
   */
  private async registerPatternFile(filePath: string, basePath: string, language: 'ja' | 'en'): Promise<void> {
    const patternFile = await this.createPatternFile(filePath, basePath, language);
    this.patterns.set(patternFile.id, patternFile);
  }

  /**
   * Create a PatternFile object from file path
   */
  private async createPatternFile(filePath: string, basePath: string, language: 'ja' | 'en'): Promise<PatternFile> {
    const relativePath = this.getRelativePath(filePath, basePath);
    const fileName = basename(filePath, '.md');
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    const category = this.extractCategory(relativePath);
    
    // Extract metadata from front matter or content
    const { title, description, tags } = this.extractMetadata(content, fileName);

    return {
      id: `${language}-${relativePath.replace(/[\/\\]/g, '-').replace('.md', '')}`,
      name: title,
      description: description,
      path: relativePath,
      category,
      tags,
      language,
      lineCount: lines
    };
  }

  /**
   * Get relative path from base path
   */
  private getRelativePath(fullPath: string, basePath: string): string {
    return fullPath.replace(basePath, '').replace(/^[\/\\]/, '');
  }

  /**
   * Extract category from path
   */
  private extractCategory(path: string): string {
    const parts = path.split(/[\/\\]/);
    return parts[0] || 'other';
  }

  /**
   * Extract metadata from markdown content
   */
  private extractMetadata(content: string, fileName: string): { title: string; description: string; tags: string[] } {
    // Try to extract title from first heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = (titleMatch && titleMatch[1]) ? titleMatch[1] : this.formatFileName(fileName);
    
    // Try to extract description from second line or first paragraph
    const lines = content.split('\n').filter(line => line.trim());
    const foundLine = lines.find((line, index) => 
      index > 0 && line.length > 20 && !line.startsWith('#')
    );
    const description = foundLine ? foundLine.substring(0, 100) : `${fileName} patterns and best practices`;

    // Extract tags from content (look for common tag patterns)
    const tags: string[] = [];
    const tagMatches = content.match(/`#\w+`/g);
    if (tagMatches) {
      tags.push(...tagMatches.map(tag => tag.replace(/[`#]/g, '')));
    }
    
    return { title, description, tags };
  }

  /**
   * Format file name for display
   */
  private formatFileName(fileName: string): string {
    return fileName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Format directory name for display
   */
  private formatDirectoryName(dirName: string): string {
    return this.formatFileName(dirName);
  }

  /**
   * Get all available categories
   */
  getCategories(): PatternCategory[] {
    return Array.from(this.categories.values());
  }

  /**
   * Get patterns by category
   */
  getPatternsByCategory(categoryId: string, language?: 'ja' | 'en'): (PatternFile | PatternDirectory)[] {
    const patterns: (PatternFile | PatternDirectory)[] = [];
    
    // Add individual files
    for (const pattern of this.patterns.values()) {
      if (pattern.category === categoryId) {
        if (!language || pattern.language === language) {
          patterns.push(pattern);
        }
      }
    }
    
    // Add directories
    for (const directory of this.directories.values()) {
      if (directory.category === categoryId) {
        if (!language || directory.language === language) {
          patterns.push(directory);
        }
      }
    }
    
    return patterns.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Search patterns by query
   */
  searchPatterns(query: string, language?: 'ja' | 'en'): PatternSearchResult[] {
    const results: PatternSearchResult[] = [];
    const queryLower = query.toLowerCase();
    
    // Search in individual files
    for (const pattern of this.patterns.values()) {
      if (language && pattern.language !== language) continue;
      
      const score = this.calculateSearchScore(pattern, queryLower);
      if (score > 0) {
        results.push({ pattern, score, matches: this.getMatches(pattern, queryLower) });
      }
    }
    
    // Search in directories
    for (const directory of this.directories.values()) {
      if (language && directory.language !== language) continue;
      
      const score = this.calculateSearchScore(directory, queryLower);
      if (score > 0) {
        results.push({ pattern: directory, score, matches: this.getMatches(directory, queryLower) });
      }
    }
    
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate search score for pattern
   */
  private calculateSearchScore(pattern: PatternFile | PatternDirectory, query: string): number {
    let score = 0;
    
    // Exact name match
    if (pattern.name.toLowerCase().includes(query)) {
      score += 10;
    }
    
    // Description match
    if (pattern.description.toLowerCase().includes(query)) {
      score += 5;
    }
    
    // Tag match (for files)
    if ('tags' in pattern) {
      for (const tag of pattern.tags) {
        if (tag.toLowerCase().includes(query)) {
          score += 8;
        }
      }
    }
    
    // Path match
    if (pattern.path.toLowerCase().includes(query)) {
      score += 3;
    }
    
    return score;
  }

  /**
   * Get matching terms for search result
   */
  private getMatches(pattern: PatternFile | PatternDirectory, query: string): string[] {
    const matches: string[] = [];
    
    if (pattern.name.toLowerCase().includes(query)) {
      matches.push('name');
    }
    if (pattern.description.toLowerCase().includes(query)) {
      matches.push('description');
    }
    if ('tags' in pattern) {
      for (const tag of pattern.tags) {
        if (tag.toLowerCase().includes(query)) {
          matches.push(`tag:${tag}`);
        }
      }
    }
    if (pattern.path.toLowerCase().includes(query)) {
      matches.push('path');
    }
    
    return matches;
  }

  /**
   * Get pattern by ID
   */
  getPatternById(id: string): PatternFile | PatternDirectory | undefined {
    return this.patterns.get(id) || this.directories.get(id);
  }

  /**
   * Get total pattern count
   */
  getTotalCount(): { files: number; directories: number } {
    return {
      files: this.patterns.size,
      directories: this.directories.size
    };
  }
}