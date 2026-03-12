'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Profile {
    gender: 'male' | 'female' | 'other';
    age: number;
    weight: number;
    height: number;
    activityLevel: number;
    goal: string;
    apiKey?: string;
}

const GOALS = [
    { id: 'weight_loss', icon: '🔥', label: 'Bajar\nde peso' },
    { id: 'muscle_gain', icon: '💪', label: 'Ganar\nmúsculo' },
    { id: 'both', icon: '⚡', label: 'Ambas\ncosas' },
    { id: 'maintenance', icon: '⚖️', label: 'Mantener\npeso' },
    { id: 'health', icon: '❤️', label: 'Salud\ngeneral' },
    { id: 'sport', icon: '🏃', label: 'Rendimiento\ndeportivo' },
];

const ACTIVITY_LABELS = [
    'Sedentario (poco o nada)',
    'Ligero (1-2 días/sem)',
    'Moderado (3-4 días/sem)',
    'Activo (5 días/sem)',
    'Muy activo (6-7 días/sem)',
    'Atleta (2x día)',
];

export default function NutriSetupPage() {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState('');

    const [profile, setProfile] = useState<Profile>({
        gender: 'male',
        age: 28,
        weight: 75,
        height: 175,
        activityLevel: 2,
        goal: 'weight_loss',
        apiKey: '',
    });

    const [checkingKey, setCheckingKey] = useState(false);
    const [keyStatus, setKeyStatus] = useState<'none' | 'valid' | 'invalid'>('none');

    useEffect(() => {
        const saved = localStorage.getItem('nutri_profile');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setProfile(prev => ({ ...prev, ...parsed }));
            } catch (e) {
                console.error('Error loading saved profile', e);
            }
        }
    }, []);

    // Persist profile on every change
    useEffect(() => {
        localStorage.setItem('nutri_profile', JSON.stringify(profile));
    }, [profile]);

    const totalSteps = 5;
    const progress = ((step + 1) / totalSteps) * 100;

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2500);
    };

    const handleNext = () => {
        if (step < totalSteps - 1) setStep(s => s + 1);
    };

    const testApiKey = async () => {
        if (!profile.apiKey) return;
        setCheckingKey(true);
        setKeyStatus('none');
        try {
            const res = await fetch('/api/nutri/test-api-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: profile.apiKey }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setKeyStatus('valid');
                showToast('✅ ¡API Key válida!');
            } else {
                setKeyStatus('invalid');
                showToast(`❌ ${data.message || 'API Key inválida'}`);
            }
        } catch (err: any) {
            setKeyStatus('invalid');
            showToast('❌ Error de conexión');
            console.error(err);
        } finally {
            setCheckingKey(false);
        }
    };

    const handleBack = () => {
        if (step > 0) setStep(s => s - 1);
    };

    const handleFinish = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/nutri/calculate-macros', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profile),
            });
            if (!res.ok) throw new Error('Error al calcular macros');
            const macros = await res.json();
            localStorage.setItem('nutri_profile', JSON.stringify(profile));
            localStorage.setItem('nutri_macros', JSON.stringify(macros));
            router.push('/');
        } catch {
            showToast('❌ Error al calcular. Intentá de nuevo.');
            setLoading(false);
        }
    }, [profile, router]);

    return (
        <div className="nutri-app">
            {/* Background orbs */}
            <div className="nutri-bg-orb nutri-bg-orb-1" />
            <div className="nutri-bg-orb nutri-bg-orb-2" />
            <div className="nutri-bg-orb nutri-bg-orb-3" />

            {/* Loading overlay */}
            {loading && (
                <div className="nutri-loading-overlay">
                    <div className="nutri-spinner" />
                    <p className="nutri-loading-text">La IA está calculando tus macros personalizados...</p>
                </div>
            )}

            {/* Toast */}
            {toast && <div className="nutri-toast error">{toast}</div>}

            {/* Topbar */}
            <div className="nutri-topbar" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
                <div className="nutri-topbar-inner">
                    <button id="btn-profile-back" onClick={() => router.back()} style={{ background: 'transparent', border: 'none', color: 'var(--nutri-text-muted)', fontSize: 16, cursor: 'pointer' }}>← Volver</button>
                    <span style={{ fontWeight: 800 }}>{step === 0 ? 'Configuración' : 'Paso ' + (step + 1)}</span>
                    <div style={{ width: 60 }} />
                </div>
            </div>

            <div className="nutri-screen" style={{ paddingBottom: 32 }}>
                {/* Hero */}
                {step === 0 && (
                    <div className="nutri-setup-hero nutri-anim-up">
                        <span className="nutri-setup-hero-icon">🥗</span>
                        <h1 className="nutri-setup-hero-title">Bienvenido a NutriAI</h1>
                        <p className="nutri-setup-hero-subtitle">
                            Configuremos tu perfil para<br />calcular tus macros ideales con IA
                        </p>
                    </div>
                )}

                {/* Progress bar */}
                <div className="nutri-container" style={{ paddingTop: step === 0 ? 0 : 24 }}>
                    {/* Step indicator */}
                    <div className="nutri-flex-between nutri-mb-16" style={{ opacity: 0.7 }}>
                        <span className="nutri-text-sm nutri-text-muted">Paso {step + 1} de {totalSteps}</span>
                        <span className="nutri-text-sm nutri-text-muted">{Math.round(progress)}%</span>
                    </div>
                    <div style={{
                        height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 100, marginBottom: 28, overflow: 'hidden',
                    }}>
                        <div style={{
                            height: '100%', width: `${progress}%`, borderRadius: 100,
                            background: 'linear-gradient(90deg, #39d353, #58a6ff)',
                            transition: 'width 0.4s ease',
                        }} />
                    </div>

                    {/* STEP 0: API KEY */}
                    {step === 0 && (
                        <div className="nutri-setup-steps nutri-anim-up">
                            <div className="nutri-step-card">
                                <div className="nutri-step-header">
                                    <div className="nutri-step-number">🔑</div>
                                    <div className="nutri-step-title">Configuración de IA</div>
                                </div>
                                <p style={{ fontSize: 13, color: 'var(--nutri-text-muted)', marginBottom: 16 }}>
                                    Para que NutriAI sea 100% tuyo y privado, te recomendamos usar tu propia clave de Google Gemini. Es gratuita (nivel estándar).
                                </p>
                                <div className="nutri-form-group">
                                    <label className="nutri-label">Gemini API Key</label>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <input
                                            id="api-key-input"
                                            type="password"
                                            className="nutri-input"
                                            placeholder="AIzaSy..."
                                            value={profile.apiKey}
                                            onChange={e => {
                                                setProfile(p => ({ ...p, apiKey: e.target.value.trim() }));
                                                setKeyStatus('none');
                                            }}
                                            style={{ flex: 1, borderColor: keyStatus === 'valid' ? 'var(--nutri-green)' : keyStatus === 'invalid' ? '#e74c3c' : undefined }}
                                        />
                                        <button
                                            className="nutri-btn nutri-btn-ghost"
                                            onClick={testApiKey}
                                            disabled={checkingKey || !profile.apiKey}
                                            style={{ width: 80, fontSize: 12, padding: 0 }}
                                        >
                                            {checkingKey ? '...' : 'Probar'}
                                        </button>
                                    </div>
                                    {keyStatus === 'valid' && <div style={{ fontSize: 11, color: 'var(--nutri-green)', marginTop: 6 }}>✓ Conexión establecida correctamente</div>}
                                    {keyStatus === 'invalid' && <div style={{ fontSize: 11, color: '#e74c3c', marginTop: 6 }}>✗ Clave inválida o error de conexión</div>}
                                </div>
                                <p style={{ fontSize: 11, color: 'var(--nutri-text-muted)', marginTop: 20 }}>
                                    Si la dejás vacía, se usará la clave por defecto del sistema (sujeto a disponibilidad).
                                </p>
                            </div>
                        </div>
                    )}

                    {/* STEP 1: Género + Edad */}
                    {step === 1 && (
                        <div className="nutri-setup-steps nutri-anim-up-1">
                            <div className="nutri-step-card">
                                <div className="nutri-step-header">
                                    <div className="nutri-step-number">1</div>
                                    <div className="nutri-step-title">Sexo biológico</div>
                                </div>
                                <div className="nutri-option-grid nutri-option-grid-3">
                                    {[
                                        { id: 'male', icon: '♂️', label: 'Hombre' },
                                        { id: 'female', icon: '♀️', label: 'Mujer' },
                                        { id: 'other', icon: '⚧️', label: 'Otro' },
                                    ].map(g => (
                                        <button
                                            key={g.id}
                                            id={`gender-${g.id}`}
                                            className={`nutri-option-btn ${profile.gender === g.id ? 'selected' : ''}`}
                                            onClick={() => setProfile(p => ({ ...p, gender: g.id as Profile['gender'] }))}
                                        >
                                            <span className="nutri-option-btn-icon">{g.icon}</span>
                                            <span className="nutri-option-btn-label">{g.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="nutri-step-card">
                                <div className="nutri-step-header">
                                    <div className="nutri-step-number">2</div>
                                    <div className="nutri-step-title">¿Cuántos años tenés?</div>
                                </div>
                                <div className="nutri-slider-wrap">
                                    <div className="nutri-slider-value-display">{profile.age} años</div>
                                    <input
                                        id="age-slider"
                                        type="range" min={15} max={80} step={1}
                                        value={profile.age}
                                        onChange={e => setProfile(p => ({ ...p, age: +e.target.value }))}
                                        className="nutri-slider"
                                    />
                                    <div className="nutri-slider-labels">
                                        <span className="nutri-slider-label">15</span>
                                        <span className="nutri-slider-label">80</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 1: Peso + Altura */}
                    {step === 2 && (
                        <div className="nutri-setup-steps nutri-anim-up">
                            <div className="nutri-step-card">
                                <div className="nutri-step-header">
                                    <div className="nutri-step-number">3</div>
                                    <div className="nutri-step-title">Tu peso actual</div>
                                </div>
                                <div className="nutri-slider-wrap">
                                    <div className="nutri-slider-value-display">{profile.weight} kg</div>
                                    <input
                                        id="weight-slider"
                                        type="range" min={40} max={200} step={0.5}
                                        value={profile.weight}
                                        onChange={e => setProfile(p => ({ ...p, weight: +e.target.value }))}
                                        className="nutri-slider"
                                    />
                                    <div className="nutri-slider-labels">
                                        <span className="nutri-slider-label">40 kg</span>
                                        <span className="nutri-slider-label">200 kg</span>
                                    </div>
                                </div>
                                <div className="nutri-form-group" style={{ marginTop: 16 }}>
                                    <label className="nutri-label">O ingresalo exacto</label>
                                    <input
                                        id="weight-input"
                                        type="number"
                                        className="nutri-input"
                                        value={profile.weight}
                                        onChange={e => setProfile(p => ({ ...p, weight: +e.target.value }))}
                                        min={40} max={200} step={0.1}
                                    />
                                </div>
                            </div>

                            <div className="nutri-step-card">
                                <div className="nutri-step-header">
                                    <div className="nutri-step-number">4</div>
                                    <div className="nutri-step-title">Tu altura</div>
                                </div>
                                <div className="nutri-slider-wrap">
                                    <div className="nutri-slider-value-display">{profile.height} cm</div>
                                    <input
                                        id="height-slider"
                                        type="range" min={140} max={220} step={1}
                                        value={profile.height}
                                        onChange={e => setProfile(p => ({ ...p, height: +e.target.value }))}
                                        className="nutri-slider"
                                    />
                                    <div className="nutri-slider-labels">
                                        <span className="nutri-slider-label">140 cm</span>
                                        <span className="nutri-slider-label">220 cm</span>
                                    </div>
                                </div>
                                <div className="nutri-form-group" style={{ marginTop: 16 }}>
                                    <label className="nutri-label">O ingresala exacta</label>
                                    <input
                                        id="height-input"
                                        type="number"
                                        className="nutri-input"
                                        value={profile.height}
                                        onChange={e => setProfile(p => ({ ...p, height: +e.target.value }))}
                                        min={140} max={220}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Nivel de actividad */}
                    {step === 3 && (
                        <div className="nutri-setup-steps nutri-anim-up">
                            <div className="nutri-step-card">
                                <div className="nutri-step-header">
                                    <div className="nutri-step-number">5</div>
                                    <div className="nutri-step-title">¿Cuánto entrenás por semana?</div>
                                </div>
                                <div className="nutri-slider-wrap">
                                    <div className="nutri-slider-value-display" style={{ fontSize: 22, lineHeight: 1.3, marginBottom: 8 }}>
                                        {ACTIVITY_LABELS[profile.activityLevel]}
                                    </div>
                                    <input
                                        id="activity-slider"
                                        type="range" min={0} max={5} step={1}
                                        value={profile.activityLevel}
                                        onChange={e => setProfile(p => ({ ...p, activityLevel: +e.target.value }))}
                                        className="nutri-slider"
                                    />
                                    <div className="nutri-slider-labels">
                                        <span className="nutri-slider-label">Quieto/a</span>
                                        <span className="nutri-slider-label">Atleta</span>
                                    </div>
                                </div>

                                {/* Visual cards */}
                                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {ACTIVITY_LABELS.map((label, i) => (
                                        <div
                                            key={i}
                                            onClick={() => setProfile(p => ({ ...p, activityLevel: i }))}
                                            style={{
                                                padding: '12px 14px',
                                                borderRadius: 12,
                                                border: `1.5px solid ${profile.activityLevel === i ? 'var(--nutri-green)' : 'var(--nutri-border)'}`,
                                                background: profile.activityLevel === i ? 'var(--nutri-green-dim)' : 'var(--nutri-surface-2)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 10,
                                            }}
                                        >
                                            <span style={{ fontSize: 18 }}>
                                                {['🛋️', '🚶', '🤸', '🏋️', '🏃', '🏆'][i]}
                                            </span>
                                            <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Objetivo */}
                    {step === 4 && (
                        <div className="nutri-setup-steps nutri-anim-up">
                            <div className="nutri-step-card">
                                <div className="nutri-step-header">
                                    <div className="nutri-step-number">6</div>
                                    <div className="nutri-step-title">¿Cuál es tu objetivo?</div>
                                </div>
                                <div className="nutri-option-grid nutri-option-grid-2" style={{ gap: 10 }}>
                                    {GOALS.map(g => (
                                        <button
                                            key={g.id}
                                            id={`goal-${g.id}`}
                                            className={`nutri-option-btn ${profile.goal === g.id ? 'selected' : ''}`}
                                            style={{ minHeight: 90 }}
                                            onClick={() => setProfile(p => ({ ...p, goal: g.id }))}
                                        >
                                            <span className="nutri-option-btn-icon">{g.icon}</span>
                                            <span className="nutri-option-btn-label">{g.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Summary */}
                            <div className="nutri-card" style={{ borderColor: 'rgba(57,211,83,0.2)', background: 'linear-gradient(135deg, rgba(57,211,83,0.06), rgba(88,166,255,0.06))' }}>
                                <div className="nutri-section-title">Tu resumen</div>
                                <div className="nutri-stat-grid">
                                    {[
                                        { label: 'Edad', value: `${profile.age}`, unit: 'años' },
                                        { label: 'Peso', value: `${profile.weight}`, unit: 'kg' },
                                        { label: 'Altura', value: `${profile.height}`, unit: 'cm' },
                                        { label: 'Sexo', value: profile.gender === 'male' ? 'Hombre' : profile.gender === 'female' ? 'Mujer' : 'Otro', unit: '' },
                                    ].map(s => (
                                        <div key={s.label} className="nutri-stat-card">
                                            <span className="nutri-stat-label">{s.label}</span>
                                            <span className="nutri-stat-value">{s.value}<span className="nutri-stat-unit"> {s.unit}</span></span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="nutri-flex" style={{ gap: 10, marginTop: 8 }}>
                        {step > 0 && (
                            <button id="btn-back" className="nutri-btn nutri-btn-ghost" style={{ flex: 1 }} onClick={handleBack}>
                                ← Atrás
                            </button>
                        )}
                        {step < totalSteps - 1 ? (
                            <button id="btn-next" className="nutri-btn nutri-btn-primary" style={{ flex: 2 }} onClick={handleNext}>
                                Continuar →
                            </button>
                        ) : (
                            <button id="btn-finish" className="nutri-btn nutri-btn-primary" style={{ flex: 2 }} onClick={handleFinish}>
                                🚀 Calcular mis macros
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
