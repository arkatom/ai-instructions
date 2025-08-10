import { ProjectConfig } from './config';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';

// Type definitions for presets
export type SupportedTool = 'claude' | 'cursor' | 'cline' | 'github-copilot';
export type SupportedWorkflow = 'github-flow' | 'git-flow';
export type PresetCategory = 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'custom';

export interface ConfigPreset {
  id: string;
  name: string;
  description: string;
  config: ProjectConfig;
  createdAt: string;
  updatedAt: string;
  author: string;
  tags?: string[];
  category?: PresetCategory;
}

export interface PresetSearchCriteria {
  tool?: SupportedTool;
  language?: string;
  methodology?: string;
  category?: string;
  tag?: string;
}

export interface PresetSummary {
  id: string;
  name: string;
  description: string;
  category?: PresetCategory;
  tags?: string[];
}

export class PresetManager {
  private presetsDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.presetsDir = join(baseDir, '.ai-instructions-presets');
    this.ensurePresetsDirectory();
  }

  /**
   * Get built-in preset by ID
   */
  getBuiltinPreset(id: string): ConfigPreset | null {
    const builtinPresets = this.getBuiltinPresets();
    return builtinPresets[id] || null;
  }

  /**
   * List all built-in presets
   */
  listBuiltinPresets(): PresetSummary[] {
    const builtinPresets = this.getBuiltinPresets();
    return Object.values(builtinPresets).map(preset => {
      const summary: PresetSummary = {
        id: preset.id,
        name: preset.name,
        description: preset.description
      };
      
      if (preset.category) summary.category = preset.category;
      if (preset.tags) summary.tags = preset.tags;
      
      return summary;
    });
  }

  /**
   * Save custom preset
   */
  async saveCustomPreset(preset: ConfigPreset): Promise<void> {
    // Validate preset ID for security
    if (!PresetManager.validatePresetId(preset.id)) {
      throw new Error(`Invalid preset ID: ${preset.id}. Only alphanumeric, hyphen, and underscore characters are allowed.`);
    }
    
    if (!PresetManager.validatePreset(preset)) {
      throw new Error('Invalid preset structure');
    }

    const presetPath = join(this.presetsDir, `${preset.id}.json`);
    const presetData = {
      ...preset,
      updatedAt: new Date().toISOString()
    };

    writeFileSync(presetPath, JSON.stringify(presetData, null, 2));
    console.log(`Saved custom preset: ${preset.name}`);
  }

  /**
   * Load custom preset by ID
   */
  async loadCustomPreset(id: string): Promise<ConfigPreset | null> {
    // Validate ID for security
    if (!PresetManager.validatePresetId(id)) {
      console.warn(`Invalid preset ID: ${id}`);
      return null;
    }
    
    const presetPath = join(this.presetsDir, `${id}.json`);
    
    if (!existsSync(presetPath)) {
      return null;
    }

    try {
      const content = readFileSync(presetPath, 'utf-8');
      const rawPreset = JSON.parse(content);
      
      // Sanitize JSON to prevent prototype pollution
      const sanitizedPreset = PresetManager.sanitizeJSON(rawPreset);
      
      if (!PresetManager.validatePreset(sanitizedPreset)) {
        console.warn(`Invalid preset file: ${presetPath}`);
        return null;
      }

      return sanitizedPreset as ConfigPreset;
    } catch (error) {
      console.warn(`Failed to load preset ${id}:`, error);
      return null;
    }
  }

  /**
   * List all custom presets
   */
  async listCustomPresets(): Promise<PresetSummary[]> {
    if (!existsSync(this.presetsDir)) {
      return [];
    }

    const presetFiles = readdirSync(this.presetsDir)
      .filter(file => file.endsWith('.json'));

    const presets: PresetSummary[] = [];

    for (const file of presetFiles) {
      const id = file.replace('.json', '');
      const preset = await this.loadCustomPreset(id);
      
      if (preset) {
        const summary: PresetSummary = {
          id: preset.id,
          name: preset.name,
          description: preset.description
        };
        
        if (preset.category) summary.category = preset.category;
        if (preset.tags) summary.tags = preset.tags;
        
        presets.push(summary);
      }
    }

    return presets;
  }

  /**
   * Delete custom preset
   */
  async deleteCustomPreset(id: string): Promise<boolean> {
    const presetPath = join(this.presetsDir, `${id}.json`);
    
    if (!existsSync(presetPath)) {
      return false;
    }

    try {
      unlinkSync(presetPath);
      console.log(`Deleted custom preset: ${id}`);
      return true;
    } catch (error) {
      console.warn(`Failed to delete preset ${id}:`, error);
      return false;
    }
  }

  /**
   * Apply preset with customizations
   */
  applyPreset(
    preset: ConfigPreset, 
    customizations: Partial<ProjectConfig> = {}
  ): ProjectConfig {
    return {
      ...preset.config,
      ...customizations,
      generatedAt: new Date().toISOString(),
      version: '0.5.0'
    };
  }

  /**
   * Export preset to file
   */
  async exportPreset(presetId: string, exportPath: string): Promise<boolean> {
    const preset = await this.loadCustomPreset(presetId);
    
    if (!preset) {
      console.warn(`Preset ${presetId} not found`);
      return false;
    }

    try {
      writeFileSync(exportPath, JSON.stringify(preset, null, 2));
      console.log(`Exported preset to: ${exportPath}`);
      return true;
    } catch (error) {
      console.warn(`Failed to export preset:`, error);
      return false;
    }
  }

  /**
   * Import preset from file
   */
  async importPreset(importPath: string): Promise<boolean> {
    if (!existsSync(importPath)) {
      console.warn(`Import file not found: ${importPath}`);
      return false;
    }

    try {
      const content = readFileSync(importPath, 'utf-8');
      const rawPreset = JSON.parse(content);
      
      // Sanitize JSON to prevent prototype pollution
      const sanitizedPreset = PresetManager.sanitizeJSON(rawPreset);
      
      if (!PresetManager.validatePreset(sanitizedPreset)) {
        console.warn(`Invalid preset file: ${importPath}`);
        return false;
      }

      await this.saveCustomPreset(sanitizedPreset as ConfigPreset);
      console.log(`Imported preset: ${(sanitizedPreset as ConfigPreset).name}`);
      return true;
    } catch (error) {
      console.warn(`Failed to import preset:`, error);
      return false;
    }
  }

  /**
   * Search presets by criteria
   */
  searchPresets(criteria: PresetSearchCriteria): ConfigPreset[] {
    const builtinPresets = Object.values(this.getBuiltinPresets());
    
    return builtinPresets.filter(preset => {
      if (criteria.tool && preset.config.tool !== criteria.tool) {
        return false;
      }
      
      if (criteria.language && !preset.config.languages.includes(criteria.language)) {
        return false;
      }
      
      if (criteria.methodology && !preset.config.methodologies.includes(criteria.methodology)) {
        return false;
      }
      
      if (criteria.category && preset.category !== criteria.category) {
        return false;
      }
      
      if (criteria.tag && (!preset.tags || !preset.tags.includes(criteria.tag))) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Validate preset structure
   */
  static validatePreset(preset: unknown): preset is ConfigPreset {
    // Type guard: ensure preset is an object
    if (typeof preset !== 'object' || preset === null) {
      return false;
    }
    
    const presetObj = preset as Record<string, unknown>;
    const requiredFields = ['id', 'name', 'description', 'config', 'createdAt', 'updatedAt', 'author'];
    
    for (const field of requiredFields) {
      if (!(field in presetObj)) {
        return false;
      }
    }

    // Validate config structure
    const config = presetObj.config;
    if (typeof config !== 'object' || config === null) {
      return false;
    }
    const configObj = config as Record<string, unknown>;
    const configRequiredFields = ['tool', 'workflow', 'methodologies', 'languages', 'projectName', 'outputDirectory'];
    
    for (const field of configRequiredFields) {
      if (!(field in configObj)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate preset ID for security (prevent path traversal)
   */
  private static validatePresetId(id: string): boolean {
    // Allow only alphanumeric, hyphen, underscore
    const validIdPattern = /^[a-zA-Z0-9-_]+$/;
    
    // Check for path traversal attempts
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      return false;
    }
    
    // Check for command injection attempts
    if (id.includes('|') || id.includes(';') || id.includes('$') || 
        id.includes('`') || id.includes('&') || id.includes('<') || 
        id.includes('>') || id.includes('(') || id.includes(')')) {
      return false;
    }
    
    // Length check
    if (id.length === 0 || id.length > 100) {
      return false;
    }
    
    return validIdPattern.test(id);
  }

  /**
   * Sanitize JSON to prevent prototype pollution
   */
  private static sanitizeJSON(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    // Remove dangerous keys
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    
    if (Array.isArray(obj)) {
      return obj.map(item => PresetManager.sanitizeJSON(item));
    }
    
    const sanitized: Record<string, unknown> = {};
    const objRecord = obj as Record<string, unknown>;
    for (const key in objRecord) {
      if (Object.prototype.hasOwnProperty.call(objRecord, key) && !dangerousKeys.includes(key)) {
        sanitized[key] = PresetManager.sanitizeJSON(objRecord[key]);
      }
    }
    
    // Set prototype to null to prevent pollution
    Object.setPrototypeOf(sanitized, null);
    
    return sanitized;
  }

  /**
   * Ensure presets directory exists
   */
  private ensurePresetsDirectory(): void {
    if (!existsSync(this.presetsDir)) {
      mkdirSync(this.presetsDir, { recursive: true });
    }
  }

  /**
   * Get built-in presets collection
   */
  private getBuiltinPresets(): Record<string, ConfigPreset> {
    const baseTime = new Date().toISOString();
    
    return {
      'react-frontend': {
        id: 'react-frontend',
        name: 'React Frontend',
        description: 'Modern React frontend development with TypeScript and testing',
        config: {
          tool: 'claude',
          workflow: 'github-flow',
          methodologies: ['github-idd', 'tdd'],
          languages: ['typescript', 'javascript'],
          agents: ['frontend-specialist'],
          projectName: 'react-app',
          outputDirectory: process.cwd(),
          generatedAt: baseTime,
          version: '0.5.0'
        },
        category: 'frontend',
        tags: ['react', 'typescript', 'frontend', 'web'],
        createdAt: baseTime,
        updatedAt: baseTime,
        author: 'ai-instructions-builtin'
      },

      'nodejs-backend': {
        id: 'nodejs-backend',
        name: 'Node.js Backend',
        description: 'Node.js backend API development with TypeScript and testing',
        config: {
          tool: 'claude',
          workflow: 'github-flow',
          methodologies: ['tdd', 'github-idd'],
          languages: ['typescript'],
          agents: ['backend-architect'],
          projectName: 'nodejs-api',
          outputDirectory: process.cwd(),
          generatedAt: baseTime,
          version: '0.5.0'
        },
        category: 'backend',
        tags: ['nodejs', 'api', 'backend', 'typescript'],
        createdAt: baseTime,
        updatedAt: baseTime,
        author: 'ai-instructions-builtin'
      },

      'fullstack-typescript': {
        id: 'fullstack-typescript',
        name: 'Full-Stack TypeScript',
        description: 'Complete full-stack TypeScript application with modern practices',
        config: {
          tool: 'claude',
          workflow: 'github-flow',
          methodologies: ['github-idd', 'tdd'],
          languages: ['typescript'],
          agents: ['frontend-specialist', 'backend-architect'],
          projectName: 'fullstack-app',
          outputDirectory: process.cwd(),
          generatedAt: baseTime,
          version: '0.5.0'
        },
        category: 'fullstack',
        tags: ['typescript', 'fullstack', 'web', 'api'],
        createdAt: baseTime,
        updatedAt: baseTime,
        author: 'ai-instructions-builtin'
      },

      'python-data-science': {
        id: 'python-data-science',
        name: 'Python Data Science',
        description: 'Python development setup for data science and machine learning',
        config: {
          tool: 'cursor',
          workflow: 'git-flow',
          methodologies: ['scrum'],
          languages: ['python'],
          agents: ['data-scientist'],
          projectName: 'data-project',
          outputDirectory: process.cwd(),
          generatedAt: baseTime,
          version: '0.5.0'
        },
        category: 'backend',
        tags: ['python', 'data-science', 'ml', 'jupyter'],
        createdAt: baseTime,
        updatedAt: baseTime,
        author: 'ai-instructions-builtin'
      },

      'mobile-react-native': {
        id: 'mobile-react-native',
        name: 'React Native Mobile',
        description: 'Cross-platform mobile development with React Native and TypeScript',
        config: {
          tool: 'claude',
          workflow: 'github-flow',
          methodologies: ['github-idd'],
          languages: ['typescript', 'javascript'],
          agents: ['mobile-developer'],
          projectName: 'mobile-app',
          outputDirectory: process.cwd(),
          generatedAt: baseTime,
          version: '0.5.0'
        },
        category: 'mobile',
        tags: ['react-native', 'mobile', 'typescript', 'cross-platform'],
        createdAt: baseTime,
        updatedAt: baseTime,
        author: 'ai-instructions-builtin'
      }
    };
  }
}