

"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useReducer, useEffect, useRef, useState } from 'react';
import type { Penalty, Team, TeamData, PlayerData, CategoryData, ConfigFields, FormatAndTimingsProfile, FormatAndTimingsProfileData, ScoreboardLayoutSettings, ScoreboardLayoutProfile, GameSummary, GoalLog, PenaltyLog, LiveGameState, PreTimeoutState, PeriodDisplayOverrideType, ClockState, ScoreState, PenaltiesState } from '@/types';
import { toast } from '@/hooks/use-toast';
import isEqual from 'lodash.isequal';
import { updateConfigOnServer, updateGameStateOnServer } from '@/app/actions';


// --- Constantes para la sincronización local ---
const BROADCAST_CHANNEL_NAME = 'icevision-game-state-channel';
const LOCAL_STORAGE_KEY = 'icevision-game-state';
const CENTISECONDS_PER_SECOND = 100;
const TICK_INTERVAL_MS = 200;
const DEFAULT_HORN_SOUND_FILE_PATH = '/audio/default-horn.wav'; 
const DEFAULT_PENALTY_BEEP_FILE_PATH = '/audio/penalty_beep.wav';


let TAB_ID: string;
if (typeof window !== 'undefined') {
  // crypto.randomUUID() is only available in secure contexts (HTTPS).
  // Provide a fallback for insecure contexts (like some preview environments) or older browsers.
  if (window.crypto && window.crypto.randomUUID) {
    TAB_ID = window.crypto.randomUUID();
  } else {
    // A simple but effective fallback for generating a unique enough ID for the tab.
    TAB_ID = `tab-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }
} else {
  // For the server environment
  TAB_ID = 'server-tab-id-' + Math.random().toString(36).substring(2);
}

// Initial values (used as fallback if files are not found or are invalid)
const IN_CODE_INITIAL_PROFILE_NAME = "Predeterminado (App)";
const IN_CODE_INITIAL_LAYOUT_PROFILE_NAME = "Diseño Predeterminado (App)";
const IN_CODE_INITIAL_WARM_UP_DURATION = 5 * 60 * CENTISECONDS_PER_SECOND;
const IN_CODE_INITIAL_PERIOD_DURATION = 20 * 60 * CENTISECONDS_PER_SECOND;
const IN_CODE_INITIAL_OT_PERIOD_DURATION = 5 * 60 * CENTISECONDS_PER_SECOND;
const IN_CODE_INITIAL_BREAK_DURATION = 2 * 60 * CENTISECONDS_PER_SECOND;
const IN_CODE_INITIAL_PRE_OT_BREAK_DURATION = 60 * CENTISECONDS_PER_SECOND;
const IN_CODE_INITIAL_TIMEOUT_DURATION = 30 * CENTISECONDS_PER_SECOND;
const IN_CODE_INITIAL_MAX_CONCURRENT_PENALTIES = 2;
const IN_CODE_INITIAL_AUTO_START_WARM_UP = true;
const IN_CODE_INITIAL_AUTO_START_BREAKS = true;
const IN_CODE_INITIAL_AUTO_START_PRE_OT_BREAKS = false;
const IN_CODE_INITIAL_AUTO_START_TIMEOUTS = true;
const IN_CODE_INITIAL_NUMBER_OF_REGULAR_PERIODS = 2;
const IN_CODE_INITIAL_NUMBER_OF_OVERTIME_PERIODS = 0;
const IN_CODE_INITIAL_PLAYERS_PER_TEAM_ON_ICE = 5;

const IN_CODE_INITIAL_PLAY_SOUND_AT_PERIOD_END = true;
const IN_CODE_INITIAL_CUSTOM_HORN_SOUND_DATA_URL = null;
const IN_CODE_INITIAL_ENABLE_TEAM_SELECTION_IN_MINI_SCOREBOARD = true;
const IN_CODE_INITIAL_ENABLE_PLAYER_SELECTION_FOR_PENALTIES = true;
const IN_CODE_INITIAL_SHOW_ALIAS_IN_PENALTY_PLAYER_SELECTOR = true;
const IN_CODE_INITIAL_SHOW_ALIAS_IN_CONTROLS_PENALTY_LIST = true;
const IN_CODE_INITIAL_SHOW_ALIAS_IN_SCOREBOARD_PENALTIES = true;
const IN_CODE_INITIAL_ENABLE_PENALTY_COUNTDOWN_SOUND = true;
const IN_CODE_INITIAL_PENALTY_COUNTDOWN_START_TIME = 10;
const IN_CODE_INITIAL_CUSTOM_PENALTY_BEEP_SOUND_DATA_URL = null;


export const IN_CODE_INITIAL_LAYOUT_SETTINGS: ScoreboardLayoutSettings = {
  scoreboardVerticalPosition: -4, // rem
  scoreboardHorizontalPosition: 0, // rem
  clockSize: 12, // rem
  teamNameSize: 3, // rem
  scoreSize: 8, // rem
  periodSize: 4.5, // rem
  playersOnIceIconSize: 1.75, // rem
  categorySize: 1.25, // rem
  teamLabelSize: 1, // rem
  penaltiesTitleSize: 2, // rem
  penaltyPlayerNumberSize: 3.5, // rem
  penaltyTimeSize: 3.5, // rem
  penaltyPlayerIconSize: 2.5, // rem
  primaryColor: '223 65% 33%',
  accentColor: '40 100% 67%',
  backgroundColor: '223 70% 11%',
  mainContentGap: 3, // rem
  scoreLabelGap: -2, // rem
};

const IN_CODE_INITIAL_CATEGORIES_RAW = ['A', 'B', 'C', 'Menores', 'Damas'];
const IN_CODE_INITIAL_AVAILABLE_CATEGORIES: CategoryData[] = IN_CODE_INITIAL_CATEGORIES_RAW.map(name => ({ id: name, name: name }));
const IN_CODE_INITIAL_SELECTED_MATCH_CATEGORY = IN_CODE_INITIAL_AVAILABLE_CATEGORIES[0]?.id || '';

const IN_CODE_INITIAL_GAME_SUMMARY: GameSummary = {
  home: { goals: [], penalties: [] },
  away: { goals: [], penalties: [] },
  attendance: { home: [], away: [] },
};

const createDefaultFormatAndTimingsProfile = (id?: string, name?: string): FormatAndTimingsProfile => ({
  id: id || crypto.randomUUID(),
  name: name || IN_CODE_INITIAL_PROFILE_NAME,
  defaultWarmUpDuration: IN_CODE_INITIAL_WARM_UP_DURATION,
  defaultPeriodDuration: IN_CODE_INITIAL_PERIOD_DURATION,
  defaultOTPeriodDuration: IN_CODE_INITIAL_OT_PERIOD_DURATION,
  defaultBreakDuration: IN_CODE_INITIAL_BREAK_DURATION,
  defaultPreOTBreakDuration: IN_CODE_INITIAL_PRE_OT_BREAK_DURATION,
  defaultTimeoutDuration: IN_CODE_INITIAL_TIMEOUT_DURATION,
  maxConcurrentPenalties: IN_CODE_INITIAL_MAX_CONCURRENT_PENALTIES,
  autoStartWarmUp: IN_CODE_INITIAL_AUTO_START_WARM_UP,
  autoStartBreaks: IN_CODE_INITIAL_AUTO_START_BREAKS,
  autoStartPreOTBreaks: IN_CODE_INITIAL_AUTO_START_PRE_OT_BREAKS,
  autoStartTimeouts: IN_CODE_INITIAL_AUTO_START_TIMEOUTS,
  numberOfRegularPeriods: IN_CODE_INITIAL_NUMBER_OF_REGULAR_PERIODS,
  numberOfOvertimePeriods: IN_CODE_INITIAL_NUMBER_OF_OVERTIME_PERIODS,
  playersPerTeamOnIce: IN_CODE_INITIAL_PLAYERS_PER_TEAM_ON_ICE,
});

const createDefaultScoreboardLayoutProfile = (id?: string, name?: string): ScoreboardLayoutProfile => ({
    id: id || crypto.randomUUID(),
    name: name || IN_CODE_INITIAL_LAYOUT_PROFILE_NAME,
    ...IN_CODE_INITIAL_LAYOUT_SETTINGS
});

export interface GameState extends ConfigFields {
  score: ScoreState;
  penalties: PenaltiesState;
  clock: ClockState;
  homeTeamName: string;
  homeTeamSubName?: string;
  awayTeamName: string;
  awayTeamSubName?: string;
  playHornTrigger: number;
  playPenaltyBeepTrigger: number;
  _lastActionOriginator?: string;
  _lastUpdatedTimestamp?: number;
  _initialConfigLoadComplete?: boolean; // Flag to ensure initial load happens once
}

export type GameAction =
  | { type: 'TOGGLE_CLOCK' }
  | { type: 'SET_TIME'; payload: { minutes: number; seconds: number } }
  | { type: 'ADJUST_TIME'; payload: number }
  | { type: 'SET_PERIOD'; payload: number }
  | { type: 'RESET_PERIOD_CLOCK' }
  | { type: 'ADD_GOAL'; payload: Omit<GoalLog, 'id'> }
  | { type: 'EDIT_GOAL'; payload: { goalId: string; updates: Partial<GoalLog> } }
  | { type: 'DELETE_GOAL'; payload: { goalId: string } }
  | { type: 'ADD_PENALTY'; payload: { team: Team; penalty: { playerNumber: string; initialDuration: number; } } }
  | { type: 'REMOVE_PENALTY'; payload: { team: Team; penaltyId: string } }
  | { type: 'END_PENALTY_FOR_GOAL'; payload: { team: Team; penaltyId: string } }
  | { type: 'ADJUST_PENALTY_TIME'; payload: { team: Team; penaltyId: string; delta: number } }
  | { type: 'SET_PENALTY_TIME'; payload: { team: Team; penaltyId: string; time: number } }
  | { type: 'REORDER_PENALTIES'; payload: { team: Team; startIndex: number; endIndex: number } }
  | { type: 'ACTIVATE_PENDING_PUCK_PENALTIES' }
  | { type: 'TICK' }
  | { type: 'SET_HOME_TEAM_NAME'; payload: string }
  | { type: 'SET_HOME_TEAM_SUB_NAME'; payload?: string }
  | { type: 'SET_AWAY_TEAM_NAME'; payload: string }
  | { type: 'SET_AWAY_TEAM_SUB_NAME'; payload?: string }
  | { type: 'START_BREAK' }
  | { type: 'START_PRE_OT_BREAK' }
  | { type: 'START_BREAK_AFTER_PREVIOUS_PERIOD' }
  | { type: 'START_TIMEOUT' }
  | { type: 'END_TIMEOUT' }
  | { type: 'MANUAL_END_GAME' }
  | { type: 'ADD_FORMAT_AND_TIMINGS_PROFILE'; payload: { name: string; profileData?: Partial<FormatAndTimingsProfileData> } }
  | { type: 'UPDATE_FORMAT_AND_TIMINGS_PROFILE_DATA'; payload: { profileId: string; updates: Partial<FormatAndTimingsProfileData> } }
  | { type: 'UPDATE_FORMAT_AND_TIMINGS_PROFILE_NAME'; payload: { profileId: string; newName: string } }
  | { type: 'DELETE_FORMAT_AND_TIMINGS_PROFILE'; payload: { profileId: string } }
  | { type: 'SELECT_FORMAT_AND_TIMINGS_PROFILE'; payload: { profileId: string | null } }
  | { type: 'LOAD_FORMAT_AND_TIMINGS_PROFILES'; payload: FormatAndTimingsProfile[] } 
  | { type: 'SET_DEFAULT_WARM_UP_DURATION'; payload: number }
  | { type: 'SET_DEFAULT_PERIOD_DURATION'; payload: number }
  | { type: 'SET_DEFAULT_OT_PERIOD_DURATION'; payload: number }
  | { type: 'SET_DEFAULT_BREAK_DURATION'; payload: number }
  | { type: 'SET_DEFAULT_PRE_OT_BREAK_DURATION'; payload: number }
  | { type: 'SET_DEFAULT_TIMEOUT_DURATION'; payload: number }
  | { type: 'SET_MAX_CONCURRENT_PENALTIES'; payload: number }
  | { type: 'SET_NUMBER_OF_REGULAR_PERIODS'; payload: number }
  | { type: 'SET_NUMBER_OF_OVERTIME_PERIODS'; payload: number }
  | { type: 'SET_PLAYERS_PER_TEAM_ON_ICE'; payload: number }
  | { type: 'SET_AUTO_START_WARM_UP_VALUE'; payload: boolean }
  | { type: 'SET_AUTO_START_BREAKS_VALUE'; payload: boolean }
  | { type: 'SET_AUTO_START_PRE_OT_BREAKS_VALUE'; payload: boolean }
  | { type: 'SET_AUTO_START_TIMEOUTS_VALUE'; payload: boolean }
  | { type: 'SET_PLAY_SOUND_AT_PERIOD_END'; payload: boolean }
  | { type: 'SET_CUSTOM_HORN_SOUND_DATA_URL'; payload: string | null }
  | { type: 'SET_ENABLE_PENALTY_COUNTDOWN_SOUND'; payload: boolean }
  | { type: 'SET_PENALTY_COUNTDOWN_START_TIME'; payload: number }
  | { type: 'SET_CUSTOM_PENALTY_BEEP_SOUND_DATA_URL'; payload: string | null }
  | { type: 'UPDATE_LAYOUT_SETTINGS'; payload: Partial<ScoreboardLayoutSettings> }
  | { type: 'ADD_SCOREBOARD_LAYOUT_PROFILE'; payload: { name: string } }
  | { type: 'UPDATE_SCOREBOARD_LAYOUT_PROFILE_NAME'; payload: { profileId: string; newName: string } }
  | { type: 'DELETE_SCOREBOARD_LAYOUT_PROFILE'; payload: { profileId: string } }
  | { type: 'SELECT_SCOREBOARD_LAYOUT_PROFILE'; payload: { profileId: string } }
  | { type: 'SAVE_CURRENT_LAYOUT_TO_PROFILE' }
  | { type: 'LOAD_SOUND_AND_DISPLAY_CONFIG'; payload: Partial<Pick<ConfigFields, 'playSoundAtPeriodEnd' | 'customHornSoundDataUrl' | 'enableTeamSelectionInMiniScoreboard' | 'enablePlayerSelectionForPenalties' | 'showAliasInPenaltyPlayerSelector' | 'showAliasInControlsPenaltyList' | 'showAliasInScoreboardPenalties' | 'scoreboardLayoutProfiles' | 'enablePenaltyCountdownSound' | 'penaltyCountdownStartTime' | 'customPenaltyBeepSoundDataUrl'>> }
  | { type: 'SET_AVAILABLE_CATEGORIES'; payload: CategoryData[] }
  | { type: 'SET_SELECTED_MATCH_CATEGORY'; payload: string }
  | { type: 'HYDRATE_FROM_STORAGE'; payload: Partial<GameState> }
  | { type: 'SET_STATE_FROM_LOCAL_BROADCAST'; payload: GameState }
  | { type: 'RESET_CONFIG_TO_DEFAULTS' } 
  | { type: 'RESET_GAME_STATE' }
  | { type: 'ADD_TEAM'; payload: Omit<TeamData, 'players'> & { id: string; players: PlayerData[] } }
  | { type: 'UPDATE_TEAM_DETAILS'; payload: { teamId: string; name: string; subName?: string; category: string; logoDataUrl?: string | null } }
  | { type: 'DELETE_TEAM'; payload: { teamId: string } }
  | { type: 'ADD_PLAYER_TO_TEAM'; payload: { teamId: string; player: Omit<PlayerData, 'id'> } }
  | { type: 'UPDATE_PLAYER_IN_TEAM'; payload: { teamId: string; playerId: string; updates: Partial<Pick<PlayerData, 'name' | 'number'>> } }
  | { type: 'REMOVE_PLAYER_FROM_TEAM'; payload: { teamId: string; playerId: string } }
  | { type: 'LOAD_TEAMS_FROM_FILE'; payload: TeamData[] }
  | { type: 'SET_TEAM_ATTENDANCE'; payload: { team: Team; playerIds: string[] } };


const defaultInitialProfile = createDefaultFormatAndTimingsProfile();
const defaultInitialLayoutProfile = createDefaultScoreboardLayoutProfile();

const initialGlobalState: GameState = {
  score: {
    home: 0,
    away: 0,
  },
  penalties: {
    home: [],
    away: [],
  },
  clock: {
    currentTime: defaultInitialProfile.defaultWarmUpDuration,
    currentPeriod: 0,
    isClockRunning: false,
    periodDisplayOverride: 'Warm-up',
    preTimeoutState: null,
    clockStartTimeMs: null,
    remainingTimeAtStartCs: null,
  },
  homeTeamName: 'Local',
  homeTeamSubName: undefined,
  awayTeamName: 'Visitante',
  awayTeamSubName: undefined,
  defaultWarmUpDuration: IN_CODE_INITIAL_WARM_UP_DURATION,
  defaultPeriodDuration: IN_CODE_INITIAL_PERIOD_DURATION,
  defaultOTPeriodDuration: IN_CODE_INITIAL_OT_PERIOD_DURATION,
  defaultBreakDuration: IN_CODE_INITIAL_BREAK_DURATION,
  defaultPreOTBreakDuration: IN_CODE_INITIAL_PRE_OT_BREAK_DURATION,
  defaultTimeoutDuration: IN_CODE_INITIAL_TIMEOUT_DURATION,
  maxConcurrentPenalties: IN_CODE_INITIAL_MAX_CONCURRENT_PENALTIES,
  autoStartWarmUp: IN_CODE_INITIAL_AUTO_START_WARM_UP,
  autoStartBreaks: IN_CODE_INITIAL_AUTO_START_BREAKS,
  autoStartPreOTBreaks: IN_CODE_INITIAL_AUTO_START_PRE_OT_BREAKS,
  autoStartTimeouts: IN_CODE_INITIAL_AUTO_START_TIMEOUTS,
  numberOfRegularPeriods: IN_CODE_INITIAL_NUMBER_OF_REGULAR_PERIODS,
  numberOfOvertimePeriods: IN_CODE_INITIAL_NUMBER_OF_OVERTIME_PERIODS,
  playersPerTeamOnIce: IN_CODE_INITIAL_PLAYERS_PER_TEAM_ON_ICE,
  formatAndTimingsProfiles: [defaultInitialProfile], 
  selectedFormatAndTimingsProfileId: defaultInitialProfile.id, 
  playSoundAtPeriodEnd: IN_CODE_INITIAL_PLAY_SOUND_AT_PERIOD_END,
  customHornSoundDataUrl: IN_CODE_INITIAL_CUSTOM_HORN_SOUND_DATA_URL,
  enableTeamSelectionInMiniScoreboard: IN_CODE_INITIAL_ENABLE_TEAM_SELECTION_IN_MINI_SCOREBOARD,
  enablePlayerSelectionForPenalties: IN_CODE_INITIAL_ENABLE_PLAYER_SELECTION_FOR_PENALTIES,
  showAliasInPenaltyPlayerSelector: IN_CODE_INITIAL_SHOW_ALIAS_IN_PENALTY_PLAYER_SELECTOR,
  showAliasInControlsPenaltyList: IN_CODE_INITIAL_SHOW_ALIAS_IN_CONTROLS_PENALTY_LIST,
  showAliasInScoreboardPenalties: IN_CODE_INITIAL_SHOW_ALIAS_IN_SCOREBOARD_PENALTIES,
  enablePenaltyCountdownSound: IN_CODE_INITIAL_ENABLE_PENALTY_COUNTDOWN_SOUND,
  penaltyCountdownStartTime: IN_CODE_INITIAL_PENALTY_COUNTDOWN_START_TIME,
  customPenaltyBeepSoundDataUrl: IN_CODE_INITIAL_CUSTOM_PENALTY_BEEP_SOUND_DATA_URL,
  scoreboardLayout: IN_CODE_INITIAL_LAYOUT_SETTINGS,
  scoreboardLayoutProfiles: [defaultInitialLayoutProfile],
  selectedScoreboardLayoutProfileId: defaultInitialLayoutProfile.id,
  availableCategories: IN_CODE_INITIAL_AVAILABLE_CATEGORIES, 
  selectedMatchCategory: IN_CODE_INITIAL_SELECTED_MATCH_CATEGORY,
  goals: [],
  gameSummary: IN_CODE_INITIAL_GAME_SUMMARY,
  playHornTrigger: 0,
  playPenaltyBeepTrigger: 0,
  teams: [],
  _lastActionOriginator: undefined,
  _lastUpdatedTimestamp: undefined,
  _initialConfigLoadComplete: false,
};

const GameStateContext = createContext<{
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  isLoading: boolean;
} | undefined>(undefined);


const handleAutoTransition = (currentState: GameState): GameState => {
  let newGameStateAfterTransition: GameState = { ...currentState, clock: { ...currentState.clock } };
  const numRegPeriods = currentState.numberOfRegularPeriods;
  const totalGamePeriods = numRegPeriods + currentState.numberOfOvertimePeriods;
  let shouldTriggerHorn = true;

  newGameStateAfterTransition.penalties.home = [...currentState.penalties.home];
  newGameStateAfterTransition.penalties.away = [...currentState.penalties.away];

  if (currentState.clock.periodDisplayOverride === 'Warm-up') {
    newGameStateAfterTransition.clock.currentPeriod = 1;
    newGameStateAfterTransition.clock.currentTime = currentState.defaultPeriodDuration;
    newGameStateAfterTransition.clock.isClockRunning = false;
    newGameStateAfterTransition.clock.periodDisplayOverride = null;
  } else if (currentState.clock.periodDisplayOverride === 'Break' || currentState.clock.periodDisplayOverride === 'Pre-OT Break') {
    const nextPeriod = currentState.clock.currentPeriod + 1;
    const nextPeriodDuration = nextPeriod > numRegPeriods ? currentState.defaultOTPeriodDuration : currentState.defaultPeriodDuration;
    newGameStateAfterTransition.clock.currentPeriod = nextPeriod;
    newGameStateAfterTransition.clock.currentTime = nextPeriodDuration;
    newGameStateAfterTransition.clock.isClockRunning = false;
    newGameStateAfterTransition.clock.periodDisplayOverride = null;

    // "Unfreeze" penalties for the new period
    const unfreezePenalty = (p: Penalty): Penalty => {
        if (p._status === 'running' && p.expirationTime !== undefined) {
            // When frozen, expirationTime holds the remaining time.
            const remainingTimeCs = p.expirationTime;
            return {
                ...p,
                expirationPeriod: nextPeriod,
                expirationTime: nextPeriodDuration - remainingTimeCs,
            };
        }
        return p;
    };
    newGameStateAfterTransition.penalties.home = newGameStateAfterTransition.penalties.home.map(unfreezePenalty);
    newGameStateAfterTransition.penalties.away = newGameStateAfterTransition.penalties.away.map(unfreezePenalty);

  } else if (currentState.clock.periodDisplayOverride === 'Time Out') {
    if (currentState.clock.preTimeoutState) {
      const { period, time, override: preTimeoutOverride } = currentState.clock.preTimeoutState;
      newGameStateAfterTransition.clock.currentPeriod = period;
      newGameStateAfterTransition.clock.currentTime = time;
      newGameStateAfterTransition.clock.isClockRunning = false;
      newGameStateAfterTransition.clock.periodDisplayOverride = preTimeoutOverride;
      newGameStateAfterTransition.clock.clockStartTimeMs = null;
      newGameStateAfterTransition.clock.remainingTimeAtStartCs = null;
      newGameStateAfterTransition.clock.preTimeoutState = null;
    } else {
      newGameStateAfterTransition.clock.currentTime = currentState.clock.currentTime;
      newGameStateAfterTransition.clock.isClockRunning = false;
      newGameStateAfterTransition.clock.periodDisplayOverride = currentState.clock.periodDisplayOverride; 
    }
  } else if (currentState.clock.periodDisplayOverride === null) { 
    if (currentState.clock.currentPeriod < numRegPeriods) {
      newGameStateAfterTransition.clock.currentTime = currentState.defaultBreakDuration;
      newGameStateAfterTransition.clock.isClockRunning = currentState.autoStartBreaks && currentState.defaultBreakDuration > 0;
      newGameStateAfterTransition.clock.periodDisplayOverride = 'Break';
      newGameStateAfterTransition.clock.clockStartTimeMs = (currentState.autoStartBreaks && currentState.defaultBreakDuration > 0) ? Date.now() : null;
      newGameStateAfterTransition.clock.remainingTimeAtStartCs = (currentState.autoStartBreaks && currentState.defaultBreakDuration > 0) ? currentState.defaultBreakDuration : null;
    } else if (currentState.clock.currentPeriod === numRegPeriods && currentState.numberOfOvertimePeriods > 0) {
      newGameStateAfterTransition.clock.currentTime = currentState.defaultPreOTBreakDuration;
      newGameStateAfterTransition.clock.isClockRunning = currentState.autoStartPreOTBreaks && currentState.defaultPreOTBreakDuration > 0;
      newGameStateAfterTransition.clock.periodDisplayOverride = 'Pre-OT Break';
      newGameStateAfterTransition.clock.clockStartTimeMs = (currentState.autoStartPreOTBreaks && currentState.defaultPreOTBreakDuration > 0) ? Date.now() : null;
      newGameStateAfterTransition.clock.remainingTimeAtStartCs = (currentState.autoStartPreOTBreaks && currentState.defaultPreOTBreakDuration > 0) ? currentState.defaultPreOTBreakDuration : null;
    } else if (currentState.clock.currentPeriod > numRegPeriods && currentState.clock.currentPeriod < totalGamePeriods) {
      newGameStateAfterTransition.clock.currentTime = currentState.defaultPreOTBreakDuration;
      newGameStateAfterTransition.clock.isClockRunning = currentState.autoStartPreOTBreaks && currentState.defaultPreOTBreakDuration > 0;
      newGameStateAfterTransition.clock.periodDisplayOverride = 'Pre-OT Break';
      newGameStateAfterTransition.clock.clockStartTimeMs = (currentState.autoStartPreOTBreaks && currentState.defaultPreOTBreakDuration > 0) ? Date.now() : null;
      newGameStateAfterTransition.clock.remainingTimeAtStartCs = (currentState.autoStartPreOTBreaks && currentState.defaultPreOTBreakDuration > 0) ? currentState.defaultPreOTBreakDuration : null;
    } else if (currentState.clock.currentPeriod >= totalGamePeriods) { 
      newGameStateAfterTransition.clock.currentTime = 0;
      newGameStateAfterTransition.clock.isClockRunning = false;
      newGameStateAfterTransition.clock.periodDisplayOverride = "End of Game";
    } else {
      newGameStateAfterTransition.clock.currentTime = 0;
      newGameStateAfterTransition.clock.isClockRunning = false;
      newGameStateAfterTransition.clock.periodDisplayOverride = "End of Game";
    }
  } else {
    newGameStateAfterTransition.clock.currentTime = 0;
    newGameStateAfterTransition.clock.isClockRunning = false;
    shouldTriggerHorn = false; 
  }

  if (!newGameStateAfterTransition.clock.isClockRunning) {
    newGameStateAfterTransition.clock.clockStartTimeMs = null;
    newGameStateAfterTransition.clock.remainingTimeAtStartCs = null;
  }

  newGameStateAfterTransition.playHornTrigger = shouldTriggerHorn
    ? currentState.playHornTrigger + 1
    : currentState.playHornTrigger;

  const { _lastActionOriginator, _lastUpdatedTimestamp, ...returnState } = newGameStateAfterTransition;
  return returnState;
};


const updatePenaltyStatusesOnly = (penalties: Penalty[], maxConcurrent: number): Penalty[] => {
  const newPenalties: Penalty[] = [];
  const activePlayerTickets: Set<string> = new Set();
  let concurrentRunningCount = 0;

  for (const p of penalties) {
    if (p._status === 'pending_puck') {
      newPenalties.push({ ...p });
      continue;
    }

    let currentStatus: Penalty['_status'] = undefined;
    if (p.playerNumber && activePlayerTickets.has(p.playerNumber)) {
      currentStatus = 'pending_player';
    } else if (concurrentRunningCount < maxConcurrent) {
      currentStatus = 'running';
      if (p.playerNumber) {
          activePlayerTickets.add(p.playerNumber);
      }
      concurrentRunningCount++;
    } else {
      currentStatus = 'pending_concurrent';
    }
    newPenalties.push({ ...p, _status: currentStatus });
  }
  return newPenalties;
};

const statusOrderValues: Record<NonNullable<Penalty['_status']>, number> = {
  running: 1,
  pending_player: 2,
  pending_concurrent: 3,
  pending_puck: 4,
};

const sortPenaltiesByStatus = (penalties: Penalty[]): Penalty[] => {
  const penaltiesToSort = [...penalties];
  return penaltiesToSort.sort((a, b) => {
    const aStatusVal = a._status ? (statusOrderValues[a._status] ?? 5) : 0;
    const bStatusVal = b._status ? (statusOrderValues[b._status] ?? 5) : 0;

    if (aStatusVal !== bStatusVal) {
      return aStatusVal - bStatusVal;
    }
    return 0;
  });
};

const cleanPenaltiesForStorage = (penalties?: Penalty[]): Penalty[] => {
  if (!penalties) return [];
  return penalties.map(p => {
    if (p._status && p._status !== 'pending_puck') {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _status, ...rest } = p;
      return rest as Penalty;
    }
    return p;
  });
};


const applyFormatAndTimingsProfileToState = (state: GameState, profileId: string | null): GameState => {
  const profileToApply = state.formatAndTimingsProfiles.find(p => p.id === profileId) || state.formatAndTimingsProfiles[0] || createDefaultFormatAndTimingsProfile();
  if (!profileToApply) return state; 

  return {
    ...state,
    selectedFormatAndTimingsProfileId: profileToApply.id,
    defaultWarmUpDuration: profileToApply.defaultWarmUpDuration,
    defaultPeriodDuration: profileToApply.defaultPeriodDuration,
    defaultOTPeriodDuration: profileToApply.defaultOTPeriodDuration,
    defaultBreakDuration: profileToApply.defaultBreakDuration,
    defaultPreOTBreakDuration: profileToApply.defaultPreOTBreakDuration,
    defaultTimeoutDuration: profileToApply.defaultTimeoutDuration,
    maxConcurrentPenalties: profileToApply.maxConcurrentPenalties,
    autoStartWarmUp: profileToApply.autoStartWarmUp,
    autoStartBreaks: profileToApply.autoStartBreaks,
    autoStartPreOTBreaks: profileToApply.autoStartPreOTBreaks,
    autoStartTimeouts: profileToApply.autoStartTimeouts,
    numberOfRegularPeriods: profileToApply.numberOfRegularPeriods,
    numberOfOvertimePeriods: profileToApply.numberOfOvertimePeriods,
    playersPerTeamOnIce: profileToApply.playersPerTeamOnIce,
  };
};

const applyScoreboardLayoutProfileToState = (state: GameState, profileId: string | null): GameState => {
  const profileToApply = state.scoreboardLayoutProfiles.find(p => p.id === profileId) || state.scoreboardLayoutProfiles[0] || createDefaultScoreboardLayoutProfile();
  if (!profileToApply) return state;

  const { id, name, ...layoutSettings } = profileToApply;

  return {
    ...state,
    selectedScoreboardLayoutProfileId: id,
    scoreboardLayout: layoutSettings,
  };
};


const gameReducer = (state: GameState, action: GameAction): GameState => {
  let newStateWithoutMeta: Omit<GameState, '_lastActionOriginator' | '_lastUpdatedTimestamp' | 'playHornTrigger' | 'playPenaltyBeepTrigger' | '_initialConfigLoadComplete'>;
  let newPlayHornTrigger = state.playHornTrigger;
  let newPlayPenaltyBeepTrigger = state.playPenaltyBeepTrigger;
  let newTimestamp = Date.now();
  let tempState = { ...state }; 

  switch (action.type) {
    case 'HYDRATE_FROM_STORAGE': {
      let hydratedBasePartial: Partial<GameState> = { ...(action.payload ?? {}) };

      // Hydrate Format & Timings Profiles
      let hydratedFormatProfiles = action.payload?.formatAndTimingsProfiles;
      if (!hydratedFormatProfiles || hydratedFormatProfiles.length === 0) {
        hydratedFormatProfiles = [createDefaultFormatAndTimingsProfile()];
      }
      let hydratedSelectedFormatProfileId = action.payload?.selectedFormatAndTimingsProfileId;
      if (!hydratedSelectedFormatProfileId || !hydratedFormatProfiles.find(p => p.id === hydratedSelectedFormatProfileId)) {
        hydratedSelectedFormatProfileId = hydratedFormatProfiles[0]?.id || null;
      }
      const selectedFormatProfileValues = hydratedFormatProfiles.find(p => p.id === hydratedSelectedFormatProfileId) || hydratedFormatProfiles[0];

      // Hydrate Scoreboard Layout Profiles
      let hydratedLayoutProfiles = action.payload?.scoreboardLayoutProfiles;
      if (!hydratedLayoutProfiles || hydratedLayoutProfiles.length === 0) {
        hydratedLayoutProfiles = [createDefaultScoreboardLayoutProfile()];
      }
      let hydratedSelectedLayoutProfileId = action.payload?.selectedScoreboardLayoutProfileId;
      if (!hydratedSelectedLayoutProfileId || !hydratedLayoutProfiles.find(p => p.id === hydratedSelectedLayoutProfileId)) {
        hydratedSelectedLayoutProfileId = hydratedLayoutProfiles[0]?.id || null;
      }
      const selectedLayoutProfileValues = hydratedLayoutProfiles.find(p => p.id === hydratedSelectedLayoutProfileId) || hydratedLayoutProfiles[0];
      const { id: layoutId, name: layoutName, ...layoutSettings } = selectedLayoutProfileValues || createDefaultScoreboardLayoutProfile();

      // Hydrate Categories
      let hydratedCategories: CategoryData[] = action.payload?.availableCategories || [].concat(IN_CODE_INITIAL_AVAILABLE_CATEGORIES);
      if (Array.isArray(hydratedCategories) && hydratedCategories.length > 0 && typeof hydratedCategories[0] === 'string') {
         hydratedCategories = (hydratedCategories as unknown as string[]).map(name => ({ id: name, name: name }));
      }
      
      const hydratedBase: GameState = {
        ...initialGlobalState, 
        ...selectedFormatProfileValues, 
        ...(action.payload ?? {}), 
        formatAndTimingsProfiles: hydratedFormatProfiles,
        selectedFormatAndTimingsProfileId: hydratedSelectedFormatProfileId,
        scoreboardLayout: layoutSettings,
        scoreboardLayoutProfiles: hydratedLayoutProfiles,
        availableCategories: hydratedCategories, 
        teams: (action.payload?.teams || state.teams).map(t => ({...t, subName: t.subName || undefined })), 
        playHornTrigger: state.playHornTrigger, 
        playPenaltyBeepTrigger: state.playPenaltyBeepTrigger,
        _initialConfigLoadComplete: true, 
      };
      
      // Post-hydration fix:
      if (!hydratedBase.gameSummary) {
          hydratedBase.gameSummary = IN_CODE_INITIAL_GAME_SUMMARY;
      }

      if (!hydratedBase.availableCategories.find(c => c.id === hydratedBase.selectedMatchCategory) && hydratedBase.availableCategories.length > 0) {
        hydratedBase.selectedMatchCategory = hydratedBase.availableCategories[0].id;
      } else if (hydratedBase.availableCategories.length === 0) {
        hydratedBase.selectedMatchCategory = ''; 
      }

      const rawHomePenaltiesFromStorage = action.payload?.penalties?.home || [];
      const rawAwayPenaltiesFromStorage = action.payload?.penalties?.away || [];

      hydratedBase.penalties.home = sortPenaltiesByStatus(
        updatePenaltyStatusesOnly(rawHomePenaltiesFromStorage as Penalty[], hydratedBase.maxConcurrentPenalties)
      );
      hydratedBase.penalties.away = sortPenaltiesByStatus(
        updatePenaltyStatusesOnly(rawAwayPenaltiesFromStorage as Penalty[], hydratedBase.maxConcurrentPenalties)
      );
      
      const { _lastActionOriginator, _lastUpdatedTimestamp, playHornTrigger: hydratedHornTrigger, playPenaltyBeepTrigger: hydratedBeepTrigger, _initialConfigLoadComplete, ...restOfHydrated } = hydratedBase;
      newStateWithoutMeta = restOfHydrated;
      return { ...newStateWithoutMeta, playHornTrigger: state.playHornTrigger, playPenaltyBeepTrigger: state.playPenaltyBeepTrigger, _lastActionOriginator: undefined, _lastUpdatedTimestamp: action.payload?._lastUpdatedTimestamp, _initialConfigLoadComplete: true };
    }
    case 'SET_STATE_FROM_LOCAL_BROADCAST': {
      const incomingTimestamp = action.payload._lastUpdatedTimestamp;
      const currentTimestamp = state._lastUpdatedTimestamp;

      if (incomingTimestamp && currentTimestamp && incomingTimestamp < currentTimestamp) {
        return { ...state, _lastActionOriginator: undefined };
      }
      if (incomingTimestamp === undefined && currentTimestamp !== undefined) {
         return { ...state, _lastActionOriginator: undefined };
      }

      const { _lastActionOriginator, playHornTrigger: receivedPlayHornTrigger, playPenaltyBeepTrigger: receivedPenaltyBeepTrigger, _initialConfigLoadComplete, ...restOfPayload } = action.payload;
      newStateWithoutMeta = restOfPayload;
      newPlayHornTrigger = receivedPlayHornTrigger !== state.playHornTrigger ? receivedPlayHornTrigger : state.playHornTrigger;
      newPlayPenaltyBeepTrigger = receivedPenaltyBeepTrigger !== state.playPenaltyBeepTrigger ? receivedPenaltyBeepTrigger : state.playPenaltyBeepTrigger;
      return { ...newStateWithoutMeta, playHornTrigger: newPlayHornTrigger, playPenaltyBeepTrigger: newPlayPenaltyBeepTrigger, _lastActionOriginator: undefined, _lastUpdatedTimestamp: incomingTimestamp, _initialConfigLoadComplete: state._initialConfigLoadComplete };
    }
    case 'TOGGLE_CLOCK': {
      let newClockState = { ...state.clock };

      if (state.clock.periodDisplayOverride === "End of Game") {
        newStateWithoutMeta = state; 
        break;
      }

      if (state.clock.isClockRunning) {
        if (state.clock.clockStartTimeMs && state.clock.remainingTimeAtStartCs !== null) {
          const elapsedMs = Date.now() - state.clock.clockStartTimeMs;
          const elapsedCs = Math.floor(elapsedMs / 10);
          newClockState.currentTime = Math.max(0, state.clock.remainingTimeAtStartCs - elapsedCs);
        }
        newClockState.isClockRunning = false;
        newClockState.clockStartTimeMs = null;
        newClockState.remainingTimeAtStartCs = null;
        if (newClockState.currentTime <= 0) {
            newPlayHornTrigger = state.playHornTrigger + 1;
        }
      } else {
        if (state.clock.currentTime > 0) {
          newClockState.isClockRunning = true;
          newClockState.clockStartTimeMs = Date.now();
          newClockState.remainingTimeAtStartCs = state.clock.currentTime;
        } else {
          newClockState.isClockRunning = false;
          newClockState.clockStartTimeMs = null;
          newClockState.remainingTimeAtStartCs = null;
        }
      }
      newStateWithoutMeta = { ...state, clock: newClockState };
      break;
    }
    case 'SET_TIME': {
      if (state.clock.periodDisplayOverride === "End of Game") {
        newStateWithoutMeta = state; break;
      }
      const newTimeCs = Math.max(0, (action.payload.minutes * 60 + action.payload.seconds) * CENTISECONDS_PER_SECOND);
      const newIsClockRunning = newTimeCs > 0 ? state.clock.isClockRunning : false;
      
      const newClockState = {
        ...state.clock,
        currentTime: newTimeCs,
        isClockRunning: newIsClockRunning,
        clockStartTimeMs: newIsClockRunning ? Date.now() : null,
        remainingTimeAtStartCs: newIsClockRunning ? newTimeCs : null,
      };

      newStateWithoutMeta = { ...state, clock: newClockState };
       if (!newIsClockRunning && newTimeCs <=0 && state.clock.currentTime > 0) {
        newPlayHornTrigger = state.playHornTrigger + 1;
      }
      break;
    }
    case 'ADJUST_TIME': {
      if (state.clock.periodDisplayOverride === "End of Game") {
        newStateWithoutMeta = state; break;
      }
      let currentTimeSnapshotCs = state.clock.currentTime;
      if (state.clock.isClockRunning && state.clock.clockStartTimeMs && state.clock.remainingTimeAtStartCs !== null) {
        const elapsedMs = Date.now() - state.clock.clockStartTimeMs;
        const elapsedCs = Math.floor(elapsedMs / 10);
        currentTimeSnapshotCs = Math.max(0, state.clock.remainingTimeAtStartCs - elapsedCs);
      }
      const newAdjustedTimeCs = Math.max(0, currentTimeSnapshotCs + action.payload);

      const newIsClockRunning = newAdjustedTimeCs > 0 ? state.clock.isClockRunning : false;
      const newClockState = {
        ...state.clock,
        currentTime: newAdjustedTimeCs,
        isClockRunning: newIsClockRunning,
        clockStartTimeMs: newIsClockRunning ? Date.now() : null,
        remainingTimeAtStartCs: newIsClockRunning ? newAdjustedTimeCs : null,
      };

      newStateWithoutMeta = { ...state, clock: newClockState };
       if (!newIsClockRunning && newAdjustedTimeCs <=0 && state.clock.currentTime > 0) {
        newPlayHornTrigger = state.playHornTrigger + 1;
      }
      break;
    }
    case 'SET_PERIOD': {
      const newPeriod = Math.max(0, action.payload);
      let periodDurationCs: number;
      let displayOverride: PeriodDisplayOverrideType;
      let autoStartClock: boolean;

      if (newPeriod === 0) {
        periodDurationCs = state.defaultWarmUpDuration;
        displayOverride = 'Warm-up';
        autoStartClock = state.autoStartWarmUp && periodDurationCs > 0;
      } else if (newPeriod > state.numberOfRegularPeriods) {
        periodDurationCs = state.defaultOTPeriodDuration;
        displayOverride = null;
        autoStartClock = false;
      } else {
        periodDurationCs = state.defaultPeriodDuration;
        displayOverride = null;
        autoStartClock = false;
      }

      newStateWithoutMeta = {
        ...state,
        clock: {
          ...state.clock,
          currentPeriod: newPeriod,
          periodDisplayOverride: displayOverride,
          currentTime: periodDurationCs,
          isClockRunning: autoStartClock,
          preTimeoutState: null,
          clockStartTimeMs: autoStartClock ? Date.now() : null,
          remainingTimeAtStartCs: autoStartClock ? periodDurationCs : null,
        }
      };
      break;
    }
    case 'RESET_PERIOD_CLOCK': {
      if (state.clock.periodDisplayOverride === "End of Game") {
        newStateWithoutMeta = state; break;
      }
      let newTimeCs: number;
      let autoStart = false;
      if (state.clock.periodDisplayOverride === 'Warm-up' || (state.clock.currentPeriod === 0 && state.clock.periodDisplayOverride === null)) {
        newTimeCs = state.defaultWarmUpDuration;
        autoStart = state.autoStartWarmUp && newTimeCs > 0;
      } else if (state.clock.periodDisplayOverride === 'Break') {
        newTimeCs = state.defaultBreakDuration;
        autoStart = state.autoStartBreaks && newTimeCs > 0;
      } else if (state.clock.periodDisplayOverride === 'Pre-OT Break') {
        newTimeCs = state.defaultPreOTBreakDuration;
        autoStart = state.autoStartPreOTBreaks && newTimeCs > 0;
      } else if (state.clock.periodDisplayOverride === 'Time Out') {
        newTimeCs = state.defaultTimeoutDuration;
        autoStart = state.autoStartTimeouts && newTimeCs > 0;
      } else if (state.clock.currentPeriod > state.numberOfRegularPeriods) {
        newTimeCs = state.defaultOTPeriodDuration;
      } else {
        newTimeCs = state.defaultPeriodDuration;
      }
      newStateWithoutMeta = {
        ...state,
        clock: {
          ...state.clock,
          currentTime: newTimeCs,
          isClockRunning: autoStart,
          clockStartTimeMs: autoStart ? Date.now() : null,
          remainingTimeAtStartCs: autoStart ? newTimeCs : null,
        }
      };
      break;
    }
    case 'ADD_GOAL': {
      const newGoal: GoalLog = {
        ...action.payload,
        id: crypto.randomUUID(),
      };
      const newGoals = [...state.goals, newGoal];
      const newHomeScore = newGoals.filter(g => g.team === 'home').length;
      const newAwayScore = newGoals.filter(g => g.team === 'away').length;
      newStateWithoutMeta = {
        ...state,
        goals: newGoals,
        score: { home: newHomeScore, away: newAwayScore },
      };
      break;
    }
    case 'EDIT_GOAL': {
      const newGoals = state.goals.map(g => g.id === action.payload.goalId ? { ...g, ...action.payload.updates } : g);
      const newHomeScore = newGoals.filter(g => g.team === 'home').length;
      const newAwayScore = newGoals.filter(g => g.team === 'away').length;
      newStateWithoutMeta = {
        ...state,
        goals: newGoals,
        score: { home: newHomeScore, away: newAwayScore },
      };
      break;
    }
    case 'DELETE_GOAL': {
      const newGoals = state.goals.filter(g => g.id !== action.payload.goalId);
      const newHomeScore = newGoals.filter(g => g.team === 'home').length;
      const newAwayScore = newGoals.filter(g => g.team === 'away').length;
      newStateWithoutMeta = {
        ...state,
        goals: newGoals,
        score: { home: newHomeScore, away: newAwayScore },
      };
      break;
    }
    case 'ADD_PENALTY': {
      const newPenaltyId = crypto.randomUUID();
      const newPenalty: Penalty = {
        playerNumber: action.payload.penalty.playerNumber,
        initialDuration: action.payload.penalty.initialDuration,
        id: newPenaltyId,
        _status: 'pending_puck',
        expirationPeriod: state.clock.currentPeriod,
      };

      let penalties = [...state.penalties[action.payload.team], newPenalty];
      penalties = updatePenaltyStatusesOnly(penalties, state.maxConcurrentPenalties);
      penalties = sortPenaltiesByStatus(penalties);
      
      const teamDetails = state.teams.find(t => t.name === state[`${action.payload.team}TeamName`]);
      const playerDetails = teamDetails?.players.find(p => p.number === newPenalty.playerNumber);

      const newPenaltyLog: PenaltyLog = {
        id: newPenaltyId,
        team: action.payload.team,
        playerNumber: newPenalty.playerNumber,
        playerName: playerDetails?.name,
        initialDuration: newPenalty.initialDuration,
        addTimestamp: Date.now(),
        addGameTime: state.clock.currentTime,
        addPeriodText: getActualPeriodText(state.clock.currentPeriod, state.clock.periodDisplayOverride, state.numberOfRegularPeriods),
      };
      
      const newGameSummary = { 
        ...state.gameSummary,
        [action.payload.team]: {
          ...state.gameSummary[action.payload.team],
          penalties: [...state.gameSummary[action.payload.team].penalties, newPenaltyLog]
        }
      };

      newStateWithoutMeta = { 
        ...state, 
        penalties: {
            ...state.penalties,
            [action.payload.team]: penalties,
        },
        gameSummary: newGameSummary,
      };
      break;
    }
    case 'REMOVE_PENALTY': {
      const penaltyToRemove = state.penalties[action.payload.team].find(p => p.id === action.payload.penaltyId);
      let penalties = state.penalties[action.payload.team].filter(p => p.id !== action.payload.penaltyId);
      penalties = updatePenaltyStatusesOnly(penalties, state.maxConcurrentPenalties);
      penalties = sortPenaltiesByStatus(penalties);

      let newGameSummary = state.gameSummary;
      if (penaltyToRemove) {
        const remainingTimeCs = penaltyToRemove.expirationTime !== undefined ? Math.max(0, state.clock.currentTime - penaltyToRemove.expirationTime) : penaltyToRemove.initialDuration * 100;
        const remainingTimeSec = Math.round(remainingTimeCs / CENTISECONDS_PER_SECOND);
        const timeServed = penaltyToRemove.initialDuration - remainingTimeSec;

        const newTeamLogs = newGameSummary[action.payload.team].penalties.map(p => {
          if (p.id === action.payload.penaltyId && !p.endReason) {
            return {
              ...p,
              endTimestamp: Date.now(),
              endGameTime: state.clock.currentTime,
              endPeriodText: getActualPeriodText(state.clock.currentPeriod, state.clock.periodDisplayOverride, state.numberOfRegularPeriods),
              endReason: 'deleted',
              timeServed,
            };
          }
          return p;
        });

        newGameSummary = {
          ...newGameSummary,
          [action.payload.team]: {
            ...newGameSummary[action.payload.team],
            penalties: newTeamLogs
          }
        }
      }

      newStateWithoutMeta = { 
        ...state, 
        penalties: {
            ...state.penalties,
            [action.payload.team]: penalties,
        },
        gameSummary: newGameSummary,
      };
      break;
    }
    case 'END_PENALTY_FOR_GOAL': {
      const { team, penaltyId } = action.payload;
      const penaltyToEnd = state.penalties[team].find(p => p.id === penaltyId);
      if (!penaltyToEnd) {
        newStateWithoutMeta = state;
        break;
      }

      let penalties = state.penalties[team].filter(p => p.id !== penaltyId);
      penalties = updatePenaltyStatusesOnly(penalties, state.maxConcurrentPenalties);
      penalties = sortPenaltiesByStatus(penalties);

      const remainingTimeCs = penaltyToEnd.expirationTime !== undefined ? Math.max(0, state.clock.currentTime - penaltyToEnd.expirationTime) : penaltyToEnd.initialDuration * 100;
      const remainingTimeSec = Math.round(remainingTimeCs / CENTISECONDS_PER_SECOND);
      const timeServed = penaltyToEnd.initialDuration - remainingTimeSec;

      const newTeamLogs = state.gameSummary[team].penalties.map(p => {
        if (p.id === penaltyId && !p.endReason) {
          return {
            ...p,
            endTimestamp: Date.now(),
            endGameTime: state.clock.currentTime,
            endPeriodText: getActualPeriodText(state.clock.currentPeriod, state.clock.periodDisplayOverride, state.numberOfRegularPeriods),
            endReason: 'goal_on_pp',
            timeServed,
          };
        }
        return p;
      });

      const newGameSummary = {
        ...state.gameSummary,
        [team]: {
          ...state.gameSummary[team],
          penalties: newTeamLogs,
        },
      };

      newStateWithoutMeta = {
        ...state,
        penalties: {
            ...state.penalties,
            [team]: penalties,
        },
        gameSummary: newGameSummary,
      };
      break;
    }
    case 'ADJUST_PENALTY_TIME': {
      const { team, penaltyId, delta } = action.payload;
      let updatedPenalties = state.penalties[team].map(p => {
        if (p.id === penaltyId) {
          if (p._status === 'running' && p.expirationTime !== undefined) {
            const newExpirationTime = p.expirationTime + (delta * CENTISECONDS_PER_SECOND);
            return { ...p, expirationTime: newExpirationTime };
          } else {
            const newInitialDuration = Math.max(0, p.initialDuration + delta);
            return { ...p, initialDuration: newInitialDuration };
          }
        }
        return p;
      });
      updatedPenalties = sortPenaltiesByStatus(updatedPenalties);
      newStateWithoutMeta = { ...state, penalties: { ...state.penalties, [team]: updatedPenalties } };
      break;
    }
    case 'SET_PENALTY_TIME': {
      const { team, penaltyId, time } = action.payload;
      const newRemainingTimeCs = time * 100;
    
      const updatedPenalties = state.penalties[team].map(p => {
        if (p.id === penaltyId) {
          let newExpirationTime: number;
          let newExpirationPeriod: number;
    
          if (state.clock.periodDisplayOverride === 'Break' || state.clock.periodDisplayOverride === 'Pre-OT Break') {
            // We are in a break. The time set is the remaining time.
            // This time will be used when the next period starts.
            newExpirationTime = newRemainingTimeCs;
            newExpirationPeriod = state.clock.currentPeriod + 1;
          } else {
            // We are in a game period. Calculate expiration point on current timeline.
            newExpirationTime = state.clock.currentTime - newRemainingTimeCs;
            newExpirationPeriod = state.clock.currentPeriod;
          }
    
          return { 
            ...p, 
            expirationTime: newExpirationTime,
            expirationPeriod: newExpirationPeriod
          };
        }
        return p;
      });
    
      const sortedPenalties = sortPenaltiesByStatus(updatedPenalties);
      newStateWithoutMeta = { ...state, penalties: { ...state.penalties, [team]: sortedPenalties } };
      break;
    }
    case 'REORDER_PENALTIES': {
      const { team, startIndex, endIndex } = action.payload;
      const currentPenalties = [...state.penalties[team]];
      const [removed] = currentPenalties.splice(startIndex, 1);
      if (removed) {
        currentPenalties.splice(endIndex, 0, removed);
      }
      let reorderedPenalties = updatePenaltyStatusesOnly(currentPenalties, state.maxConcurrentPenalties);
      reorderedPenalties = sortPenaltiesByStatus(reorderedPenalties);
      newStateWithoutMeta = { ...state, penalties: { ...state.penalties, [team]: reorderedPenalties } };
      break;
    }
    case 'ACTIVATE_PENDING_PUCK_PENALTIES': {
      const currentTimeCs = state.clock.currentTime;
      let penaltiesWereActivated = false;

      const activateAndSetExpirations = (penalties: Penalty[]): Penalty[] => {
        const originalStatuses = new Map(penalties.map(p => [p.id, p._status]));
        
        let updatedPenalties = penalties.map(p => {
          if (p._status === 'pending_puck') {
            penaltiesWereActivated = true;
            return { ...p, _status: undefined };
          }
          return p;
        });

        updatedPenalties = updatePenaltyStatusesOnly(updatedPenalties, state.maxConcurrentPenalties);

        updatedPenalties = updatedPenalties.map(p => {
          if (p._status === 'running' && originalStatuses.get(p.id) !== 'running') {
            return { ...p, expirationTime: currentTimeCs - (p.initialDuration * 100), expirationPeriod: state.clock.currentPeriod };
          }
          return p;
        });

        return sortPenaltiesByStatus(updatedPenalties);
      };
      
      const homePenalties = activateAndSetExpirations(state.penalties.home);
      const awayPenalties = activateAndSetExpirations(state.penalties.away);

      const shouldStartClock = penaltiesWereActivated && !state.clock.isClockRunning && state.clock.currentTime > 0 && state.clock.periodDisplayOverride === null;

      newStateWithoutMeta = { 
        ...state, 
        penalties: { home: homePenalties, away: awayPenalties },
        clock: shouldStartClock ? {
          ...state.clock,
          isClockRunning: true,
          clockStartTimeMs: Date.now(),
          remainingTimeAtStartCs: state.clock.currentTime,
        } : state.clock
      };
      break;
    }
    case 'TICK': {
      let hasChanged = false;
      let significantChangeOccurred = false;
      let newCalculatedTimeCs = state.clock.currentTime;
      let homePenaltiesResult = [...state.penalties.home];
      let awayPenaltiesResult = [...state.penalties.away];
      let newGameSummary: GameSummary = JSON.parse(JSON.stringify(state.gameSummary));

      if (state.clock.isClockRunning && state.clock.clockStartTimeMs && state.clock.remainingTimeAtStartCs !== null) {
        const elapsedMs = Date.now() - state.clock.clockStartTimeMs;
        const elapsedCs = Math.floor(elapsedMs / 10);
        newCalculatedTimeCs = Math.max(0, state.clock.remainingTimeAtStartCs - elapsedCs);
        if (newCalculatedTimeCs !== state.clock.currentTime) {
          hasChanged = true;
        }
      } else if (state.clock.isClockRunning && state.clock.currentTime <= 0) {
         newCalculatedTimeCs = 0;
      }
      
      const checkPenaltyBeep = (penalties: Penalty[]) => {
          if (state.enablePenaltyCountdownSound && state.clock.isClockRunning && state.clock.periodDisplayOverride === null) {
              penalties.forEach(p => {
                  if (p._status === 'running' && p.expirationTime !== undefined) {
                      const previousRemainingTimeCs = state.clock.currentTime - p.expirationTime;
                      const currentRemainingTimeCs = newCalculatedTimeCs - p.expirationTime;

                      if (currentRemainingTimeCs / CENTISECONDS_PER_SECOND <= state.penaltyCountdownStartTime && currentRemainingTimeCs > 0) {
                          if (Math.floor(previousRemainingTimeCs / CENTISECONDS_PER_SECOND) > Math.floor(currentRemainingTimeCs / CENTISECONDS_PER_SECOND)) {
                              newPlayPenaltyBeepTrigger++;
                              hasChanged = true;
                          }
                      }
                  }
              });
          }
      };

      homePenaltiesResult = updatePenaltyStatusesOnly(homePenaltiesResult, state.maxConcurrentPenalties);
      awayPenaltiesResult = updatePenaltyStatusesOnly(awayPenaltiesResult, state.maxConcurrentPenalties);
      
      const setExpirations = (penalties: Penalty[]): Penalty[] => {
        return penalties.map(p => {
          if (p._status === 'running' && p.expirationTime === undefined) {
            hasChanged = true;
            significantChangeOccurred = true;
            return {
              ...p,
              expirationTime: newCalculatedTimeCs - (p.initialDuration * 100),
              expirationPeriod: state.clock.currentPeriod,
            };
          }
          return p;
        });
      };
      homePenaltiesResult = setExpirations(homePenaltiesResult);
      awayPenaltiesResult = setExpirations(awayPenaltiesResult);

      checkPenaltyBeep(homePenaltiesResult);
      checkPenaltyBeep(awayPenaltiesResult);
      
      const processExpiredPenalties = (penalties: Penalty[], team: Team): Penalty[] => {
        const stillActivePenalties: Penalty[] = [];
        penalties.forEach(p => {
          if (p._status === 'running' && p.expirationTime !== undefined && p.expirationPeriod === state.clock.currentPeriod && newCalculatedTimeCs <= p.expirationTime) {
            hasChanged = true;
            significantChangeOccurred = true;
            const logIndex = newGameSummary[team].penalties.findIndex(log => log.id === p.id && !log.endReason);
            if (logIndex > -1) {
              newGameSummary[team].penalties[logIndex] = {
                ...newGameSummary[team].penalties[logIndex],
                endTimestamp: Date.now(),
                endGameTime: p.expirationTime,
                endPeriodText: getActualPeriodText(state.clock.currentPeriod, state.clock.periodDisplayOverride, state.numberOfRegularPeriods),
                endReason: 'completed',
                timeServed: newGameSummary[team].penalties[logIndex].initialDuration,
              };
            }
          } else {
            stillActivePenalties.push(p);
          }
        });
        return stillActivePenalties;
      };

      if (state.clock.isClockRunning && state.clock.periodDisplayOverride === null && state.clock.currentPeriod > 0) {
        homePenaltiesResult = processExpiredPenalties(homePenaltiesResult, 'home');
        awayPenaltiesResult = processExpiredPenalties(awayPenaltiesResult, 'away');
      }

      homePenaltiesResult = sortPenaltiesByStatus(homePenaltiesResult);
      awayPenaltiesResult = sortPenaltiesByStatus(awayPenaltiesResult);
      
      if (!isEqual(homePenaltiesResult, state.penalties.home) || !isEqual(awayPenaltiesResult, state.penalties.away)) {
        hasChanged = true;
      }
      
      const stateBeforeTransition = { ...state, clock: { ...state.clock, currentTime: newCalculatedTimeCs }, penalties: { home: homePenaltiesResult, away: awayPenaltiesResult }, gameSummary: newGameSummary };
      if (state.clock.isClockRunning && newCalculatedTimeCs <= 0) {
        significantChangeOccurred = true;

        const freezePenaltyTime = (p: Penalty): Penalty => {
          if (p._status === 'running' && p.expirationPeriod === state.clock.currentPeriod && p.expirationTime !== undefined) {
            const remainingTimeCs = newCalculatedTimeCs - p.expirationTime;
            return { ...p, expirationTime: remainingTimeCs };
          }
          return p;
        };

        stateBeforeTransition.penalties.home = stateBeforeTransition.penalties.home.map(freezePenaltyTime);
        stateBeforeTransition.penalties.away = stateBeforeTransition.penalties.away.map(freezePenaltyTime);

        const transitionResult = handleAutoTransition(stateBeforeTransition);
        newStateWithoutMeta = transitionResult; 
        newPlayHornTrigger = transitionResult.playHornTrigger;
        newPlayPenaltyBeepTrigger = state.playPenaltyBeepTrigger;
      } else if (hasChanged) {
        newStateWithoutMeta = stateBeforeTransition;
      } else {
        return state; 
      }
      const originator = significantChangeOccurred ? TAB_ID : undefined;
      const timestamp = significantChangeOccurred ? newTimestamp : state._lastUpdatedTimestamp;
      return { ...newStateWithoutMeta, playHornTrigger: newPlayHornTrigger, playPenaltyBeepTrigger: newPlayPenaltyBeepTrigger, _lastActionOriginator: originator, _lastUpdatedTimestamp: timestamp, _initialConfigLoadComplete: state._initialConfigLoadComplete };
    }
    case 'SET_HOME_TEAM_NAME':
      newStateWithoutMeta = { ...state, homeTeamName: action.payload || 'Local' };
      break;
    case 'SET_HOME_TEAM_SUB_NAME':
      newStateWithoutMeta = { ...state, homeTeamSubName: action.payload };
      break;
    case 'SET_AWAY_TEAM_NAME':
      newStateWithoutMeta = { ...state, awayTeamName: action.payload || 'Visitante' };
      break;
    case 'SET_AWAY_TEAM_SUB_NAME':
      newStateWithoutMeta = { ...state, awayTeamSubName: action.payload };
      break;
    case 'START_BREAK': {
      const autoStart = state.autoStartBreaks && state.defaultBreakDuration > 0;
      newStateWithoutMeta = {
        ...state,
        clock: {
          ...state.clock,
          currentTime: state.defaultBreakDuration,
          periodDisplayOverride: 'Break',
          isClockRunning: autoStart,
          preTimeoutState: null,
          clockStartTimeMs: autoStart ? Date.now() : null,
          remainingTimeAtStartCs: autoStart ? state.defaultBreakDuration : null,
        }
      };
      break;
    }
    case 'START_PRE_OT_BREAK': {
      const autoStart = state.autoStartPreOTBreaks && state.defaultPreOTBreakDuration > 0;
      newStateWithoutMeta = {
        ...state,
        clock: {
          ...state.clock,
          currentTime: state.defaultPreOTBreakDuration,
          periodDisplayOverride: 'Pre-OT Break',
          isClockRunning: autoStart,
          preTimeoutState: null,
          clockStartTimeMs: autoStart ? Date.now() : null,
          remainingTimeAtStartCs: autoStart ? state.defaultPreOTBreakDuration : null,
        }
      };
      break;
    }
    case 'START_BREAK_AFTER_PREVIOUS_PERIOD': {
      if (state.clock.currentPeriod <= 0 && state.clock.periodDisplayOverride !== 'Break' && state.clock.periodDisplayOverride !== 'Pre-OT Break') {
          newStateWithoutMeta = state; break;
      }

      const periodBeforeBreak = (state.clock.periodDisplayOverride === 'Break' || state.clock.periodDisplayOverride === 'Pre-OT Break')
                                ? state.clock.currentPeriod
                                : state.clock.currentPeriod -1;

      if (periodBeforeBreak < 1 && periodBeforeBreak !== 0) {
          newStateWithoutMeta = state; break;
      }

      if (periodBeforeBreak === 0) {
        newStateWithoutMeta = state; break;
      }

      const isPreOT = periodBeforeBreak >= state.numberOfRegularPeriods;
      const breakDurationCs = isPreOT ? state.defaultPreOTBreakDuration : state.defaultBreakDuration;
      const autoStart = isPreOT ? state.autoStartPreOTBreaks : state.autoStartBreaks;

      newStateWithoutMeta = {
        ...state,
        clock: {
          ...state.clock,
          currentPeriod: periodBeforeBreak,
          currentTime: breakDurationCs,
          periodDisplayOverride: isPreOT ? 'Pre-OT Break' : 'Break',
          isClockRunning: autoStart && breakDurationCs > 0,
          preTimeoutState: null,
          clockStartTimeMs: autoStart && breakDurationCs > 0 ? Date.now() : null,
          remainingTimeAtStartCs: autoStart && breakDurationCs > 0 ? breakDurationCs : null,
        }
      };
      break;
    }
    case 'START_TIMEOUT': {
      let preciseCurrentTimeCs = state.clock.currentTime;
      if (state.clock.isClockRunning && state.clock.clockStartTimeMs && state.clock.remainingTimeAtStartCs !== null) {
        const elapsedMs = Date.now() - state.clock.clockStartTimeMs;
        const elapsedCs = Math.floor(elapsedMs / 10);
        preciseCurrentTimeCs = Math.max(0, state.clock.remainingTimeAtStartCs - elapsedCs);
      }

      const autoStart = state.autoStartTimeouts && state.defaultTimeoutDuration > 0;
      newStateWithoutMeta = {
        ...state,
        clock: {
          ...state.clock,
          preTimeoutState: {
            period: state.clock.currentPeriod,
            time: preciseCurrentTimeCs,
            isClockRunning: state.clock.isClockRunning,
            override: state.clock.periodDisplayOverride,
            clockStartTimeMs: state.clock.clockStartTimeMs,
            remainingTimeAtStartCs: state.clock.remainingTimeAtStartCs,
          },
          currentTime: state.defaultTimeoutDuration,
          periodDisplayOverride: 'Time Out',
          isClockRunning: autoStart,
          clockStartTimeMs: autoStart ? Date.now() : null,
          remainingTimeAtStartCs: autoStart ? state.defaultTimeoutDuration : null,
        }
      };
      break;
    }
    case 'END_TIMEOUT':
      if (state.clock.preTimeoutState) {
        const { period, time, override: preTimeoutOverride } = state.clock.preTimeoutState;
        const newClockState = {
          ...state.clock,
          currentPeriod: period,
          currentTime: time,
          isClockRunning: false, // Always paused
          periodDisplayOverride: preTimeoutOverride,
          clockStartTimeMs: null,
          remainingTimeAtStartCs: null,
          preTimeoutState: null,
        };
        newStateWithoutMeta = { ...state, clock: newClockState };
      } else {
        newStateWithoutMeta = state;
      }
      break;
    case 'MANUAL_END_GAME':
      {
        newStateWithoutMeta = {
          ...state,
          clock: {
            ...state.clock,
            currentTime: 0,
            isClockRunning: false,
            periodDisplayOverride: 'End of Game',
            clockStartTimeMs: null,
            remainingTimeAtStartCs: null,
            preTimeoutState: null,
          }
        };
        newPlayHornTrigger = state.playHornTrigger + 1;
        break;
      }
    case 'ADD_FORMAT_AND_TIMINGS_PROFILE': {
      const newProfile = createDefaultFormatAndTimingsProfile(crypto.randomUUID(), action.payload.name);
      if (action.payload.profileData) {
        Object.assign(newProfile, action.payload.profileData);
      }
      const newProfiles = [...state.formatAndTimingsProfiles, newProfile];
      tempState = { ...state, formatAndTimingsProfiles: newProfiles };
      newStateWithoutMeta = applyFormatAndTimingsProfileToState(tempState, newProfile.id);
      break;
    }
    case 'UPDATE_FORMAT_AND_TIMINGS_PROFILE_DATA': {
      const { profileId, updates } = action.payload;
      const newProfiles = state.formatAndTimingsProfiles.map(p =>
        p.id === profileId ? { ...p, ...updates } : p
      );
      tempState = { ...state, formatAndTimingsProfiles: newProfiles };
      if (state.selectedFormatAndTimingsProfileId === profileId) {
        newStateWithoutMeta = applyFormatAndTimingsProfileToState(tempState, profileId);
      } else {
        newStateWithoutMeta = tempState;
      }
      break;
    }
    case 'UPDATE_FORMAT_AND_TIMINGS_PROFILE_NAME': {
      const { profileId, newName } = action.payload;
      newStateWithoutMeta = {
        ...state,
        formatAndTimingsProfiles: state.formatAndTimingsProfiles.map(p =>
          p.id === profileId ? { ...p, name: newName } : p
        ),
      };
      break;
    }
    case 'DELETE_FORMAT_AND_TIMINGS_PROFILE': {
      let newProfiles = state.formatAndTimingsProfiles.filter(p => p.id !== action.payload.profileId);
      let newSelectedId = state.selectedFormatAndTimingsProfileId;

      if (newProfiles.length === 0) {
        const defaultProfile = createDefaultFormatAndTimingsProfile();
        newProfiles = [defaultProfile];
        newSelectedId = defaultProfile.id;
      } else if (state.selectedFormatAndTimingsProfileId === action.payload.profileId) {
        newSelectedId = newProfiles[0].id;
      }
      tempState = { ...state, formatAndTimingsProfiles: newProfiles, selectedFormatAndTimingsProfileId: newSelectedId };
      newStateWithoutMeta = applyFormatAndTimingsProfileToState(tempState, newSelectedId);
      break;
    }
    case 'SELECT_FORMAT_AND_TIMINGS_PROFILE': {
      newStateWithoutMeta = applyFormatAndTimingsProfileToState(state, action.payload.profileId);
      if (state.clock.currentPeriod === 0 && state.clock.periodDisplayOverride === 'Warm-up') {
        newStateWithoutMeta.clock.currentTime = newStateWithoutMeta.defaultWarmUpDuration;
      } else if (state.clock.periodDisplayOverride === null) {
          if (state.clock.currentPeriod > state.numberOfRegularPeriods) {
              newStateWithoutMeta.clock.currentTime = newStateWithoutMeta.defaultOTPeriodDuration;
          } else {
              newStateWithoutMeta.clock.currentTime = newStateWithoutMeta.defaultPeriodDuration;
          }
      }
      newStateWithoutMeta.clock.isClockRunning = false;
      newStateWithoutMeta.clock.clockStartTimeMs = null;
      newStateWithoutMeta.clock.remainingTimeAtStartCs = null;
      break;
    }
    case 'LOAD_FORMAT_AND_TIMINGS_PROFILES': {
      let profilesToLoad = action.payload;
      if (!profilesToLoad || profilesToLoad.length === 0) {
        profilesToLoad = [createDefaultFormatAndTimingsProfile()];
      }
      const newSelectedId = profilesToLoad[0].id;
      tempState = { ...state, formatAndTimingsProfiles: profilesToLoad, selectedFormatAndTimingsProfileId: newSelectedId };
      newStateWithoutMeta = applyFormatAndTimingsProfileToState(tempState, newSelectedId);
      break;
    }
    case 'SET_DEFAULT_PERIOD_DURATION': {
      const profileId = state.selectedFormatAndTimingsProfileId;
      if (!profileId) { newStateWithoutMeta = state; break; }
      const newValue = Math.max(60 * CENTISECONDS_PER_SECOND, action.payload);
      tempState = {
        ...state,
        formatAndTimingsProfiles: state.formatAndTimingsProfiles.map(p =>
          p.id === profileId ? { ...p, defaultPeriodDuration: newValue } : p
        ),
      };
      newStateWithoutMeta = { ...tempState, defaultPeriodDuration: newValue };
      break;
    }
    case 'SET_DEFAULT_WARM_UP_DURATION': {
      const profileId = state.selectedFormatAndTimingsProfileId;
      if (!profileId) { newStateWithoutMeta = state; break; }
      const newValue = Math.max(60 * CENTISECONDS_PER_SECOND, action.payload);
      tempState = {
        ...state,
        formatAndTimingsProfiles: state.formatAndTimingsProfiles.map(p =>
          p.id === profileId ? { ...p, defaultWarmUpDuration: newValue } : p
        ),
      };
      newStateWithoutMeta = { ...tempState, defaultWarmUpDuration: newValue };
      break;
    }
     case 'SET_DEFAULT_OT_PERIOD_DURATION': {
      const profileId = state.selectedFormatAndTimingsProfileId;
      if (!profileId) { newStateWithoutMeta = state; break; }
      const newValue = Math.max(60 * CENTISECONDS_PER_SECOND, action.payload);
      tempState = {
        ...state,
        formatAndTimingsProfiles: state.formatAndTimingsProfiles.map(p =>
          p.id === profileId ? { ...p, defaultOTPeriodDuration: newValue } : p
        ),
      };
      newStateWithoutMeta = { ...tempState, defaultOTPeriodDuration: newValue };
      break;
    }
    case 'SET_DEFAULT_BREAK_DURATION': {
      const profileId = state.selectedFormatAndTimingsProfileId;
      if (!profileId) { newStateWithoutMeta = state; break; }
      const newValue = Math.max(1 * CENTISECONDS_PER_SECOND, action.payload);
      tempState = {
        ...state,
        formatAndTimingsProfiles: state.formatAndTimingsProfiles.map(p =>
          p.id === profileId ? { ...p, defaultBreakDuration: newValue } : p
        ),
      };
      newStateWithoutMeta = { ...tempState, defaultBreakDuration: newValue };
      break;
    }
    case 'SET_DEFAULT_PRE_OT_BREAK_DURATION': {
      const profileId = state.selectedFormatAndTimingsProfileId;
      if (!profileId) { newStateWithoutMeta = state; break; }
      const newValue = Math.max(1 * CENTISECONDS_PER_SECOND, action.payload);
      tempState = {
        ...state,
        formatAndTimingsProfiles: state.formatAndTimingsProfiles.map(p =>
          p.id === profileId ? { ...p, defaultPreOTBreakDuration: newValue } : p
        ),
      };
      newStateWithoutMeta = { ...tempState, defaultPreOTBreakDuration: newValue };
      break;
    }
    case 'SET_DEFAULT_TIMEOUT_DURATION': {
      const profileId = state.selectedFormatAndTimingsProfileId;
      if (!profileId) { newStateWithoutMeta = state; break; }
      const newValue = Math.max(1 * CENTISECONDS_PER_SECOND, action.payload);
      tempState = {
        ...state,
        formatAndTimingsProfiles: state.formatAndTimingsProfiles.map(p =>
          p.id === profileId ? { ...p, defaultTimeoutDuration: newValue } : p
        ),
      };
      newStateWithoutMeta = { ...tempState, defaultTimeoutDuration: newValue };
      break;
    }
    case 'SET_MAX_CONCURRENT_PENALTIES': {
      const profileId = state.selectedFormatAndTimingsProfileId;
      if (!profileId) { newStateWithoutMeta = state; break; }
      const newValue = Math.max(1, action.payload);
      tempState = {
        ...state,
        formatAndTimingsProfiles: state.formatAndTimingsProfiles.map(p =>
          p.id === profileId ? { ...p, maxConcurrentPenalties: newValue } : p
        ),
      };
      newStateWithoutMeta = { ...tempState, maxConcurrentPenalties: newValue };
      let homePenalties = updatePenaltyStatusesOnly(state.penalties.home, newValue);
      homePenalties = sortPenaltiesByStatus(homePenalties);
      let awayPenalties = updatePenaltyStatusesOnly(state.penalties.away, newValue);
      awayPenalties = sortPenaltiesByStatus(awayPenalties);
      newStateWithoutMeta.penalties = { home: homePenalties, away: awayPenalties };
      break;
    }
    case 'SET_NUMBER_OF_REGULAR_PERIODS': {
      const profileId = state.selectedFormatAndTimingsProfileId;
      if (!profileId) { newStateWithoutMeta = state; break; }
      const newValue = Math.max(1, action.payload);
      tempState = {
        ...state,
        formatAndTimingsProfiles: state.formatAndTimingsProfiles.map(p =>
          p.id === profileId ? { ...p, numberOfRegularPeriods: newValue } : p
        ),
      };
      newStateWithoutMeta = { ...tempState, numberOfRegularPeriods: newValue };
      break;
    }
    case 'SET_NUMBER_OF_OVERTIME_PERIODS': {
      const profileId = state.selectedFormatAndTimingsProfileId;
      if (!profileId) { newStateWithoutMeta = state; break; }
      const newValue = Math.max(0, action.payload);
      tempState = {
        ...state,
        formatAndTimingsProfiles: state.formatAndTimingsProfiles.map(p =>
          p.id === profileId ? { ...p, numberOfOvertimePeriods: newValue } : p
        ),
      };
      newStateWithoutMeta = { ...tempState, numberOfOvertimePeriods: newValue };
      break;
    }
    case 'SET_PLAYERS_PER_TEAM_ON_ICE': {
      const profileId = state.selectedFormatAndTimingsProfileId;
      if (!profileId) { newStateWithoutMeta = state; break; }
      const newValue = Math.max(1, action.payload);
      tempState = {
        ...state,
        formatAndTimingsProfiles: state.formatAndTimingsProfiles.map(p =>
          p.id === profileId ? { ...p, playersPerTeamOnIce: newValue } : p
        ),
      };
      newStateWithoutMeta = { ...tempState, playersPerTeamOnIce: newValue };
      break;
    }
    case 'SET_AUTO_START_WARM_UP_VALUE': {
      const profileId = state.selectedFormatAndTimingsProfileId;
      if (!profileId) { newStateWithoutMeta = state; break; }
      tempState = {
        ...state,
        formatAndTimingsProfiles: state.formatAndTimingsProfiles.map(p =>
          p.id === profileId ? { ...p, autoStartWarmUp: action.payload } : p
        ),
      };
      newStateWithoutMeta = { ...tempState, autoStartWarmUp: action.payload };
      break;
    }
    case 'SET_AUTO_START_BREAKS_VALUE': {
      const profileId = state.selectedFormatAndTimingsProfileId;
      if (!profileId) { newStateWithoutMeta = state; break; }
      tempState = {
        ...state,
        formatAndTimingsProfiles: state.formatAndTimingsProfiles.map(p =>
          p.id === profileId ? { ...p, autoStartBreaks: action.payload } : p
        ),
      };
      newStateWithoutMeta = { ...tempState, autoStartBreaks: action.payload };
      break;
    }
    case 'SET_AUTO_START_PRE_OT_BREAKS_VALUE': {
      const profileId = state.selectedFormatAndTimingsProfileId;
      if (!profileId) { newStateWithoutMeta = state; break; }
      tempState = {
        ...state,
        formatAndTimingsProfiles: state.formatAndTimingsProfiles.map(p =>
          p.id === profileId ? { ...p, autoStartPreOTBreaks: action.payload } : p
        ),
      };
      newStateWithoutMeta = { ...tempState, autoStartPreOTBreaks: action.payload };
      break;
    }
    case 'SET_AUTO_START_TIMEOUTS_VALUE': {
      const profileId = state.selectedFormatAndTimingsProfileId;
      if (!profileId) { newStateWithoutMeta = state; break; }
       tempState = {
        ...state,
        formatAndTimingsProfiles: state.formatAndTimingsProfiles.map(p =>
          p.id === profileId ? { ...p, autoStartTimeouts: action.payload } : p
        ),
      };
      newStateWithoutMeta = { ...tempState, autoStartTimeouts: action.payload };
      break;
    }
    case 'SET_PLAY_SOUND_AT_PERIOD_END':
      newStateWithoutMeta = { ...state, playSoundAtPeriodEnd: action.payload };
      break;
    case 'SET_CUSTOM_HORN_SOUND_DATA_URL':
      newStateWithoutMeta = { ...state, customHornSoundDataUrl: action.payload };
      break;
    case 'SET_ENABLE_PENALTY_COUNTDOWN_SOUND':
        newStateWithoutMeta = { ...state, enablePenaltyCountdownSound: action.payload };
        break;
    case 'SET_PENALTY_COUNTDOWN_START_TIME':
        newStateWithoutMeta = { ...state, penaltyCountdownStartTime: Math.max(1, action.payload) };
        break;
    case 'SET_CUSTOM_PENALTY_BEEP_SOUND_DATA_URL':
        newStateWithoutMeta = { ...state, customPenaltyBeepSoundDataUrl: action.payload };
        break;
    case 'UPDATE_LAYOUT_SETTINGS':
      newStateWithoutMeta = { ...state, scoreboardLayout: { ...state.scoreboardLayout, ...action.payload } };
      break;
    case 'ADD_SCOREBOARD_LAYOUT_PROFILE': {
        const newProfile = createDefaultScoreboardLayoutProfile(crypto.randomUUID(), action.payload.name);
        const newProfiles = [...state.scoreboardLayoutProfiles, newProfile];
        tempState = { ...state, scoreboardLayoutProfiles: newProfiles };
        newStateWithoutMeta = applyScoreboardLayoutProfileToState(tempState, newProfile.id);
        break;
    }
    case 'UPDATE_SCOREBOARD_LAYOUT_PROFILE_NAME': {
        const { profileId, newName } = action.payload;
        newStateWithoutMeta = {
            ...state,
            scoreboardLayoutProfiles: state.scoreboardLayoutProfiles.map(p =>
                p.id === profileId ? { ...p, name: newName } : p
            ),
        };
        break;
    }
    case 'DELETE_SCOREBOARD_LAYOUT_PROFILE': {
        let newProfiles = state.scoreboardLayoutProfiles.filter(p => p.id !== action.payload.profileId);
        let newSelectedId = state.selectedScoreboardLayoutProfileId;

        if (newProfiles.length === 0) {
            const defaultProfile = createDefaultScoreboardLayoutProfile();
            newProfiles = [defaultProfile];
            newSelectedId = defaultProfile.id;
        } else if (state.selectedScoreboardLayoutProfileId === action.payload.profileId) {
            newSelectedId = newProfiles[0].id;
        }
        tempState = { ...state, scoreboardLayoutProfiles: newProfiles, selectedScoreboardLayoutProfileId: newSelectedId };
        newStateWithoutMeta = applyScoreboardLayoutProfileToState(tempState, newSelectedId);
        break;
    }
    case 'SELECT_SCOREBOARD_LAYOUT_PROFILE': {
        newStateWithoutMeta = applyScoreboardLayoutProfileToState(state, action.payload.profileId);
        break;
    }
    case 'SAVE_CURRENT_LAYOUT_TO_PROFILE': {
        const profileId = state.selectedScoreboardLayoutProfileId;
        if (!profileId) { newStateWithoutMeta = state; break; }
        newStateWithoutMeta = {
            ...state,
            scoreboardLayoutProfiles: state.scoreboardLayoutProfiles.map(p =>
                p.id === profileId ? { ...p, ...state.scoreboardLayout } : p
            ),
        };
        break;
    }
    case 'SET_ENABLE_TEAM_SELECTION_IN_MINI_SCOREBOARD':
      if (!action.payload) {
        newStateWithoutMeta = {
          ...state,
          enableTeamSelectionInMiniScoreboard: false,
          enablePlayerSelectionForPenalties: false,
          showAliasInPenaltyPlayerSelector: false,
          showAliasInControlsPenaltyList: false,
          showAliasInScoreboardPenalties: false,
        };
      } else {
        newStateWithoutMeta = { ...state, enableTeamSelectionInMiniScoreboard: true };
      }
      break;
    case 'SET_ENABLE_PLAYER_SELECTION_FOR_PENALTIES':
      newStateWithoutMeta = { ...state, enablePlayerSelectionForPenalties: action.payload };
      if (!action.payload) {
        newStateWithoutMeta.showAliasInPenaltyPlayerSelector = false;
        newStateWithoutMeta.showAliasInControlsPenaltyList = false;
        newStateWithoutMeta.showAliasInScoreboardPenalties = false; 
      }
      break;
    case 'SET_SHOW_ALIAS_IN_PENALTY_PLAYER_SELECTOR':
      newStateWithoutMeta = { ...state, showAliasInPenaltyPlayerSelector: action.payload };
      break;
    case 'SET_SHOW_ALIAS_IN_CONTROLS_PENALTY_LIST':
      newStateWithoutMeta = { ...state, showAliasInControlsPenaltyList: action.payload };
      break;
    case 'SET_SHOW_ALIAS_IN_SCOREBOARD_PENALTIES':
      newStateWithoutMeta = { ...state, showAliasInScoreboardPenalties: action.payload };
      break;
    case 'LOAD_SOUND_AND_DISPLAY_CONFIG': {
        const config = action.payload;
        let enableTeamUsage = config.enableTeamSelectionInMiniScoreboard ?? state.enableTeamSelectionInMiniScoreboard;
        let enablePlayerSelection = config.enablePlayerSelectionForPenalties ?? state.enablePlayerSelectionForPenalties;
        let showAliasInSelector = config.showAliasInPenaltyPlayerSelector ?? state.showAliasInPenaltyPlayerSelector;
        let showAliasInControls = config.showAliasInControlsPenaltyList ?? state.showAliasInControlsPenaltyList;
        let showAliasInScoreboard = config.showAliasInScoreboardPenalties ?? state.showAliasInScoreboardPenalties;

        if (!enableTeamUsage) {
            enablePlayerSelection = false;
            showAliasInSelector = false;
            showAliasInControls = false;
            showAliasInScoreboard = false;
        }
        if (!enablePlayerSelection){
            showAliasInSelector = false;
            showAliasInControls = false;
            showAliasInScoreboard = false;
        }
        
        let profilesToLoad = config.scoreboardLayoutProfiles;
        if (!profilesToLoad || profilesToLoad.length === 0) {
            profilesToLoad = [createDefaultScoreboardLayoutProfile()];
        }
        const newSelectedId = profilesToLoad[0].id;
        const { id, name, ...layoutSettings } = profilesToLoad[0];

        newStateWithoutMeta = {
            ...state,
            playSoundAtPeriodEnd: config.playSoundAtPeriodEnd ?? state.playSoundAtPeriodEnd,
            customHornSoundDataUrl: config.customHornSoundDataUrl === undefined ? state.customHornSoundDataUrl : config.customHornSoundDataUrl,
            enableTeamSelectionInMiniScoreboard: enableTeamUsage,
            enablePlayerSelectionForPenalties: enablePlayerSelection,
            showAliasInPenaltyPlayerSelector: showAliasInSelector,
            showAliasInControlsPenaltyList: showAliasInControls,
            showAliasInScoreboardPenalties: showAliasInScoreboard,
            enablePenaltyCountdownSound: config.enablePenaltyCountdownSound ?? state.enablePenaltyCountdownSound,
            penaltyCountdownStartTime: config.penaltyCountdownStartTime ?? state.penaltyCountdownStartTime,
            customPenaltyBeepSoundDataUrl: config.customPenaltyBeepSoundDataUrl === undefined ? state.customPenaltyBeepSoundDataUrl : config.customPenaltyBeepSoundDataUrl,
            scoreboardLayout: layoutSettings,
            scoreboardLayoutProfiles: profilesToLoad,
            selectedScoreboardLayoutProfileId: newSelectedId,
        };
        break;
    }
    case 'SET_AVAILABLE_CATEGORIES': // Used by CategorySettingsCard save
      newStateWithoutMeta = { ...state, availableCategories: action.payload };
      if (!action.payload.find(c => c.id === state.selectedMatchCategory) && action.payload.length > 0) {
        newStateWithoutMeta.selectedMatchCategory = action.payload[0].id;
      } else if (action.payload.length === 0) {
        newStateWithoutMeta.selectedMatchCategory = '';
      }
      break;
    case 'SET_SELECTED_MATCH_CATEGORY':
      newStateWithoutMeta = { ...state, selectedMatchCategory: action.payload };
      break;
    case 'RESET_CONFIG_TO_DEFAULTS': {
      const factoryDefaultFormatProfile = createDefaultFormatAndTimingsProfile();
      let updatedFormatProfiles = state.formatAndTimingsProfiles;
      let selectedFormatProfileId = state.selectedFormatAndTimingsProfileId;
      if (selectedFormatProfileId) {
          updatedFormatProfiles = state.formatAndTimingsProfiles.map(p => p.id === selectedFormatProfileId ? { ...factoryDefaultFormatProfile, id: p.id, name: p.name } : p);
      }
      const activeFormatProfile = updatedFormatProfiles.find(p => p.id === selectedFormatProfileId) || factoryDefaultFormatProfile;

      const factoryDefaultLayoutProfile = createDefaultScoreboardLayoutProfile();
      let updatedLayoutProfiles = state.scoreboardLayoutProfiles;
      let selectedLayoutProfileId = state.selectedScoreboardLayoutProfileId;
      if (selectedLayoutProfileId) {
          updatedLayoutProfiles = state.scoreboardLayoutProfiles.map(p => p.id === selectedLayoutProfileId ? { ...factoryDefaultLayoutProfile, id: p.id, name: p.name } : p);
      }
      const { id, name, ...layoutSettings } = updatedLayoutProfiles.find(p => p.id === selectedLayoutProfileId) || factoryDefaultLayoutProfile;
      
      tempState = {
        ...state,
        ...activeFormatProfile,
        formatAndTimingsProfiles: updatedFormatProfiles,
        selectedFormatAndTimingsProfileId: selectedFormatProfileId,
        scoreboardLayout: layoutSettings,
        scoreboardLayoutProfiles: updatedLayoutProfiles,
        selectedScoreboardLayoutProfileId: selectedLayoutProfileId,
        playSoundAtPeriodEnd: IN_CODE_INITIAL_PLAY_SOUND_AT_PERIOD_END,
        customHornSoundDataUrl: IN_CODE_INITIAL_CUSTOM_HORN_SOUND_DATA_URL,
        enablePenaltyCountdownSound: IN_CODE_INITIAL_ENABLE_PENALTY_COUNTDOWN_SOUND,
        penaltyCountdownStartTime: IN_CODE_INITIAL_PENALTY_COUNTDOWN_START_TIME,
        customPenaltyBeepSoundDataUrl: IN_CODE_INITIAL_CUSTOM_PENALTY_BEEP_SOUND_DATA_URL,
        enableTeamSelectionInMiniScoreboard: IN_CODE_INITIAL_ENABLE_TEAM_SELECTION_IN_MINI_SCOREBOARD,
        enablePlayerSelectionForPenalties: IN_CODE_INITIAL_ENABLE_PLAYER_SELECTION_FOR_PENALTIES,
        showAliasInPenaltyPlayerSelector: IN_CODE_INITIAL_SHOW_ALIAS_IN_PENALTY_PLAYER_SELECTOR,
        showAliasInControlsPenaltyList: IN_CODE_INITIAL_SHOW_ALIAS_IN_CONTROLS_PENALTY_LIST,
        showAliasInScoreboardPenalties: IN_CODE_INITIAL_SHOW_ALIAS_IN_SCOREBOARD_PENALTIES,
        availableCategories: IN_CODE_INITIAL_AVAILABLE_CATEGORIES,
        selectedMatchCategory: IN_CODE_INITIAL_SELECTED_MATCH_CATEGORY,
        gameSummary: IN_CODE_INITIAL_GAME_SUMMARY,
      };
      const newMaxPen = tempState.maxConcurrentPenalties;
      tempState.penalties.home = sortPenaltiesByStatus(updatePenaltyStatusesOnly([], newMaxPen));
      tempState.penalties.away = sortPenaltiesByStatus(updatePenaltyStatusesOnly([], newMaxPen));
      newStateWithoutMeta = tempState;
      break;
    }
    case 'RESET_GAME_STATE': {
      const activeProfileId = state.selectedFormatAndTimingsProfileId;
      const activeProfile = state.formatAndTimingsProfiles.find(p => p.id === activeProfileId) || state.formatAndTimingsProfiles[0] || createDefaultFormatAndTimingsProfile();
      
      const initialWarmUpDurationCs = activeProfile.defaultWarmUpDuration;
      const autoStartWarmUp = activeProfile.autoStartWarmUp;

      newStateWithoutMeta = {
        ...state, 
        score: {
          home: 0,
          away: 0,
        },
        clock: {
          currentTime: initialWarmUpDurationCs,
          currentPeriod: 0,
          isClockRunning: autoStartWarmUp && initialWarmUpDurationCs > 0,
          periodDisplayOverride: 'Warm-up',
          preTimeoutState: null,
          clockStartTimeMs: (autoStartWarmUp && initialWarmUpDurationCs > 0) ? Date.now() : null,
          remainingTimeAtStartCs: (autoStartWarmUp && initialWarmUpDurationCs > 0) ? initialWarmUpDurationCs : null,
        },
        penalties: {
          home: sortPenaltiesByStatus(updatePenaltyStatusesOnly([], state.maxConcurrentPenalties)),
          away: sortPenaltiesByStatus(updatePenaltyStatusesOnly([], state.maxConcurrentPenalties)),
        },
        homeTeamName: 'Local',
        homeTeamSubName: undefined,
        awayTeamName: 'Visitante',
        awayTeamSubName: undefined,
        goals: [],
        gameSummary: IN_CODE_INITIAL_GAME_SUMMARY,
      };
      newPlayHornTrigger = state.playHornTrigger;
      newPlayPenaltyBeepTrigger = state.playPenaltyBeepTrigger;
      break;
    }
    case 'ADD_TEAM': {
      const newTeamWithId: TeamData = {
        ...action.payload,
        id: action.payload.id || crypto.randomUUID(),
        subName: action.payload.subName || undefined,
        players: action.payload.players || [],
      };
      newStateWithoutMeta = {
        ...state,
        teams: [...state.teams, newTeamWithId],
      };
      break;
    }
    case 'UPDATE_TEAM_DETAILS': {
      newStateWithoutMeta = {
        ...state,
        teams: state.teams.map(team =>
          team.id === action.payload.teamId
            ? {
                ...team,
                name: action.payload.name,
                subName: action.payload.subName || undefined,
                category: action.payload.category,
                logoDataUrl: action.payload.logoDataUrl,
              }
            : team
        ),
      };
      break;
    }
    case 'DELETE_TEAM': {
      newStateWithoutMeta = {
        ...state,
        teams: state.teams.filter(team => team.id !== action.payload.teamId),
      };
      break;
    }
    case 'ADD_PLAYER_TO_TEAM': {
      const newPlayer: PlayerData = {
        ...action.payload.player,
        id: crypto.randomUUID(),
      };
      newStateWithoutMeta = {
        ...state,
        teams: state.teams.map(team => {
          if (team.id === action.payload.teamId) {
            if (newPlayer.number && team.players.some(p => p.number === newPlayer.number)) {
              console.warn(`Duplicate player number ${newPlayer.number} for team ${team.name}`);
              return team; 
            }
            return { ...team, players: [...team.players, newPlayer] };
          }
          return team;
        }),
      };
      break;
    }
    case 'UPDATE_PLAYER_IN_TEAM': {
      const { teamId, playerId, updates } = action.payload;
      newStateWithoutMeta = {
        ...state,
        teams: state.teams.map(team => {
          if (team.id === teamId) {
            if (updates.number && team.players.some(p => p.id !== playerId && p.number === updates.number)) {
              console.warn(`Duplicate player number ${updates.number} for team ${team.name} during update`);
              return { 
                ...team,
                players: team.players.map(player =>
                    player.id === playerId ? { ...player, name: updates.name ?? player.name } : player
                )
              };
            }
            return {
              ...team,
              players: team.players.map(player =>
                player.id === playerId
                  ? { ...player, ...updates }
                  : player
              ),
            };
          }
          return team;
        }),
      };
      break;
    }
    case 'REMOVE_PLAYER_FROM_TEAM': {
      newStateWithoutMeta = {
        ...state,
        teams: state.teams.map(team =>
          team.id === action.payload.teamId
            ? { ...team, players: team.players.filter(player => player.id !== action.payload.playerId) }
            : team
        ),
      };
      break;
    }
    case 'LOAD_TEAMS_FROM_FILE':
      const validTeams = action.payload.map(team => ({
        ...team,
        subName: team.subName || undefined,
        category: team.category || (state.availableCategories[0]?.id || '')
      }));
      newStateWithoutMeta = { ...state, teams: validTeams };
      break;
    case 'SET_TEAM_ATTENDANCE': {
      const { team, playerIds } = action.payload;
      newStateWithoutMeta = {
        ...state,
        gameSummary: {
          ...state.gameSummary,
          attendance: {
            ...state.gameSummary.attendance,
            [team]: playerIds,
          },
        },
      };
      break;
    }
    default:
      const exhaustiveCheck: never = action; 
      newStateWithoutMeta = state;
      newTimestamp = state._lastUpdatedTimestamp || Date.now();
      newPlayHornTrigger = state.playHornTrigger;
      newPlayPenaltyBeepTrigger = state.playPenaltyBeepTrigger;
      break;
  }

  const nonOriginatingActionTypes: GameAction['type'][] = ['HYDRATE_FROM_STORAGE', 'SET_STATE_FROM_LOCAL_BROADCAST'];
  
  if (action.type === 'TICK') {
    return newStateWithoutMeta as GameState; // The TICK case now handles its own meta properties
  }
  
  if (nonOriginatingActionTypes.includes(action.type)) {
      if (action.type === 'TICK' && 
          state.clock.isClockRunning === newStateWithoutMeta.clock.isClockRunning && 
          state.clock.currentTime === newStateWithoutMeta.clock.currentTime &&
          JSON.stringify(state.penalties.home) === JSON.stringify(newStateWithoutMeta.penalties.home) &&
          JSON.stringify(state.penalties.away) === JSON.stringify(newStateWithoutMeta.penalties.away)) {
          return state;
      }
      return { ...newStateWithoutMeta, playHornTrigger: newPlayHornTrigger, playPenaltyBeepTrigger: newPlayPenaltyBeepTrigger, _lastActionOriginator: undefined, _lastUpdatedTimestamp: (newStateWithoutMeta as GameState)._lastUpdatedTimestamp, _initialConfigLoadComplete: (newStateWithoutMeta as GameState)._initialConfigLoadComplete };
  }
  
  return { ...newStateWithoutMeta, playHornTrigger: newPlayHornTrigger, playPenaltyBeepTrigger: newPlayPenaltyBeepTrigger, _lastActionOriginator: TAB_ID, _lastUpdatedTimestamp: newTimestamp, _initialConfigLoadComplete: state._initialConfigLoadComplete };
};


export const GameStateProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(gameReducer, initialGlobalState);
  const [isLoading, setIsLoading] = useState(true);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const prevStateRef = useRef<GameState>(state);


  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined') {
        const isVisible = !document.hidden;
        setIsPageVisible(isVisible);
        if (isVisible) {
            dispatch({ type: 'TICK' });
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      setIsPageVisible(!document.hidden);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || state._initialConfigLoadComplete) {
       if (state._initialConfigLoadComplete && isLoading) setIsLoading(false);
       if (!state._initialConfigLoadComplete && typeof window === 'undefined' && isLoading) setIsLoading(false);
      return;
    }
    
    const loadInitialState = async () => {
        let loadedStateFromLocalStorage: Partial<GameState> | null = null;
        try {
            const rawStoredState = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (rawStoredState) {
                const parsedState = JSON.parse(rawStoredState) as Partial<GameState>;
                if (parsedState && parsedState._lastUpdatedTimestamp) {
                    loadedStateFromLocalStorage = parsedState;
                }
            }
        } catch (error) {
            console.error("Error reading state from localStorage:", error);
        }

        if (loadedStateFromLocalStorage) {
            dispatch({ type: 'HYDRATE_FROM_STORAGE', payload: loadedStateFromLocalStorage });
            setIsLoading(false);
        } else {
            const fetchConfig = async (customPath: string, defaultPath: string, fallback: any, validator?: (data: any) => boolean) => {
                try {
                    const customRes = await fetch(customPath);
                    if (customRes.ok) {
                        const customData = await customRes.json();
                        if (customData && (!validator || validator(customData))) return customData;
                    }
                } catch (error) {
                    console.warn(`Error fetching custom config ${customPath}:`, error);
                }
                try {
                    const defaultRes = await fetch(defaultPath);
                    if (defaultRes.ok) {
                        const defaultData = await defaultRes.json();
                        if (defaultData && (!validator || validator(defaultData))) return defaultData;
                    }
                } catch (error) {
                    console.warn(`Error fetching default config ${defaultPath}:`, error);
                }
                return fallback;
            };

            const [
                loadedFormatTimingsProfiles,
                soundDisplayConfig,
                categoriesConfig,
                teamsConfig
            ] = await Promise.all([
                fetchConfig('/defaults/format-timings.custom.json', '/defaults/default-format-timings.json', initialGlobalState.formatAndTimingsProfiles, data => Array.isArray(data) && data.length > 0),
                fetchConfig('/defaults/sound-display.custom.json', '/defaults/default-sound-display.json', { playSoundAtPeriodEnd: initialGlobalState.playSoundAtPeriodEnd, customHornSoundDataUrl: initialGlobalState.customHornSoundDataUrl, enableTeamSelectionInMiniScoreboard: initialGlobalState.enableTeamSelectionInMiniScoreboard, enablePlayerSelectionForPenalties: initialGlobalState.enablePlayerSelectionForPenalties, showAliasInPenaltyPlayerSelector: initialGlobalState.showAliasInPenaltyPlayerSelector, showAliasInControlsPenaltyList: initialGlobalState.showAliasInControlsPenaltyList, showAliasInScoreboardPenalties: initialGlobalState.showAliasInScoreboardPenalties, scoreboardLayoutProfiles: initialGlobalState.scoreboardLayoutProfiles, enablePenaltyCountdownSound: initialGlobalState.enablePenaltyCountdownSound, penaltyCountdownStartTime: initialGlobalState.penaltyCountdownStartTime, customPenaltyBeepSoundDataUrl: initialGlobalState.customPenaltyBeepSoundDataUrl }),
                fetchConfig('/defaults/categories.custom.json', '/defaults/default-categories.json', initialGlobalState.availableCategories, data => Array.isArray(data)),
                fetchConfig('/defaults/teams.custom.json', '/defaults/default-teams.json', initialGlobalState.teams, data => Array.isArray(data))
            ]);

            const initialPayloadForHydration: Partial<GameState> = {
                formatAndTimingsProfiles: loadedFormatTimingsProfiles,
                ...soundDisplayConfig,
                availableCategories: categoriesConfig,
                teams: teamsConfig.map((t: TeamData) => ({ ...t, subName: t.subName || undefined })),
                _initialConfigLoadComplete: true,
            };
            dispatch({ type: 'HYDRATE_FROM_STORAGE', payload: initialPayloadForHydration });
            setIsLoading(false);
        }
    };


    loadInitialState();

    if ('BroadcastChannel' in window) {
      if (!channelRef.current) {
        channelRef.current = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      }
      const handleMessage = (event: MessageEvent) => {
          if (event.data && event.data._lastActionOriginator && event.data._lastActionOriginator !== TAB_ID) {
            const receivedState = event.data as GameState;
            dispatch({ type: 'SET_STATE_FROM_LOCAL_BROADCAST', payload: receivedState });
        }
      };
      channelRef.current.addEventListener('message', handleMessage);

      return () => {
        if (channelRef.current) {
          channelRef.current.removeEventListener('message', handleMessage);
        }
      };
    } else {
      console.warn('BroadcastChannel API not available. Multi-tab sync will not work.');
    }
  }, []); 
  
  useEffect(() => { 
    return () => {
      if (channelRef.current) {
        channelRef.current.close();
        channelRef.current = null;
      }
    };
  }, []);


  useEffect(() => {
    if (isLoading || typeof window === 'undefined' || !state._initialConfigLoadComplete) {
      return;
    }

    const prevState = prevStateRef.current;
    
    if (state._lastActionOriginator === TAB_ID) {
        const configKeys: (keyof ConfigFields)[] = [
            'formatAndTimingsProfiles', 'selectedFormatAndTimingsProfileId',
            'playSoundAtPeriodEnd', 'customHornSoundDataUrl', 'enableTeamSelectionInMiniScoreboard',
            'enablePlayerSelectionForPenalties', 'showAliasInPenaltyPlayerSelector',
            'showAliasInControlsPenaltyList', 'showAliasInScoreboardPenalties', 'scoreboardLayout',
            'scoreboardLayoutProfiles', 'selectedScoreboardLayoutProfileId', 'availableCategories', 'selectedMatchCategory', 'teams',
            'enablePenaltyCountdownSound', 'penaltyCountdownStartTime', 'customPenaltyBeepSoundDataUrl',
            'defaultWarmUpDuration', 'defaultPeriodDuration', 'defaultOTPeriodDuration', 'defaultBreakDuration',
            'defaultPreOTBreakDuration', 'defaultTimeoutDuration', 'maxConcurrentPenalties', 'autoStartWarmUp',
            'autoStartBreaks', 'autoStartPreOTBreaks', 'autoStartTimeouts', 'numberOfRegularPeriods',
            'numberOfOvertimePeriods', 'playersPerTeamOnIce'
        ];
        
        const liveGameStateKeys: (keyof Omit<LiveGameState, 'homeTeamName' | 'awayTeamName' | 'homeTeamSubName' | 'awayTeamSubName'>)[] = [
            'score', 'clock', 'penalties', 'goals'
        ];

        const configChanged = configKeys.some(key => !isEqual(prevState[key as keyof GameState], state[key as keyof GameState]));
        
        const liveGameStateChanged = liveGameStateKeys.some(key => !isEqual(prevState[key as keyof GameState], state[key as keyof GameState])) ||
            prevState.homeTeamName !== state.homeTeamName ||
            prevState.awayTeamName !== state.awayTeamName ||
            prevState.homeTeamSubName !== state.homeTeamSubName ||
            prevState.awayTeamSubName !== state.awayTeamSubName;


        if (configChanged) {
          const configPayload: Partial<ConfigFields> = {};
          configKeys.forEach(key => {
            if (!isEqual(prevState[key as keyof GameState], state[key as keyof GameState])) {
                (configPayload as any)[key] = state[key as keyof GameState];
            }
          });
          updateConfigOnServer(configPayload as ConfigFields).catch(err => console.error("Failed to sync config to server:", err));
        }

        if (liveGameStateChanged) {
          const liveStatePayload: LiveGameState = {
              clock: state.clock,
              score: state.score,
              penalties: state.penalties,
              goals: state.goals,
              homeTeamName: state.homeTeamName,
              awayTeamName: state.awayTeamName,
              homeTeamSubName: state.homeTeamSubName,
              awayTeamSubName: state.awayTeamSubName,
          };
          updateGameStateOnServer(liveStatePayload).catch(err => console.error("Failed to sync game state to server:", err));
        }
    }


    // The originating tab is responsible for saving state and broadcasting.
    if (state._lastActionOriginator === TAB_ID) {
        try {
            const stateForStorage: GameState = { ...state };
            stateForStorage.penalties.home = cleanPenaltiesForStorage(state.penalties.home);
            stateForStorage.penalties.away = cleanPenaltiesForStorage(state.penalties.away);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateForStorage));
        } catch (error) {
            console.error("Error saving state to localStorage:", error);
        }
        
        if (channelRef.current) {
            channelRef.current.postMessage(state);
        }
    }

    // Update the ref for the next comparison
    prevStateRef.current = state;
  }, [state, isLoading]);

  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    if (state.clock.isClockRunning && isPageVisible && !isLoading && state._initialConfigLoadComplete) {
      timerId = setInterval(() => {
        dispatch({ type: 'TICK' });
      }, TICK_INTERVAL_MS);
    }
    return () => {
      if (timerId) {
        clearInterval(timerId);
      }
    };
  }, [state.clock.isClockRunning, state.clock.currentTime, state.penalties.home, state.penalties.away, isPageVisible, isLoading, state._initialConfigLoadComplete]);
  
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (state._initialConfigLoadComplete) {
        try {
          const stateForStorage: GameState = { ...state };
          stateForStorage.penalties.home = cleanPenaltiesForStorage(state.penalties.home);
          stateForStorage.penalties.away = cleanPenaltiesForStorage(state.penalties.away);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateForStorage));
        } catch (error) {
          console.error("Error saving state on beforeunload:", error);
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [state]);


  return (
    <GameStateContext.Provider value={{ state, dispatch, isLoading }}>
      {children}
    </GameStateContext.Provider>
  );
};

export const useGameState = () => {
  const context = useContext(GameStateContext);
  if (context === undefined) {
    throw new Error('useGameState must be used within a GameStateProvider');
  }
  return context;
};

export const formatTime = (
  totalCentiseconds: number,
  options: {
    showTenths?: boolean;
    includeMinutesForTenths?: boolean;
  } = {}
): string => {
  if (isNaN(totalCentiseconds) || totalCentiseconds < 0) totalCentiseconds = 0;

  const isUnderMinute = totalCentiseconds < 6000;

  if (isUnderMinute && options.showTenths) {
    const seconds = Math.floor(totalCentiseconds / 100);
    const tenths = Math.floor((totalCentiseconds % 100) / 10);
    if (options.includeMinutesForTenths) {
      return `00:${seconds.toString().padStart(2, '0')}.${tenths.toString()}`;
    } else {
      return `${seconds.toString().padStart(2, '0')}.${tenths.toString()}`;
    }
  } else {
    const totalSecondsOnly = Math.floor(totalCentiseconds / 100);
    const minutes = Math.floor(totalSecondsOnly / 60);
    const seconds = totalSecondsOnly % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
};


export const getActualPeriodText = (period: number, override: PeriodDisplayOverrideType, numberOfRegularPeriods: number): string => {
  if (override === "Time Out") return "TIME OUT";
  if (override === "End of Game") return "END OF GAME";
  if (override) return override;
  return getPeriodText(period, numberOfRegularPeriods);
};

export const getPeriodText = (period: number, numRegPeriods: number): string => {
    if (period === 0) return "WARM-UP";
    if (period < 0) return "---";
    if (period <= numRegPeriods) {
        if (period === 1) return "1ST";
        if (period === 2) return "2ND";
        if (period === 3) return "3RD";
        if (period % 10 === 1 && period % 100 !== 11) return `${period}ST`;
        if (period % 10 === 2 && period % 100 !== 12) return `${period}ND`;
        if (period % 10 === 3 && period % 100 !== 13) return `${period}RD`;
        return `${period}TH`;
    }
    const overtimeNumber = period - numRegPeriods;
    if (overtimeNumber === 1 && numRegPeriods > 0) return 'OT';
    if (overtimeNumber > 0 && numRegPeriods > 0) return `OT${overtimeNumber}`;
    if (overtimeNumber === 1 && numRegPeriods === 0) return 'OT'; 
    if (overtimeNumber > 1 && numRegPeriods === 0) return `OT${overtimeNumber}`; 
    return "---";
};


export const minutesToSeconds = (minutes: number | string): number => {
  const numMinutes = typeof minutes === 'string' ? parseInt(minutes, 10) : minutes;
  if (isNaN(numMinutes) || numMinutes < 0) return 0;
  return numMinutes * 60;
};
export const secondsToMinutes = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return "0";
  return Math.floor(seconds / 60).toString();
};

export const centisecondsToDisplaySeconds = (centiseconds: number): string => {
  if (isNaN(centiseconds) || centiseconds < 0) return "0";
  return Math.floor(centiseconds / CENTISECONDS_PER_SECOND).toString();
};
export const centisecondsToDisplayMinutes = (centiseconds: number): string => {
  if (isNaN(centiseconds) || centiseconds < 0) return "0";
  return Math.floor(centiseconds / (60 * CENTISECONDS_PER_SECOND)).toString();
};

export const DEFAULT_SOUND_PATH = DEFAULT_HORN_SOUND_FILE_PATH;
export const DEFAULT_PENALTY_BEEP_PATH = DEFAULT_PENALTY_BEEP_FILE_PATH;

export const getEndReasonText = (reason?: PenaltyLog['endReason']): string => {
    if (!reason) return 'Activa';
    switch (reason) {
        case 'completed': return 'Cumplida';
        case 'deleted': return 'Eliminada';
        case 'goal_on_pp': return 'Gol en Contra';
        default: return 'Cerrada';
    }
};

export const getCategoryNameById = (categoryId: string, availableCategories: CategoryData[]): string | undefined => {
  if (!Array.isArray(availableCategories)) return undefined; 
  const category = availableCategories.find(cat => cat && typeof cat === 'object' && cat.id === categoryId);
  return category ? category.name : undefined;
};

export { createDefaultFormatAndTimingsProfile, createDefaultScoreboardLayoutProfile };
