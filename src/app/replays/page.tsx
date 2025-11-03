
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Video, ListVideo, Loader2, RefreshCw, Download, Play, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendRemoteCommand } from '@/app/actions';

type LoadingStatus = 'idle' | 'loading' | 'success' | 'error';
type DownloadStatus = 'idle' | 'downloading' | 'success' | 'error';

export default function ReplaysPage() {
    const [replayFiles, setReplayFiles] = useState<string[]>([]);
    const [selectedReplay, setSelectedReplay] = useState<string | null>(null);
    const [status, setStatus] = useState<LoadingStatus>('loading');
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const { toast } = useToast();

    // State for the new download functionality
    const [videoUrl, setVideoUrl] = useState('');
    const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle');

    const fetchReplays = async () => {
        setStatus('loading');
        setError(null);
        try {
            const response = await fetch('/api/replays');
            const data = await response.json();
            if (data.success) {
                setReplayFiles(data.files);
                setStatus('success');
            } else {
                throw new Error(data.message || 'Error en el servidor');
            }
        } catch (err: any) {
            setError(err.message || 'No se pudo conectar para obtener la lista de repeticiones.');
            setStatus('error');
        }
    };

    useEffect(() => {
        fetchReplays();
    }, []);

    const handleSelectReplay = (replayFile: string) => {
        setSelectedReplay(`/replays/${replayFile}`);
    };
    
    useEffect(() => {
        if (selectedReplay && videoRef.current) {
            videoRef.current.load();
        }
    }, [selectedReplay]);

    const handleDownloadVideo = async () => {
        if (!videoUrl) {
            toast({ title: "URL Requerida", description: "Por favor, ingresa la URL del video.", variant: "destructive" });
            return;
        }
        setDownloadStatus('downloading');
        try {
            const response = await fetch('/api/download-replay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: videoUrl })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Error en el servidor');

            setDownloadStatus('success');
            toast({ title: "Video Descargado", description: "El video está disponible en la lista de repeticiones." });
            fetchReplays(); // Refresh the list to show the new video
            setVideoUrl(''); // Clear the input

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "No se pudo conectar con el servidor.";
            setDownloadStatus('error');
            toast({ title: "Error de Descarga", description: errorMessage, variant: "destructive" });
        }
    };
    
    const handleShowOnScoreboard = async () => {
        if (!selectedReplay) {
            toast({ title: "Video no seleccionado", description: "Por favor, selecciona un video de la lista para mostrar.", variant: "destructive" });
            return;
        }
        await sendRemoteCommand({ type: 'START_LOADING_REPLAY', payload: { url: selectedReplay } });
        toast({ title: "Comando Enviado", description: "El scoreboard ha recibido la orden de mostrar la repetición." });
    };

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] w-full max-w-7xl mx-auto py-8 gap-6">
            <div className="flex items-center gap-4">
                <Video className="h-8 w-8 text-primary"/>
                <h1 className="text-3xl font-bold text-primary-foreground">Mesa de VAR - Repeticiones</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Descargar Nueva Repetición</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row items-end gap-4">
                    <div className="flex-grow space-y-1 w-full">
                        <Label htmlFor="replayUrl">URL del Video de Repetición</Label>
                        <Input 
                          id="replayUrl" 
                          value={videoUrl} 
                          onChange={(e) => {
                            setVideoUrl(e.target.value);
                            setDownloadStatus('idle'); // Reset status on URL change
                          }}
                          placeholder="https://example.com/video.mp4" 
                        />
                    </div>
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <Button onClick={handleDownloadVideo} disabled={downloadStatus === 'downloading' || !videoUrl} className="w-full sm:w-auto">
                            {downloadStatus === 'downloading' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Descargar Video
                        </Button>
                        {downloadStatus === 'success' && <CheckCircle className="h-6 w-6 text-green-500" />}
                        {downloadStatus === 'error' && <XCircle className="h-6 w-6 text-destructive" />}
                    </div>
                </CardContent>
            </Card>

            <div className="flex-grow grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 overflow-hidden">
                <Card className="col-span-1 flex flex-col">
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2"><ListVideo className="h-5 w-5"/> Lista de Videos</CardTitle>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchReplays} disabled={status === 'loading'}>
                            <RefreshCw className={cn("h-4 w-4", status === 'loading' && "animate-spin")} />
                        </Button>
                    </CardHeader>
                    <CardContent className="flex-grow overflow-hidden">
                        <ScrollArea className="h-full pr-3">
                            {status === 'loading' && <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/></div>}
                            {status === 'error' && <div className="text-destructive text-center p-4">{error}</div>}
                            {status === 'success' && (
                                replayFiles.length > 0 ? (
                                    <div className="space-y-2">
                                        {replayFiles.map(file => (
                                            <Button
                                                key={file}
                                                variant={selectedReplay === `/replays/${file}` ? 'secondary' : 'ghost'}
                                                className="w-full justify-start text-left h-auto"
                                                onClick={() => handleSelectReplay(file)}
                                            >
                                                <span className="truncate py-1">{file}</span>
                                            </Button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-muted-foreground py-10">No hay repeticiones descargadas.</div>
                                )
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-col bg-black">
                     <div className="flex-grow relative">
                        {selectedReplay ? (
                            <video
                                ref={videoRef}
                                key={selectedReplay}
                                className="w-full h-full object-contain"
                                controls
                                autoPlay
                            >
                                <source src={selectedReplay} type="video/mp4" />
                                Tu navegador no soporta el tag de video.
                            </video>
                        ) : (
                            <div className="text-center text-muted-foreground p-8 flex flex-col items-center justify-center h-full">
                                <Video className="h-24 w-24 mx-auto mb-4" />
                                <p className="text-lg">Selecciona un video de la lista para reproducirlo.</p>
                            </div>
                        )}
                     </div>
                     <div className="p-4 border-t border-border/20">
                        <Button onClick={handleShowOnScoreboard} disabled={!selectedReplay}>
                            <Play className="mr-2 h-4 w-4" /> Mostrar en Scoreboard
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
}
