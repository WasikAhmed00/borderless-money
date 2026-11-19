import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication (any role)
const protectedPaths = ["/admin"];
// Note: "/" (dashboard) is handled client-side via AuthContext to allow guest read-only view.
// If you want strict protection, add "/" to protectedPaths. For now we allow guest to see rates.

export function middleware(request: NextRequest) {
  const token = request.cookies.get("xpay_token")?.value;
  const pathname = request.nextUrl.pathname;

  // Check if path is admin and needs admin role (we only check token existence here; role check is client-side)
  // JWT role validation requires decoding; we do simple presence check and let client enforce role
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  if (isProtected && !token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If user is already authenticated and tries to visit /login, redirect to /
  if (pathname === "/login" && token) {
    // Let client handle role-based redirect, but optionally redirect to dashboard
    // We don't auto-redirect here to avoid loop; client AuthContext will handle
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
