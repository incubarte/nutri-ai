"use client";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, ShieldAlert, LogIn } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from "@/hooks/use-auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useRouter } from "next/navigation";
import { GAME_STATE_STORAGE_KEY, TEAMS_STORAGE_KEY } from "@/contexts/game-state-context";

export default function AdminPage() {
  const { toast } = useToast();
  const { authStatus } = useAuth();
  const router = useRouter();

  const handleClearConfigOnly = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(GAME_STATE_STORAGE_KEY);
      toast({
        title: "Configuración Eliminada",
        description: "Se ha limpiado la configuración del juego. Los equipos se han mantenido. La página se recargará.",
      });
      setTimeout(() => window.location.reload(), 1500);
    }
  };

  const handleClearAllData = () => {
     if (typeof window !== 'undefined') {
      localStorage.removeItem(GAME_STATE_STORAGE_KEY);
      localStorage.removeItem(TEAMS_STORAGE_KEY);
      toast({
        title: "Todos los Datos Eliminados",
        description: "Se ha limpiado toda la configuración y los equipos. La página se recargará.",
      });
      setTimeout(() => window.location.reload(), 1500);
    }
  }

  if (authStatus === 'loading') {
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-4">
        <LoadingSpinner className="h-12 w-12 text-primary mb-4" />
        <p className="text-xl text-foreground">Verificando acceso...</p>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    router.replace('/mobile-controls/login');
    return (
       <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-4">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive-foreground">Acceso Denegado</h1>
        <p className="text-muted-foreground mt-2">No tienes permisos para ver esta página. Redirigiendo al login...</p>
        <Button onClick={() => router.push('/mobile-controls/login')} className="mt-4">
            <LogIn className="mr-2 h-4 w-4" /> Ir a Login
        </Button>
      </div>
    );
  }


  return (
    <div className="w-full max-w-2xl mx-auto space-y-8 py-10">
        <div className="text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-primary" />
            <h1 className="text-3xl font-bold mt-4">Panel de Administración</h1>
            <p className="text-muted-foreground mt-2">Herramientas para la gestión avanzada de la aplicación.</p>
        </div>
        <Card className="bg-destructive/10 border-destructive/30">
            <CardHeader>
                <CardTitle className="text-destructive">Zona de Peligro</CardTitle>
                <CardDescription className="text-destructive/80">
                    Las acciones en esta sección son irreversibles y pueden causar la pérdida de datos. Úsalas con precaución.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="bg-amber-600 hover:bg-amber-700 border-amber-500 text-white">
                              <Trash2 className="mr-2 h-4 w-4" /> Limpiar Configuración (Mantener Equipos)
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar Limpieza de Configuración</AlertDialogTitle>
                          <AlertDialogDescription>
                              Esta acción eliminará la configuración de perfiles, sonido, display, etc., y el estado del juego actual. <strong>Tus equipos y jugadores guardados NO serán eliminados.</strong> ¿Estás seguro de que quieres continuar?
                          </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleClearConfigOnly} className="bg-amber-600 hover:bg-amber-700">
                              Sí, Limpiar Configuración
                          </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
                  <p className="text-xs text-amber-500/80 mt-2">
                      Opción segura: Borra los perfiles de configuración, pero no tus equipos.
                  </p>
                </div>
                
                <div>
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Limpiar TODO (Incluyendo Equipos)
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                          <AlertDialogTitle>¡Confirmación Final!</AlertDialogTitle>
                          <AlertDialogDescription>
                              Esta acción eliminará permanentemente TODA la configuración y TODOS los equipos y jugadores guardados. Esta acción es irreversible. ¿Estás seguro de que quieres borrar absolutamente todo?
                          </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleClearAllData} className="bg-destructive hover:bg-destructive/90">
                              Sí, Borrar Todo
                          </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
                  <p className="text-xs text-destructive/80 mt-2">
                      Opción nuclear: Borra todo. No habrá vuelta atrás.
                  </p>
                </div>

            </CardContent>
        </Card>
    </div>
  );
}
