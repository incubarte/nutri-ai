
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Home, Settings, Wrench } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { FullscreenToggle } from './fullscreen-toggle';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isScoreboardPage = pathname === '/';

  const [isVisible, setIsVisible] = useState(!isScoreboardPage);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        </div>
      </div>
    </header>
  );
}
