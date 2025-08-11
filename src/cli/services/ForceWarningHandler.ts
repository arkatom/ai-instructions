import { Logger } from '../../utils/logger';

/**
 * Lazy load chalk for optional colored output
 */
async function loadChalk(): Promise<any> {
  try {
    const chalkModule = await import('chalk');
    return chalkModule.default || chalkModule;
  } catch {
    // Chalk not available, use plain text fallback
    return {
      red: (text: string) => text
    };
  }
}

/**
 * Service responsible for handling force mode warnings
 * Single Responsibility: Force warning display and timing logic
 */
export class ForceWarningHandler {
  
  /**
   * Show force mode warning with delay
   */
  async showForceWarning(): Promise<void> {
    const chalk = await loadChalk();
    Logger.raw(chalk.red('🚨 FORCE MODE ENABLED: Files will be overwritten without warnings!'));
    Logger.raw(chalk.red('💣 Proceeding in 2 seconds...'));
    
    // Brief delay to let user see the warning
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}