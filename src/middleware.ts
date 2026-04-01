import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    if (!token) return NextResponse.next();

    const setupComplete = token.setupComplete;
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
    "/((?!login|pricing-calculator|api/auth|api/setup|api/print-pricing|api/quotes/public|api/version|quotes/review/[^/]+$|quotes/payment/[^/]+$|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$|.*\\.svg$).*)",
  ],
};
