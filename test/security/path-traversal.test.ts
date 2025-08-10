/**
 * セキュリティテスト: パストラバーサル攻撃対策
 * TDD: Red Phase - 脆弱性を検出するテストを先に作成
 */

import { PresetManager } from '../../src/init/presets';
import { join } from 'path';
import { existsSync, rmSync, mkdirSync } from 'fs';

describe('Security: Path Traversal Prevention', () => {
  const testDir = join(__dirname, '../temp-security-test');
  let presetManager: PresetManager;
  
  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    presetManager = new PresetManager(testDir);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should reject preset IDs with path traversal attempts', async () => {
    const maliciousIds = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32',
      'valid/../../../malicious',
      './../sensitive'
    ];

    for (const maliciousId of maliciousIds) {
      const preset = {
        id: maliciousId,
        name: 'Malicious Preset',
        description: 'Attack attempt',
        config: {
          tool: 'claude' as const,
          workflow: 'github-flow' as const,
          methodologies: ['tdd'],
          languages: ['typescript'],
          projectName: 'test',
          outputDirectory: '/tmp/test',
          generatedAt: new Date().toISOString(),
          version: '0.5.0'
        },
        category: 'custom' as const,
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'attacker'
      };

      await expect(presetManager.saveCustomPreset(preset))
        .rejects
        .toThrow(/Invalid preset ID/);
    }
  });
});