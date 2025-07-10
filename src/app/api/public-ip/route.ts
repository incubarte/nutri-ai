
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Forwarded-for header is the standard way to get the original client IP.
    // Vercel/Next.js and other providers populate this.
    const forwarded = request.headers.get('x-forwarded-for');
    
    // The IP address is often the first in a comma-separated list.
    const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip');

    // As a fallback for local development, we can use the request's remote address,
    // though this is less reliable in production.
    const fallbackIp = request.headers.get('remote-addr');

    const publicIp = ip || fallbackIp;

    if (!publicIp) {
      return NextResponse.json({ error: 'No se pudo determinar la IP pública.' }, { status: 500 });
    }

    return NextResponse.json({ ip: publicIp });
  } catch (error) {
    console.error("Error fetching public IP:", error);
    return NextResponse.json({ error: 'Error interno del servidor al obtener la IP.' }, { status: 500 });
  }
}
