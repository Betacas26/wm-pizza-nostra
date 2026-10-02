import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function sanitizeHeaders(original: Headers): { headers: Headers; dirty: boolean } {
  const headers = new Headers();
  let dirty = false;
  original.forEach((value, key) => {
    if (value.includes('<') || value.includes('>')) {
      dirty = true;
      const cleaned = value.replace(/<[^>]*>\s*/g, '').trim();
      if (cleaned) {
        try { headers.set(key, cleaned); } catch { /* skip invalid */ }
      }
    } else {
      try { headers.set(key, value); } catch { /* skip invalid */ }
    }
  });
  return { headers, dirty };
}

export async function proxy(request: NextRequest) {
  const { headers: safeHeaders } = sanitizeHeaders(request.headers);

  let response = NextResponse.next({
    request: {
      headers: safeHeaders,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Fallar cerrado: sin credenciales no se puede verificar sesión
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }: { name: string; value: string; options?: CookieOptions }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request: { headers: safeHeaders },
        });
        cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = request.nextUrl.pathname.startsWith('/login');
  const isDashboardPage = request.nextUrl.pathname.startsWith('/dashboard');

  if (!user && isDashboardPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};