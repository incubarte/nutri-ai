
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Home, Settings, Wrench, Trash2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { FullscreenToggle } from './fullscreen-toggle';
import { ScoreboardWindowControl } from './scoreboard-window-control';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const isScoreboardPage = pathname === '/';
  const isControlsPage = pathname === '/controls';

  const [isVisible, setIsVisible] = useState(!isScoreboardPage);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [showClearStorageConfirmation, setShowClearStorageConfirmation] = useState(false);

  const handleClearLocalStorage = () => {
    if (typeof window !== 'undefined') {
      localStorage.clear();
      toast({
        title: "Datos Locales Eliminados",
        description: "Se ha limpiado el almacenamiento local. La página se recargará.",
      });
      setTimeout(() => window.location.reload(), 1500);
    }
  };

  // Prefetch all main routes as soon as the header loads to make navigation instant
  useEffect(() => {
    router.prefetch('/');
    router.prefetch('/controls');
    router.prefetch('/config');
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
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <span className="font-headline text-xl font-bold text-primary-foreground">IceVision</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/"
            className={cn(
              "transition-colors hover:text-foreground/80",
              pathname === "/" ? "text-foreground" : "text-foreground/60"
            )}
          >
            Scoreboard
          </Link>
          <Link
            href="/controls"
            className={cn(
              "transition-colors hover:text-foreground/80",
              pathname === "/controls" ? "text-foreground" : "text-foreground/60"
            )}
          >
            Controles
          </Link>
          <Link
            href="/config"
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
            <Link href="/" aria-label="Scoreboard">
              <Home className="h-5 w-5" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild className={pathname === "/controls" ? "text-primary-foreground bg-primary/80" : "text-foreground/60"}>
            <Link href="/controls" aria-label="Controls">
              <Settings className="h-5 w-5" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild className={pathname === "/config" ? "text-primary-foreground bg-primary/80" : "text-foreground/60"}>
            <Link href="/config" aria-label="Configuración & Equipos">
              <Wrench className="h-5 w-5" />
            </Link>
          </Button>

          {isScoreboardPage && <FullscreenToggle />}
          {isControlsPage && <ScoreboardWindowControl />}
          {isControlsPage && (
            <AlertDialog open={showClearStorageConfirmation} onOpenChange={setShowClearStorageConfirmation}>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive hover:text-destructive-foreground">
                  <Trash2 className="h-5 w-5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Limpieza Total</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará permanentemente TODA la configuración (perfiles, equipos, etc.) y el estado del juego actual del almacenamiento local de este navegador. Esta acción es irreversible. ¿Estás seguro de que quieres continuar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearLocalStorage} className="bg-destructive hover:bg-destructive/90">
                    Sí, Borrar Todo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

        </div>
      </div>
    </header>
  );
}
