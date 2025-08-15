/**
 * Path Security Utilities
 * Issue #93: Reusable path validation and security utilities
 */

import { resolve, normalize, relative, sep } from 'path';
import { Logger } from './logger';

/**
 * Utility functions for secure path handling across the application
 */
export class PathSecurity {
  
  /**
   * Safely resolves a path relative to a base directory
   * Ensures the resolved path stays within the base directory boundaries
   * 
   * @param basePath - Base directory path
   * @param inputPath - Input path to resolve
   * @returns Resolved path if safe, null if outside boundaries
   */
  static safeResolve(basePath: string, inputPath: string): string | null {
    try {
      const resolvedBase = resolve(basePath);
      const resolvedPath = resolve(resolvedBase, inputPath);
      
      // Check if resolved path is within base directory
      const relativePath = relative(resolvedBase, resolvedPath);
      
      if (relativePath.startsWith('..') || relativePath.startsWith(sep)) {
        Logger.warn(`Path traversal attempt blocked: ${inputPath} would resolve outside ${basePath}`);
        return null;
      }
      
      return resolvedPath;
    } catch (error) {
      Logger.error(`Path resolution failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * Normalizes a path and removes dangerous components
   * 
   * @param inputPath - Raw input path
   * @returns Normalized and sanitized path
   */
  static normalizePath(inputPath: string): string {
    // Remove null bytes and control characters
    const sanitized = inputPath
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/[\r\n]/g, '')
      .trim();
    
    return normalize(sanitized);
  }
  
  /**
   * Checks if a path contains traversal patterns
   * 
   * @param path - Path to check
   * @returns True if traversal patterns detected
   */
  static hasTraversalPatterns(path: string): boolean {
    const traversalPatterns = [
      '../',
      '..\\',
      '%2e%2e%2f',
      '%2e%2e%5c',
      '..%2f',
      '..%5c'
    ];
    
    const normalizedPath = path.toLowerCase().replace(/\\/g, '/');
    return traversalPatterns.some(pattern => normalizedPath.includes(pattern));
  }
  
  /**
   * Validates that a path is safe for file operations
   * 
   * @param path - Path to validate
   * @param basePath - Base directory for relative paths
   * @returns True if path is safe
   */
  static isPathSafe(path: string, basePath?: string): boolean {
    // Check for traversal patterns
    if (this.hasTraversalPatterns(path)) {
      return false;
    }
    
    // Check for dangerous system paths
    if (this.isSystemPath(path)) {
      return false;
    }
    
    // If base path provided, check boundaries
    if (basePath) {
      const safePath = this.safeResolve(basePath, path);
      return safePath !== null;
    }
    
    return true;
  }
  
  /**
   * Checks if a path targets system directories
   * 
   * @param path - Path to check
   * @returns True if system path detected
   */
  private static isSystemPath(path: string): boolean {
    const systemPaths = [
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
    
    const normalizedPath = path.toLowerCase().replace(/\\/g, '/');
    
    // Allow temp directories
    if (normalizedPath.includes('/tmp/') || 
        normalizedPath.includes('/temp/') || 
        normalizedPath.includes('/var/folders/')) {
      return false;
    }
    
    return systemPaths.some(sysPath => {
      const normalizedSysPath = sysPath.toLowerCase().replace(/\\/g, '/');
      return normalizedPath.startsWith(normalizedSysPath + '/') || 
             normalizedPath === normalizedSysPath;
    });
  }
}

/**
 * Input validation utilities for preventing injection attacks
 */
export class InputValidator {
  
  /**
   * Validates that a string contains only safe characters
   * 
   * @param input - Input string to validate
   * @param allowedPattern - Regex pattern for allowed characters
   * @returns True if input is safe
   */
  static isSafeString(input: string, allowedPattern: RegExp = /^[a-zA-Z0-9\-_]+$/): boolean {
    // Check for null bytes and control characters
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(input)) {
      return false;
    }
    
    // Check for command injection patterns
    const injectionPatterns = [';', '&&', '||', '|', '`', '$(', '${', '<', '>', '&'];
    if (injectionPatterns.some(pattern => input.includes(pattern))) {
      return false;
    }
    
    // Check against allowed pattern
    return allowedPattern.test(input);
  }
  
  /**
   * Sanitizes a string by removing dangerous characters
   * 
   * @param input - Input string to sanitize
   * @returns Sanitized string
   */
  static sanitizeString(input: string): string {
    return input
      // Remove null bytes and control characters
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Remove newlines and carriage returns
      .replace(/[\r\n]/g, '')
      // Trim whitespace
      .trim();
  }
}