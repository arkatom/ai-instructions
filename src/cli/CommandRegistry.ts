/**
 * Command registry for managing CLI commands
 * Issue #50: Single Responsibility Principle - Extracted from CLI monolith
 */
import { Command } from './interfaces/Command';

export class CommandRegistry {
  private commands: Map<string, Command> = new Map();

  /**
   * Register a command with a given name
   */
  register(name: string, command: Command): void {
    this.commands.set(name, command);
  }

  /**
   * Get a command by name
   */
  get(name: string): Command | undefined {
    return this.commands.get(name);
  }

  /**
   * Check if a command is registered
   */
  has(name: string): boolean {
    return this.commands.has(name);
  }

  /**
   * Get all registered command names
   */
  getCommands(): string[] {
    return Array.from(this.commands.keys());
  }
}