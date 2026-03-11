import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
    let body: {
        transcript?: string;
        duration?: number;
        exerciseType?: string;
        weight?: number;
        age?: number;
        gender?: string;
    } | null = null;

    try {
        body = await req.json();
        const { transcript, duration, exerciseType, weight = 75, age = 30, gender = 'male' } = body!;

        const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '';

        if (!apiKey) {
            return NextResponse.json(getFallbackAnalysis(transcript || '', duration || 30, exerciseType || 'general', weight));
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `
Sos un entrenador personal y nutricionista deportivo experto.

Un usuario describió su entrenamiento de hoy:
"${transcript}"

Datos del usuario:
- Peso: ${weight} kg
- Edad: ${age} años
- Sexo: ${gender === 'male' ? 'Hombre' : gender === 'female' ? 'Mujer' : 'Otro'}
- Duración indicada: ${duration || 'no especificada'} minutos
- Tipo de ejercicio indicado: ${exerciseType || 'no especificado'}

Analizá el entrenamiento y respondé ÚNICAMENTE con un JSON válido (sin markdown, sin bloques de código):
{
  "name": "<nombre corto y descriptivo del entrenamiento, en español>",
  "emoji": "<emoji que represente el ejercicio>",
  "type": "<uno de: cardio, fuerza, hiit, yoga_flexibilidad, deporte, caminata, otro>",
  "duration": <duración estimada en minutos, número entero>,
  "intensity": "<una de: baja, moderada, alta, muy_alta>",
  "caloriesBurned": <calorías quemadas estimadas según el peso, duración e intensidad, número entero>,
  "description": "<descripción breve del análisis en español, máximo 2 oraciones>",
  "adjustments": {
    "additionalCalories": <calorías extra que debe consumir hoy para compensar, número entero>,
    "additionalProtein": <gramos extra de proteína recomendados para recuperación muscular>,
    "additionalCarbs": <gramos extra de carbohidratos para reponer glucógeno>,
    "additionalFat": 0,
    "additionalWater": <litros extra de agua recomendados, número decimal>
  },
  "recommendations": "<consejo personalizado breve sobre nutrición post-entrenamiento, en español, máximo 2 oraciones>",
  "muscleGroups": ["<grupos musculares trabajados, ej: piernas, core, pecho, espalda, etc>"],
  "recoveryRequired": <true si necesita día de descanso mañana, false si no>,
  "confidence": <número entre 0 y 1>
}

Reglas para el cálculo:
- MET (equivalente metabólico) aproximado por tipo:
  * Caminata lenta: 2.5, caminata rápida: 3.5
  * Cardio moderado: 6, cardio intenso: 8-10
  * HIIT: 9-12
  * Fuerza moderada: 5, fuerza intensa: 6
  * Yoga/flexibilidad: 2.5-3
  * Zumba/baile: 6
  * Natación: 7-8
  * Ciclismo: 6-10
- Fórmula: calorías = MET × peso(kg) × horas
- Los adjustments deben ser ADICIONALES a las metas base del usuario
- Si el ejercicio fue de fuerza/hiit: priorizar proteína adicional (1.5-2g extra por kg de masa magra aproximada)
- Si fue cardio largo: priorizar carbohidratos (0.5-1g/kg)
- additionalCalories debe ser el 60-80% de las calorías quemadas (no recuperar todo para mantener el déficit si el objetivo es bajar de peso)
`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const analysis = JSON.parse(jsonStr);

        return NextResponse.json(analysis);
    } catch (error) {
        console.error('Error analyzing workout:', error);
        return NextResponse.json(
            getFallbackAnalysis(body?.transcript || '', body?.duration || 30, body?.exerciseType || 'general', body?.weight || 75)
        );
    }
}

function getFallbackAnalysis(transcript: string, duration: number, exerciseType: string, weight: number) {
    const lower = transcript.toLowerCase();

    type ExerciseDef = {
        name: string; emoji: string; type: string; met: number;
        intensity: string; muscle: string[];
    };

    const exercises: Record<string, ExerciseDef> = {
        'pesas|fuerza|gym|gimnasio|mancuernas|barra|sentadilla|press': {
            name: 'Entrenamiento de fuerza', emoji: '🏋️', type: 'fuerza', met: 5.5,
            intensity: 'alta', muscle: ['piernas', 'core', 'pecho', 'espalda', 'brazos'],
        },
        'correr|corrí|trote|running|carrera': {
            name: 'Carrera', emoji: '🏃', type: 'cardio', met: 8,
            intensity: 'alta', muscle: ['piernas', 'core'],
        },
        'hiit|intervalos|crossfit|funcional': {
            name: 'HIIT / Entrenamiento funcional', emoji: '⚡', type: 'hiit', met: 10,
            intensity: 'muy_alta', muscle: ['cuerpo completo'],
        },
        'yoga|pilates|stretching|flexibilidad|elongación': {
            name: 'Yoga / Flexibilidad', emoji: '🧘', type: 'yoga_flexibilidad', met: 2.8,
            intensity: 'baja', muscle: ['core', 'flexibilidad'],
        },
        'caminar|caminata|caminé': {
            name: 'Caminata', emoji: '🚶', type: 'caminata', met: 3.5,
            intensity: 'moderada', muscle: ['piernas'],
        },
        'nadar|natación|pileta|piscina': {
            name: 'Natación', emoji: '🏊', type: 'cardio', met: 7.5,
            intensity: 'alta', muscle: ['cuerpo completo'],
        },
        'bici|ciclismo|cycling': {
            name: 'Ciclismo', emoji: '🚴', type: 'cardio', met: 7,
            intensity: 'alta', muscle: ['piernas', 'core'],
        },
        'fútbol|tenis|paddle|padel|básquet|deporte': {
            name: 'Deporte en equipo', emoji: '⚽', type: 'deporte', met: 7,
            intensity: 'alta', muscle: ['piernas', 'core'],
        },
    };

    let matched: ExerciseDef | null = null;
    for (const [pattern, data] of Object.entries(exercises)) {
        if (new RegExp(pattern).test(lower)) { matched = data; break; }
    }

    const ex = matched || { name: 'Entrenamiento general', emoji: '💪', type: exerciseType, met: 5, intensity: 'moderada', muscle: ['cuerpo general'] };
    const hours = duration / 60;
    const burned = Math.round(ex.met * weight * hours);

    return {
        name: ex.name,
        emoji: ex.emoji,
        type: ex.type,
        duration,
        intensity: ex.intensity,
        caloriesBurned: burned,
        description: `Entrenamiento de ${duration} minutos de ${ex.name.toLowerCase()}. Calorías quemadas estimadas: ${burned} kcal.`,
        adjustments: {
            additionalCalories: Math.round(burned * 0.7),
            additionalProtein: ex.type === 'fuerza' || ex.type === 'hiit' ? Math.round(weight * 0.25) : Math.round(weight * 0.1),
            additionalCarbs: ex.type === 'cardio' || ex.type === 'hiit' ? Math.round(weight * 0.4) : Math.round(weight * 0.2),
            additionalFat: 0,
            additionalWater: Math.round((burned / 500) * 10) / 10,
        },
        recommendations: 'Aseguráte de consumir proteínas dentro de los 30 minutos post-entrenamiento. Hidratate bien durante las próximas horas.',
        muscleGroups: ex.muscle,
        recoveryRequired: ex.intensity === 'muy_alta' || duration > 90,
        confidence: 0.65,
    };
}
