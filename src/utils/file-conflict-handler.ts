/**
 * FileConflictHandler - Advanced File Overwrite Safety System
 * Issue #26: Comprehensive file conflict resolution with 5 options
 * 
 * This class provides intelligent file conflict resolution with multiple strategies:
 * - Backup: Create timestamped backup and write new file
 * - Merge: Intelligently merge existing and new content
 * - Interactive: Let user select which lines to keep
 * - Skip: Leave existing file unchanged
 * - Overwrite: Replace existing file (current behavior)
 */

import { existsSync, readFileSync, statSync } from 'fs';
import { copyFile, writeFile, mkdir } from 'fs/promises';
import { extname, join, dirname, basename, relative } from 'path';
import inquirer from 'inquirer';
import { EnvironmentService } from '../services/EnvironmentService';

/**
 * Represents a markdown section with header and content
 */
interface MarkdownSection {
  header: string;
  content: string[];
}

export enum ConflictResolution {
  BACKUP = 'backup',
  MERGE = 'merge', 
  INTERACTIVE = 'interactive',
  SKIP = 'skip',
  OVERWRITE = 'overwrite'
}

export interface ConflictInfo {
  filePath: string;
  existingContent: string;
  newContent: string;
  fileSize: number;
  lastModified: Date;
}

export class FileConflictHandler {
  private environmentService: EnvironmentService;

  constructor() {
    this.environmentService = new EnvironmentService();
  }
  /**
   * Detect if a file conflict exists
   */
  async detectConflict(filePath: string): Promise<boolean> {
    try {
      return existsSync(filePath);
    } catch {
      // If we can't access the file, assume no conflict
      return false;
    }
  }

  /**
   * Get detailed information about the conflict
   */
  async getConflictInfo(filePath: string, newContent: string): Promise<ConflictInfo> {
    const existingContent = readFileSync(filePath, 'utf-8');
    const stats = statSync(filePath);
    
    return {
      filePath,
      existingContent,
      newContent,
      fileSize: stats.size,
      lastModified: stats.mtime
    };
  }

  /**
   * Prompt user for conflict resolution strategy
   */
  async promptForResolution(filePath: string, existingContent: string, newContent: string): Promise<ConflictResolution> {
    const stats = statSync(filePath);
    
    console.warn(`\n🚨 File conflict detected: ${filePath}`);
    console.warn(`📊 Existing file: ${stats.size} bytes, modified ${stats.mtime.toLocaleString()}`);
    console.warn(`📊 New content: ${newContent.length} bytes`);
    
    const { resolution } = await inquirer.prompt([
      {
        type: 'list',
        name: 'resolution',
        message: 'How would you like to resolve this conflict?',
        choices: [
          {
            name: '📦 Backup existing and create new file',
            value: ConflictResolution.BACKUP,
            short: 'Backup'
          },
          {
            name: '🔀 Merge content intelligently',
            value: ConflictResolution.MERGE,
            short: 'Merge'
          },
          {
            name: '✋ Interactive selection (choose which lines to keep)',
            value: ConflictResolution.INTERACTIVE,
            short: 'Interactive'
          },
          {
            name: '⏭️  Skip file creation (keep existing)',
            value: ConflictResolution.SKIP,
            short: 'Skip'
          },
          {
            name: '⚠️  Overwrite existing file',
            value: ConflictResolution.OVERWRITE,
            short: 'Overwrite'
          }
        ],
        default: ConflictResolution.BACKUP
      }
    ]);

    return resolution;
  }

  /**
   * Resolve conflict using the specified strategy
   */
  async resolveConflict(filePath: string, newContent: string, resolution: ConflictResolution): Promise<void> {
    const existingContent = readFileSync(filePath, 'utf-8');

    switch (resolution) {
      case ConflictResolution.BACKUP:
        await this.createTimestampedBackup(filePath);
        await writeFile(filePath, newContent, 'utf-8');
        console.warn(`✅ Backup created and new file written: ${filePath}`);
        break;

      case ConflictResolution.MERGE: {
        const mergedContent = await this.mergeContent(existingContent, newContent, filePath);
        await writeFile(filePath, mergedContent, 'utf-8');
        console.warn(`✅ Content merged: ${filePath}`);
        break;
      }

      case ConflictResolution.INTERACTIVE: {
        const selectedContent = await this.promptForLineSelection(existingContent, newContent);
        await writeFile(filePath, selectedContent, 'utf-8');
        console.warn(`✅ Interactive selection applied: ${filePath}`);
        break;
      }

      case ConflictResolution.SKIP:
        console.warn(`⏭️  Skipped: ${filePath}`);
        break;

      case ConflictResolution.OVERWRITE:
        await writeFile(filePath, newContent, 'utf-8');
        console.warn(`✅ File overwritten: ${filePath}`);
        break;

      default:
        throw new Error(`Unknown conflict resolution: ${resolution}`);
    }
  }

  /**
   * Create a timestamped backup of the existing file
   */
  async createTimestampedBackup(filePath: string): Promise<string> {
    const timestamp = new Date().toISOString()
      .replace(/[:T-]/g, '')
      .replace(/\..+/, '')
      .replace(/(\d{8})(\d{6})/, '$1_$2');
    
    // Create backup directory structure
    const projectRoot = this.environmentService.getCurrentWorkingDirectory();
    const backupDir = join(projectRoot, 'backups');
    
    // Ensure backup directory exists
    await mkdir(backupDir, { recursive: true });
    
    // Preserve relative path structure within backup directory
    const relativePath = relative(projectRoot, filePath);
    const backupFileName = `${basename(filePath)}.backup.${timestamp}`;
    const backupFilePath = join(backupDir, dirname(relativePath), backupFileName);
    
    // Ensure backup subdirectory exists
    await mkdir(dirname(backupFilePath), { recursive: true });
    
    await copyFile(filePath, backupFilePath);
    return backupFilePath;
  }

  /**
   * Intelligently merge existing and new content
   */
  private async mergeContent(existingContent: string, newContent: string, filePath: string): Promise<string> {
    const ext = extname(filePath).toLowerCase();
    
    if (ext === '.md' || ext === '.markdown') {
      return this.mergeMarkdownContent(existingContent, newContent);
    } else {
      return this.mergeLineBasedContent(existingContent, newContent);
    }
  }

  /**
   * Merge markdown content by sections
   */


  /**
   * Parse markdown content into sections
   */
  private parseMarkdownSections(content: string): Map<string, MarkdownSection> {
    const lines = content.split('\n');
    const sections = new Map<string, MarkdownSection>();
    let currentSection: MarkdownSection | null = null;

    for (const line of lines) {
      if (line && line.startsWith('#')) {
        // Save previous section if exists
        if (currentSection) {
          sections.set(currentSection.header, currentSection);
        }
        
        // Start new section
        currentSection = { header: line.trim(), content: [] };
      } else if (currentSection) {
        currentSection.content.push(line);
      }
    }
    
    // Save final section
    if (currentSection) {
      sections.set(currentSection.header, currentSection);
    }
    
    return sections;
  }

  /**
   * Merge section maps, giving precedence to new sections
   */
  private mergeSectionMaps(
    existing: Map<string, MarkdownSection>, 
    newSections: Map<string, MarkdownSection>
  ): Map<string, MarkdownSection> {
    const merged = new Map(newSections); // Start with new sections (they have precedence)
    
    // Add existing sections that aren't in new sections
    for (const [header, section] of existing) {
      if (!merged.has(header)) {
        merged.set(header, section);
      }
    }
    
    return merged;
  }

  /**
   * Convert sections map back to markdown string
   */
  private sectionsToMarkdown(sections: Map<string, MarkdownSection>): string {
    const result: string[] = [];
    
    for (const section of sections.values()) {
      result.push(section.header);
      result.push(...section.content);
    }
    
    return result.join('\n');
  }

  private mergeMarkdownContent(existing: string, newContent: string): string {
    const existingSections = this.parseMarkdownSections(existing);
    const newSections = this.parseMarkdownSections(newContent);
    
    const mergedSections = this.mergeSectionMaps(existingSections, newSections);
    return this.sectionsToMarkdown(mergedSections);
  }

  /**
   * Merge content line by line, preserving unique lines from both files
   */
  private mergeLineBasedContent(existing: string, newContent: string): string {
    const existingLines = existing.split('\n');
    const newLines = newContent.split('\n');
    
    // Use Set to track unique lines while preserving order
    const resultLines: string[] = [];
    const seenLines = new Set<string>();
    
    // Add all new lines first (new content takes precedence for ordering)
    for (const line of newLines) {
      if (!seenLines.has(line)) {
        resultLines.push(line);
        seenLines.add(line);
      }
    }
    
    // Add unique lines from existing content
    for (const line of existingLines) {
      if (!seenLines.has(line)) {
        resultLines.push(line);
        seenLines.add(line);
      }
    }
    
    return resultLines.join('\n');
  }

  /**
   * Prompt user to interactively select which lines to keep
   */
  private async promptForLineSelection(existingContent: string, newContent: string): Promise<string> {
    const existingLines = existingContent.split('\n');
    const newLines = newContent.split('\n');
    
    // Create a combined view of all unique lines
    const allLines: Array<{ line: string; source: 'existing' | 'new' | 'both' }> = [];
    const lineMap = new Map<string, 'existing' | 'new' | 'both'>();
    
    // Track existing lines
    for (const line of existingLines) {
      lineMap.set(line, 'existing');
    }
    
    // Check new lines against existing
    for (const line of newLines) {
      if (lineMap.has(line)) {
        lineMap.set(line, 'both');
      } else {
        lineMap.set(line, 'new');
      }
    }
    
    // Create ordered list starting with new content structure
    for (const line of newLines) {
      const source = lineMap.get(line)!;
      allLines.push({ line, source });
    }
    
    // Add remaining existing lines
    for (const line of existingLines) {
      if (!newLines.includes(line)) {
        allLines.push({ line, source: 'existing' });
      }
    }
    
    // Prompt user to select lines
    const { selectedLines } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedLines',
        message: 'Select which lines to keep:',
        choices: allLines.map((item, _index) => ({
          name: `${this.getSourcePrefix(item.source)} ${item.line || '(empty line)'}`,
          value: item.line,
          checked: true // Default to keeping all lines
        }))
      }
    ]);
    
    return selectedLines.join('\n');
  }

  /**
   * Get prefix for line source indication
   */
  private getSourcePrefix(source: 'existing' | 'new' | 'both'): string {
    switch (source) {
      case 'existing': return '📄';
      case 'new': return '✨';
      case 'both': return '🔄';
      default: return '❓';
    }
  }
}