import { redirect } from "next/navigation"

import { NavLinks } from "@/components/layout/nav-links"
import { Header } from "@/components/layout/header"
import { createClient } from "@/lib/supabase/server"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Belt-and-braces: middleware already gates this route group, but a
  // Server Component should never trust an absent user silently.
  if (!user) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r p-4">
        <div className="mb-6 px-3 text-lg font-semibold">LEANR</div>
        <NavLinks />
      </aside>
      <div className="flex flex-1 flex-col">
        <Header email={user.email ?? ""} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
