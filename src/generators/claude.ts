import { join } from 'path';
import { FileUtils } from '../utils/file-utils';
import { BaseGenerator, GenerateFilesOptions, ToolConfig } from './base';

export class ClaudeGenerator extends BaseGenerator {
  constructor() {
    const config: ToolConfig = {
      name: 'claude',
      templateDir: 'claude',
      outputStructure: {
        mainFile: 'CLAUDE.md',
        directory: 'instructions'
      }
    };
    super(config);
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