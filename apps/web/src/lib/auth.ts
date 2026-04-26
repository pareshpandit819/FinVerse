import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { prisma } from "@repo/db/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Nodemailer({
      server: {
        host: process.env["SMTP_HOST"] ?? "localhost",
        port: Number(process.env["SMTP_PORT"] ?? 1025),
        auth:
          process.env["SMTP_USER"]
            ? { user: process.env["SMTP_USER"], pass: process.env["SMTP_PASS"] }
            : undefined,
        secure: process.env["SMTP_SECURE"] === "true",
      },
      from: process.env["EMAIL_FROM"] ?? "noreply@financialdashboard.local",
      maxAge: 15 * 60, // 15 minutes
    }),
    Google({
      clientId: process.env["GOOGLE_CLIENT_ID"] ?? "",
      clientSecret: process.env["GOOGLE_CLIENT_SECRET"] ?? "",
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  session: {
    strategy: "database",
    maxAge: 7 * 24 * 60 * 60,   // 7 days absolute
    updateAge: 8 * 60 * 60,      // refresh session cookie every 8 hours
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
    error: "/login/error",
  },
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;

      // Read mfaVerifiedAt from the session row in the database
      const dbSession = await prisma.session.findUnique({
        where: { sessionToken: session.sessionToken },
        select: { mfaVerifiedAt: true },
      });
      session.user.mfaVerified = dbSession?.mfaVerifiedAt != null;

      return session;
    },

    async signIn({ user, account }) {
      // Link an incoming Google OAuth account to an existing email-based user
      if (account?.provider === "google" && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
          include: { accounts: { where: { provider: "google" } } },
        });
        if (existingUser && existingUser.accounts.length === 0) {
          await prisma.account.create({
            data: {
              userId: existingUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              access_token: account.access_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
            },
          });
        }
      }
      return true;
    },
  },

  events: {
    async signIn({ user, isNewUser }) {
      if (isNewUser && user.email) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: new Date() },
        });
      }
    },
  },
});
