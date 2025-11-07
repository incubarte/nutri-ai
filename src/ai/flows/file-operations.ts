
'use server';
/**
 * @fileOverview A Genkit flow for server-side file operations.
 *
 * - saveGameSummary - A function that saves a game summary to the filesystem.
 * - saveTeamCsvSummary - A function that saves a team's game summary to a CSV file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import type { GameSummary } from '@/types';
import { getStorageDir } from '@/lib/storage/local-provider';

// --- Save Full Game Summary (JSON) ---
const GameSummaryInputSchema = z.object({
  homeTeamName: z.string(),
  awayTeamName: z.string(),
  homeScore: z.number(),
  awayScore: z.number(),
  categoryName: z.string(),
  gameSummary: z.any(),
});
export type GameSummaryInput = z.infer<typeof GameSummaryInputSchema>;

export async function saveGameSummary(input: GameSummaryInput): Promise<{ success: boolean; message: string; filePath?: string; }> {
  return saveGameSummaryFlow(input);
}

const saveGameSummaryFlow = ai.defineFlow(
  {
    name: 'saveGameSummaryFlow',
    inputSchema: GameSummaryInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string(), filePath: z.string().optional() }),
  },
  async (input) => {
    if (process.env.FIREBASE_APP_HOSTING_PREVIEW_URL) {
      return { success: true, message: 'Guardado de resumen JSON deshabilitado en modo preview.' };
    }
    try {
      const storageDir = getStorageDir(); // Use the getter function
      const summariesDir = path.join(storageDir, 'resumenes');
      await fs.mkdir(summariesDir, { recursive: true });

      const date = new Date();
      const dateString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}`;
      const fileName = `${dateString} - Cat ${input.categoryName} - ${input.homeTeamName} vs ${input.awayTeamName}.json`;
      const sanitizedFileName = fileName.replace(/[/\\?%*:|"<>]/g, '-');
      const filePath = path.join(summariesDir, sanitizedFileName);

      // El gameSummary ya viene en el formato correcto
      const summary: GameSummary = input.gameSummary;
      
      const homeScore = (summary.statsByPeriod || []).reduce((acc, period) => acc + (period.stats.goals.home?.length ?? 0), 0) 
        + (summary.shootout?.homeAttempts?.filter(a => a.isGoal).length ?? 0);
      const awayScore = (summary.statsByPeriod || []).reduce((acc, period) => acc + (period.stats.goals.away?.length ?? 0), 0)
        + (summary.shootout?.awayAttempts?.filter(a => a.isGoal).length ?? 0);
      

      const contentToSave = {
        date: date.toISOString(),
        category: input.categoryName,
        homeTeam: input.homeTeamName,
        awayTeam: input.awayTeamName,
        finalScore: `${homeScore} - ${awayScore}`,
        summary: summary,
      };

      await fs.writeFile(filePath, JSON.stringify(contentToSave, null, 2), 'utf-8');

      return { success: true, message: `Resumen JSON guardado en ${filePath}`, filePath };
    } catch (error) {
      console.error("Error saving game summary:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Error guardando resumen JSON: ${errorMessage}` };
    }
  }
);


// --- Save Team CSV Summary ---
const PlayerStatsSchema = z.object({
    number: z.string(),
    name: z.string(),
    goals: z.number(),
    assists: z.number(),
    shots: z.number(),
});

const CsvSummaryInputSchema = z.object({
  teamName: z.string(),
  categoryName: z.string(),
  gameResult: z.enum(["Ganó", "Perdió", "Empató"]),
  goalsFor: z.number(),
  goalsAgainst: z.number(),
  playerStats: z.array(PlayerStatsSchema),
});
export type CsvSummaryInput = z.infer<typeof CsvSummaryInputSchema>;

export async function saveTeamCsvSummary(input: CsvSummaryInput): Promise<{ success: boolean; message: string; filePath?: string; }> {
  return saveTeamCsvSummaryFlow(input);
}

const escapeCsvCell = (cellData: any): string => {
  const stringData = String(cellData ?? '');
  if (stringData.includes(',') || stringData.includes('"') || stringData.includes('\n')) {
      return `"${stringData.replace(/"/g, '""')}"`;
  }
  return stringData;
};

const saveTeamCsvSummaryFlow = ai.defineFlow(
  {
    name: 'saveTeamCsvSummaryFlow',
    inputSchema: CsvSummaryInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string(), filePath: z.string().optional() }),
  },
  async (input) => {
    if (process.env.FIREBASE_APP_HOSTING_PREVIEW_URL) {
      return { success: true, message: 'Guardado de CSV deshabilitado en modo preview.' };
    }
    try {
      const storageDir = getStorageDir(); // Use the getter function
      const summariesDir = path.join(storageDir, 'summaries_csv');
      await fs.mkdir(summariesDir, { recursive: true });

      const date = new Date();
      const dateString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
      const fileName = `${dateString} - Cat ${input.categoryName} - ${input.teamName}.csv`;
      const sanitizedFileName = fileName.replace(/[/\\?%*:|"<>]/g, '-');
      const filePath = path.join(summariesDir, sanitizedFileName);

      // CSV Content Generation
      let csvContent = "";
      // Header
      csvContent += `Resultado,${input.gameResult}\n`;
      csvContent += `Goles a Favor,${input.goalsFor}\n`;
      csvContent += `Goles en Contra,${input.goalsAgainst}\n`;
      csvContent += "\n"; // Blank line separator

      // Player Stats Table
      const headers = ['Numero', 'Nombre', 'Goles', 'Asistencias', 'Tiros'];
      csvContent += headers.map(escapeCsvCell).join(',') + '\n';
      
      input.playerStats.forEach(player => {
        const row = [
          player.number,
          player.name,
          player.goals,
          player.assists,
          player.shots
        ];
        csvContent += row.map(escapeCsvCell).join(',') + '\n';
      });

      await fs.writeFile(filePath, csvContent, 'utf-8');

      return { success: true, message: `Resumen CSV guardado para ${input.teamName}`, filePath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Error guardando resumen CSV para ${input.teamName}: ${errorMessage}` };
    }
  }
);
