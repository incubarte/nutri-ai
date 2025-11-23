import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, readFile } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { parseVoiceCommand } from '@/lib/voice-correction';

const execAsync = promisify(exec);

interface GameContext {
  prompt: string;
  teamNames: string[];
  validPlayers: { [team: string]: string[] };
}

// Helper to get current game context for better transcription
async function getGameContext(): Promise<GameContext> {
  try {
    // Read current live game state from server storage
    const livePath = path.join(process.cwd(), 'tmp', 'new-storage', 'data', 'live.json');
    const liveData = await readFile(livePath, 'utf-8');
    const liveState = JSON.parse(liveData);

    const homeTeam = liveState.homeTeamName || '';
    const awayTeam = liveState.awayTeamName || '';
    const teamNames = [homeTeam, awayTeam].filter(Boolean);

    // Extract player numbers from attendance
    let playerInfo = '';
    const validPlayers: { [team: string]: string[] } = {};

    if (liveState.attendance?.home) {
      const homePlayers = liveState.attendance.home
        .map((p: any) => p.number)
        .filter((n: string) => n && n !== '');
      if (homePlayers.length > 0) {
        validPlayers[homeTeam] = homePlayers;
        playerInfo += ` Jugadores ${homeTeam}: ${homePlayers.join(', ')}.`;
      }
    }

    if (liveState.attendance?.away) {
      const awayPlayers = liveState.attendance.away
        .map((p: any) => p.number)
        .filter((n: string) => n && n !== '');
      if (awayPlayers.length > 0) {
        validPlayers[awayTeam] = awayPlayers;
        playerInfo += ` Jugadores ${awayTeam}: ${awayPlayers.join(', ')}.`;
      }
    }

    // Get all player numbers for the prompt
    const allPlayerNumbers = [...new Set([
      ...Object.values(validPlayers).flat()
    ])].sort((a, b) => parseInt(a) - parseInt(b));

    // Create a very specific prompt to guide Whisper - emphasize numbers
    const prompt = `Partido de hockey entre ${teamNames.join(' y ')}.${playerInfo} Escucharás SOLO estos números: ${allPlayerNumbers.join(', ')}. Comandos: tiro, gol, penalización + equipo + número. Ejemplos: "${teamNames[0]} 10 tiro", "${teamNames[1]} 5 gol", "penalización ${teamNames[0]} 18". Los números SIEMPRE son: ${allPlayerNumbers.join(', ')}.`;

    return { prompt, teamNames, validPlayers };
  } catch (error) {
    console.error('[Voice Context] Error reading live state:', error);
    // If can't read state, return basic context
    return {
      prompt: 'Hockey sobre patines. Comandos: tiro, gol, penalización. Números de jugadores.',
      teamNames: [],
      validPlayers: {}
    };
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    // Get audio from request
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const parseTime = Date.now();
    console.log(`[Voice] Parse form: ${parseTime - startTime}ms`);

    // Save audio to temp file
    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const timestamp = Date.now();
    const tempPath = path.join('/tmp', `audio-${timestamp}.webm`);

    await writeFile(tempPath, buffer);

    const writeTime = Date.now();
    console.log(`[Voice] Write file: ${writeTime - parseTime}ms`);

    try {
      // Get game context for better transcription
      const context = await getGameContext();

      const contextTime = Date.now();
      console.log(`[Voice] Get context: ${contextTime - writeTime}ms`);

      console.log('[Voice Transcribe] Context:', {
        teamNames: context.teamNames,
        validPlayersKeys: Object.keys(context.validPlayers),
        promptPreview: context.prompt.substring(0, 100)
      });

      // Run Whisper transcription (using venv python)
      const scriptPath = path.join(process.cwd(), 'scripts', 'whisper-transcribe.py');
      const pythonPath = path.join(process.cwd(), 'venv', 'bin', 'python3');

      // Escape quotes in context for shell
      const escapedPrompt = context.prompt.replace(/"/g, '\\"');

      const whisperStart = Date.now();
      const { stdout, stderr } = await execAsync(
        `${pythonPath} ${scriptPath} ${tempPath} "${escapedPrompt}"`
      );
      const whisperTime = Date.now();
      console.log(`[Voice] Whisper transcribe: ${whisperTime - whisperStart}ms`);

      if (stderr && !stderr.includes('FP16')) {
        // Ignore FP16 warnings, log other errors
        console.error('Whisper stderr:', stderr);
      }

      const rawText = stdout.trim();

      // Parse and correct the transcription
      const parseStart = Date.now();
      const parsed = parseVoiceCommand(rawText, context.teamNames, context.validPlayers);
      const parseEnd = Date.now();
      console.log(`[Voice] Parse command: ${parseEnd - parseStart}ms`);

      // Clean up temp file
      await unlink(tempPath).catch(() => {});

      const totalTime = Date.now() - startTime;
      console.log(`[Voice] TOTAL TIME: ${totalTime}ms`);

      return NextResponse.json({
        success: true,
        raw: parsed.raw,
        corrected: parsed.corrected,
        teamName: parsed.teamName,
        playerNumbers: parsed.playerNumbers,
        action: parsed.action,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      // Clean up temp file on error
      await unlink(tempPath).catch(() => {});
      throw error;
    }

  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to transcribe audio',
      details: String(error)
    }, { status: 500 });
  }
}
