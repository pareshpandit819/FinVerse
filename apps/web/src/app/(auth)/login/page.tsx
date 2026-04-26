import { signIn } from "@/lib/auth";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-lg border p-8 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email to receive a secure sign-in link.
          </p>
        </div>

        {/* Magic link form */}
        <form
          action={async (formData: FormData) => {
            "use server";
            const params = await searchParams;
            await signIn("nodemailer", {
              email: formData.get("email"),
              redirectTo: params.callbackUrl ?? "/dashboard",
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Send sign-in link
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Google OAuth */}
        <form
          action={async () => {
            "use server";
            const params = await searchParams;
            await signIn("google", { redirectTo: params.callbackUrl ?? "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md border px-4 py-2 text-sm hover:bg-muted"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
