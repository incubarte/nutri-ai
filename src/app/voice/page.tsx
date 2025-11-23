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
}

interface Player {
  id: string;
  number: string;
  name: string;
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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

      // Add user message
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

      // Update last message
      setMessages(prev => {
        const newMessages = [...prev];
        if (newMessages[newMessages.length - 1]?.type === 'user') {
          newMessages[newMessages.length - 1].text = 'Audio enviado';
        }
        return newMessages;
      });
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

        addMessage('system', displayText, parsed);
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

  const addMessage = (type: 'user' | 'system', text: string, parsed?: Message['parsed']) => {
    const message: Message = {
      id: Date.now().toString(),
      type,
      text,
      timestamp: new Date(),
      parsed
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
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50"
                  >
                    <span className="font-bold text-sm w-8">
                      {player.number || '-'}
                    </span>
                    <span className="text-xs truncate">
                      {player.name}
                    </span>
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
            {/* Record Button */}
            <div className="flex flex-col items-center gap-3">
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                disabled={isProcessing}
                className={`
                  w-24 h-24 rounded-full text-white font-bold
                  transition-all duration-200 active:scale-95
                  shadow-lg
                  ${isRecording
                    ? 'bg-red-600 scale-110 shadow-red-500/50 animate-pulse'
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
                  ? 'Suelta para enviar'
                  : isProcessing
                  ? 'Transcribiendo audio...'
                  : 'Mantén presionado para grabar'
                }
              </p>

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

                        {/* Parsed info */}
                        {message.parsed && (
                          <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                            {message.parsed.action && message.parsed.action !== 'unknown' && (
                              <p className="text-xs font-semibold text-green-600">
                                ✓ Acción: {message.parsed.action === 'shot' ? 'Tiro' : message.parsed.action === 'goal' ? 'Gol' : 'Penalización'}
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
                            {(message.parsed.playerNumbers.length === 0 && message.parsed.action !== 'unknown') && (
                              <p className="text-xs text-orange-600">
                                ⚠️ Jugador no reconocido
                              </p>
                            )}
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
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50"
                  >
                    <span className="font-bold text-sm w-8">
                      {player.number || '-'}
                    </span>
                    <span className="text-xs truncate">
                      {player.name}
                    </span>
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
