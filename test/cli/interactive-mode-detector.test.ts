import { InteractiveModeDetector } from '../../src/cli/services/InteractiveModeDetector';
import { InitCommandArgs } from '../../src/cli/interfaces/CommandArgs';

// Mock InteractiveUtils
jest.mock('../../src/init/interactive', () => ({
  InteractiveUtils: {
    canRunInteractive: jest.fn()
  }
}));

import { InteractiveUtils } from '../../src/init/interactive';
const mockInteractiveUtils = InteractiveUtils as jest.Mocked<typeof InteractiveUtils>;

describe('InteractiveModeDetector', () => {
  let detector: InteractiveModeDetector;
  const originalArgv = process.argv;

  beforeEach(() => {
    detector = new InteractiveModeDetector();
    jest.clearAllMocks();
    // Reset process.argv to known state
    process.argv = ['node', 'script', 'init'];
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  describe('RED Phase: shouldUseInteractiveMode', () => {
    it('should return false when interactive is explicitly disabled', () => {
      // Arrange
      const args: InitCommandArgs = { command: 'init', interactive: false };
      
      // Act  
      const result = detector.shouldUseInteractiveMode(args);
      
      // Assert
      expect(result).toBe(false);
    });

    it('should return false when interactive environment is not available', () => {
      // Arrange
      const args: InitCommandArgs = { command: 'init' };
      mockInteractiveUtils.canRunInteractive.mockReturnValue(false);
      
      // Act
      const result = detector.shouldUseInteractiveMode(args);
      
      // Assert
      expect(result).toBe(false);
    });

    it('should return false when non-interactive options are provided', () => {
      // Arrange
      const args: InitCommandArgs = { command: 'init' };
      mockInteractiveUtils.canRunInteractive.mockReturnValue(true);
      process.argv = ['node', 'script', 'init', '--project-name', 'test'];
      
      // Act
      const result = detector.shouldUseInteractiveMode(args);
      
      // Assert
      expect(result).toBe(false);
    });

    it('should return true when interactive is available and no conflicting options', () => {
      // Arrange
      const args: InitCommandArgs = { command: 'init' };
      mockInteractiveUtils.canRunInteractive.mockReturnValue(true);
      process.argv = ['node', 'script', 'init'];
      
      // Act
      const result = detector.shouldUseInteractiveMode(args);
      
      // Assert
      expect(result).toBe(true);
    });

    it('should detect various non-interactive options correctly', () => {
      // Arrange
      const testCases = [
        ['--tool', 'claude'],
        ['--lang', 'ja'], 
        ['--output-format', 'cursor'],
        ['--force'],
        ['--preview'],
        ['--no-interactive'],
        ['--project-name=test']
      ];
      
      mockInteractiveUtils.canRunInteractive.mockReturnValue(true);

      testCases.forEach(([...argv]) => {
        // Arrange for each test case
        const args: InitCommandArgs = { command: 'init' };
        process.argv = ['node', 'script', 'init', ...argv];
        
        // Act
        const result = detector.shouldUseInteractiveMode(args);
        
        // Assert
        expect(result).toBe(false);
      });
    });
  });
});