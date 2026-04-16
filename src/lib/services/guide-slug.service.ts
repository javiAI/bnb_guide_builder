/**
 * Slug generation for public guide links.
 *
 * Each Property gets a single stable slug (stored in Property.publicSlug)
 * that always resolves to the latest published GuideVersion.
 */

import crypto from "crypto";
import { prisma } from "@/lib/db";
import { isPrismaUniqueViolation } from "@/lib/utils";

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
      const result = await prisma.$transaction(async (tx) => {
        // Atomic: only set slug when currently NULL — prevents race where two
        // callers both read null and each write a different slug.
        const updated = await tx.property.updateMany({
          where: { id: propertyId, publicSlug: null },
          data: { publicSlug: slug },
        });
        if (updated.count === 1) return slug;

        // Another caller won the race — return their slug
        const current = await tx.property.findUnique({
          where: { id: propertyId },
          select: { publicSlug: true },
        });
        if (current?.publicSlug) return current.publicSlug;

        throw new Error(`Property ${propertyId} not found`);
      });
      return result;
    } catch (err) {
      if (!isPrismaUniqueViolation(err)) throw err;
    }
  }
  throw new Error(`Failed to generate unique slug after ${MAX_RETRIES} attempts`);
}
