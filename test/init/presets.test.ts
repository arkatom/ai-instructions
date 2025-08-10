import { PresetManager, ConfigPreset } from '../../src/init/presets';
import { ProjectConfig } from '../../src/init/config';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

describe('PresetManager', () => {
  let presetManager: PresetManager;
  const testDir = join(__dirname, '../.test-presets');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }

    presetManager = new PresetManager(testDir);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Built-in Presets', () => {
    it('should provide React Frontend preset', () => {
      // Act
      const preset = presetManager.getBuiltinPreset('react-frontend');

      // Assert
      expect(preset).toBeDefined();
      expect(preset?.name).toBe('React Frontend');
      expect(preset?.config.tool).toBe('claude');
      expect(preset?.config.languages).toContain('typescript');
      expect(preset?.config.methodologies).toContain('github-idd');
      expect(preset?.config.agents).toContain('frontend-specialist');
    });

    it('should provide Node.js Backend preset', () => {
      // Act
      const preset = presetManager.getBuiltinPreset('nodejs-backend');

      // Assert
      expect(preset).toBeDefined();
      expect(preset?.name).toBe('Node.js Backend');
      expect(preset?.config.languages).toContain('typescript');
      expect(preset?.config.methodologies).toContain('tdd');
      expect(preset?.config.agents).toContain('backend-architect');
    });

    it('should provide Full-Stack TypeScript preset', () => {
      // Act
      const preset = presetManager.getBuiltinPreset('fullstack-typescript');

      // Assert
      expect(preset).toBeDefined();
      expect(preset?.name).toBe('Full-Stack TypeScript');
      expect(preset?.config.languages).toEqual(['typescript']);
      expect(preset?.config.agents).toEqual(['frontend-specialist', 'backend-architect']);
      expect(preset?.config.methodologies).toContain('github-idd');
      expect(preset?.config.methodologies).toContain('tdd');
    });

    it('should list all built-in presets', () => {
      // Act
      const presets = presetManager.listBuiltinPresets();

      // Assert
      expect(presets.length).toBeGreaterThanOrEqual(3);
      expect(presets.find(p => p.id === 'react-frontend')).toBeDefined();
      expect(presets.find(p => p.id === 'nodejs-backend')).toBeDefined();
      expect(presets.find(p => p.id === 'fullstack-typescript')).toBeDefined();
    });

    it('should return null for unknown built-in preset', () => {
      // Act
      const preset = presetManager.getBuiltinPreset('unknown-preset');

      // Assert
      expect(preset).toBeNull();
    });
  });

  describe('Custom Presets', () => {
    it('should save custom preset', async () => {
      // Arrange
      const customConfig: ProjectConfig = {
        tool: 'cursor',
        workflow: 'git-flow',
        methodologies: ['scrum'],
        languages: ['python'],
        projectName: 'custom-preset-test',
        outputDirectory: '/test/path',
        generatedAt: new Date().toISOString(),
        version: '0.5.0'
      };

      const preset: ConfigPreset = {
        id: 'my-python-setup',
        name: 'My Python Setup',
        description: 'Custom Python development preset with Scrum methodology',
        config: customConfig,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'test-user'
      };

      // Act
      await presetManager.saveCustomPreset(preset);

      // Assert
      const savedPreset = await presetManager.loadCustomPreset('my-python-setup');
      expect(savedPreset).toEqual(preset);
      expect(savedPreset?.config.tool).toBe('cursor');
      expect(savedPreset?.config.languages).toEqual(['python']);
    });

    it('should update existing custom preset', async () => {
      // Arrange
      const originalPreset: ConfigPreset = {
        id: 'update-test',
        name: 'Update Test',
        description: 'Original description',
        config: {
          tool: 'claude',
          workflow: 'github-flow',
          methodologies: ['github-idd'],
          languages: ['javascript'],
          projectName: 'update-test',
          outputDirectory: '/test',
          generatedAt: new Date().toISOString(),
          version: '0.5.0'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'test-user'
      };

      await presetManager.saveCustomPreset(originalPreset);

      // Act - Update the preset
      const updatedPreset = {
        ...originalPreset,
        description: 'Updated description',
        config: {
          ...originalPreset.config,
          languages: ['typescript']
        },
        updatedAt: new Date().toISOString()
      };

      await presetManager.saveCustomPreset(updatedPreset);

      // Assert
      const loadedPreset = await presetManager.loadCustomPreset('update-test');
      expect(loadedPreset?.description).toBe('Updated description');
      expect(loadedPreset?.config.languages).toEqual(['typescript']);
    });

    it('should list custom presets', async () => {
      // Arrange
      const preset1: ConfigPreset = {
        id: 'custom-1',
        name: 'Custom 1',
        description: 'First custom preset',
        config: {
          tool: 'claude',
          workflow: 'github-flow',
          methodologies: ['github-idd'],
          languages: ['typescript'],
          projectName: 'test',
          outputDirectory: '/test',
          generatedAt: new Date().toISOString(),
          version: '0.5.0'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'test-user'
      };

      const preset2: ConfigPreset = {
        id: 'custom-2',
        name: 'Custom 2',
        description: 'Second custom preset',
        config: {
          tool: 'cursor',
          workflow: 'git-flow',
          methodologies: ['tdd'],
          languages: ['python'],
          projectName: 'test',
          outputDirectory: '/test',
          generatedAt: new Date().toISOString(),
          version: '0.5.0'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'test-user'
      };

      await presetManager.saveCustomPreset(preset1);
      await presetManager.saveCustomPreset(preset2);

      // Act
      const customPresets = await presetManager.listCustomPresets();

      // Assert
      expect(customPresets).toHaveLength(2);
      expect(customPresets.find(p => p.id === 'custom-1')).toBeDefined();
      expect(customPresets.find(p => p.id === 'custom-2')).toBeDefined();
    });

    it('should delete custom preset', async () => {
      // Arrange
      const preset: ConfigPreset = {
        id: 'delete-test',
        name: 'Delete Test',
        description: 'Preset to be deleted',
        config: {
          tool: 'claude',
          workflow: 'github-flow',
          methodologies: ['github-idd'],
          languages: ['typescript'],
          projectName: 'test',
          outputDirectory: '/test',
          generatedAt: new Date().toISOString(),
          version: '0.5.0'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'test-user'
      };

      await presetManager.saveCustomPreset(preset);

      // Act
      const deleted = await presetManager.deleteCustomPreset('delete-test');

      // Assert
      expect(deleted).toBe(true);
      const loadedPreset = await presetManager.loadCustomPreset('delete-test');
      expect(loadedPreset).toBeNull();
    });

    it('should return false when deleting non-existent preset', async () => {
      // Act
      const deleted = await presetManager.deleteCustomPreset('non-existent');

      // Assert
      expect(deleted).toBe(false);
    });
  });

  describe('Preset Application', () => {
    it('should apply preset to create configuration', () => {
      // Arrange
      const preset = presetManager.getBuiltinPreset('react-frontend')!;
      const customizations = {
        projectName: 'my-react-app',
        outputDirectory: '/my/project'
      };

      // Act
      const config = presetManager.applyPreset(preset, customizations);

      // Assert
      expect(config.projectName).toBe('my-react-app');
      expect(config.outputDirectory).toBe('/my/project');
      expect(config.tool).toBe(preset.config.tool);
      expect(config.languages).toEqual(preset.config.languages);
      expect(config.methodologies).toEqual(preset.config.methodologies);
      expect(config.agents).toEqual(preset.config.agents);
    });

    it('should apply preset with overrides', () => {
      // Arrange
      const preset = presetManager.getBuiltinPreset('nodejs-backend')!;
      const overrides = {
        tool: 'cursor' as const,
        languages: ['javascript', 'python'],
        methodologies: ['scrum', 'github-idd']
      };

      // Act
      const config = presetManager.applyPreset(preset, overrides);

      // Assert
      expect(config.tool).toBe('cursor');
      expect(config.languages).toEqual(['javascript', 'python']);
      expect(config.methodologies).toEqual(['scrum', 'github-idd']);
      // Other values should come from preset
      expect(config.workflow).toBe(preset.config.workflow);
    });
  });

  describe('Preset Export/Import', () => {
    it('should export preset to JSON', async () => {
      // Arrange
      const preset: ConfigPreset = {
        id: 'export-test',
        name: 'Export Test',
        description: 'Preset for export testing',
        config: {
          tool: 'claude',
          workflow: 'github-flow',
          methodologies: ['github-idd'],
          languages: ['typescript'],
          projectName: 'export-test',
          outputDirectory: '/test',
          generatedAt: new Date().toISOString(),
          version: '0.5.0'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'test-user'
      };

      await presetManager.saveCustomPreset(preset);

      // Act
      const exportPath = join(testDir, 'exported-preset.json');
      const success = await presetManager.exportPreset('export-test', exportPath);

      // Assert
      expect(success).toBe(true);
      expect(existsSync(exportPath)).toBe(true);
      
      const exportedContent = require(exportPath);
      expect(exportedContent.id).toBe('export-test');
      expect(exportedContent.name).toBe('Export Test');
    });

    it('should import preset from JSON', async () => {
      // Arrange
      const preset: ConfigPreset = {
        id: 'import-test',
        name: 'Import Test',
        description: 'Preset for import testing',
        config: {
          tool: 'cursor',
          workflow: 'git-flow',
          methodologies: ['tdd'],
          languages: ['python'],
          projectName: 'import-test',
          outputDirectory: '/test',
          generatedAt: new Date().toISOString(),
          version: '0.5.0'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'external-user'
      };

      const importPath = join(testDir, 'import-preset.json');
      writeFileSync(importPath, JSON.stringify(preset, null, 2));

      // Act
      const success = await presetManager.importPreset(importPath);

      // Assert
      expect(success).toBe(true);
      const importedPreset = await presetManager.loadCustomPreset('import-test');
      expect(importedPreset).toBeDefined();
      expect(importedPreset?.name).toBe('Import Test');
      expect(importedPreset?.config.tool).toBe('cursor');
    });

    it('should handle invalid import file', async () => {
      // Arrange
      const invalidPath = join(testDir, 'invalid.json');
      writeFileSync(invalidPath, 'invalid json content');

      // Act
      const success = await presetManager.importPreset(invalidPath);

      // Assert
      expect(success).toBe(false);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to import preset'),
        expect.any(Error)
      );
    });
  });

  describe('Preset Validation', () => {
    it('should validate preset structure', () => {
      // Arrange
      const validPreset: ConfigPreset = {
        id: 'valid-preset',
        name: 'Valid Preset',
        description: 'A valid preset',
        config: {
          tool: 'claude',
          workflow: 'github-flow',
          methodologies: ['github-idd'],
          languages: ['typescript'],
          projectName: 'valid-test',
          outputDirectory: '/test',
          generatedAt: new Date().toISOString(),
          version: '0.5.0'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'test-user'
      };

      // Act
      const isValid = PresetManager.validatePreset(validPreset);

      // Assert
      expect(isValid).toBe(true);
    });

    it('should reject invalid preset', () => {
      // Arrange
      const invalidPreset = {
        id: 'invalid-preset',
        // Missing required fields
      };

      // Act
      const isValid = PresetManager.validatePreset(invalidPreset as any);

      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('Preset Search', () => {
    it('should search presets by language', () => {
      // Act
      const typescriptPresets = presetManager.searchPresets({ language: 'typescript' });

      // Assert
      expect(typescriptPresets.length).toBeGreaterThan(0);
      typescriptPresets.forEach(preset => {
        expect(preset.config.languages).toContain('typescript');
      });
    });

    it('should search presets by methodology', () => {
      // Act
      const tddPresets = presetManager.searchPresets({ methodology: 'tdd' });

      // Assert
      expect(tddPresets.length).toBeGreaterThan(0);
      tddPresets.forEach(preset => {
        expect(preset.config.methodologies).toContain('tdd');
      });
    });

    it('should search presets by tool', () => {
      // Act
      const claudePresets = presetManager.searchPresets({ tool: 'claude' });

      // Assert
      expect(claudePresets.length).toBeGreaterThan(0);
      claudePresets.forEach(preset => {
        expect(preset.config.tool).toBe('claude');
      });
    });

    it('should combine search criteria', () => {
      // Act
      const filteredPresets = presetManager.searchPresets({
        tool: 'claude',
        language: 'typescript',
        methodology: 'github-idd'
      });

      // Assert
      expect(filteredPresets.length).toBeGreaterThan(0);
      filteredPresets.forEach(preset => {
        expect(preset.config.tool).toBe('claude');
        expect(preset.config.languages).toContain('typescript');
        expect(preset.config.methodologies).toContain('github-idd');
      });
    });
  });
});