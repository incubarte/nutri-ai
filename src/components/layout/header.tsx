

"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Home, Settings, Wrench, MonitorPlay, Loader2, BarChart3 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { FullscreenToggle } from './fullscreen-toggle';
import { HockeyPuckSpinner } from '../ui/hockey-puck-spinner';

const EXTERNAL_WINDOW_CONFIG_KEY = 'externalWindowConfig';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const isScoreboardPage = pathname === '/';
  const isControlsPage = pathname === '/controls';

  const [isVisible, setIsVisible] = useState(!isScoreboardPage);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Cuando el pathname cambia, la nueva página ha cargado, así que ocultamos el loader.
    setIsLoading(false);
  }, [pathname]);

  const handleNav = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // Si ya estamos en la página de destino, no hacemos nada.
    if (pathname === href) {
        e.preventDefault();
        return;
    }
    // Si no, activamos el loader.
    setIsLoading(true);
    // La navegación del Link continuará normalmente.
  };


  const handleOpenExternalWindow = async () => {
    let config = null;
    try {
        const savedConfigRaw = localStorage.getItem(EXTERNAL_WINDOW_CONFIG_KEY);
        if (savedConfigRaw) {
            config = JSON.parse(savedConfigRaw);
        }
    } catch (e) { console.error("Error parsing window config from localStorage", e); }
    
    // Si no hay config, la obtenemos del servidor
    if (!config || !config.binaryPath) {
        try {
            const res = await fetch('/api/system-info');
            if (!res.ok) throw new Error('Failed to fetch system info');
            const systemInfo = await res.json();
            config = {
                binaryPath: systemInfo.defaultBrowserPath,
                posX: '1920',
                posY: '0',
                width: '1920',
                height: '1080',
            };
            localStorage.setItem(EXTERNAL_WINDOW_CONFIG_KEY, JSON.stringify(config));
        } catch (error) {
            toast({
                title: "Error de Configuración",
                description: "No se pudo obtener la configuración por defecto para abrir la ventana. Por favor, configúrala manualmente.",
                variant: "destructive",
            });
            return;
        }
    }

    const payload = {
        binaryPath: config.binaryPath,
        url: `${window.location.protocol}//${window.location.host}/`, // URL dinámica del scoreboard
        position: { x: config.posX, y: config.posY },
        size: { width: config.width, height: config.height },
    };

    try {
        const response = await fetch('/api/open-window', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (data.success) {
            toast({ title: "Acción Enviada", description: data.message });
        } else {
            toast({ title: "Error al Abrir Ventana", description: data.message, variant: "destructive" });
        }
    } catch (error) {
        toast({ title: "Error de Red", description: "No se pudo comunicar con el servidor.", variant: "destructive" });
    }
  };


  // Prefetch all main routes as soon as the header loads to make navigation instant
  useEffect(() => {
    router.prefetch('/');
    router.prefetch('/controls');
    router.prefetch('/config');
    router.prefetch('/resumen');
  }, [router]);

  useEffect(() => {
    if (isScoreboardPage) {
      setIsVisible(false); 
    } else {
      setIsVisible(true);  
    }
  }, [isScoreboardPage]); 

  useEffect(() => {
    if (!isScoreboardPage) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (event.clientY < 80) { 
        setIsVisible(true);
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = null;
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isScoreboardPage]);

  const handleHeaderMouseEnter = () => {
    if (isScoreboardPage) {
      setIsVisible(true);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    }
  };

  const handleHeaderMouseLeave = () => {
    if (isScoreboardPage) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      hideTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 300); 
    }
  };

  return (
    <>
    {isLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <HockeyPuckSpinner className="h-24 w-24 text-primary" />
        </div>
    )}
    <header
      onMouseEnter={handleHeaderMouseEnter}
      onMouseLeave={handleHeaderMouseLeave}
      className={cn(
        "top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        "transition-all duration-300 ease-in-out",
        isScoreboardPage
          ? (isVisible ? "absolute opacity-100 translate-y-0 pointer-events-auto" : "absolute opacity-0 -translate-y-full pointer-events-none")
          : "sticky opacity-100 translate-y-0 pointer-events-auto"
      )}
    >
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2" onClick={(e) => handleNav(e, '/')}>
          <span className="font-headline text-xl font-bold text-primary-foreground">IceVision</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/"
            onClick={(e) => handleNav(e, '/')}
            className={cn(
              "transition-colors hover:text-foreground/80",
              pathname === "/" ? "text-foreground" : "text-foreground/60"
            )}
          >
            Scoreboard
          </Link>
          <Link
            href="/controls"
            onClick={(e) => handleNav(e, '/controls')}
            className={cn(
              "transition-colors hover:text-foreground/80",
              pathname === "/controls" ? "text-foreground" : "text-foreground/60"
            )}
          >
            Controles
          </Link>
           <Link
            href="/resumen"
            onClick={(e) => handleNav(e, '/resumen')}
            className={cn(
              "transition-colors hover:text-foreground/80",
              pathname === "/resumen" ? "text-foreground" : "text-foreground/60"
            )}
          >
            Resumen
          </Link>
          <Link
            href="/config"
            onClick={(e) => handleNav(e, '/config')}
            className={cn(
              "transition-colors hover:text-foreground/80",
              pathname === "/config" ? "text-foreground" : "text-foreground/60"
            )}
          >
            Configuración
          </Link>
        </nav>
        <div className="flex flex-1 items-center justify-end space-x-2">
           <Button variant="ghost" size="icon" asChild className={pathname === "/" ? "text-primary-foreground bg-primary/80" : "text-foreground/60"}>
            <Link href="/" aria-label="Scoreboard" onClick={(e) => handleNav(e, '/')}>
              <Home className="h-5 w-5" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild className={pathname === "/controls" ? "text-primary-foreground bg-primary/80" : "text-foreground/60"}>
            <Link href="/controls" aria-label="Controls" onClick={(e) => handleNav(e, '/controls')}>
              <Settings className="h-5 w-5" />
            </Link>
          </Button>
           <Button variant="ghost" size="icon" asChild className={pathname === "/resumen" ? "text-primary-foreground bg-primary/80" : "text-foreground/60"}>
            <Link href="/resumen" aria-label="Resumen" onClick={(e) => handleNav(e, '/resumen')}>
              <BarChart3 className="h-5 w-5" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild className={pathname === "/config" ? "text-primary-foreground bg-primary/80" : "text-foreground/60"}>
            <Link href="/config" aria-label="Configuración & Equipos" onClick={(e) => handleNav(e, '/config')}>
              <Wrench className="h-5 w-5" />
            </Link>
          </Button>

          {isControlsPage && (
            <Button variant="ghost" size="icon" onClick={handleOpenExternalWindow} aria-label="Abrir ventana de scoreboard externa">
                <MonitorPlay className="h-5 w-5" />
            </Button>
          )}

          {isScoreboardPage && (
            <FullscreenToggle />
          )}

        </div>
      </div>
    </header>
    </>
  );
}
