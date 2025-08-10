/**
 * Configuration management for interactive init command
 * Handles project configuration schema, validation, and persistence
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface ProjectConfig {
  /** AI tool selection */
  tool: 'claude' | 'cursor' | 'cline' | 'github-copilot';
  
  /** Development workflow */
  workflow: 'github-flow' | 'git-flow';
  
  /** Selected methodologies */
  methodologies: string[];
  
  /** Programming languages */
  languages: string[];
  
  /** Selected agents (Claude only) */
  agents?: string[];
  
  /** Generation timestamp */
  generatedAt: string;
  
  /** CLI version used */
  version: string;
  
  /** Project metadata */
  projectName: string;
  outputDirectory: string;
}

export interface PromptOption {
  name: string;
  value: string;
  description?: string;
  disabled?: boolean | string;
}

export interface ToolConfig {
  name: string;
  description: string;
  configFile: string;
  supportsAgents: boolean;
  templatePath: string;
}

export const AVAILABLE_TOOLS: Record<string, ToolConfig> = {
  claude: {
    name: 'Claude (CLAUDE.md)',
    description: 'Anthropic Claude with comprehensive instructions',
    configFile: 'CLAUDE.md',
    supportsAgents: true,
    templatePath: 'claude.md.hbs'
  },
  cursor: {
    name: 'Cursor (.cursor/rules/main.mdc)',
    description: 'Cursor editor with rules configuration',
    configFile: '.cursor/rules/main.mdc',
    supportsAgents: false,
    templatePath: 'cursor.mdc.hbs'
  },
  cline: {
    name: 'Cline',
    description: 'VS Code Cline extension',
    configFile: '.cline/instructions.md',
    supportsAgents: false,
    templatePath: 'cline.md.hbs'
  },
  'github-copilot': {
    name: 'GitHub Copilot',
    description: 'GitHub Copilot with workspace instructions',
    configFile: '.github/copilot-instructions.md',
    supportsAgents: false,
    templatePath: 'copilot.md.hbs'
  }
};

export const AVAILABLE_WORKFLOWS: PromptOption[] = [
  {
    name: 'GitHub Flow',
    value: 'github-flow',
    description: 'Simple branching with main branch and feature branches'
  },
  {
    name: 'Git Flow',
    value: 'git-flow',
    description: 'Complex branching with develop, feature, release branches'
  }
];

export const AVAILABLE_METHODOLOGIES: PromptOption[] = [
  {
    name: 'GitHub Issue-Driven Development',
    value: 'github-idd',
    description: 'Every task starts with an Issue, PRs link to Issues'
  },
  {
    name: 'Test-Driven Development (TDD)',
    value: 'tdd',
    description: 'Write tests first, then implement functionality'
  },
  {
    name: 'Scrum Framework',
    value: 'scrum',
    description: 'Sprint-based development with ceremonies'
  }
];

export const AVAILABLE_LANGUAGES: PromptOption[] = [
  {
    name: 'TypeScript',
    value: 'typescript',
    description: 'Typed JavaScript for better development experience'
  },
  {
    name: 'JavaScript',
    value: 'javascript',
    description: 'Dynamic scripting language for web development'
  },
  {
    name: 'Python',
    value: 'python',
    description: 'General-purpose programming language'
  },
  {
    name: 'Go',
    value: 'go',
    description: 'Fast, compiled language for system programming'
  },
  {
    name: 'Java',
    value: 'java',
    description: 'Enterprise-grade object-oriented language'
  },
  {
    name: 'Rust',
    value: 'rust',
    description: 'Memory-safe systems programming language'
  }
];

export class ConfigManager {
  private static readonly CONFIG_FILENAME = '.ai-instructions.json';

  /**
   * Load existing configuration from project directory
   */
  static loadConfig(projectDir: string): ProjectConfig | null {
    const configPath = join(projectDir, this.CONFIG_FILENAME);
    
    if (!existsSync(configPath)) {
      return null;
    }

    try {
      const configData = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configData) as ProjectConfig;
      return this.validateConfig(config) ? config : null;
    } catch (error) {
      console.warn(`Warning: Could not load configuration from ${configPath}:`, error);
      return null;
    }
  }

  /**
   * Save configuration to project directory
   */
  static saveConfig(projectDir: string, config: ProjectConfig): void {
    const configPath = join(projectDir, this.CONFIG_FILENAME);
    
    try {
      const configData = JSON.stringify(config, null, 2);
      writeFileSync(configPath, configData, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save configuration to ${configPath}: ${error}`);
    }
  }

  /**
   * Create new configuration with defaults
   */
  static createConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
    const baseConfig: ProjectConfig = {
      tool: 'claude',
      workflow: 'github-flow',
      methodologies: ['github-idd'],
      languages: ['typescript'],
      generatedAt: new Date().toISOString(),
      version: '0.5.0', // TODO: Read from package.json
      projectName: 'my-project',
      outputDirectory: process.cwd()
    };
    
    // Only add agents if specified in overrides
    if (overrides.agents !== undefined) {
      baseConfig.agents = overrides.agents;
    }
    
    return {
      ...baseConfig,
      ...overrides
    };
  }

  /**
   * Validate configuration object
   */
  static validateConfig(config: any): config is ProjectConfig {
    if (!config || typeof config !== 'object') {
      return false;
    }

    const requiredFields = [
      'tool', 'workflow', 'methodologies', 'languages', 
      'generatedAt', 'version', 'projectName', 'outputDirectory'
    ];

    for (const field of requiredFields) {
      if (!(field in config)) {
        console.warn(`Configuration missing required field: ${field}`);
        return false;
      }
    }

    // Validate tool
    if (!Object.keys(AVAILABLE_TOOLS).includes(config.tool)) {
      console.warn(`Invalid tool: ${config.tool}`);
      return false;
    }

    // Validate arrays
    if (!Array.isArray(config.methodologies) || !Array.isArray(config.languages)) {
      console.warn('Methodologies and languages must be arrays');
      return false;
    }

    return true;
  }

  /**
   * Check if configuration needs update (version mismatch)
   */
  static needsUpdate(config: ProjectConfig, currentVersion: string): boolean {
    return config.version !== currentVersion;
  }

  /**
   * Get available agent options by scanning templates
   */
  static getAvailableAgents(_templatesDir: string): PromptOption[] {
    // TODO: Implement agent discovery from templates/agents/
    // For now, return static list
    return [
      {
        name: 'Frontend Developer',
        value: 'frontend-specialist',
        description: 'React, TypeScript, modern frontend development'
      },
      {
        name: 'Backend Architect',
        value: 'backend-architect',
        description: 'API design, database architecture, system design'
      },
      {
        name: 'Full-Stack Engineer',
        value: 'fullstack-engineer',
        description: 'End-to-end application development'
      },
      {
        name: 'DevOps Engineer',
        value: 'devops-engineer',
        description: 'CI/CD, infrastructure, deployment automation'
      },
      {
        name: 'Code Reviewer',
        value: 'code-reviewer',
        description: 'Code quality, best practices, security review'
      }
    ];
  }
}

/**
 * Default configuration for testing and fallbacks
 */
export const DEFAULT_CONFIG: ProjectConfig = ConfigManager.createConfig();