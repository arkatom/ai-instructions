/**
 * Pattern Selection System Types
 * Interface definitions for the interactive pattern selector
 */

export interface PatternCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface PatternFile {
  id: string;
  name: string;
  description: string;
  path: string;
  category: string;
  tags: string[];
  language: 'ja' | 'en';
  lineCount: number;
}

export interface PatternDirectory {
  id: string;
  name: string;
  description: string;
  path: string;
  category: string;
  files: PatternFile[];
  indexFile?: PatternFile;
  language: 'ja' | 'en';
}

export interface UserPreferences {
  language: 'ja' | 'en';
  lastCategory?: string;
  lastPattern?: string;
  openMethod: 'code' | 'cat' | 'less' | 'browser';
}

export interface PatternCommandArgs {
  command: 'patterns';
  subcommand?: 'select' | 'list' | 'search' | 'preferences';
  language?: 'ja' | 'en';
  category?: string;
  pattern?: string;
  query?: string;
  format?: 'table' | 'tree' | 'json';
  open?: boolean;
  reset?: boolean;
  [key: string]: unknown;
}

export interface PatternSearchResult {
  pattern: PatternFile | PatternDirectory;
  score: number;
  matches: string[];
}

export const PATTERN_CATEGORIES: PatternCategory[] = [
  { id: 'languages', name: '言語別パターン', description: 'JavaScript, TypeScript, Python など', icon: '💻' },
  { id: 'architecture', name: 'アーキテクチャ', description: 'Clean, DDD, Microservices など', icon: '🏗️' },
  { id: 'libraries', name: 'ライブラリ・フレームワーク', description: 'React, Django, FastAPI など', icon: '📚' },
  { id: 'frontend', name: 'フロントエンド', description: 'CSS, UI/UX, レスポンシブなど', icon: '🎨' },
  { id: 'development', name: '開発プロセス', description: 'CI/CD, テスト, レビューなど', icon: '⚙️' },
  { id: 'security', name: 'セキュリティ', description: '認証認可、脆弱性対策など', icon: '🔒' },
  { id: 'performance', name: 'パフォーマンス', description: 'キャッシュ、最適化など', icon: '⚡' },
  { id: 'data', name: 'データ処理', description: 'ETL, ストリーミングなど', icon: '📊' },
  { id: 'infrastructure', name: 'インフラ・デプロイ', description: 'Docker, Kubernetes など', icon: '🚀' },
  { id: 'ai', name: 'AI・機械学習', description: 'LLM, プロンプトエンジニアリング', icon: '🤖' }
];