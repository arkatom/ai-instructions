import { InteractiveUtils } from '../../init/interactive';
import { InitCommandArgs } from '../interfaces/CommandArgs';

/**
 * Service responsible for determining whether to use interactive mode
 * Single Responsibility: Interactive mode detection logic
 */
export class InteractiveModeDetector {
  
  /**
   * Determine if interactive mode should be used
   */
  shouldUseInteractiveMode(args: InitCommandArgs): boolean {
    // Check for raw args if available (for CLI integration)
    const rawArgs = process.argv.slice(2);
    
    // If any specific options are provided, use non-interactive mode
    const nonInteractiveOptions = [
      '--project-name', '-n',
      '--tool', '-t', 
      '--lang', '-l',
      '--output-format', '-f',
      '--force',
      '--preview',
      '--conflict-resolution', '-r',
      '--no-interactive',
      '--no-backup'
    ];

    const hasNonInteractiveOptions = rawArgs.some(arg => 
      nonInteractiveOptions.includes(arg) || arg.startsWith('--project-name=')
    );

    // Explicitly disabled
    if (args.interactive === false) {
      return false;
    }

    // Non-interactive environment or specific options provided
    if (!InteractiveUtils.canRunInteractive() || hasNonInteractiveOptions) {
      return false;
    }

    // Default to interactive if available
    return true;
  }
}