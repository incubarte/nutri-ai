"use client";

import { useState } from 'react';
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminPage() {
  const { toast } = useToast();

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
                    Las acciones en esta sección son irreversibles y pueden causar la pérdida de datos de configuración. Úsalas con precaución.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Limpiar Todo el Almacenamiento Local
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
                 <p className="text-xs text-destructive/80 mt-2">
                    Esto borrará todos los perfiles de configuración, equipos guardados y el estado del partido actual que estén guardados en este navegador.
                </p>
            </CardContent>
        </Card>
    </div>
  );
}
