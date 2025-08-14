/**
 * Output path validator
 * Issue #50: Single Responsibility Principle - Extracted from CLI monolith
 */
import { Validator } from '../interfaces/Validator';
import { ValidationResult } from '../interfaces/ValidationResult';

export class OutputPathValidator implements Validator<string> {
  private static readonly UNICODE_ATTACKS = [
    '\uFF0F', // Full-width slash
    '\uFF3C', // Full-width backslash  
    '\u202E', // Right-to-left override
    '\u00A0', // Non-breaking space
    '\u0041\u0301' // Unicode combining characters
  ];

  private static readonly CRITICAL_SYSTEM_PATHS = [
    '/etc/', '/sys/', '/proc/', '/boot/', '/dev/',
    'C:\\Windows\\System32\\', 'C:\\Windows\\SysWOW64\\'
  ];

  private static readonly WINDOWS_RESERVED = [
    'CON', 'PRN', 'AUX', 'NUL', 
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
  ];

  private checkBasicValidity(outputPath: string): string | null {
    if (outputPath.includes('\0') || outputPath.trim() === '') {
      return 'Path contains invalid characters or is empty';
    }
    return null;
  }

  private checkUnicodeAttacks(outputPath: string): string | null {
    const hasUnicodeAttack = OutputPathValidator.UNICODE_ATTACKS.some(char => outputPath.includes(char));
    return hasUnicodeAttack ? 'Path traversal detected: Unicode normalization attack' : null;
  }

  private checkPathTraversal(outputPath: string): string | null {
    const pathSegments = outputPath.split(/[/\\]/);
    let depth = 0;
    
    for (const segment of pathSegments) {
      if (segment === '..') {
        depth--;
        if (depth < -2) { // Allow up to 2 parent directories
          return 'Path traversal detected: excessive parent directory references';
        }
      } else if (segment && segment !== '.') {
        depth++;
      }
    }
    return null;
  }

  private checkURLEncodedTraversal(outputPath: string): string | null {
    try {
      const decodedPath = decodeURIComponent(outputPath);
      if (decodedPath !== outputPath && (decodedPath.includes('../') || decodedPath.includes('..\\'))) {
        return 'Path traversal detected: URL encoded path traversal attempts are not allowed';
      }
    } catch {
      // Invalid URL encoding is not necessarily an error for file paths
    }
    return null;
  }

  private checkCriticalSystemPaths(outputPath: string): string | null {
    const normalizedPath = outputPath.replace(/\\/g, '/').toLowerCase();
    
    for (const sysPath of OutputPathValidator.CRITICAL_SYSTEM_PATHS) {
      const normalizedSysPath = sysPath.replace(/\\/g, '/').toLowerCase();
      if (normalizedPath.startsWith(normalizedSysPath)) {
        return 'Access denied: cannot write to critical system directories';
      }
    }
    return null;
  }

  private checkWindowsReservedNames(outputPath: string): string | null {
    const pathBasename = outputPath.split(/[/\\]/).pop()?.toUpperCase();
    if (pathBasename && OutputPathValidator.WINDOWS_RESERVED.includes(pathBasename)) {
      return 'Access denied: Windows reserved device name';
    }
    return null;
  }

  validate(outputPath: string): ValidationResult {
    const errors: string[] = [];

    // Run all validation checks
    const checks = [
      this.checkBasicValidity(outputPath),
      this.checkUnicodeAttacks(outputPath),
      this.checkPathTraversal(outputPath),
      this.checkURLEncodedTraversal(outputPath),
      this.checkCriticalSystemPaths(outputPath),
      this.checkWindowsReservedNames(outputPath)
    ];

    // Collect non-null errors
    for (const error of checks) {
      if (error) {
        errors.push(error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}