import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  trustHost: true,
  callbacks: {
    signIn({ profile }) {
      return Boolean(
        process.env.AUTH_ALLOWED_GITHUB_ID &&
        String(profile?.id) === process.env.AUTH_ALLOWED_GITHUB_ID,
      );
    },
  },
  pages: { signIn: "/login", error: "/login" },
});
