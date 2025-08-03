import { execSync } from 'child_process';
import { join } from 'path';

describe('CLI Basic Functionality', () => {
  const cliPath = join(__dirname, '../src/cli.ts');

  it('should display version when --version flag is used', () => {
    // Arrange
    const expectedVersion = '0.1.0';
    
    // Act
    const result = execSync(`npx ts-node "${cliPath}" --version`, { 
      encoding: 'utf-8',
      cwd: join(__dirname, '..')
    });
    
    // Assert
    expect(result.trim()).toBe(expectedVersion);
  });

  it('should display help when --help flag is used', () => {
    // Arrange
    const expectedContent = 'CLI tool to scaffold AI development instructions';
    
    // Act
    const result = execSync(`npx ts-node "${cliPath}" --help`, { 
      encoding: 'utf-8',
      cwd: join(__dirname, '..')
    });
    
    // Assert
    expect(result).toContain(expectedContent);
    expect(result).toContain('Commands:');
    expect(result).toContain('init');
  });

  it('should execute init command with placeholder message', () => {
    // Arrange
    const expectedMessage = '🚧 This functionality will be implemented in Issue #3';
    
    // Act
    const result = execSync(`npx ts-node "${cliPath}" init`, { 
      encoding: 'utf-8',
      cwd: join(__dirname, '..')
    });
    
    // Assert
    expect(result.trim()).toBe(expectedMessage);
  });
});