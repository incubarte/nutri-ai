
"use client";

import React, { useState, useEffect } from "react";
import { useGameState } from "@/contexts/game-state-context";
import { ControlCardWrapper } from "@/components/controls/control-card-wrapper";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, QrCode, Wifi, Power, PowerOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TunnelState } from "@/types";
import { Separator } from "../ui/separator";

const LocalNetworkManager = () => {
    const { toast } = useToast();
    const [localIp, setLocalIp] = useState<string | null>(null);
    const [isLoadingIp, setIsLoadingIp] = useState(true);
    const [localPort, setLocalPort] = useState('');

    useEffect(() => {
        setLocalPort(window.location.port);
        const fetchLocalIp = async () => {
          setIsLoadingIp(true);
          try {
            const response = await fetch('/api/local-ip');
            if (!response.ok) throw new Error('Failed to fetch local IP');
            const data = await response.json();
            setLocalIp(data.ip || 'No disponible');
          } catch (error) {
            console.error("Failed to fetch local IP:", error);
            setLocalIp('Error al obtener');
          } finally {
            setIsLoadingIp(false);
          }
        };
        fetchLocalIp();
    }, []);

    const fullLocalUrl = (localIp && localPort && !localIp.includes('Error')) 
      ? `http://${localIp}:${localPort}/mobile-controls`
      : '';

    const handleCopyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
        toast({ title: "Copiado", description: `${text} copiado al portapapeles.` });
        }, () => {
        toast({ title: "Error al Copiar", description: "No se pudo copiar el texto.", variant: "destructive" });
        });
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
                 <div className="space-y-2">
                    <Label htmlFor="local-ip">IP del Servidor (en tu red)</Label>
                    {isLoadingIp ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm">
                          <span className="font-mono">{localIp}</span>
                      </div>
                    )}
                 </div>
                 <div className="space-y-2">
                    <Label htmlFor="local-port">Puerto de la Aplicación</Label>
                    <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm">
                        <span className="font-mono">{localPort || "cargando..."}</span>
                    </div>
                </div>
            </div>
            <div className="flex flex-col items-center justify-center space-y-4">
                 <Label className="text-base font-medium">QR para Acceso Móvil (Red Local)</Label>
                 <div className="relative flex items-center justify-center bg-card p-4 rounded-lg border w-48 h-48">
                    {fullLocalUrl ? (
                        <QRCodeSVG value={fullLocalUrl} size={160} bgColor="hsl(var(--card))" fgColor="hsl(var(--card-foreground))" />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                            <Wifi className="h-8 w-8 mb-2" />
                            <span className="text-sm">Generando QR...</span>
                        </div>
                    )}
                 </div>
                <Button variant="link" size="sm" onClick={() => handleCopyToClipboard(fullLocalUrl)} disabled={!fullLocalUrl}>
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    Copiar URL completa
                </Button>
            </div>
        </div>
    );
};


export const RemoteControlsSettingsCard = () => {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const { tunnel } = state.config;

  const [publicIp, setPublicIp] = useState<string | null>(null);
  const [isLoadingIp, setIsLoadingIp] = useState(true);

  useEffect(() => {
    const fetchIp = async () => {
      setIsLoadingIp(true);
      try {
        const response = await fetch('/api/public-ip');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setPublicIp(data.ip || 'No disponible');
      } catch (error) {
        console.error("Failed to fetch public IP:", error);
        setPublicIp('Error al obtener');
      } finally {
        setIsLoadingIp(false);
      }
    };
    fetchIp();
  }, []);

  useEffect(() => {
      const fetchTunnelStatus = async () => {
          try {
              const res = await fetch('/api/localtunnel', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'status' }),
              });
              const data = await res.json();
              if (data.success) {
                  dispatch({ type: 'UPDATE_TUNNEL_STATE', payload: { status: data.status, url: data.url } });
              }
          } catch (e) {
              console.error("Error fetching tunnel status", e);
          }
      };
      fetchTunnelStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTunnelToggle = async () => {
    const action = tunnel.status === 'connected' ? 'disconnect' : 'connect';
    dispatch({ type: 'UPDATE_TUNNEL_STATE', payload: { status: 'connecting', lastMessage: null } });

    try {
      const response = await fetch('/api/localtunnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          subdomain: tunnel.subdomain,
          port: tunnel.port,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const newStatus = action === 'connect' ? 'connected' : 'disconnected';
        const newUrl = action === 'connect' ? data.url : null;
        dispatch({ type: 'UPDATE_TUNNEL_STATE', payload: { status: newStatus, url: newUrl, lastMessage: data.message || null } });
        toast({
          title: `Túnel ${newStatus === 'connected' ? 'Conectado' : 'Desconectado'}`,
          description: newUrl ? `Accesible en: ${newUrl}` : 'El túnel ha sido cerrado.',
        });
      } else {
        // Just update the state to 'error' with the message, without showing a toast.
        dispatch({ type: 'UPDATE_TUNNEL_STATE', payload: { status: 'error', lastMessage: data.message } });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error de red.';
      // Just update the state to 'error' with the message, without showing a toast.
      dispatch({ type: 'UPDATE_TUNNEL_STATE', payload: { status: 'error', lastMessage: errorMessage } });
    }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copiado", description: `${text} copiado al portapapeles.` });
    }, () => {
      toast({ title: "Error al Copiar", description: "No se pudo copiar el texto.", variant: "destructive" });
    });
  };

  const fullMobileUrl = tunnel.url ? `${tunnel.url}/mobile-controls` : '';
  const isTunnelConnecting = tunnel.status === 'connecting';
  const isTunnelConnected = tunnel.status === 'connected';

  const statusBadge = {
      disconnected: <Badge variant="secondary">Desconectado</Badge>,
      connecting: <Badge className="bg-blue-500 text-white">Conectando...</Badge>,
      connected: <Badge className="bg-green-600 text-white">Conectado</Badge>,
      error: <Badge variant="destructive">Error</Badge>,
  }[tunnel.status];

  return (
    <div className="space-y-8">
        <ControlCardWrapper title="Gestión de Controles Remotos (Red Local)">
            <LocalNetworkManager />
        </ControlCardWrapper>

        <Separator />
    
        <ControlCardWrapper title="Gestión de Controles Remotos (Internet vía Localtunnel)">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="tunnel-subdomain">Subdominio</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="tunnel-subdomain"
                    placeholder="ej. icevision-fantasy"
                    value={tunnel.subdomain}
                    onChange={(e) => dispatch({ type: 'UPDATE_TUNNEL_STATE', payload: { subdomain: e.target.value } })}
                    disabled={isTunnelConnecting || isTunnelConnected}
                  />
                  <span className="text-sm text-muted-foreground">.local.lt</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tunnel-port">Puerto</Label>
                <Input
                  id="tunnel-port"
                  type="number"
                  placeholder="Ej. 3000"
                  value={tunnel.port}
                  onChange={(e) => dispatch({ type: 'UPDATE_TUNNEL_STATE', payload: { port: parseInt(e.target.value, 10) || 0 } })}
                  className="w-28"
                  disabled={isTunnelConnecting || isTunnelConnected}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">Estado de la Conexión {statusBadge}</Label>
                <Button onClick={handleTunnelToggle} disabled={isTunnelConnecting || !tunnel.subdomain || !tunnel.port} className="w-full sm:w-auto">
                  {isTunnelConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isTunnelConnected ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />)}
                  {isTunnelConnecting ? 'Procesando...' : (isTunnelConnected ? 'Desconectar Túnel' : 'Conectar Túnel')}
                </Button>
                {tunnel.status === 'error' && <p className="text-sm text-destructive">{tunnel.lastMessage}</p>}
                {isTunnelConnected && tunnel.url && <p className="text-sm text-green-600 dark:text-green-400">URL pública: {tunnel.url}</p>}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center space-y-4">
              <Label className="text-base font-medium">QR para Acceso Móvil (Internet)</Label>
              <div className="relative flex items-center justify-center bg-card p-4 rounded-lg border w-48 h-48">
                {isTunnelConnected && fullMobileUrl ? (
                  <QRCodeSVG value={fullMobileUrl} size={160} bgColor="hsl(var(--card))" fgColor="hsl(var(--card-foreground))" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                    <Wifi className="h-8 w-8 mb-2" />
                    <span className="text-sm">Conecta el túnel para generar el QR</span>
                  </div>
                )}
              </div>
              {isTunnelConnected && fullMobileUrl && (
                <Button variant="link" size="sm" onClick={() => handleCopyToClipboard(fullMobileUrl)}>
                  <Copy className="mr-2 h-3.5 w-3.5" />
                  Copiar URL completa
                </Button>
              )}
            </div>
          </div>
          <div className="mt-8 border-t pt-4 space-y-2">
            <Label className="text-base font-medium">Contraseña (IP Pública del Servidor)</Label>
            <div className="flex items-center gap-2">
                {isLoadingIp ? (
                    <Skeleton className="h-10 w-full" />
                ) : (
                    <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-muted px-3 py-2 text-sm">
                        <span className="font-mono">{publicIp}</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => publicIp && handleCopyToClipboard(publicIp)}
                            disabled={!publicIp || publicIp.includes('Error')}
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>
            <p className="text-xs text-muted-foreground">
              Esta es la IP que los dispositivos remotos pueden usar para conectarse, si es necesario.
            </p>
          </div>
        </ControlCardWrapper>
    </div>
  );
};
