/**
 * Command interface for CLI command pattern
 * Issue #50: Single Responsibility Principle - Extracted from CLI monolith
 */
import { CommandArgs } from './CommandArgs';
import { CommandResult } from './CommandResult';
import { ValidationResult } from './ValidationResult';

export interface Command {
  /**
   * Execute the command with given arguments
   */
  execute(args: CommandArgs): Promise<CommandResult>;
  
  /**
   * Validate command arguments
   */
  validate(args: CommandArgs): ValidationResult;
}