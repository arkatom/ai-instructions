import { Logger, LogLevel } from '../../src/utils/logger';

describe('Logger', () => {
  // Save original console methods using globalThis to avoid ESLint warnings
  const originalConsoleLog = globalThis.console.log;
  const originalConsoleError = globalThis.console.error;
  const originalConsoleWarn = globalThis.console.warn;
  
  // Create mock functions
  let mockConsoleLog: jest.Mock;
  let mockConsoleError: jest.Mock;
  let mockConsoleWarn: jest.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    mockConsoleLog = jest.fn();
    mockConsoleError = jest.fn();
    mockConsoleWarn = jest.fn();
    
    // Replace console methods with mocks using globalThis
    globalThis.console.log = mockConsoleLog;
    globalThis.console.error = mockConsoleError;
    globalThis.console.warn = mockConsoleWarn;
    
    // Reset log level to default
    Logger.setLogLevel(LogLevel.INFO);
  });

  afterEach(() => {
    // Restore original console methods using globalThis
    globalThis.console.log = originalConsoleLog;
    globalThis.console.error = originalConsoleError;
    globalThis.console.warn = originalConsoleWarn;
  });

  describe('Log Level Management', () => {
    it('should respect log level for info messages', () => {
      Logger.setLogLevel(LogLevel.ERROR);
      Logger.info('Test info message');
      expect(mockConsoleLog).not.toHaveBeenCalled();
      
      Logger.setLogLevel(LogLevel.INFO);
      Logger.info('Test info message');
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
    });

    it('should respect log level for debug messages', () => {
      Logger.setLogLevel(LogLevel.INFO);
      Logger.debug('Test debug message');
      expect(mockConsoleLog).not.toHaveBeenCalled();
      
      Logger.setLogLevel(LogLevel.DEBUG);
      Logger.debug('Test debug message');
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
    });

    it('should always show error messages regardless of log level', () => {
      Logger.setLogLevel(LogLevel.ERROR);
      Logger.error('Test error message');
      expect(mockConsoleError).toHaveBeenCalledTimes(1);
    });
  });

  describe('Message Sanitization', () => {
    it('should sanitize user home paths on Unix systems', () => {
      Logger.info('/Users/johndoe/projects/secret-project');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('/Users/[USER]/projects/secret-project')
      );
    });

    it('should sanitize user home paths on Linux systems', () => {
      Logger.info('/home/johndoe/projects/secret-project');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('/home/[USER]/projects/secret-project')
      );
    });

    it('should sanitize user home paths on Windows systems', () => {
      Logger.info('C:\\Users\\johndoe\\projects\\secret-project');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('C:\\Users\\[USER]\\projects\\secret-project')
      );
    });

    it('should mask tokens and secrets', () => {
      Logger.info('token=abc123def456ghi789');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[REDACTED]')
      );
    });

    it('should mask email addresses but keep domain', () => {
      Logger.info('Contact user@example.com for details');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[EMAIL]@example.com')
      );
    });

    it('should mask IP addresses', () => {
      Logger.info('Server at 192.168.1.100');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('XXX.XXX.XXX.[IP]')
      );
    });

    it('should mask long alphanumeric strings (potential hashes)', () => {
      Logger.info('Hash: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[HASH]')
      );
    });

    it('should mask system paths', () => {
      Logger.info('Config at /etc/nginx/nginx.conf');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[SYSTEM_PATH]')
      );
    });
  });

  describe('Message Types', () => {
    it('should format error messages with red color and error icon', () => {
      Logger.error('Test error');
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('❌')
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Test error')
      );
    });

    it('should format warning messages with yellow color and warning icon', () => {
      Logger.warn('Test warning');
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('⚠️')
      );
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Test warning')
      );
    });

    it('should format success messages with green color and check icon', () => {
      Logger.success('Test success');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Test success')
      );
    });

    it('should format debug messages with gray color and magnifier icon', () => {
      Logger.setLogLevel(LogLevel.DEBUG);
      Logger.debug('Test debug');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('🔍')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Test debug')
      );
    });

    it('should format tip messages with cyan color and bulb icon', () => {
      Logger.tip('Test tip');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('💡')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Test tip')
      );
    });

    it('should format section headers properly', () => {
      Logger.section('Test Section');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Test Section')
      );
    });

    it('should format list items properly', () => {
      Logger.item('Key:', 'Value');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Key:.*Value/)
      );
    });

    it('should output raw messages without formatting', () => {
      Logger.raw('Raw message');
      expect(mockConsoleLog).toHaveBeenCalledWith('Raw message');
    });
  });

  describe('Error Handling', () => {
    it('should handle Error objects with message and stack', () => {
      const testError = new Error('Test error message');
      Logger.error('An error occurred', testError);
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('❌')
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Test error message')
      );
    });

    it('should show stack trace in debug mode', () => {
      Logger.setLogLevel(LogLevel.DEBUG);
      const testError = new Error('Test error with stack');
      Logger.error('An error occurred', testError);
      
      // Stack trace should be shown in debug mode
      expect(mockConsoleError.mock.calls.length).toBeGreaterThan(2);
    });

    it('should handle non-Error objects in error parameter', () => {
      Logger.error('An error occurred', 'String error');
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('String error')
      );
    });

    it('should handle undefined error parameter', () => {
      Logger.error('An error occurred');
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('❌')
      );
      expect(mockConsoleError).toHaveBeenCalledTimes(1);
    });
  });

  describe('Security', () => {
    it('should not expose sensitive information in logs', () => {
      const sensitiveData = {
        password: 'super-secret-password-123',
        apiKey: 'sk-1234567890abcdef',
        userPath: '/Users/johndoe/private',
        email: 'john.doe@company.com'
      };
      
      Logger.info(`User ${sensitiveData.email} with key ${sensitiveData.apiKey} at ${sensitiveData.userPath}`);
      
      const logCall = mockConsoleLog.mock.calls[0][0];
      expect(logCall).not.toContain('super-secret');
      expect(logCall).not.toContain('sk-1234567890abcdef');
      expect(logCall).not.toContain('johndoe');
      expect(logCall).not.toContain('john.doe');
      expect(logCall).toContain('[EMAIL]@company.com');
      expect(logCall).toContain('/Users/[USER]');
    });
  });
});