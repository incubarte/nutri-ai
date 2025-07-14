
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import os from 'os';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { binaryPath, url, position, size } = await request.json();

    if (!binaryPath || !url || !position || !size) {
      return NextResponse.json({ success: false, message: 'Faltan parámetros requeridos (binaryPath, url, position, size).' }, { status: 400 });
    }

    const platform = os.platform();
    let command: string;

    // --- Asegurarse de que las rutas con espacios estén entre comillas ---
    const safeBinaryPath = binaryPath.includes(' ') ? `"${binaryPath}"` : binaryPath;
    const safeUrl = url.includes(' ') ? `"${url}"` : url;
    
    // --- Construir el comando según el SO ---
    switch (platform) {
      case 'linux':
        // Usa --kiosk para una experiencia de pantalla completa real
        command = `${safeBinaryPath} --kiosk ${safeUrl} --window-position=${position.x},${position.y} --window-size=${size.width},${size.height}`;
        break;
        
      case 'darwin': // macOS
        // macOS ignora position/size con --kiosk. --app es la mejor alternativa para una ventana sin UI de navegador.
        // El posicionamiento y tamaño en macOS es más complejo de forzar desde la línea de comandos. Se abrirá con el tamaño de la URL.
        command = `${safeBinaryPath} --app=${safeUrl}`;
        break;
        
      case 'win32': // Windows
        // --start-fullscreen es a menudo más fiable que --kiosk en Windows y permite salir más fácilmente.
        command = `${safeBinaryPath} --kiosk "${url}" --window-position=${position.x},${position.y} --window-size=${size.width},${size.height}`;
        break;

      default:
        return NextResponse.json({ success: false, message: `Sistema operativo no soportado: ${platform}` }, { status: 501 });
    }
    
    console.log(`Executing command for ${platform}: ${command}`);

    exec(command, (error, stdout, stderr) => {
      // exec es asíncrono. No podemos esperar a que termine, porque el navegador seguirá abierto.
      // Solo nos interesa si hay un error inmediato al lanzar el comando.
      if (error) {
        console.error(`Error al ejecutar el comando: ${error.message}`);
        // No devolvemos una respuesta aquí porque la petición HTTP ya habrá terminado.
        // El manejo de errores debe hacerse en el cliente si no se abre la ventana.
      }
      if (stderr) {
        console.error(`Error de STDERR: ${stderr}`);
      }
    });

    return NextResponse.json({ success: true, message: `Comando para abrir la ventana del scoreboard enviado al servidor.` });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido.";
    console.error('Error en /api/open-window:', error);
    return NextResponse.json({ success: false, message: `Error del servidor: ${errorMessage}` }, { status: 500 });
  }
}
