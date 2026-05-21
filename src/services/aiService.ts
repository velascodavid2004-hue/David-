import { GoogleGenAI } from "@google/genai";
import { Boxer } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function predictWinner(
  boxer1: Boxer, 
  boxer2: Boxer, 
  videos: { r1?: string; r2?: string; r3?: string }
): Promise<{ winnerId: string; reasoning: string }> {
  const hasVideos = !!(videos.r1 || videos.r2 || videos.r3);
  
  const promptText = `
    Eres un analista de boxeo olímpico de élite y experto en puntuación técnica. 
    Tu misión es analizar este combate de 3 ASALTOS y determinar un ganador justo.

    ${hasVideos ? "Se han proporcionado VIDEOS de los asaltos. Analiza prioritariamente lo que sucede en los videos. Usa el COLOR asignado a cada boxeador para distinguirlos." : "Realiza una proyección basada exclusivamente en el historial y estadísticas."}

    CONFIGURACIÓN DEL COMBATE:
    BOXEADOR 1 (${boxer1.cornerColor || 'ROJO'}): ${boxer1.name}
    - Récord: ${boxer1.wins}V - ${boxer1.losses}D - ${boxer1.draws}E
    - Puntos de Ranking: ${boxer1.rankingPoints}

    BOXEADOR 2 (${boxer2.cornerColor || 'AZUL'}): ${boxer2.name}
    - Récord: ${boxer2.wins}V - ${boxer2.losses}D - ${boxer2.draws}E
    - Puntos de Ranking: ${boxer2.rankingPoints}

    INSTRUCCIONES DE ANÁLISIS:
    Para cada asalto disponible:
    1. Evalúa técnica, agresividad efectiva y golpes de poder conectado.
    2. Determina quién ganó el asalto (10-9 o 10-8).
    3. Resume la acción clave brevemente usando los colores (${boxer1.cornerColor || 'ROJO'} vs ${boxer2.cornerColor || 'AZUL'}).

    ESTILO: Sé directo y conciso. No des rodeos. Indica claramente quien domina cada round.

    FORMA DE RESPUESTA (JSON estricto):
    {
      "winnerId": "${boxer1.id}" o "${boxer2.id}",
      "reasoning": "R1: [Resumen corto]\\nR2: [Resumen corto]\\nR3: [Resumen corto]\\n\\nVEREDICTO: [Justificación final de 1 frase]"
    }
  `;

  const parts: any[] = [{ text: promptText }];

  if (videos.r1) {
    const base64Data = videos.r1.includes(',') ? videos.r1.split(',')[1] : videos.r1;
    parts.push({ inlineData: { mimeType: "video/mp4", data: base64Data } }, { text: "VIDEO ASALTO 1" });
  }
  if (videos.r2) {
    const base64Data = videos.r2.includes(',') ? videos.r2.split(',')[1] : videos.r2;
    parts.push({ inlineData: { mimeType: "video/mp4", data: base64Data } }, { text: "VIDEO ASALTO 2" });
  }
  if (videos.r3) {
    const base64Data = videos.r3.includes(',') ? videos.r3.split(',')[1] : videos.r3;
    parts.push({ inlineData: { mimeType: "video/mp4", data: base64Data } }, { text: "VIDEO ASALTO 3" });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
      },
    });

    const result = JSON.parse(response.text || "{}");
    return {
      winnerId: result.winnerId || (boxer1.rankingPoints >= boxer2.rankingPoints ? boxer1.id : boxer2.id),
      reasoning: result.reasoning || "El análisis se basó en el desempeño técnico acumulado.",
    };
  } catch (error) {
    console.error("AI Service Error:", error);
    return {
      winnerId: boxer1.rankingPoints >= boxer2.rankingPoints ? boxer1.id : boxer2.id,
      reasoning: "Hubo un problema técnico con el análisis multiround. Decisión por ranking.",
    };
  }
}
