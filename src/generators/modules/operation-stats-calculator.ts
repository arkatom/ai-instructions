/**
 * Operation statistics calculator for parallel processing
 * Extracted from parallel-generator.ts for modular architecture
 * Issue #91: Modular refactoring - OperationStatsCalculator
 */

import { type FileOperationTask, type FileOperationResult, type ParallelOperationStats } from '../parallel-generator';

/**
 * Calculator responsible for computing statistics from parallel operation results
 * Handles success/failure rates, timing metrics, and performance analysis
 */
export class OperationStatsCalculator {
  /**
   * Calculate comprehensive statistics from parallel operation results
   */
  calculateStatistics(
    tasks: ReadonlyArray<FileOperationTask>,
    results: FileOperationResult[],
    totalExecutionTime: number,
    concurrency: number
  ): ParallelOperationStats {
    const successfulTasks = results.filter(r => r.success).length;
    const failedTasks = results.filter(r => !r.success).length;
    const totalTaskTime = results.reduce((sum, r) => sum + r.executionTimeMs, 0);
    const averageTaskTime = results.length > 0 ? totalTaskTime / results.length : 0;
    
    return {
      totalTasks: tasks.length,
      successfulTasks,
      failedTasks,
      totalExecutionTimeMs: totalExecutionTime,
      averageTaskTimeMs: averageTaskTime,
      concurrency
    };
  }

  /**
   * Create empty statistics for edge cases
   */
  createEmptyStats(concurrency: number): ParallelOperationStats {
    return {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      totalExecutionTimeMs: 0,
      averageTaskTimeMs: 0,
      concurrency
    };
  }

  /**
   * Merge multiple statistics into a combined result
   */
  mergeStats(
    stats1: ParallelOperationStats,
    stats2: ParallelOperationStats
  ): ParallelOperationStats {
    const totalTasks = stats1.totalTasks + stats2.totalTasks;
    const successfulTasks = stats1.successfulTasks + stats2.successfulTasks;
    const failedTasks = stats1.failedTasks + stats2.failedTasks;
    const totalExecutionTime = stats1.totalExecutionTimeMs + stats2.totalExecutionTimeMs;
    
    // Calculate weighted average for task time
    const totalTaskTime = (stats1.averageTaskTimeMs * stats1.totalTasks) + 
                         (stats2.averageTaskTimeMs * stats2.totalTasks);
    const averageTaskTime = totalTasks > 0 ? totalTaskTime / totalTasks : 0;
    
    return {
      totalTasks,
      successfulTasks,
      failedTasks,
      totalExecutionTimeMs: totalExecutionTime,
      averageTaskTimeMs: averageTaskTime,
      concurrency: Math.max(stats1.concurrency, stats2.concurrency) // Use higher concurrency
    };
  }

  /**
   * Calculate efficiency metrics from statistics
   */
  calculateEfficiencyMetrics(stats: ParallelOperationStats): {
    successRate: number;
    failureRate: number;
    tasksPerSecond: number;
    parallelEfficiency: number;
  } {
    const successRate = stats.totalTasks > 0 ? stats.successfulTasks / stats.totalTasks : 0;
    const failureRate = stats.totalTasks > 0 ? stats.failedTasks / stats.totalTasks : 0;
    const tasksPerSecond = stats.totalExecutionTimeMs > 0 ? 
      (stats.totalTasks * 1000) / stats.totalExecutionTimeMs : 0;
    
    // Parallel efficiency: ratio of ideal parallel time to actual time
    const idealSequentialTime = stats.averageTaskTimeMs * stats.totalTasks;
    const parallelEfficiency = idealSequentialTime > 0 && stats.totalExecutionTimeMs > 0 ?
      (idealSequentialTime / stats.concurrency) / stats.totalExecutionTimeMs : 0;
    
    return {
      successRate,
      failureRate,
      tasksPerSecond,
      parallelEfficiency: Math.min(parallelEfficiency, 1.0) // Cap at 100%
    };
  }

  /**
   * Generate performance summary from statistics
   */
  generatePerformanceSummary(stats: ParallelOperationStats): string {
    const metrics = this.calculateEfficiencyMetrics(stats);
    
    return [
      `Tasks: ${stats.totalTasks} (${stats.successfulTasks} successful, ${stats.failedTasks} failed)`,
      `Success Rate: ${(metrics.successRate * 100).toFixed(1)}%`,
      `Total Time: ${stats.totalExecutionTimeMs.toFixed(0)}ms`,
      `Average Task Time: ${stats.averageTaskTimeMs.toFixed(1)}ms`,
      `Tasks/Second: ${metrics.tasksPerSecond.toFixed(1)}`,
      `Parallel Efficiency: ${(metrics.parallelEfficiency * 100).toFixed(1)}%`,
      `Concurrency: ${stats.concurrency}`
    ].join('\n');
  }
}