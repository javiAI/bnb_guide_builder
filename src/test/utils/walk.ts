import { readdirSync } from "node:fs";
import { join, extname } from "node:path";

export function walk(dir: string, exts: string[], acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, acc);
    else if (exts.includes(extname(entry.name))) acc.push(full);
  }
  return acc;
}
