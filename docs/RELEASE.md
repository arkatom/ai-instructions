# Release Process

## 🚀 Overview

This project uses GitHub Flow with automated releases triggered by merges to the main branch.

## 🔄 Automated Release Workflow

### Trigger Conditions
Releases are automatically triggered when:
- Code is pushed to the `main` branch
- Changes affect any of:
  - `templates/**`
  - `instructions/**`
  - `src/**`
  - `package.json`

### Automatic Process
1. **Tests Run** - All tests must pass
2. **Version Bump** - Automatic patch version increment
3. **npm Publish** - Package published to npm registry
4. **GitHub Release** - Release created with auto-generated notes
5. **Notifications** - Success/failure status reported

## 📦 Manual Release

If needed, you can trigger a manual release:

### Using npm Scripts
```bash
# Patch release (0.0.x)
npm run release:patch

# Minor release (0.x.0)
npm run release:minor

# Major release (x.0.0)
npm run release:major

# Dry run (no actual release)
npm run release:dry-run
```

### Using Release Script
```bash
# Default patch release
./scripts/release.sh

# Specific version bump
./scripts/release.sh minor
./scripts/release.sh major
```

## 🧪 Testing Releases

### Dry Run Workflow
Test the release process without making actual changes:

1. **Via Pull Request**: Any PR that modifies workflow files triggers a dry run
2. **Manual Trigger**: Use GitHub Actions UI to trigger `Release Dry Run` workflow

### What Gets Tested
- Version bump calculation
- npm publish simulation
- Release notes generation
- All tests pass

## 🔒 Required Secrets

Configure these in GitHub repository settings:

| Secret | Description | Required |
|--------|-------------|----------|
| `NPM_TOKEN` | npm authentication token | Yes |
| `GITHUB_TOKEN` | Automatically provided | Yes |

## 📋 Version Strategy

- **Patch** (0.0.x): Bug fixes, documentation updates
- **Minor** (0.x.0): New features, backward compatible changes
- **Major** (x.0.0): Breaking changes

## 🚦 Release Checklist

Before merging to main:
- [ ] All tests passing
- [ ] Documentation updated
- [ ] PR reviewed and approved
- [ ] Version type determined (patch/minor/major)

## 🔧 Troubleshooting

### Release Failed
1. Check GitHub Actions logs
2. Verify NPM_TOKEN is set correctly
3. Ensure no version conflicts
4. Manual release using script if needed

### Rollback
```bash
# Deprecate bad version
npm deprecate @arkatom/ai-instructions@VERSION "Deprecated due to issue"

# Publish previous version as latest
git checkout PREVIOUS_TAG
npm publish
```

## 📊 Release History

View all releases:
- [GitHub Releases](https://github.com/arkatom/ai-instructions/releases)
- [npm Versions](https://www.npmjs.com/package/@arkatom/ai-instructions?activeTab=versions)