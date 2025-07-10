
import { NextResponse } from 'next/server';
import { networkInterfaces } from 'os';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const nets = networkInterfaces();
    let localIp: string | undefined = undefined;

    for (const name of Object.keys(nets)) {
      const netInfo = nets[name];
      if (netInfo) {
        for (const net of netInfo) {
          // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
          if (net.family === 'IPv4' && !net.internal) {
            localIp = net.address;
            break;
          }
        }
      }
      if (localIp) break;
    }

    if (!localIp) {
      return NextResponse.json({ error: 'No se pudo determinar la IP local del servidor.' }, { status: 500 });
    }
    
    return NextResponse.json({ ip: localIp });
  } catch (error) {
    console.error("Error fetching server's local IP:", error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: `Error interno del servidor al obtener la IP local: ${errorMessage}` }, { status: 500 });
  }
}
