/**
 * Slug generation for public guide links.
 *
 * Each Property gets a single stable slug (stored in Property.publicSlug)
 * that always resolves to the latest published GuideVersion.
 */

import crypto from "crypto";
import { prisma } from "@/lib/db";

const SLUG_LENGTH = 8;
const SLUG_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const MAX_RETRIES = 5;

/** Generate a cryptographically random base62 slug. */
export function generateSlug(length: number = SLUG_LENGTH): string {
  const bytes = crypto.randomBytes(length);
  let slug = "";
  for (let i = 0; i < length; i++) {
    slug += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  }
  return slug;
}

/**
 * Ensure the property has a publicSlug. If it already has one, return it.
 * Otherwise generate one, retrying on unique-constraint collision (P2002).
 */
export async function ensurePropertySlug(propertyId: string): Promise<string> {
  const existing = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { publicSlug: true },
  });
  if (existing?.publicSlug) return existing.publicSlug;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const slug = generateSlug();
    try {
      await prisma.property.update({
        where: { id: propertyId },
        data: { publicSlug: slug },
      });
      return slug;
    } catch (err) {
      const isCollision =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: string }).code === "P2002";
      if (!isCollision) throw err;
      // Retry with a new slug
    }
  }
  throw new Error(`Failed to generate unique slug after ${MAX_RETRIES} attempts`);
}
