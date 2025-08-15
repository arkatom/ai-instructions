import { 
  FormatConverter, 
  OutputFormat, 
  OUTPUT_FORMATS,
  ConversionMetadata, 
  ConversionResult 
} from './format-converter';
import { includesStringLiteral } from '../utils/array-helpers';

import { CursorMDCConverter } from './cursor-converter';
import { CopilotMarkdownConverter } from './copilot-converter';
import { WindsurfConverter } from './windsurf-converter';

/**
 * Factory class for creating and managing format converters
 * Provides centralized access to all available format converters
 */
export class ConverterFactory {
  private static converters: Map<OutputFormat, FormatConverter> = new Map();

  /**
   * Initialize the factory with all available converters
   */
  static initialize(): void {
    this.converters.set(OutputFormat.CURSOR, new CursorMDCConverter());
    this.converters.set(OutputFormat.COPILOT, new CopilotMarkdownConverter());
    this.converters.set(OutputFormat.WINDSURF, new WindsurfConverter());
  }

  /**
   * Get a converter for the specified output format
   */
  static getConverter(format: OutputFormat): FormatConverter {
    if (this.converters.size === 0) {
      this.initialize();
    }

    const converter = this.converters.get(format);
    if (!converter) {
      throw new Error(`No converter available for format: ${format}`);
    }

    return converter;
  }

  /**
   * Get all available output formats
   */
  static getAvailableFormats(): OutputFormat[] {
    if (this.converters.size === 0) {
      this.initialize();
    }

    return Array.from(this.converters.keys());
  }

  /**
   * Check if a format is supported
   * Uses type-safe array helper to avoid type assertions
   */
  static isFormatSupported(format: string): format is OutputFormat {
    return includesStringLiteral(OUTPUT_FORMATS, format);
  }

  /**
   * Convert content to the specified format
   * Convenience method that combines converter retrieval and conversion
   */
  static async convert(
    format: OutputFormat, 
    metadata: ConversionMetadata
  ): Promise<ConversionResult> {
    const converter = this.getConverter(format);
    return await converter.convert(metadata);
  }

  /**
   * Validate content for a specific format
   */
  static validateContent(content: string, format: OutputFormat): boolean {
    const converter = this.getConverter(format);
    return converter.validateContent(content, format);
  }

  /**
   * Get target path for a specific format
   */
  static getTargetPath(
    format: OutputFormat, 
    outputDir: string, 
    metadata: ConversionMetadata
  ): string {
    const converter = this.getConverter(format);
    return converter.getTargetPath(outputDir, metadata);
  }

  /**
   * Get format information for CLI help text
   */
  static getFormatDescriptions(): Record<OutputFormat, string> {
    return {
      [OutputFormat.CLAUDE]: 'Claude AI format (CLAUDE.md) - Default format',
      [OutputFormat.CURSOR]: 'Cursor AI format (.cursor/rules/main.mdc) - MDC with YAML frontmatter',
      [OutputFormat.COPILOT]: 'GitHub Copilot format (.github/copilot-instructions.md) - 2024 standard',
      [OutputFormat.WINDSURF]: 'Windsurf AI format (.windsurfrules) - Pair programming optimized'
    };
  }

  /**
   * Reset the factory (mainly for testing)
   */
  static reset(): void {
    this.converters.clear();
  }
}