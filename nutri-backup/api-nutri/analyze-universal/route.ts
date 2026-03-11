import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  let body: {
    transcript?: string;
    images?: string[];
    profile?: any;
    quickData?: { type: string, duration: number, intensity: string };
  } | null = null;

  try {
    body = await req.json();
    const { transcript, images, profile, quickData } = body!;

    const userApiKey = profile?.apiKey || '';
    const apiKey = userApiKey || process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '';

    if (!apiKey) {
      return NextResponse.json({ error: 'Falta la API Key de Gemini. Podés configurarla en tu perfil.' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const basePrompt = `
Sos un asistente de nutrición y fitness experto llamado NutriAI. 
El usuario envió un mensaje que puede ser sobre COMIDA (registro de ingesta) o sobre ENTRENAMIENTO (ejercicio realizado).

DATOS DEL USUARIO:
- Género: ${profile?.gender || 'Masculino'}
- Edad: ${profile?.age || 30} años
- Peso: ${profile?.weight || 75} kg
- Altura: ${profile?.height || 175} cm
- Nivel de actividad semanal base (1-6): ${profile?.activityLevel || 3}
  (1: Sedentario, 2: 1-2 días, 3: 3-4 días, 4: 5 días, 5: 6-7 días, 6: Atleta)
- Objetivo: ${profile?.goal || 'Mantenimiento'}

TAREA:
1. Determinar si el usuario está registrando COMIDA, ENTRENAMIENTO o AMBOS.
2. Si es COMIDA: Estimar porciones y macros (calorías, proteína, carbohidratos, grasas, fibra).
3. Si es ENTRENAMIENTO: Calcular calorías quemadas y AJUSTES nutricionales.
   IMPORTANTE SOBRE AJUSTES: El usuario ya tiene una base de macros calculada según su "Actividad semanal base". 
   - El objetivo es NO recomendar comida extra si el ejercicio de hoy ES LO QUE EL USUARIO HACE NORMALMENTE.
   - Si el nivel es 3-4 y el usuario hace un entrenamiento de 60 min normal, ajustes = 0.
   - Si el entrenamiento es EXCEPCIONAL (ej: partido de hockey de 2 horas intenso, o doble turno), ahí sí sumar macros extra.
   - Si el entrenamiento es o MENOS de lo habitual, ajustes = 0.
   - Solo sugerí macros adicionales si es estrictamente necesario para recuperación por sobre-esfuerzo o si el usuario quiere ganar músculo y el entrenamiento fue muy intenso.

RESPUESTA:
Respondé ÚNICAMENTE con un JSON válido:
{
  "intent": "food" | "workout" | "both",
  "food": {
    "items": [{ "name": "alimento", "amount": "cantidad", "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "fiber": 0, "emoji": "🍎" }],
    "total": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "fiber": 0 },
    "description": "resumen breve en español"
  },
  "workout": {
    "name": "nombre del ejercicio",
    "type": "cardio|fuerza|hiit|deporte|etc",
    "duration": 0, 
    "intensity": "baja|moderada|alta|muy_alta",
    "caloriesBurned": 0,
    "muscleGroups": ["Pecho", "Tríceps", "etc"],
    "adjustments": {
      "additionalCalories": 0,
      "additionalProtein": 0,
      "additionalCarbs": 0,
      "additionalWater": 0
    },
    "description": "resumen breve en español",
    "emoji": "🏋️"
  }
}

MENSAJE DEL USUARIO:
"${transcript || ''}"
${quickData ? `DATOS RÁPIDOS SELECCIONADOS: Tipo: ${quickData.type}, Duración: ${quickData.duration}min, Intensidad: ${quickData.intensity}` : ''}
`;

    const parts: Part[] = [{ text: basePrompt }];
    if (images && images.length > 0) {
      for (const imgB64 of images) {
        const data = imgB64.split(',')[1] || imgB64;
        parts.push({ inlineData: { mimeType: 'image/jpeg', data } });
      }
    }

    const result = await model.generateContent(parts);
    const text = result.response.text().trim();
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(jsonStr);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error in universal analyzer:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
