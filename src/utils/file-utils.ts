import { mkdir, writeFile, readdir, stat } from 'fs/promises';
import { existsSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { FileConflictHandler, ConflictResolution } from './file-conflict-handler';

export interface FileUtilsOptions {
  recursive?: boolean;
}

export interface AdvancedFileWriteOptions {
  force?: boolean;
  interactive?: boolean;
  defaultResolution?: ConflictResolution;
  backup?: boolean;
}

export class FileUtils {
  static async ensureDirectory(dirPath: string): Promise<void> {
    await mkdir(dirPath, { recursive: true });
  }

  /**
   * Check if file exists asynchronously
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      const { access } = await import('fs/promises');
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 🚨 EMERGENCY PATCH v0.2.1: Safe file writing with warnings
   * Checks for existing files and displays warnings before overwriting
   */
  static async writeFileContentSafe(filePath: string, content: string, force: boolean = false): Promise<void> {
    const fileExists = existsSync(filePath);
    
    if (fileExists && !force) {
      // Import chalk dynamically to avoid issues if not installed
      try {
        const chalk = (await import('chalk')).default;
        console.log(chalk.red('⚠️  WARNING: File already exists and will be OVERWRITTEN!'));
        console.log(chalk.red(`📄 Target: ${filePath}`));
        
        // Show file info
        const stats = statSync(filePath);
        console.log(chalk.yellow(`📊 Size: ${stats.size} bytes, Modified: ${stats.mtime.toLocaleString()}`));
        console.log(chalk.yellow('💡 Use --force flag to suppress this warning'));
        console.log(chalk.yellow('💡 Or wait for v0.3.0 for interactive conflict resolution'));
        console.log('');
      } catch {
        // Fallback to plain console if chalk not available
        console.log('⚠️  WARNING: File already exists and will be OVERWRITTEN!');
        console.log(`📄 Target: ${filePath}`);
        console.log('💡 Use --force flag to suppress this warning');
        console.log('💡 Or wait for v0.3.0 for interactive conflict resolution');
        console.log('');
      }
    }
    
    const dirPath = join(filePath, '..');
    await this.ensureDirectory(dirPath);
    await writeFile(filePath, content, 'utf-8');
    
    if (fileExists) {
      try {
        const chalk = (await import('chalk')).default;
        console.log(chalk.green(`✅ File overwritten: ${filePath}`));
      } catch {
        console.log(`✅ File overwritten: ${filePath}`);
      }
    } else {
      try {
        const chalk = (await import('chalk')).default;
        console.log(chalk.green(`✅ File created: ${filePath}`));
      } catch {
        console.log(`✅ File created: ${filePath}`);
      }
    }
  }

  /**
   * @deprecated Use writeFileContentSafe() instead for better safety
   * This method is kept for backward compatibility but will be removed in v1.0.0
   */
  static async writeFileContent(filePath: string, content: string): Promise<void> {
    console.log('⚠️  DEPRECATION WARNING: writeFileContent() is unsafe and will be removed in v1.0.0');
    console.log('⚠️  Please use writeFileContentSafe() instead');
    
    const dirPath = join(filePath, '..');
    await this.ensureDirectory(dirPath);
    await writeFile(filePath, content, 'utf-8');
  }

  /**
   * 🚀 ADVANCED FILE SAFETY v0.5.0: Intelligent conflict resolution
   * Writes files with comprehensive conflict resolution options
   * Issue #26: Replaces basic safety with full interactive system
   */
  static async writeFileContentAdvanced(
    filePath: string, 
    content: string, 
    options: AdvancedFileWriteOptions = {}
  ): Promise<void> {
    const {
      force = false,
      interactive = true,
      defaultResolution = ConflictResolution.BACKUP,
      backup = true
    } = options;

    // Ensure directory exists
    const dirPath = join(filePath, '..');
    await this.ensureDirectory(dirPath);

    const conflictHandler = new FileConflictHandler();
    const hasConflict = await conflictHandler.detectConflict(filePath);

    if (!hasConflict) {
      // No conflict, write file normally
      await writeFile(filePath, content, 'utf-8');
      try {
        const chalk = (await import('chalk')).default;
        console.log(chalk.green(`✅ File created: ${filePath}`));
      } catch {
        console.log(`✅ File created: ${filePath}`);
      }
      return;
    }

    // Handle conflict based on options
    let resolution: ConflictResolution;

    if (force) {
      resolution = ConflictResolution.OVERWRITE;
    } else if (interactive && process.env.NODE_ENV !== 'test') {
      // In interactive mode and not in test environment
      const existingContent = readFileSync(filePath, 'utf-8');
      resolution = await conflictHandler.promptForResolution(filePath, existingContent, content);
    } else {
      // Use default resolution (useful for automated scenarios or testing)
      resolution = backup ? ConflictResolution.BACKUP : defaultResolution;
    }

    // Resolve the conflict using the selected strategy
    await conflictHandler.resolveConflict(filePath, content, resolution);
  }

  static async copyDirectory(sourcePath: string, targetPath: string): Promise<void> {
    await this.ensureDirectory(targetPath);
    
    const items = await readdir(sourcePath);
    
    for (const item of items) {
      const sourceItemPath = join(sourcePath, item);
      const targetItemPath = join(targetPath, item);
      
      const itemStat = await stat(sourceItemPath);
      
      if (itemStat.isDirectory()) {
        await this.copyDirectory(sourceItemPath, targetItemPath);
      } else {
        const { readFile } = await import('fs/promises');
        const content = await readFile(sourceItemPath, 'utf-8');
        await this.writeFileContent(targetItemPath, content);
      }
    }
  }
}