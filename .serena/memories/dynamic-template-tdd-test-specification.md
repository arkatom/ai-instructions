# TDDテスト仕様書 - 動的テンプレート生成システム

## 📋 Red-Green-Refactor サイクル対応テスト設計

### 🎯 テスト方針
Kent Beck's TDD原則に従い、最小単位の失敗テストから開始し、段階的に機能を構築

### 📊 テストカテゴリと実行順序

#### Phase 1: 基本機能テスト (Red → Green)

##### 1.1 コアテンプレート読み込みテスト
```typescript
// test/generators/dynamic-template-core.test.ts
describe('Core Template Loading', () => {
  test('should load Japanese core template', async () => {
    const generator = GeneratorFactory.createGenerator('cursor');
    const result = await generator.loadDynamicTemplate('main.md', { lang: 'ja' });
    
    expect(result).toContain('🚨 核心原則（必須）');
    expect(result).toContain('基本ルール');
    expect(result).toContain('深層思考');
  });

  test('should load English core template', async () => {
    const generator = GeneratorFactory.createGenerator('cursor');
    const result = await generator.loadDynamicTemplate('main.md', { lang: 'en' });
    
    expect(result).toContain('🚨 Core Principles (MANDATORY)');
    expect(result).toContain('Basic Rules');
    expect(result).toContain('Deep Thinking');
  });

  test('should load Chinese core template', async () => {
    const generator = GeneratorFactory.createGenerator('cursor');
    const result = await generator.loadDynamicTemplate('main.md', { lang: 'ch' });
    
    expect(result).toContain('🚨 核心原则（必须）');
    expect(result).toContain('基本规则');
    expect(result).toContain('深度思考');
  });

  test('should default to English when language not specified', async () => {
    const generator = GeneratorFactory.createGenerator('cursor');
    const result = await generator.loadDynamicTemplate('main.md');
    
    expect(result).toContain('Core Principles (MANDATORY)');
  });
});
```

##### 1.2 設定ファイル読み込みテスト
```typescript
// test/generators/config-loading.test.ts  
describe('Configuration File Loading', () => {
  test('should load cursor tool configuration', async () => {
    const generator = GeneratorFactory.createGenerator('cursor');
    const config = await generator.loadToolConfig();
    
    expect(config.displayName).toBe('Cursor AI');
    expect(config.fileExtension).toBe('.mdc');
    expect(config.customSections).toHaveProperty('toolSpecificFeatures');
    expect(config.globs).toHaveProperty('inherit');
  });

  test('should load github-copilot tool configuration', async () => {
    const generator = GeneratorFactory.createGenerator('github-copilot');
    const config = await generator.loadToolConfig();
    
    expect(config.displayName).toBe('GitHub Copilot');
    expect(config.fileExtension).toBe('.md');
    expect(config.globs.inherit).toBe('universal');
  });

  test('should load claude tool configuration', async () => {
    const generator = GeneratorFactory.createGenerator('claude');
    const config = await generator.loadToolConfig();
    
    expect(config.displayName).toBe('Claude AI');
    expect(config.fileExtension).toBe('.md');
    expect(config.customSections.toolSpecificFeatures).toContain('Deep reasoning');
  });

  test('should load language-specific globs configuration', async () => {
    const generator = new BaseGenerator({ name: 'test', templateDir: 'test' });
    const jsConfig = await generator.loadLanguageConfig('javascript');
    
    expect(jsConfig.globs).toContain('**/*.ts');
    expect(jsConfig.globs).toContain('**/*.tsx');
    expect(jsConfig.globs).toContain('**/*.js');
    expect(jsConfig.globs).toContain('**/*.jsx');
  });
});
```

#### Phase 2: 動的置換機能テスト

##### 2.1 基本置換テスト
```typescript
// test/generators/dynamic-replacement.test.ts
describe('Dynamic Template Replacement', () => {
  test('should replace tool name placeholder', async () => {
    const generator = GeneratorFactory.createGenerator('cursor');
    const result = await generator.loadDynamicTemplate('main.md', { 
      lang: 'ja',
      projectName: 'test-project' 
    });
    
    expect(result).toContain('Cursor AI 開発指示');
    expect(result).not.toContain('{{toolName}}');
  });

  test('should replace project name placeholder', async () => {
    const generator = GeneratorFactory.createGenerator('cursor');
    const result = await generator.loadDynamicTemplate('main.md', { 
      projectName: 'my-awesome-project' 
    });
    
    expect(result).toContain('my-awesome-project');
    expect(result).not.toContain('{{projectName}}');
  });

  test('should replace custom sections from tool config', async () => {
    const generator = GeneratorFactory.createGenerator('cursor');
    const result = await generator.loadDynamicTemplate('main.md', { lang: 'ja' });
    
    expect(result).toContain('Cursor Specific Features');
    expect(result).toContain('Advanced code completion');
    expect(result).not.toContain('{{toolSpecificFeatures}}');
  });

  test('should replace dynamic globs based on language config', async () => {
    const generator = GeneratorFactory.createGenerator('cursor');
    const result = await generator.loadDynamicTemplate('main.md', { 
      lang: 'en',
      languageConfig: 'javascript'
    });
    
    expect(result).toContain('**/*.ts');
    expect(result).toContain('**/*.mdc'); // Additional from cursor config
    expect(result).not.toContain('{{dynamicGlobs}}');
  });
});
```

#### Phase 3: 全組み合わせテスト (3 tools × 3 languages = 9)

##### 3.1 完全マトリックステスト
```typescript
// test/generators/complete-matrix.test.ts
describe('Complete Tool-Language Matrix', () => {
  const tools = ['cursor', 'github-copilot', 'claude'] as const;
  const languages = ['ja', 'en', 'ch'] as const;

  test.each(tools)('should generate template for %s in all languages', async (tool) => {
    for (const lang of languages) {
      const generator = GeneratorFactory.createGenerator(tool);
      const result = await generator.loadDynamicTemplate('main.md', { 
        lang, 
        projectName: 'test-project' 
      });
      
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(500);
      expect(result).toContain('test-project');
      
      // Language-specific content verification
      switch (lang) {
        case 'ja':
          expect(result).toContain('核心原則');
          break;
        case 'en':
          expect(result).toContain('Core Principles');
          break;
        case 'ch':
          expect(result).toContain('核心原则');
          break;
      }
    }
  });

  test.each(languages)('should generate template for all tools in %s', async (lang) => {
    for (const tool of tools) {
      const generator = GeneratorFactory.createGenerator(tool);
      const result = await generator.loadDynamicTemplate('main.md', { 
        lang, 
        projectName: 'test-project' 
      });
      
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(500);
      
      // Tool-specific verification
      switch (tool) {
        case 'cursor':
          expect(result).toContain('Cursor');
          if (lang === 'en') expect(result).toContain('.mdc');
          break;
        case 'github-copilot':
          expect(result).toContain('GitHub Copilot');
          break;
        case 'claude':
          expect(result).toContain('Claude');
          break;
      }
    }
  });
});
```

#### Phase 4: エラーハンドリングテスト

##### 4.1 ファイル不足エラーテスト
```typescript
// test/generators/error-handling.test.ts
describe('Error Handling', () => {
  test('should throw error when core template file missing', async () => {
    const generator = GeneratorFactory.createGenerator('cursor');
    
    await expect(generator.loadDynamicTemplate('nonexistent.md'))
      .rejects
      .toThrow('Core template nonexistent.md not found');
  });

  test('should throw error when tool config file missing', async () => {
    const generator = new BaseGenerator({ 
      name: 'nonexistent-tool', 
      templateDir: 'nonexistent' 
    });
    
    await expect(generator.loadDynamicTemplate('main.md'))
      .rejects
      .toThrow('Tool configuration not found');
  });

  test('should handle malformed JSON in config files', async () => {
    // This test would require temporary malformed config file setup
    const generator = GeneratorFactory.createGenerator('cursor');
    
    // Mock broken config loading
    jest.spyOn(generator, 'loadToolConfig').mockRejectedValue(new Error('Invalid JSON'));
    
    await expect(generator.loadDynamicTemplate('main.md'))
      .rejects
      .toThrow('Failed to parse tool configuration');
  });
});
```

#### Phase 5: パフォーマンステスト

##### 5.1 キャッシュ機能テスト
```typescript
// test/generators/performance.test.ts
describe('Performance Optimization', () => {
  test('should cache configuration files after first load', async () => {
    const generator = GeneratorFactory.createGenerator('cursor');
    
    const startTime = Date.now();
    await generator.loadDynamicTemplate('main.md', { lang: 'ja' });
    const firstLoadTime = Date.now() - startTime;
    
    const startTime2 = Date.now();
    await generator.loadDynamicTemplate('main.md', { lang: 'ja' });
    const secondLoadTime = Date.now() - startTime2;
    
    expect(secondLoadTime).toBeLessThan(firstLoadTime * 0.5); // 50% faster due to cache
  });

  test('should handle concurrent template loading efficiently', async () => {
    const generator = GeneratorFactory.createGenerator('cursor');
    const promises = [];
    
    for (let i = 0; i < 10; i++) {
      promises.push(generator.loadDynamicTemplate('main.md', { 
        lang: i % 2 === 0 ? 'ja' : 'en' 
      }));
    }
    
    const results = await Promise.all(promises);
    expect(results).toHaveLength(10);
    results.forEach(result => expect(result).toBeTruthy());
  });
});
```

#### Phase 6: 統合テスト

##### 6.1 既存システムとの互換性テスト
```typescript
// test/generators/integration.test.ts
describe('Integration with Existing System', () => {
  test('should maintain backward compatibility with existing generators', async () => {
    const cursorGenerator = GeneratorFactory.createGenerator('cursor');
    
    // Test old method still works
    const oldResult = await cursorGenerator.loadTemplate('main.mdc', { lang: 'ja' });
    expect(oldResult).toBeTruthy();
    
    // Test new method produces similar but enhanced output
    const newResult = await cursorGenerator.loadDynamicTemplate('main.md', { lang: 'ja' });
    expect(newResult).toBeTruthy();
    expect(newResult).toContain('基本ルール'); // Same core content
  });

  test('should work with existing generateFiles method', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dynamic-template-test-'));
    
    try {
      const generator = GeneratorFactory.createGenerator('cursor');
      await generator.generateFiles(tempDir, { 
        projectName: 'test-project',
        lang: 'ja',
        useDynamicTemplates: true // New option
      });
      
      const generatedFile = path.join(tempDir, '.cursor', 'rules', 'main.mdc');
      expect(await fs.pathExists(generatedFile)).toBeTruthy();
      
      const content = await fs.readFile(generatedFile, 'utf-8');
      expect(content).toContain('Cursor AI 開発指示');
      expect(content).toContain('test-project');
    } finally {
      await fs.remove(tempDir);
    }
  });
});
```

### 🔄 実行順序とTDDサイクル

#### Cycle 1: Core Template Loading (Red → Green → Refactor)
1. Red: `test/generators/dynamic-template-core.test.ts` 作成 → 失敗確認
2. Green: `loadDynamicTemplate()` 最小実装 → テスト通過
3. Refactor: エラーハンドリング改善、コード整理

#### Cycle 2: Configuration Loading (Red → Green → Refactor)  
1. Red: `test/generators/config-loading.test.ts` 作成 → 失敗確認
2. Green: `loadToolConfig()`, `loadLanguageConfig()` 実装 → テスト通過
3. Refactor: 設定ファイル検証機能追加

#### Cycle 3: Dynamic Replacement (Red → Green → Refactor)
1. Red: `test/generators/dynamic-replacement.test.ts` 作成 → 失敗確認
2. Green: `applyDynamicReplacements()` 実装 → テスト通過  
3. Refactor: 置換ロジック最適化

#### Cycle 4: Complete Matrix (Red → Green → Refactor)
1. Red: `test/generators/complete-matrix.test.ts` 作成 → 失敗確認
2. Green: 全9組み合わせ対応 → テスト通過
3. Refactor: パフォーマンス最適化

#### Cycle 5: Error Handling & Performance (Red → Green → Refactor)
1. Red: エラーハンドリング・パフォーマンステスト作成 → 失敗確認
2. Green: エラー処理・キャッシュ機能実装 → テスト通過
3. Refactor: 全体的なコード品質向上

### 📊 テスト成功基準
- [ ] 全9組み合わせ (3 tools × 3 languages) が正常動作
- [ ] 既存機能の後方互換性100%維持  
- [ ] テストカバレッジ90%以上
- [ ] パフォーマンス: 2回目以降50%高速化 (キャッシュ効果)
- [ ] エラーハンドリング: 想定エラーケース100%カバー
- [ ] コード重複率: 0% (完全DRY原則遵守)

### 🛡️ テスト環境セットアップ
```typescript
// test/setup/test-files.ts
export const setupTestFiles = async () => {
  // Create temporary test template and config files
  await createCoreTemplateFiles();
  await createToolConfigFiles();  
  await createLanguageConfigFiles();
};

export const cleanupTestFiles = async () => {
  // Clean up temporary test files
};
```

この仕様に従って、段階的にTDDサイクルを実行し、堅牢で保守性の高い動的テンプレート生成システムを構築します。