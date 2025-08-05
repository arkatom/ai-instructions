/**
 * Format converters for different AI tools
 * 
 * This module provides converters that transform Claude CLAUDE.md format
 * to various AI tool-specific formats with optimized content and structure.
 */

export {
  OutputFormat,
  FormatConverter,
  BaseFormatConverter,
  ConversionMetadata,
  ConversionResult
} from './format-converter';

export { CursorMDCConverter } from './cursor-converter';
export { CopilotMarkdownConverter } from './copilot-converter';
export { WindsurfConverter } from './windsurf-converter';

// Re-export for convenience
export * from './converter-factory';