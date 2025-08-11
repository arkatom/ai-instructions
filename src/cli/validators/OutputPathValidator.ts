/**
 * Output path validator
 * Issue #50: Single Responsibility Principle - Extracted from CLI monolith
 */
import { Validator } from '../interfaces/Validator';
import { ValidationResult } from '../interfaces/ValidationResult';

export class OutputPathValidator implements Validator<string> {
  validate(outputPath: string): ValidationResult {
    const errors: string[] = [];

    // Check if path contains invalid characters or is clearly invalid
    if (outputPath.includes('\0') || outputPath.trim() === '') {
      errors.push('Path contains invalid characters or is empty');
    }

    // Check for Unicode normalization attacks and full-width characters
    if (outputPath.includes('\uFF0F') || // Full-width slash
        outputPath.includes('\uFF3C') || // Full-width backslash  
        outputPath.includes('\u202E') || // Right-to-left override
        outputPath.includes('\u00A0') || // Non-breaking space
        outputPath.includes('\u0041\u0301')) { // Unicode combining characters
      errors.push('Path traversal detected: Unicode normalization attack');
    }

    // Check for path traversal attempts only if they escape current directory context
    // Allow ../ for legitimate parent directory navigation, but check for malicious patterns
    const pathSegments = outputPath.split(/[/\\]/);
    let depth = 0;
    for (const segment of pathSegments) {
      if (segment === '..') {
        depth--;
        if (depth < -2) { // Allow up to 2 parent directories
          errors.push('Path traversal detected: excessive parent directory references');
          break;
        }
      } else if (segment && segment !== '.') {
        depth++;
      }
    }

    // Check for URL encoded path traversal
    try {
      const decodedPath = decodeURIComponent(outputPath);
      if (decodedPath !== outputPath && (decodedPath.includes('../') || decodedPath.includes('..\\'))) {
        errors.push('Path traversal detected: URL encoded path traversal attempts are not allowed');
      }
    } catch {
      // Invalid URL encoding is not necessarily an error for file paths
    }

    // Only block writing to critical system directories, not all absolute paths
    const criticalSystemPaths = [
      '/etc/', '/sys/', '/proc/', '/boot/', '/dev/',
      'C:\\Windows\\System32\\', 'C:\\Windows\\SysWOW64\\'
    ];
    
    const normalizedPath = outputPath.replace(/\\/g, '/').toLowerCase();
    for (const sysPath of criticalSystemPaths) {
      const normalizedSysPath = sysPath.replace(/\\/g, '/').toLowerCase();
      if (normalizedPath.startsWith(normalizedSysPath)) {
        errors.push('Access denied: cannot write to critical system directories');
        break;
      }
    }

    // Check for Windows reserved names
    const windowsReserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const pathBasename = outputPath.split(/[/\\]/).pop()?.toUpperCase();
    if (pathBasename && windowsReserved.includes(pathBasename)) {
      errors.push('Access denied: Windows reserved device name');
    }



    return {
      isValid: errors.length === 0,
      errors
    };
  }
}