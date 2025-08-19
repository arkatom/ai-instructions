# Agile/Scrum Patterns

Agile development and Scrum framework patterns.

## Scrum Framework

### Sprint Structure
```yaml
sprint:
  duration: 2 weeks
  ceremonies:
    - sprint_planning: Day 1
    - daily_standup: Daily 15min
    - sprint_review: Last day
    - retrospective: Last day
  
  artifacts:
    - product_backlog
    - sprint_backlog
    - increment
```

### Roles and Responsibilities
```yaml
roles:
  product_owner:
    - Product backlog management
    - Priority decisions
    - Stakeholder coordination
  
  scrum_master:
    - Process facilitation
    - Impediment removal
    - Team support
  
  development_team:
    - Self-organizing
    - Cross-functional
    - Delivery responsibility
```

## Backlog Management

### User Stories
```markdown
# Template
As a [role]
I want [feature]
So that [benefit]

# Acceptance Criteria
Given [precondition]
When [action]
Then [expected result]

# Example
As a user
I want to login with social media
So that I can quickly create an account

Given I'm on the login page
When I click Google login
Then I can login with my Google account
```

### Story Point Estimation
```typescript
// Fibonacci sequence
const storyPoints = [1, 2, 3, 5, 8, 13, 21];

// Estimation criteria
interface EstimationCriteria {
  complexity: 'low' | 'medium' | 'high';
  effort: 'small' | 'medium' | 'large';
  risk: 'low' | 'medium' | 'high';
  dependencies: number;
}

// Planning poker
const estimate = (criteria: EstimationCriteria): number => {
  let points = 1;
  
  if (criteria.complexity === 'high') points += 5;
  if (criteria.effort === 'large') points += 5;
  if (criteria.risk === 'high') points += 3;
  if (criteria.dependencies > 2) points += 3;
  
  return storyPoints.find(p => p >= points) || 21;
};
```

## Sprint Execution

### Daily Standup
```markdown
## Three Questions
1. What did I do yesterday?
2. What will I do today?
3. Are there any impediments?

## Anti-patterns to Avoid
- ❌ Status reporting meeting
- ❌ Problem-solving session
- ❌ Exceeding 15 minutes
- ✅ Synchronization and transparency
- ✅ Early impediment detection
```

### Burndown Chart
```typescript
interface BurndownData {
  day: number;
  ideal: number;
  actual: number;
}

const calculateBurndown = (
  totalPoints: number,
  sprintDays: number,
  completedPoints: number[]
): BurndownData[] => {
  const idealRate = totalPoints / sprintDays;
  let remaining = totalPoints;
  
  return completedPoints.map((completed, index) => {
    remaining -= completed;
    return {
      day: index + 1,
      ideal: totalPoints - (idealRate * (index + 1)),
      actual: remaining
    };
  });
};
```

## Definition of Done

### DoD Checklist
```yaml
definition_of_done:
  code:
    - Feature implemented
    - Code reviewed
    - Refactored
  
  testing:
    - Unit tests created
    - Integration tests passed
    - Acceptance tests passed
  
  documentation:
    - API docs updated
    - User manual updated
    - CHANGELOG updated
  
  deployment:
    - Staged deployment
    - Performance tested
    - Security checked
```

## Velocity Tracking

### Velocity Calculation
```typescript
class VelocityTracker {
  private sprintVelocities: number[] = [];
  
  addSprint(completedPoints: number) {
    this.sprintVelocities.push(completedPoints);
  }
  
  getAverageVelocity(lastNSprints = 3): number {
    const recent = this.sprintVelocities.slice(-lastNSprints);
    return recent.reduce((a, b) => a + b, 0) / recent.length;
  }
  
  predictCompletion(remainingPoints: number): number {
    const avgVelocity = this.getAverageVelocity();
    return Math.ceil(remainingPoints / avgVelocity);
  }
}
```

## Retrospective

### Retrospective Format
```markdown
## Start - Stop - Continue
- Start: Things to start doing
- Stop: Things to stop doing
- Continue: Things to keep doing

## 4Ls
- Liked: What went well
- Learned: What was learned
- Lacked: What was missing
- Longed for: What is desired
```

## Kanban Integration

### WIP Limits
```typescript
interface KanbanColumn {
  name: string;
  wipLimit: number;
  tasks: Task[];
}

const validateWipLimit = (column: KanbanColumn): boolean => {
  return column.tasks.length < column.wipLimit;
};

const kanbanBoard: KanbanColumn[] = [
  { name: 'Backlog', wipLimit: Infinity, tasks: [] },
  { name: 'In Progress', wipLimit: 3, tasks: [] },
  { name: 'Review', wipLimit: 2, tasks: [] },
  { name: 'Done', wipLimit: Infinity, tasks: [] }
];
```

## Checklist
- [ ] Sprint planning conducted
- [ ] Daily standups held
- [ ] Backlog prioritized
- [ ] DoD clarified
- [ ] Velocity tracked
- [ ] Retrospectives conducted
- [ ] Continuous improvement