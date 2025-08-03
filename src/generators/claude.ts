import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { FileUtils } from '../utils/file-utils';

export interface GenerateFilesOptions {
  projectName?: string;
}

export class ClaudeGenerator {
  private templateDir: string;

  constructor() {
    // templates/claude/ ディレクトリのパスを設定
    this.templateDir = join(__dirname, '../../templates/claude');
  }

  async loadTemplate(templateName: string): Promise<string> {
    try {
      const templatePath = join(this.templateDir, templateName);
      const content = await readFile(templatePath, 'utf-8');
      return content;
    } catch (error) {
      throw new Error(`Template file not found: ${templateName}`);
    }
  }

  async getInstructionFiles(): Promise<string[]> {
    try {
      const instructionsPath = join(this.templateDir, 'instructions');
      const files = await readdir(instructionsPath);
      return files.filter(file => file.endsWith('.md'));
    } catch (error) {
      throw new Error('Instructions directory not found');
    }
  }

  private replaceTemplateVariables(content: string, options: GenerateFilesOptions): string {
    let processedContent = content;
    
    if (options.projectName) {
      processedContent = processedContent.replace(/\{\{projectName\}\}/g, options.projectName);
    }
    
    return processedContent;
  }

  async generateFiles(targetDir: string, options: GenerateFilesOptions = {}): Promise<void> {
    // CLAUDE.md をコピー（変数置換付き）
    const claudeContent = await this.loadTemplate('CLAUDE.md');
    const processedClaudeContent = this.replaceTemplateVariables(claudeContent, options);
    await FileUtils.writeFileContent(join(targetDir, 'CLAUDE.md'), processedClaudeContent);

    // instructions/ ディレクトリをコピー
    const instructionsSourcePath = join(this.templateDir, 'instructions');
    const instructionsTargetPath = join(targetDir, 'instructions');
    await FileUtils.copyDirectory(instructionsSourcePath, instructionsTargetPath);
  }
}