/**
 * Path Security Validator
 * Pure functions for path traversal prevention and security validation
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
  
  // Check for symbolic links
  try {
    if (fs.existsSync(safePath) && fs.lstatSync(safePath).isSymbolicLink()) {
      throw new SecurityError('SYMLINK', 'Symbolic links not allowed');
    }
  } catch (error) {
    // If we can't check, it's safer to reject
    if (!(error instanceof SecurityError)) {
      throw new SecurityError('PATH_VALIDATION', 'Unable to validate path security');
    }
    throw error;
  }
  
  return safePath;
}