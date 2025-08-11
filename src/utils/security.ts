/**
 * Security utilities for input validation and path sanitization
 * Prevents path traversal, JSON injection, and other security vulnerabilities
 */

import { resolve, normalize, isAbsolute, sep } from 'path';
import { realpathSync, existsSync, lstatSync } from 'fs';
import { Logger } from './logger';

export class SecurityError extends Error {
  constructor(
    public readonly type: 'path_traversal' | 'unauthorized_access' | 'invalid_characters' | 'json_injection' | 'symlink_attack',
    message: string,
    public readonly details?: string
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

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
    /^C:\\Program/i,  // System directories (Windows)
  ];

  private static readonly MAX_PATH_LENGTH = 1000;
  private static readonly ALLOWED_PATH_DEPTH = 20;

  /**
   * Validates and sanitizes a directory path to prevent security vulnerabilities
   * @param inputPath - The path to validate
   * @param basePath - The base path to restrict access to (defaults to cwd)
   * @returns Sanitized absolute path
   * @throws SecurityError if path is invalid or dangerous
   */
  static validateDirectoryPath(inputPath: string, basePath?: string): string {
    if (!inputPath || typeof inputPath !== 'string') {
      throw new SecurityError('invalid_characters', 'Path must be a non-empty string');
    }

    // Check path length to prevent DoS
    if (inputPath.length > this.MAX_PATH_LENGTH) {
      throw new SecurityError('invalid_characters', `Path too long (max ${this.MAX_PATH_LENGTH} characters)`);
    }

    // Check for forbidden patterns
    for (const pattern of this.FORBIDDEN_PATTERNS) {
      if (pattern.test(inputPath)) {
        Logger.warn(`Blocked potentially dangerous path: ${inputPath}`);
        throw new SecurityError('path_traversal', 'Path traversal detected', inputPath);
      }
    }

    // Normalize and resolve the path
    const normalizedPath = normalize(inputPath);
    const resolvedPath = isAbsolute(normalizedPath) ? normalizedPath : resolve(process.cwd(), normalizedPath);

    // Check path depth to prevent deeply nested attacks
    const pathDepth = resolvedPath.split(sep).length;
    if (pathDepth > this.ALLOWED_PATH_DEPTH) {
      throw new SecurityError('invalid_characters', `Path too deeply nested (max ${this.ALLOWED_PATH_DEPTH} levels)`);
    }

    // Validate against base path if provided
    if (basePath) {
      const resolvedBasePath = resolve(basePath);
      if (!resolvedPath.startsWith(resolvedBasePath)) {
        throw new SecurityError('unauthorized_access', 'Access denied: path outside project scope', 
          `Attempted: ${resolvedPath}, Allowed: ${resolvedBasePath}`);
      }
    }

    // Check for symlink attacks if path exists
    if (existsSync(resolvedPath)) {
      try {
        const realPath = realpathSync(resolvedPath);
        const stats = lstatSync(resolvedPath);
        
        if (stats.isSymbolicLink()) {
          // Allow symlinks only if they point within the allowed scope
          if (basePath && !realPath.startsWith(resolve(basePath))) {
            throw new SecurityError('symlink_attack', 'Symlink to unauthorized location detected', 
              `Symlink: ${resolvedPath} -> ${realPath}`);
          }
        }
      } catch (error) {
        throw new SecurityError('unauthorized_access', 'Unable to verify path safety', String(error));
      }
    }

    return resolvedPath;
  }

  /**
   * Validates that a path is within allowed boundaries for CLI operations
   * @param inputPath - Path to validate
   * @returns Sanitized path safe for CLI operations
   */
  static validateCliPath(inputPath: string): string {
    // For CLI operations, restrict to current working directory and subdirectories
    const cwd = process.cwd();
    return this.validateDirectoryPath(inputPath, cwd);
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
  ];

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

    // Check for dangerous patterns in raw JSON
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(jsonString)) {
        Logger.warn('Blocked potentially dangerous JSON content');
        throw new SecurityError('json_injection', 'Dangerous JSON content detected');
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
  private static validateObjectSecurity(obj: unknown): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    const objectRecord = obj as Record<string, unknown>;

    // Check for prototype pollution attempts
    // Use Object.hasOwnProperty to only check for explicitly defined properties, not inherited ones
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    for (const key of dangerousKeys) {
      if (Object.prototype.hasOwnProperty.call(objectRecord, key)) {
        throw new SecurityError('json_injection', `Dangerous property "${key}" found in JSON`);
      }
    }

    // Check for function-like strings or code patterns
    for (const [key, value] of Object.entries(objectRecord)) {
      // Check for dangerous property names
      if (typeof key === 'string' && (key.includes('__proto__') || key.includes('constructor') || key.includes('prototype'))) {
        throw new SecurityError('json_injection', `Dangerous property name "${key}" found in JSON`);
      }
      
      if (typeof value === 'string') {
        // Check for function definitions
        if (value.includes('function') || value.includes('=>')) {
          throw new SecurityError('json_injection', 'Function definitions not allowed in configuration');
        }
        
        // Check for eval-like patterns
        if (value.includes('eval(') || value.includes('require(') || value.includes('process.')) {
          throw new SecurityError('json_injection', 'Potentially dangerous code patterns detected');
        }
      }
      
      // Recursively check nested objects
      if (typeof value === 'object' && value !== null) {
        this.validateObjectSecurity(value);
      }
    }
  }
}