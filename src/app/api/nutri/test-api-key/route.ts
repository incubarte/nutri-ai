import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
    try {
        const { apiKey } = await req.json();

        if (!apiKey || apiKey.trim() === '') {
            return NextResponse.json({ success: false, message: 'La API Key está vacía' }, { status: 400 });
        }

        const trimmedKey = apiKey.trim();
        const genAI = new GoogleGenerativeAI(trimmedKey);

        // Use a very light model for testing
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // Simple test prompt with a timeout-like behavior (optional, but good for UX)
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: "Respond 'OK'" }] }],
            generationConfig: { maxOutputTokens: 5 }
        });

        const response = await result.response;
        const text = response.text().trim();

        if (text) {
            return NextResponse.json({ success: true, message: 'API Key válida' });
        } else {
            return NextResponse.json({ success: false, message: 'Respuesta vacía de la IA' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('API Key Test Error:', error);

        let userMessage = 'Error al validar la clave';
        const errorStr = error.toString().toLowerCase();

        if (errorStr.includes('api_key_invalid') || errorStr.includes('invalid api key')) {
            userMessage = 'La API Key es inválida (revisá que esté completa)';
        } else if (errorStr.includes('not_found') || errorStr.includes('404')) {
            userMessage = 'No se encontró el modelo o la clave no existe';
        } else if (errorStr.includes('expired')) {
            userMessage = 'La API Key ha expirado';
        } else if (errorStr.includes('quota') || errorStr.includes('429')) {
            userMessage = 'Se alcanzó el límite de cuota de la clave';
        } else if (errorStr.includes('fetch failed')) {
            userMessage = 'Error de red o conexión bloqueada';
        } else {
            userMessage = error.message || 'Error desconocido al validar';
        }

        return NextResponse.json({
            success: false,
            message: userMessage
        }, { status: 400 });
    }
}
