import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const setupComplete = req.nextauth.token?.setupComplete;
    const isSetupPage = req.nextUrl.pathname === "/setup";

    if (!setupComplete && !isSetupPage) {
      return NextResponse.redirect(new URL("/setup", req.url));
    }
    if (setupComplete && isSetupPage) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: [
    "/((?!login|api/auth|api/setup|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$|.*\\.svg$).*)",
  ],
};
