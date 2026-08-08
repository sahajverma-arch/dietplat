import { Button } from "@/components/ui/button"
import { signOutAction } from "@/app/(app)/actions"

export function Header({ email }: { email: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <span className="text-sm text-muted-foreground">{email}</span>
      <form action={signOutAction}>
        <Button type="submit" variant="outline" size="sm">
          Sign out
        </Button>
      </form>
    </header>
  )
}
