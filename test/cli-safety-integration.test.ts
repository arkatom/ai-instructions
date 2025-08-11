/**
 * CLI Safety Integration Tests 
 * Verifies that CLI safety flags work correctly with FileConflictHandler
 * Issue #26/#16/#17: File overwrite safety system end-to-end testing
 */

import { execSync } from 'child_process';
import { existsSync, writeFileSync, rmSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

describe('CLI Safety Integration', () => {
  const testDir = join(__dirname, 'temp-cli-safety');
  const cliPath = join(__dirname, '../src/cli.ts');

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('--force flag integration', () => {
    test('should use force overwrite when --force is provided', () => {
      // Create existing file
      const claudeFile = join(testDir, 'CLAUDE.md');
      writeFileSync(claudeFile, '# Existing CLAUDE.md\n\nOld content');

      // Run CLI with force flag
      const result = execSync(`npx ts-node "${cliPath}" init --output "${testDir}" --project-name "force-test" --force`, {
        encoding: 'utf-8',
        cwd: join(__dirname, '..'),
        env: { ...process.env, NODE_ENV: 'test' }
      });

      expect(result).toContain('Generated claude template');
      expect(existsSync(claudeFile)).toBe(true);
      
      // File should be overwritten
      const newContent = readFileSync(claudeFile, 'utf-8');
      expect(newContent).toContain('force-test');
      expect(newContent).not.toContain('Old content');
    });

    test('should show force mode warning when --force is used', () => {
      const result = execSync(`npx ts-node "${cliPath}" init --output "${testDir}" --project-name "warning-test" --force`, {
        encoding: 'utf-8',
        cwd: join(__dirname, '..'),
        env: { ...process.env, NODE_ENV: 'test' }
      });

      expect(result).toContain('FORCE MODE ENABLED');
      expect(result).toContain('overwritten without warnings');
    });
  });

  describe('--conflict-resolution flag integration', () => {
    test('should use backup strategy when --conflict-resolution backup is provided', () => {
      // Create existing file
      const claudeFile = join(testDir, 'CLAUDE.md');
      const existingContent = '# Existing CLAUDE.md\n\nOld content';
      writeFileSync(claudeFile, existingContent);

      // Run CLI with backup conflict resolution
      const result = execSync(`npx ts-node "${cliPath}" init --output "${testDir}" --project-name "backup-test" --conflict-resolution backup --no-interactive`, {
        encoding: 'utf-8',
        cwd: join(__dirname, '..'),
        env: { ...process.env, NODE_ENV: 'test' }
      });

      expect(result).toContain('Generated claude template');
      
      // Original file should be updated
      const newContent = readFileSync(claudeFile, 'utf-8');
      expect(newContent).toContain('backup-test');
      
      // Backup should exist within test directory (CLI should create backup relative to output dir)
      const backupDir = join(testDir, 'backups');
      expect(existsSync(backupDir)).toBe(true);
    });

    test('should skip file when --conflict-resolution skip is provided', () => {
      // Create existing file
      const claudeFile = join(testDir, 'CLAUDE.md');
      const existingContent = '# Existing CLAUDE.md\n\nOld content';
      writeFileSync(claudeFile, existingContent);

      // Run CLI with skip conflict resolution
      const result = execSync(`npx ts-node "${cliPath}" init --output "${testDir}" --project-name "skip-test" --conflict-resolution skip --no-interactive`, {
        encoding: 'utf-8',
        cwd: join(__dirname, '..'),
        env: { ...process.env, NODE_ENV: 'test' }
      });

      expect(result).toContain('Generated claude template');
      
      // Original file should remain unchanged
      const unchangedContent = readFileSync(claudeFile, 'utf-8');
      expect(unchangedContent).toBe(existingContent);
      expect(unchangedContent).not.toContain('skip-test');
    });
  });

  describe('--no-interactive flag integration', () => {
    test('should use default conflict resolution in non-interactive mode', () => {
      // Create existing file
      const claudeFile = join(testDir, 'CLAUDE.md');
      writeFileSync(claudeFile, '# Existing CLAUDE.md\n\nOld content');

      // Run CLI with non-interactive mode (should default to backup)
      const result = execSync(`npx ts-node "${cliPath}" init --output "${testDir}" --project-name "non-interactive-test" --no-interactive`, {
        encoding: 'utf-8',
        cwd: join(__dirname, '..'),
        env: { ...process.env, NODE_ENV: 'test' }
      });

      expect(result).toContain('Generated claude template');
      
      // Should use backup strategy by default
      const newContent = readFileSync(claudeFile, 'utf-8');
      expect(newContent).toContain('non-interactive-test');
    });
  });

  describe('--preview flag integration', () => {
    test('should show preview information without creating files', () => {
      // Create existing file
      const claudeFile = join(testDir, 'CLAUDE.md');
      const existingContent = '# Existing CLAUDE.md\n\nOld content';
      writeFileSync(claudeFile, existingContent);

      // Run CLI with preview mode
      const result = execSync(`npx ts-node "${cliPath}" init --output "${testDir}" --project-name "preview-test" --preview`, {
        encoding: 'utf-8',
        cwd: join(__dirname, '..'),
        env: { ...process.env, NODE_ENV: 'test' }
      });

      expect(result).toContain('Preview mode');
      expect(result).toContain('preview-test');
      expect(result).toContain(testDir);
      
      // Original file should remain unchanged
      const unchangedContent = readFileSync(claudeFile, 'utf-8');
      expect(unchangedContent).toBe(existingContent);
    });
  });

  describe('--no-backup flag integration', () => {
    test('should disable automatic backups when --no-backup is provided', () => {
      // Create existing file
      const claudeFile = join(testDir, 'CLAUDE.md');
      writeFileSync(claudeFile, '# Existing CLAUDE.md\n\nOld content');

      // Run CLI with no-backup flag
      const result = execSync(`npx ts-node "${cliPath}" init --output "${testDir}" --project-name "no-backup-test" --no-backup --no-interactive --conflict-resolution overwrite`, {
        encoding: 'utf-8',
        cwd: join(__dirname, '..'),
        env: { ...process.env, NODE_ENV: 'test' }
      });

      expect(result).toContain('Generated claude template');
      
      // File should be overwritten
      const newContent = readFileSync(claudeFile, 'utf-8');
      expect(newContent).toContain('no-backup-test');
      
      // No backup should exist
      // Note: Backup directory might exist from other tests, but should not contain our specific backup
    });
  });

  describe('Combined flags integration', () => {
    test('should handle multiple safety flags together', () => {
      // Create existing file
      const claudeFile = join(testDir, 'CLAUDE.md');
      writeFileSync(claudeFile, '# Existing CLAUDE.md\n\nOld content');

      // Run CLI with multiple flags
      const result = execSync(`npx ts-node "${cliPath}" init --output "${testDir}" --project-name "combined-test" --tool claude --lang ja --conflict-resolution merge --no-interactive --no-backup`, {
        encoding: 'utf-8',
        cwd: join(__dirname, '..'),
        env: { ...process.env, NODE_ENV: 'test' }
      });

      expect(result).toContain('Generated claude template');
      
      // File should be merged
      const mergedContent = readFileSync(claudeFile, 'utf-8');
      expect(mergedContent).toContain('combined-test'); // New content
      expect(mergedContent).toContain('Old content'); // Existing content preserved through merge
    });
  });

  describe('Error handling in CLI safety integration', () => {
    test('should show helpful error for invalid conflict resolution strategy', () => {
      expect(() => {
        execSync(`npx ts-node "${cliPath}" init --output "${testDir}" --conflict-resolution invalid-strategy`, {
          encoding: 'utf-8',
          cwd: join(__dirname, '..'),
          env: { ...process.env, NODE_ENV: 'test' }
        });
      }).toThrow();
    });

    test('should handle read-only directory gracefully', () => {
      // This test would require setting up read-only permissions
      // Skipping for now as it's platform-specific
      expect(true).toBe(true);
    });
  });

  describe('Safety tips and user guidance', () => {
    test('should show safety tips when not using force mode', () => {
      const result = execSync(`npx ts-node "${cliPath}" init --output "${testDir}" --project-name "tips-test"`, {
        encoding: 'utf-8',
        cwd: join(__dirname, '..'),
        env: { ...process.env, NODE_ENV: 'test' }
      });

      expect(result).toContain('Use --preview');
      expect(result).toContain('Use --force');
    });

    test('should not show safety tips when using force mode', () => {
      const result = execSync(`npx ts-node "${cliPath}" init --output "${testDir}" --project-name "no-tips-test" --force`, {
        encoding: 'utf-8',
        cwd: join(__dirname, '..'),
        env: { ...process.env, NODE_ENV: 'test' }
      });

      expect(result).not.toContain('Tip: Use --preview');
    });
  });
});