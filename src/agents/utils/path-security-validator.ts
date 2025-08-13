/**
 * Path Security Validator
 * Utility functions for path traversal prevention and security validation
 * Note: These functions perform filesystem I/O operations
 */

import { normalize, resolve } from 'path';
import * as fs from 'fs';
import { SecurityError } from '../../errors/custom-errors';

/**
 * Validate path security for path traversal prevention
 * @param projectPath - The path to validate
 * @param basePath - The base path for validation (default: process.cwd())
 * @returns Normalized safe path
 * @throws SecurityError if path is unsafe
 */
export function validatePathSecurity(
  projectPath: string, 
  basePath: string = process.cwd()
): string {
  const safePath = normalize(resolve(basePath, projectPath));
  
  // Check if path is outside project boundary
  if (!safePath.startsWith(basePath)) {
    throw new SecurityError('PATH_TRAVERSAL', 'Path traversal detected');
  }
  
  // Check for absolute paths outside project
  if (projectPath.startsWith('/') && !projectPath.startsWith(basePath)) {
    throw new SecurityError('ABSOLUTE_PATH', 'Absolute path outside project boundary');
  }
  
  // Check for symbolic links (atomic operation to prevent TOCTOU)
  try {
    const stats = fs.lstatSync(safePath);
    if (stats.isSymbolicLink()) {
      throw new SecurityError('SYMLINK', 'Symbolic links not allowed');
    }
  } catch (error) {
    // ENOENT is acceptable (path doesn't exist yet)
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      // Path doesn't exist, which is safe
      return safePath;
    }
    // SecurityError should be propagated
    if (error instanceof SecurityError) {
      throw error;
    }
    // Other errors indicate potential security issues
    throw new SecurityError('PATH_VALIDATION', `Unable to validate path security: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return safePath;
}