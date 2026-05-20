import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col items-start justify-center gap-6 px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Ligala</h1>
      <p className="text-lg text-neutral-600">
        Philippine legal services platform.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium"
        >
          Create account
        </Link>
      </div>
    </main>
  );
}
