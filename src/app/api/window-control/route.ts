
import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import type { ChildProcessWithoutNullStreams } from 'child_process';

// Use a global variable to persist the process across hot reloads in development
const globalForBrowser = globalThis as unknown as {
  browserProcess: ChildProcessWithoutNullStreams | null;
};

export async function POST(request: Request) {
  const { action, posX = '0', posY = '0', port = '9002' } = await request.json();

  if (action === 'open') {
    if (globalForBrowser.browserProcess && !globalForBrowser.browserProcess.killed) {
      return NextResponse.json({ success: false, message: 'Una ventana de scoreboard ya está abierta.' }, { status: 400 });
    }

    const chromePath = '/usr/bin/google-chrome'; 
    const url = `http://localhost:${port}/`;
    const args = [
      `--kiosk`,
      url,
      `--window-position=${posX},${posY}`,
      '--disable-infobars',
      '--no-first-run',
      '--disable-pinch',
      '--overscroll-history-navigation=0'
    ];

    try {
      globalForBrowser.browserProcess = spawn(chromePath, args, {
        detached: true, 
        stdio: 'ignore', 
      });

      // Allow the parent process (our server) to exit without terminating the child (Chrome)
      globalForBrowser.browserProcess.unref(); 

      globalForBrowser.browserProcess.on('error', (err) => {
        console.error('Error al iniciar Chrome:', err);
        globalForBrowser.browserProcess = null;
      });

      globalForBrowser.browserProcess.on('exit', (code) => {
        console.log(`Proceso de Chrome cerrado con código: ${code}`);
        globalForBrowser.browserProcess = null;
      });
      
      return NextResponse.json({ success: true, message: 'Ventana de scoreboard abierta en modo kiosco.' });
    } catch (error) {
      console.error('Error al ejecutar el comando para abrir Chrome:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido.';
      return NextResponse.json({ success: false, message: `Error del servidor: ${errorMessage}` }, { status: 500 });
    }

  } else if (action === 'close') {
    if (globalForBrowser.browserProcess && !globalForBrowser.browserProcess.killed) {
      const killed = globalForBrowser.browserProcess.kill('SIGTERM'); 
      if (killed) {
        globalForBrowser.browserProcess = null;
        return NextResponse.json({ success: true, message: 'Ventana de scoreboard cerrada.' });
      } else {
        return NextResponse.json({ success: false, message: 'No se pudo cerrar la ventana del scoreboard.' }, { status: 500 });
      }
    }
    return NextResponse.json({ success: false, message: 'No hay ninguna ventana de scoreboard para cerrar.' }, { status: 400 });
  
  } else if (action === 'status') {
    const isOpen = globalForBrowser.browserProcess !== null && !globalForBrowser.browserProcess.killed;
    return NextResponse.json({ success: true, isOpen });
  }

  return NextResponse.json({ success: false, message: 'Acción no válida.' }, { status: 400 });
}
