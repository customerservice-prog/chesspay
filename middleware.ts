import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/register', '/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/health']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public routes and static assets
  if (
    PUBLIC_ROUTES.some(r => pathname.startsWith(r)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // For API routes (except public ones), check Authorization header
  if (pathname.startsWith('/api/')) {
    const auth = req.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Missing token' }, { status: 401 })
    }
    return NextResponse.next()
  }

  // For page routes, let the client-side auth context handle redirects
  // (token lives in localStorage, not cookies, so middleware can't read it)
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
