/**
 * Path Security Validator
 * Utility functions for path traversal prevention and security validation
 * Note: These functions perform filesystem I/O operations
 */

import { normalize, resolve } from 'path';
import * as fs from 'fs';
import { SecurityError } from '../../errors/custom-errors';

// List of dangerous system paths to block
const DANGEROUS_PATHS = [
  '/etc', '/sys', '/proc', '/dev', '/boot', '/root',
  'C:\\Windows', 'C:\\System32', 'C:\\Program Files'
];

/**
 * Check if path is a dangerous system path
 */
function isDangerousPath(path: string): boolean {
  const normalizedPath = normalize(path).toLowerCase();
  return DANGEROUS_PATHS.some(dangerous => 
    normalizedPath.startsWith(dangerous.toLowerCase())
  );
}

/**
 * Check for symbolic links
 */
function checkSymbolicLink(path: string): void {
  try {
    const stats = fs.lstatSync(path);
    if (stats.isSymbolicLink()) {
      throw new SecurityError('SYMLINK', 'Symbolic links not allowed');
    }
  } catch (error) {
    if (error instanceof SecurityError) {
      throw error;
    }
    // ENOENT is ok, other errors we ignore
  }
}

/**
 * Validate path security for path traversal prevention
 * @param projectPath - The path to validate
 * @param basePath - The base path for validation (default: process.cwd())
 * @returns Normalized safe path
 * @throws SecurityError if path is unsafe
 */
/**
 * Handle path with traversal patterns
 */
function handleTraversalPath(projectPath: string, basePath: string): string {
  const normalizedBase = normalize(resolve(basePath));
  const resolvedPath = normalize(resolve(normalizedBase, projectPath));
  
  if (!resolvedPath.startsWith(normalizedBase)) {
    throw new SecurityError('PATH_TRAVERSAL', 'Path traversal detected');
  }
  
  checkSymbolicLink(resolvedPath);
  return resolvedPath;
}

/**
 * Check if path is absolute
 */
function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || path.startsWith('\\') || 
         (path.length > 2 && path[1] === ':');
}

export function validatePathSecurity(
  projectPath: string, 
  basePath: string = process.cwd()
): string {
  // Check for null bytes first
  if (projectPath.includes('\u0000')) {
    throw new SecurityError('NULL_BYTE', 'Null bytes detected in path');
  }
  
  // Check for dangerous absolute paths
  if (isDangerousPath(projectPath)) {
    throw new SecurityError('ABSOLUTE_PATH', 'Absolute path outside project boundary');
  }
  
  // Check for path traversal patterns
  if (projectPath.includes('../') || projectPath.includes('..\\')) {
    return handleTraversalPath(projectPath, basePath);
  }
  
  // Handle absolute paths
  if (isAbsolutePath(projectPath)) {
    const resolved = normalize(resolve(projectPath));
    checkSymbolicLink(resolved);
    return resolved;
  }
  
  // For relative paths without traversal
  const normalizedBase = normalize(resolve(basePath));
  const safePath = normalize(resolve(normalizedBase, projectPath));
  checkSymbolicLink(safePath);
  
  return safePath;
}