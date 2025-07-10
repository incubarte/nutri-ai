
"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { useGameState } from "@/contexts/game-state-context";
import { ControlCardWrapper } from "@/components/controls/control-card-wrapper";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, QrCode, Wifi } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { Skeleton } from "@/components/ui/skeleton";

export interface RemoteControlsSettingsCardRef {
  handleSave: () => boolean;
  handleDiscard: () => void;
  getIsDirty: () => boolean;
}

interface RemoteControlsSettingsCardProps {
  onDirtyChange: (isDirty: boolean) => void;
}

export const RemoteControlsSettingsCard = forwardRef<RemoteControlsSettingsCardRef, RemoteControlsSettingsCardProps>((props, ref) => {
  const { state, dispatch } = useGameState();
  const { onDirtyChange } = props;
  const { toast } = useToast();

  const [localUrl, setLocalUrl] = useState(state.config.remoteControlsUrl);
  const [publicIp, setPublicIp] = useState<string | null>(null);
  const [isLoadingIp, setIsLoadingIp] = useState(true);
  const [isDirtyLocal, setIsDirtyLocal] = useState(false);

  useEffect(() => {
    onDirtyChange(isDirtyLocal);
  }, [isDirtyLocal, onDirtyChange]);

  useEffect(() => {
    if (!isDirtyLocal) {
      setLocalUrl(state.config.remoteControlsUrl);
    }
  }, [state.config.remoteControlsUrl, isDirtyLocal]);

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

  const markDirty = () => setIsDirtyLocal(true);

  useImperativeHandle(ref, () => ({
    handleSave: () => {
      if (!isDirtyLocal) return true;
      dispatch({ type: "UPDATE_CONFIG_FIELDS", payload: { remoteControlsUrl: localUrl } });
      setIsDirtyLocal(false);
      return true;
    },
    handleDiscard: () => {
      setLocalUrl(state.config.remoteControlsUrl);
      setIsDirtyLocal(false);
    },
    getIsDirty: () => isDirtyLocal,
  }));

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copiado",
        description: `${text} copiado al portapapeles.`,
      });
    }, (err) => {
      toast({
        title: "Error al Copiar",
        description: "No se pudo copiar el texto.",
        variant: "destructive",
      });
    });
  };

  const fullMobileUrl = localUrl ? `https://${localUrl}/mobile-controls` : '';

  return (
    <ControlCardWrapper title="Configuración de Controles Remotos">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="localtunnel-url" className="text-base font-medium">URL de Localtunnel</Label>
            <Input
              id="localtunnel-url"
              placeholder="ej. icevision-fantasy.local.lt"
              value={localUrl}
              onChange={(e) => {
                setLocalUrl(e.target.value);
                markDirty();
              }}
            />
            <p className="text-xs text-muted-foreground">
              Ingresa la URL proporcionada por `localtunnel` sin `https://`.
            </p>
          </div>
          <div className="space-y-2">
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
              Esta es la IP que los dispositivos remotos deben usar para conectarse, si es necesario.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center space-y-4">
            <Label className="text-base font-medium">QR para Acceso Móvil</Label>
            <div className="relative flex items-center justify-center bg-card p-4 rounded-lg border w-48 h-48">
              {fullMobileUrl ? (
                <QRCodeSVG value={fullMobileUrl} size={160} bgColor="hsl(var(--card))" fgColor="hsl(var(--card-foreground))" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                    <Wifi className="h-8 w-8 mb-2" />
                    <span className="text-sm">Ingresa una URL para generar el QR</span>
                </div>
              )}
            </div>
            {fullMobileUrl && (
                <Button variant="link" size="sm" onClick={() => handleCopyToClipboard(fullMobileUrl)}>
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    Copiar URL completa
                </Button>
            )}
        </div>
      </div>
    </ControlCardWrapper>
  );
});

RemoteControlsSettingsCard.displayName = "RemoteControlsSettingsCard";
