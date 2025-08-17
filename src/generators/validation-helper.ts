/**
 * Validation helper for configuration objects
 * Consolidates validation logic from base.ts for better maintainability
 * MINOR Issue: 型検証ロジックの共通化
 */

import { type StrictToolConfiguration, type StrictLanguageConfiguration } from './types';

/**
 * Field validator configuration
 */
interface FieldValidator {
  readonly field: string;
  readonly type: string;
  readonly message: string;
  readonly optional?: boolean;
}

/**
 * Centralized validation helper for configurations
 * Eliminates code duplication and improves maintainability
 */
export class ValidationHelper {
  /**
   * Tool configuration required field validators
   */
  private static readonly TOOL_CONFIG_VALIDATORS: ReadonlyArray<FieldValidator> = [
    { field: 'displayName', type: 'string', message: 'displayName must be a string' },
    { field: 'fileExtension', type: 'string', message: 'fileExtension must be a string' },
    { field: 'description', type: 'string', message: 'description must be a string' }
  ];

  /**
   * Language configuration required field validators
   */
  private static readonly LANGUAGE_CONFIG_VALIDATORS: ReadonlyArray<FieldValidator> = [
    { field: 'description', type: 'string', message: 'description must be a string' }
  ];

  /**
   * Validate tool configuration
   */
  static validateToolConfiguration(config: unknown): string[] {
    const errors: string[] = [];
    
    // Validate basic object structure
    if (!config || typeof config !== 'object') {
      return ['Configuration must be an object'];
    }
    
    // Validate required fields
    errors.push(...this.validateRequiredFields(config, this.TOOL_CONFIG_VALIDATORS));
    
    // Validate globs structure
    errors.push(...this.validateGlobsStructure(config as Record<string, unknown>));
    
    return errors;
  }

  /**
   * Validate language configuration
   */
  static validateLanguageConfiguration(config: unknown): string[] {
    if (!config || typeof config !== 'object') {
      return ['Configuration must be an object'];
    }
    
    const langConfig = config as Record<string, unknown>;
    const errors: string[] = [];
    
    // Validate required fields
    errors.push(...this.validateRequiredFields(langConfig, this.LANGUAGE_CONFIG_VALIDATORS));
    
    // Validate globs array
    if (!Array.isArray(langConfig.globs)) {
      errors.push('globs must be an array');
    } else if (!langConfig.globs.every(item => typeof item === 'string')) {
      errors.push('globs must be an array of strings');
    }
    
    // Validate optional languageFeatures
    if (langConfig.languageFeatures !== undefined) {
      errors.push(...this.validateLanguageFeatures(langConfig.languageFeatures));
    }
    
    return errors;
  }

  /**
   * Generic field validation
   */
  private static validateRequiredFields(
    config: unknown,
    validators: ReadonlyArray<FieldValidator>
  ): string[] {
    if (!config || typeof config !== 'object') {
      return ['Configuration must be an object'];
    }
    
    const configObject = config as Record<string, unknown>;
    const errors: string[] = [];
    
    for (const validator of validators) {
      if (validator.optional && configObject[validator.field] === undefined) {
        continue;
      }
      
      if (typeof configObject[validator.field] !== validator.type) {
        errors.push(validator.message);
      }
    }
    
    return errors;
  }

  /**
   * Validate globs structure in configuration
   */
  private static validateGlobsStructure(config: Record<string, unknown>): string[] {
    const globs = config.globs;
    
    if (globs === undefined) {
      return [];
    }
    
    if (typeof globs !== 'object' || globs === null) {
      return ['globs must be an object'];
    }
    
    const globsRecord = globs as Record<string, unknown>;
    const errors: string[] = [];
    
    // Validate inherit field
    if (globsRecord.inherit !== undefined && typeof globsRecord.inherit !== 'string') {
      errors.push('globs.inherit must be a string');
    }
    
    // Validate additional globs
    if (globsRecord.additional !== undefined) {
      if (!Array.isArray(globsRecord.additional)) {
        errors.push('globs.additional must be an array');
      } else if (!globsRecord.additional.every(item => typeof item === 'string')) {
        errors.push('globs.additional must be an array of strings');
      }
    }
    
    return errors;
  }

  /**
   * Validate language features array
   */
  private static validateLanguageFeatures(features: unknown): string[] {
    if (!Array.isArray(features)) {
      return ['languageFeatures must be an array'];
    }
    
    if (!features.every(item => typeof item === 'string')) {
      return ['languageFeatures must be an array of strings'];
    }
    
    return [];
  }

  /**
   * Check if configuration is valid StrictToolConfiguration
   */
  static isValidToolConfiguration(config: unknown): config is StrictToolConfiguration {
    return this.validateToolConfiguration(config).length === 0;
  }

  /**
   * Check if configuration is valid StrictLanguageConfiguration
   */
  static isValidLanguageConfiguration(config: unknown): config is StrictLanguageConfiguration {
    return this.validateLanguageConfiguration(config).length === 0;
  }
}