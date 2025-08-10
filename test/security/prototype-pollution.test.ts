/**
 * セキュリティテスト: JSONプロトタイプ汚染攻撃対策
 * TDD: Red Phase - 脆弱性を検出するテストを先に作成
 */

import { PresetManager } from '../../src/init/presets';
import { join } from 'path';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';

describe('Security: JSON Prototype Pollution Prevention', () => {
  const testDir = join(__dirname, '../temp-pollution-test');
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

  it('should prevent prototype pollution when loading malicious JSON', async () => {
    // Create a malicious JSON file
    const maliciousPresetPath = join(testDir, '.ai-instructions-presets', 'malicious.json');
    mkdirSync(join(testDir, '.ai-instructions-presets'), { recursive: true });
    
    const maliciousJSON = {
      id: 'malicious',
      name: 'Test',
      description: 'Test',
      config: {
        tool: 'claude',
        workflow: 'github-flow',
        methodologies: ['tdd'],
        languages: ['typescript'],
        projectName: 'test',
        outputDirectory: '/tmp/test',
        generatedAt: new Date().toISOString(),
        version: '0.5.0'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: 'test',
      '__proto__': {
        'isAdmin': true,
        'polluted': 'yes'
      },
      'constructor': {
        'prototype': {
          'isAdmin': true
        }
      }
    };
    
    writeFileSync(maliciousPresetPath, JSON.stringify(maliciousJSON));
    
    // Load the malicious preset
    const loadedPreset = await presetManager.loadCustomPreset('malicious');
    
    // Check that prototype pollution didn't occur
    const testObj: Record<string, unknown> = {};
    expect(testObj.isAdmin).toBeUndefined();
    expect(testObj.polluted).toBeUndefined();
    
    // Check that dangerous keys were removed
    if (loadedPreset) {
      expect(loadedPreset).not.toHaveProperty('__proto__');
      expect(loadedPreset).not.toHaveProperty('constructor');
      expect(loadedPreset).not.toHaveProperty('prototype');
    }
  });

  it('should sanitize nested objects for prototype pollution', async () => {
    const maliciousPresetPath = join(testDir, '.ai-instructions-presets', 'nested-malicious.json');
    mkdirSync(join(testDir, '.ai-instructions-presets'), { recursive: true });
    
    const maliciousJSON = {
      id: 'nested-malicious',
      name: 'Test',
      description: 'Test',
      config: {
        tool: 'claude',
        workflow: 'github-flow',
        methodologies: ['tdd'],
        languages: ['typescript'],
        projectName: 'test',
        outputDirectory: '/tmp/test',
        generatedAt: new Date().toISOString(),
        version: '0.5.0',
        nested: {
          '__proto__': {
            'polluted': 'yes'
          }
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: 'test'
    };
    
    writeFileSync(maliciousPresetPath, JSON.stringify(maliciousJSON));
    
    const loadedPreset = await presetManager.loadCustomPreset('nested-malicious');
    
    // Check that nested prototype pollution didn't occur
    const testObj: Record<string, unknown> = {};
    expect(testObj.polluted).toBeUndefined();
    
    // Check that nested dangerous keys were removed
    if (loadedPreset && loadedPreset.config) {
      const configObj = loadedPreset.config as Record<string, unknown>;
      if (configObj.nested) {
        expect(configObj.nested).not.toHaveProperty('__proto__');
      }
    }
  });
});