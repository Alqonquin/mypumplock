import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    // WHY: 30-day sessions — consumer product, not a banking app.
    // Users shouldn't have to re-login every few hours.
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    // WHY: Google provider is conditionally added — if env vars aren't set,
    // the app still works with email/password only.
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // WHY: For OAuth providers (Google, etc.), auto-create a user record
      // in our DB if one doesn't exist yet. This lets OAuth users get a
      // PumpLock account without a separate signup step.
      if (account?.provider === "google" && user.email) {
        const email = user.email.toLowerCase().trim();
        const existing = await prisma.user.findUnique({ where: { email } });
        if (!existing) {
          await prisma.user.create({
            data: {
              email,
              // WHY: OAuth users don't have a password — set a random hash
              // so the field is never empty but can't be used to log in.
              passwordHash: await bcrypt.hash(crypto.randomUUID(), 10),
              name: user.name || null,
            },
          });
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      // WHY: Attach role to JWT so we can check admin access
      // without a DB query on every request.
      if (user) {
        // For OAuth sign-ins, look up role from DB since it's not on the OAuth user object
        if (account?.provider !== "credentials") {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email!.toLowerCase().trim() },
            select: { id: true, role: true },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
          }
        } else {
          token.role = (user as unknown as { role: string }).role;
          token.id = user.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string; role: string }).id = token.id as string;
        (session.user as { id: string; role: string }).role = token.role as string;
      }
      return session;
    },
  },
};
