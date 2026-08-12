import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseMiddlewareClient } from "@/modules/lib/supabase/middleware";

/**
 * Route prefixes that require an authenticated session.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/listings/new",
  "/my-listings",
  "/my-flyers",
  "/transactions",
  "/messaging",
  "/favorites",
  "/settings",
];

export async function proxy(request: NextRequest) {
  const { supabase, response } =
    await createSupabaseMiddlewareClient(request);

  let user = null;
  if (supabase) {
    // Refresh session if expired — required by createServerClient.
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();
    user = sessionUser;
  }

  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === "/sign-in" || pathname === "/sign-up")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  // Always run user checks so expired sessions refresh their cookie.
  await supabase?.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and images.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

