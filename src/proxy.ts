import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

const isDevelopment = process.env.NODE_ENV !== 'production';

function buildCsp(nonce: string): string {
    return [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}'${isDevelopment ? " 'unsafe-eval' 'unsafe-inline'" : ""}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
        "frame-ancestors 'none'",
    ].join('; ');
}

function createNonce(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    let binary = '';

    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });

    return btoa(binary);
}

export async function proxy(request: NextRequest) {
    const response = await updateSession(request);

    // Don't add nonce to redirects
    if (response.status >= 300 && response.status < 400) {
        return response;
    }

    const nonce = createNonce();
    response.headers.set('Content-Security-Policy', buildCsp(nonce));
    response.headers.set('x-nonce', nonce);

    return response;
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
