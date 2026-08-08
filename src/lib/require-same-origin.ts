/**
 * Defense-in-depth CSRF guard for Route Handlers. Server Actions get
 * Next.js's built-in same-origin check automatically; plain `app/api/*`
 * route handlers do not — cookie-based auth alone doesn't stop a
 * cross-site form/fetch from riding an authenticated session. Browsers
 * send `Origin` on same-origin fetch POSTs too, so comparing it against
 * the request's own `Host` doesn't require hardcoding a deployment URL and
 * works the same in local dev, preview deploys, and production.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  const host = request.headers.get("host")
  if (!origin || !host) return false

  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}
