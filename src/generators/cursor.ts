import { join } from 'path';
import { FileUtils } from '../utils/file-utils';
import { BaseGenerator, GenerateFilesOptions, ToolConfig } from './base';

export class CursorGenerator extends BaseGenerator {
  constructor() {
    const config: ToolConfig = {
      name: 'cursor',
      templateDir: 'cursor',
      outputStructure: {
        directory: '.cursor/rules'
      }
    };
    super(config);
  }

  async generateFiles(targetDir: string, options: GenerateFilesOptions = {}): Promise<void> {
    // .cursor/rules/ ディレクトリを作成
    const rulesTargetPath = join(targetDir, '.cursor', 'rules');
    
    // メインルールファイルを生成
    const mainRuleContent = await this.loadTemplate('main.mdc');
    const processedContent = this.replaceTemplateVariables(mainRuleContent, options);
    await FileUtils.writeFileContent(join(rulesTargetPath, 'main.mdc'), processedContent);

    // 追加のルールファイルをコピー
    const rulesSourcePath = join(this.templateDir, 'rules');
    try {
      await FileUtils.copyDirectory(rulesSourcePath, rulesTargetPath);
    } catch (error) {
      // rules ディレクトリが存在しない場合はスキップ
      console.warn('No additional rules directory found for Cursor');
    }
  }
}