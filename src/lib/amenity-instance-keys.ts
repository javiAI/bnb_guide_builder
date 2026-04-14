/**
 * amenity-instance-keys.ts — pure helpers for the canonical instanceKey
 * convention. Kept dependency-free (no Prisma / no db import) so it can
 * be used from scripts without instantiating the app's PrismaClient
 * singleton.
 *
 * Convention:
 *   - spaceId = null   → instanceKey = "default"
 *   - spaceId = "cuid" → instanceKey = "space:cuid"
 */

export function instanceKeyFor(spaceId: string | null): string {
  return spaceId ? `space:${spaceId}` : "default";
}

export function spaceIdFromInstanceKey(instanceKey: string): string | null {
  if (instanceKey === "default") return null;
  if (instanceKey.startsWith("space:")) {
    const spaceId = instanceKey.slice("space:".length);
    return spaceId.length > 0 ? spaceId : null;
  }
  return null;
}

export function isCanonicalInstanceKey(instanceKey: string): boolean {
  if (instanceKey === "default") return true;
  if (!instanceKey.startsWith("space:")) return false;
  return instanceKey.length > "space:".length;
}
