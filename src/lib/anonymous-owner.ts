const COOKIE_NAME = 'velvetia_anonymous_id'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function anonymousOwner(request: Request) {
  const cookie = request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1)
  const secure = new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https'
  if (cookie && UUID.test(cookie)) return { ownerKey: cookie, setCookie: false, secure }
  return { ownerKey: crypto.randomUUID(), setCookie: true, secure }
}

export function withAnonymousOwner(response: Response, ownerKey: string, setCookie: boolean, secure: boolean) {
  if (setCookie) response.headers.append('Set-Cookie', `${COOKIE_NAME}=${ownerKey}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure ? '; Secure' : ''}`)
  return response
}
