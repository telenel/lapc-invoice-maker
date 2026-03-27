import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const needsSetup = req.nextauth.token?.needsSetup;
    const isSetupPage = req.nextUrl.pathname === "/setup";

    if (needsSetup && !isSetupPage) {
      return NextResponse.redirect(new URL("/setup", req.url));
    }
    if (!needsSetup && isSetupPage) {
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
    "/((?!login|api/auth|api/auth/setup|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$|.*\\.svg$).*)",
  ],
};
