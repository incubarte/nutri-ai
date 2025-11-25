/**
 * Voice transcription correction utilities
 * Fixes common misheard team names and numbers
 */

import type { VoiceGameEvent, ShotEventData, GoalEventData, PenaltyEventData, TimeoutEventData } from '@/types';

/**
 * Calculate similarity between two strings (0-1)
 */
function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance between two strings
 */
function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

/**
 * Find closest match from a list of options
 */
function findClosestMatch(word: string, options: string[], threshold = 0.6): string | null {
  let bestMatch = null;
  let bestScore = threshold;

  for (const option of options) {
    const score = similarity(word.toLowerCase(), option.toLowerCase());
    if (score > bestScore) {
      bestScore = score;
      bestMatch = option;
    }
  }

  return bestMatch;
}

/**
 * Check if word letters appear in order in target (subsequence)
 * e.g., "cal" matches "cahhl" (c-a-l in order with h's in between)
 */
function isSubsequence(word: string, target: string): boolean {
  let wordIdx = 0;
  for (let i = 0; i < target.length && wordIdx < word.length; i++) {
    if (target[i] === word[wordIdx]) {
      wordIdx++;
    }
  }
  return wordIdx === word.length;
}

/**
 * Smart team name matching - very permissive for team names specifically
 * Uses multiple strategies: substring, subsequence, fuzzy match, and part matching
 */
function findTeamNameMatch(word: string, teamNames: string[]): string | null {
  const wordLower = word.toLowerCase();

  // First pass: exact and high-confidence matches
  for (const teamName of teamNames) {
    const teamLower = teamName.toLowerCase();

    // Strategy 1: Exact substring match
    if (teamLower.includes(wordLower) || wordLower.includes(teamLower)) {
      return teamName;
    }

    // Strategy 2: High similarity fuzzy match (threshold 0.6)
    const score = similarity(wordLower, teamLower);
    if (score > 0.6) {
      return teamName;
    }

    // Strategy 3: Match against parts of the team name
    // e.g., "CAHHL AZUL" -> ["cahhl", "azul"]
    const teamParts = teamLower.split(/\s+/);
    for (const part of teamParts) {
      if (part.includes(wordLower) || wordLower.includes(part)) {
        return teamName;
      }
      if (similarity(wordLower, part) > 0.6) {
        return teamName;
      }
    }
  }

  // Second pass: more permissive for words >= 3 chars
  if (wordLower.length >= 3) {
    for (const teamName of teamNames) {
      const teamLower = teamName.toLowerCase();

      // Match against parts of the team name with lower threshold
      const teamParts = teamLower.split(/\s+/);
      for (const part of teamParts) {
        // Subsequence match for 3+ char words
        if (isSubsequence(wordLower, part)) {
          // Require at least 50% of the letters to match for short words
          if (wordLower.length / part.length >= 0.5) {
            return teamName;
          }
        }

        // Lower fuzzy threshold (0.4) for parts
        if (similarity(wordLower, part) > 0.4) {
          return teamName;
        }
      }

      // Subsequence match on full team name
      if (isSubsequence(wordLower, teamLower)) {
        // But require at least 40% of the letters to match
        if (wordLower.length / teamLower.length >= 0.3) {
          return teamName;
        }
      }

      // Lower fuzzy threshold (0.35) for 3+ char words
      const score = similarity(wordLower, teamLower);
      if (score > 0.35) {
        return teamName;
      }
    }
  }

  return null;
}

/**
 * Correct team names in transcription
 */
export function correctTeamNames(text: string, teamNames: string[]): string {
  let corrected = text;

  // Split into words
  const words = text.split(/\s+/);

  for (const word of words) {
    // Skip if it's a number
    if (/^\d+$/.test(word)) continue;

    // Use smart team name matching (very permissive)
    const match = findTeamNameMatch(word, teamNames);
    if (match && match !== word) {
      // Replace in text (case insensitive)
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      corrected = corrected.replace(regex, match);
    }
  }

  return corrected;
}

/**
 * Extract and validate player numbers
 */
export function extractPlayerNumbers(text: string): string[] {
  const numbers = text.match(/\b\d+\b/g) || [];
  return numbers;
}

/**
 * Parse transcription into structured command
 */
export interface ParsedVoiceCommand {
  raw: string;
  corrected: string;
  teamName: string | null;
  playerNumbers: string[];
  action: 'shot' | 'goal' | 'penalty' | 'timeout' | 'unknown';
}

export function parseVoiceCommand(
  text: string,
  teamNames: string[],
  validPlayers: { [team: string]: string[] }
): ParsedVoiceCommand {
  // Correct team names
  const corrected = correctTeamNames(text, teamNames);

  // Detect action
  let action: ParsedVoiceCommand['action'] = 'unknown';
  if (/\b(gol|goal)\b/i.test(corrected)) action = 'goal';
  else if (/\b(penal|penalty|penalizaci[oó]n)\b/i.test(corrected)) action = 'penalty';
  else if (/\b(tiempo|timeout|time\s*out)\b/i.test(corrected)) action = 'timeout';
  else if (/\b(tiro|shot)\b/i.test(corrected)) action = 'shot';

  // Find team name - try exact match first, then smart team matching
  let teamName: string | null = null;
  for (const name of teamNames) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(corrected)) {
      teamName = name;
      break;
    }
  }

  // If no exact match, try smart team name matching on each word
  if (!teamName) {
    const words = corrected.split(/\s+/);
    for (const word of words) {
      if (/^\d+$/.test(word)) continue; // Skip numbers
      const match = findTeamNameMatch(word, teamNames);
      if (match) {
        teamName = match;
        break;
      }
    }
  }

  // Extract player numbers
  const allNumbers = extractPlayerNumbers(corrected);

  // Validate numbers against team roster
  let playerNumbers: string[] = [];
  if (teamName && validPlayers[teamName]) {
    playerNumbers = allNumbers.filter(num => validPlayers[teamName].includes(num));
  } else {
    playerNumbers = allNumbers;
  }

  // If we have team + player but no action, assume it's a shot
  // Examples: "ACEMHH 20", "57 de ACEMHH", "CAHHL 8"
  if (action === 'unknown' && teamName && playerNumbers.length > 0) {
    action = 'shot';
  }

  return {
    raw: text,
    corrected,
    teamName,
    playerNumbers,
    action
  };
}

/**
 * Convert parsed command to structured game event
 */
export function createGameEventFromCommand(
  parsed: ParsedVoiceCommand,
  homeTeamName: string,
  awayTeamName: string,
  gameTime?: { period: number; timeRemaining: number }
): VoiceGameEvent | null {
  if (parsed.action === 'unknown' || !parsed.teamName) {
    return null;
  }

  const team: 'home' | 'away' = parsed.teamName === homeTeamName ? 'home' : 'away';

  const baseEvent = {
    action: parsed.action,
    timestamp: new Date().toISOString(),
    gameTime,
  };

  switch (parsed.action) {
    case 'shot':
      if (parsed.playerNumbers.length === 0) return null;
      return {
        ...baseEvent,
        action: 'shot',
        data: {
          team,
          teamName: parsed.teamName,
          playerNumber: parsed.playerNumbers[0],
        },
      };

    case 'goal':
      if (parsed.playerNumbers.length === 0) return null;
      return {
        ...baseEvent,
        action: 'goal',
        data: {
          team,
          teamName: parsed.teamName,
          scorer: parsed.playerNumbers[0],
          assists: parsed.playerNumbers.slice(1), // Additional numbers are assists
        },
      };

    case 'penalty':
      if (parsed.playerNumbers.length === 0) return null;
      return {
        ...baseEvent,
        action: 'penalty',
        data: {
          team,
          teamName: parsed.teamName,
          playerNumber: parsed.playerNumbers[0],
        },
      };

    case 'timeout':
      return {
        ...baseEvent,
        action: 'timeout',
        data: {
          team,
          teamName: parsed.teamName,
        },
      };

    default:
      return null;
  }
}
