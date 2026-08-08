"use client"

import { createClient } from "@/lib/supabase/client"
import { GoogleIcon } from "./google-icon"

export function SignInButton() {
  async function signIn() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { hd: "fitelo.co" },
      },
    })
  }

  return (
    <button
      type="button"
      onClick={signIn}
      className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100"
    >
      <GoogleIcon className="size-5" />
      Continue with Google
    </button>
  )
}
