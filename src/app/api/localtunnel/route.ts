
import { NextResponse } from 'next/server';
import localtunnel from 'localtunnel';
import type { Tunnel } from 'localtunnel';

// `localtunnel` returns a Promise that resolves to the tunnel object.
// We'll store this tunnel object in the global scope.
const globalForTunnel = globalThis as unknown as {
  tunnel: Tunnel | undefined;
  tunnelStatus: {
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    url: string | null;
    subdomain: string | null;
    lastMessage: string | null;
  };
};

// Initialize the status if it doesn't exist
if (!globalForTunnel.tunnelStatus) {
    globalForTunnel.tunnelStatus = {
        status: 'disconnected',
        url: null,
        subdomain: null,
        lastMessage: null,
    };
}


const getDynamicSubdomain = () => {
  const prefix = 'icevision-fs'; // Keep prefix consistent
  const randomNumber = Math.floor(10000 + Math.random() * 90000); // 5-digit random number
  return `${prefix}-${randomNumber}`;
};


export async function POST(request: Request) {
  const { action, port } = await request.json();

  if (action === 'connect') {
    if (globalForTunnel.tunnel) {
      return NextResponse.json({ success: false, message: 'Ya existe un túnel activo.' }, { status: 400 });
    }
    if (!port) {
      return NextResponse.json({ success: false, message: 'El puerto es requerido.' }, { status: 400 });
    }

    const dynamicSubdomain = getDynamicSubdomain();

    try {
      globalForTunnel.tunnelStatus = {
          status: 'connecting',
          url: null,
          subdomain: dynamicSubdomain,
          lastMessage: 'Iniciando conexión...'
      };
      
      const tunnel = await localtunnel({ port: port, subdomain: dynamicSubdomain });
      globalForTunnel.tunnel = tunnel;
      
      tunnel.on('url', (url: string) => {
        console.log(`Localtunnel conectado en: ${url}`);
        globalForTunnel.tunnelStatus = {
            status: 'connected',
            url: url,
            subdomain: dynamicSubdomain,
            lastMessage: `Conectado a ${url}`,
        };
      });

      tunnel.on('error', (err: any) => {
        console.warn('Error en el túnel (localtunnel):', err?.message || err);
        // This won't be reflected in the initial response but good for server logs
      });
      
      tunnel.on('close', () => {
        console.log('Túnel cerrado.');
        globalForTunnel.tunnel = undefined;
        // Don't update status here to avoid race conditions if a new one is connecting
      });
      
      return NextResponse.json({ success: true, message: 'Túnel conectado.', url: tunnel.url, subdomain: dynamicSubdomain });

    } catch (error: any) {
      console.error('Error al crear el túnel:', error);
      globalForTunnel.tunnel = undefined;
      globalForTunnel.tunnelStatus = { status: 'error', url: null, subdomain: dynamicSubdomain, lastMessage: error.message || 'Error desconocido al iniciar el túnel.'};
      return NextResponse.json({ success: false, message: error.message || 'Error desconocido al iniciar el túnel.' }, { status: 500 });
    }

  } else if (action === 'disconnect') {
    if (globalForTunnel.tunnel) {
      globalForTunnel.tunnel.close();
      globalForTunnel.tunnel = undefined;
      globalForTunnel.tunnelStatus = { status: 'disconnected', url: null, subdomain: null, lastMessage: 'Túnel desconectado.' };
      return NextResponse.json({ success: true, message: 'Túnel desconectado.' });
    } else {
      return NextResponse.json({ success: false, message: 'No hay ningún túnel activo para desconectar.' }, { status: 400 });
    }
  } else if (action === 'status') {
     return NextResponse.json({ success: true, ...globalForTunnel.tunnelStatus });
  }

  return NextResponse.json({ success: false, message: 'Acción no válida.' }, { status: 400 });
}
