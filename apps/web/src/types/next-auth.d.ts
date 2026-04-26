import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    // Present when strategy: "database"
    sessionToken?: string;
    user: {
      id: string;
      mfaVerified: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    mfaVerified?: boolean;
  }
}
