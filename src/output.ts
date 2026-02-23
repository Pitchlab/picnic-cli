import { getConfig } from "./config.js";
import type { OutputFormat } from "./types.js";

/**
 * Resolve output format from commander opts.
 * --json wins over --table, both win over config default.
 */
export function resolveFormat(opts: { json?: boolean; table?: boolean }): OutputFormat {
  if (opts.json) return "json";
  if (opts.table) return "table";
  return getConfig().defaultOutput;
}

/**
 * Universal output dispatcher. Every command calls this.
 */
export function output<T>(
  data: T,
  format: OutputFormat,
  prettyFn?: (data: T) => string,
  tableFn?: (data: T) => string,
): void {
  switch (format) {
    case "json":
      process.stdout.write(JSON.stringify(data, null, 2) + "\n");
      break;
    case "table":
      console.log(tableFn ? tableFn(data) : JSON.stringify(data, null, 2));
      break;
    case "pretty":
      console.log(prettyFn ? prettyFn(data) : JSON.stringify(data, null, 2));
      break;
  }
}
