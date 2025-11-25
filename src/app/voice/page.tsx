'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mic, MicOff, Settings } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'system';
  text: string;
  timestamp: Date;
  parsed?: {
    teamName: string | null;
    playerNumbers: string[];
    action: string;
    corrected: string;
  };
  event?: any; // Structured game event
}

interface Player {
  id: string;
  number: string;
  name: string;
  isPresent: boolean;
}

interface TeamData {
  name: string;
  players: Player[];
}

export default function VoiceControlPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [homeTeam, setHomeTeam] = useState<TeamData | null>(null);
  const [awayTeam, setAwayTeam] = useState<TeamData | null>(null);
  const [isContinuousMode, setIsContinuousMode] = useState(true); // Toggle mode
  const [silenceDuration, setSilenceDuration] = useState(1500); // Configurable silence duration in ms
  const [volumeThreshold, setVolumeThreshold] = useState(25); // Volume threshold (0-100)
  const [currentVolume, setCurrentVolume] = useState(0); // Current audio level (0-100)
  const [isDetectingSpeech, setIsDetectingSpeech] = useState(false); // Visual indicator
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceDetectionRef = useRef<number | null>(null);
  const silenceDurationRef = useRef(silenceDuration); // Keep ref in sync for callback
  const volumeThresholdRef = useRef(volumeThreshold); // Keep ref in sync for callback

  // Update refs when state changes
  useEffect(() => {
    silenceDurationRef.current = silenceDuration;
    volumeThresholdRef.current = volumeThreshold;
  }, [silenceDuration, volumeThreshold]);

  // Continuous mode: toggle on/off with chunks on silence
  const startContinuousRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup audio analysis for silence detection
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      chunksRef.current = [];
      let isCurrentlyRecording = false; // Track if actively recording a command
      let currentRecorder: MediaRecorder | null = null;

      const startRecordingCommand = () => {
        if (!streamRef.current || isCurrentlyRecording) {
          console.log('[Voice] ❌ Cannot start - no stream or already recording');
          return;
        }

        console.log('[Voice] 🎤 Starting to record command');
        chunksRef.current = [];
        isCurrentlyRecording = true;

        const recorder = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm' });

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          console.log('[Voice] 🛑 Recorder stopped, processing...');

          // Process the recorded audio
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const chunkCount = chunksRef.current.length;

          console.log(`[Voice] 📊 Audio captured: ${audioBlob.size} bytes, ${chunkCount} chunks`);

          // Validation
          const MIN_SIZE = 5000; // 5KB minimum
          const MIN_CHUNKS = 5; // 0.5 seconds minimum

          if (audioBlob.size > MIN_SIZE && chunkCount >= MIN_CHUNKS) {
            console.log(`[Voice] ✅ Audio valid - sending to Whisper`);
            addMessage('system', `📤 Enviando audio (${(audioBlob.size / 1000).toFixed(1)}KB)`);
            sendAudio(audioBlob);
          } else {
            console.log(`[Voice] ⏭️ Audio too small - skipped (${audioBlob.size} bytes, ${chunkCount} chunks)`);
            addMessage('system', `⏭️ Audio muy corto - ignorado`);
          }

          chunksRef.current = [];
          isCurrentlyRecording = false;
          currentRecorder = null;

          console.log('[Voice] ⏸️ Back to WAITING state - discarding all audio until next speech');
        };

        currentRecorder = recorder;
        recorder.start(100); // Capture every 100ms
      };

      const stopRecordingCommand = () => {
        if (!isCurrentlyRecording || !currentRecorder) {
          console.log('[Voice] ⚠️ Cannot stop - not recording');
          return;
        }

        console.log('[Voice] Silence detected - stopping recording');
        currentRecorder.stop();
      };

      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      // Start silence detection
      detectSilenceAndProcess(
        analyser,
        () => {
          // On silence detected after speech
          if (isCurrentlyRecording) {
            stopRecordingCommand();
            setIsDetectingSpeech(false);
          }
        },
        (isSpeaking) => {
          // Called when speech is detected
          if (isSpeaking && !isCurrentlyRecording) {
            console.log('[Voice] 🎤 Speech detected - will start recording');
            setIsDetectingSpeech(true);
            addMessage('system', '🎤 Detectando habla...');

            // Start recording this command
            startRecordingCommand();
          }
        }
      );

      addMessage('system', '🎤 Modo continuo activado - Hablá con pausas naturales');

    } catch (error) {
      console.error('Error accessing microphone:', error);
      addMessage('system', 'Error: No se pudo acceder al micrófono');
    }
  };

  const stopContinuousRecording = () => {
    // Reset visual indicators
    setIsDetectingSpeech(false);
    setCurrentVolume(0);

    // Stop silence detection
    if (silenceDetectionRef.current) {
      cancelAnimationFrame(silenceDetectionRef.current);
      silenceDetectionRef.current = null;
    }

    // Clear any pending chunks
    chunksRef.current = [];

    // Set to null to signal we're shutting down
    mediaRecorderRef.current = null;

    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsRecording(false);
    addMessage('system', '⏸️ Modo continuo desactivado');
  };

  // Detect silence and trigger callback
  const detectSilenceAndProcess = (
    analyser: AnalyserNode,
    onSilence: () => void,
    onSpeechDetected?: (isSpeaking: boolean) => void
  ) => {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let silenceStart = Date.now();
    let wasSpeaking = false;

    const checkAudioLevel = () => {
      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume (0-255)
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;

      // Update visual volume indicator (convert to 0-100 scale)
      const volumePercent = Math.min(100, Math.round((average / 255) * 100));
      setCurrentVolume(volumePercent);

      // Use configurable threshold (scaled from 0-100 to 0-255)
      const threshold = (volumeThresholdRef.current / 100) * 255;

      const isSpeaking = average >= threshold;

      if (!isSpeaking) {
        // Silent (below threshold) - ruido de fondo cuenta como silencio
        if (wasSpeaking) {
          // Just stopped speaking - notify transition to silence
          wasSpeaking = false;
          silenceStart = Date.now();
          if (onSpeechDetected) {
            onSpeechDetected(false); // Notify we're in silence now
          }
        }

        // Check if silence duration reached
        if (Date.now() - silenceStart > silenceDurationRef.current) {
          onSilence();
        }
      } else {
        // Speaking (above threshold)
        if (!wasSpeaking) {
          // Just started speaking
          wasSpeaking = true;
          if (onSpeechDetected) {
            onSpeechDetected(true);
          }
        }
        silenceStart = Date.now(); // Reset silence timer while speaking
      }

      silenceDetectionRef.current = requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  };

  // Legacy mode: hold to record (kept for backwards compatibility)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await sendAudio(audioBlob);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);

      addMessage('user', 'Grabando...');

    } catch (error) {
      console.error('Error accessing microphone:', error);
      addMessage('system', 'Error: No se pudo acceder al micrófono');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      setMessages(prev => {
        const newMessages = [...prev];
        if (newMessages[newMessages.length - 1]?.type === 'user') {
          newMessages[newMessages.length - 1].text = 'Audio enviado';
        }
        return newMessages;
      });
    }
  };

  const toggleRecording = () => {
    if (isContinuousMode) {
      if (isRecording) {
        stopContinuousRecording();
      } else {
        startContinuousRecording();
      }
    } else {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  };

  const sendAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);

      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        const parsed = {
          teamName: result.teamName,
          playerNumbers: result.playerNumbers || [],
          action: result.action,
          corrected: result.corrected
        };

        let displayText = `"${result.raw}"`;
        if (result.corrected !== result.raw) {
          displayText += ` → "${result.corrected}"`;
        }

        addMessage('system', displayText, parsed, result.event);
      } else {
        addMessage('system', `Error: ${result.error || 'No se pudo transcribir'}`);
      }

    } catch (error) {
      console.error('Error sending audio:', error);
      addMessage('system', 'Error al procesar el audio');
    } finally {
      setIsProcessing(false);
    }
  };

  const addMessage = (type: 'user' | 'system', text: string, parsed?: Message['parsed'], event?: any) => {
    const message: Message = {
      id: Date.now().toString(),
      type,
      text,
      timestamp: new Date(),
      parsed,
      event
    };
    setMessages(prev => [...prev, message]);
  };

  const clearMessages = () => {
    setMessages([]);
  };

  // Load team data on mount
  useEffect(() => {
    const loadTeamData = async () => {
      try {
        const response = await fetch('/api/voice/teams');
        const data = await response.json();
        if (data.success) {
          setHomeTeam(data.homeTeam);
          setAwayTeam(data.awayTeam);
        }
      } catch (error) {
        console.error('Error loading team data:', error);
      }
    };
    loadTeamData();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center py-4">
          <h1 className="text-2xl font-bold">🎤 Control por Voz</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[250px_1fr_250px] gap-4">
          {/* Left: Home Team Players */}
          <Card className="p-4 h-[calc(100vh-200px)] overflow-y-auto">
            <h2 className="font-bold text-lg mb-3 text-center border-b pb-2">
              {homeTeam?.name || 'Equipo Local'}
            </h2>
            <div className="space-y-1">
              {homeTeam ? (
                homeTeam.players.map((player) => (
                  <div
                    key={player.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 ${
                      !player.isPresent ? 'opacity-40' : ''
                    }`}
                  >
                    <span className="font-bold text-sm w-8">
                      {player.number || '-'}
                    </span>
                    <span className="text-xs truncate">
                      {player.name}
                    </span>
                    {!player.isPresent && (
                      <span className="text-[10px] text-muted-foreground ml-auto">ausente</span>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Cargando...
                </p>
              )}
            </div>
          </Card>

          {/* Center: Controls and Messages */}
          <div className="flex flex-col gap-4">
            {/* Mode Toggle */}
            <Card className="p-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="continuous-mode" className="text-sm font-medium">
                  Modo Continuo {isContinuousMode && '(Recomendado)'}
                </Label>
                <button
                  id="continuous-mode"
                  onClick={() => {
                    if (isRecording) {
                      // Stop recording before switching modes
                      if (isContinuousMode) {
                        stopContinuousRecording();
                      } else {
                        stopRecording();
                      }
                    }
                    setIsContinuousMode(!isContinuousMode);
                  }}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${isContinuousMode ? 'bg-primary' : 'bg-muted'}
                  `}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                      ${isContinuousMode ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isContinuousMode
                  ? 'Click para activar → hablá con pausas → click para desactivar'
                  : 'Mantén presionado para grabar → suelta para enviar'}
              </p>

              {/* Silence Duration Control - Only show in continuous mode */}
              {isContinuousMode && (
                <div className="mt-3 pt-3 border-t space-y-3">
                  {/* Silence Duration */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="silence-duration" className="text-xs font-medium">
                        Pausa para procesar
                      </Label>
                      <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                        {(silenceDuration / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <input
                      id="silence-duration"
                      type="range"
                      min="500"
                      max="3000"
                      step="100"
                      value={silenceDuration}
                      onChange={(e) => setSilenceDuration(parseInt(e.target.value))}
                      disabled={isRecording}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>0.5s (rápido)</span>
                      <span>3s (lento)</span>
                    </div>
                  </div>

                  {/* Volume Threshold */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="volume-threshold" className="text-xs font-medium">
                        Filtro de ruido
                      </Label>
                      <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                        {volumeThreshold}%
                      </span>
                    </div>
                    <input
                      id="volume-threshold"
                      type="range"
                      min="5"
                      max="50"
                      step="1"
                      value={volumeThreshold}
                      onChange={(e) => setVolumeThreshold(parseInt(e.target.value))}
                      disabled={isRecording}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>5% (muy sensible)</span>
                      <span>50% (solo voz alta)</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      💡 Si procesa ruidos de fondo → subir. Si no detecta tu voz → bajar.
                    </p>
                  </div>
                </div>
              )}
            </Card>

            {/* Record Button */}
            <div className="flex flex-col items-center gap-3">
              <button
                {...(isContinuousMode
                  ? { onClick: toggleRecording }
                  : {
                      onMouseDown: startRecording,
                      onMouseUp: stopRecording,
                      onTouchStart: startRecording,
                      onTouchEnd: stopRecording,
                    })}
                disabled={isProcessing}
                className={`
                  w-24 h-24 rounded-full text-white font-bold
                  transition-all duration-200 active:scale-95
                  shadow-lg
                  ${isRecording
                    ? 'bg-green-600 scale-110 shadow-green-500/50 ' + (isContinuousMode ? 'animate-pulse' : '')
                    : isProcessing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-500 hover:bg-red-600 active:bg-red-700'
                  }
                `}
              >
                {isRecording ? (
                  <Mic className="w-10 h-10 mx-auto" />
                ) : isProcessing ? (
                  <div className="text-xs">Procesando...</div>
                ) : (
                  <MicOff className="w-10 h-10 mx-auto" />
                )}
              </button>

              <p className="text-sm text-muted-foreground text-center">
                {isRecording
                  ? isContinuousMode
                    ? '🟢 Escuchando... (click para detener)'
                    : 'Suelta para enviar'
                  : isProcessing
                  ? 'Transcribiendo audio...'
                  : isContinuousMode
                  ? 'Click para activar modo continuo'
                  : 'Mantén presionado para grabar'
                }
              </p>

              {/* Visual Indicators - Only show in continuous mode while recording */}
              {isContinuousMode && isRecording && (
                <Card className="w-full max-w-xs p-3">
                  {/* Status Indicator */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium">Estado:</span>
                    <div className="flex items-center gap-2">
                      {isDetectingSpeech ? (
                        <>
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          <span className="text-xs font-medium text-green-600">🎤 Grabando</span>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 bg-gray-400 rounded-full" />
                          <span className="text-xs text-muted-foreground">⏸️ Esperando habla</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Volume Meter */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Volumen:</span>
                      <span className="text-xs font-mono">{currentVolume}%</span>
                    </div>
                    {/* Volume Bar */}
                    <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                      {/* Volume Fill */}
                      <div
                        className={`absolute top-0 left-0 h-full transition-all duration-75 ${
                          currentVolume >= volumeThreshold
                            ? 'bg-green-500'
                            : 'bg-gray-400'
                        }`}
                        style={{ width: `${currentVolume}%` }}
                      />
                      {/* Threshold Line */}
                      <div
                        className="absolute top-0 h-full w-0.5 bg-red-500"
                        style={{ left: `${volumeThreshold}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>0%</span>
                      <span className="text-red-600">← {volumeThreshold}% threshold</span>
                      <span>100%</span>
                    </div>
                  </div>
                </Card>
              )}

              {messages.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearMessages}
                >
                  Limpiar mensajes
                </Button>
              )}
            </div>

            {/* Messages Log (Stack - newest on top) */}
            <Card className="p-4 flex-1 overflow-y-auto h-[calc(100vh-350px)] flex flex-col">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-20">
                  No hay mensajes aún
                </div>
              ) : (
                <div className="space-y-3">
                  {[...messages].reverse().map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-2 ${
                          message.type === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm">{message.text}</p>

                        {/* Parsed info summary */}
                        {message.parsed && (
                          <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                            {message.parsed.action && message.parsed.action !== 'unknown' && (
                              <p className="text-xs font-semibold text-green-600">
                                ✓ Acción: {message.parsed.action === 'shot' ? 'Tiro' : message.parsed.action === 'goal' ? 'Gol' : message.parsed.action === 'penalty' ? 'Penalización' : 'Timeout'}
                              </p>
                            )}
                            {message.parsed.teamName && (
                              <p className="text-xs">
                                🏒 Equipo: <span className="font-medium">{message.parsed.teamName}</span>
                              </p>
                            )}
                            {message.parsed.playerNumbers.length > 0 && (
                              <p className="text-xs">
                                👤 Jugador(es): <span className="font-medium">{message.parsed.playerNumbers.join(', ')}</span>
                              </p>
                            )}
                            {(!message.parsed.teamName && message.parsed.action !== 'unknown') && (
                              <p className="text-xs text-orange-600">
                                ⚠️ Equipo no reconocido
                              </p>
                            )}
                            {(message.parsed.playerNumbers.length === 0 && message.parsed.action !== 'unknown' && message.parsed.action !== 'timeout') && (
                              <p className="text-xs text-orange-600">
                                ⚠️ Jugador no reconocido
                              </p>
                            )}
                          </div>
                        )}

                        {/* Structured Event JSON - always show if available */}
                        {message.event && (
                          <div className="mt-2 pt-2 border-t border-border/50">
                            <details className="text-xs">
                              <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground">
                                📋 Ver JSON
                              </summary>
                              <pre className="text-[10px] bg-black/20 p-2 rounded overflow-x-auto mt-1">
                                {JSON.stringify(message.event, null, 2)}
                              </pre>
                            </details>
                          </div>
                        )}

                        <p className="text-xs opacity-70 mt-1">
                          {message.timestamp.toLocaleTimeString('es-AR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right: Away Team Players */}
          <Card className="p-4 h-[calc(100vh-200px)] overflow-y-auto">
            <h2 className="font-bold text-lg mb-3 text-center border-b pb-2">
              {awayTeam?.name || 'Equipo Visitante'}
            </h2>
            <div className="space-y-1">
              {awayTeam ? (
                awayTeam.players.map((player) => (
                  <div
                    key={player.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 ${
                      !player.isPresent ? 'opacity-40' : ''
                    }`}
                  >
                    <span className="font-bold text-sm w-8">
                      {player.number || '-'}
                    </span>
                    <span className="text-xs truncate">
                      {player.name}
                    </span>
                    {!player.isPresent && (
                      <span className="text-[10px] text-muted-foreground ml-auto">ausente</span>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Cargando...
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
