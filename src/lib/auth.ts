import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit } from "./rate-limit";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
        rememberMe: { label: "Remember Me", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) return null;

        const ip =
          req?.headers?.["x-forwarded-for"]?.toString().split(",")[0].trim() ??
          "unknown";
        const rateLimitKey = `login:${ip}:${credentials.username.trim().toLowerCase()}`;
        const { allowed } = checkRateLimit(rateLimitKey);
        if (!allowed) {
          throw new Error("Too many login attempts. Please try again later.");
        }

        const user = await prisma.user.findFirst({
          where: { username: credentials.username.trim().toLowerCase(), active: true },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
          setupComplete: user.setupComplete,
          rememberMe: credentials.rememberMe === "true",
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.username = (user as unknown as { username: string }).username;
        token.role = (user as unknown as { role: string }).role;
        token.setupComplete = (user as unknown as { setupComplete: boolean }).setupComplete;
        // rememberMe is passed from the client via the credentials object
        const rememberMe = (user as unknown as { rememberMe?: boolean }).rememberMe;
        token.maxAge = rememberMe ? 90 * 24 * 60 * 60 : 24 * 60 * 60;
      }
      if (trigger === "update" || !token.maxAge) {
        token.maxAge = token.maxAge ?? 30 * 24 * 60 * 60;
      } else if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, setupComplete: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.setupComplete = dbUser.setupComplete;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.id as string;
        (session.user as { username: string }).username = token.username as string;
        (session.user as { role: string }).role = token.role as string;
        (session.user as { setupComplete: boolean }).setupComplete = token.setupComplete as boolean;
      }
      return session;
    },
  },
};
