import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const ACTIVITY_MULTIPLIERS = [1.2, 1.375, 1.55, 1.725, 1.9, 2.0];

function calcBMR(weight: number, height: number, age: number, gender: string) {
    if (gender === 'female') {
        return 10 * weight + 6.25 * height - 5 * age - 161;
    }
    return 10 * weight + 6.25 * height - 5 * age + 5;
}

export async function POST(req: NextRequest) {
    let body: { gender: string; age: number; weight: number; height: number; activityLevel: number; goal: string; apiKey?: string } | null = null;
    try {
        body = await req.json();
        const { gender, age, weight, height, activityLevel, goal } = body!;

        const userApiKey = body?.apiKey || '';
        const apiKey = userApiKey || process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '';

        if (!apiKey) {
            return NextResponse.json(calculateFallback(gender, age, weight, height, activityLevel, goal));
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const bmr = calcBMR(weight, height, age, gender);
        const tdee = bmr * (ACTIVITY_MULTIPLIERS[activityLevel] || 1.55);

        const prompt = `
Sos un nutricionista deportivo experto. Calculá los macros diarios ideales para esta persona:

Datos:
- Sexo biológico: ${gender === 'male' ? 'Hombre' : gender === 'female' ? 'Mujer' : 'Otro'}
- Edad: ${age} años
- Peso: ${weight} kg
- Altura: ${height} cm
- Nivel de actividad física: ${['Sedentario', 'Ligero (1-2 días/sem)', 'Moderado (3-4 días/sem)', 'Activo (5 días/sem)', 'Muy activo (6-7 días/sem)', 'Atleta (2x día)'][activityLevel]}
- Objetivo principal: ${goal}
- TMB calculado: ${Math.round(bmr)} kcal
- TDEE estimado: ${Math.round(tdee)} kcal

Respondé ÚNICAMENTE con un JSON válido:
{
  "calories": <número entero>,
  "protein": <gramos de proteína por día>,
  "carbs": <gramos de carbohidratos por día>,
  "fat": <gramos de grasa por día>,
  "fiber": <gramos de fibra por día>,
  "water": <litros de agua por día>,
  "vegetables": <porciones>,
  "explanation": "<explicación breve en español>"
}

REGLAS DE PROTEÍNA (MUY IMPORTANTE):
- Si el usuario es Sedentario (nivel 0-1): Usar 1.2g - 1.4g por kg de peso. No exagerar.
- Si el usuario entrena (nivel 2-4): Usar 1.6g - 1.8g por kg de peso.
- Solo si es Atleta o busca Ganar Músculo intensamente: Usar 2.0g - 2.2g por kg de peso.
- 150g+ de proteína suele ser mucho para personas de peso medio que no son atletas de élite. Ajustá a la realidad del usuario.

REGLAS DE CALORÍAS:
- Bajar peso: TDEE - 400.
- Ganar músculo: TDEE + 250.
- Mantener: TDEE.
`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const macros = JSON.parse(jsonStr);

        return NextResponse.json(macros);
    } catch (error) {
        if (body) {
            return NextResponse.json(calculateFallback(body.gender, body.age, body.weight, body.height, body.activityLevel, body.goal));
        }
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}

function calculateFallback(gender: string, age: number, weight: number, height: number, activityLevel: number, goal: string) {
    const bmr = gender === 'female' ? 10 * weight + 6.25 * height - 5 * age - 161 : 10 * weight + 6.25 * height - 5 * age + 5;
    const tdee = bmr * (ACTIVITY_MULTIPLIERS[activityLevel] || 1.55);

    let calories = tdee;
    if (goal === 'weight_loss') calories = tdee - 400;
    else if (goal === 'muscle_gain') calories = tdee + 250;

    // Fixed protein logic
    let proteinMultiplier = 1.3; // Base
    if (activityLevel >= 2) proteinMultiplier = 1.6;
    if (goal === 'muscle_gain' || activityLevel >= 4) proteinMultiplier = 2.0;

    const protein = Math.round(weight * proteinMultiplier);
    const fat = Math.round((calories * 0.28) / 9);
    const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

    return {
        calories: Math.round(calories),
        protein,
        carbs: Math.max(carbs, 50),
        fat,
        fiber: gender === 'male' ? 35 : 25,
        water: Math.round((weight * 0.035) * 10) / 10,
        vegetables: 5,
        explanation: "Cálculo basado en fórmulas estándar TMB/TDEE con ajuste moderado de proteína según tu actividad.",
    };
}
