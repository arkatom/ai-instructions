#!/bin/bash

# Manual Release Script
# Usage: ./scripts/release.sh [patch|minor|major]

set -e

VERSION_TYPE=${1:-patch}

echo "🚀 Starting manual release process..."
echo "   Version bump type: $VERSION_TYPE"

# Check if on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "❌ Error: Releases must be performed from the main branch"
    echo "   Current branch: $CURRENT_BRANCH"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "❌ Error: Uncommitted changes detected"
    echo "   Please commit or stash changes before releasing"
    exit 1
fi

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Run tests
echo "🧪 Running tests..."
npm test

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 Current version: $CURRENT_VERSION"

# Bump version
echo "📝 Bumping version..."
npm version $VERSION_TYPE -m "chore(release): %s"

# Get new version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "✨ New version: $NEW_VERSION"

# Push changes
echo "📤 Pushing changes and tags..."
git push origin main
git push origin --tags

# Publish to npm
echo "📦 Publishing to npm..."
npm publish --access public

# Create GitHub release
echo "📋 Creating GitHub release..."
gh release create "v$NEW_VERSION" \
    --title "Release v$NEW_VERSION" \
    --notes "## 🚀 Release v$NEW_VERSION

This release includes updates to AI instructions and patterns.

### Installation
\`\`\`bash
npm install @arkatom/ai-instructions@$NEW_VERSION
\`\`\`

### Changes
See [commit history](https://github.com/arkatom/ai-instructions/compare/v$CURRENT_VERSION...v$NEW_VERSION) for detailed changes."

echo ""
echo "✅ Release v$NEW_VERSION completed successfully!"
echo ""
echo "📊 Summary:"
echo "   - Version bumped from $CURRENT_VERSION to $NEW_VERSION"
echo "   - Published to npm registry"
echo "   - GitHub release created"
echo "   - Tags pushed to repository"