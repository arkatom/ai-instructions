#!/bin/bash

# Manual Release Script with Error Recovery
# Usage: ./scripts/release.sh [patch|minor|major]

set -e

VERSION_TYPE=${1:-patch}

echo "🚀 Starting manual release process..."
echo "   Version bump type: $VERSION_TYPE"

# Check dependencies
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed."; exit 1; }
command -v git >/dev/null 2>&1 || { echo "❌ git is required but not installed."; exit 1; }
command -v gh >/dev/null 2>&1 || { echo "❌ GitHub CLI (gh) is required but not installed. Install from: https://cli.github.com/"; exit 1; }

# Check if gh is authenticated
gh auth status >/dev/null 2>&1 || { echo "❌ GitHub CLI is not authenticated. Run: gh auth login"; exit 1; }

# Store original state for rollback
ORIGINAL_COMMIT=$(git rev-parse HEAD)
ORIGINAL_VERSION=$(node -p "require('./package.json').version")

# Cleanup function for error recovery
cleanup() {
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "❌ Release failed with exit code $EXIT_CODE"
    echo "🔄 Rolling back changes..."
    
    # Try to delete the tag if it was created
    NEW_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "$ORIGINAL_VERSION")
    if [ "$NEW_VERSION" != "$ORIGINAL_VERSION" ]; then
      git tag -d "v$NEW_VERSION" 2>/dev/null || true
      git push origin ":refs/tags/v$NEW_VERSION" 2>/dev/null || true
    fi
    
    # Reset to original commit
    git reset --hard $ORIGINAL_COMMIT
    echo "✅ Rolled back to original state"
    echo "   Original version: $ORIGINAL_VERSION"
    echo "   Original commit: $ORIGINAL_COMMIT"
  fi
}
trap cleanup EXIT

# Check if on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "❌ Error: Releases must be performed from the main branch"
    echo "   Current branch: $CURRENT_BRANCH"
    echo "   Run: git checkout main"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "❌ Error: Uncommitted changes detected"
    echo "   Please commit or stash changes before releasing"
    git status --short
    exit 1
fi

# Check NPM authentication
echo "🔐 Verifying npm authentication..."
npm whoami >/dev/null 2>&1 || {
    echo "❌ Error: Not logged in to npm"
    echo "   Run: npm login"
    exit 1
}

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main --ff-only || {
    echo "❌ Error: Failed to pull latest changes"
    echo "   Your local branch may have diverged from origin/main"
    exit 1
}

# Run tests
echo "🧪 Running tests..."
npm test || {
    echo "❌ Error: Tests failed"
    echo "   Fix failing tests before releasing"
    exit 1
}

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 Current version: $CURRENT_VERSION"

# Validate version type
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo "❌ Error: Invalid version type: $VERSION_TYPE"
    echo "   Valid types: patch, minor, major"
    exit 1
fi

# Bump version (without postversion hook to avoid conflicts)
echo "📝 Bumping version..."
npm config set ignore-scripts true
npm version $VERSION_TYPE --no-git-tag-version
npm config set ignore-scripts false

# Get new version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "✨ New version: $NEW_VERSION"

# Create commit and tag manually
git add package.json package-lock.json
git commit -m "chore(release): $NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

# Push changes with retry logic
echo "📤 Pushing changes and tags..."
PUSH_SUCCESS=false
for i in {1..3}; do
    if git push origin main && git push origin "v$NEW_VERSION"; then
        PUSH_SUCCESS=true
        echo "✅ Successfully pushed changes"
        break
    elif [ $i -eq 3 ]; then
        echo "❌ Failed to push after 3 attempts"
        exit 1
    else
        echo "⚠️ Push attempt $i failed, retrying in 5 seconds..."
        sleep 5
        git pull --rebase origin main || true
    fi
done

if [ "$PUSH_SUCCESS" = false ]; then
    echo "❌ Failed to push changes"
    exit 1
fi

# Publish to npm with verification
echo "📦 Publishing to npm..."
npm publish --access public || {
    echo "❌ Error: npm publish failed"
    echo "   The git tag has been created but npm publish failed"
    echo "   You may need to manually publish with: npm publish"
    exit 1
}

# Verify npm publication
echo "🔍 Verifying npm publication..."
sleep 3
npm view "@arkatom/ai-instructions@$NEW_VERSION" version >/dev/null 2>&1 || {
    echo "⚠️ Warning: Package not immediately visible on npm"
    echo "   This is normal - npm registry can take a few minutes to update"
}

# Generate changelog for GitHub release
echo "📋 Generating release notes..."
LAST_TAG=$(git describe --tags --abbrev=0 "v$NEW_VERSION^" 2>/dev/null || echo "")
if [ -n "$LAST_TAG" ]; then
    CHANGELOG=$(git log "$LAST_TAG..v$NEW_VERSION" --pretty=format:"- %s" --no-merges | grep -v "^- chore(release):" || echo "")
else
    CHANGELOG=$(git log "v$NEW_VERSION" --pretty=format:"- %s" --no-merges --max-count=20 | grep -v "^- chore(release):" || echo "")
fi

if [ -z "$CHANGELOG" ]; then
    CHANGELOG="- Various improvements and updates"
fi

# Create GitHub release
echo "📋 Creating GitHub release..."
gh release create "v$NEW_VERSION" \
    --title "Release v$NEW_VERSION" \
    --notes "## 🚀 Release v$NEW_VERSION

This release includes updates to AI instructions and patterns.

### 📝 Changes
$CHANGELOG

### 📦 Installation
\`\`\`bash
npm install @arkatom/ai-instructions@$NEW_VERSION
\`\`\`

### 🔗 Links
- [NPM Package](https://www.npmjs.com/package/@arkatom/ai-instructions/v/$NEW_VERSION)
- [Changelog](https://github.com/arkatom/ai-instructions/compare/v$CURRENT_VERSION...v$NEW_VERSION)" || {
    echo "⚠️ Warning: Failed to create GitHub release"
    echo "   The package has been published to npm but GitHub release creation failed"
    echo "   You can manually create the release at: https://github.com/arkatom/ai-instructions/releases/new"
}

# Clear the trap since we succeeded
trap - EXIT

echo ""
echo "✅ Release v$NEW_VERSION completed successfully!"
echo ""
echo "📊 Summary:"
echo "   - Version bumped from $CURRENT_VERSION to $NEW_VERSION"
echo "   - Published to npm registry"
echo "   - GitHub release created"
echo "   - Tags pushed to repository"