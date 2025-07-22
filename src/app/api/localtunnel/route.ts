import { NextResponse } from 'next/server';
import { disconnectTunnel, connectTunnel } from '@/lib/server-side-store';
import { getConfig } from '@/lib/server-side-store';


export async function POST(request: Request) {
  const { action, port } = await request.json();
  const currentConfig = getConfig();
  const tunnelState = currentConfig?.tunnel;

  if (action === 'connect') {
    if (!port) {
      return NextResponse.json({ success: false, message: 'El puerto es requerido.' }, { status: 400 });
    }
    
    // Always disconnect first to ensure no stale tunnels
    disconnectTunnel();
    
    const result = await connectTunnel(port);

    return NextResponse.json({
        success: result.status === 'connected',
        message: result.lastMessage || (result.status === 'connected' ? 'Túnel conectado.' : 'Iniciando conexión...'),
        ...result
    });

  } else if (action === 'disconnect') {
    disconnectTunnel();
    return NextResponse.json({ success: true, message: 'Túnel desconectado.', status: 'disconnected', url: null, subdomain: null });
  
  } else if (action === 'status') {
     return NextResponse.json({ success: true, ...tunnelState });
  }

  return NextResponse.json({ success: false, message: 'Acción no válida.' }, { status: 400 });
}
