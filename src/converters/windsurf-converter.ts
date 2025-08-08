import { join } from 'path';
import { 
  BaseFormatConverter, 
  ConversionMetadata, 
  ConversionResult, 
  OutputFormat 
} from './format-converter';

/**
 * Windsurf format converter
 * Converts Claude CLAUDE.md format to Windsurf .windsurfrules format
 * 
 * Key features:
 * - Creates .windsurfrules file in project root
 * - Optimizes content for Windsurf's AI pair programming context
 * - Focuses on collaborative development and code understanding
 * - Maintains structured format for Windsurf's processing
 */
export class WindsurfConverter extends BaseFormatConverter {
  getSupportedFormat(): OutputFormat {
    return OutputFormat.WINDSURF;
  }

  async convert(metadata: ConversionMetadata): Promise<ConversionResult> {
    const { sourceContent, projectName, lang = 'en' } = metadata;
    
    // Process the content
    let processedContent = this.replaceTemplateVariables(sourceContent, metadata);
    
    // Remove existing YAML frontmatter (Windsurf uses custom format)
    processedContent = this.removeYamlFrontmatter(processedContent);
    
    // Convert Claude-specific content to Windsurf-optimized format
    processedContent = this.optimizeForWindsurf(processedContent, projectName);
    
    // Validate the result
    if (!this.validateContent(processedContent, OutputFormat.WINDSURF)) {
      throw new Error('Generated Windsurf rules content failed validation');
    }
    
    return {
      content: processedContent,
      targetPath: this.getTargetPath('', metadata),
      format: OutputFormat.WINDSURF,
      metadata
    };
  }

  getTargetPath(outputDir: string, metadata: ConversionMetadata): string {
    // Windsurf expects .windsurfrules in project root
    return join(outputDir, '.windsurfrules');
  }

  validateContent(content: string, format: OutputFormat): boolean {
    if (!super.validateContent(content, format)) {
      return false;
    }
    
    // Windsurf-specific validation
    if (format === OutputFormat.WINDSURF) {
      // Should contain Windsurf-specific sections
      if (!content.includes('Windsurf AI Pair Programming') && 
          !content.includes('Core Collaboration Principles')) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Optimize Claude content for Windsurf AI pair programming
   */
  private optimizeForWindsurf(content: string, projectName: string): string {
    let optimized = content;
    
    // Convert Claude-specific headers to Windsurf format (support multiple languages)
    // English: "# AI Development Assistant Instructions"
    // Japanese: "# AI開発アシスタント 行動指示"
    // Chinese: Similar patterns expected
    optimized = optimized.replace(/^# (?:AI Development Assistant Instructions|AI開発アシスタント 行動指示|AI\s*开发助手 行动指令).*?\n/m, 
      `# Windsurf AI Pair Programming Rules - ${projectName}\n\n`);
    
    // Add Windsurf-specific introduction
    optimized = this.addWindsurfIntroduction(optimized, projectName);
    
    // Transform for collaborative context
    optimized = this.transformForCollaboration(optimized);
    
    // Add pair programming guidelines
    optimized = this.addPairProgrammingRules(optimized);
    
    // Add code understanding context
    optimized = this.addCodeUnderstandingRules(optimized);
    
    // Optimize for real-time assistance
    optimized = this.optimizeForRealTimeAssistance(optimized);
    
    return optimized;
  }

  /**
   * Add Windsurf-specific introduction and context
   */
  private addWindsurfIntroduction(content: string, projectName: string): string {
    const introduction = `
## 🌊 Windsurf AI Pair Programming Context

### Project Overview
- **Project**: ${projectName}
- **AI Role**: Intelligent pair programming assistant
- **Focus**: Real-time code assistance, explanation, and collaboration
- **Approach**: Continuous learning and adaptation to developer preferences

### Core Collaboration Principles
- Provide real-time assistance without interrupting flow
- Explain reasoning behind suggestions and recommendations
- Adapt to developer coding style and preferences
- Offer multiple solution approaches when appropriate
- Maintain context across the entire development session

`;

    // Replace the existing core principles
    return content.replace(
      /## 🚨 Core Principles[\s\S]*?(?=##[^#])/,
      introduction
    );
  }

  /**
   * Transform content for collaborative development context
   */
  private transformForCollaboration(content: string): string {
    let transformed = content;
    
    // Convert individual developer instructions to collaborative ones
    // Japanese patterns
    transformed = transformed.replace(
      /すべてのタスク・コマンド・ツール実行前に必ず読み込み/g,
      'Before each collaborative coding task, reference the following guidelines'
    );
    
    transformed = transformed.replace(
      /あなたは\*\*必ず忘れます\*\*/g,
      'the AI assistant maintains context throughout the session'
    );
    
    // Add collaborative context hints
    transformed = transformed.replace(
      /参照したことを示すため/g,
      'To maintain transparency in AI assistance'
    );
    
    // Handle Japanese execution flow patterns
    transformed = transformed.replace(
      /基本ルール読み込み → 絶対厳守事項の確認/g,
      'Load collaboration rules → Confirm absolute requirements'
    );
    
    transformed = transformed.replace(
      /場面に応じた専用ファイル読み込み → 具体的な実行ルール確認/g,
      'Load context-specific files → Confirm specific execution rules'
    );
    
    return transformed;
  }

  /**
   * Add pair programming specific rules
   */
  private addPairProgrammingRules(content: string): string {
    const pairProgrammingRules = `
## 👥 Pair Programming Guidelines

### Real-Time Code Assistance
- **Suggest, Don't Dictate**: Offer suggestions while respecting developer autonomy
- **Explain Reasoning**: Always provide context for why a solution is recommended
- **Multiple Options**: Present different approaches when multiple valid solutions exist
- **Progressive Disclosure**: Start with simple solutions, offer complexity when needed

### Code Review and Feedback
- **Immediate Feedback**: Identify potential issues as code is being written
- **Constructive Suggestions**: Focus on improvement opportunities, not just problems
- **Best Practices**: Gently guide toward established patterns and conventions
- **Learning Opportunities**: Explain the "why" behind recommendations

### Context Awareness
- **Session Continuity**: Remember decisions and preferences from earlier in the session
- **Project Knowledge**: Understand the broader project context and architecture
- **Developer Style**: Adapt to individual coding patterns and preferences
- **Domain Understanding**: Learn project-specific terminology and business logic

### Communication Style
- **Clear and Concise**: Provide helpful information without overwhelming
- **Respectful Tone**: Maintain a collaborative, non-judgmental approach
- **Appropriate Timing**: Offer assistance when needed, stay quiet when not
- **Educational Focus**: Help developers learn and improve their skills

`;

    // Insert after project-specific sections
    return content.replace(
      /(## Project-Specific Architecture[\s\S]*?)(?=## 📋|$)/,
      `$1\n${pairProgrammingRules}`
    );
  }

  /**
   * Add code understanding and explanation rules
   */
  private addCodeUnderstandingRules(content: string): string {
    const understandingRules = `
## 🧠 Code Understanding and Explanation

### Code Analysis
- **Pattern Recognition**: Identify and explain recurring patterns in the codebase
- **Architecture Awareness**: Understand and respect the overall system design
- **Dependency Mapping**: Track relationships between different code components
- **Performance Implications**: Consider and explain performance impacts of suggestions

### Documentation and Comments
- **Living Documentation**: Help maintain up-to-date comments and documentation
- **Code Clarity**: Suggest improvements for code readability and maintainability
- **Knowledge Transfer**: Explain complex logic in understandable terms
- **Historical Context**: Understand why certain decisions were made

### Problem Solving Approach
- **Root Cause Analysis**: Help identify the underlying causes of issues
- **Solution Exploration**: Brainstorm multiple approaches to solve problems
- **Trade-off Discussion**: Explain pros and cons of different implementation choices
- **Risk Assessment**: Identify potential risks and mitigation strategies

### Learning and Growth
- **Skill Development**: Help developers improve their coding skills
- **Best Practices**: Introduce and reinforce industry best practices
- **Technology Updates**: Share knowledge about new tools and techniques
- **Debugging Assistance**: Guide through systematic debugging processes

`;

    // Insert before execution flow
    return content.replace(
      /(## 🔄)/,
      `${understandingRules}$1`
    );
  }

  /**
   * Optimize for real-time assistance
   */
  private optimizeForRealTimeAssistance(content: string): string {
    let optimized = content;
    
    // Convert static instructions to dynamic assistance guidelines
    optimized = optimized.replace(
      /## 🔄 Execution Flow/,
      '## 🔄 Real-Time Assistance Flow'
    );
    
    // Add real-time context
    const realTimeSection = `
## ⚡ Real-Time Development Assistance

### Continuous Context Awareness
- Monitor code changes and understand their implications
- Track developer intent and provide relevant suggestions
- Maintain awareness of current task and project goals
- Adapt assistance level based on developer experience and preferences

### Proactive Assistance
- Identify potential issues before they become problems
- Suggest optimizations and improvements during development
- Offer relevant code snippets and examples
- Provide quick answers to common questions

### Responsive Support
- React quickly to developer queries and requests
- Provide contextual help based on cursor position and selection
- Offer step-by-step guidance for complex tasks
- Support debugging and troubleshooting efforts

### Session Management
- Remember important decisions and preferences within the session
- Track progress on current tasks and objectives
- Maintain context across file switches and task changes
- Provide smooth handoff between different development activities

Remember: The goal is to enhance developer productivity while fostering learning and maintaining code quality. Be helpful, but not intrusive. Support the developer's workflow while gently guiding toward best practices.

`;

    // Append at the end
    return optimized + '\n' + realTimeSection;
  }
}