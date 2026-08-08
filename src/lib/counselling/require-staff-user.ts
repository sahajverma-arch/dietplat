import { createClient } from "@/lib/supabase/server"

/**
 * Server Actions are reachable directly even though the UI only exposes
 * them from behind middleware — re-check auth at the action boundary too.
 */
export async function requireStaffUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email?.toLowerCase().endsWith("@fitelo.co")) {
    throw new Error("Not authenticated as Fitelo staff")
  }

  return user
}
