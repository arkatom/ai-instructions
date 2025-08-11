/**
 * Type definitions for execSync error handling
 */

export interface ExecException extends Error {
  status: number;
  signal: NodeJS.Signals | null;
  stdout: Buffer | string;
  stderr: Buffer | string;
  pid?: number;
  output?: Array<Buffer | string>;
}
