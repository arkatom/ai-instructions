import { join } from 'path';
import { 
  BaseFormatConverter, 
  ConversionMetadata, 
  ConversionResult, 
  OutputFormat 
} from './format-converter';

/**
 * GitHub Copilot Markdown converter (2024 standard)
 * Converts Claude CLAUDE.md format to GitHub Copilot .github/copilot-instructions.md format
 * 
 * Key features:
 * - Follows 2024 GitHub Copilot standard (.github/copilot-instructions.md)
 * - Optimizes content for Copilot's code generation context
 * - Maintains GitHub-specific workflow integration
 * - Focuses on inline code completion and suggestion quality
 */
export class CopilotMarkdownConverter extends BaseFormatConverter {
  getSupportedFormat(): OutputFormat {
    return OutputFormat.COPILOT;
  }

  async convert(metadata: ConversionMetadata): Promise<ConversionResult> {
    const { sourceContent, projectName, lang = 'en' } = metadata;
    
    // Process the content
    let processedContent = this.replaceTemplateVariables(sourceContent, metadata);
    
    // Remove existing YAML frontmatter (Copilot doesn't use it)
    processedContent = this.removeYamlFrontmatter(processedContent);
    
    // Convert Claude-specific content to Copilot-optimized content
    processedContent = this.optimizeForCopilot(processedContent, projectName);
    
    // Validate the result
    if (!this.validateContent(processedContent, OutputFormat.COPILOT)) {
      throw new Error('Generated GitHub Copilot content failed validation');
    }
    
    return {
      content: processedContent,
      targetPath: this.getTargetPath('', metadata),
      format: OutputFormat.COPILOT,
      metadata
    };
  }

  getTargetPath(outputDir: string, metadata: ConversionMetadata): string {
    // 2024 GitHub Copilot standard path
    return join(outputDir, '.github', 'copilot-instructions.md');
  }

  validateContent(content: string, format: OutputFormat): boolean {
    if (!super.validateContent(content, format)) {
      return false;
    }
    
    // GitHub Copilot-specific validation
    if (format === OutputFormat.COPILOT) {
      // Should not have YAML frontmatter (Copilot 2024 standard uses pure Markdown)
      if (content.startsWith('---\n')) {
        return false;
      }
      
      // Must have GitHub Copilot specific sections
      if (!content.includes('GitHub Copilot') && !content.includes('Code Generation')) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Optimize Claude content for GitHub Copilot
   */
  private optimizeForCopilot(content: string, projectName: string): string {
    let optimized = content;
    
    // Convert Claude-specific headers to Copilot format
    optimized = optimized.replace(/# (?:AI Development Assistant Instructions|AI開発アシスタント 行動指示|AI开发助手 行动指令).*?\n/, 
      `# GitHub Copilot Custom Instructions - ${projectName}\n\n`);
    
    // Add Copilot-specific introduction
    optimized = this.addCopilotIntroduction(optimized, projectName);
    
    // Transform core principles for Copilot context
    optimized = this.transformCorePrinciples(optimized);
    
    // Add GitHub-specific workflow sections
    optimized = this.addGitHubWorkflowSections(optimized);
    
    // Optimize for inline code suggestions
    optimized = this.optimizeForInlineCompletion(optimized);
    
    // Add code generation guidelines
    optimized = this.addCodeGenerationGuidelines(optimized);
    
    return optimized;
  }

  /**
   * Add GitHub Copilot specific introduction
   */
  private addCopilotIntroduction(content: string, projectName: string): string {
    const introduction = `
## 🚨 Core Development Principles

### Project Context
- **Project Name**: ${projectName}
- **Development Approach**: Issue-driven development with GitHub Flow
- **Code Quality**: Test-Driven Development (TDD) with comprehensive coverage
- **AI Assistance**: GitHub Copilot for intelligent code completion and generation

### Absolute Requirements
- Always follow Test-Driven Development (TDD) practices
- Write comprehensive tests before implementation  
- Maintain clean, readable, and well-documented code
- Prioritize code quality over development speed
- Reference project documentation and guidelines before coding

`;

    // Replace the core principles section
    return content.replace(
      /## 🚨 Core Principles \(MANDATORY\)[\s\S]*?(?=##[^#])/,
      introduction
    );
  }

  /**
   * Transform core principles for Copilot understanding
   */
  private transformCorePrinciples(content: string): string {
    let transformed = content;
    
    // Convert file references to GitHub-relative paths
    transformed = transformed.replace(
      /\[([^\]]+)\]\(\.\/instructions\/([^)]+)\)/g,
      '[$1](../instructions/$2)'
    );
    
    // Add GitHub-specific context hints
    transformed = transformed.replace(
      /Must be read before executing any task/,
      'Essential guidelines for GitHub Copilot code generation context'
    );
    
    return transformed;
  }

  /**
   * Add GitHub-specific workflow sections
   */
  private addGitHubWorkflowSections(content: string): string {
    const githubSections = `
## 📋 Code Generation Guidelines

### TypeScript/JavaScript Standards
- Use strict TypeScript types and interfaces
- Implement comprehensive error handling with try-catch blocks
- Follow ESLint and Prettier configurations exactly
- Create modular, reusable components with clear interfaces

### Test-Driven Development
- **Always write tests first** (Red-Green-Refactor cycle)
- Aim for high test coverage (>90% line coverage)
- Include unit tests, integration tests, and end-to-end tests
- Mock external dependencies appropriately with Jest

### Git Workflow Integration
- Follow GitHub Flow branch strategy (feature branches from main)
- Use conventional commit messages (feat:, fix:, docs:, etc.)
- Create descriptive PR descriptions with context and testing notes
- Link all work to GitHub Issues with closing keywords

## 🔧 Architecture Patterns

### Code Organization
- Implement clean architecture principles with clear layers
- Use dependency injection where appropriate
- Separate concerns with well-defined interfaces
- Apply SOLID principles consistently across the codebase

### Documentation Standards
- Include JSDoc comments for all public methods and classes
- Maintain README files for complex modules and packages
- Document API endpoints with clear examples and response formats
- Update documentation with every code change (never leave it stale)

## 🎯 Quality Assurance

### Performance Optimization
- Optimize for both development and production environments
- Implement efficient algorithms and data structures
- Consider memory usage and resource consumption in code design
- Profile critical code paths and optimize bottlenecks

### Security Best Practices
- Validate and sanitize all user inputs
- Use parameterized queries to prevent SQL injection
- Implement proper authentication and authorization
- Keep all dependencies updated to latest secure versions

## 📊 Issue-Driven Development Workflow

### GitHub Issue Integration
- Break all work into small, manageable GitHub Issues
- Create feature branches for each Issue using descriptive names
- Implement comprehensive testing for each feature before PR
- Submit PRs with detailed descriptions and review requests

### Code Review Process
- Reference Issue numbers in all commits (#123 format)
- Update Issue status regularly with progress comments
- Provide clear PR descriptions with testing instructions
- Request reviews from appropriate team members with GitHub mentions

### Quality Gates
- All code must pass automated tests before merge
- Code coverage must meet project standards (typically 90%+)
- ESLint and TypeScript compiler must pass with zero errors
- Security scans must pass without critical vulnerabilities

`;

    // Insert after project-specific section
    return content.replace(
      /(## Project-Specific Architecture[\s\S]*?)(?=## 📋|$)/,
      `$1\n${githubSections}`
    );
  }

  /**
   * Optimize content for inline code completion
   */
  private optimizeForInlineCompletion(content: string): string {
    let optimized = content;
    
    // Add context for common code patterns
    const codePatterns = `
## 💡 Code Completion Context

### Common Patterns to Follow
When generating code, always consider these established patterns:

- **Error Handling**: Use try-catch blocks with specific error types
- **Async Operations**: Use async/await with proper error handling
- **Type Safety**: Define interfaces and types before implementation
- **Testing**: Generate corresponding test files with comprehensive coverage
- **Logging**: Include appropriate logging for debugging and monitoring

### File Naming Conventions
- Components: PascalCase (e.g., UserProfile.tsx)
- Utilities: camelCase (e.g., dataProcessor.ts)
- Tests: match source file with .test.ts extension
- Types: end with .types.ts for type definition files

### Import Organization
- External libraries first (React, lodash, etc.)
- Internal utilities and components second
- Relative imports last
- Group and sort alphabetically within each section

`;

    // Insert before execution flow
    return optimized.replace(
      /(## 🔄)/,
      `${codePatterns}$1`
    );
  }

  /**
   * Add specific code generation guidelines for Copilot
   */
  private addCodeGenerationGuidelines(content: string): string {
    const guidelines = `
## 🤖 GitHub Copilot Code Generation Guidelines

### Context Awareness
- Always consider the full file context when generating code
- Maintain consistency with existing code style and patterns
- Reference imported modules and available functions
- Follow the project's established architecture and conventions

### Code Quality Standards
- Generate production-ready code, not quick prototypes
- Include comprehensive error handling in all generated code
- Add meaningful variable names and function documentation
- Ensure type safety with proper TypeScript annotations

### Testing Integration
- Generate corresponding test cases for new functions
- Include edge cases and error scenarios in tests
- Mock external dependencies appropriately
- Maintain high test coverage with meaningful assertions

**Remember**: Quality over speed. Take time to generate robust, well-tested solutions that maintain the project's high standards.

`;

    // Append at the end
    return content + '\n' + guidelines;
  }
}