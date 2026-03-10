import type { ParsedArgs } from "../args.ts";
import { getBoolean } from "../args.ts";
import { getApiToken, loadConfig } from "../config.ts";

export async function requireToken(): Promise<string> {
  const token = await getApiToken();
  if (!token) {
    console.error("Error: Not authenticated. Run 'linear auth login' first.");
    process.exit(1);
  }
  return token;
}

export async function useJson(parsed: ParsedArgs): Promise<boolean> {
  if (getBoolean(parsed, "json")) return true;
  const config = await loadConfig();
  return config.outputFormat === "json";
}

export function pad(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return dateStr.slice(0, 10);
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return `${str.slice(0, len - 3)}...`;
}

export function printTable(headers: string[], rows: string[][]): void {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
  );

  console.log(headers.map((h, i) => pad(h, widths[i] ?? 0)).join("  "));
  for (const row of rows) {
    console.log(row.map((cell, i) => pad(cell, widths[i] ?? 0)).join("  "));
  }
}
