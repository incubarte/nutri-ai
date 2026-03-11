import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';

function stripBase64Prefix(b64: string): { data: string; mimeType: string } {
    // dataURL: "data:image/jpeg;base64,XXXXX"
    const match = b64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
        return { mimeType: match[1], data: match[2] };
    }
    return { mimeType: 'image/jpeg', data: b64 };
}

export async function POST(req: NextRequest) {
    let body: { transcript?: string; images?: string[] } | null = null;
    try {
        body = await req.json();
        const { transcript, images } = body!;

        const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '';

        if (!apiKey) {
            return NextResponse.json(getFallbackAnalysis(transcript || ''));
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        // Use vision model if images provided
        const modelName = images && images.length > 0 ? 'gemini-1.5-flash' : 'gemini-1.5-flash';
        const model = genAI.getGenerativeModel({ model: modelName });

        const basePrompt = `
Sos un nutricionista experto y analizador de alimentos con visión computacional.

${transcript ? `El usuario describió lo siguiente: "${transcript}"` : ''}
${images && images.length > 0 ? `También adjuntó ${images.length} foto(s) de la comida.` : ''}

Tu tarea es analizar la comida y estimar con precisión su contenido nutricional.

Respondé ÚNICAMENTE con un JSON válido (sin markdown, sin bloques de código) con este formato exacto:
{
  "name": "<nombre descriptivo y corto de la comida en español>",
  "emoji": "<un emoji que represente la comida>",
  "description": "<descripción breve de qué identificaste y cómo calculaste, máximo 2 oraciones, en español>",
  "calories": <calorías totales estimadas, número entero>,
  "protein": <proteínas en gramos, número decimal con 1 decimal>,
  "carbs": <carbohidratos en gramos, número decimal con 1 decimal>,
  "fat": <grasas en gramos, número decimal con 1 decimal>,
  "fiber": <fibra en gramos, número decimal con 1 decimal>,
  "confidence": <número entre 0 y 1 indicando tu confianza en la estimación>
}

Consideraciones importantes:
- Si hay fotos, priorizá lo visual + el texto
- Estimá porciones razonables si no se especifican
- Asegurate que calorías ≈ proteínas*4 + carbos*4 + grasas*9
- Si la descripción es vaga o ambigua, asumí una porción estándar argentina
- confidence < 0.7 si la imagen es poco clara o la descripción muy vaga
- Para alimentos argentinos comunes: milanesa ~300 kcal, empanada ~180 kcal, mate ~5 kcal, medialunas ~150 kcal c/u
- Sé realista y no sobreestimes ni subestimes significativamente
`;

        const parts: Part[] = [{ text: basePrompt }];

        if (images && images.length > 0) {
            for (const imgB64 of images) {
                const { data, mimeType } = stripBase64Prefix(imgB64);
                parts.push({
                    inlineData: {
                        mimeType: mimeType as string,
                        data,
                    },
                });
            }
        }

        const result = await model.generateContent(parts);
        const text = result.response.text().trim();

        const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const analysis = JSON.parse(jsonStr);

        return NextResponse.json(analysis);
    } catch (error) {
        console.error('Error analyzing food:', error);
        return NextResponse.json(getFallbackAnalysis(body?.transcript || ''));
    }
}

function getFallbackAnalysis(transcript: string) {
    // Basic keyword-based fallback
    const lower = transcript.toLowerCase();

    const foods: Record<string, { name: string; emoji: string; calories: number; protein: number; carbs: number; fat: number; fiber: number }> = {
        milanesa: { name: 'Milanesa de carne', emoji: '🥩', calories: 320, protein: 28, carbs: 15, fat: 16, fiber: 0.5 },
        pollo: { name: 'Pechuga de pollo', emoji: '🍗', calories: 220, protein: 36, carbs: 0, fat: 7, fiber: 0 },
        huevo: { name: 'Huevos revueltos (2)', emoji: '🍳', calories: 180, protein: 12, carbs: 2, fat: 14, fiber: 0 },
        arroz: { name: 'Arroz cocido', emoji: '🍚', calories: 200, protein: 4, carbs: 44, fat: 0.5, fiber: 0.6 },
        pasta: { name: 'Pasta con salsa', emoji: '🍝', calories: 380, protein: 12, carbs: 68, fat: 8, fiber: 3 },
        ensalada: { name: 'Ensalada mixta', emoji: '🥗', calories: 80, protein: 3, carbs: 10, fat: 3, fiber: 4 },
        yogur: { name: 'Yogur', emoji: '🥛', calories: 120, protein: 8, carbs: 14, fat: 3, fiber: 0 },
        tostada: { name: 'Tostadas con manteca', emoji: '🍞', calories: 200, protein: 5, carbs: 32, fat: 7, fiber: 2 },
        banana: { name: 'Banana', emoji: '🍌', calories: 90, protein: 1, carbs: 23, fat: 0.3, fiber: 2.6 },
        empanada: { name: 'Empanadas (2)', emoji: '🥟', calories: 380, protein: 14, carbs: 40, fat: 18, fiber: 1.5 },
        sandwich: { name: 'Sándwich', emoji: '🥪', calories: 350, protein: 18, carbs: 38, fat: 14, fiber: 2 },
        fruta: { name: 'Fruta variada', emoji: '🍎', calories: 100, protein: 1, carbs: 25, fat: 0.3, fiber: 3 },
        leche: { name: 'Leche descremada (250ml)', emoji: '🥛', calories: 90, protein: 8, carbs: 12, fat: 0.5, fiber: 0 },
    };

    for (const [keyword, food] of Object.entries(foods)) {
        if (lower.includes(keyword)) {
            return {
                ...food,
                description: `Detecté "${food.name}" en tu descripción. Valores estimados para una porción estándar.`,
                confidence: 0.6,
            };
        }
    }

    return {
        name: transcript ? transcript.slice(0, 40) : 'Comida no identificada',
        emoji: '🍽️',
        description: 'No pude identificar la comida con precisión. Por favor ajustá los valores manualmente o agregá una foto.',
        calories: 300,
        protein: 15,
        carbs: 35,
        fat: 10,
        fiber: 3,
        confidence: 0.3,
    };
}
