/**
 * TDD GREEN PHASE: Validator Classes Tests
 * Issue #50: Extract validation logic from CLI monolith
 */

describe('CLI Validators', () => {
  describe('ProjectNameValidator', () => {
    it('should reject empty project names', async () => {
      // GREEN: ProjectNameValidator クラスが実装されている
      const { ProjectNameValidator } = await import('../../src/cli/validators/ProjectNameValidator');
      const validator = new ProjectNameValidator();
      const result = validator.validate('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Project name cannot be empty');
    });

    it('should reject project names with forbidden characters', async () => {
      // GREEN: ProjectNameValidator クラスが実装されている
      const { ProjectNameValidator } = await import('../../src/cli/validators/ProjectNameValidator');
      const validator = new ProjectNameValidator();
      const result = validator.validate('invalid<>project|name');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Project name contains forbidden characters (<, >, |)');
    });

    it('should accept valid project names', async () => {
      // GREEN: ProjectNameValidator クラスが実装されている
      const { ProjectNameValidator } = await import('../../src/cli/validators/ProjectNameValidator');
      const validator = new ProjectNameValidator();
      const result = validator.validate('valid-project-name');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle Unicode project names correctly', async () => {
      // GREEN: Unicode 文字のプロジェクト名をテスト
      const { ProjectNameValidator } = await import('../../src/cli/validators/ProjectNameValidator');
      const validator = new ProjectNameValidator();
      const result = validator.validate('プロジェクト名テスト');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('LanguageValidator', () => {
    it('should reject unsupported languages', async () => {
      // GREEN: LanguageValidator クラスが実装されている
      const { LanguageValidator } = await import('../../src/cli/validators/LanguageValidator');
      const validator = new LanguageValidator();
      const result = validator.validate('fr');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/Unsupported language: fr/);
    });

    it('should accept supported languages', async () => {
      // GREEN: LanguageValidator クラスが実装されている
      const { LanguageValidator } = await import('../../src/cli/validators/LanguageValidator');
      const validator = new LanguageValidator();
      
      const supportedLanguages = ['en', 'ja', 'ch'];
      for (const lang of supportedLanguages) {
        const result = validator.validate(lang);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should be case sensitive for language codes', async () => {
      // GREEN: 大文字小文字の区別をテスト
      const { LanguageValidator } = await import('../../src/cli/validators/LanguageValidator');
      const validator = new LanguageValidator();
      const result = validator.validate('EN');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/Unsupported language: EN/);
    });
  });

  describe('OutputFormatValidator', () => {
    it('should reject unsupported output formats', async () => {
      // GREEN: OutputFormatValidator クラスが実装されている
      const { OutputFormatValidator } = await import('../../src/cli/validators/OutputFormatValidator');
      const validator = new OutputFormatValidator();
      const result = validator.validate('unsupported-format');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/Unsupported output format: unsupported-format/);
    });

    it('should accept supported output formats', async () => {
      // GREEN: OutputFormatValidator クラスが実装されている
      const { OutputFormatValidator } = await import('../../src/cli/validators/OutputFormatValidator');
      const validator = new OutputFormatValidator();
      
      const supportedFormats = ['claude', 'cursor', 'copilot', 'windsurf'];
      for (const format of supportedFormats) {
        const result = validator.validate(format);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should be case sensitive for format names', async () => {
      // GREEN: 大文字小文字の区別をテスト
      const { OutputFormatValidator } = await import('../../src/cli/validators/OutputFormatValidator');
      const validator = new OutputFormatValidator();
      const result = validator.validate('CLAUDE');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/Unsupported output format: CLAUDE/);
    });
  });

  describe('OutputPathValidator', () => {
    it('should reject empty paths', async () => {
      // GREEN: OutputPathValidator クラスが実装されている
      const { OutputPathValidator } = await import('../../src/cli/validators/OutputPathValidator');
      const validator = new OutputPathValidator();
      const result = validator.validate('');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/Path contains invalid characters or is empty|Output directory cannot be empty/);
    });

    it('should accept valid directory paths', async () => {
      // GREEN: OutputPathValidator クラスが実装されている
      const { OutputPathValidator } = await import('../../src/cli/validators/OutputPathValidator');
      const validator = new OutputPathValidator();
      
      const validPaths = ['/valid/path', '.', '../parent', '/usr/local/bin'];
      for (const path of validPaths) {
        const result = validator.validate(path);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });
  });

  describe('ConflictResolutionValidator', () => {
    it('should reject unsupported conflict resolution strategies', async () => {
      // GREEN: ConflictResolutionValidator クラスが実装されている
      const { ConflictResolutionValidator } = await import('../../src/cli/validators/ConflictResolutionValidator');
      const validator = new ConflictResolutionValidator();
      const result = validator.validate('invalid-strategy');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/Unsupported conflict resolution strategy: invalid-strategy/);
    });

    it('should accept supported conflict resolution strategies', async () => {
      // GREEN: ConflictResolutionValidator クラスが実装されている
      const { ConflictResolutionValidator } = await import('../../src/cli/validators/ConflictResolutionValidator');
      const validator = new ConflictResolutionValidator();
      
      const supportedStrategies = ['backup', 'merge', 'skip', 'overwrite'];
      for (const strategy of supportedStrategies) {
        const result = validator.validate(strategy);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });
  });
});