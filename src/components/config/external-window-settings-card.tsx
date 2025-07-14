
"use client";

import React, { useState, useEffect } from "react";
import { ControlCardWrapper } from "@/components/controls/control-card-wrapper";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

const LOCAL_STORAGE_KEY = 'externalWindowConfig';

interface ExternalWindowConfig {
    binaryPath: string;
    posX: string;
    posY: string;
    width: string;
    height: string;
}

export const ExternalWindowSettingsCard = () => {
    const { toast } = useToast();
    const [config, setConfig] = useState<ExternalWindowConfig>({
        binaryPath: '',
        posX: '1920',
        posY: '0',
        width: '1920',
        height: '1080'
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Cargar desde localStorage o obtener del servidor si no existe
        const savedConfigRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedConfigRaw) {
            try {
                const savedConfig = JSON.parse(savedConfigRaw);
                setConfig(savedConfig);
            } catch {
                // Si hay un error, procedemos a obtener los valores por defecto
                fetchDefaults();
            }
            setIsLoading(false);
        } else {
            fetchDefaults();
        }
    }, []);

    const fetchDefaults = async () => {
        try {
            const response = await fetch('/api/system-info');
            if (!response.ok) throw new Error('No se pudo obtener la información del sistema.');
            const data = await response.json();
            
            const defaultConfig: ExternalWindowConfig = {
                binaryPath: data.defaultBrowserPath || '',
                posX: '1920',
                posY: '0',
                width: '1920',
                height: '1080',
            };
            setConfig(defaultConfig);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(defaultConfig));
        } catch (error) {
            toast({
                title: 'Error al Cargar Configuración',
                description: 'No se pudieron obtener los valores por defecto del servidor.',
                variant: 'destructive',
            });
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfigChange = (field: keyof ExternalWindowConfig, value: string) => {
        const newConfig = { ...config, [field]: value };
        setConfig(newConfig);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newConfig));
    };

    if (isLoading) {
        return <ControlCardWrapper title="Configuración de Ventana Externa">Cargando...</ControlCardWrapper>;
    }
    
    return (
        <ControlCardWrapper title="Configuración de Ventana Externa">
            <div className="space-y-4 p-4 border rounded-md bg-muted/20">
                <div>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="chromePath" className="font-semibold text-base">Ruta del Binario del Navegador</Label>
                        <TooltipProvider delayDuration={100}>
                            <Tooltip>
                                <TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger>
                                <TooltipContent className="max-w-xs text-sm">
                                    <p className="font-bold mb-1">Ejemplos de Rutas:</p>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li><span className="font-mono bg-muted/50 p-0.5 rounded">/opt/google/chrome/google-chrome</span> (Linux - Arch)</li>
                                        <li><span className="font-mono bg-muted/50 p-0.5 rounded">/usr/bin/chromium</span> (Linux)</li>
                                        <li><span className="font-mono bg-muted/50 p-0.5 rounded">/Applications/Google Chrome.app/Contents/MacOS/Google Chrome</span> (macOS)</li>
                                        <li><span className="font-mono bg-muted/50 p-0.5 rounded">C:\Program Files\Google\Chrome\Application\chrome.exe</span> (Windows)</li>
                                    </ul>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <p className="text-xs text-muted-foreground">Ruta exacta al ejecutable en tu sistema para poder abrir la ventana del scoreboard.</p>
                    <Input id="chromePath" value={config.binaryPath} onChange={(e) => handleConfigChange('binaryPath', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                        <Label htmlFor="pos-x" className="text-sm">Posición X</Label>
                        <Input id="pos-x" value={config.posX} onChange={e => handleConfigChange('posX', e.target.value)} placeholder="1920" />
                    </div>
                    <div>
                        <Label htmlFor="pos-y" className="text-sm">Posición Y</Label>
                        <Input id="pos-y" value={config.posY} onChange={e => handleConfigChange('posY', e.target.value)} placeholder="0" />
                    </div>
                    <div>
                        <Label htmlFor="width" className="text-sm">Ancho</Label>
                        <Input id="width" value={config.width} onChange={e => handleConfigChange('width', e.target.value)} placeholder="1920" />
                    </div>
                    <div>
                        <Label htmlFor="height" className="text-sm">Alto</Label>
                        <Input id="height" value={config.height} onChange={e => handleConfigChange('height', e.target.value)} placeholder="1080" />
                    </div>
                </div>
                 <p className="text-xs text-muted-foreground pt-2">Los cambios se guardan automáticamente en el almacenamiento local de tu navegador.</p>
            </div>
        </ControlCardWrapper>
    );
};
