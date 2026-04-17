/**
 * Backfills `MediaAsset.contentHash` from R2's ETag. Safe to re-run — assets
 * that already have a `contentHash` are skipped.
 *
 * Why: the public media proxy caches bytes with `Cache-Control: immutable`
 * only when the URL embeds a content hash. Pre-backfill assets fall back to
 * a weaker revalidating policy until this runs.
 *
 * Usage:
 *   npx tsx scripts/backfill-media-content-hash.ts [--dry-run]
 *
 * R2 `ETag` is an MD5 hex for non-multipart uploads (which is what we use —
 * direct browser PUT via presigned URL). A future re-upload under the same
 * storageKey would produce a different ETag → a different URL.
 */

import { PrismaClient } from "@prisma/client";
import { headObject } from "../src/lib/services/media-storage.service";

interface Args {
  dryRun: boolean;
}

function parseArgs(): Args {
  return { dryRun: process.argv.includes("--dry-run") };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const prisma = new PrismaClient();

  const pending = await prisma.mediaAsset.findMany({
    where: { contentHash: null, status: "ready" },
    select: { id: true, storageKey: true },
  });

  console.log(
    `Found ${pending.length} asset(s) without contentHash${
      args.dryRun ? " (dry-run)" : ""
    }`,
  );

  let ok = 0;
  let failed = 0;

  for (const asset of pending) {
    try {
      const head = await headObject(asset.storageKey);
      if (!head || !head.etag) {
        console.warn(`asset ${asset.id}: missing ETag — skipping`);
        failed++;
        continue;
      }
      if (args.dryRun) {
        console.log(`[dry-run] ${asset.id} → ${head.etag}`);
      } else {
        await prisma.mediaAsset.update({
          where: { id: asset.id },
          data: { contentHash: head.etag },
        });
        console.log(`${asset.id} → ${head.etag}`);
      }
      ok++;
    } catch (err) {
      console.error(`asset ${asset.id} failed:`, err);
      failed++;
    }
  }

  console.log(`\nDone. updated=${ok} failed=${failed}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
