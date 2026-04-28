import { readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

export function walk(dir: string, exts: string[], acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".") || entry === "node_modules") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, exts, acc);
    else if (exts.includes(extname(entry))) acc.push(full);
  }
  return acc;
}
