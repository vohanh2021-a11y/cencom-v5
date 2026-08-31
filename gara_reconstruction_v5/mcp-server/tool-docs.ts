/**
 * mcp-server/tool-docs.ts — Aggregate tool descriptions from 3 part files
 *
 * This file is the SINGLE source of truth for MCP tool docs.
 * Missing any fn → index.ts throws at startup (docs-completeness gate).
 *
 * Part files (part1/2/3) contain the actual descriptions.
 * This file merges them into TOOL_DOCS.
 */

import { PART1 } from './tool-docs.part1';
import { PART2 } from './tool-docs.part2';
import { PART3 } from './tool-docs.part3';
import { PART4 } from './tool-docs.part4';

export interface ToolDoc {
  title: string;
  descVi: string;
  descEn: string;
  mode: 'READ' | 'WRITE';
  /** Example args — chỉ khai báo nếu fn cần tham số bắt buộc */
  example?: Record<string, unknown>;
}

export type ToolDocs = Record<string, ToolDoc>;

export const TOOL_DOCS: ToolDocs = { ...PART1, ...PART2, ...PART3, ...PART4 };
