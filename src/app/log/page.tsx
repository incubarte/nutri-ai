'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

/* ─── Types ─── */
interface AnalysisResult {
    intent: 'food' | 'workout' | 'both';
    food?: {
        total: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
        description: string;
        items: any[];
    };
    workout?: {
        name: string; emoji: string; type: string; duration: number;
        intensity: string; caloriesBurned: number; description: string;
        adjustments: { additionalCalories: number; additionalProtein: number; additionalCarbs: number; additionalWater: number };
    };
}

const QUICK_EXERCISES = [
    { id: 'gym', label: 'Gym', emoji: '🏋️' },
    { id: 'roller_hockey', label: 'Roller Hockey', emoji: '🛼' },
    { id: 'ice_hockey', label: 'Ice Hockey', emoji: '🏒' },
    { id: 'futbol', label: 'Fútbol', emoji: '⚽' },
    { id: 'paddle', label: 'Paddle', emoji: '🎾' },
    { id: 'correr', label: 'Correr', emoji: '🏃' },
    { id: 'otros', label: 'Otros', emoji: '✨' },
];

const DURATIONS = [30, 45, 60, 90, 120];
const INTENSITIES = [
    { id: 'baja', label: 'Relajado', color: 'var(--nutri-green)' },
    { id: 'moderada', label: 'Normal', color: 'var(--nutri-yellow)' },
    { id: 'alta', label: 'Intenso', color: 'var(--nutri-orange)' },
];

function dateKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function timeStr(d: Date) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function NutriLogPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);

    /* ─── State ─── */
    const [view, setView] = useState<'selection' | 'mic' | 'quick' | 'result'>('selection');
    const [transcript, setTranscript] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [photos, setPhotos] = useState<{ url: string; base64: string }[]>([]);
    const [profile, setProfile] = useState<any>(null);
    const [result, setResult] = useState<AnalysisResult | null>(null);

    /* Quick Select State */
    const [quickEx, setQuickEx] = useState<string | null>(null);
    const [quickDur, setQuickDur] = useState<number>(60);
    const [quickInt, setQuickInt] = useState<string>('moderada');

    useEffect(() => {
        const p = localStorage.getItem('nutri_profile');
        if (p) setProfile(JSON.parse(p));
    }, []);

    const toggleVoice = useCallback(() => {
        if (isRecording) {
            if (recognitionRef.current) recognitionRef.current.stop();
            setIsRecording(false);
            return;
        }
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) return;
        const rec = new SR();
        recognitionRef.current = rec;
        rec.lang = 'es-AR'; rec.continuous = true; rec.interimResults = true;
        rec.onstart = () => setIsRecording(true);
        rec.onend = () => setIsRecording(false);
        rec.onresult = (e: any) => {
            let full = '';
            for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript + ' ';
            setTranscript(full.trim());
        };
        rec.start();
    }, [isRecording]);

    const handlePhotoAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        for (const file of files) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const base64 = ev.target?.result as string;
                setPhotos(prev => [...prev, { url: URL.createObjectURL(file), base64 }].slice(0, 3));
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const removePhoto = (index: number) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handleAnalyze = async (overrideTranscript?: string) => {
        setAnalyzing(true);
        try {
            const body: any = {
                transcript: overrideTranscript || transcript,
                profile,
                images: photos.map(p => p.base64)
            };
            if (view === 'quick' && quickEx) {
                body.quickData = { type: quickEx, duration: quickDur, intensity: quickInt };
            }

            const res = await fetch('/api/nutri/analyze-universal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Error en el análisis');
            }
            const data = await res.json();
            setResult(data);
            setView('result');
        } catch (err: any) {
            console.error(err);
            alert('❌ ' + (err.message || 'Error al analizar con IA. Intentá de nuevo.'));
        } finally {
            setAnalyzing(false);
        }
    };

    const handleSave = () => {
        if (!result) return;
        const now = new Date();
        const key = dateKey(now);
        const raw = localStorage.getItem(`nutri_log_${key}`);
        const dayLog = raw ? JSON.parse(raw) : { date: key, meals: [], workouts: [] };

        if (result.intent === 'food' || result.intent === 'both') {
            const f = result.food!;
            dayLog.meals.push({
                id: Date.now().toString(),
                name: f.description.split('.')[0].slice(0, 35) || 'Comida',
                time: timeStr(now),
                ...f.total,
                emoji: f.items[0]?.emoji || '🍽️',
                imageUrl: photos[0]?.url
            });
        }

        if (result.intent === 'workout' || result.intent === 'both') {
            const w = result.workout!;
            dayLog.workouts.push({
                ...w,
                id: (Date.now() + 1).toString(),
                time: timeStr(now)
            });
        }

        localStorage.setItem(`nutri_log_${key}`, JSON.stringify(dayLog));
        router.push('/');
    };

    const resetView = () => {
        setView('selection');
        setResult(null);
        setTranscript('');
        setQuickEx(null);
        setPhotos([]);
    };

    return (
        <div className="nutri-app">
            <div className="nutri-topbar">
                <div className="nutri-topbar-inner">
                    <button onClick={() => view === 'selection' ? router.back() : resetView()} style={{ background: 'transparent', border: 'none', color: 'var(--nutri-text-muted)', fontSize: 16 }}>← Volver</button>
                    <span style={{ fontWeight: 800 }}>{view === 'quick' ? 'Actividad Rápida' : 'NutriAI Automágico'}</span>
                    <div style={{ width: 60 }} />
                </div>
            </div>

            <div className="nutri-screen">
                <div className="nutri-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* SELECTION VIEW */}
                    {view === 'selection' && (
                        <div className="nutri-anim-up" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 30 }}>
                            <button
                                className="nutri-card"
                                onClick={() => setView('mic')}
                                style={{ textAlign: 'left', padding: 28, display: 'flex', alignItems: 'center', gap: 20, cursor: 'pointer', border: '1px solid rgba(88,166,255,0.25)', background: 'linear-gradient(135deg, rgba(88,166,255,0.1), transparent)' }}
                            >
                                <div style={{ width: 72, height: 72, borderRadius: 36, background: 'var(--nutri-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, boxShadow: '0 8px 20px rgba(88,166,255,0.3)' }}>🎙️</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>Micrófono + Foto</div>
                                    <div style={{ fontSize: 13, color: 'var(--nutri-text-muted)', lineHeight: 1.4 }}>Hablarle a la IA y/o subir fotos para registro instantáneo.</div>
                                </div>
                            </button>

                            <button
                                className="nutri-card"
                                onClick={() => setView('quick')}
                                style={{ textAlign: 'left', padding: 28, display: 'flex', alignItems: 'center', gap: 20, cursor: 'pointer', border: '1px solid rgba(247,129,102,0.25)', background: 'linear-gradient(135deg, rgba(247,129,102,0.1), transparent)' }}
                            >
                                <div style={{ width: 72, height: 72, borderRadius: 36, background: 'var(--nutri-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, boxShadow: '0 8px 20px rgba(247,129,102,0.3)' }}>⚡</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>Actividad Rápida</div>
                                    <div style={{ fontSize: 13, color: 'var(--nutri-text-muted)', lineHeight: 1.4 }}>Elegir deporte, duración e intensidad en un toque.</div>
                                </div>
                            </button>

                            <div style={{ textAlign: 'center', marginTop: 10, padding: 20, opacity: 0.6 }}>
                                <p style={{ fontSize: 13 }}>Todo lo que registres se analiza con <br /><strong style={{ color: 'var(--nutri-blue)' }}>Gemini 1.5 Flash AI</strong></p>
                            </div>
                        </div>
                    )}

                    {/* MIC + PHOTO VIEW */}
                    {view === 'mic' && (
                        <div className="nutri-card nutri-anim-up" style={{
                            textAlign: 'center', padding: '30px 20px',
                            background: 'linear-gradient(135deg, rgba(57,211,83,0.03), rgba(88,166,255,0.03))',
                            border: 'none', minHeight: '70vh', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start'
                        }}>

                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 30, marginBottom: 20, marginTop: 20 }}>
                                {/* Camera button left of mic */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{ width: 56, height: 56, borderRadius: 28, background: 'var(--nutri-border)', border: 'none', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    📸
                                </button>
                                <input ref={fileInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={handlePhotoAdd} />

                                {/* Main Mic */}
                                <div style={{ position: 'relative' }}>
                                    {isRecording && <div className="nutri-voice-waves" style={{ scale: '1.6' }}><div className="nutri-voice-wave" /><div className="nutri-voice-wave" /><div className="nutri-voice-wave" /></div>}
                                    <button
                                        className={`nutri-voice-btn ${isRecording ? 'recording' : ''}`}
                                        onClick={toggleVoice}
                                        style={{
                                            width: 100, height: 100, fontSize: 44,
                                            boxShadow: isRecording ? '0 0 40px rgba(57,211,83,0.5)' : '0 10px 30px rgba(0,0,0,0.3)'
                                        }}
                                    >
                                        {isRecording ? '🛑' : '🎙️'}
                                    </button>
                                </div>

                                {/* Empty spacer or status icon right of mic */}
                                <div style={{ width: 56, height: 56, borderRadius: 28, background: transcript ? 'var(--nutri-blue-dim)' : 'transparent', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {transcript ? '✍️' : ''}
                                </div>
                            </div>

                            <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>NutriAI te escucha</h2>
                            <p style={{ fontSize: 14, color: 'var(--nutri-text-muted)', marginBottom: 24 }}>Hablá, subí fotos o hacé las dos cosas</p>

                            {/* Photos Preview */}
                            {photos.length > 0 && (
                                <div className="nutri-anim-fade-in" style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
                                    {photos.map((p, i) => (
                                        <div key={i} style={{ position: 'relative' }}>
                                            <img src={p.url} style={{ width: 70, height: 70, borderRadius: 12, objectFit: 'cover', border: '2px solid var(--nutri-blue)' }} alt="" />
                                            <button onClick={() => removePhoto(i)} style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: 11, background: '#e74c3c', color: '#fff', border: 'none', fontSize: 12, fontWeight: 900 }}>✕</button>
                                        </div>
                                    ))}
                                    {photos.length < 3 && (
                                        <button onClick={() => fileInputRef.current?.click()} style={{ width: 70, height: 70, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '2px dashed rgba(255,255,255,0.2)', fontSize: 24, color: 'var(--nutri-text-muted)' }}>+</button>
                                    )}
                                </div>
                            )}

                            <textarea
                                className="nutri-transcript-box"
                                value={transcript}
                                onChange={(e) => setTranscript(e.target.value)}
                                placeholder='Ej: "Almorcé un bife de chorizo" o "Subí una foto de mi almuerzo..."'
                                style={{
                                    flex: 1,
                                    width: '100%',
                                    minHeight: 140,
                                    padding: 22,
                                    background: 'rgba(0,0,0,0.25)',
                                    borderRadius: 18,
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    fontSize: 16,
                                    textAlign: 'left',
                                    color: 'var(--nutri-text)',
                                    resize: 'none',
                                    outline: 'none',
                                    fontFamily: 'inherit',
                                    transition: 'border-color 0.2s ease',
                                    marginTop: 10
                                }}
                            />

                            {(transcript || photos.length > 0) && !analyzing && (
                                <button className="nutri-btn nutri-btn-primary nutri-btn-full nutri-btn-lg" onClick={() => handleAnalyze()} style={{ marginTop: 24, height: 64, fontSize: 18 }}>
                                    🚀 Analizar {photos.length > 0 ? (transcript ? 'Voz + Fotos' : 'Fotos') : 'Grabación'}
                                </button>
                            )}
                        </div>
                    )}

                    {/* QUICK ACTIVITY VIEW */}
                    {view === 'quick' && (
                        <div className="nutri-anim-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className="nutri-card" style={{ padding: 20 }}>
                                <div className="nutri-section-title" style={{ fontSize: 16, marginBottom: 20 }}>1. Elegí el deporte</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                                    {QUICK_EXERCISES.map(ex => (
                                        <button key={ex.id} onClick={() => setQuickEx(ex.id)}
                                            style={{
                                                padding: '16px 8px', borderRadius: 16, border: `2px solid ${quickEx === ex.id ? 'var(--nutri-orange)' : 'var(--nutri-border)'}`,
                                                background: quickEx === ex.id ? 'rgba(247,129,102,0.1)' : 'var(--nutri-surface-2)',
                                                transition: '0.2s'
                                            }}>
                                            <div style={{ fontSize: 28, marginBottom: 4 }}>{ex.emoji}</div>
                                            <div style={{ fontSize: 10, fontWeight: 900, color: quickEx === ex.id ? 'var(--nutri-orange)' : 'var(--nutri-text)' }}>{ex.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {quickEx && (
                                <div className="nutri-card nutri-anim-up" style={{ padding: 20 }}>
                                    <div className="nutri-section-title" style={{ fontSize: 16, marginBottom: 20 }}>2. Detalles de la sesión</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                        <div>
                                            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--nutri-text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Duración (min)</div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {DURATIONS.map(d => (
                                                    <button key={d} onClick={() => setQuickDur(d)}
                                                        style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `1.5px solid ${quickDur === d ? 'var(--nutri-orange)' : 'var(--nutri-border)'}`, background: quickDur === d ? 'rgba(247,129,102,0.15)' : 'transparent', color: quickDur === d ? 'var(--nutri-orange)' : 'var(--nutri-text-muted)', fontWeight: 900 }}>
                                                        {d}'
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--nutri-text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Esfuerzo / Intensidad</div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {INTENSITIES.map(i => (
                                                    <button key={i.id} onClick={() => setQuickInt(i.id)}
                                                        style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `1.5px solid ${quickInt === i.id ? i.color : 'var(--nutri-border)'}`, background: quickInt === i.id ? `${i.color}22` : 'transparent', color: quickInt === i.id ? i.color : 'var(--nutri-text-muted)', fontWeight: 900 }}>
                                                        {i.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <button className="nutri-btn nutri-btn-primary nutri-btn-full nutri-btn-lg" onClick={() => handleAnalyze()} style={{ marginTop: 10, height: 64, fontSize: 18 }}>
                                            Registrar {QUICK_EXERCISES.find(e => e.id === quickEx)?.label}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ANALYZING VIEW */}
                    {analyzing && (
                        <div className="nutri-loading-overlay" style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)', transition: '0.3s' }}>
                            <div className="nutri-spinner" style={{ width: 64, height: 64, borderWidth: 5 }} />
                            <div style={{ fontSize: 22, fontWeight: 950, marginTop: 28, letterSpacing: -0.5, background: 'linear-gradient(90deg, #39d353, #58a6ff, #39d353)', backgroundSize: '200%', animation: 'shimmer 2s linear infinite', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>NutriAI Cerebro</div>
                            <div style={{ fontSize: 14, color: 'var(--nutri-text-muted)', marginTop: 10, maxWidth: '200px' }}>Analizando alimentos y balance muscular...</div>
                        </div>
                    )}

                    {/* RESULT VIEW */}
                    {view === 'result' && result && !analyzing && (
                        <div className="nutri-anim-up" style={{ paddingBottom: 40 }}>
                            <div className="nutri-card" style={{ border: '2px solid var(--nutri-green)', background: 'rgba(57,211,83,0.04)', padding: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                    <div style={{ fontSize: 20, fontWeight: 900 }}>✨ Análisis IA</div>
                                    <div className="nutri-adj-chip" style={{ background: 'var(--nutri-green)', color: '#000', padding: '5px 12px', fontWeight: 900 }}>OK</div>
                                </div>

                                {result.intent === 'food' || result.intent === 'both' ? (
                                    <div style={{ marginBottom: 24, background: 'rgba(255,255,255,0.04)', padding: 20, borderRadius: 20 }}>
                                        <div style={{ fontWeight: 900, color: 'var(--nutri-green)', fontSize: 12, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1.5 }}>🍽️ Comida</div>
                                        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, lineHeight: 1.4 }}>{result.food?.description}</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 12 }}>
                                            {[
                                                { l: 'kcal', v: Math.round(result.food?.total.calories || 0), c: 'var(--macro-calories)' },
                                                { l: 'Prot', v: Math.round(result.food?.total.protein || 0), c: 'var(--macro-protein)' },
                                                { l: 'Carb', v: Math.round(result.food?.total.carbs || 0), c: 'var(--macro-carbs)' },
                                                { l: 'Grasa', v: Math.round(result.food?.total.fat || 0), c: 'var(--macro-fat)' },
                                            ].map(m => (
                                                <div key={m.l} style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: 18, fontWeight: 900, color: m.c, fontFamily: 'Outfit,sans-serif' }}>{m.v}</div>
                                                    <div style={{ fontSize: 9, color: 'var(--nutri-text-muted)', fontWeight: 800 }}>{m.l}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}

                                {result.intent === 'workout' || result.intent === 'both' ? (
                                    <div style={{ background: 'rgba(247,129,102,0.07)', padding: 20, borderRadius: 20 }}>
                                        <div style={{ fontWeight: 900, color: 'var(--nutri-orange)', fontSize: 12, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1.5 }}>🏋️ Actividad</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 16 }}>
                                            <span style={{ fontSize: 48 }}>{result.workout?.emoji}</span>
                                            <div>
                                                <div style={{ fontSize: 18, fontWeight: 950 }}>{result.workout?.name}</div>
                                                <div style={{ fontSize: 13, color: 'var(--nutri-text-muted)' }}>{result.workout?.duration} min · {result.workout?.intensity}</div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <div style={{ background: 'rgba(255,255,255,0.06)', padding: 14, borderRadius: 16 }}>
                                                <div style={{ fontSize: 10, color: 'var(--nutri-text-muted)', marginBottom: 4, fontWeight: 800 }}>Quemadas</div>
                                                <div style={{ fontSize: 24, fontWeight: 950, color: 'var(--nutri-orange)', fontFamily: 'Outfit,sans-serif' }}>-{result.workout?.caloriesBurned}</div>
                                            </div>
                                            <div style={{ background: 'rgba(57,211,83,0.08)', padding: 14, borderRadius: 16 }}>
                                                <div style={{ fontSize: 10, color: 'var(--nutri-text-muted)', marginBottom: 4, fontWeight: 800 }}>Meta Extra</div>
                                                <div style={{ fontSize: 24, fontWeight: 950, color: 'var(--nutri-green)', fontFamily: 'Outfit,sans-serif' }}>+{result.workout?.adjustments.additionalCalories}</div>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}

                                <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                                    <button className="nutri-btn nutri-btn-ghost" style={{ flex: 1, height: 60 }} onClick={resetView}>🔄 Reintentar</button>
                                    <button className="nutri-btn nutri-btn-primary" style={{ flex: 2, height: 60, fontSize: 17 }} onClick={handleSave}>✅ Confirmar</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
