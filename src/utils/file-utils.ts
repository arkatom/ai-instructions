import { mkdir, writeFile, readdir, stat } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import { join } from 'path';

export interface FileUtilsOptions {
  recursive?: boolean;
}

export class FileUtils {
  static async ensureDirectory(dirPath: string): Promise<void> {
    await mkdir(dirPath, { recursive: true });
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
      } catch (error) {
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
      } catch (error) {
        console.log(`✅ File overwritten: ${filePath}`);
      }
    } else {
      try {
        const chalk = (await import('chalk')).default;
        console.log(chalk.green(`✅ File created: ${filePath}`));
      } catch (error) {
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