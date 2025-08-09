# Pull Request (PR) Creation Rules

## Basic (MUST)

1. PRs must be linked to Issues
   - Always include related Issue numbers in PR descriptions
   - Write Issue numbers with hash tags (e.g., `#123`)

2. PR titles must follow the format "#Issue_number: PR_content"
   - Example: `#123: Implementation of login screen`
   - Content should be specific and concise

3. PR descriptions must include the following
   - Overview: What, why, and how, described concisely
   - Changes: Detailed change points in list format
   - Related Issues: Related Issue numbers
   - Review points: Points you especially want reviewers to focus on

## Multiple PR Prohibition (MUST)

Creating multiple PRs simultaneously is prohibited.
Reasons: Merge conflicts occur, code review quality decreases, build/test environment load

1. Always maintain only one open PR
   - Before creating a new PR, confirm that existing PRs have been merged
   - If existing PRs are still open, complete those PRs first

2. Create one PR per Issue
   - Don't split one Issue into multiple PRs
   - For large Issues, split the Issues first before working on them

3. Exceptional cases requiring multiple PRs
   - Requires prior approval from team leader
   - Even when approved, clearly state the reason and references to related PRs in PR description

## Checklist

Please confirm the following before creating a PR:

- [ ] Has the code been tested locally?
- [ ] Is the code style unified?
- [ ] Have unnecessary comments and debug code been removed?
- [ ] Are there no existing open PRs (or are they completed)?
- [ ] Is the PR description sufficiently detailed?