#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { mkdtemp, rm } = require('fs/promises');
const { tmpdir } = require('os');

// Configuration for all test patterns
const languages = ['ja', 'en', 'ch'];
const formats = ['claude', 'cursor', 'copilot', 'windsurf'];

// Expected file paths for each format
const expectedPaths = {
  claude: 'CLAUDE.md',
  cursor: '.cursor/rules/main.mdc',
  copilot: '.github/copilot-instructions.md',
  windsurf: '.windsurfrules'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

async function testAllPatterns() {
  console.log(`${colors.bright}${colors.cyan}=== Testing All Template Generation Patterns ===${colors.reset}\n`);
  
  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (const lang of languages) {
    for (const format of formats) {
      const tempDir = await mkdtemp(path.join(tmpdir(), 'test-pattern-'));
      const projectName = `test-${lang}-${format}`;
      
      console.log(`${colors.bright}Testing: --lang ${lang} --output-format ${format}${colors.reset}`);
      console.log(`  Project: ${projectName}`);
      console.log(`  Output: ${tempDir}`);
      
      try {
        // Execute the CLI command
        const command = `npx ts-node src/cli.ts init --output "${tempDir}" --project-name "${projectName}" --lang ${lang} --output-format ${format}`;
        const output = execSync(command, { encoding: 'utf-8', cwd: process.cwd() });
        
        // Check if expected file exists
        const expectedPath = path.join(tempDir, expectedPaths[format]);
        const fileExists = fs.existsSync(expectedPath);
        
        if (fileExists) {
          // Read file content
          const content = fs.readFileSync(expectedPath, 'utf-8');
          const contentPreview = content.substring(0, 200).replace(/\n/g, '\\n');
          
          // Check for specific format characteristics
          let formatValid = false;
          let formatNotes = '';
          
          switch (format) {
            case 'claude':
              formatValid = content.includes(projectName) && 
                           !content.startsWith('---\n'); // Should NOT have YAML frontmatter
              formatNotes = 'No YAML frontmatter';
              break;
              
            case 'cursor':
              formatValid = content.startsWith('---\n') && 
                           content.includes('description:') &&
                           content.includes('globs:');
              formatNotes = 'Has YAML frontmatter with globs';
              break;
              
            case 'copilot':
              formatValid = content.includes('GitHub Copilot Custom Instructions') &&
                           !content.startsWith('---\n');
              formatNotes = 'GitHub Copilot format, no YAML';
              break;
              
            case 'windsurf':
              formatValid = content.includes('Windsurf AI Pair Programming Rules') &&
                           !content.startsWith('---\n');
              formatNotes = 'Windsurf format, no YAML';
              break;
          }
          
          // Check for language-specific content
          let langValid = false;
          switch (lang) {
            case 'ja':
              langValid = content.includes('開発') || content.includes('指示') || 
                         content.includes('原則') || content.includes('Development');
              break;
            case 'en':
              langValid = content.includes('Development') || content.includes('Instructions') ||
                         content.includes('Principles');
              break;
            case 'ch':
              langValid = content.includes('开发') || content.includes('指令') || 
                         content.includes('原则') || content.includes('Development');
              break;
          }
          
          const success = fileExists && formatValid && langValid;
          
          if (success) {
            console.log(`  ${colors.green}✓ SUCCESS${colors.reset}`);
            successCount++;
          } else {
            console.log(`  ${colors.red}✗ FAILED${colors.reset}`);
            failCount++;
          }
          
          console.log(`  File exists: ${fileExists ? '✓' : '✗'}`);
          console.log(`  Format valid: ${formatValid ? '✓' : '✗'} (${formatNotes})`);
          console.log(`  Language valid: ${langValid ? '✓' : '✗'}`);
          console.log(`  Content preview: "${contentPreview}..."`);
          
          results.push({
            lang,
            format,
            success,
            fileExists,
            formatValid,
            langValid,
            path: expectedPath,
            contentPreview
          });
          
        } else {
          console.log(`  ${colors.red}✗ FAILED - File not found at ${expectedPath}${colors.reset}`);
          failCount++;
          results.push({
            lang,
            format,
            success: false,
            fileExists: false,
            path: expectedPath
          });
        }
        
      } catch (error) {
        console.log(`  ${colors.red}✗ ERROR: ${error.message}${colors.reset}`);
        failCount++;
        results.push({
          lang,
          format,
          success: false,
          error: error.message
        });
      }
      
      // Clean up temp directory
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
      
      console.log('');
    }
  }
  
  // Print summary
  console.log(`${colors.bright}${colors.cyan}=== Test Summary ===${colors.reset}`);
  console.log(`Total patterns tested: ${languages.length * formats.length}`);
  console.log(`${colors.green}Successful: ${successCount}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failCount}${colors.reset}`);
  
  // Print detailed results table
  console.log(`\n${colors.bright}Detailed Results:${colors.reset}`);
  console.log('┌──────┬──────────┬─────────┬────────┬────────┬──────────────────────────┐');
  console.log('│ Lang │ Format   │ Success │ File   │ Format │ Path                     │');
  console.log('├──────┼──────────┼─────────┼────────┼────────┼──────────────────────────┤');
  
  for (const result of results) {
    const successIcon = result.success ? '✓' : '✗';
    const successColor = result.success ? colors.green : colors.red;
    const fileIcon = result.fileExists ? '✓' : '✗';
    const formatIcon = result.formatValid ? '✓' : '✗';
    const expectedFile = expectedPaths[result.format];
    
    console.log(
      `│ ${result.lang.padEnd(4)} │ ${result.format.padEnd(8)} │ ${successColor}${successIcon.padEnd(7)}${colors.reset} │ ${fileIcon.padEnd(6)} │ ${formatIcon.padEnd(6)} │ ${expectedFile.padEnd(24)} │`
    );
  }
  
  console.log('└──────┴──────────┴─────────┴────────┴────────┴──────────────────────────┘');
  
  if (failCount > 0) {
    console.log(`\n${colors.red}⚠️  Some patterns failed. Please review the output above.${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}✅ All patterns generated successfully!${colors.reset}`);
  }
}

// Run the test
testAllPatterns().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});