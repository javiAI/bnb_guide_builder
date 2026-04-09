import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Compatibility redirects per MASTER_IMPLEMENTATION_SPEC §4.
 *
 * Legacy aliases → canonical routes:
 *   /properties                              → /
 *   /properties/:id/overview                 → /properties/:id
 *   /properties/:id/wizard/*                 → corresponding module
 *   /properties/:id/preview/guest            → /properties/:id/guest-guide
 *   /properties/:id/preview/ai               → /properties/:id/ai
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /properties (exact) → /
  if (pathname === "/properties" || pathname === "/properties/") {
    return NextResponse.redirect(new URL("/", request.url), 308);
  }

  // /properties/:id/overview → /properties/:id
  const overviewMatch = pathname.match(
    /^\/properties\/([^/]+)\/overview\/?$/,
  );
  if (overviewMatch) {
    return NextResponse.redirect(
      new URL(`/properties/${overviewMatch[1]}`, request.url),
      308,
    );
  }

  // /properties/:id/preview/guest → /properties/:id/guest-guide
  const previewGuestMatch = pathname.match(
    /^\/properties\/([^/]+)\/preview\/guest\/?$/,
  );
  if (previewGuestMatch) {
    return NextResponse.redirect(
      new URL(`/properties/${previewGuestMatch[1]}/guest-guide`, request.url),
      308,
    );
  }

  // /properties/:id/preview/ai → /properties/:id/ai
  const previewAiMatch = pathname.match(
    /^\/properties\/([^/]+)\/preview\/ai\/?$/,
  );
  if (previewAiMatch) {
    return NextResponse.redirect(
      new URL(`/properties/${previewAiMatch[1]}/ai`, request.url),
      308,
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/properties",
    "/properties/",
    "/properties/:path*/overview",
    "/properties/:path*/preview/:subpath*",
  ],
};
