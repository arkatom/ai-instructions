import { mkdir, writeFile, readdir, stat } from 'fs/promises';
import { join } from 'path';

export interface FileUtilsOptions {
  recursive?: boolean;
}

export class FileUtils {
  static async ensureDirectory(dirPath: string): Promise<void> {
    await mkdir(dirPath, { recursive: true });
  }

  static async writeFileContent(filePath: string, content: string): Promise<void> {
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