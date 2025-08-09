import { join } from 'path';
import { 
  BaseFormatConverter, 
  ConversionMetadata, 
  ConversionResult, 
  OutputFormat 
} from './format-converter';

/**
 * Cursor MDC format converter
 * Converts Claude CLAUDE.md format to Cursor .cursor/rules/main.mdc format
 * 
 * Key features:
 * - Adds YAML frontmatter with project-specific globs
 * - Converts Markdown to MDC (Markdown Components) format
 * - Optimizes content for Cursor's code completion context
 */
export class CursorMDCConverter extends BaseFormatConverter {
  getSupportedFormat(): OutputFormat {
    return OutputFormat.CURSOR;
  }

  async convert(_metadata: ConversionMetadata): Promise<ConversionResult> {
    const { sourceContent, projectName, lang = 'en' } = _metadata;
    
    // Process the content
    let processedContent = this.replaceTemplateVariables(sourceContent, _metadata);
    
    // Remove existing YAML frontmatter if present
    processedContent = this.removeYamlFrontmatter(processedContent);
    
    // Convert Claude-specific content to Cursor-optimized content
    processedContent = this.optimizeForCursor(processedContent, projectName);
    
    // Add Cursor-specific YAML frontmatter
    const frontmatter = this.generateCursorFrontmatter(projectName, lang);
    const finalContent = this.addYamlFrontmatter(processedContent, frontmatter);
    
    // Validate the result
    if (!this.validateContent(finalContent, OutputFormat.CURSOR)) {
      throw new Error('Generated Cursor MDC content failed validation');
    }
    
    return {
      content: finalContent,
      targetPath: this.getTargetPath('', _metadata),
      format: OutputFormat.CURSOR,
      metadata: _metadata
    };
  }

  getTargetPath(outputDir: string, _metadata: ConversionMetadata): string {
    return join(outputDir, '.cursor', 'rules', 'main.mdc');
  }

  validateContent(content: string, format: OutputFormat): boolean {
    if (!super.validateContent(content, format)) {
      return false;
    }
    
    // Cursor-specific validation
    if (format === OutputFormat.CURSOR) {
      // Must have YAML frontmatter
      if (!content.startsWith('---\n')) {
        return false;
      }
      
      // Must have required frontmatter fields
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch || !frontmatterMatch[1]) {
        return false;
      }
      
      const frontmatter = frontmatterMatch[1];
      if (!frontmatter.includes('description:') || !frontmatter.includes('globs:')) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Generate Cursor-specific YAML frontmatter
   */
  private generateCursorFrontmatter(projectName: string, lang: string): Record<string, string | string[] | boolean> {
    const frontmatter: Record<string, string | string[] | boolean> = {
      description: `${projectName} development instructions for Cursor AI`,
      globs: this.getProjectGlobs(),
      alwaysApply: true
    };

    // Add language-specific settings if not English
    if (lang !== 'en') {
      frontmatter.language = lang;
    }

    return frontmatter;
  }

  /**
   * Get project-appropriate file globs for Cursor
   */
  private getProjectGlobs(): string[] {
    return [
      "**/*.ts",
      "**/*.tsx", 
      "**/*.js",
      "**/*.jsx",
      "**/*.json",
      "**/*.md",
      "**/*.yaml",
      "**/*.yml",
      "!node_modules/**",
      "!dist/**",
      "!build/**",
      "!*.log"
    ];
  }

  /**
   * Optimize Claude content for Cursor AI
   */
  private optimizeForCursor(content: string, projectName: string): string {
    let optimized = content;
    
    // Convert Claude-specific headers to Cursor-optimized format
    optimized = optimized.replace(/# AI Development Assistant Instructions.*?\n/, 
      `# Cursor AI Development Instructions - ${projectName}\n\n`);
    
    // Add Cursor-specific code completion context
    optimized = this.addCursorSpecificSections(optimized);
    
    // Optimize instruction format for Cursor's context window
    optimized = this.optimizeInstructionStructure(optimized);
    
    // Add file path references for better context
    optimized = this.addFilePathContext(optimized);
    
    return optimized;
  }

  /**
   * Add Cursor-specific sections for better code completion
   */
  private addCursorSpecificSections(content: string): string {
    const cursorSpecificSection = `
## 🎯 Cursor AI Code Completion Context

### Code Generation Guidelines
- Always consider the full project context when generating code
- Maintain consistency with existing code patterns and architecture
- Generate complete, production-ready code with proper error handling
- Include comprehensive type annotations for TypeScript projects

### File Organization
- Follow the project's established directory structure
- Use consistent naming conventions across all files
- Ensure proper imports and module dependencies
- Maintain clean separation of concerns

### Code Quality Standards
- Write self-documenting code with meaningful variable names
- Add JSDoc comments for complex functions and public APIs
- Follow the project's ESLint and Prettier configurations
- Include unit tests for new functionality

`;

    // Insert after the main title but before core principles
    return content.replace(
      /(# Cursor AI Development Instructions.*?\n\n)/,
      `$1${cursorSpecificSection}`
    );
  }

  /**
   * Optimize instruction structure for Cursor's processing
   */
  private optimizeInstructionStructure(content: string): string {
    let optimized = content;
    
    // Convert file references to be more explicit for Cursor
    optimized = optimized.replace(
      /\[([^\]]+)\]\(\.\/instructions\/([^)]+)\)/g,
      '[$1](../../instructions/$2) - Reference this file for $1'
    );
    
    // Add context hints for better AI understanding
    optimized = optimized.replace(
      /## 📋 Situational Reference Files/,
      '## 📋 Context Files (Always Reference Before Coding)'
    );
    
    // Enhance execution flow for Cursor
    optimized = optimized.replace(
      /## 🔄 Execution Flow/,
      '## 🔄 Development Workflow (Follow This Process)'
    );
    
    return optimized;
  }

  /**
   * Add file path context to help Cursor understand project structure
   */
  private addFilePathContext(content: string): string {
    const filePathSection = `
## 📁 Project Structure Context

When working on this project, always consider these key directories:
- \`src/\` - Main source code
- \`test/\` - Test files
- \`docs/\` - Documentation
- \`instructions/\` - Development guidelines
- \`templates/\` - Code generation templates

Always check existing files in these directories before creating new ones.
Maintain consistency with existing patterns and naming conventions.

`;

    // Insert before the execution flow section
    return content.replace(
      /(## 🔄 Development Workflow)/,
      `${filePathSection}$1`
    );
  }
}