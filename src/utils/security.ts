/**
 * Security utilities for input validation and path sanitization
 * Prevents path traversal, JSON injection, and other security vulnerabilities
 */

import { resolve, normalize, isAbsolute, sep } from 'path';
import { realpathSync, existsSync, lstatSync } from 'fs';
import { Logger } from './logger';
import { SecurityError } from '../errors/custom-errors';

// Re-export for backward compatibility
export { SecurityError };

export class PathValidator {
  private static readonly FORBIDDEN_PATTERNS = [
    /\.\./,           // Directory traversal
    /\0/,             // Null bytes
    /[<>:"|?*]/,      // Invalid filename characters
    /^\/etc\//,       // System directories (Unix)
    /^\/var\//,       // System directories (Unix) 
    /^\/usr\//,       // System directories (Unix)
    /^\/bin\//,       // System directories (Unix)
    /^\/sbin\//,      // System directories (Unix)
    /^C:\\Windows/i,  // System directories (Windows)
    /^C:\Program/i,          // System directories (Windows)
    /%2e%2e%2f/i,             // URL-encoded ../
    /%252e%252e%252f/i,       // Double URL-encoded ../
    /\u002e\u002e\u002f/i, // Unicode-encoded ../
  ];

  private static readonly MAX_PATH_LENGTH = 1000;
  private static readonly ALLOWED_PATH_DEPTH = 20;

  /**
   * Normalizes path to detect encoding-based attacks
   * @param path - Input path to normalize
   * @returns Normalized path
   */
  private static normalizePath(path: string): string {
    let normalized = path;
    
    // URL decode (handle single and double encoding)
    try {
      // Handle double encoding first (%252e -> %2e -> .)
      normalized = decodeURIComponent(decodeURIComponent(normalized));
    } catch {
      // If decoding fails, try single decode
      try {
        normalized = decodeURIComponent(normalized);
      } catch {
        // If both fail, use original (may be already decoded)
      }
    }
    
    // Unicode normalization - convert Unicode escape sequences
    normalized = normalized.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
    
    return normalized;
  }

  /**
   * Validates and sanitizes a directory path to prevent security vulnerabilities
   * @param inputPath - The path to validate
   * @param basePath - The base path to restrict access to (defaults to cwd)
   * @returns Sanitized absolute path
   * @throws SecurityError if path is invalid or dangerous
   */
  /**
   * Security validation rules configuration
   */
  private static readonly SECURITY_VALIDATORS = [
    { name: 'Directory traversal', pattern: (path: string) => path.includes('..') },
    { name: 'Null bytes', pattern: (path: string) => path.includes('\0') },
    { name: 'Invalid filename chars', pattern: (path: string) => /[<>:"|?*]/.test(path) },
    { name: 'URL-encoded traversal', pattern: (path: string) => /%2e%2e%2f|%252e%252e%252f/i.test(path) },
    { name: 'Unicode-encoded traversal', pattern: (path: string) => /\\u002e\\u002e\\u002f/i.test(path) },
    { name: 'Unix system dirs', pattern: (path: string) => /^\/(?:etc|var|usr|bin|sbin)\//.test(path) },
    { name: 'Windows system dirs', pattern: (path: string) => /^C:\\(?:Windows|Program.*Files)/i.test(path) }
  ];

  /**
   * Validates paths against security rules
   */
  private static validateSecurityRules(paths: string[], originalPath: string): void {
    for (const path of paths) {
      for (const validator of this.SECURITY_VALIDATORS) {
        if (validator.pattern(path)) {
          Logger.warn(`Blocked potentially dangerous path: ${originalPath}`);
          throw new SecurityError('path_traversal', `${validator.name} detected`, originalPath);
        }
      }
    }
  }

  /**
   * Validates path depth and base path restrictions
   */
  private static validatePathConstraints(resolvedPath: string, basePath?: string): void {
    // Check path depth
    const pathDepth = resolvedPath.split(sep).length;
    if (pathDepth > this.ALLOWED_PATH_DEPTH) {
      throw new SecurityError('invalid_characters', `Path too deeply nested (max ${this.ALLOWED_PATH_DEPTH} levels)`);
    }

    // Validate base path restriction
    if (basePath) {
      const resolvedBasePath = resolve(basePath);
      if (!resolvedPath.startsWith(resolvedBasePath)) {
        throw new SecurityError('unauthorized_access', 'Access denied: path outside project scope', 
          `Attempted: ${resolvedPath}, Allowed: ${resolvedBasePath}`);
      }
    }
  }

  /**
   * Validates symlinks for security
   */
  private static validateSymlinks(resolvedPath: string, basePath?: string): void {
    if (!existsSync(resolvedPath)) return;

    try {
      const realPath = realpathSync(resolvedPath);
      const stats = lstatSync(resolvedPath);
      
      if (stats.isSymbolicLink() && basePath && !realPath.startsWith(resolve(basePath))) {
        throw new SecurityError('symlink_attack', 'Symlink to unauthorized location detected', 
          `Symlink: ${resolvedPath} -> ${realPath}`);
      }
    } catch (error) {
      throw new SecurityError('unauthorized_access', 'Unable to verify path safety', String(error));
    }
  }

  static validateDirectoryPath(inputPath: string, basePath?: string): string {
    if (!inputPath || typeof inputPath !== 'string') {
      throw new SecurityError('invalid_characters', 'Path must be a non-empty string');
    }

    if (inputPath.length > this.MAX_PATH_LENGTH) {
      throw new SecurityError('invalid_characters', `Path too long (max ${this.MAX_PATH_LENGTH} characters)`);
    }

    // Normalize and validate security rules
    const normalizedPath = this.normalizePath(inputPath);
    const pathsToCheck = [inputPath, normalizedPath];
    
    this.validateSecurityRules(pathsToCheck, inputPath);

    // Resolve path
    const pathNormalized = normalize(normalizedPath);
    const resolvedPath = isAbsolute(pathNormalized) ? pathNormalized : resolve(process.cwd(), pathNormalized);

    // Validate constraints and symlinks
    this.validatePathConstraints(resolvedPath, basePath);
    this.validateSymlinks(resolvedPath, basePath);

    return resolvedPath;
  }

  /**
   * Validates CLI arguments for path security
   * @param inputPath - Path from CLI argument
   * @returns Sanitized path for CLI usage
   * @throws SecurityError if path contains security violations
   */
  static validateCliPath(inputPath: string): string {
    // Additional CLI-specific validations
    if (inputPath.includes('\0')) {
      throw new SecurityError('invalid_characters', 'Path contains null bytes', inputPath);
    }
    
    // Use the standard directory path validation with project root as base path
    const projectRoot = process.cwd();
    return this.validateDirectoryPath(inputPath, projectRoot);
  }


}

export class JsonValidator {
  private static readonly MAX_JSON_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly MAX_NESTING_DEPTH = 50;
  
  private static readonly DANGEROUS_PATTERNS = [
    /function\s*\(/,                    // Function definitions
    /eval\s*\(/,                        // eval() calls
    /require\s*\(/,                     // require() calls
    /import\s+/,                        // import statements
    /process\./,                        // Process access
    /__proto__/,                        // Prototype pollution
    /constructor/,                      // Constructor manipulation
    /\$\{.*\}/,                         // Template literals
    /<!--/,                             // Comments (potential hiding place)
    /\/\*.*\*\//,                       // Block comments
    /\/\/.*/,                           // Line comments
    /\u005f\u005f\u0070\u0072\u006f\u0074\u006f\u005f\u005f/, // Unicode __proto__
    /\u0063\u006f\u006e\u0073\u0074\u0072\u0075\u0063\u0074\u006f\u0072/, // Unicode constructor
    /\u0065\u0076\u0061\u006c/,      // Unicode eval
    /\\\\u005f\\\\u005f\\\\u0070\\\\u0072\\\\u006f\\\\u0074\\\\u006f\\\\u005f\\\\u005f/, // JSON-escaped Unicode __proto__
    /\\\\u0063\\\\u006f\\\\u006e\\\\u0073\\\\u0074\\\\u0072\\\\u0075\\\\u0063\\\\u0074\\\\u006f\\\\u0072/, // JSON-escaped Unicode constructor  
    /\\\\u0065\\\\u0076\\\\u0061\\\\u006c/,      // JSON-escaped Unicode eval
  ];
  /**
   * Normalizes Unicode escape sequences in JSON to detect obfuscated attacks
   * @param jsonString - JSON string to normalize
   * @returns Normalized JSON string
   */
  private static normalizeUnicodeEscapes(jsonString: string): string {
    // Convert Unicode escape sequences to actual characters
    return jsonString.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
  }

  /**
   * Safely parses JSON with security validations
   * @param jsonString - JSON string to parse
   * @param maxSize - Maximum allowed size in bytes
   * @returns Parsed and validated JSON object
   * @throws SecurityError if JSON is malicious or invalid
   */
  static secureJsonParse<T = unknown>(jsonString: string, maxSize?: number): T {
    const sizeLimit = maxSize || this.MAX_JSON_SIZE;
    
    if (jsonString.length > sizeLimit) {
      throw new SecurityError('json_injection', `Configuration file too large (max ${sizeLimit} bytes)`);
    }

    // Normalize Unicode escapes to detect obfuscated attacks
    const normalizedJson = this.normalizeUnicodeEscapes(jsonString);

    // Check for dangerous patterns in both original and normalized JSON
    const jsonStringsToCheck = [jsonString, normalizedJson];
    for (const jsonToCheck of jsonStringsToCheck) {
      for (const pattern of this.DANGEROUS_PATTERNS) {
        if (pattern.test(jsonToCheck)) {
          Logger.warn('Blocked potentially dangerous JSON content');
          throw new SecurityError('json_injection', 'Dangerous JSON content detected');
        }
      }
    }

    // Check for comments (not standard JSON, potential security risk)
    if (jsonString.includes('//') || jsonString.includes('/*')) {
      throw new SecurityError('json_injection', 'Comments not allowed in JSON configuration');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch (error) {
      throw new SecurityError('json_injection', 'Invalid JSON syntax', String(error));
    }

    // Validate nesting depth
    this.validateNestingDepth(parsed, 0);

    // Additional security checks on parsed object
    this.validateObjectSecurity(parsed);

    return parsed as T;
  }

  /**
   * Validates that JSON object doesn't exceed nesting depth limits
   */
  private static validateNestingDepth(obj: unknown, currentDepth: number): void {
    if (currentDepth > this.MAX_NESTING_DEPTH) {
      throw new SecurityError('json_injection', `JSON structure too deeply nested (max ${this.MAX_NESTING_DEPTH} levels)`);
    }

    if (obj && typeof obj === 'object') {
      for (const value of Object.values(obj)) {
        if (typeof value === 'object' && value !== null) {
          this.validateNestingDepth(value, currentDepth + 1);
        }
      }
    }
  }

  /**
   * Validates parsed JSON object for security threats
   */
  /**
   * Dangerous property keys that can cause prototype pollution
   */
  private static readonly DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

  /**
   * Validates object for prototype pollution attempts
   */
  private static validatePrototypePollution(objectRecord: Record<string, unknown>): void {
    for (const key of this.DANGEROUS_KEYS) {
      if (Object.prototype.hasOwnProperty.call(objectRecord, key)) {
        throw new SecurityError('json_injection', `Dangerous property "${key}" found in JSON`);
      }
    }
  }

  /**
   * Validates individual property key and value for security
   */
  private static validateProperty(key: string, value: unknown): void {
    // Check dangerous property names
    if (this.DANGEROUS_KEYS.some(dangerous => key.includes(dangerous))) {
      throw new SecurityError('json_injection', `Dangerous property name "${key}" found in JSON`);
    }
    
    // Validate string values
    if (typeof value === 'string') {
      this.validateStringValue(value);
    }
    
    // Recursively validate nested objects
    if (typeof value === 'object' && value !== null) {
      this.validateObjectSecurity(value);
    }
  }

  /**
   * Validates string values for dangerous code patterns
   */
  private static validateStringValue(value: string): void {
    // Check for function definitions
    if (value.includes('function') || value.includes('=>')) {
      throw new SecurityError('json_injection', 'Function definitions not allowed in configuration');
    }
    
    // Check for eval-like patterns
    if (value.includes('eval(') || value.includes('require(') || value.includes('process.')) {
      throw new SecurityError('json_injection', 'Potentially dangerous code patterns detected');
    }
  }

  private static validateObjectSecurity(obj: unknown): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    const objectRecord = obj as Record<string, unknown>;
    
    // Validate prototype pollution and individual properties
    this.validatePrototypePollution(objectRecord);
    
    for (const [key, value] of Object.entries(objectRecord)) {
      this.validateProperty(key, value);
    }
  }
}