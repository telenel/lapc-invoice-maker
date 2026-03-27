import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username) return null;

        const input = credentials.username.trim();

        // 6-digit access code login
        if (/^\d{6}$/.test(input)) {
          const user = await prisma.user.findUnique({
            where: { accessCode: input, active: true },
          });
          if (!user) return null;
          return {
            id: user.id,
            name: user.name,
            username: user.username,
            role: user.role,
            needsSetup: user.needsSetup,
          };
        }

        // Traditional username/password login
        if (!credentials.password) return null;

        const user = await prisma.user.findUnique({
          where: { username: input, active: true },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
          needsSetup: user.needsSetup,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as unknown as { username: string }).username;
        token.role = (user as unknown as { role: string }).role;
        token.needsSetup = (user as unknown as { needsSetup: boolean }).needsSetup;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.id as string;
        (session.user as { username: string }).username =
          token.username as string;
        (session.user as { role: string }).role = token.role as string;
        (session.user as { needsSetup: boolean }).needsSetup = token.needsSetup as boolean;
      }
      return session;
    },
  },
};
