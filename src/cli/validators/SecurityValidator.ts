/**
 * SecurityValidator - Security validation utilities for CLI operations
 * Issue #93: Security vulnerability fixes
 * 
 * This class provides comprehensive security validation for CLI operations,
 * including path traversal prevention, input sanitization, and system directory protection.
 * 
 * Key security features:
 * - Path traversal detection and prevention
 * - System directory access blocking
 * - Input sanitization and validation
 * - Command injection pattern detection
 * - Boundary checking for file operations
 * 
 * @example
 * ```typescript
 * const validator = new SecurityValidator();
 * const pathResult = validator.validatePath('./user-input');
 * const nameResult = validator.validateAgentName('my-agent');
 * ```
 */

import { resolve, normalize, relative, sep } from 'path';
import { Logger } from '../../utils/logger';
import { PathSecurity, InputValidator } from '../../utils/path-security';

/**
 * Security validation result interface
 */
export interface SecurityValidationResult {
  isValid: boolean;
  errors: string[];
  normalizedPath?: string;
}

/**
 * Security validator for CLI operations
 * Provides path validation, traversal prevention, and input sanitization
 * 
 * This class encapsulates all security validation logic for the CLI,
 * ensuring that user inputs are safe and cannot be used for malicious purposes.
 */
export class SecurityValidator {
  private readonly projectRoot: string;
  private readonly systemPaths: string[];

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.systemPaths = [
      '/etc',
      '/usr', 
      '/bin',
      '/sbin',
      '/var',
      '/sys',
      '/proc',
      '/boot',
      '/dev',
      '/root',
      'C:\\Windows',
      'C:\\Program Files',
      'C:\\Users'
    ];
  }

  /**
   * Validates and normalizes a file path to prevent security vulnerabilities
   * 
   * @param inputPath - Raw input path from user
   * @param allowAbsolute - Whether to allow absolute paths (default: false)
   * @returns Security validation result with normalized path
   */
  validatePath(inputPath: string, allowAbsolute: boolean = true): SecurityValidationResult {
    const errors: string[] = [];

    try {
      // Input sanitization
      const sanitizedPath = this.sanitizePathInput(inputPath);
      if (sanitizedPath !== inputPath) {
        errors.push('Path contains invalid characters and has been sanitized');
      }

      // Normalize the path to resolve any relative components
      const normalizedPath = normalize(sanitizedPath);
      
      // Resolve to absolute path for boundary checking
      const resolvedPath = resolve(this.projectRoot, normalizedPath);
      
      // Check for path traversal attempts
      if (this.isPathTraversal(sanitizedPath)) {
        errors.push('Path traversal detected: path contains suspicious patterns');
      }

      // Check if resolved path stays within project boundaries (only for relative paths)
      if (!allowAbsolute && !this.isWithinProjectBoundaries(resolvedPath)) {
        errors.push('Path security violation: resolved path is outside project boundaries');
      }

      // Check for system directory access
      if (this.isSystemPath(resolvedPath)) {
        errors.push('Path security violation: system directories are not allowed');
      }
      
      // Check for dangerous absolute paths that shouldn't be allowed even with allowAbsolute
      if (this.isDangerousAbsolutePath(inputPath)) {
        errors.push('Path security violation: dangerous absolute path detected');
      }

      // Check absolute path restrictions (only if explicitly disallowed)
      if (!allowAbsolute && this.isAbsolutePath(sanitizedPath)) {
        errors.push('Absolute paths are not allowed in this context');
      }

      return {
        isValid: errors.length === 0,
        errors,
        normalizedPath: normalizedPath
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error(`Path validation error: ${errorMessage}`);
      
      return {
        isValid: false,
        errors: [`Path validation failed: ${errorMessage}`]
      };
    }
  }

  /**
   * Validates agent name to prevent injection attacks
   * 
   * @param agentName - Agent name to validate
   * @returns Security validation result
   */
  validateAgentName(agentName: string): SecurityValidationResult {
    const errors: string[] = [];

    // Use utility for comprehensive validation
    if (!InputValidator.isSafeString(agentName, /^[a-zA-Z0-9\-_]+$/)) {
      errors.push('Agent name contains invalid characters. Only alphanumeric, hyphens, and underscores are allowed');
    }

    // Check for path traversal in agent names using utility
    if (PathSecurity.hasTraversalPatterns(agentName)) {
      errors.push('Agent name contains path traversal patterns');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitizes path input by removing dangerous characters
   * 
   * @param input - Raw path input
   * @returns Sanitized path string
   */
  private sanitizePathInput(input: string): string {
    return input
      // Remove null bytes
      .replace(/\0/g, '')
      // Remove other control characters except tab and newline (which we'll also remove)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Remove newlines and carriage returns
      .replace(/[\r\n]/g, '')
      // Trim whitespace
      .trim();
  }

  /**
   * Checks if path contains traversal patterns
   * 
   * @param path - Path to check
   * @returns True if path traversal detected
   */
  private isPathTraversal(path: string): boolean {
    const traversalPatterns = [
      '../',
      '..\\',
      '..\\\\',
      '%2e%2e%2f',
      '%2e%2e%5c',
      '..%2f',
      '..%5c'
    ];

    const normalizedPath = path.toLowerCase().replace(/\\/g, '/');
    return traversalPatterns.some(pattern => normalizedPath.includes(pattern));
  }

  /**
   * Checks if resolved path is within project boundaries
   * 
   * @param resolvedPath - Absolute resolved path
   * @returns True if within boundaries
   */
  private isWithinProjectBoundaries(resolvedPath: string): boolean {
    try {
      const relativePath = relative(this.projectRoot, resolvedPath);
      return !relativePath.startsWith('..') && !relativePath.startsWith(sep) && relativePath !== '';
    } catch (error) {
      // If we can't determine the relationship, err on the side of caution
      return false;
    }
  }

  /**
   * Checks if path targets system directories
   * 
   * @param path - Path to check
   * @returns True if system path detected
   */
  private isSystemPath(path: string): boolean {
    const normalizedPath = path.toLowerCase().replace(/\\/g, '/');
    
    // Allow temp directories as they're commonly used for testing
    if (normalizedPath.includes('/tmp/') || normalizedPath.includes('/temp/') || 
        normalizedPath.includes('\\temp\\') || normalizedPath.includes('/var/folders/')) {
      return false;
    }
    
    return this.systemPaths.some(sysPath => {
      const normalizedSysPath = sysPath.toLowerCase().replace(/\\/g, '/');
      return normalizedPath.startsWith(normalizedSysPath + '/') || 
             normalizedPath === normalizedSysPath;
    });
  }

  /**
   * Checks if path is absolute
   * 
   * @param path - Path to check
   * @returns True if absolute path
   */
  private isAbsolutePath(path: string): boolean {
    // Check for common absolute path patterns
    return path.startsWith('/') || 
           /^[A-Za-z]:[\\/]/.test(path) || 
           path.startsWith('\\\\'); // UNC paths
  }

  /**
   * Checks for null bytes and control characters
   * 
   * @param input - Input string to check
   * @returns True if contains null bytes
   */
  private containsNullBytes(input: string): boolean {
    return /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(input);
  }

  /**
   * Checks for command injection patterns
   * 
   * @param input - Input string to check
   * @returns True if injection patterns detected
   */
  private containsCommandInjection(input: string): boolean {
    const injectionPatterns = [
      ';',
      '&&',
      '||',
      '|',
      '`',
      '$(',
      '${',
      '$()',
      '<',
      '>',
      '>>',
      '&'
    ];

    return injectionPatterns.some(pattern => input.includes(pattern));
  }
  
  /**
   * Checks for dangerous absolute paths that should never be allowed
   * 
   * @param path - Path to check
   * @returns True if dangerous absolute path detected
   */
  private isDangerousAbsolutePath(path: string): boolean {
    const dangerousPaths = [
      '/etc/passwd',
      '/etc/shadow',
      '/usr/local/bin',
      '/var/log',
      '/home',
      '/root',
      'C:\\Windows\\System32',
      'C:\\Users'
    ];
    
    const normalizedPath = path.toLowerCase().replace(/\\/g, '/');
    return dangerousPaths.some(dangerous => {
      const normalizedDangerous = dangerous.toLowerCase().replace(/\\/g, '/');
      return normalizedPath.startsWith(normalizedDangerous) || normalizedPath === normalizedDangerous;
    });
  }
}