# Build Optimization

## Caching Strategies

```yaml
# .github/workflows/optimized-build.yml
name: Optimized Build Pipeline

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # Multi-layer caching
      - name: Cache Node.js dependencies
        uses: actions/cache@v4
        with:
          path: |
            ~/.npm
            node_modules
          key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-node-
      
      - name: Cache build artifacts
        uses: actions/cache@v4
        with:
          path: |
            dist
            .next/cache
          key: ${{ runner.os }}-build-${{ github.sha }}
          restore-keys: |
            ${{ runner.os }}-build-
      
      - name: Incremental build
        run: |
          npm ci --prefer-offline --no-audit
          npm run build:incremental
```

## Docker Layer Optimization

```dockerfile
# Optimized Multi-stage Dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS deps
RUN npm ci --only=production && npm cache clean --force

FROM base AS build-deps
RUN npm ci && npm cache clean --force

FROM build-deps AS build
COPY . .
RUN npm run build

FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

# Use buildkit for layer caching
# docker build --build-arg BUILDKIT_INLINE_CACHE=1 .
```

## Parallel Build Execution

```javascript
// build-scripts/parallel-builder.js
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');

class ParallelBuilder {
  constructor(tasks, maxWorkers = require('os').cpus().length) {
    this.tasks = tasks;
    this.maxWorkers = maxWorkers;
    this.results = [];
  }

  async build() {
    const workers = [];
    const taskChunks = this.chunkTasks(this.tasks, this.maxWorkers);
    
    for (const chunk of taskChunks) {
      const worker = new Worker(__filename, {
        workerData: { tasks: chunk }
      });
      
      workers.push(new Promise((resolve, reject) => {
        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => {
          if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
        });
      }));
    }
    
    const results = await Promise.all(workers);
    return results.flat();
  }

  chunkTasks(tasks, chunkSize) {
    const chunks = [];
    for (let i = 0; i < tasks.length; i += chunkSize) {
      chunks.push(tasks.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

// Worker thread execution
if (!isMainThread) {
  const { tasks } = workerData;
  const results = tasks.map(task => {
    // Execute build task
    console.log(`Building: ${task.name}`);
    return { name: task.name, status: 'completed' };
  });
  
  parentPort.postMessage(results);
}

module.exports = ParallelBuilder;
```

## Smart Dependency Management

```yaml
# Selective dependency installation
dependency_optimization:
  production_only:
    - "npm ci --only=production"
    - "pip install --no-dev"
    - "go mod download"
  
  conditional_install:
    script: |
      # Only install changed dependencies
      if ! cmp -s package-lock.json.old package-lock.json; then
        npm ci
        cp package-lock.json package-lock.json.old
      else
        echo "Dependencies unchanged, skipping install"
      fi
  
  workspace_optimization:
    script: |
      # Nx/Lerna workspace optimization
      npx nx affected:build --base=origin/main --head=HEAD
      npx lerna run build --since origin/main
```

## Build Artifact Optimization

```javascript
// webpack.prod.js
const path = require('path');
const CompressionPlugin = require('compression-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  mode: 'production',
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          maxSize: 244000 // 244KB chunks
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          enforce: true
        }
      }
    },
    usedExports: true,
    sideEffects: false
  },
  
  plugins: [
    new CompressionPlugin({
      filename: '[path][base].gz',
      algorithm: 'gzip',
      test: /\.(js|css|html|svg)$/,
      threshold: 8192,
      minRatio: 0.8
    }),
    
    process.env.ANALYZE && new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false
    })
  ].filter(Boolean)
};
```

## Build Monitoring System

```typescript
interface BuildMetrics {
  buildId: string;
  duration: number;
  cacheHitRate: number;
  artifactSizes: Record<string, number>;
  resourceUsage: {
    cpu: number;
    memory: number;
    disk: number;
  };
}

class BuildMonitor {
  private metrics: BuildMetrics[] = [];

  async trackBuild(buildFn: () => Promise<void>): Promise<BuildMetrics> {
    const buildId = `build-${Date.now()}`;
    const startTime = Date.now();
    const startResources = await this.getResourceUsage();
    
    await buildFn();
    
    const endTime = Date.now();
    const endResources = await this.getResourceUsage();
    
    const metrics: BuildMetrics = {
      buildId,
      duration: endTime - startTime,
      cacheHitRate: await this.calculateCacheHitRate(),
      artifactSizes: await this.getArtifactSizes(),
      resourceUsage: {
        cpu: endResources.cpu - startResources.cpu,
        memory: endResources.memory - startResources.memory,
        disk: endResources.disk - startResources.disk
      }
    };
    
    this.metrics.push(metrics);
    await this.reportMetrics(metrics);
    return metrics;
  }

  generateOptimizationReport(): string {
    const avgDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0) / this.metrics.length;
    const avgCacheHit = this.metrics.reduce((sum, m) => sum + m.cacheHitRate, 0) / this.metrics.length;
    
    return `
Build Performance Report:
- Average Duration: ${(avgDuration / 1000).toFixed(2)}s
- Average Cache Hit Rate: ${avgCacheHit.toFixed(2)}%
- Slowest Builds: ${this.getSlowestBuilds(5)}
- Optimization Suggestions: ${this.generateSuggestions()}
    `;
  }
}
```

## Resource Management

```yaml
# Resource-aware build configuration
build_resources:
  small_builds:
    runners: ubuntu-latest
    timeout: 10
    memory: 3500  # MB
    
  large_builds:
    runners: ubuntu-latest-4-cores
    timeout: 30
    memory: 14000  # MB
    
  matrix_optimization:
    strategy:
      fail-fast: false
      max-parallel: 3  # Prevent resource exhaustion
      matrix:
        include:
          - node-version: 18.x
            os: ubuntu-latest
            build-target: "lightweight"
          - node-version: 20.x
            os: ubuntu-latest
            build-target: "standard"
```

## Best Practices

1. **Layer Caching**: Optimize Docker layers, place changing files last
2. **Selective Builds**: Use affected-only builds in monorepos
3. **Parallel Execution**: Run independent tasks concurrently
4. **Smart Caching**: Cache at multiple levels (deps, builds, tests)
5. **Resource Management**: Right-size runners for build complexity
6. **Artifact Optimization**: Compress and split bundles efficiently
7. **Monitoring**: Track metrics to identify optimization opportunities