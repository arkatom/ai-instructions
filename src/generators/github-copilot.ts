import { join } from 'path';
import { FileUtils } from '../utils/file-utils';
import { BaseGenerator, GenerateFilesOptions, ToolConfig } from './base';

export class GitHubCopilotGenerator extends BaseGenerator {
  constructor() {
    const config: ToolConfig = {
      name: 'github-copilot',
      templateDir: 'github-copilot',
      outputStructure: {
        directory: '.github/instructions'
      }
    };
    super(config);
  }

  async generateFiles(targetDir: string, options: GenerateFilesOptions = {}): Promise<void> {
    // .github/instructions/ ディレクトリを作成
    const instructionsTargetPath = join(targetDir, '.github', 'instructions');
    
    // メインインストラクションファイルを生成
    const mainInstructionContent = await this.loadTemplate('main.md');
    const processedContent = this.replaceTemplateVariables(mainInstructionContent, options);
    await FileUtils.writeFileContent(join(instructionsTargetPath, 'main.md'), processedContent);

    // 追加のインストラクションファイルをコピー
    const instructionsSourcePath = join(this.templateDir, 'instructions');
    try {
      await FileUtils.copyDirectory(instructionsSourcePath, instructionsTargetPath);
    } catch (error) {
      // instructions ディレクトリが存在しない場合はスキップ
      console.warn('No additional instructions directory found for GitHub Copilot');
    }
  }
}