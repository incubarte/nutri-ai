"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Video, ListVideo, Loader2, RefreshCw, Download, Play, CheckCircle, XCircle, Calendar as CalendarIcon, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendRemoteCommand } from '@/app/actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

type LoadingStatus = 'idle' | 'loading' | 'success' | 'error';
type DownloadStatus = 'idle' | 'downloading' | 'success' | 'error';

interface FirebaseReplay {
    id: string;
    location: string;
    url: string;
    filename: string;
    isNew: boolean;
}

export default function ReplaysPage() {
    const [allReplayFiles, setAllReplayFiles] = useState<string[]>([]);
    const [filteredReplayFiles, setFilteredReplayFiles] = useState<string[]>([]);
    const [selectedReplay, setSelectedReplay] = useState<string | null>(null);
    const [status, setStatus] = useState<LoadingStatus>('loading');
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const { toast } = useToast();

    const [videoUrl, setVideoUrl] = useState('');
    const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle');

    const [syncDate, setSyncDate] = useState<Date>(new Date());
    const [isSyncActive, setIsSyncActive] = useState(false);
    const [newReplays, setNewReplays] = useState<FirebaseReplay[]>([]);
    const [isMassDownloading, setIsMassDownloading] = useState(false);
    const [firebaseError, setFirebaseError] = useState<string | null>(null);
    
    const firebaseReplayUrl = "https://hockeando-default-rtdb.firebaseio.com/Replays.json";

    const fetchReplays = useCallback(async () => {
        setStatus('loading');
        setError(null);
        try {
            const response = await fetch('/api/replays');
            const data = await response.json();
            if (data.success) {
                setAllReplayFiles(data.files);
                setStatus('success');
            } else {
                throw new Error(data.message || 'Error en el servidor');
            }
        } catch (err: any) {
            setError(err.message || 'No se pudo conectar para obtener la lista de repeticiones.');
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        fetchReplays();
    }, [fetchReplays]);
    
     useEffect(() => {
        const dateString = format(syncDate, 'yyyy-MM-dd');
        setFilteredReplayFiles(
            allReplayFiles.filter(file => file.includes(dateString))
        );
        setSelectedReplay(null); // Deselect video when date changes
    }, [syncDate, allReplayFiles]);

    const convertGsToHttps = (gsPath: string): string => {
        if (!gsPath.startsWith('gs://')) return '';
        const pathWithoutPrefix = gsPath.substring(5);
        const [bucket, ...filePathParts] = pathWithoutPrefix.split('/');
        const filePath = filePathParts.join('/');
        return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(filePath)}?alt=media`;
    };
    
    useEffect(() => {
        if (!isSyncActive) {
            setNewReplays([]);
            return;
        }

        const sync = async () => {
            try {
                const formattedDate = format(syncDate, 'yyyy-MM-dd');
                const response = await fetch(firebaseReplayUrl);
                if (!response.ok) throw new Error(`Firebase returned status ${response.status}`);
                const data = await response.json();
                
                const dayData = data?.[formattedDate];
                if (!dayData) {
                    setNewReplays([]);
                    setFirebaseError(null);
                    return;
                }

                const fetchedReplays: FirebaseReplay[] = [];
                for (const camId in dayData) {
                    for (const replayId in dayData[camId]) {
                        const location = dayData[camId][replayId].location;
                        if (location && location.startsWith('gs://')) {
                            const filename = location.split('/').pop()?.replace(/%20/g, ' ') || `replay-${replayId}.mp4`;
                            const httpsUrl = convertGsToHttps(location);
                            
                            const expectedLocalPath = `${formattedDate}/${filename}`;

                            if (httpsUrl) {
                                fetchedReplays.push({
                                    id: replayId,
                                    location,
                                    url: httpsUrl,
                                    filename,
                                    isNew: !allReplayFiles.includes(expectedLocalPath) && !allReplayFiles.includes(decodeURIComponent(expectedLocalPath))
                                });
                            }
                        }
                    }
                }
                
                setNewReplays(fetchedReplays.filter(r => r.isNew));
                setFirebaseError(null);
            } catch (err) {
                setFirebaseError("No se pudo conectar a Firebase. Reintentando...");
                console.error("Firebase sync error:", err);
            }
        };

        sync();
        const interval = setInterval(sync, 10000);

        return () => clearInterval(interval);
    }, [isSyncActive, syncDate, allReplayFiles, firebaseReplayUrl]);


    const handleSelectReplay = (replayFile: string) => {
        setSelectedReplay(`/replays/${replayFile}`);
    };
    
    useEffect(() => {
        if (selectedReplay && videoRef.current) {
            videoRef.current.load();
        }
    }, [selectedReplay]);

    const handleDownloadVideo = async (urlToDownload: string, downloadDate?: Date) => {
        if (!urlToDownload) {
            toast({ title: "URL Requerida", description: "Por favor, ingresa la URL del video.", variant: "destructive" });
            return;
        }
        setDownloadStatus('downloading');
        try {
            const body: { url: string, date?: string } = { url: urlToDownload };
            if (downloadDate) {
                body.date = format(downloadDate, 'yyyy-MM-dd');
            }

            const response = await fetch('/api/download-replay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Error en el servidor');

            setDownloadStatus('success');
            setVideoUrl(''); 
            return { success: true, newFilePath: data.path };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "No se pudo conectar con el servidor.";
            setDownloadStatus('error');
            toast({ title: "Error de Descarga", description: errorMessage, variant: "destructive" });
            return { success: false };
        }
    };
    
    const handleMassDownload = async () => {
        setIsMassDownloading(true);
        const downloadedFiles: string[] = [];
        
        for (const replay of newReplays) {
            const result = await handleDownloadVideo(replay.url, syncDate);
            if (result.success && result.newFilePath) {
                downloadedFiles.push(result.newFilePath.replace('/replays/', ''));
            }
        }
        
        if (downloadedFiles.length > 0) {
            setAllReplayFiles(prev => [...prev, ...downloadedFiles]);
        }
        
        setNewReplays([]);
        setIsMassDownloading(false);
        toast({
            title: "Descarga Masiva Completa",
            description: `${downloadedFiles.length} videos descargados.`,
        });
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
        <div className="w-full max-w-7xl mx-auto py-8 space-y-6">
            <div className="flex items-center gap-4">
                <Video className="h-8 w-8 text-primary"/>
                <h1 className="text-3xl font-bold text-primary-foreground">Mesa de VAR - Repeticiones</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Herramientas de Video</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row items-start gap-4">
                    <div className="flex-grow space-y-1 w-full">
                        <Label htmlFor="replayUrl">Descargar desde URL Manualmente</Label>
                        <div className="flex items-center gap-2">
                            <Input 
                              id="replayUrl" 
                              value={videoUrl} 
                              onChange={(e) => {
                                setVideoUrl(e.target.value);
                                setDownloadStatus('idle');
                              }}
                              placeholder="https://example.com/video.mp4" 
                            />
                             <Button onClick={() => handleDownloadVideo(videoUrl)} disabled={downloadStatus === 'downloading' || !videoUrl}>
                                {downloadStatus === 'downloading' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                Descargar
                            </Button>
                        </div>
                    </div>
                     <div className="border-t sm:border-l sm:border-t-0 pt-4 sm:pt-0 sm:pl-4">
                        <Label>Sincronización Automática</Label>
                         <div className="flex items-center gap-2">
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full sm:w-auto justify-start text-left font-normal", !syncDate && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {syncDate ? format(syncDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={syncDate} onSelect={(date) => date && setSyncDate(date)} initialFocus locale={es} />
                                </PopoverContent>
                            </Popover>
                            <Button onClick={() => setIsSyncActive(!isSyncActive)} variant={isSyncActive ? 'destructive' : 'default'}>
                                {isSyncActive ? "Detener Sync" : "Iniciar Sync"}
                            </Button>
                        </div>
                     </div>
                </CardContent>
            </Card>
            
            {isSyncActive && (
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center justify-between">
                            Nuevas Repeticiones Disponibles ({newReplays.length})
                            {firebaseError && <span className="text-xs font-normal text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4"/> {firebaseError}</span>}
                        </CardTitle>
                    </CardHeader>
                    {newReplays.length > 0 && (
                        <CardContent>
                            <ScrollArea className="h-24 pr-3">
                                <div className="space-y-1">
                                    {newReplays.map(replay => (
                                        <div key={replay.id} className="text-sm text-muted-foreground truncate">{decodeURIComponent(replay.filename)}</div>
                                    ))}
                                </div>
                            </ScrollArea>
                             <Button onClick={handleMassDownload} disabled={isMassDownloading} className="mt-4 w-full">
                                {isMassDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                Descargar {newReplays.length} Videos Nuevos
                            </Button>
                        </CardContent>
                    )}
                 </Card>
            )}

            <div className="flex-grow grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                <Card className="col-span-1 flex flex-col">
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2"><ListVideo className="h-5 w-5"/> Videos Descargados</CardTitle>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchReplays} disabled={status === 'loading'}>
                            <RefreshCw className={cn("h-4 w-4", status === 'loading' && "animate-spin")} />
                        </Button>
                    </CardHeader>
                    <CardContent className="flex-grow overflow-hidden">
                        <ScrollArea className="h-full pr-3">
                            {status === 'loading' && <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/></div>}
                            {status === 'error' && <div className="text-destructive text-center p-4">{error}</div>}
                            {status === 'success' && (
                                filteredReplayFiles.length > 0 ? (
                                    <div className="space-y-2">
                                        {filteredReplayFiles.map(file => (
                                            <Button
                                                key={file}
                                                variant={selectedReplay === `/replays/${file}` ? 'secondary' : 'ghost'}
                                                className="w-full justify-start text-left h-auto"
                                                onClick={() => handleSelectReplay(file)}
                                            >
                                                <span className="truncate py-1">{file.split('/').pop()}</span>
                                            </Button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-muted-foreground py-10">No hay repeticiones descargadas para la fecha seleccionada.</div>
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
                                onLoadedMetadata={(e) => { e.currentTarget.currentTime = 4; }}
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
