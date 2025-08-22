# Code Review Best Practices

## Core Principles

### Code Review Philosophy
```yaml
code_review_fundamentals:
  purpose:
    - Knowledge sharing
    - Bug prevention
    - Code quality improvement
    - Team learning
    - Standards enforcement
    
  mindset:
    - Collaborative, not adversarial
    - Educational, not judgmental
    - Constructive, not destructive
    - Objective, not personal
    
  benefits:
    - Reduced defect rate
    - Improved code consistency
    - Knowledge distribution
    - Mentorship opportunities
    - Better design decisions
```

## Review Process

### Pull Request Template
```markdown
<!-- .github/pull_request_template.md -->
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Refactoring

## Motivation and Context
Why is this change required? What problem does it solve?
Link to issue: #(issue)

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing
- [ ] Unit tests pass locally
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Performance testing (if applicable)

## Test Coverage
- Current coverage: X%
- New coverage: Y%

## Screenshots (if applicable)
Add screenshots to help explain your changes.

## Checklist
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published

## Performance Impact
- [ ] This change has no performance impact
- [ ] This change improves performance
- [ ] This change may degrade performance (explain why it's necessary)

## Security Considerations
- [ ] This change has no security implications
- [ ] Security implications have been reviewed and addressed

## Deployment Notes
Special instructions for deployment (if any).

## Rollback Plan
How to rollback this change if needed.
```

### Review Checklist

#### Architecture & Design
```typescript
// Review checklist for architecture
interface ArchitectureReviewChecklist {
  designPatterns: {
    appropriate: boolean;
    consistent: boolean;
    documented: boolean;
  };
  
  scalability: {
    horizontalScaling: boolean;
    verticalScaling: boolean;
    bottlenecksIdentified: boolean;
  };
  
  maintainability: {
    modular: boolean;
    looseCoupling: boolean;
    highCohesion: boolean;
    singleResponsibility: boolean;
  };
  
  performance: {
    algorithmsOptimal: boolean;
    cachingStrategy: boolean;
    databaseQueries: boolean;
    asyncOperations: boolean;
  };
}

// Example review comment
const architectureReview = `
## Architecture Review

### ✅ Strengths
- Good separation of concerns between layers
- Appropriate use of dependency injection
- Clear module boundaries

### 🔧 Suggestions
- Consider extracting the validation logic into a separate service
- The repository pattern could benefit from a unit of work pattern
- Add caching layer for frequently accessed data

### ❓ Questions
- How will this scale with 10x the current load?
- What's the strategy for handling partial failures?
- Should we consider event sourcing for audit requirements?
`;
```

#### Code Quality
```typescript
// Code quality review points
class CodeQualityReviewer {
  checkNaming(): ReviewResult {
    return {
      classes: this.checkClassNames(),
      methods: this.checkMethodNames(),
      variables: this.checkVariableNames(),
      constants: this.checkConstantNames(),
      files: this.checkFileNames()
    };
  }

  checkComplexity(): ReviewResult {
    return {
      cyclomaticComplexity: this.analyzeCyclomaticComplexity(),
      cognitiveComplexity: this.analyzeCognitiveComplexity(),
      nestingDepth: this.checkNestingDepth(),
      methodLength: this.checkMethodLength(),
      classSize: this.checkClassSize()
    };
  }

  checkReadability(): ReviewResult {
    return {
      comments: this.checkCommentQuality(),
      formatting: this.checkCodeFormatting(),
      consistency: this.checkStyleConsistency(),
      clarity: this.checkCodeClarity()
    };
  }

  checkMaintainability(): ReviewResult {
    return {
      duplication: this.detectCodeDuplication(),
      coupling: this.analyzeCoupling(),
      cohesion: this.analyzeCohesion(),
      dependencies: this.checkDependencies()
    };
  }
}

// Example review comments
const codeQualityComments = [
  {
    severity: 'critical',
    line: 42,
    comment: 'This method has a cyclomatic complexity of 15. Consider breaking it down into smaller methods.'
  },
  {
    severity: 'major',
    line: 156,
    comment: 'Duplicate code detected. This logic already exists in UserService.validateEmail()'
  },
  {
    severity: 'minor',
    line: 78,
    comment: 'Variable name `temp` is not descriptive. Consider `validatedUserData` instead.'
  },
  {
    severity: 'suggestion',
    line: 234,
    comment: 'This could be simplified using Array.reduce() instead of a for loop.'
  }
];
```

#### Security Review
```typescript
// Security review checklist
interface SecurityReviewChecklist {
  authentication: {
    properTokenValidation: boolean;
    sessionManagement: boolean;
    passwordHandling: boolean;
    mfaImplementation: boolean;
  };
  
  authorization: {
    accessControl: boolean;
    privilegeEscalation: boolean;
    roleValidation: boolean;
    resourcePermissions: boolean;
  };
  
  dataProtection: {
    encryption: boolean;
    sensitiveDataExposure: boolean;
    piiHandling: boolean;
    loggingSecurity: boolean;
  };
  
  inputValidation: {
    sqlInjection: boolean;
    xssProtection: boolean;
    commandInjection: boolean;
    pathTraversal: boolean;
  };
  
  dependencies: {
    vulnerablePackages: boolean;
    outdatedLibraries: boolean;
    licenseCompliance: boolean;
  };
}

// Security review automation
class SecurityReviewer {
  async reviewPullRequest(pr: PullRequest): Promise<SecurityReport> {
    const report: SecurityReport = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };

    // Check for hardcoded secrets
    const secretPatterns = [
      /api[_-]?key\s*=\s*["'][^"']+["']/gi,
      /password\s*=\s*["'][^"']+["']/gi,
      /token\s*=\s*["'][^"']+["']/gi,
      /AWS[A-Z0-9]{16,}/g,
      /(?:r|s)k_live_[0-9a-zA-Z]{24}/g  // Stripe keys
    ];

    for (const file of pr.files) {
      for (const pattern of secretPatterns) {
        const matches = file.content.match(pattern);
        if (matches) {
          report.critical.push({
            file: file.path,
            issue: 'Potential hardcoded secret detected',
            line: this.findLineNumber(file.content, matches[0]),
            recommendation: 'Use environment variables or secret management service'
          });
        }
      }
    }

    // Check for SQL injection vulnerabilities
    const sqlInjectionPatterns = [
      /query\s*\(\s*['"`].*\$\{.*\}.*['"`]\s*\)/g,
      /execute\s*\(\s*['"`].*\+.*['"`]\s*\)/g
    ];

    for (const file of pr.files) {
      for (const pattern of sqlInjectionPatterns) {
        const matches = file.content.match(pattern);
        if (matches) {
          report.high.push({
            file: file.path,
            issue: 'Potential SQL injection vulnerability',
            line: this.findLineNumber(file.content, matches[0]),
            recommendation: 'Use parameterized queries or prepared statements'
          });
        }
      }
    }

    return report;
  }
}
```

## Review Comments Best Practices

### Constructive Feedback Examples

#### Good Review Comments
```typescript
// ✅ Good: Specific, actionable, and educational
comment = {
  line: 45,
  text: `
    Consider using \`Array.includes()\` instead of \`indexOf() !== -1\` for better readability:
    \`\`\`typescript
    if (allowedRoles.includes(userRole)) {
      // ...
    }
    \`\`\`
    This is more idiomatic in modern JavaScript and clearly expresses the intent.
  `
};

// ✅ Good: Explains the "why"
comment = {
  line: 78,
  text: `
    This synchronous file operation could block the event loop in production.
    Consider using \`fs.promises.readFile()\` instead:
    \`\`\`typescript
    const data = await fs.promises.readFile(path, 'utf-8');
    \`\`\`
    This prevents blocking other requests while reading large files.
  `
};

// ✅ Good: Offers alternatives
comment = {
  line: 112,
  text: `
    Instead of nested ternary operators, consider using a mapping object for clarity:
    \`\`\`typescript
    const statusMessages = {
      'pending': 'Awaiting approval',
      'approved': 'Ready to proceed',
      'rejected': 'Request denied'
    };
    return statusMessages[status] || 'Unknown status';
    \`\`\`
  `
};
```

#### Poor Review Comments
```typescript
// ❌ Bad: Vague and unhelpful
comment = {
  line: 45,
  text: "This doesn't look right."
};

// ❌ Bad: Personal and unconstructive
comment = {
  line: 78,
  text: "Why would you write it like this? This is terrible."
};

// ❌ Bad: Nitpicking without context
comment = {
  line: 112,
  text: "Missing semicolon." // When project uses automatic formatting
};

// ❌ Bad: Opinion stated as fact without justification
comment = {
  line: 156,
  text: "Never use forEach, always use for loops."
};
```

### Comment Templates

#### Performance Issues
```markdown
## Performance Concern 🚀

I noticed this operation has O(n²) complexity due to the nested loops. 

**Current approach:**
```javascript
for (const user of users) {
  for (const role of roles) {
    // ...
  }
}
```

**Suggested optimization:**
```javascript
const roleSet = new Set(roles);
for (const user of users) {
  if (roleSet.has(user.role)) {
    // ...
  }
}
```

This reduces complexity to O(n) by using a Set for constant-time lookups.

**Impact:** For 1000 users and 100 roles, this changes from 100,000 operations to 1,100.
```

#### Security Issues
```markdown
## Security Issue 🔒

**Severity:** High

**Issue:** User input is being directly interpolated into the SQL query, creating a SQL injection vulnerability.

**Vulnerable code:**
```javascript
const query = `SELECT * FROM users WHERE email = '${userEmail}'`;
```

**Secure alternative:**
```javascript
const query = 'SELECT * FROM users WHERE email = ?';
const results = await db.query(query, [userEmail]);
```

**Reference:** [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)

**Testing:** Please add a test case with malicious input like `' OR '1'='1` to verify the fix.
```

#### Design Suggestions
```markdown
## Design Suggestion 💡

This class is handling both data fetching and business logic, violating the Single Responsibility Principle.

**Consider splitting into:**
1. `UserRepository` - handles data access
2. `UserService` - handles business logic
3. `UserValidator` - handles validation

**Benefits:**
- Easier to test each component in isolation
- More reusable components
- Clearer separation of concerns

**Example refactoring:**
```typescript
// UserRepository.ts
class UserRepository {
  async findById(id: string): Promise<User> {
    // data access logic
  }
}

// UserService.ts
class UserService {
  constructor(
    private repository: UserRepository,
    private validator: UserValidator
  ) {}
  
  async getValidatedUser(id: string): Promise<User> {
    const user = await this.repository.findById(id);
    await this.validator.validate(user);
    return user;
  }
}
```

Would you like help with this refactoring?
```

## Automated Code Review

### GitHub Actions Review Bot
```yaml
# .github/workflows/code-review.yml
name: Automated Code Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  code-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Review Tools
        run: |
          npm install -g eslint prettier
          pip install flake8 black pylint
          
      - name: Run ESLint
        id: eslint
        run: |
          npx eslint . --format json > eslint-report.json || true
          echo "::set-output name=report::$(cat eslint-report.json)"

      - name: Run SonarQube Analysis
        uses: sonarsource/sonarqube-scan-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

      - name: Check Code Complexity
        run: |
          npx complexity-report-cli src/ --format json > complexity-report.json
          
      - name: Security Scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Post Review Comments
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const eslintReport = JSON.parse(fs.readFileSync('eslint-report.json', 'utf8'));
            const complexityReport = JSON.parse(fs.readFileSync('complexity-report.json', 'utf8'));
            
            // Process ESLint issues
            const comments = [];
            for (const file of eslintReport) {
              for (const message of file.messages) {
                if (message.severity === 2) { // Error
                  comments.push({
                    path: file.filePath,
                    line: message.line,
                    body: `**ESLint Error:** ${message.message}\n\nRule: \`${message.ruleId}\``
                  });
                }
              }
            }
            
            // Process complexity issues
            for (const file of complexityReport.reports) {
              if (file.complexity > 10) {
                comments.push({
                  path: file.path,
                  line: 1,
                  body: `**High Complexity:** This file has a complexity of ${file.complexity}. Consider refactoring to reduce complexity.`
                });
              }
            }
            
            // Post comments
            for (const comment of comments) {
              await github.rest.pulls.createReviewComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: context.issue.number,
                path: comment.path,
                line: comment.line,
                body: comment.body
              });
            }
```

### Review Bot Implementation
```typescript
// src/review-bot/index.ts
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { ReviewAnalyzer } from './analyzers';

export class CodeReviewBot {
  private octokit: Octokit;
  private analyzers: ReviewAnalyzer[];

  constructor(config: BotConfig) {
    this.octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: config.appId,
        privateKey: config.privateKey,
        installationId: config.installationId
      }
    });

    this.analyzers = [
      new ComplexityAnalyzer(),
      new SecurityAnalyzer(),
      new PerformanceAnalyzer(),
      new TestCoverageAnalyzer(),
      new DocumentationAnalyzer(),
      new DependencyAnalyzer()
    ];
  }

  async reviewPullRequest(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<void> {
    // Get PR details
    const { data: pr } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber
    });

    // Get changed files
    const { data: files } = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber
    });

    // Run analyzers
    const issues: ReviewIssue[] = [];
    for (const analyzer of this.analyzers) {
      const analyzerIssues = await analyzer.analyze(files);
      issues.push(...analyzerIssues);
    }

    // Group issues by severity
    const critical = issues.filter(i => i.severity === 'critical');
    const major = issues.filter(i => i.severity === 'major');
    const minor = issues.filter(i => i.severity === 'minor');
    const suggestions = issues.filter(i => i.severity === 'suggestion');

    // Create review
    const review = await this.createReview(
      owner,
      repo,
      pullNumber,
      critical,
      major,
      minor,
      suggestions
    );

    // Post inline comments
    await this.postInlineComments(owner, repo, pullNumber, issues);

    // Update PR status
    await this.updatePRStatus(owner, repo, pr.head.sha, critical.length === 0);
  }

  private async createReview(
    owner: string,
    repo: string,
    pullNumber: number,
    critical: ReviewIssue[],
    major: ReviewIssue[],
    minor: ReviewIssue[],
    suggestions: ReviewIssue[]
  ): Promise<void> {
    let body = '## Automated Code Review Results\n\n';
    
    if (critical.length === 0 && major.length === 0) {
      body += '✅ **No blocking issues found!**\n\n';
    } else {
      body += '⚠️ **Issues requiring attention:**\n\n';
    }

    if (critical.length > 0) {
      body += `### 🔴 Critical Issues (${critical.length})\n`;
      critical.forEach(issue => {
        body += `- ${issue.message} (${issue.file}:${issue.line})\n`;
      });
      body += '\n';
    }

    if (major.length > 0) {
      body += `### 🟡 Major Issues (${major.length})\n`;
      major.forEach(issue => {
        body += `- ${issue.message} (${issue.file}:${issue.line})\n`;
      });
      body += '\n';
    }

    if (minor.length > 0) {
      body += `### 🔵 Minor Issues (${minor.length})\n`;
      body += `<details><summary>Click to expand</summary>\n\n`;
      minor.forEach(issue => {
        body += `- ${issue.message} (${issue.file}:${issue.line})\n`;
      });
      body += '</details>\n\n';
    }

    if (suggestions.length > 0) {
      body += `### 💡 Suggestions (${suggestions.length})\n`;
      body += `<details><summary>Click to expand</summary>\n\n`;
      suggestions.forEach(issue => {
        body += `- ${issue.message} (${issue.file}:${issue.line})\n`;
      });
      body += '</details>\n\n';
    }

    // Add metrics
    body += '### 📊 Metrics\n';
    body += '| Metric | Value |\n';
    body += '|--------|-------|\n';
    body += `| Files Changed | ${files.length} |\n`;
    body += `| Lines Added | ${this.calculateLinesAdded(files)} |\n`;
    body += `| Lines Removed | ${this.calculateLinesRemoved(files)} |\n`;
    body += `| Test Coverage | ${await this.getTestCoverage()} |\n`;
    body += `| Complexity | ${await this.getComplexity()} |\n`;

    await this.octokit.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      body,
      event: critical.length > 0 ? 'REQUEST_CHANGES' : 'COMMENT'
    });
  }

  private async postInlineComments(
    owner: string,
    repo: string,
    pullNumber: number,
    issues: ReviewIssue[]
  ): Promise<void> {
    const comments = issues
      .filter(issue => issue.line !== undefined)
      .map(issue => ({
        path: issue.file,
        line: issue.line!,
        body: this.formatInlineComment(issue)
      }));

    if (comments.length > 0) {
      await this.octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        comments,
        event: 'COMMENT'
      });
    }
  }

  private formatInlineComment(issue: ReviewIssue): string {
    const emoji = {
      critical: '🔴',
      major: '🟡',
      minor: '🔵',
      suggestion: '💡'
    };

    let comment = `${emoji[issue.severity]} **${issue.type}:** ${issue.message}\n\n`;
    
    if (issue.suggestion) {
      comment += '**Suggestion:**\n```' + issue.suggestionLang + '\n';
      comment += issue.suggestion + '\n```\n';
    }
    
    if (issue.reference) {
      comment += `\n📚 [Reference](${issue.reference})`;
    }
    
    return comment;
  }

  private async updatePRStatus(
    owner: string,
    repo: string,
    sha: string,
    success: boolean
  ): Promise<void> {
    await this.octokit.repos.createCommitStatus({
      owner,
      repo,
      sha,
      state: success ? 'success' : 'failure',
      context: 'code-review/bot',
      description: success 
        ? 'All checks passed' 
        : 'Issues found that need attention'
    });
  }
}
```

## Review Metrics

### Code Review Dashboard
```typescript
// src/metrics/review-metrics.ts
export class ReviewMetrics {
  async calculateMetrics(
    repository: string,
    period: { start: Date; end: Date }
  ): Promise<ReviewMetricsReport> {
    const prs = await this.getPullRequests(repository, period);
    
    return {
      velocity: {
        totalPRs: prs.length,
        merged: prs.filter(pr => pr.merged).length,
        closed: prs.filter(pr => pr.closed && !pr.merged).length,
        open: prs.filter(pr => !pr.closed).length
      },
      
      timing: {
        averageTimeToFirstReview: this.calculateAverageTime(
          prs.map(pr => pr.timeToFirstReview)
        ),
        averageTimeToMerge: this.calculateAverageTime(
          prs.filter(pr => pr.merged).map(pr => pr.timeToMerge)
        ),
        averageReviewCycles: this.calculateAverage(
          prs.map(pr => pr.reviewCycles)
        )
      },
      
      quality: {
        averageCommentsPerPR: this.calculateAverage(
          prs.map(pr => pr.comments.length)
        ),
        defectEscapeRate: await this.calculateDefectEscapeRate(prs),
        testCoverageChange: await this.calculateCoverageChange(prs)
      },
      
      participation: {
        uniqueReviewers: new Set(
          prs.flatMap(pr => pr.reviewers)
        ).size,
        averageReviewersPerPR: this.calculateAverage(
          prs.map(pr => pr.reviewers.length)
        ),
        reviewerDistribution: this.calculateReviewerDistribution(prs)
      },
      
      patterns: {
        commonIssues: this.identifyCommonIssues(prs),
        hotspots: this.identifyCodeHotspots(prs),
        bottlenecks: this.identifyReviewBottlenecks(prs)
      }
    };
  }

  generateReport(metrics: ReviewMetricsReport): string {
    return `
# Code Review Metrics Report

## Review Velocity
- Total PRs: ${metrics.velocity.totalPRs}
- Merged: ${metrics.velocity.merged} (${this.percentage(metrics.velocity.merged, metrics.velocity.totalPRs)}%)
- Closed without merge: ${metrics.velocity.closed}
- Currently open: ${metrics.velocity.open}

## Timing Metrics
- Average time to first review: ${this.formatDuration(metrics.timing.averageTimeToFirstReview)}
- Average time to merge: ${this.formatDuration(metrics.timing.averageTimeToMerge)}
- Average review cycles: ${metrics.timing.averageReviewCycles.toFixed(1)}

## Quality Metrics
- Average comments per PR: ${metrics.quality.averageCommentsPerPR.toFixed(1)}
- Defect escape rate: ${metrics.quality.defectEscapeRate.toFixed(2)}%
- Test coverage change: ${metrics.quality.testCoverageChange > 0 ? '+' : ''}${metrics.quality.testCoverageChange.toFixed(2)}%

## Participation
- Unique reviewers: ${metrics.participation.uniqueReviewers}
- Average reviewers per PR: ${metrics.participation.averageReviewersPerPR.toFixed(1)}

## Top Issues Found
${metrics.patterns.commonIssues.slice(0, 5).map((issue, i) => 
  `${i + 1}. ${issue.type} (${issue.count} occurrences)`
).join('\n')}

## Code Hotspots
${metrics.patterns.hotspots.slice(0, 5).map((file, i) => 
  `${i + 1}. ${file.path} (${file.changes} changes)`
).join('\n')}

## Review Bottlenecks
${metrics.patterns.bottlenecks.map(bottleneck => 
  `- ${bottleneck.reviewer}: ${bottleneck.pendingReviews} pending reviews`
).join('\n')}
    `;
  }
}
```

### Review Analytics
```typescript
// src/analytics/review-analytics.ts
export class ReviewAnalytics {
  async analyzeReviewEffectiveness(
    repository: string,
    period: { start: Date; end: Date }
  ): Promise<EffectivenessReport> {
    const reviews = await this.getReviews(repository, period);
    const issues = await this.getProductionIssues(repository, period);
    
    // Correlate reviews with production issues
    const preventedIssues = this.correlatePreventedIssues(reviews, issues);
    const missedIssues = this.correlateMissedIssues(reviews, issues);
    
    return {
      effectiveness: {
        issuesPrevented: preventedIssues.length,
        issuesMissed: missedIssues.length,
        preventionRate: preventedIssues.length / (preventedIssues.length + missedIssues.length),
        
        byCategory: {
          security: this.categorizeIssues(preventedIssues, 'security'),
          performance: this.categorizeIssues(preventedIssues, 'performance'),
          functionality: this.categorizeIssues(preventedIssues, 'functionality'),
          maintainability: this.categorizeIssues(preventedIssues, 'maintainability')
        }
      },
      
      reviewerPerformance: await this.analyzeReviewerPerformance(reviews),
      
      trends: {
        reviewQuality: this.calculateReviewQualityTrend(reviews),
        responseTime: this.calculateResponseTimeTrend(reviews),
        thoroughness: this.calculateThoroughnessTrend(reviews)
      },
      
      recommendations: this.generateRecommendations(reviews, issues)
    };
  }

  private generateRecommendations(
    reviews: Review[],
    issues: Issue[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Analyze patterns in missed issues
    const missedPatterns = this.analyzeMissedPatterns(issues);
    
    if (missedPatterns.security > 0.2) {
      recommendations.push({
        priority: 'high',
        category: 'security',
        recommendation: 'Increase focus on security reviews. Consider mandatory security checklist.',
        impact: 'Could prevent ' + Math.round(missedPatterns.security * 100) + '% of security issues'
      });
    }
    
    // Analyze review load distribution
    const loadDistribution = this.analyzeLoadDistribution(reviews);
    
    if (loadDistribution.imbalance > 0.3) {
      recommendations.push({
        priority: 'medium',
        category: 'process',
        recommendation: 'Review load is imbalanced. Consider round-robin assignment or load balancing.',
        impact: 'Could reduce review time by ' + Math.round(loadDistribution.potentialReduction * 100) + '%'
      });
    }
    
    // Analyze review timing
    const timingAnalysis = this.analyzeReviewTiming(reviews);
    
    if (timingAnalysis.averageDelay > 8 * 60 * 60 * 1000) { // 8 hours
      recommendations.push({
        priority: 'medium',
        category: 'process',
        recommendation: 'Reviews are delayed. Consider setting SLAs or review rotation schedule.',
        impact: 'Could reduce cycle time by ' + Math.round(timingAnalysis.potentialReduction / 3600000) + ' hours'
      });
    }
    
    return recommendations;
  }
}
```

## Best Practices Guidelines

### For Authors
```yaml
author_best_practices:
  before_submission:
    - Self-review your code
    - Run all tests locally
    - Update documentation
    - Check for security issues
    - Verify performance impact
    
  pr_description:
    - Clear title and description
    - Link to related issues
    - Explain design decisions
    - Include testing steps
    - Add screenshots if UI changes
    
  pr_size:
    - Keep PRs small and focused
    - One feature/fix per PR
    - < 400 lines changed ideally
    - Split large changes into series
    
  responding_to_feedback:
    - Address all comments
    - Explain if you disagree
    - Push fixes as separate commits
    - Request re-review when ready
```

### For Reviewers
```yaml
reviewer_best_practices:
  review_approach:
    - Understand the context first
    - Check against requirements
    - Consider the bigger picture
    - Focus on important issues
    - Be respectful and constructive
    
  what_to_look_for:
    - Correctness and logic errors
    - Security vulnerabilities
    - Performance issues
    - Code maintainability
    - Test coverage
    - Documentation
    
  commenting:
    - Be specific and actionable
    - Explain the why
    - Provide examples or links
    - Distinguish must-fix from nice-to-have
    - Acknowledge good practices
    
  time_management:
    - Review promptly (within 24h)
    - Block time for reviews
    - Prioritize based on impact
    - Use review tools effectively
```

### Review Anti-Patterns
```yaml
anti_patterns:
  as_author:
    - Giant PRs (1000+ lines)
    - Mixing features and refactoring
    - Ignoring reviewer feedback
    - Defensive responses
    - Insufficient testing
    
  as_reviewer:
    - Nitpicking without context
    - Personal preference as requirement
    - Delayed reviews (> 48h)
    - Approve without reading
    - Harsh or dismissive tone
    
  process:
    - No review guidelines
    - Inconsistent standards
    - Review bottlenecks
    - Lack of automation
    - No metrics tracking
```

This comprehensive Code Review Best Practices document provides:
- Complete review process and templates
- Detailed checklists for different aspects
- Constructive feedback examples and templates
- Automated review bot implementations
- Review metrics and analytics
- Best practices for authors and reviewers
- Anti-patterns to avoid

The implementation emphasizes constructive, educational reviews that improve code quality while fostering team collaboration and learning.