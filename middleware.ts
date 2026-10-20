import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublic = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/sso-callback(.*)"]);
const isAuthPage = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublic(req)) {
    // Already signed in → skip the login screen (but let invitation tickets through).
    const { userId } = await auth();
    if (userId && isAuthPage(req) && !req.nextUrl.searchParams.has("__clerk_ticket")) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return;
  }
  await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
