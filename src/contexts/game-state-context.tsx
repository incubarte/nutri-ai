

"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useReducer, useEffect, useRef, useState, useCallback } from 'react';
import type { Penalty, Team, TeamData, PlayerData, CategoryData, ConfigState, LiveState, FormatAndTimingsProfile, FormatAndTimingsProfileData, ScoreboardLayoutSettings, ScoreboardLayoutProfile, GameSummary, GoalLog, PenaltyLog, PreTimeoutState, PeriodDisplayOverrideType, ClockState, ScoreState, PenaltiesState, GameState, GameAction, TunnelState, PenaltyTypeDefinition, AttendedPlayerInfo, PlayerStats, ShootoutState, ShotLog, SummaryPlayerStats } from '@/types';
import { useToast as showToast } from '@/hooks/use-toast';
import isEqual from 'lodash.isequal';
import { updateConfigOnServer, updateGameStateOnServer } from '@/app/actions';
import { safeUUID } from '@/lib/utils';
import defaultSettings from '@/config/defaults.json';


// --- Constantes para la sincronización local ---
export const BROADCAST_CHANNEL_NAME = 'icevision-game-state-channel';
export const GAME_STATE_STORAGE_KEY = 'icevision-game-state';
export const TEAMS_STORAGE_KEY = 'icevision-teams-data';
export const SUMMARY_DATA_STORAGE_KEY = 'icevision-summary-data';

const CENTISECONDS_PER_SECOND = 100;
const TICK_INTERVAL_MS = 200;
const FLASHING_ZERO_DURATION_MS = 5000;
export const DEFAULT_HORN_SOUND_PATH = '/audio/default-horn.wav';
export const DEFAULT_PENALTY_BEEP_PATH = '/audio/penalty_beep.wav';




let TAB_ID: string;
if (typeof window !== 'undefined') {
  if (window.crypto && window.crypto.randomUUID) {
    TAB_ID = window.crypto.randomUUID();
  } else {
    TAB_ID = `tab-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }
} else {
  TAB_ID = 'server-tab-id-' + Math.random().toString(36).substring(2);
}

// Initial values (used as fallback if files are not found or are invalid)
const IN_CODE_INITIAL_PROFILE_NAME = "Predeterminado (App)";
const IN_CODE_INITIAL_LAYOUT_PROFILE_NAME = "Diseño Predeterminado (App)";

// Sound and Display Defaults
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
const IN_CODE_INITIAL_ENABLE_DEBUG_MODE = false;
const IN_CODE_INITIAL_CHROME_BINARY_PATH = "/opt/google/chrome/google-chrome";

const IN_CODE_INITIAL_TUNNEL_STATE: TunnelState = {
  subdomain: defaultSettings.tunnel.subdomainPrefix,
  port: defaultSettings.tunnel.port,
  status: 'disconnected',
  url: null,
  lastMessage: null,
};


export const INITIAL_LAYOUT_SETTINGS: ScoreboardLayoutSettings = {
  scoreboardVerticalPosition: -4,
  scoreboardHorizontalPosition: 0,
  clockSize: 12,
  teamNameSize: 3,
  scoreSize: 8,
  periodSize: 4.5,
  playersOnIceIconSize: 1.75,
  categorySize: 1.25,
  teamLabelSize: 1,
  penaltiesTitleSize: 2,
  penaltyPlayerNumberSize: 3.5,
  penaltyTimeSize: 3.5,
  penaltyPlayerIconSize: 2.5,
  primaryColor: '223 65% 33%',
  accentColor: '40 100% 67%',
  backgroundColor: '223 70% 11%',
  mainContentGap: 3,
  scoreLabelGap: -2,
};

const IN_CODE_INITIAL_CATEGORIES_RAW = ['A', 'B', 'C', 'Menores', 'Damas'];
const IN_CODE_INITIAL_AVAILABLE_CATEGORIES: CategoryData[] = IN_CODE_INITIAL_CATEGORIES_RAW.map(name => ({ id: name, name: name }));
const IN_CODE_INITIAL_SELECTED_MATCH_CATEGORY = IN_CODE_INITIAL_AVAILABLE_CATEGORIES[0]?.id || '';

const IN_CODE_INITIAL_GAME_SUMMARY: GameSummary = {
  home: { goals: [], penalties: [], playerStats: [], homeShotsLog: [] },
  away: { goals: [], penalties: [], playerStats: [], awayShotsLog: [] },
  attendance: { home: [], away: [] },
};

const INITIAL_SHOOTOUT_STATE: ShootoutState = {
  isActive: false,
  rounds: 5,
  homeAttempts: [],
  awayAttempts: [],
  initiator: null,
};


export const createDefaultFormatAndTimingsProfile = (id?: string, name?: string): FormatAndTimingsProfile => ({
  id: id || safeUUID(),
  name: name || IN_CODE_INITIAL_PROFILE_NAME,
  ...defaultSettings.formatAndTimings,
  enableStoppedTimeAlert: false, // Default for new profiles
  stoppedTimeAlertGoalDiff: 1,
  stoppedTimeAlertTimeRemaining: 2,
  penaltyTypes: defaultSettings.penaltyTypes.map(p => ({
    ...p,
    reducesPlayerCount: p.reducesPlayerCount,
    clearsOnGoal: p.clearsOnGoal,
    isBenchPenalty: p.isBenchPenalty || false,
  })) as PenaltyTypeDefinition[],
  defaultPenaltyTypeId: defaultSettings.defaultPenaltyTypeId,
});

export const createDefaultScoreboardLayoutProfile = (id?: string, name?: string): ScoreboardLayoutProfile => ({
    id: id || safeUUID(),
    name: name || IN_CODE_INITIAL_LAYOUT_PROFILE_NAME,
    ...INITIAL_LAYOUT_SETTINGS
});

const defaultInitialProfile = createDefaultFormatAndTimingsProfile();
const defaultInitialLayoutProfile = createDefaultScoreboardLayoutProfile();

const getInitialState = (): GameState => {
  return {
    config: {
      ...defaultSettings.formatAndTimings,
      enableStoppedTimeAlert: false,
      stoppedTimeAlertGoalDiff: 1,
      stoppedTimeAlertTimeRemaining: 2,
      penaltyTypes: defaultSettings.penaltyTypes.map(p => ({...p, isBenchPenalty: p.isBenchPenalty || false })) as PenaltyTypeDefinition[],
      defaultPenaltyTypeId: defaultSettings.defaultPenaltyTypeId,
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
      enableDebugMode: IN_CODE_INITIAL_ENABLE_DEBUG_MODE,
      scoreboardLayout: INITIAL_LAYOUT_SETTINGS,
      scoreboardLayoutProfiles: [defaultInitialLayoutProfile],
      selectedScoreboardLayoutProfileId: defaultInitialLayoutProfile.id,
      availableCategories: IN_CODE_INITIAL_AVAILABLE_CATEGORIES,
      selectedMatchCategory: IN_CODE_INITIAL_SELECTED_MATCH_CATEGORY,
      teams: [],
      tunnel: IN_CODE_INITIAL_TUNNEL_STATE,
    },
    live: {
      score: { home: 0, away: 0, homeShots: 0, awayShots: 0, homeGoals: [], awayGoals: [] },
      penalties: { home: [], away: [] },
      clock: {
        currentTime: defaultInitialProfile.defaultWarmUpDuration, currentPeriod: 0, isClockRunning: false,
        periodDisplayOverride: 'Warm-up', preTimeoutState: null, clockStartTimeMs: null, remainingTimeAtStartCs: null,
        absoluteElapsedTimeCs: 0, _liveAbsoluteElapsedTimeCs: 0, isFlashingZero: false,
      },
      shootout: INITIAL_SHOOTOUT_STATE,
      homeTeamName: 'Local', homeTeamSubName: undefined, awayTeamName: 'Visitante', awayTeamSubName: undefined,
      gameSummary: IN_CODE_INITIAL_GAME_SUMMARY, playHornTrigger: 0, playPenaltyBeepTrigger: 0,
      pendingPowerPlayGoal: null,
    },
    _initialConfigLoadComplete: false,
  };
};

type GameStateContextType = {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  isLoading: boolean;
};

const GameStateContext = createContext<GameStateContextType | undefined>(undefined);


// --- Helper Function for Absolute Time Calculation ---
const calculateAbsoluteTimeForPeriod = (targetPeriod: number, remainingTimeInPeriodCs: number, state: GameState): number => {
    if (targetPeriod <= 0) {
        return 0;
    }

    let totalElapsedCs = 0;
    const { numberOfRegularPeriods, defaultPeriodDuration, defaultOTPeriodDuration } = state.config;

    for (let i = 1; i < targetPeriod; i++) {
        totalElapsedCs += (i <= numberOfRegularPeriods) ? defaultPeriodDuration : defaultOTPeriodDuration;
    }

    const currentPeriodDuration = (targetPeriod <= numberOfRegularPeriods) ? defaultPeriodDuration : defaultOTPeriodDuration;
    totalElapsedCs += currentPeriodDuration - remainingTimeInPeriodCs;

    return Math.max(0, totalElapsedCs);
};



const handleAutoTransition = (currentState: GameState): GameState => {
  let newGameStateAfterTransition: GameState = JSON.parse(JSON.stringify(currentState));
  const { 
    numberOfRegularPeriods, 
    numberOfOvertimePeriods, 
    defaultBreakDuration, 
    defaultPreOTBreakDuration, 
    autoStartBreaks, 
    autoStartPreOTBreaks,
    defaultPeriodDuration,
    defaultOTPeriodDuration,
  } = currentState.config;
  const { currentPeriod, periodDisplayOverride, preTimeoutState } = currentState.live.clock;
  const { score } = currentState.live;
  const totalGamePeriods = numberOfRegularPeriods + numberOfOvertimePeriods;
  
  switch(periodDisplayOverride) {
    case 'Warm-up':
      // Warm-up ends, start Period 1 (paused)
      newGameStateAfterTransition.live.clock.currentPeriod = 1;
      newGameStateAfterTransition.live.clock.currentTime = defaultPeriodDuration;
      newGameStateAfterTransition.live.clock.periodDisplayOverride = null;
      newGameStateAfterTransition.live.clock.isClockRunning = false;
      break;

    case 'Break':
    case 'Pre-OT Break':
      // A break ends, start the next period (paused)
      const nextPeriod = currentPeriod + 1;
      newGameStateAfterTransition.live.clock.currentPeriod = nextPeriod;
      newGameStateAfterTransition.live.clock.currentTime = (nextPeriod > numberOfRegularPeriods) ? defaultOTPeriodDuration : defaultPeriodDuration;
      newGameStateAfterTransition.live.clock.periodDisplayOverride = null;
      newGameStateAfterTransition.live.clock.isClockRunning = false;
      break;

    case 'Time Out':
      // A timeout ends, restore previous state (paused)
      if (preTimeoutState) {
        newGameStateAfterTransition.live.clock = {
          ...currentState.live.clock,
          currentPeriod: preTimeoutState.period,
          currentTime: preTimeoutState.time,
          isClockRunning: false,
          periodDisplayOverride: preTimeoutState.override,
          absoluteElapsedTimeCs: preTimeoutState.absoluteElapsedTimeCs,
          _liveAbsoluteElapsedTimeCs: preTimeoutState.absoluteElapsedTimeCs,
          preTimeoutState: null,
        };
      }
      break;
    
    case null: // A game period ends
      const newAbsoluteTime = calculateAbsoluteTimeForPeriod(currentPeriod, 0, currentState);
      newGameStateAfterTransition.live.clock.absoluteElapsedTimeCs = newAbsoluteTime;
      newGameStateAfterTransition.live.clock._liveAbsoluteElapsedTimeCs = newAbsoluteTime;

      // Check for end of regulation or last OT
      if (currentPeriod >= totalGamePeriods) {
          if (score.home !== score.away) {
              // Game ends, no tie
              newGameStateAfterTransition.live.clock.periodDisplayOverride = "End of Game";
          } else {
              // Tie game, go to pre-end decision state
              newGameStateAfterTransition.live.clock.periodDisplayOverride = "Shootout";
              newGameStateAfterTransition.live.shootout.isActive = false; 
          }
      } else if (currentPeriod >= numberOfRegularPeriods) {
          // It's a regular OT period that ended (but not the last one)
          if (score.home !== score.away) {
              // Golden goal situation in a non-final OT, game is over
              newGameStateAfterTransition.live.clock.periodDisplayOverride = "End of Game";
          } else {
              // Start a pre-OT break before the next OT
              newGameStateAfterTransition.live.clock.currentTime = defaultPreOTBreakDuration;
              newGameStateAfterTransition.live.clock.isClockRunning = autoStartPreOTBreaks && defaultPreOTBreakDuration > 0;
              newGameStateAfterTransition.live.clock.periodDisplayOverride = 'Pre-OT Break';
          }
      } else {
        // End of a regular period, not the final one
        newGameStateAfterTransition.live.clock.currentTime = defaultBreakDuration;
        newGameStateAfterTransition.live.clock.isClockRunning = autoStartBreaks && defaultBreakDuration > 0;
        newGameStateAfterTransition.live.clock.periodDisplayOverride = 'Break';
      }
      break;

    default: // No transition, e.g. "End of Game"
      break;
  }

  // Common logic for state after transition
  if (newGameStateAfterTransition.live.clock.periodDisplayOverride === 'End of Game') {
    newGameStateAfterTransition.live.clock.currentTime = 0;
    newGameStateAfterTransition.live.clock.isClockRunning = false;
  }
  
  // This ensures isClockRunning is always a boolean
  newGameStateAfterTransition.live.clock.isClockRunning = newGameStateAfterTransition.live.clock.isClockRunning ?? false;
  
  if (!newGameStateAfterTransition.live.clock.isClockRunning) {
    newGameStateAfterTransition.live.clock.clockStartTimeMs = null;
    newGameStateAfterTransition.live.clock.remainingTimeAtStartCs = null;
  } else {
    newGameStateAfterTransition.live.clock.clockStartTimeMs = Date.now();
    newGameStateAfterTransition.live.clock.remainingTimeAtStartCs = newGameStateAfterTransition.live.clock.currentTime;
  }
  
  newGameStateAfterTransition.live.clock.isFlashingZero = false;
  newGameStateAfterTransition.live.clock.flashingZeroEndTime = undefined;

  return newGameStateAfterTransition;
};


const statusOrderValues: Record<NonNullable<Penalty['_status']>, number> = {
  running: 1,
  pending_concurrent: 2,
  pending_puck: 3,
};

const sortPenaltiesByStatus = (penalties: Penalty[]): Penalty[] => {
  const penaltiesToSort = [...penalties];
  return penaltiesToSort.sort((a, b) => {
    if (!a.reducesPlayerCount && b.reducesPlayerCount) return 1;
    if (a.reducesPlayerCount && !b.reducesPlayerCount) return -1;
    
    const aStatusVal = a._status ? (statusOrderValues[a._status] ?? 5) : 0;
    const bStatusVal = b._status ? (statusOrderValues[b._status] ?? 5) : 0;
    if (aStatusVal !== bStatusVal) return aStatusVal - bStatusVal;
    return 0;
  });
};

const applyFormatAndTimingsProfileToState = (state: GameState, profileId: string | null): GameState => {
  const profiles = state.config.formatAndTimingsProfiles || [];
  const profileToApply = profiles.find(p => p.id === profileId) || profiles[0] || createDefaultFormatAndTimingsProfile();
  if (!profileToApply) return state;

  return {
    ...state,
    config: {
        ...state.config,
        selectedFormatAndTimingsProfileId: profileToApply.id,
        // Apply all settings from the profile to the main config object
        ...profileToApply
    }
  };
};

const applyScoreboardLayoutProfileToState = (state: GameState, profileId: string | null): GameState => {
  const profiles = state.config.scoreboardLayoutProfiles || [];
  const profileToApply = profiles.find(p => p.id === profileId) || profiles[0] || createDefaultScoreboardLayoutProfile();
  if (!profileToApply) return state;

  const { id, name, ...layoutSettings } = profileToApply;

  return {
    ...state,
    config: {
        ...state.config,
        selectedScoreboardLayoutProfileId: id,
        scoreboardLayout: layoutSettings,
    }
  };
};

// New helper function to centralize stat calculation
const recalculateAllStatsFromLogs = (gameSummary: GameSummary): { homePlayerStats: SummaryPlayerStats[], awayPlayerStats: SummaryPlayerStats[], homeTotalShots: number, awayTotalShots: number } => {
    const homePlayerStatsMap = new Map<string, SummaryPlayerStats>();
    const awayPlayerStatsMap = new Map<string, SummaryPlayerStats>();

    // Initialize with all attended players to ensure they are on the list
    gameSummary.attendance.home.forEach(p => {
        homePlayerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 });
    });
    gameSummary.attendance.away.forEach(p => {
        awayPlayerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 });
    });

    // Process goals and assists
    [...gameSummary.home.goals, ...gameSummary.away.goals].forEach(goal => {
        const statsMap = goal.team === 'home' ? homePlayerStatsMap : awayPlayerStatsMap;
        const scorerId = gameSummary.attendance[goal.team].find(p => p.number === goal.scorer?.playerNumber)?.id;
        if (scorerId && statsMap.has(scorerId)) {
            statsMap.get(scorerId)!.goals++;
        }
        const assistId = gameSummary.attendance[goal.team].find(p => p.number === goal.assist?.playerNumber)?.id;
        if (assistId && statsMap.has(assistId)) {
            statsMap.get(assistId)!.assists++;
        }
    });
    
    // Process shots
    const homeShotsLog = gameSummary.home.homeShotsLog || [];
    const awayShotsLog = gameSummary.away.awayShotsLog || [];

    [...homeShotsLog, ...awayShotsLog].forEach(shot => {
        const statsMap = shot.team === 'home' ? homePlayerStatsMap : awayPlayerStatsMap;
        if (shot.playerId && statsMap.has(shot.playerId)) {
            statsMap.get(shot.playerId)!.shots++;
        }
    });

    const homeTotalShots = homeShotsLog.length;
    const awayTotalShots = awayShotsLog.length;
    
    return { 
        homePlayerStats: Array.from(homePlayerStatsMap.values()),
        awayPlayerStats: Array.from(awayPlayerStatsMap.values()),
        homeTotalShots,
        awayTotalShots 
    };
};



const gameReducer = (state: GameState, action: GameAction): GameState => {
  let newState: GameState = { ...state };
  let newTimestamp = Date.now();

  // Clear pending power play goal confirmation on almost any penalty change
  if (action.type !== 'ADD_GOAL' && action.type !== 'CLEAR_PENDING_POWER_PLAY_GOAL' && action.type !== 'TICK' && state.live.pendingPowerPlayGoal) {
      if ('payload' in action && typeof action.payload === 'object' && action.payload && 'team' in action.payload && action.payload.team === state.live.pendingPowerPlayGoal.team) {
          newState.live.pendingPowerPlayGoal = null;
      }
  }

  switch (action.type) {
    case 'HYDRATE_FROM_STORAGE': {
        let finalState: GameState;
        try {
            const rawGameState = localStorage.getItem(GAME_STATE_STORAGE_KEY);
            const rawTeams = localStorage.getItem(TEAMS_STORAGE_KEY);
            
            if (rawGameState) {
                const loadedGameState: GameState = JSON.parse(rawGameState);
                // Basic validation to ensure the loaded state is not completely broken
                if (loadedGameState.config && loadedGameState.live) {
                    finalState = loadedGameState;
                } else {
                    finalState = getInitialState();
                }
            } else {
                finalState = getInitialState();
            }

            if (rawTeams) {
                finalState.config.teams = JSON.parse(rawTeams);
            }

        } catch (error) {
            console.error("Error reading or parsing state from localStorage:", error);
            finalState = getInitialState();
        }

        finalState._initialConfigLoadComplete = true;

        // Ensure the correct profiles are applied upon hydration
        newState = applyFormatAndTimingsProfileToState(finalState, finalState.config.selectedFormatAndTimingsProfileId);
        newState = applyScoreboardLayoutProfileToState(newState, newState.config.selectedScoreboardLayoutProfileId);
        break;
    }
    case 'SET_STATE_FROM_LOCAL_BROADCAST': {
        const incomingTimestamp = action.payload._lastUpdatedTimestamp;
        const currentTimestamp = state._lastUpdatedTimestamp;

        if (incomingTimestamp && currentTimestamp && incomingTimestamp <= currentTimestamp) {
            return state;
        }
        
        const broadcastedState = {...action.payload};

        newState = { ...broadcastedState, _lastActionOriginator: undefined };
        break;
    }
    case 'TOGGLE_CLOCK': {
      if (state.live.clock.periodDisplayOverride === "End of Game" || state.live.clock.isFlashingZero) break;
      const { isClockRunning, clockStartTimeMs, remainingTimeAtStartCs, currentTime, periodDisplayOverride, absoluteElapsedTimeCs } = state.live.clock;
      
      let newClockState: Partial<ClockState> = {};
      let newAbsoluteElapsedTimeCs = absoluteElapsedTimeCs;

      if (isClockRunning) {
        let preciseCurrentTimeCs = currentTime;
        if (clockStartTimeMs && remainingTimeAtStartCs !== null) {
          const elapsedCs = Math.floor((Date.now() - clockStartTimeMs) / 10);
          preciseCurrentTimeCs = Math.max(0, remainingTimeAtStartCs - elapsedCs);
          if (periodDisplayOverride === null) newAbsoluteElapsedTimeCs += elapsedCs;
        }
        newClockState = {
            currentTime: preciseCurrentTimeCs,
            isClockRunning: false,
            clockStartTimeMs: null,
            remainingTimeAtStartCs: null,
            absoluteElapsedTimeCs: newAbsoluteElapsedTimeCs,
            _liveAbsoluteElapsedTimeCs: newAbsoluteElapsedTimeCs,
        };
      } else {
        if (currentTime > 0) {
            newClockState = {
                isClockRunning: true,
                clockStartTimeMs: Date.now(),
                remainingTimeAtStartCs: currentTime,
            };
        }
      }
      newState = { ...state, live: { ...state.live, clock: { ...state.live.clock, ...newClockState } } };
      break;
    }
    case 'SET_TIME': {
        if (state.live.clock.periodDisplayOverride === "End of Game" || state.live.clock.periodDisplayOverride === "Shootout") break;
        const newTimeCs = Math.max(0, (action.payload.minutes * 60 + action.payload.seconds) * CENTISECONDS_PER_SECOND);
        const newIsClockRunning = newTimeCs > 0 ? state.live.clock.isClockRunning : false;
        let newAbsoluteTime = state.live.clock.absoluteElapsedTimeCs;
        if (state.live.clock.periodDisplayOverride === null) {
            newAbsoluteTime = calculateAbsoluteTimeForPeriod(state.live.clock.currentPeriod, newTimeCs, state);
        }
        newState = { ...state, live: { ...state.live, clock: {
            ...state.live.clock,
            currentTime: newTimeCs,
            isClockRunning: newIsClockRunning,
            clockStartTimeMs: newIsClockRunning ? Date.now() : null,
            remainingTimeAtStartCs: newIsClockRunning ? newTimeCs : null,
            absoluteElapsedTimeCs: newAbsoluteTime,
            _liveAbsoluteElapsedTimeCs: newAbsoluteTime,
        }}};
        break;
    }
    case 'ADJUST_TIME': {
        if (state.live.clock.periodDisplayOverride === "End of Game" || state.live.clock.periodDisplayOverride === "Shootout") break;
        const { isClockRunning, clockStartTimeMs, remainingTimeAtStartCs, currentTime, periodDisplayOverride } = state.live.clock;
        let currentTimeSnapshotCs = currentTime;
        if (isClockRunning && clockStartTimeMs && remainingTimeAtStartCs !== null) {
            currentTimeSnapshotCs = Math.max(0, remainingTimeAtStartCs - Math.floor((Date.now() - clockStartTimeMs) / 10));
        }
        const newAdjustedTimeCs = Math.max(0, currentTimeSnapshotCs + action.payload);
        const newIsClockRunning = newAdjustedTimeCs > 0 ? isClockRunning : false;
        let newAbsoluteTime = state.live.clock.absoluteElapsedTimeCs;
        if (periodDisplayOverride === null) {
            newAbsoluteTime = calculateAbsoluteTimeForPeriod(state.live.clock.currentPeriod, newAdjustedTimeCs, state);
        }
        newState = { ...state, live: { ...state.live, clock: {
            ...state.live.clock,
            currentTime: newAdjustedTimeCs,
            isClockRunning: newIsClockRunning,
            clockStartTimeMs: newIsClockRunning ? Date.now() : null,
            remainingTimeAtStartCs: newIsClockRunning ? newAdjustedTimeCs : null,
            absoluteElapsedTimeCs: newAbsoluteTime,
            _liveAbsoluteElapsedTimeCs: newAbsoluteTime,
        }}};
        break;
    }
    case 'SET_PERIOD': {
        const newPeriod = Math.max(0, action.payload);
        const { defaultWarmUpDuration, autoStartWarmUp, numberOfRegularPeriods, defaultPeriodDuration, defaultOTPeriodDuration } = state.config;
        const periodDurationCs = (newPeriod === 0) ? defaultWarmUpDuration : (newPeriod > numberOfRegularPeriods ? defaultOTPeriodDuration : defaultPeriodDuration);
        const autoStartClock = (newPeriod === 0) ? (autoStartWarmUp && periodDurationCs > 0) : false;
        const newAbsoluteTime = calculateAbsoluteTimeForPeriod(newPeriod, periodDurationCs, state);

        newState = { ...state, live: { ...state.live, clock: {
            ...state.live.clock,
            currentPeriod: newPeriod,
            periodDisplayOverride: newPeriod === 0 ? 'Warm-up' : null,
            currentTime: periodDurationCs,
            isClockRunning: autoStartClock,
            preTimeoutState: null,
            clockStartTimeMs: autoStartClock ? Date.now() : null,
            remainingTimeAtStartCs: autoStartClock ? periodDurationCs : null,
            absoluteElapsedTimeCs: newAbsoluteTime,
            _liveAbsoluteElapsedTimeCs: newAbsoluteTime,
        }}};
        break;
    }
    case 'ADD_GOAL': {
      const { clock, config, live } = state;
      let periodTextForLog: string;
      
      if (action.payload.periodText) {
          periodTextForLog = action.payload.periodText;
      } else {
          periodTextForLog = getActualPeriodText(clock.currentPeriod, clock.periodDisplayOverride, config.numberOfRegularPeriods || 2, live.shootout);
          if (clock.periodDisplayOverride === 'Break' || clock.periodDisplayOverride === 'Pre-OT Break') {
            periodTextForLog = getPeriodText(clock.currentPeriod, config.numberOfRegularPeriods || 2);
          }
      }

      const newGoal: GoalLog = { ...action.payload, id: safeUUID(), periodText: periodTextForLog };
      
      const newGameSummary = JSON.parse(JSON.stringify(state.live.gameSummary));
      newGameSummary[action.payload.team].goals.push(newGoal);

      const teamScored = action.payload.team;
      const teamConceded = teamScored === 'home' ? 'away' : 'home';
      
      const { homePlayerStats, awayPlayerStats, homeTotalShots, awayTotalShots } = recalculateAllStatsFromLogs(newGameSummary);

      const homeGoals = newGameSummary.home.goals;
      const awayGoals = newGameSummary.away.goals;

      const score = {
          home: homeGoals.length,
          away: awayGoals.length,
          homeGoals,
          awayGoals,
          homeShots: homeTotalShots,
          awayShots: awayTotalShots,
      };

      let pendingPPGoal: LiveState['pendingPowerPlayGoal'] = null;
      // Check for power play goal condition
      const scoringTeamOnIce = config.playersPerTeamOnIce - state.live.penalties[teamScored].filter(p => p._status === 'running' && p.reducesPlayerCount).length;
      const concedingTeamOnIce = config.playersPerTeamOnIce - state.live.penalties[teamConceded].filter(p => p._status === 'running' && p.reducesPlayerCount).length;

      if (scoringTeamOnIce > concedingTeamOnIce) {
          const firstEligiblePenalty = state.live.penalties[teamConceded].find(p => p._status === 'running' && p.clearsOnGoal);
          if (firstEligiblePenalty) {
              pendingPPGoal = { team: teamConceded, penaltyId: firstEligiblePenalty.id };
          }
      }
      
      newState = { ...state, live: { ...state.live, 
        score,
        pendingPowerPlayGoal: pendingPPGoal,
        gameSummary: {
          ...newGameSummary,
          home: { ...newGameSummary.home, playerStats: homePlayerStats },
          away: { ...newGameSummary.away, playerStats: awayPlayerStats },
        },
      }};
      break;
    }
     case 'EDIT_GOAL': {
      const { goalId, updates } = action.payload;
      const newGameSummary = JSON.parse(JSON.stringify(state.live.gameSummary));
      let goalFound = false;

      newGameSummary.home.goals = newGameSummary.home.goals.map((g: GoalLog) => {
        if (g.id === goalId) {
            goalFound = true;
            return { ...g, ...updates };
        }
        return g;
      });
      if (!goalFound) {
        newGameSummary.away.goals = newGameSummary.away.goals.map((g: GoalLog) => {
          if (g.id === goalId) {
              goalFound = true;
              return { ...g, ...updates };
          }
          return g;
        });
      }

      if (goalFound) {
        const { homePlayerStats, awayPlayerStats } = recalculateAllStatsFromLogs(newGameSummary);
        const homeGoals = newGameSummary.home.goals;
        const awayGoals = newGameSummary.away.goals;
        const newScore = { ...state.live.score, home: homeGoals.length, away: awayGoals.length, homeGoals, awayGoals };

        newState = { ...state, live: { ...state.live, 
          score: newScore,
          gameSummary: {
            ...newGameSummary,
            home: { ...newGameSummary.home, playerStats: homePlayerStats },
            away: { ...newGameSummary.away, playerStats: awayPlayerStats },
          }
        }};
      }
      break;
    }
    case 'DELETE_GOAL': {
      const { goalId } = action.payload;
      const newGameSummary = JSON.parse(JSON.stringify(state.live.gameSummary));
      const initialHomeGoalsCount = newGameSummary.home.goals.length;
      
      newGameSummary.home.goals = newGameSummary.home.goals.filter((g: GoalLog) => g.id !== goalId);
      if (newGameSummary.home.goals.length === initialHomeGoalsCount) {
        newGameSummary.away.goals = newGameSummary.away.goals.filter((g: GoalLog) => g.id !== goalId);
      }

      const { homePlayerStats, awayPlayerStats } = recalculateAllStatsFromLogs(newGameSummary);
      const homeGoals = newGameSummary.home.goals;
      const awayGoals = newGameSummary.away.goals;
      const newScore = { ...state.live.score, home: homeGoals.length, away: awayGoals.length, homeGoals, awayGoals };

      newState = { ...state, live: { ...state.live,
        score: newScore,
        gameSummary: {
          ...newGameSummary,
          home: { ...newGameSummary.home, playerStats: homePlayerStats },
          away: { ...newGameSummary.away, playerStats: awayPlayerStats },
        }
      }};
      break;
    }
    case 'ADD_PLAYER_SHOT': {
      const { team, playerNumber } = action.payload;
      const attendedPlayer = state.live.gameSummary.attendance[team].find(p => p.number === playerNumber);
      
      const newShotLog: ShotLog = {
        id: safeUUID(),
        team,
        timestamp: Date.now(),
        gameTime: state.live.clock.currentTime,
        periodText: getActualPeriodText(state.live.clock.currentPeriod, state.live.clock.periodDisplayOverride, state.config.numberOfRegularPeriods, state.live.shootout),
        playerId: attendedPlayer?.id || `unknown-${playerNumber}`,
        playerNumber,
        playerName: attendedPlayer?.name,
      };

      const newGameSummary = JSON.parse(JSON.stringify(state.live.gameSummary));
      const shotsLogKey = `${team}ShotsLog` as const;
      if (!newGameSummary[team][shotsLogKey]) {
        newGameSummary[team][shotsLogKey] = [];
      }
      newGameSummary[team][shotsLogKey].push(newShotLog);
      
      const { homePlayerStats, awayPlayerStats, homeTotalShots, awayTotalShots } = recalculateAllStatsFromLogs(newGameSummary);
      
      const newScore = { ...state.live.score, homeShots: homeTotalShots, awayShots: awayTotalShots };

      newState = { ...state, live: { ...state.live,
        score: newScore,
        gameSummary: {
          ...newGameSummary,
          home: { ...newGameSummary.home, playerStats: homePlayerStats },
          away: { ...newGameSummary.away, playerStats: awayPlayerStats },
        }
      }};
      break;
    }
    case 'SET_PLAYER_SHOTS': {
        const { team, playerId, periodText, shotCount } = action.payload;
        const { live } = state;
        const { gameSummary } = live;

        const attendedPlayer = gameSummary.attendance[team].find(p => p.id === playerId);
        if (!attendedPlayer) break;

        const shotsLogKey = `${team}ShotsLog` as const;
        // Keep shots from other players OR from the same player in different periods.
        const otherShots = (gameSummary[team]?.[shotsLogKey] || []).filter((shot: ShotLog) => shot.playerId !== playerId || shot.periodText !== periodText);
        
        const newShotsForPeriod: ShotLog[] = Array.from({ length: shotCount }, (_, i) => ({
            id: safeUUID(),
            team,
            timestamp: Date.now() + i, // Offset timestamp to ensure unique values if needed
            gameTime: 0, // Game time is not relevant for post-game edits
            periodText,
            playerId: attendedPlayer.id,
            playerNumber: attendedPlayer.number,
            playerName: attendedPlayer.name
        }));

        const newGameSummary = JSON.parse(JSON.stringify(gameSummary));
        newGameSummary[team][shotsLogKey] = [...otherShots, ...newShotsForPeriod];
        
        const { homePlayerStats, awayPlayerStats, homeTotalShots, awayTotalShots } = recalculateAllStatsFromLogs(newGameSummary);

        newState = {
            ...state,
            live: {
                ...live,
                score: {
                    ...live.score,
                    homeShots: homeTotalShots,
                    awayShots: awayTotalShots
                },
                gameSummary: {
                    ...newGameSummary,
                    home: { ...newGameSummary.home, playerStats: homePlayerStats },
                    away: { ...newGameSummary.away, playerStats: awayPlayerStats },
                }
            }
        };
        break;
    }
    case 'FINISH_GAME_WITH_OT_GOAL': {
      const newGoal: GoalLog = { ...action.payload, id: safeUUID() };
      const team = action.payload.team;
      const gameSummary = JSON.parse(JSON.stringify(state.live.gameSummary));
      gameSummary[team].goals.push(newGoal);

      const { homePlayerStats, awayPlayerStats, homeTotalShots, awayTotalShots } = recalculateAllStatsFromLogs(gameSummary);
      
      const newScore = {
          home: gameSummary.home.goals.length,
          away: gameSummary.away.goals.length,
          homeGoals: gameSummary.home.goals,
          awayGoals: gameSummary.away.goals,
          homeShots: homeTotalShots,
          awayShots: awayTotalShots,
      };
      
      const newAbsoluteTime = calculateAbsoluteTimeForPeriod(state.live.clock.currentPeriod, 0, state);
      
      newState = { ...state, live: { ...state.live, 
        score: newScore,
        clock: {
          ...state.live.clock,
          currentTime: 0,
          isClockRunning: false,
          periodDisplayOverride: 'End of Game',
          absoluteElapsedTimeCs: newAbsoluteTime,
          _liveAbsoluteElapsedTimeCs: newAbsoluteTime,
          clockStartTimeMs: null,
          remainingTimeAtStartCs: null,
          preTimeoutState: null,
        },
        gameSummary: {
          ...gameSummary,
          home: { ...newGameSummary.home, playerStats: homePlayerStats },
          away: { ...newGameSummary.away, playerStats: awayPlayerStats },
        },
        playHornTrigger: state.live.playHornTrigger + 1,
      }};
      break;
    }
    case 'ADD_PENALTY': {
      const { team, penalty, addGameTime, addPeriodText } = action.payload;
      const { penaltyTypeId, playerNumber } = penalty;
      const { config, live } = state;
      const penaltyDef = config.penaltyTypes.find(p => p.id === penaltyTypeId);

      if (!penaltyDef) {
        console.error(`Penalty definition with id ${penaltyTypeId} not found.`);
        break;
      }
      
      const newPenaltyId = safeUUID();
      const teamDetails = config.teams.find(t => t.name === live[`${team}TeamName`] && (t.subName || undefined) === (live[`${team}TeamSubName`] || undefined) && t.category === config.selectedMatchCategory);
      const playerDetails = teamDetails?.players.find(p => p.number === playerNumber);
      
      const newPenaltyLog: PenaltyLog = {
        id: newPenaltyId, team, playerNumber: playerNumber.toUpperCase(), playerName: playerDetails?.name,
        penaltyName: penaltyDef.name,
        initialDuration: penaltyDef.duration,
        reducesPlayerCount: penaltyDef.reducesPlayerCount,
        clearsOnGoal: penaltyDef.clearsOnGoal,
        isBenchPenalty: penaltyDef.isBenchPenalty,
        addTimestamp: Date.now(),
        addGameTime: addGameTime ?? live.clock.currentTime,
        addPeriodText: addPeriodText ?? getActualPeriodText(live.clock.currentPeriod, live.clock.periodDisplayOverride, config.numberOfRegularPeriods || 2, live.shootout),
      };

      const newGameSummary = JSON.parse(JSON.stringify(live.gameSummary));
      newGameSummary[team].penalties.push(newPenaltyLog);
      
      // If adding from summary, only update the log.
      if (addGameTime !== undefined && addPeriodText !== undefined) {
        newState = { ...state, live: { ...state.live, gameSummary: newGameSummary }};
      } else {
        // If adding from live controls, create active penalty.
        const { _liveAbsoluteElapsedTimeCs } = live.clock;
        const limitReachedReasons: ('quantity')[] = [];
        const playerPenalties = live.gameSummary[team].penalties.filter(
          p => p.playerNumber === playerNumber && p.endReason !== 'deleted' && !p.isBenchPenalty
        );
        
        if (config.enableMaxPenaltiesLimit && !penaltyDef.isBenchPenalty) {
          if (playerPenalties.length + 1 >= config.maxPenaltiesPerPlayer) {
            limitReachedReasons.push('quantity');
          }
        }
        
        let newStatus: Penalty['_status'];
        let startTime, expirationTime;
        
        if (penaltyDef.reducesPlayerCount) {
          newStatus = 'pending_puck';
          startTime = undefined;
          expirationTime = undefined;
        } else {
          newStatus = 'running';
          startTime = _liveAbsoluteElapsedTimeCs;
          expirationTime = _liveAbsoluteElapsedTimeCs + penaltyDef.duration * CENTISECONDS_PER_SECOND;
        }
        
        const newPenalty: Penalty = { 
          id: newPenaltyId, playerNumber: playerNumber.toUpperCase(), initialDuration: penaltyDef.duration,
          reducesPlayerCount: penaltyDef.reducesPlayerCount, clearsOnGoal: penaltyDef.clearsOnGoal,
          isBenchPenalty: penaltyDef.isBenchPenalty, _status: newStatus, startTime, expirationTime,
          _limitReached: limitReachedReasons.length > 0 ? limitReachedReasons : undefined,
        };

        newState = { ...state, live: { ...live,
          penalties: { ...live.penalties, [team]: sortPenaltiesByStatus([...live.penalties[team], newPenalty]) },
          gameSummary: newGameSummary
        }};
      }
      break;
    }
    case 'REMOVE_PENALTY': {
      const { team, penaltyId } = action.payload;
      const penaltyToRemove = state.live.penalties[team].find(p => p.id === penaltyId);
      if (!penaltyToRemove) break;

      const remainingTimeCs = penaltyToRemove.expirationTime !== undefined ? Math.max(0, penaltyToRemove.expirationTime - state.live.clock._liveAbsoluteElapsedTimeCs) : penaltyToRemove.initialDuration * 100;
      const timeServed = penaltyToRemove.initialDuration - Math.round(remainingTimeCs / 100);

      newState = { ...state, live: { ...state.live,
        penalties: { ...state.live.penalties, [team]: sortPenaltiesByStatus(state.live.penalties[team].filter(p => p.id !== penaltyId))},
        gameSummary: { ...state.live.gameSummary, [team]: { ...state.live.gameSummary[team], penalties: state.live.gameSummary[team].penalties.map(p =>
          p.id === penaltyId && !p.endReason ? { ...p, endTimestamp: Date.now(), endGameTime: state.live.clock.currentTime, endPeriodText: getActualPeriodText(state.live.clock.currentPeriod, state.live.clock.periodDisplayOverride, state.config.numberOfRegularPeriods, state.live.shootout), endReason: 'deleted', timeServed } : p
        )}}
      }};
      break;
    }
    case 'DELETE_PENALTY_LOG': {
      const { team, logId } = action.payload;
      
      const newActivePenalties = state.live.penalties[team].filter(p => p.id !== logId);

      const newGameSummary = JSON.parse(JSON.stringify(state.live.gameSummary));
      newGameSummary[team].penalties = newGameSummary[team].penalties.filter((p: PenaltyLog) => p.id !== logId);
      
      newState = { ...state, live: { ...state.live, 
        penalties: { ...state.live.penalties, [team]: newActivePenalties },
        gameSummary: newGameSummary
      }};
      break;
    }
     case 'END_PENALTY_FOR_GOAL': {
      const { team, penaltyId } = action.payload;
      const penaltyToEnd = state.live.penalties[team].find(p => p.id === penaltyId);
      if (!penaltyToEnd || !penaltyToEnd.clearsOnGoal) break;

      const remainingTimeCs = penaltyToEnd.expirationTime !== undefined ? Math.max(0, penaltyToEnd.expirationTime - state.live.clock._liveAbsoluteElapsedTimeCs) : penaltyToEnd.initialDuration * 100;
      const timeServed = penaltyToEnd.initialDuration - Math.round(remainingTimeCs / 100);
      
      newState = { ...state, live: { ...state.live,
        penalties: { ...state.live.penalties, [team]: sortPenaltiesByStatus(state.live.penalties[team].filter(p => p.id !== penaltyId))},
        pendingPowerPlayGoal: null, // Clear the pending goal confirmation
        gameSummary: { ...state.live.gameSummary, [team]: { ...state.live.gameSummary[team], penalties: state.live.gameSummary[team].penalties.map(p =>
          p.id === penaltyId && !p.endReason ? { ...p, endTimestamp: Date.now(), endGameTime: state.live.clock.currentTime, endPeriodText: getActualPeriodText(state.live.clock.currentPeriod, state.live.clock.periodDisplayOverride, state.config.numberOfRegularPeriods, state.live.shootout), endReason: 'goal_on_pp', timeServed } : p
        )}}
      }};
      break;
    }
    case 'CLEAR_PENDING_POWER_PLAY_GOAL': {
      newState = { ...state, live: { ...state.live, pendingPowerPlayGoal: null } };
      break;
    }
    case 'ADJUST_PENALTY_TIME': {
      const { team, penaltyId, delta } = action.payload;
       newState = { ...state, live: { ...state.live, penalties: { ...state.live.penalties, [team]: state.live.penalties[team].map(p =>
        p.id === penaltyId && p.expirationTime !== undefined ? { ...p, expirationTime: p.expirationTime + (delta * CENTISECONDS_PER_SECOND) } : p
      )}}};
      break;
    }
     case 'SET_PENALTY_TIME': {
      const { team, penaltyId, time } = action.payload;
      const newRemainingTimeCs = time * CENTISECONDS_PER_SECOND;
      const updatedPenalties = state.live.penalties[team].map(p =>
        p.id === penaltyId ? { ...p, expirationTime: state.live.clock._liveAbsoluteElapsedTimeCs + newRemainingTimeCs } : p
      );
      newState = { ...state, live: { ...state.live, penalties: { ...state.live.penalties, [team]: sortPenaltiesByStatus(updatedPenalties) }}};
      break;
    }
    case 'REORDER_PENALTIES': {
      const { team, startIndex, endIndex } = action.payload;
      const currentPenalties = [...state.live.penalties[team]];
      const [removed] = currentPenalties.splice(startIndex, 1);
      if (removed) currentPenalties.splice(endIndex, 0, removed);
      newState = { ...state, live: { ...state.live, penalties: { ...state.live.penalties, [team]: sortPenaltiesByStatus(currentPenalties) }}};
      break;
    }
    case 'ACTIVATE_PENDING_PUCK_PENALTIES': {
      const activate = (penalties: Penalty[]) => penalties.map(p => {
        if (p._status === 'pending_puck') {
          let updatedPenalty = { ...p, _status: 'pending_concurrent' };
          // For penalties that don't reduce player count, start them running immediately.
          if (!p.reducesPlayerCount) {
            updatedPenalty._status = 'running';
            updatedPenalty.startTime = state.live.clock._liveAbsoluteElapsedTimeCs;
            updatedPenalty.expirationTime = state.live.clock._liveAbsoluteElapsedTimeCs + (p.initialDuration * CENTISECONDS_PER_SECOND);
          }
          return updatedPenalty;
        }
        return p;
      });
      newState = { ...state, live: { ...state.live, penalties: { home: activate(state.live.penalties.home), away: activate(state.live.penalties.away) }}};
      break;
    }
    case 'TICK': {
      let hasChanged = false;
      let significantChangeOccurred = false;
      const { clock, penalties, gameSummary } = state.live;
      const { config } = state;
      const now = Date.now();
      
      let currentTimeSnapshot = clock.currentTime;
      let liveAbsoluteElapsedTimeCs = clock.absoluteElapsedTimeCs;
      let playHornTrigger = state.live.playHornTrigger;
      let playPenaltyBeepTrigger = state.live.playPenaltyBeepTrigger;

      if (clock.isFlashingZero) {
        if (now >= (clock.flashingZeroEndTime || 0)) {
          significantChangeOccurred = true;
          newState = handleAutoTransition(state);
        } else {
          return state; // No other processing during flashing
        }
        break;
      }
      
      if (clock.isClockRunning && clock.clockStartTimeMs && clock.remainingTimeAtStartCs !== null) {
        const elapsedCs = Math.floor((Date.now() - clock.clockStartTimeMs) / 10);
        currentTimeSnapshot = Math.max(0, clock.remainingTimeAtStartCs - elapsedCs);
        if (clock.periodDisplayOverride === null) liveAbsoluteElapsedTimeCs = clock.absoluteElapsedTimeCs + elapsedCs;
        if (currentTimeSnapshot !== clock.currentTime) hasChanged = true;
      } else if (clock.isClockRunning && clock.currentTime <= 0) {
        currentTimeSnapshot = 0;
      }
      
      const newGameSummary: GameSummary = JSON.parse(JSON.stringify(gameSummary));
      
      const processPenalties = (team: Team): Penalty[] => {
          const teamPenalties = penalties[team];
          const runningPenalties = teamPenalties.filter(p => p._status === 'running');
          
          const expiredPenalties = runningPenalties.filter(p => p.expirationTime !== undefined && liveAbsoluteElapsedTimeCs >= p.expirationTime);
          if (expiredPenalties.length > 0) significantChangeOccurred = true;
          
          expiredPenalties.forEach(p => {
              const logIndex = newGameSummary[team].penalties.findIndex(log => log.id === p.id && !log.endReason);
              if (logIndex > -1) {
                  const absoluteEndTime = p.expirationTime ?? liveAbsoluteElapsedTimeCs;
                  const endTimeContext = getPeriodContextFromAbsoluteTime(absoluteEndTime, state);
                  newGameSummary[team].penalties[logIndex] = {
                      ...newGameSummary[team].penalties[logIndex],
                      endTimestamp: Date.now(), endGameTime: endTimeContext.timeInPeriodCs,
                      endPeriodText: endTimeContext.periodText, endReason: 'completed', timeServed: p.initialDuration,
                  };
              }
          });

          let stillRunning = runningPenalties.filter(p => !expiredPenalties.find(exp => exp.id === p.id));
          let availableSlots = config.maxConcurrentPenalties - stillRunning.filter(p => p.reducesPlayerCount).length;
          const playersServing = new Set(stillRunning.filter(p => p.reducesPlayerCount).map(p => p.playerNumber));
          
          let pendingConcurrent = teamPenalties.filter(p => p._status === 'pending_concurrent');
          for (const p of pendingConcurrent) {
              if (availableSlots > 0 && !playersServing.has(p.playerNumber)) {
                  significantChangeOccurred = true;
                  stillRunning.push({ ...p, _status: 'running', startTime: liveAbsoluteElapsedTimeCs, expirationTime: liveAbsoluteElapsedTimeCs + (p.initialDuration * CENTISECONDS_PER_SECOND) });
                  playersServing.add(p.playerNumber);
                  if (p.reducesPlayerCount) availableSlots--;
              }
          }
          
          const newlyActivatedIds = new Set(stillRunning.map(p => p.id));
          const remainingPending = pendingConcurrent.filter(p => !newlyActivatedIds.has(p.id));
          const pendingPuck = teamPenalties.filter(p => p._status === 'pending_puck');
          return [...stillRunning, ...remainingPending, ...pendingPuck];
      };

      const homePenaltiesResult = processPenalties('home');
      const awayPenaltiesResult = processPenalties('away');
      
      const checkBeep = (team: Team) => {
          if (config.enablePenaltyCountdownSound && clock.isClockRunning && clock.periodDisplayOverride === null) {
              penalties[team].forEach(p => {
                  if (p._status === 'running' && p.expirationTime !== undefined) {
                      const prevRem = p.expirationTime - clock._liveAbsoluteElapsedTimeCs;
                      const currRem = p.expirationTime - liveAbsoluteElapsedTimeCs;
                      if (currRem / 100 <= config.penaltyCountdownStartTime && currRem > 0 && Math.floor(prevRem / 100) > Math.floor(currRem / 100)) {
                          playPenaltyBeepTrigger++;
                          hasChanged = true;
                      }
                  }
              });
          }
      };
      checkBeep('home');
      checkBeep('away');

      if (!isEqual(homePenaltiesResult, penalties.home)) { hasChanged = true; significantChangeOccurred = true; }
      if (!isEqual(awayPenaltiesResult, penalties.away)) { hasChanged = true; significantChangeOccurred = true; }

      const stateWithLiveTime = { ...state, live: { ...state.live, clock: { ...state.live.clock, _liveAbsoluteElapsedTimeCs: liveAbsoluteElapsedTimeCs }}};

      if (clock.isClockRunning && currentTimeSnapshot <= 0) {
        significantChangeOccurred = true;
        
        const shouldTriggerHorn = clock.periodDisplayOverride !== "Time Out";
        
        newState = {
            ...state,
            live: {
                ...state.live,
                clock: {
                    ...clock,
                    currentTime: 0,
                    isClockRunning: false,
                    isFlashingZero: true,
                    flashingZeroEndTime: now + FLASHING_ZERO_DURATION_MS,
                    clockStartTimeMs: null,
                    remainingTimeAtStartCs: null,
                },
                playHornTrigger: shouldTriggerHorn ? playHornTrigger + 1 : playHornTrigger,
            }
        };
      } else if (hasChanged) {
        newState = { ...state, live: { ...state.live,
            clock: { ...clock, currentTime: currentTimeSnapshot, _liveAbsoluteElapsedTimeCs: liveAbsoluteElapsedTimeCs },
            penalties: { home: sortPenaltiesByStatus(homePenaltiesResult), away: sortPenaltiesByStatus(awayPenaltiesResult) },
            gameSummary: newGameSummary,
            playPenaltyBeepTrigger: playPenaltyBeepTrigger
        }};
      } else {
        return { ...state, live: { ...state.live, clock: { ...state.live.clock, _liveAbsoluteElapsedTimeCs: liveAbsoluteElapsedTimeCs }}};
      }
      
      newState._lastActionOriginator = significantChangeOccurred ? TAB_ID : undefined;
      newState._lastUpdatedTimestamp = significantChangeOccurred ? newTimestamp : state._lastUpdatedTimestamp;
      return newState;
    }
    case 'SET_HOME_TEAM_NAME': newState = { ...state, live: { ...state.live, homeTeamName: action.payload || 'Local' } }; break;
    case 'SET_HOME_TEAM_SUB_NAME': newState = { ...state, live: { ...state.live, homeTeamSubName: action.payload } }; break;
    case 'SET_AWAY_TEAM_NAME': newState = { ...state, live: { ...state.live, awayTeamName: action.payload || 'Visitante' } }; break;
    case 'SET_AWAY_TEAM_SUB_NAME': newState = { ...state, live: { ...state.live, awayTeamSubName: action.payload } }; break;
    case 'START_BREAK': {
        const newAbsoluteTime = calculateAbsoluteTimeForPeriod(state.live.clock.currentPeriod, 0, state);
        const autoStart = state.config.autoStartBreaks && state.config.defaultBreakDuration > 0;
        newState = { ...state, live: { ...state.live, clock: { ...state.live.clock,
            currentTime: state.config.defaultBreakDuration, periodDisplayOverride: 'Break', isClockRunning: autoStart, preTimeoutState: null,
            clockStartTimeMs: autoStart ? Date.now() : null, remainingTimeAtStartCs: autoStart ? state.config.defaultBreakDuration : null,
            absoluteElapsedTimeCs: newAbsoluteTime, _liveAbsoluteElapsedTimeCs: newAbsoluteTime,
        }}};
        break;
    }
    case 'START_PRE_OT_BREAK': {
        const newAbsoluteTime = calculateAbsoluteTimeForPeriod(state.live.clock.currentPeriod, 0, state);
        const autoStart = state.config.autoStartPreOTBreaks && state.config.defaultPreOTBreakDuration > 0;
        newState = { ...state, live: { ...state.live, clock: { ...state.live.clock,
            currentTime: state.config.defaultPreOTBreakDuration, periodDisplayOverride: 'Pre-OT Break', isClockRunning: autoStart, preTimeoutState: null,
            clockStartTimeMs: autoStart ? Date.now() : null, remainingTimeAtStartCs: autoStart ? state.config.defaultPreOTBreakDuration : null,
            absoluteElapsedTimeCs: newAbsoluteTime, _liveAbsoluteElapsedTimeCs: newAbsoluteTime,
        }}};
        break;
    }
    case 'START_BREAK_AFTER_PREVIOUS_PERIOD': {
        const { currentPeriod, periodDisplayOverride } = state.live.clock;
        const periodBeforeBreak = (periodDisplayOverride === 'Break' || periodDisplayOverride === 'Pre-OT Break') ? currentPeriod : currentPeriod - 1;
        if (periodBeforeBreak < 1) break;
        const newAbsoluteTime = calculateAbsoluteTimeForPeriod(periodBeforeBreak, 0, state);
        const isPreOT = periodBeforeBreak >= state.config.numberOfRegularPeriods;
        const breakDurationCs = isPreOT ? state.config.defaultPreOTBreakDuration : state.config.defaultBreakDuration;
        const autoStart = isPreOT ? state.config.autoStartPreOTBreaks : state.config.autoStartBreaks;
        newState = { ...state, live: { ...state.live, clock: { ...state.live.clock,
            currentPeriod: periodBeforeBreak, currentTime: breakDurationCs, periodDisplayOverride: isPreOT ? 'Pre-OT Break' : 'Break',
            isClockRunning: autoStart && breakDurationCs > 0, preTimeoutState: null,
            clockStartTimeMs: autoStart && breakDurationCs > 0 ? Date.now() : null, remainingTimeAtStartCs: autoStart && breakDurationCs > 0 ? breakDurationCs : null,
            absoluteElapsedTimeCs: newAbsoluteTime, _liveAbsoluteElapsedTimeCs: newAbsoluteTime,
        }}};
        break;
    }
    case 'START_TIMEOUT': {
        let { currentTime, absoluteElapsedTimeCs, isClockRunning, clockStartTimeMs, remainingTimeAtStartCs, periodDisplayOverride } = state.live.clock;
        if (isClockRunning && clockStartTimeMs && remainingTimeAtStartCs !== null) {
            const elapsedCs = Math.floor((Date.now() - clockStartTimeMs) / 10);
            currentTime = Math.max(0, remainingTimeAtStartCs - elapsedCs);
            if (periodDisplayOverride === null) absoluteElapsedTimeCs += elapsedCs;
        }
        const autoStart = state.config.autoStartTimeouts && state.config.defaultTimeoutDuration > 0;
        newState = { ...state, live: { ...state.live, clock: { ...state.live.clock,
            preTimeoutState: {
                period: state.live.clock.currentPeriod, time: currentTime, isClockRunning: isClockRunning,
                override: periodDisplayOverride, clockStartTimeMs: clockStartTimeMs, remainingTimeAtStartCs: remainingTimeAtStartCs,
                absoluteElapsedTimeCs: absoluteElapsedTimeCs,
            },
            currentTime: state.config.defaultTimeoutDuration, periodDisplayOverride: 'Time Out', isClockRunning: autoStart,
            clockStartTimeMs: autoStart ? Date.now() : null, remainingTimeAtStartCs: autoStart ? state.config.defaultTimeoutDuration : null,
            absoluteElapsedTimeCs: absoluteElapsedTimeCs,
        }}};
        break;
    }
     case 'END_TIMEOUT': {
      if (state.live.clock.preTimeoutState) {
        const { period, time, override, absoluteElapsedTimeCs } = state.live.clock.preTimeoutState;
        newState = { ...state, live: { ...state.live, clock: {
            ...state.live.clock, currentPeriod: period, currentTime: time, isClockRunning: false,
            periodDisplayOverride: override, clockStartTimeMs: null, remainingTimeAtStartCs: null,
            preTimeoutState: null, absoluteElapsedTimeCs: absoluteElapsedTimeCs, _liveAbsoluteElapsedTimeCs: absoluteElapsedTimeCs,
        }}};
      }
      break;
    }
    case 'MANUAL_END_GAME': {
        const newAbsoluteTime = calculateAbsoluteTimeForPeriod(state.live.clock.currentPeriod, 0, state);
        newState = { ...state, live: { ...state.live,
            clock: { ...state.live.clock, currentTime: 0, isClockRunning: false, periodDisplayOverride: 'End of Game',
                absoluteElapsedTimeCs: newAbsoluteTime, _liveAbsoluteElapsedTimeCs: newAbsoluteTime,
                clockStartTimeMs: null, remainingTimeAtStartCs: null, preTimeoutState: null,
            },
            playHornTrigger: state.live.playHornTrigger + 1
        }};
        break;
    }
    case 'ADD_EXTRA_OVERTIME': {
      if (state.live.score.home !== state.live.score.away) break;
      const { config, live } = state;
      const newNumberOfOTs = config.numberOfOvertimePeriods + 1;
      const newTotalPeriods = config.numberOfRegularPeriods + newNumberOfOTs;
      
      const newAbsoluteTime = calculateAbsoluteTimeForPeriod(newTotalPeriods - 1, 0, state);
      const autoStart = config.autoStartPreOTBreaks && config.defaultPreOTBreakDuration > 0;

      newState = {
        ...state,
        config: {
          ...config,
          numberOfOvertimePeriods: newNumberOfOTs,
        },
        live: {
          ...live,
          clock: {
            ...live.clock,
            currentPeriod: newTotalPeriods - 1, // The period before the new OT
            currentTime: config.defaultPreOTBreakDuration,
            periodDisplayOverride: 'Pre-OT Break',
            isClockRunning: autoStart,
            clockStartTimeMs: autoStart ? Date.now() : null,
            remainingTimeAtStartCs: autoStart ? config.defaultPreOTBreakDuration : null,
            absoluteElapsedTimeCs: newAbsoluteTime,
            _liveAbsoluteElapsedTimeCs: newAbsoluteTime,
          }
        }
      };
      break;
    }
    case 'START_SHOOTOUT': {
      newState = { ...state, live: { ...state.live,
        shootout: {
          ...INITIAL_SHOOTOUT_STATE,
          isActive: true,
        },
        clock: {
            ...state.live.clock,
            periodDisplayOverride: 'Shootout'
        }
      }};
      break;
    }
    case 'UPDATE_SHOOTOUT_ROUNDS':
        if (!state.live.shootout) break;
        newState = {
            ...state,
            live: { ...state.live,
                shootout: {
                    ...state.live.shootout,
                    rounds: action.payload,
                }
            }
        };
        break;
    case 'RECORD_SHOOTOUT_ATTEMPT': {
      if (!state.live.shootout) break;
      const { team, ...attemptData } = action.payload;
      const { shootout } = state.live;
      const currentAttempts = shootout[team === 'home' ? 'homeAttempts' : 'awayAttempts'];
      
      const newAttempt: ShootoutAttempt = {
          id: safeUUID(),
          round: currentAttempts.length + 1,
          ...attemptData,
      };

      let newInitiator = shootout.initiator;
      if (!newInitiator) {
          newInitiator = team;
      }

      newState = {
          ...state,
          live: { ...state.live,
              shootout: {
                  ...shootout,
                  initiator: newInitiator,
                  [team === 'home' ? 'homeAttempts' : 'awayAttempts']: [...currentAttempts, newAttempt],
              }
          }
      };
      break;
    }
    case 'UNDO_LAST_SHOOTOUT_ATTEMPT': {
      if (!state.live.shootout) {
        break;
      }
      const { team } = action.payload;
      const { shootout } = state.live;
      const attemptsKey = team === 'home' ? 'homeAttempts' : 'awayAttempts';
      const currentAttempts = shootout[attemptsKey];
      
      const newAttempts = currentAttempts.slice(0, -1);
      
      let newInitiator = shootout.initiator;
      // If we are undoing the very first shot, reset the initiator
      if (shootout.homeAttempts.length + shootout.awayAttempts.length === 1) {
          newInitiator = null;
      }

      newState = { ...state, live: { ...state.live,
          shootout: {
            ...shootout,
            initiator: newInitiator,
            [attemptsKey]: newAttempts,
          }
        }
      };
      break;
    }
    case 'FINISH_SHOOTOUT': {
        if (!state.live.shootout) break;
        const { homeAttempts, awayAttempts } = state.live.shootout;
        const homeGoals = homeAttempts.filter(a => a.isGoal).length;
        const awayGoals = awayAttempts.filter(a => a.isGoal).length;
        
        let newScore = { ...state.live.score };
        
        if (homeGoals > awayGoals) {
            newScore.home += 1;
        } else if (awayGoals > homeGoals) {
            newScore.away += 1;
        }
        
        newState = {
            ...state,
            live: { ...state.live,
                score: newScore,
                shootout: { ...state.live.shootout, isActive: false },
                clock: {
                    ...state.live.clock,
                    periodDisplayOverride: 'End of Game',
                }
            }
        };
        break;
    }
    case 'UPDATE_SELECTED_FT_PROFILE_DATA': {
      const { selectedFormatAndTimingsProfileId, formatAndTimingsProfiles } = state.config;
      if (!selectedFormatAndTimingsProfileId) break;

      const newProfiles = formatAndTimingsProfiles.map(p => {
          if (p.id === selectedFormatAndTimingsProfileId) {
              return { ...p, ...action.payload };
          }
          return p;
      });

      const updatedState = {
          ...state,
          config: {
              ...state.config,
              formatAndTimingsProfiles: newProfiles,
          },
      };
      
      newState = applyFormatAndTimingsProfileToState(updatedState, selectedFormatAndTimingsProfileId);
      break;
    }
    case 'UPDATE_CONFIG_FIELDS': {
        newState = {
            ...state,
            config: {
                ...state.config,
                ...action.payload,
            }
        };
        break;
    }
    case 'ADD_FORMAT_AND_TIMINGS_PROFILE': newState = { ...state, config: { ...state.config, formatAndTimingsProfiles: [...state.config.formatAndTimingsProfiles, createDefaultFormatAndTimingsProfile(undefined, action.payload.name)] } }; break;
    case 'UPDATE_FORMAT_AND_TIMINGS_PROFILE_NAME': newState = { ...state, config: { ...state.config, formatAndTimingsProfiles: state.config.formatAndTimingsProfiles.map(p => p.id === action.payload.profileId ? {...p, name: action.payload.newName} : p) } }; break;
    case 'DELETE_FORMAT_AND_TIMINGS_PROFILE': {
        let newProfiles = state.config.formatAndTimingsProfiles.filter(p => p.id !== action.payload.profileId);
        if (newProfiles.length === 0) newProfiles = [createDefaultFormatAndTimingsProfile()];
        const newSelectedId = action.payload.profileId === state.config.selectedFormatAndTimingsProfileId ? newProfiles[0].id : state.config.selectedScoreboardLayoutProfileId;
        newState = { ...state, config: { ...state.config, formatAndTimingsProfiles: newProfiles, selectedFormatAndTimingsProfileId: newSelectedId }};
        newState = applyFormatAndTimingsProfileToState(newState, newSelectedId);
        break;
    }
    case 'SELECT_FORMAT_AND_TIMINGS_PROFILE': {
      newState = applyFormatAndTimingsProfileToState(state, action.payload.profileId);
      break;
    }
    case 'LOAD_FORMAT_AND_TIMINGS_PROFILES': {
        const newProfiles = action.payload.length > 0 ? action.payload : [createDefaultFormatAndTimingsProfile()];
        newState = { ...state, config: { ...state.config, formatAndTimingsProfiles: newProfiles, selectedFormatAndTimingsProfileId: newProfiles[0].id } };
        newState = applyFormatAndTimingsProfileToState(newState, newProfiles[0].id);
        break;
    }
    case 'REORDER_PENALTY_TYPES': {
      if (!state.config.selectedFormatAndTimingsProfileId) break;
      const { startIndex, endIndex } = action.payload;

      const newProfiles = state.config.formatAndTimingsProfiles.map(p => {
        if (p.id === state.config.selectedFormatAndTimingsProfileId) {
          const newPenaltyTypes = [...(p.penaltyTypes || [])];
          const [removed] = newPenaltyTypes.splice(startIndex, 1);
          if(removed) newPenaltyTypes.splice(endIndex, 0, removed);
          return { ...p, penaltyTypes: newPenaltyTypes };
        }
        return p;
      });

      const updatedState = { ...state, config: { ...state.config, formatAndTimingsProfiles: newProfiles }};
      newState = applyFormatAndTimingsProfileToState(updatedState, state.config.selectedFormatAndTimingsProfileId);
      break;
    }
    case 'UPDATE_LAYOUT_SETTINGS': newState = { ...state, config: { ...state.config, scoreboardLayout: { ...state.config.scoreboardLayout, ...action.payload } }}; break;
    case 'SAVE_CURRENT_LAYOUT_TO_PROFILE': {
        if (!state.config.selectedScoreboardLayoutProfileId) break;
        newState = { ...state, config: { ...state.config, scoreboardLayoutProfiles: state.config.scoreboardLayoutProfiles.map(p => p.id === state.config.selectedScoreboardLayoutProfileId ? { ...p, ...state.config.scoreboardLayout } : p) }};
        break;
    }
    case 'ADD_SCOREBOARD_LAYOUT_PROFILE': newState = { ...state, config: { ...state.config, scoreboardLayoutProfiles: [...state.config.scoreboardLayoutProfiles, createDefaultScoreboardLayoutProfile(undefined, action.payload.name)] }}; break;
    case 'UPDATE_SCOREBOARD_LAYOUT_PROFILE_NAME': newState = { ...state, config: { ...state.config, scoreboardLayoutProfiles: state.config.scoreboardLayoutProfiles.map(p => p.id === action.payload.profileId ? {...p, name: action.payload.newName} : p) }}; break;
    case 'DELETE_SCOREBOARD_LAYOUT_PROFILE': {
        let newProfiles = state.config.scoreboardLayoutProfiles.filter(p => p.id !== action.payload.profileId);
        if (newProfiles.length === 0) newProfiles = [createDefaultScoreboardLayoutProfile()];
        const newSelectedId = action.payload.profileId === state.config.selectedScoreboardLayoutProfileId ? newProfiles[0].id : state.config.selectedScoreboardLayoutProfileId;
        newState = { ...state, config: { ...state.config, scoreboardLayoutProfiles: newProfiles, selectedScoreboardLayoutProfileId: newSelectedId }};
        newState = applyScoreboardLayoutProfileToState(newState, newSelectedId);
        break;
    }
    case 'SELECT_SCOREBOARD_LAYOUT_PROFILE': {
        newState = applyScoreboardLayoutProfileToState(state, action.payload.profileId);
        break;
    }
    case 'LOAD_SOUND_AND_DISPLAY_CONFIG': {
        const { scoreboardLayoutProfiles, ...otherSettings } = action.payload;
        const newProfiles = scoreboardLayoutProfiles && scoreboardLayoutProfiles.length > 0 ? scoreboardLayoutProfiles : [createDefaultScoreboardLayoutProfile()];
        newState = { ...state, config: { ...state.config, ...otherSettings, scoreboardLayoutProfiles: newProfiles, selectedScoreboardLayoutProfileId: newProfiles[0].id }};
        newState = applyScoreboardLayoutProfileToState(newState, newProfiles[0].id);
        break;
    }
    case 'SET_AVAILABLE_CATEGORIES': newState = { ...state, config: { ...state.config, availableCategories: action.payload, selectedMatchCategory: (action.payload.find(c => c.id === state.config.selectedMatchCategory) ? state.config.selectedMatchCategory : (action.payload[0]?.id || '')) } }; break;
    case 'SET_SELECTED_MATCH_CATEGORY': newState = { ...state, config: { ...state.config, selectedMatchCategory: action.payload } }; break;
    case 'UPDATE_TUNNEL_STATE': newState = { ...state, config: { ...state.config, tunnel: { ...state.config.tunnel, ...action.payload } }}; break;
    case 'ADD_TEAM': newState = { ...state, config: { ...state.config, teams: [...state.config.teams, { ...action.payload, id: action.payload.id || safeUUID() }] } }; break;
    case 'UPDATE_TEAM_DETAILS': newState = { ...state, config: { ...state.config, teams: state.config.teams.map(t => t.id === action.payload.teamId ? { ...t, ...action.payload } : t) } }; break;
    case 'DELETE_TEAM': newState = { ...state, config: { ...state.config, teams: state.config.teams.filter(t => t.id !== action.payload.teamId) } }; break;
    case 'ADD_PLAYER_TO_TEAM': newState = { ...state, config: { ...state.config, teams: state.config.teams.map(t => t.id === action.payload.teamId ? { ...t, players: [...t.players, { ...action.payload.player, id: safeUUID() }] } : t) } }; break;
    case 'UPDATE_PLAYER_IN_TEAM': newState = { ...state, config: { ...state.config, teams: state.config.teams.map(t => t.id === action.payload.teamId ? { ...t, players: t.players.map(p => p.id === action.payload.playerId ? { ...p, ...action.payload.updates } : p) } : t) } }; break;
    case 'REMOVE_PLAYER_FROM_TEAM': newState = { ...state, config: { ...state.config, teams: state.config.teams.map(t => t.id === action.payload.teamId ? { ...t, players: t.players.filter(p => p.id !== action.payload.playerId) } : t) } }; break;
    case 'LOAD_TEAMS_FROM_FILE': newState = { ...state, config: { ...state.config, teams: action.payload } }; break;
    case 'SET_TEAM_ATTENDANCE': {
      const { team, playerIds } = action.payload;
      const teamData = state.config.teams.find(t => 
        t.name === state.live[`${team}TeamName`] &&
        (t.subName || undefined) === (state.live[`${team}TeamSubName`] || undefined) &&
        t.category === state.config.selectedMatchCategory
      );

      let attendedPlayerInfo: AttendedPlayerInfo[] = [];
      if (teamData) {
        attendedPlayerInfo = teamData.players
          .filter(p => playerIds.includes(p.id))
          .map(p => ({ id: p.id, number: p.number, name: p.name }));
      }
      
      newState = {
        ...state,
        live: {
          ...state.live,
          gameSummary: {
            ...state.live.gameSummary,
            attendance: {
              ...state.live.gameSummary.attendance,
              [team]: attendedPlayerInfo,
            },
          },
        },
      };
      break;
    }
    case 'RESET_CONFIG_TO_DEFAULTS': {
      const defaultFormatProfile = createDefaultFormatAndTimingsProfile();
      const defaultLayoutParams = createDefaultScoreboardLayoutProfile();
      newState = {
        ...state,
        config: {
          ...state.config,
          ...defaultFormatProfile,
          ...defaultLayoutParams,
          formatAndTimingsProfiles: state.config.formatAndTimingsProfiles.map(p => p.id === state.config.selectedFormatAndTimingsProfileId ? { ...defaultFormatProfile, id: p.id, name: p.name } : p),
          scoreboardLayout: INITIAL_LAYOUT_SETTINGS,
          scoreboardLayoutProfiles: state.config.scoreboardLayoutProfiles.map(p => p.id === state.config.selectedScoreboardLayoutProfileId ? { ...defaultLayoutParams, id: p.id, name: p.name } : p),
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
          enableDebugMode: IN_CODE_INITIAL_ENABLE_DEBUG_MODE,
          availableCategories: IN_CODE_INITIAL_AVAILABLE_CATEGORIES,
          selectedMatchCategory: IN_CODE_INITIAL_SELECTED_MATCH_CATEGORY,
          tunnel: IN_CODE_INITIAL_TUNNEL_STATE,
        }
      };
      break;
    }
    case 'RESET_GAME_STATE': {
      const { defaultWarmUpDuration, autoStartWarmUp } = state.config;
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(SUMMARY_DATA_STORAGE_KEY);
      }
      newState = { ...state, live: {
        score: { home: 0, away: 0, homeShots: 0, awayShots: 0, homeGoals: [], awayGoals: [], },
        penalties: { home: [], away: [], },
        clock: {
          currentTime: defaultWarmUpDuration, currentPeriod: 0, isClockRunning: autoStartWarmUp && defaultWarmUpDuration > 0,
          periodDisplayOverride: 'Warm-up', preTimeoutState: null,
          clockStartTimeMs: (autoStartWarmUp && defaultWarmUpDuration > 0) ? Date.now() : null,
          remainingTimeAtStartCs: (autoStartWarmUp && defaultWarmUpDuration > 0) ? defaultWarmUpDuration : null,
          absoluteElapsedTimeCs: 0, _liveAbsoluteElapsedTimeCs: 0,
        },
        shootout: INITIAL_SHOOTOUT_STATE,
        homeTeamName: 'Local', homeTeamSubName: undefined, awayTeamName: 'Visitante', awayTeamSubName: undefined,
        gameSummary: IN_CODE_INITIAL_GAME_SUMMARY,
        playHornTrigger: state.live.playHornTrigger, playPenaltyBeepTrigger: state.live.playPenaltyBeepTrigger,
        pendingPowerPlayGoal: null,
      }};
      break;
    }
  }

  const nonOriginatingActionTypes: GameAction['type'][] = ['HYDRATE_FROM_STORAGE', 'SET_STATE_FROM_LOCAL_BROADCAST'];
  if (action.type === 'TICK') return newState;
  if (nonOriginatingActionTypes.includes(action.type)) return { ...newState, _lastActionOriginator: undefined };
  
  return { ...newState, _lastActionOriginator: TAB_ID, _lastUpdatedTimestamp: newTimestamp };
};


export const GameStateProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(gameReducer, getInitialState());
  const [isLoading, setIsLoading] = useState(true);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const syncToServer = useCallback(async (stateToSync: GameState) => {
    // Separate teams from the rest of the config for server sync
    const { teams, ...configToSync } = stateToSync.config;
    try {
      await Promise.all([
        updateConfigOnServer(configToSync as ConfigState),
        updateGameStateOnServer(stateToSync.live)
      ]);
    } catch (error) {
      showToast({
        title: "Error de Sincronización",
        description: "No se pudo sincronizar con el servidor.",
        variant: "destructive",
        duration: 2000,
      });
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined') {
        setIsPageVisible(!document.hidden);
        if (!document.hidden) dispatch({ type: 'TICK' });
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      setIsPageVisible(!document.hidden);
    }
    return () => {
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !state._initialConfigLoadComplete) {
      dispatch({ type: 'HYDRATE_FROM_STORAGE', payload: {} });
    }
    setIsLoading(false);

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      if (!channelRef.current) {
        channelRef.current = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      }
      
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type || !event.data?._lastUpdatedTimestamp) {
            return;
        }

        if (event.data._lastActionOriginator !== TAB_ID) {
          dispatch({ type: 'SET_STATE_FROM_LOCAL_BROADCAST', payload: event.data });
        }
      };

      channelRef.current.addEventListener('message', handleMessage);

      return () => {
        channelRef.current?.removeEventListener('message', handleMessage);
      };
    }
  }, [state._initialConfigLoadComplete]);


  useEffect(() => {
    if (isLoading || typeof window === 'undefined') return;

    if (state._lastActionOriginator === TAB_ID) {
      // Separate teams from the rest of the config
      const { teams, ...restOfConfig } = state.config;
      const stateToSave = {
        ...state,
        config: restOfConfig,
      };

      try {
        localStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(stateToSave));
        localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(teams));
        
        channelRef.current?.postMessage(state); // Broadcast the full state
        syncToServer(state);
      } catch (error) {
        console.error("Error saving/broadcasting state:", error);
      }
    }
  }, [state, isLoading, syncToServer]);
  
  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    if ((state.live.clock.isClockRunning || state.live.clock.isFlashingZero) && isPageVisible && !isLoading) {
        timerId = setInterval(() => dispatch({ type: 'TICK' }), TICK_INTERVAL_MS);
    }
    return () => clearInterval(timerId);
  }, [state.live.clock.isClockRunning, state.live.clock.isFlashingZero, isPageVisible, isLoading]);
  

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
    rounding?: 'up' | 'down';
  } = {}
): string => {
  if (isNaN(totalCentiseconds) || totalCentiseconds < 0) totalCentiseconds = 0;

  const isUnderMinute = totalCentiseconds < 6000;
  
  if (isUnderMinute && options.showTenths) {
    const totalSeconds = Math.floor(totalCentiseconds / 100);
    const tenths = Math.floor((totalCentiseconds % 100) / 10);
    if (options.includeMinutesForTenths) {
      return `00:${totalSeconds.toString().padStart(2, '0')}.${tenths.toString()}`;
    }
    return `${totalSeconds.toString().padStart(2, '0')}.${tenths.toString()}`;
  }
  
  let totalSecondsOnly;
  if (options.rounding === 'down') {
     totalSecondsOnly = Math.floor(totalCentiseconds / 100);
  } else {
    totalSecondsOnly = Math.ceil(totalCentiseconds / 100);
  }
  
  const minutes = Math.floor(totalSecondsOnly / 60);
  const seconds = totalSecondsOnly % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};


export const getActualPeriodText = (period: number, override: PeriodDisplayOverrideType, numberOfRegularPeriods: number, shootoutState?: ShootoutState): string => {
  if (override === "Time Out") return "TIME OUT";
  if (override === "End of Game") return "END OF GAME";
  if (override === "Shootout" ) {
      if (shootoutState && !shootoutState.isActive) {
        return "FINAL - EMPATE";
      }
      return "SHOOTOUT"
  }
  if (override) return override;
  return getPeriodText(period, numberOfRegularPeriods);
};

export const getPeriodText = (period: number, numRegPeriods: number): string => {
    if (period === 0) return "Warm-up";
    if (period < 0) return "---";
    if (period <= numRegPeriods) {
        if (period === 1) return "1ST";
        if (period === 2) return "2ND";
        if (period === 3) return "3RD";
        return `${period}TH`;
    }
    const overtimeNumber = period - numRegPeriods;
    return `OT${overtimeNumber > 1 ? overtimeNumber : ''}`.trim();
};

export const getPeriodContextFromAbsoluteTime = (absoluteTimeCs: number, state: GameState): { periodText: string, timeInPeriodCs: number, periodNumber: number } => {
    if (absoluteTimeCs < 0) absoluteTimeCs = 0;
    const { numberOfRegularPeriods, defaultPeriodDuration, defaultOTPeriodDuration, numberOfOvertimePeriods } = state.config;
    let timeTracker = 0;
    for (let i = 1; i <= numberOfRegularPeriods; i++) {
        if (absoluteTimeCs <= timeTracker + defaultPeriodDuration) {
            return { periodText: getPeriodText(i, numberOfRegularPeriods), timeInPeriodCs: Math.max(0, defaultPeriodDuration - (absoluteTimeCs - timeTracker)), periodNumber: i };
        }
        timeTracker += defaultPeriodDuration;
    }
    for (let i = 1; i <= numberOfOvertimePeriods; i++) {
        const periodNumber = numberOfRegularPeriods + i;
        if (absoluteTimeCs <= timeTracker + defaultOTPeriodDuration) {
            return { periodText: getPeriodText(periodNumber, numberOfRegularPeriods), timeInPeriodCs: Math.max(0, defaultOTPeriodDuration - (absoluteTimeCs - timeTracker)), periodNumber: periodNumber };
        }
        timeTracker += defaultOTPeriodDuration;
    }
    const lastPeriodNumber = numberOfRegularPeriods + numberOfOvertimePeriods;
    return { periodText: getPeriodText(lastPeriodNumber, numberOfRegularPeriods), timeInPeriodCs: 0, periodNumber: lastPeriodNumber };
};

export const centisecondsToDisplaySeconds = (centiseconds: number): string => {
  if (isNaN(centiseconds) || centiseconds < 0) return "0";
  return Math.floor(centiseconds / CENTISECONDS_PER_SECOND).toString();
};
export const centisecondsToDisplayMinutes = (centiseconds: number): string => {
  if (isNaN(centiseconds) || centiseconds < 0) return "0";
  return Math.floor(centiseconds / (60 * CENTISECONDS_PER_SECOND)).toString();
};

export const getEndReasonText = (reason?: PenaltyLog['endReason']): string => {
    switch (reason) {
        case 'completed': return 'Cumplida';
        case 'deleted': return 'Eliminada';
        case 'goal_on_pp': return 'Gol en Contra';
        default: return 'Activa';
    }
};

export const getCategoryNameById = (categoryId: string, availableCategories: CategoryData[]): string | undefined => {
  if (!Array.isArray(availableCategories)) return undefined;
  const category = availableCategories.find(cat => cat && typeof cat === 'object' && cat.id === categoryId);
  return category ? category.name : undefined;
};

export { createDefaultFormatAndTimingsProfile, createDefaultScoreboardLayoutProfile };

    

    







