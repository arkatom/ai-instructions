/**
 * Command arguments interface
 * Issue #50: Single Responsibility Principle - Extracted from CLI monolith
 */
export interface CommandArgs {
  command: string;
  [key: string]: unknown;
}

export interface InitCommandArgs extends CommandArgs {
  output?: string;
  projectName?: string;
  tool?: string;
  lang?: string;
  outputFormat?: string;
  force?: boolean;
  preview?: boolean;
  conflictResolution?: string;
  interactive?: boolean;
  backup?: boolean;
}

/**
 * Commander.js options interface - without 'command' property
 * Used for CLI action callbacks
 */
/**
 * Agent command arguments interface
 * Issue #93: Agent deployment CLI commands implementation
 */
export interface AgentCommandArgs extends CommandArgs {
  subcommand: 'list' | 'recommend' | 'deploy' | 'info' | 'profile';
  category?: string;
  agents?: string[];
  format?: 'table' | 'json' | 'tree';
  output?: string;
  name?: string;
  action?: string;
}

/**
 * Commander.js options interface for agent commands
 */
export interface CommanderAgentOptions {
  category?: string;
  format?: 'table' | 'json' | 'tree';
  output?: string;
}

/**
 * Commander.js options interface - without 'command' property
 * Used for CLI action callbacks
 */
export interface CommanderInitOptions {
  output?: string;
  projectName?: string;
  tool?: string;
  lang?: string;
  outputFormat?: string;
  force?: boolean;
  preview?: boolean;
  conflictResolution?: string;
  interactive?: boolean;
  backup?: boolean;
}