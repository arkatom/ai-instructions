/**
 * Output format types for different AI tools
 */
export enum OutputFormat {
  CLAUDE = 'claude',      // CLAUDE.md (existing)
  CURSOR = 'cursor',      // .cursor/rules/main.mdc with YAML frontmatter
  COPILOT = 'copilot',    // .github/copilot-instructions.md (2024 standard)  
  WINDSURF = 'windsurf'   // .windsurfrules
}

/**
 * Metadata for template processing and conversion
 */
export interface ConversionMetadata {
  projectName: string;
  lang?: string;
  sourceContent: string;
  targetFormat: OutputFormat;
  templateVariables?: Record<string, string>;
}

/**
 * Result of format conversion
 */
export interface ConversionResult {
  content: string;
  targetPath: string;
  format: OutputFormat;
  metadata: ConversionMetadata;
}

/**
 * Abstract interface for format converters
 * Each AI tool format implements this interface
 */
export interface FormatConverter {
  /**
   * Convert content from Claude format to target format
   */
  convert(metadata: ConversionMetadata): Promise<ConversionResult>;
  
  /**
   * Get the target file path for the converted content
   */
  getTargetPath(outputDir: string, _metadata: ConversionMetadata): string;
  
  /**
   * Validate content before/after conversion
   */
  validateContent(content: string, format: OutputFormat): boolean;
  
  /**
   * Get supported output format
   */
  getSupportedFormat(): OutputFormat;
}

/**
 * Base implementation with common functionality
 */
export abstract class BaseFormatConverter implements FormatConverter {
  abstract convert(metadata: ConversionMetadata): Promise<ConversionResult>;
  abstract getTargetPath(outputDir: string, _metadata: ConversionMetadata): string;
  abstract getSupportedFormat(): OutputFormat;

  /**
   * Basic content validation - checks for non-empty content
   */
  validateContent(content: string, _format: OutputFormat): boolean {
    if (!content || content.trim().length === 0) {
      return false;
    }
    
    // Format-specific validation can be overridden in subclasses
    return true;
  }

  /**
   * Replace template variables in content
   */
  protected replaceTemplateVariables(content: string, metadata: ConversionMetadata): string {
    let processedContent = content;
    
    // Replace projectName
    processedContent = processedContent.replace(/\{\{projectName\}\}/g, metadata.projectName);
    
    // Replace additional template variables
    if (metadata.templateVariables) {
      for (const [key, value] of Object.entries(metadata.templateVariables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        processedContent = processedContent.replace(regex, value);
      }
    }
    
    return processedContent;
  }

  /**
   * Extract metadata from source content (e.g., YAML frontmatter)
   */
  protected extractMetadata(content: string): Record<string, any> {
    // Basic implementation - can be overridden for format-specific metadata extraction
    const metadata: Record<string, any> = {};
    
    // Extract YAML frontmatter if present
    const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (yamlMatch && yamlMatch[1]) {
      try {
        // Simple YAML parsing for basic key-value pairs
        const yamlContent = yamlMatch[1];
        const lines = yamlContent.split('\n');
        
        for (const line of lines) {
          const match = line.match(/^(\w+):\s*(.+)$/);
          if (match && match[1] && match[2]) {
            metadata[match[1]] = match[2].trim();
          }
        }
      } catch (error) {
        console.warn('Failed to parse YAML frontmatter:', error);
      }
    }
    
    return metadata;
  }

  /**
   * Remove YAML frontmatter from content
   */
  protected removeYamlFrontmatter(content: string): string {
    return content.replace(/^---\n[\s\S]*?\n---\n/, '');
  }

  /**
   * Add YAML frontmatter to content
   */
  protected addYamlFrontmatter(content: string, frontmatter: Record<string, any>): string {
    const yamlLines = ['---'];
    
    for (const [key, value] of Object.entries(frontmatter)) {
      if (Array.isArray(value)) {
        yamlLines.push(`${key}:`);
        value.forEach(item => yamlLines.push(`  - "${item}"`));
      } else {
        yamlLines.push(`${key}: ${JSON.stringify(value)}`);
      }
    }
    
    yamlLines.push('---', '');
    
    return yamlLines.join('\n') + content;
  }
}