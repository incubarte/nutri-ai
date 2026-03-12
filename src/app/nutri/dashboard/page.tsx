'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/* ─── Types ─── */
interface Macros {
    calories: number; protein: number; carbs: number;
    fat: number; fiber: number; water: number; vegetables: number; explanation?: string;
}
interface MealEntry {
    id: string; name: string; time: string; calories: number;
    protein: number; carbs: number; fat: number; fiber: number; emoji?: string; imageUrl?: string;
}
interface WorkoutEntry {
    id: string; name: string; time: string; type: string;
    duration: number; intensity: string; caloriesBurned: number;
    emoji: string; muscleGroups: string[];
    adjustments: { additionalCalories: number; additionalProtein: number; additionalCarbs: number; additionalFat: number; additionalWater: number };
    recommendations: string; recoveryRequired: boolean;
}
interface DayLog {
    date: string; meals: MealEntry[]; workouts: WorkoutEntry[];
}

const DAYS_ES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const INTENSITY_COLORS: Record<string, string> = { baja: '#39d353', moderada: '#e3b341', alta: '#f78166', muy_alta: '#f778ba' };
const INTENSITY_LABELS: Record<string, string> = { baja: 'Baja', moderada: 'Moderada', alta: 'Alta', muy_alta: 'Muy alta' };

function dateKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function MacroRing({ value, goal, color, label }: { value: number; goal: number; color: string; label: string }) {
    const pct = Math.min(value / Math.max(goal, 1), 1.05);
    const size = 88; const cx = 44; const cy = 44; const r = 34;
    const circumference = 2 * Math.PI * r;
    const dashOffset = circumference * (1 - Math.min(pct, 1));
    return (
        <div className="nutri-macro-ring" style={{ width: size, height: size }}>
            <svg width={size} height={size}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
                <circle cx={cx} cy={cy} r={r} fill="none"
                    stroke={pct > 1 ? 'var(--nutri-orange)' : color} strokeWidth={6} strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={dashOffset}
                    style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.34,1.56,0.64,1)', transformOrigin: 'center', transform: 'rotate(-90deg)' }} />
            </svg>
            <div className="nutri-macro-ring-text">
                <div style={{ fontSize: 13, fontWeight: 800, color, fontFamily: 'Outfit,sans-serif', lineHeight: 1 }}>
                    {Math.round(value)}<span style={{ fontSize: 8, color: 'var(--nutri-text-muted)' }}>{label === 'Agua' ? 'L' : 'g'}</span>
                </div>
                <div style={{ fontSize: 9, color: 'var(--nutri-text-muted)', marginTop: 2 }}>{label}</div>
            </div>
        </div>
    );
}

function MacroBar({ name, value, goal, baseline, color, emoji }: {
    name: string; value: number; goal: number; baseline: number; color: string; emoji: string;
}) {
    const pct = Math.min((value / Math.max(goal, 1)) * 100, 100);
    const basePct = Math.min((baseline / Math.max(goal, 1)) * 100, 100);
    const over = value > goal;
    const hasExtra = goal > baseline;
    return (
        <div className="nutri-macro-bar-row">
            <div className="nutri-macro-bar-header">
                <div className="nutri-macro-bar-name">
                    <div className="nutri-macro-bar-dot" style={{ background: color }} />
                    {emoji} {name}
                    {hasExtra && <span className="nutri-adj-badge">+{Math.round(goal - baseline)}</span>}
                </div>
                <div className="nutri-macro-bar-values">
                    <span>{Math.round(value)}</span> / {Math.round(goal)}{name === 'Agua' ? 'L' : 'g'}
                    {over && <span style={{ color: 'var(--nutri-orange)', marginLeft: 4 }}>⚠️</span>}
                </div>
            </div>
            <div className="nutri-progress-track" style={{ position: 'relative' }}>
                {hasExtra && (
                    <div style={{ position: 'absolute', left: `${basePct}%`, top: -2, bottom: -2, width: 2, background: 'rgba(255,255,255,0.2)', borderRadius: 1, zIndex: 1 }} />
                )}
                <div className={`nutri-progress-fill ${over ? 'over' : ''}`}
                    style={{ width: `${pct}%`, background: over ? undefined : color }} />
            </div>
        </div>
    );
}

export default function NutriDashboard() {
    const router = useRouter();
    const [tab, setTab] = useState<'day' | 'week'>('day');
    const [macros, setMacros] = useState<Macros | null>(null);
    const [weekLogs, setWeekLogs] = useState<DayLog[]>([]);
    const [selectedDayOffset, setSelectedDayOffset] = useState(0);
    const [showExplanation, setShowExplanation] = useState(false);
    const [showWorkouts, setShowWorkouts] = useState(true);
    const [waterConsumed, setWaterConsumed] = useState(0);

    const today = new Date();
    const todayKey = dateKey(today);

    const loadLogs = useCallback(() => {
        const logs: DayLog[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = dateKey(d);
            const raw = localStorage.getItem(`nutri_log_${key}`);
            const parsed = raw ? JSON.parse(raw) : { date: key, meals: [], workouts: [] };
            if (!parsed.workouts) parsed.workouts = [];
            logs.push(parsed);
        }
        return logs;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const profileRaw = localStorage.getItem('nutri_profile');
        if (!profileRaw) { router.push('/nutri/setup'); return; }
        const macrosRaw = localStorage.getItem('nutri_macros');
        if (macrosRaw) setMacros(JSON.parse(macrosRaw));

        const logs = loadLogs();
        setWeekLogs(logs);

        // Load water for selected day
        const day = logs[6 - selectedDayOffset];
        if (day) {
            const storedWater = localStorage.getItem(`nutri_water_${day.date}`);
            setWaterConsumed(storedWater ? parseFloat(storedWater) : 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDayOffset]);

    const addWater = (amount: number) => {
        const newTotal = Math.max(0, Math.round((waterConsumed + (amount * 0.25)) * 100) / 100);
        setWaterConsumed(newTotal);
        localStorage.setItem(`nutri_water_${displayLog.date}`, newTotal.toString());
    };

    const deleteMeal = (mealId: string) => {
        if (!confirm('¿Seguro quieres borrar esta comida?')) return;
        const newMeals = displayLog.meals.filter(m => m.id !== mealId);
        const updatedLog = { ...displayLog, meals: newMeals };
        localStorage.setItem(`nutri_log_${displayLog.date}`, JSON.stringify(updatedLog));
        setWeekLogs(loadLogs());
    };

    const deleteWorkout = (workoutId: string) => {
        if (!confirm('¿Seguro quieres borrar este entrenamiento?')) return;
        const newWorkouts = displayLog.workouts.filter(w => w.id !== workoutId);
        const updatedLog = { ...displayLog, workouts: newWorkouts };
        localStorage.setItem(`nutri_log_${displayLog.date}`, JSON.stringify(updatedLog));
        setWeekLogs(loadLogs());
    };

    const [isStandalone, setIsStandalone] = useState(false);
    useEffect(() => {
        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
            setIsStandalone(true);
        }
        const onFocus = () => setWeekLogs(loadLogs());
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, []);

    const displayLog = weekLogs[6 - selectedDayOffset] || { date: todayKey, meals: [], workouts: [] };

    /* ─── Sums ─── */
    const sumFood = useCallback((meals: MealEntry[]) => ({
        calories: meals.reduce((a, m) => a + m.calories, 0),
        protein: meals.reduce((a, m) => a + m.protein, 0),
        carbs: meals.reduce((a, m) => a + m.carbs, 0),
        fat: meals.reduce((a, m) => a + m.fat, 0),
        fiber: meals.reduce((a, m) => a + m.fiber, 0),
    }), []);

    const sumWorkouts = useCallback((workouts: WorkoutEntry[]) => ({
        caloriesBurned: workouts.reduce((a, w) => a + w.caloriesBurned, 0),
        additionalCalories: workouts.reduce((a, w) => a + Math.round(w.adjustments.additionalCalories), 0),
        additionalProtein: workouts.reduce((a, w) => a + Math.round(w.adjustments.additionalProtein), 0),
        additionalCarbs: workouts.reduce((a, w) => a + Math.round(w.adjustments.additionalCarbs), 0),
        additionalWater: workouts.reduce((a, w) => a + w.adjustments.additionalWater, 0),
        duration: workouts.reduce((a, w) => a + w.duration, 0),
    }), []);

    if (!macros) {
        return (
            <div className="nutri-app">
                <div className="nutri-loading-overlay">
                    <div className="nutri-spinner" />
                    <p className="nutri-loading-text">Cargando tu perfil…</p>
                </div>
            </div>
        );
    }

    // Day view calculations
    const dayFood = sumFood(displayLog.meals);
    const dayWorkout = sumWorkouts(displayLog.workouts || []);
    const hasWorkouts = (displayLog.workouts || []).length > 0;

    const adjustedGoals = {
        calories: macros.calories + dayWorkout.additionalCalories,
        protein: macros.protein + dayWorkout.additionalProtein,
        carbs: macros.carbs + dayWorkout.additionalCarbs,
        fat: macros.fat,
        fiber: macros.fiber,
        water: macros.water + dayWorkout.additionalWater,
    };

    const netCalories = dayFood.calories - dayWorkout.caloriesBurned;
    const remainingCal = adjustedGoals.calories - dayFood.calories;
    const calorieProgress = Math.min((dayFood.calories / Math.max(adjustedGoals.calories, 1)) * 100, 100);

    // Week view calculations
    const weekStats = weekLogs.reduce((acc, d) => {
        const f = sumFood(d.meals); const w = sumWorkouts(d.workouts || []);
        return {
            consumed: acc.consumed + f.calories,
            burned: acc.burned + w.caloriesBurned,
            duration: acc.duration + w.duration,
            p: acc.p + f.protein, c: acc.c + f.carbs, f: acc.f + f.fat, fi: acc.fi + f.fiber,
            adjCal: acc.adjCal + w.additionalCalories,
            adjP: acc.adjP + w.additionalProtein,
            adjC: acc.adjC + w.additionalCarbs,
        };
    }, { consumed: 0, burned: 0, duration: 0, p: 0, c: 0, f: 0, fi: 0, adjCal: 0, adjP: 0, adjC: 0 });

    const weekGoalCal = (macros.calories * 7) + weekStats.adjCal;
    const weekGoalP = (macros.protein * 7) + weekStats.adjP;
    const weekGoalC = (macros.carbs * 7) + weekStats.adjC;

    return (
        <div className="nutri-app">
            <div className="nutri-bg-orb nutri-bg-orb-1" />
            <div className="nutri-bg-orb nutri-bg-orb-2" />

            {/* Topbar */}
            {!isStandalone && (
                <div className="nutri-anim-up" style={{ background: 'var(--nutri-blue-dim)', padding: '10px 20px', fontSize: 13, textAlign: 'center', borderBottom: '1px solid var(--nutri-blue)' }}>
                    📲 Para instalar: pulsá el ícono de <strong>compartir</strong> y luego <strong>"Agregar a inicio"</strong>
                </div>
            )}
            <div className="nutri-topbar">
                <div className="nutri-topbar-inner">
                    <div className="nutri-logo">
                        <div className="nutri-logo-icon">🥗</div>
                        <span className="nutri-logo-text">NutriAI</span>
                    </div>
                    <div className="nutri-topbar-date">
                        {today.getDate()} {MONTHS_ES[today.getMonth()]} · {DAYS_ES[today.getDay()]}
                    </div>
                    <button id="btn-profile" onClick={() => router.push('/nutri/setup')}
                        style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', padding: 4 }}>⚙️</button>
                </div>
            </div>

            <div className="nutri-screen">
                <div className="nutri-container nutri-z-content" style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8 }}>

                    {/* Tabs */}
                    <div className="nutri-tabs nutri-anim-up">
                        <button id="tab-day" className={`nutri-tab ${tab === 'day' ? 'active' : ''}`} onClick={() => { setTab('day'); setSelectedDayOffset(0); }}>📅 Hoy</button>
                        <button id="tab-week" className={`nutri-tab ${tab === 'week' ? 'active' : ''}`} onClick={() => setTab('week')}>📊 Semana</button>
                    </div>

                    {/* Day pills */}
                    {tab === 'day' && (
                        <div className="nutri-week-grid nutri-anim-up-1">
                            {weekLogs.map((log, i) => {
                                const d = new Date(today); d.setDate(d.getDate() - (6 - i));
                                const hasData = log.meals.length > 0 || (log.workouts || []).length > 0;
                                const offset = 6 - i;
                                return (
                                    <button key={i} id={`day-pill-${i}`} className="nutri-day-pill"
                                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                                        onClick={() => setSelectedDayOffset(offset)}>
                                        <span className="nutri-day-pill-name">{DAYS_ES[d.getDay()]}</span>
                                        <div className={`nutri-day-pill-dot ${i === 6 ? 'today' : hasData ? 'has-data' : ''}`}
                                            style={selectedDayOffset === offset && i !== 6 ? { border: '2px solid var(--nutri-blue)', color: 'var(--nutri-blue)' } : {}}>
                                            {d.getDate()}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* ════ DAY VIEW ════ */}
                    {tab === 'day' && (
                        <>
                            {/* Hero */}
                            <div className="nutri-card nutri-card-glow-green nutri-anim-up-2">
                                <div style={{ padding: '12px 0 4px' }}>
                                    <div style={{ textAlign: 'center', marginBottom: 12 }}>
                                        <div className="nutri-calorie-number">{Math.round(dayFood.calories).toLocaleString()}</div>
                                        <div className="nutri-calorie-label">kcal consumidas</div>
                                        {hasWorkouts && (
                                            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center' }}>
                                                <div className="nutri-adj-chip nutri-adj-chip-orange">🔥 -{Math.round(dayWorkout.caloriesBurned)} kcal</div>
                                                <div style={{ width: 1, height: 12, background: 'var(--nutri-border)' }} />
                                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--nutri-blue)' }}>{Math.round(netCalories)} <span style={{ fontSize: 10, fontWeight: 500 }}>netas</span></div>
                                            </div>
                                        )}
                                    </div>

                                    <div className={`nutri-calorie-remaining ${remainingCal < 0 ? 'negative' : ''}`} style={{ textAlign: 'center', marginBottom: 12 }}>
                                        {remainingCal >= 0 ? `${Math.round(remainingCal)} kcal restantes` : `${Math.round(Math.abs(remainingCal))} kcal de exceso`}
                                        {hasWorkouts && remainingCal > 0 && (
                                            <span style={{ fontSize: 10, color: 'var(--nutri-text-muted)', display: 'block', marginTop: 3 }}>
                                                Meta ajustada por entrenamiento: <strong>{Math.round(adjustedGoals.calories)} kcal</strong>
                                            </span>
                                        )}
                                    </div>

                                    <div className="nutri-progress-track" style={{ height: 10 }}>
                                        <div className={`nutri-progress-fill ${remainingCal < 0 ? 'over' : ''}`}
                                            style={{ width: `${calorieProgress}%`, background: remainingCal < 0 ? undefined : 'linear-gradient(90deg,#39d353,#58a6ff)' }} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                                        <span style={{ fontSize: 10, color: 'var(--nutri-text-muted)' }}>0</span>
                                        <span style={{ fontSize: 10, color: 'var(--nutri-text-muted)', fontWeight: 600 }}>
                                            Meta: {Math.round(adjustedGoals.calories).toLocaleString()} kcal
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Workout Adjustment Banner */}
                            {hasWorkouts && (
                                <div className="nutri-anim-up-2" style={{
                                    background: 'linear-gradient(135deg, rgba(247,129,102,0.1), rgba(188,140,255,0.08))',
                                    border: '1px solid rgba(247,129,102,0.25)', borderRadius: 16, padding: '12px 16px',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--nutri-orange)' }}>🏋️ Ajuste Deportivo</div>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--nutri-text-muted)' }}>{dayWorkout.duration} min activas</div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                                        {[
                                            { l: '+Calorías', v: `+${dayWorkout.additionalCalories}`, u: 'kcal', c: 'var(--macro-calories)' },
                                            { l: '+Proteína', v: `+${dayWorkout.additionalProtein}`, u: 'g', c: 'var(--macro-protein)' },
                                            { l: '+Carbos', v: `+${dayWorkout.additionalCarbs}`, u: 'g', c: 'var(--macro-carbs)' },
                                        ].map(a => (
                                            <div key={a.l} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 4px', textAlign: 'center' }}>
                                                <div style={{ fontSize: 10, color: 'var(--nutri-text-muted)', marginBottom: 4 }}>{a.l}</div>
                                                <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: a.c }}>{a.v}<span style={{ fontSize: 9, fontWeight: 400, color: 'var(--nutri-text-muted)' }}> {a.u}</span></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Rings */}
                            <div className="nutri-card nutri-anim-up-3">
                                <div className="nutri-section-title">Macros Clave</div>
                                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                                    <MacroRing value={dayFood.protein} goal={adjustedGoals.protein} color="var(--macro-protein)" label="Proteína" />
                                    <MacroRing value={dayFood.carbs} goal={adjustedGoals.carbs} color="var(--macro-carbs)" label="Carbos" />
                                    <MacroRing value={dayFood.fat} goal={adjustedGoals.fat} color="var(--macro-fat)" label="Grasas" />
                                    <MacroRing value={waterConsumed} goal={adjustedGoals.water} color="var(--nutri-teal)" label="Agua" />
                                </div>

                                {/* Water Logger */}
                                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 10px' }}>
                                    <button onClick={() => addWater(-1)} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--nutri-border)', background: 'var(--nutri-surface-2)', color: 'var(--nutri-text)', fontSize: 18, cursor: 'pointer' }}>-</button>
                                    <div style={{ flex: 1, textAlign: 'center' }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--nutri-teal)' }}>💧 {Math.round(waterConsumed / 0.25)} vasos <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>({waterConsumed.toFixed(1)}L)</span></div>
                                        <div style={{ fontSize: 9, color: 'var(--nutri-text-muted)' }}>Meta: {Math.round(adjustedGoals.water / 0.25)} vasos</div>
                                    </div>
                                    <button onClick={() => addWater(1)} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--nutri-teal-dim,rgba(0,186,183,0.3))', background: 'var(--nutri-teal-dim,rgba(0,186,183,0.1))', color: 'var(--nutri-teal)', fontSize: 18, cursor: 'pointer' }}>+</button>
                                </div>
                            </div>

                            {/* Bars */}
                            <div className="nutri-card nutri-anim-up-4">
                                <div className="nutri-section-title">Detalle Nutricional</div>
                                <div className="nutri-macro-bar-wrap">
                                    <MacroBar name="Proteína" value={dayFood.protein} goal={adjustedGoals.protein} baseline={macros.protein} color="var(--macro-protein)" emoji="🥩" />
                                    <MacroBar name="Carbohidratos" value={dayFood.carbs} goal={adjustedGoals.carbs} baseline={macros.carbs} color="var(--macro-carbs)" emoji="🌾" />
                                    <MacroBar name="Grasas" value={dayFood.fat} goal={adjustedGoals.fat} baseline={macros.fat} color="var(--macro-fat)" emoji="🥑" />
                                    <MacroBar name="Fibra" value={dayFood.fiber} goal={adjustedGoals.fiber} baseline={macros.fiber} color="var(--macro-fiber)" emoji="🥦" />
                                </div>
                            </div>

                            {/* Workouts */}
                            {hasWorkouts && (
                                <div className="nutri-anim-up-4">
                                    <div className="nutri-section-title">Actividad de hoy <button onClick={() => setShowWorkouts(!showWorkouts)} style={{ background: 'none', border: 'none', color: 'var(--nutri-text-muted)', fontSize: 11, cursor: 'pointer' }}>{showWorkouts ? '[ocultar]' : '[ver]'}</button></div>
                                    {showWorkouts && (
                                        <div>
                                            {displayLog.workouts.map(w => (
                                                <div key={w.id} className="nutri-workout-card" style={{ position: 'relative' }}>
                                                    <div className="nutri-workout-icon">{w.emoji}</div>
                                                    <div className="nutri-workout-info">
                                                        <div className="nutri-workout-name">{w.name}</div>
                                                        <div className="nutri-workout-meta">{w.time} · {w.duration} min · <span style={{ color: INTENSITY_COLORS[w.intensity] }}>{INTENSITY_LABELS[w.intensity]}</span></div>
                                                        <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                                                            {w.muscleGroups?.slice(0, 3).map((m, i) => (
                                                                <span key={i} className="nutri-adj-chip nutri-adj-chip-orange" style={{ fontSize: 9 }}>{m}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                                        <button onClick={(e) => { e.stopPropagation(); deleteWorkout(w.id); }} style={{ background: 'none', border: 'none', color: '#e74c3c', fontSize: 14, cursor: 'pointer', padding: '0 0 8px 8px', opacity: 0.6 }}>✕</button>
                                                        <div>
                                                            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--nutri-orange)', fontFamily: 'Outfit,sans-serif' }}>-{w.caloriesBurned}</div>
                                                            <div style={{ fontSize: 9, color: 'var(--nutri-text-muted)', textTransform: 'uppercase' }}>kcal</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Meals */}
                            <div className="nutri-anim-up-5">
                                <div className="nutri-section-title">Comidas registradas</div>
                                {displayLog.meals.length === 0 ? (
                                    <div className="nutri-empty">
                                        <div className="nutri-empty-icon">🍽️</div>
                                        <div className="nutri-empty-title">Día sin comidas</div>
                                        <div className="nutri-empty-desc">Empezamos a trackear hoy?</div>
                                        <button className="nutri-btn nutri-btn-primary" style={{ marginTop: 10 }} onClick={() => router.push('/nutri/log')}>🎙️ Registrar ahora</button>
                                    </div>
                                ) : (
                                    <div className="nutri-meal-list">
                                        {[...displayLog.meals].reverse().map(m => (
                                            <div key={m.id} className="nutri-meal-entry">
                                                <div className="nutri-meal-entry-thumb">
                                                    {m.imageUrl ? <img src={m.imageUrl} alt={m.name} /> : <span>{m.emoji || '🍽️'}</span>}
                                                </div>
                                                <div className="nutri-meal-entry-info">
                                                    <div className="nutri-meal-entry-name">{m.name}</div>
                                                    <div className="nutri-meal-entry-time">{m.time}</div>
                                                    <div className="nutri-meal-entry-macros">
                                                        <span className="nutri-macro-chip" style={{ color: 'var(--macro-protein)', background: 'rgba(88,166,255,0.1)' }}>P: {m.protein}g</span>
                                                        <span className="nutri-macro-chip" style={{ color: 'var(--macro-carbs)', background: 'rgba(227,179,65,0.1)' }}>C: {m.carbs}g</span>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                                    <button onClick={(e) => { e.stopPropagation(); deleteMeal(m.id); }} style={{ background: 'none', border: 'none', color: '#e74c3c', fontSize: 14, cursor: 'pointer', padding: '0 0 8px 8px', opacity: 0.6 }}>✕</button>
                                                    <div className="nutri-meal-entry-cal">
                                                        <div className="nutri-meal-entry-kcal">{m.calories}</div>
                                                        <div className="nutri-meal-entry-kcal-label">kcal</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* ════ WEEK VIEW ════ */}
                    {tab === 'week' && (
                        <>
                            {/* Summary Cards */}
                            <div className="nutri-anim-up-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div style={{ background: 'var(--nutri-surface)', borderRadius: 16, padding: 16, border: '1px solid var(--nutri-border)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--nutri-text-muted)', marginBottom: 6 }}>Consumido</div>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--nutri-text)', fontFamily: 'Outfit,sans-serif' }}>
                                        {weekStats.consumed.toLocaleString()}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--nutri-text-muted)' }}> kcal</span>
                                    </div>
                                </div>
                                <div style={{ background: 'rgba(247,129,102,0.05)', borderRadius: 16, padding: 16, border: '1px solid rgba(247,129,102,0.2)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--nutri-orange)', marginBottom: 6 }}>Quemado</div>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--nutri-orange)', fontFamily: 'Outfit,sans-serif' }}>
                                        -{weekStats.burned.toLocaleString()}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--nutri-text-muted)' }}> kcal</span>
                                    </div>
                                </div>
                                <div style={{ background: 'var(--nutri-surface)', borderRadius: 16, padding: 16, border: '1px solid var(--nutri-border)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--nutri-text-muted)', marginBottom: 6 }}>Tiempo Activo</div>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--nutri-yellow)', fontFamily: 'Outfit,sans-serif' }}>
                                        {Math.floor(weekStats.duration / 60)}h {weekStats.duration % 60}m
                                    </div>
                                </div>
                                <div style={{ background: 'var(--nutri-surface)', borderRadius: 16, padding: 16, border: '1px solid var(--nutri-border)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--nutri-text-muted)', marginBottom: 6 }}>Promedio Neto</div>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--nutri-blue)', fontFamily: 'Outfit,sans-serif' }}>
                                        {Math.round((weekStats.consumed - weekStats.burned) / 7).toLocaleString()}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--nutri-text-muted)' }}> kcal</span>
                                    </div>
                                </div>
                            </div>

                            {/* Progress Bars (Adjusted) */}
                            <div className="nutri-card nutri-anim-up-3">
                                <div className="nutri-section-title">Progreso Semanal <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--nutri-text-muted)' }}>(metas ajustadas por ejercicio)</span></div>
                                <div className="nutri-macro-bar-wrap">
                                    <MacroBar name="Proteína" value={weekStats.p} goal={weekGoalP} baseline={macros.protein * 7} color="var(--macro-protein)" emoji="🥩" />
                                    <MacroBar name="Carbohidratos" value={weekStats.c} goal={weekGoalC} baseline={macros.carbs * 7} color="var(--macro-carbs)" emoji="🌾" />
                                    <MacroBar name="Grasas" value={weekStats.f} goal={macros.fat * 7} baseline={macros.fat * 7} color="var(--macro-fat)" emoji="🥑" />
                                </div>
                            </div>

                            {/* Daily breakdown */}
                            <div className="nutri-anim-up-4">
                                <div className="nutri-section-title">Balance diario</div>
                                <div className="nutri-card" style={{ padding: 0 }}>
                                    {weekLogs.map((log, i) => {
                                        const d = new Date(today); d.setDate(d.getDate() - (6 - i));
                                        const f = sumFood(log.meals); const w = sumWorkouts(log.workouts || []);
                                        const isToday = i === 6;
                                        const pct = Math.min((f.calories / (macros.calories + w.additionalCalories)) * 100, 100);
                                        return (
                                            <div key={i} style={{ padding: '12px 16px', borderBottom: i < 6 ? '1px solid var(--nutri-border)' : 'none', display: 'flex', alignItems: 'center', gap: 12, background: isToday ? 'rgba(57,211,83,0.04)' : 'transparent' }}>
                                                <div style={{ width: 36, textAlign: 'center', flexShrink: 0 }}>
                                                    <div style={{ fontSize: 10, color: 'var(--nutri-text-muted)', fontWeight: 700 }}>{DAYS_ES[d.getDay()]}</div>
                                                    <div style={{ width: 28, height: 28, borderRadius: 8, margin: '2px auto 0', background: isToday ? 'linear-gradient(135deg,#39d353,#1a8f2d)' : 'var(--nutri-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: isToday ? '#fff' : 'var(--nutri-text-muted)' }}>{d.getDate()}</div>
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
                                                        <span style={{ fontSize: 12, fontWeight: 600 }}>{Math.round(f.calories)} <span style={{ fontSize: 10, color: 'var(--nutri-text-muted)', fontWeight: 400 }}>kcal</span></span>
                                                        <div style={{ display: 'flex', gap: 6 }}>
                                                            {w.caloriesBurned > 0 && <span className="nutri-adj-chip nutri-adj-chip-orange" style={{ fontSize: 9 }}>🔥 -{Math.round(w.caloriesBurned)}</span>}
                                                            <span style={{ fontSize: 11, color: f.calories > (macros.calories + w.additionalCalories) ? 'var(--nutri-orange)' : 'var(--nutri-text-muted)' }}>/ {Math.round(macros.calories + w.additionalCalories)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="nutri-progress-track" style={{ height: 4 }}>
                                                        <div className="nutri-progress-fill" style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--nutri-orange)' : 'linear-gradient(90deg,#39d353,#58a6ff)' }} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}

                    <div style={{ height: 24 }} />
                </div>
            </div>

            {/* Nav */}
            <div className="nutri-bottom-nav">
                <div className="nutri-bottom-nav-inner">
                    <button className={`nutri-nav-item ${tab === 'day' ? 'active' : ''}`} onClick={() => setTab('day')}>🏠 <span className="nutri-nav-item-label">Inicio</span></button>
                    <button className="nutri-nav-fab" onClick={() => router.push('/nutri/log')}><div className="nutri-nav-fab-btn">+</div><span className="nutri-nav-fab-label">Registrar</span></button>
                    <button className="nutri-nav-item" onClick={() => router.push('/nutri/setup')}>👤 <span className="nutri-nav-item-label">Perfil</span></button>
                </div>
            </div>
        </div>
    );
}
