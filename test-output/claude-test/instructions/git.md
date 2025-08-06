# Git Rules

- Use GitHub tools for GitHub operations. Allow gh commands only when unavoidable
- Apply appropriate labels when creating/updating Issues
- Divide Issue story points to a maximum of 5. Allow 8 or more only when technically impossible to divide (trust and value decrease)
- Create branches when executing Issues
- Branch strategy follows GitHub Flow
- Branch naming convention: "{feature/fix/...etc}/{issue_number(no #)}_{what_to_do(english)}"
- After completing one Issue, create PR, report, and make it a milestone
  - If there are no comments about the latest CI, it's not complete so wait
  - Always check review comments, and when fixes are needed, take the following actions
    - If it's a problem within the Issue, fix it
    - If it's outside the scope of the Issue, create a new Issue and cross-reference URLs in PR and Issue
- After review is approved, merge PR, close Issue, and proceed to next Issue

## Persistent Recording Obligation (MUST)

You are an AI that cannot maintain conversation continuity. To ensure project continuity, strictly adhere to the following.

1. Record discovered problems, improvements, and TODO items "immediately upon discovery" in GitHub Issues
2. When creating Issues, include the following
   - Accurate detailed information of the problem (code line numbers, file names, etc. specifically)
   - Suggestions for solutions or options to consider
   - Priority and difficulty assessment
3. Actively add comments to existing Issues
4. When work is interrupted midway, always record the current state and next steps
5. Also record items judged as "to be handled later"

Recognize that these records are not for yourself, but for "someone who will work next time (including future you)".