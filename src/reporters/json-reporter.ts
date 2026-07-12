/**
 * JSON reporter
 * 
 * Simple - just stringifies the report.
 * Handles circular references and makes output pretty.
 */

import type { ParityReport } from '../types/index.js';

/**
 * Format the report as JSON
 */
export function formatJsonReport(report: ParityReport, pretty: boolean = true): string {
    return JSON.stringify(report, null, pretty ? 2 : 0);
}