import { FileGenerationOrchestrator } from '../../src/cli/services/FileGenerationOrchestrator';
import { GeneratorFactory } from '../../src/generators/factory';
import { BaseGenerator } from '../../src/generators/base';
import { Logger } from '../../src/utils/logger';
import { OutputFormat } from '../../src/converters';

// Mock dependencies
jest.mock('../../src/generators/factory');
jest.mock('../../src/utils/logger');

const mockGeneratorFactory = GeneratorFactory as jest.Mocked<typeof GeneratorFactory>;
const mockLogger = Logger as jest.Mocked<typeof Logger>;

describe('FileGenerationOrchestrator', () => {
  let orchestrator: FileGenerationOrchestrator;

  beforeEach(() => {
    orchestrator = new FileGenerationOrchestrator();
    jest.clearAllMocks();
    
    // Mock GeneratorFactory methods
    mockGeneratorFactory.isValidTool.mockReturnValue(true);
    mockGeneratorFactory.getSupportedTools.mockReturnValue(['claude', 'cursor', 'github-copilot', 'cline', 'windsurf']);
  });

  describe('RED Phase: generateFiles', () => {
    it('should successfully orchestrate file generation', async () => {
      // Arrange
      const mockGenerator = {
        generateFiles: jest.fn().mockResolvedValue(undefined),
        getToolName: jest.fn().mockReturnValue('Claude')
      };
      
      mockGeneratorFactory.createGenerator.mockReturnValue(mockGenerator as unknown as BaseGenerator);

      const options = {
        tool: 'claude',
        outputDir: '/test/directory',
        projectName: 'test-project',
        force: false,
        lang: 'ja' as const,
        outputFormat: OutputFormat.CLAUDE,
        conflictResolution: 'backup',
        interactive: true,
        backup: true
      };

      // Act
      const result = await orchestrator.generateFiles(options);

      // Assert
      expect(result.success).toBe(true);
      expect(mockGeneratorFactory.createGenerator).toHaveBeenCalledWith('claude');
      expect(mockGenerator.generateFiles).toHaveBeenCalledWith('/test/directory', {
        projectName: 'test-project',
        force: false,
        lang: 'ja',
        outputFormat: 'claude',
        conflictResolution: 'backup',
        interactive: true,
        backup: true
      });
    });

    it('should log success messages after generation', async () => {
      // Arrange
      const mockGenerator = {
        generateFiles: jest.fn().mockResolvedValue(undefined),
        getToolName: jest.fn().mockReturnValue('Cursor')
      };
      
      mockGeneratorFactory.createGenerator.mockReturnValue(mockGenerator as unknown as BaseGenerator);

      const options = {
        tool: 'cursor',
        outputDir: '/test/output',
        projectName: 'my-app',
        force: false,
        lang: 'en' as const,
        outputFormat: OutputFormat.CURSOR,
        conflictResolution: 'backup',
        interactive: true,
        backup: true
      };

      // Act
      await orchestrator.generateFiles(options);

      // Assert
      expect(mockLogger.success).toHaveBeenCalledWith(
        'Generated Cursor template files in /test/output'
      );
      expect(mockLogger.info).toHaveBeenCalledWith('📁 Files created for Cursor AI tool');
      expect(mockLogger.item).toHaveBeenCalledWith('🎯 Project name:', 'my-app');
    });

    it('should show format conversion message when different output format used', async () => {
      // Arrange
      const mockGenerator = {
        generateFiles: jest.fn().mockResolvedValue(undefined),
        getToolName: jest.fn().mockReturnValue('Claude')
      };
      
      mockGeneratorFactory.createGenerator.mockReturnValue(mockGenerator as unknown as BaseGenerator);

      const options = {
        tool: 'claude',
        outputDir: '/test',
        projectName: 'test',
        force: false,
        lang: 'ja' as const,
        outputFormat: OutputFormat.CURSOR,
        conflictResolution: 'backup',
        interactive: true,
        backup: true
      };

      // Act
      await orchestrator.generateFiles(options);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith('🔄 Converted from Claude format to cursor');
    });

    it('should show safety tips when not in force mode', async () => {
      // Arrange
      const mockGenerator = {
        generateFiles: jest.fn().mockResolvedValue(undefined),
        getToolName: jest.fn().mockReturnValue('Claude')
      };
      
      mockGeneratorFactory.createGenerator.mockReturnValue(mockGenerator as unknown as BaseGenerator);

      const options = {
        tool: 'claude',
        outputDir: '/test',
        projectName: 'test',
        force: false,
        lang: 'ja' as const,
        outputFormat: OutputFormat.CLAUDE,
        conflictResolution: 'backup',
        interactive: true,
        backup: true
      };

      // Act
      await orchestrator.generateFiles(options);

      // Assert
      expect(mockLogger.tip).toHaveBeenCalledWith('Use --preview to check for conflicts before generating');
      expect(mockLogger.tip).toHaveBeenCalledWith('Use --force to skip warnings (be careful!)');
      expect(mockLogger.tip).toHaveBeenCalledWith('Run "ai-instructions init" without options for interactive setup');
    });

    it('should not show safety tips when in force mode', async () => {
      // Arrange
      const mockGenerator = {
        generateFiles: jest.fn().mockResolvedValue(undefined),
        getToolName: jest.fn().mockReturnValue('Claude')
      };
      
      mockGeneratorFactory.createGenerator.mockReturnValue(mockGenerator as unknown as BaseGenerator);

      const options = {
        tool: 'claude',
        outputDir: '/test',
        projectName: 'test',
        force: true,
        lang: 'ja' as const,
        outputFormat: OutputFormat.CLAUDE,
        conflictResolution: 'backup',
        interactive: true,
        backup: true
      };

      // Act
      await orchestrator.generateFiles(options);

      // Assert - tip should not be called when force is true
      expect(mockLogger.tip).not.toHaveBeenCalled();
    });

    it('should handle generation errors gracefully', async () => {
      // Arrange
      const mockGenerator = {
        generateFiles: jest.fn().mockRejectedValue(new Error('Generation failed')),
        getToolName: jest.fn().mockReturnValue('Claude')
      };
      
      mockGeneratorFactory.createGenerator.mockReturnValue(mockGenerator as unknown as BaseGenerator);

      const options = {
        tool: 'claude',
        outputDir: '/test',
        projectName: 'test',
        force: false,
        lang: 'ja' as const,
        outputFormat: OutputFormat.CLAUDE,
        conflictResolution: 'backup',
        interactive: true,
        backup: true
      };

      // Act
      const result = await orchestrator.generateFiles(options);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to generate template files');
    });
  });
});