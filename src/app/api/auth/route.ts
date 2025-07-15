
import { NextResponse } from 'next/server';
import { getRemoteAccessPassword, isClientLocal } from '@/lib/server-side-store';
import { headers } from 'next/headers';

export async function POST(request: Request) {
  try {
    const clientIsLocal = isClientLocal(request);
    const reqHeaders = headers();
    const clientIp = (reqHeaders.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();

    // Local clients are always authenticated
    if (clientIsLocal) {
        console.log(`[AUTH DEBUG] Local client detected (IP: ${clientIp}). Access granted.`);
        return NextResponse.json({ authenticated: true });
    }

    // Remote clients need to provide a password
    const { password } = await request.json();
    const serverPassword = getRemoteAccessPassword();
    
    console.log(`[AUTH DEBUG] Remote client login attempt:
      - Client IP: ${clientIp}
      - Is Local?: ${clientIsLocal}
      - Expected Password: '${serverPassword}'
      - Received Password: '${password}'`);

    if (password && password === serverPassword) {
        console.log(`[AUTH DEBUG] Password MATCH. Access granted.`);
        return NextResponse.json({ authenticated: true });
    }
    
    console.log(`[AUTH DEBUG] Password MISMATCH. Access denied.`);
    return NextResponse.json({ authenticated: false }, { status: 401 });

  } catch (error) {
    console.error('API Error: Failed to process auth request', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Failed to process auth request.', error: errorMessage }, { status: 500 });
  }
}
