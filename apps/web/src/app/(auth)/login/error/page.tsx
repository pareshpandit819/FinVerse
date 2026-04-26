const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "You do not have permission to sign in.",
  Verification: "The sign-in link is invalid or has expired. Please request a new one.",
  Default: "An error occurred during sign in. Please try again.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const message = ERROR_MESSAGES[params.error ?? "Default"] ?? ERROR_MESSAGES["Default"];

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-4 rounded-lg border p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Sign-in error</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <a
          href="/login"
          className="inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Back to sign in
        </a>
      </div>
    </main>
  );
}
