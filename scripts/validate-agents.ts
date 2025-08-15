#!/usr/bin/env ts-node
/**
 * Agent Quality Validation Script
 * Issue #93: Validate agent metadata quality and consistency
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';
import { AgentMetadata } from '../src/agents/types';

interface ValidationResult {
  agent: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

class AgentValidator {
  private results: ValidationResult[] = [];
  private allAgents: Map<string, AgentMetadata> = new Map();

  async validateAll(): Promise<void> {
    const metadataPath = join(__dirname, '../agents/metadata');
    const files = readdirSync(metadataPath).filter(f => f.endsWith('.yaml'));
    
    console.log('🔍 Agent Quality Validation Report');
    console.log('=' .repeat(60));
    console.log(`Found ${files.length} agent metadata files\n`);

    // First pass: Load all agents
    for (const file of files) {
      const filePath = join(metadataPath, file);
      const content = readFileSync(filePath, 'utf-8');
      
      try {
        const metadata = yaml.load(content) as AgentMetadata;
        this.allAgents.set(metadata.name, metadata);
      } catch (error) {
        console.error(`❌ Failed to parse ${file}: ${error}`);
      }
    }

    // Second pass: Validate each agent
    for (const [name, metadata] of this.allAgents) {
      const result = this.validateAgent(metadata);
      this.results.push(result);
      this.printResult(result);
    }

    // Summary
    this.printSummary();
  }

  private validateAgent(metadata: AgentMetadata): ValidationResult {
    const result: ValidationResult = {
      agent: metadata.name,
      valid: true,
      errors: [],
      warnings: []
    };

    // Required fields validation
    if (!metadata.name) {
      result.errors.push('Missing required field: name');
      result.valid = false;
    }

    if (!metadata.category) {
      result.errors.push('Missing required field: category');
      result.valid = false;
    }

    if (!metadata.description) {
      result.errors.push('Missing required field: description');
      result.valid = false;
    }

    if (!metadata.tags || metadata.tags.length === 0) {
      result.errors.push('Missing required field: tags (must have at least one tag)');
      result.valid = false;
    }

    if (!metadata.relationships) {
      result.errors.push('Missing required field: relationships');
      result.valid = false;
    }

    // Validate relationships
    if (metadata.relationships) {
      // Check relationship integrity
      const checkRelationship = (relType: string, agents: string[]) => {
        for (const agentName of agents) {
          if (!this.allAgents.has(agentName)) {
            result.warnings.push(`${relType} references non-existent agent: ${agentName}`);
          }
        }
      };

      if (metadata.relationships.requires) {
        checkRelationship('requires', metadata.relationships.requires);
      }
      
      if (metadata.relationships.enhances) {
        checkRelationship('enhances', metadata.relationships.enhances);
      }
      
      if (metadata.relationships.collaborates_with) {
        checkRelationship('collaborates_with', metadata.relationships.collaborates_with);
      }
      
      if (metadata.relationships.conflicts_with) {
        checkRelationship('conflicts_with', metadata.relationships.conflicts_with);
        
        // Check bidirectional conflicts
        for (const conflictAgent of metadata.relationships.conflicts_with) {
          const other = this.allAgents.get(conflictAgent);
          if (other && other.relationships.conflicts_with) {
            if (!other.relationships.conflicts_with.includes(metadata.name)) {
              result.warnings.push(`Conflict with ${conflictAgent} is not bidirectional`);
            }
          }
        }
      }
    }

    // Validate category
    const validCategories = ['development', 'quality', 'infrastructure', 'security', 'documentation'];
    if (metadata.category && !validCategories.includes(metadata.category)) {
      result.warnings.push(`Unusual category: ${metadata.category} (expected one of: ${validCategories.join(', ')})`);
    }

    // Validate description quality
    if (metadata.description && metadata.description.length < 10) {
      result.warnings.push('Description is too short (less than 10 characters)');
    }

    // Check for recommended metadata
    if (!metadata.source) {
      result.warnings.push('Recommended field missing: source');
    }

    if (!metadata.version) {
      result.warnings.push('Recommended field missing: version');
    }

    if (!metadata.author) {
      result.warnings.push('Recommended field missing: author');
    }

    return result;
  }

  private printResult(result: ValidationResult): void {
    const status = result.valid ? '✅' : '❌';
    console.log(`${status} ${result.agent}`);
    
    if (result.errors.length > 0) {
      console.log('  Errors:');
      result.errors.forEach(error => {
        console.log(`    ❌ ${error}`);
      });
    }
    
    if (result.warnings.length > 0) {
      console.log('  Warnings:');
      result.warnings.forEach(warning => {
        console.log(`    ⚠️  ${warning}`);
      });
    }
    
    console.log();
  }

  private printSummary(): void {
    console.log('=' .repeat(60));
    console.log('📊 Summary');
    console.log('-' .repeat(60));
    
    const totalAgents = this.results.length;
    const validAgents = this.results.filter(r => r.valid).length;
    const totalErrors = this.results.reduce((sum, r) => sum + r.errors.length, 0);
    const totalWarnings = this.results.reduce((sum, r) => sum + r.warnings.length, 0);
    
    console.log(`Total Agents: ${totalAgents}`);
    console.log(`Valid Agents: ${validAgents}`);
    console.log(`Invalid Agents: ${totalAgents - validAgents}`);
    console.log(`Total Errors: ${totalErrors}`);
    console.log(`Total Warnings: ${totalWarnings}`);
    
    if (totalErrors === 0 && totalWarnings === 0) {
      console.log('\n🎉 All agents pass quality validation!');
    } else if (totalErrors === 0) {
      console.log('\n✅ All agents are valid, but there are some warnings to address.');
    } else {
      console.log('\n❌ Some agents have validation errors that must be fixed.');
      process.exit(1);
    }
  }
}

// Run validation
const validator = new AgentValidator();
validator.validateAll().catch(error => {
  console.error('Validation failed:', error);
  process.exit(1);
});