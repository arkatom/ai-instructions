import { PreviewHandler } from '../../src/cli/services/PreviewHandler';
import { Logger } from '../../src/utils/logger';

// Mock Logger
jest.mock('../../src/utils/logger');
const mockLogger = Logger as jest.Mocked<typeof Logger>;

describe('PreviewHandler', () => {
  let handler: PreviewHandler;

  beforeEach(() => {
    handler = new PreviewHandler();
    jest.clearAllMocks();
  });

  describe('RED Phase: handlePreviewMode', () => {
    it('should return success result for preview mode', async () => {
      // Arrange
      const options = {
        output: '/test/directory',
        tool: 'claude',
        projectName: 'test-project',
        lang: 'ja'
      };

      // Act
      const result = await handler.handlePreviewMode(options);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should log preview mode information', async () => {
      // Arrange
      const options = {
        output: '/test/directory',
        tool: 'claude',
        projectName: 'test-project',
        lang: 'ja'
      };

      // Act
      await handler.handlePreviewMode(options);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Preview mode: Analyzing potential file conflicts')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Preview functionality will be enhanced in v0.3.0'
      );
      expect(mockLogger.item).toHaveBeenCalledWith('📦 Project name:', 'test-project');
      expect(mockLogger.item).toHaveBeenCalledWith('📍 Target directory:', '/test/directory');
    });

    it('should display all option details in logs', async () => {
      // Arrange
      const options = {
        output: '/custom/output',
        tool: 'cursor',
        projectName: 'custom-project',
        lang: 'en'
      };

      // Act
      await handler.handlePreviewMode(options);

      // Assert
      expect(mockLogger.item).toHaveBeenCalledWith('📍 Target directory:', '/custom/output');
      expect(mockLogger.item).toHaveBeenCalledWith('🤖 Tool:', 'cursor');
      expect(mockLogger.item).toHaveBeenCalledWith('📦 Project name:', 'custom-project');
      expect(mockLogger.item).toHaveBeenCalledWith('🌍 Language:', 'en');
    });

    it('should show enhancement notice', async () => {
      // Arrange
      const options = {
        output: '/test',
        tool: 'claude',
        projectName: 'test',
        lang: 'ja'
      };

      // Act
      await handler.handlePreviewMode(options);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'For now, manually check if CLAUDE.md and instructions/ exist in target directory'
      );
    });
  });
});