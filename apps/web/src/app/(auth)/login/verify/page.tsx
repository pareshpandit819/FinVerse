export default function VerifyPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-4 rounded-lg border p-8 shadow-sm text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          A sign-in link has been sent to your email address. The link expires in 15 minutes.
        </p>
        <p className="text-xs text-muted-foreground">
          In development, check Mailhog at{" "}
          <a
            href="http://localhost:8025"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            localhost:8025
          </a>
        </p>
      </div>
    </main>
  );
}
