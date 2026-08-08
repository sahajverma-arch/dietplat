import { Leaf } from "lucide-react"

import { SignInButton } from "./sign-in-button"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 p-4 text-center">
      <h1 className="text-6xl font-black italic tracking-tight text-yellow-400">LEANR</h1>
      {/* Placeholder mark — swap for the real Fitelo logo asset when available */}
      <p className="mt-2 flex items-center gap-1.5 text-lg italic text-neutral-300">
        By
        <span className="flex size-5 items-center justify-center rounded-full bg-white">
          <Leaf className="size-3 text-neutral-900" />
        </span>
        Fitelo
      </p>

      <p className="mt-6 max-w-md text-neutral-400">
        Counselling, AI diet plans and weekly follow-ups — in one place.
      </p>

      <div className="mt-8 w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
        <h2 className="text-xl font-semibold text-white">Sign in</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Use your Fitelo Google account (@fitelo.co)
        </p>

        {error === "domain" && (
          <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            That account isn&apos;t a @fitelo.co account. Sign in with your Fitelo Google account.
          </p>
        )}

        <div className="mt-6">
          <SignInButton />
        </div>

        <p className="mt-4 text-xs text-neutral-500">
          Personal Gmail and non-Fitelo accounts are not allowed. Contact your admin if you
          can&apos;t sign in.
        </p>
      </div>
    </main>
  )
}
