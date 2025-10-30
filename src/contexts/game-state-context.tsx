"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useReducer, useEffect, useRef, useState, useCallback } from 'react';
import type { Penalty, Team, TeamData, PlayerData, CategoryData, ConfigState, LiveState, FormatAndTimingsProfile, FormatAndTimingsProfileData, ScoreboardLayoutSettings, ScoreboardLayoutProfile, GameSummary, GoalLog, PenaltyLog, PreTimeoutState, PeriodDisplayOverrideType, ClockState, ScoreState, PenaltiesState, GameState, GameAction, TunnelState, PenaltyTypeDefinition, AttendedPlayerInfo, PlayerStats, ShootoutState, ShotLog, SummaryPlayerStats, Tournament, MatchData } from '@/types';
import { useToast as showToast } from '@/hooks/use-toast';
import isEqual from 'lodash.isequal';
import { saveDataOnServer } from '@/app/actions';
import { safeUUID } from '@/lib/utils';
import defaultSettings from '@/config/defaults.json';


// --- Constantes para la sincronización local ---
export const BROADCAST_CHANNEL_NAME = 'icevision-game-state-channel';
export const SUMMARY_DATA_STORAGE_KEY = 'icevision-summary-data';

const CENTISECONDS_PER_SECOND = 100;
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

const IN_CODE_INITIAL_TOURNAMENT_NAME = "torneito";
const IN_CODE_INITIAL_TOURNAMENT: Tournament = {
  id: safeUUID(),
  name: IN_CODE_INITIAL_TOURNAMENT_NAME,
  status: 'active',
  teams: [],
  categories: [],
  matches: [],
};


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
  gameTimeMode: 'stopped',
  autoActivatePuckPenalties: true, // Default changed as per user request
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
      gameTimeMode: 'stopped',
      autoActivatePuckPenalties: true,
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
      tickIntervalMs: 200,
      scoreboardLayout: INITIAL_LAYOUT_SETTINGS,
      scoreboardLayoutProfiles: [defaultInitialLayoutProfile],
      selectedScoreboardLayoutProfileId: defaultInitialLayoutProfile.id,
      selectedMatchCategory: '',
      tournaments: [],
      selectedTournamentId: null,
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
      overlayMessage: null,
      matchId: null,
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
              newGameStateAfterTransition.live.clock.periodDisplayOverride = "AwaitingDecision";
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
  let toastMessage: GameState['_lastToastMessage'] = null;

  // Clear pending power play goal confirmation on almost any penalty change
  if (action.type !== 'ADD_GOAL' && action.type !== 'CLEAR_PENDING_POWER_PLAY_GOAL' && action.type !== 'TICK' && state.live.pendingPowerPlayGoal) {
      if ('payload' in action && typeof action.payload === 'object' && action.payload && 'team' in action.payload && action.payload.team === state.live.pendingPowerPlayGoal.team) {
          newState.live.pendingPowerPlayGoal = null;
      }
  }

  switch (action.type) {
    case 'SHOW_OVERLAY_MESSAGE':
      newState = { ...state, live: { ...state.live, overlayMessage: { id: safeUUID(), ...action.payload } } };
      break;
    case 'HIDE_OVERLAY_MESSAGE':
      newState = { ...state, live: { ...state.live, overlayMessage: null } };
      break;
    case 'HYDRATE_FROM_SERVER': {
        const serverState = action.payload;
        if (!serverState.config) {
            console.error("Hydration from server failed: config is missing.");
            return state; // Return current state if server data is incomplete
        }
        
        // Start with a clean slate, but keep config and potentially live state
        let finalState: GameState = {
            ...getInitialState(), 
            config: serverState.config,
            _initialConfigLoadComplete: true,
        };

        if (serverState.live && serverState.live.clock) {
            finalState.live = serverState.live;
        }

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

      if (isClockRunning) { // Stopping the clock
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
        // Explicitly sync to server when clock stops
        saveDataOnServer({ config: state.config, live: { ...state.live, clock: { ...state.live.clock, ...newClockState } } });

      } else { // Starting the clock
        if (currentTime > 0) {
            newClockState = {
                isClockRunning: true,
                clockStartTimeMs: Date.now(),
                remainingTimeAtStartCs: currentTime,
            };
        }
      }
      
      const updatedLiveState = {
        ...state.live,
        clock: { ...state.live.clock, ...newClockState },
      };
      
      newState = { ...state, live: updatedLiveState };
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
        toastMessage = { title: "Reloj Actualizado", description: `Tiempo establecido a ${formatTime(newTimeCs, { showTenths: newTimeCs < 6000, includeMinutesForTenths: true })}` };
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
        toastMessage = { title: "Reloj Ajustado", description: `Tiempo ajustado en ${action.payload / 100 > 0 ? '+' : ''}${action.payload / 100} segundo(s).` };
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
      const scoringTeamOnIce = config.playersPerTeamOnIce - state.live.penalties[teamScored].filter(p => p._status === 'running' && (p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride)).length;
      const concedingTeamOnIce = config.playersPerTeamOnIce - state.live.penalties[teamConceded].filter(p => p._status === 'running' && (p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride)).length;

      if (scoringTeamOnIce > concedingTeamOnIce) {
          const firstEligiblePenalty = state.live.penalties[teamConceded].find(p => 
              p._status === 'running' && 
              p.clearsOnGoal &&
              (p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride)
          );
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
      toastMessage = { title: "Gol Añadido", description: `Gol para el jugador #${action.payload.scorer?.playerNumber} registrado.` };
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
        toastMessage = { title: "Gol Actualizado", description: "Los cambios en el gol han sido guardados." };
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
      toastMessage = { title: "Gol Eliminado", description: "El gol ha sido eliminado del registro." };
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
      newState = { ...state };
      newState._lastActionOriginator = TAB_ID; // Mark as significant change
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
      toastMessage = { title: "¡Partido Finalizado!", description: "Gol de oro registrado exitosamente." };
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
      const teamDetails = config.tournaments.find(t => t.id === config.selectedTournamentId)?.teams.find(t => t.name === live[`${team}TeamName`] && (t.subName || undefined) === (live[`${team}TeamSubName`] || undefined) && t.category === config.selectedMatchCategory);
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
      
      if (addGameTime !== undefined && addPeriodText !== undefined) {
        newState = { ...state, live: { ...state.live, gameSummary: newGameSummary }};
        toastMessage = { title: "Penalidad Añadida", description: "La penalidad se ha agregado al resumen."};
      } else {
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
          newStatus = config.autoActivatePuckPenalties ? 'pending_concurrent' : 'pending_puck';
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
        const teamName = team === 'home' ? live.homeTeamName : live.awayTeamName;
        toastMessage = { title: "Penalidad Agregada", description: `Jugador ${playerNumber.toUpperCase()}${playerDetails ? ` (${playerDetails.name})` : ''} de ${teamName} recibió una penalidad de ${penaltyDef.name}.` };
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
      toastMessage = { title: "Penalidad Eliminada", variant: "destructive" };
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
      toastMessage = { title: "Penalidad Finalizada", description: "La penalidad se eliminó por el gol en Power Play." };
      break;
    }
    case 'CLEAR_PENDING_POWER_PLAY_GOAL': {
      newState = { ...state, live: { ...state.live, pendingPowerPlayGoal: null } };
      break;
    }
    case 'TOGGLE_PENALTY_PLAYER_REDUCTION': {
      const { team, penaltyId } = action.payload;
      const penaltiesForTeam = [...state.live.penalties[team]];
      const penaltyIndex = penaltiesForTeam.findIndex(p => p.id === penaltyId);
      if (penaltyIndex === -1) break;

      const penaltyToToggle = { ...penaltiesForTeam[penaltyIndex] };
      const isCurrentlyReducing = penaltyToToggle.reducesPlayerCount && !penaltyToToggle._doesNotReducePlayerCountOverride;

      if (isCurrentlyReducing) {
        penaltyToToggle._doesNotReducePlayerCountOverride = true;
      } else {
        const runningAndReducingPenalties = penaltiesForTeam.filter(
          p => p.id !== penaltyId && p._status === 'running' && p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride
        ).length;

        if (runningAndReducingPenalties >= state.config.maxConcurrentPenalties) {
          penaltyToToggle._status = 'pending_concurrent';
          penaltyToToggle.startTime = undefined;
          penaltyToToggle.expirationTime = undefined;
          penaltyToToggle._doesNotReducePlayerCountOverride = false; // Set intention
          toastMessage = { title: "Sin Slots Disponibles", description: `La penalidad para #${penaltyToToggle.playerNumber} está ahora en "Esperando Slot".` };
        } else {
          penaltyToToggle._doesNotReducePlayerCountOverride = false;
        }
      }
      
      penaltiesForTeam[penaltyIndex] = penaltyToToggle;
      
      newState = { ...state, live: { ...state.live, penalties: { ...state.live.penalties, [team]: sortPenaltiesByStatus(penaltiesForTeam) }}};
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
      toastMessage = { title: "Tiempo de Penalidad Establecido", description: `Tiempo actualizado a ${formatTime(newRemainingTimeCs)}.` };
      break;
    }
    case 'REORDER_PENALTIES': {
      const { team, startIndex, endIndex } = action.payload;
      const currentPenalties = [...state.live.penalties[team]];
      const [removed] = currentPenalties.splice(startIndex, 1);
      if (removed) currentPenalties.splice(endIndex, 0, removed);
      newState = { ...state, live: { ...state.live, penalties: { ...state.live.penalties, [team]: sortPenaltiesByStatus(currentPenalties) }}};
      toastMessage = { title: "Penalidades Reordenadas", description: `Orden de penalidades para ${team === 'home' ? state.live.homeTeamName : state.live.awayTeamName} actualizado.` };
      break;
    }
    case 'ACTIVATE_PENDING_PUCK_PENALTIES': {
      const activate = (penalties: Penalty[]) => penalties.map(p => {
        if (p._status === 'pending_puck') {
          return { ...p, _status: 'pending_concurrent' };
        }
        return p;
      });
      newState = { ...state, live: { ...state.live, penalties: { home: activate(state.live.penalties.home), away: activate(state.live.penalties.away) }}};
      break;
    }
    case 'TICK': {
      if (!state.live?.clock) return state; // Safety guard
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
          let availableSlots = config.maxConcurrentPenalties - stillRunning.filter(p => (p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride)).length;
          const playersServing = new Set(stillRunning.filter(p => (p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride)).map(p => p.playerNumber));
          
          let pendingConcurrent = teamPenalties.filter(p => p._status === 'pending_concurrent');
          for (const p of pendingConcurrent) {
              if (availableSlots > 0 && !playersServing.has(p.playerNumber)) {
                  significantChangeOccurred = true;
                  stillRunning.push({ ...p, _status: 'running', startTime: liveAbsoluteElapsedTimeCs, expirationTime: liveAbsoluteElapsedTimeCs + (p.initialDuration * CENTISECONDS_PER_SECOND) });
                  if(p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride) {
                    playersServing.add(p.playerNumber);
                    availableSlots--;
                  }
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
      
      // Do not mark TICK as an originator to prevent server sync on every tick
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
        toastMessage = { title: "Time Out Iniciado", description: `Time Out de ${state.config.defaultTimeoutDuration / 100} segundos. Reloj ${autoStart ? 'corriendo' : 'pausado'}.` };
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
        toastMessage = { title: "Time Out Finalizado", description: "Juego reanudado al estado anterior." };
      }
      break;
    }
    case 'MANUAL_END_GAME': {
        const { live, config } = state;
        const totalGamePeriods = config.numberOfRegularPeriods + config.numberOfOvertimePeriods;

        // If it's the end of a regular period AND the game is NOT tied, end the game.
        if (live.clock.currentPeriod >= config.numberOfRegularPeriods && live.score.home !== live.score.away) {
            const newAbsoluteTime = calculateAbsoluteTimeForPeriod(live.clock.currentPeriod, 0, state);
            newState = { ...state, live: { ...live,
                clock: { ...live.clock, currentTime: 0, isClockRunning: false, periodDisplayOverride: 'End of Game',
                    absoluteElapsedTimeCs: newAbsoluteTime, _liveAbsoluteElapsedTimeCs: newAbsoluteTime,
                    clockStartTimeMs: null, remainingTimeAtStartCs: null, preTimeoutState: null,
                },
                playHornTrigger: state.live.playHornTrigger + 1
            }};
        }
        // If we are in a running period before the last total period.
        else if (live.clock.currentPeriod < totalGamePeriods && live.clock.periodDisplayOverride === null) {
            const isPreOT = live.clock.currentPeriod >= config.numberOfRegularPeriods;
            const breakType = isPreOT ? 'START_PRE_OT_BREAK' : 'START_BREAK';
            return gameReducer(state, { type: breakType });
        }
        // If it's a TIE at the end of regulation or OT.
        else if (live.score.home === live.score.away) {
            newState = { ...state, live: { ...live,
                clock: { ...live.clock, currentTime: 0, isClockRunning: false, periodDisplayOverride: 'AwaitingDecision' },
                shootout: { ...live.shootout, isActive: false }
            }};
        }
        // Fallback to just end the game (e.g., end of final OT with no winner yet).
        else {
             const newAbsoluteTime = calculateAbsoluteTimeForPeriod(live.clock.currentPeriod, 0, state);
            newState = { ...state, live: { ...live,
                clock: { ...live.clock, currentTime: 0, isClockRunning: false, periodDisplayOverride: 'End of Game',
                    absoluteElapsedTimeCs: newAbsoluteTime, _liveAbsoluteElapsedTimeCs: newAbsoluteTime,
                    clockStartTimeMs: null, remainingTimeAtStartCs: null, preTimeoutState: null,
                },
                playHornTrigger: state.live.playHornTrigger + 1
            }};
        }
        break;
    }
    case 'ADD_EXTRA_OVERTIME': {
      if (state.live.clock.periodDisplayOverride !== 'AwaitingDecision') break;
      const { config, live } = state;
      const newNumberOfOTs = config.numberOfOvertimePeriods + 1;
      
      const newAbsoluteTime = calculateAbsoluteTimeForPeriod(live.clock.currentPeriod, 0, state);
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
            currentPeriod: live.clock.currentPeriod,
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
      toastMessage = { title: "Overtime Extra Añadido", description: "Se ha añadido un período de OT y se ha iniciado un descanso." };
      break;
    }
    case 'START_SHOOTOUT': {
      if (state.live.clock.periodDisplayOverride !== 'AwaitingDecision') break;
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
      toastMessage = { title: "Tanda de Penales Iniciada" };
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
      let finalScore = { ...state.live.score };
      if (state.live.shootout.isActive) {
        const homeGoals = state.live.shootout.homeAttempts.filter(a => a.isGoal).length;
        const awayGoals = state.live.shootout.awayAttempts.filter(a => a.isGoal).length;

        if (homeGoals > awayGoals) {
          finalScore.home += 1;
        } else if (awayGoals > homeGoals) {
          finalScore.away += 1;
        }
      }

      newState = {
        ...state,
        live: {
          ...state.live,
          score: finalScore,
          shootout: { ...state.live.shootout, isActive: false },
          clock: { ...state.live.clock, periodDisplayOverride: 'End of Game' },
        },
      };
      toastMessage = { title: "Tanda de Penales Finalizada", description: "El resultado final ha sido actualizado." };
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
    case 'ADD_FORMAT_AND_TIMINGS_PROFILE': 
      newState = { ...state, config: { ...state.config, formatAndTimingsProfiles: [...state.config.formatAndTimingsProfiles, createDefaultFormatAndTimingsProfile(undefined, action.payload.name)] } }; 
      toastMessage = { title: "Perfil Creado", description: `Perfil "${action.payload.name.trim()}" añadido.` };
      break;
    case 'UPDATE_FORMAT_AND_TIMINGS_PROFILE_NAME': 
      newState = { ...state, config: { ...state.config, formatAndTimingsProfiles: state.config.formatAndTimingsProfiles.map(p => p.id === action.payload.profileId ? {...p, name: action.payload.newName} : p) } }; 
      toastMessage = { title: "Nombre de Perfil Actualizado" };
      break;
    case 'DELETE_FORMAT_AND_TIMINGS_PROFILE': {
        let newProfiles = state.config.formatAndTimingsProfiles.filter(p => p.id !== action.payload.profileId);
        if (newProfiles.length === 0) newProfiles = [createDefaultFormatAndTimingsProfile()];
        const newSelectedId = action.payload.profileId === state.config.selectedFormatAndTimingsProfileId ? newProfiles[0].id : state.config.selectedScoreboardLayoutProfileId;
        newState = { ...state, config: { ...state.config, formatAndTimingsProfiles: newProfiles, selectedFormatAndTimingsProfileId: newSelectedId }};
        newState = applyFormatAndTimingsProfileToState(newState, newSelectedId);
        toastMessage = { title: "Perfil Eliminado", variant: "destructive" };
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
    case 'ADD_SCOREBOARD_LAYOUT_PROFILE': 
      newState = { ...state, config: { ...state.config, scoreboardLayoutProfiles: [...state.config.scoreboardLayoutProfiles, createDefaultScoreboardLayoutProfile(undefined, action.payload.name)] }}; 
      toastMessage = { title: "Perfil de Diseño Creado", description: `Perfil "${action.payload.name.trim()}" añadido.` };
      break;
    case 'UPDATE_SCOREBOARD_LAYOUT_PROFILE_NAME': 
      newState = { ...state, config: { ...state.config, scoreboardLayoutProfiles: state.config.scoreboardLayoutProfiles.map(p => p.id === action.payload.profileId ? {...p, name: action.payload.newName} : p) }}; 
      toastMessage = { title: "Nombre de Perfil de Diseño Actualizado" };
      break;
    case 'DELETE_SCOREBOARD_LAYOUT_PROFILE': {
        let newProfiles = state.config.scoreboardLayoutProfiles.filter(p => p.id !== action.payload.profileId);
        if (newProfiles.length === 0) newProfiles = [createDefaultScoreboardLayoutProfile()];
        const newSelectedId = action.payload.profileId === state.config.selectedScoreboardLayoutProfileId ? newProfiles[0].id : state.config.selectedScoreboardLayoutProfileId;
        newState = { ...state, config: { ...state.config, scoreboardLayoutProfiles: newProfiles, selectedScoreboardLayoutProfileId: newSelectedId }};
        newState = applyScoreboardLayoutProfileToState(newState, newSelectedId);
        toastMessage = { title: "Perfil de Diseño Eliminado", variant: "destructive" };
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
    case 'SET_CATEGORIES_FOR_TOURNAMENT': {
        newState = { ...state, config: { ...state.config, tournaments: (state.config.tournaments || []).map(t => t.id === action.payload.tournamentId ? { ...t, categories: action.payload.categories } : t) } };
        break;
    }
    case 'ADD_CATEGORIES_TO_TOURNAMENT': {
        newState = { ...state, config: { ...state.config, tournaments: (state.config.tournaments || []).map(t => t.id === action.payload.tournamentId ? { ...t, categories: [...(t.categories || []), ...action.payload.categories] } : t) } };
        break;
    }
    case 'SET_SELECTED_MATCH_CATEGORY': newState = { ...state, config: { ...state.config, selectedMatchCategory: action.payload } }; toastMessage = { title: "Categoría del Partido Actualizada" }; break;
    case 'UPDATE_TUNNEL_STATE': newState = { ...state, config: { ...state.config, tunnel: { ...state.config.tunnel, ...action.payload } }}; break;
    case 'ADD_TOURNAMENT': {
        const newTournament: Tournament = {
            id: safeUUID(),
            name: action.payload.name,
            status: action.payload.status,
            teams: [],
            categories: [],
            matches: [],
        };
        newState = { ...state, config: { ...state.config, tournaments: [...(state.config.tournaments || []), newTournament] } };
        break;
    }
    case 'UPDATE_TOURNAMENT': {
        newState = { ...state, config: { ...state.config, tournaments: (state.config.tournaments || []).map(t => t.id === action.payload.id ? {...t, ...action.payload} : t) } };
        break;
    }
    case 'DELETE_TOURNAMENT': {
        newState = { ...state, config: { ...state.config, tournaments: (state.config.tournaments || []).filter(t => t.id !== action.payload.id) } };
        break;
    }
    case 'SET_ACTIVE_TOURNAMENT': {
        const selectedTournament = (state.config.tournaments || []).find(t => t.id === action.payload.tournamentId);
        const selectedCategory = (selectedTournament?.categories || [])[0]?.id || '';
        newState = { ...state, config: { ...state.config, selectedTournamentId: action.payload.tournamentId, selectedMatchCategory: selectedCategory } };
        break;
    }
    case 'ADD_TEAM': { // Legacy: adds to a global list, will now add to the selected tournament
        const { selectedTournamentId } = state.config;
        if (!selectedTournamentId) {
            toastMessage = { title: "Error", description: "No hay un torneo seleccionado para añadir el equipo.", variant: "destructive" };
            break;
        }
        const teamWithId = { ...action.payload, id: action.payload.id || safeUUID() };
        newState = { ...state, config: { ...state.config, tournaments: state.config.tournaments.map(t => t.id === selectedTournamentId ? { ...t, teams: [...t.teams, teamWithId] } : t) } };
        break;
    }
    case 'ADD_TEAM_TO_TOURNAMENT': {
        const { tournamentId, team } = action.payload;
        newState = { ...state, config: { ...state.config, tournaments: (state.config.tournaments || []).map(t => t.id === tournamentId ? { ...t, teams: [...t.teams, { ...team, id: team.id || safeUUID() }] } : t) } };
        break;
    }
    case 'DELETE_TEAMS_FROM_TOURNAMENT': {
        const { tournamentId, teamIds } = action.payload;
         newState = { ...state, config: { ...state.config, tournaments: (state.config.tournaments || []).map(t => t.id === tournamentId ? { ...t, teams: t.teams.filter(team => !teamIds.includes(team.id)) } : t) } };
        break;
    }
    case 'UPDATE_TEAM_DETAILS': {
      const { teamId, ...updates } = action.payload;
      newState = { ...state, config: { ...state.config, tournaments: state.config.tournaments.map(t => ({ ...t, teams: t.teams.map(team => team.id === teamId ? { ...team, ...updates } : team) })) } };
      toastMessage = { title: "Equipo Actualizado", description: `El equipo "${updates.name}" ha sido actualizado.` };
      break;
    }
    case 'DELETE_TEAM': { // Legacy: will delete from any tournament that contains it
      const { teamId } = action.payload;
      newState = { ...state, config: { ...state.config, tournaments: state.config.tournaments.map(t => ({ ...t, teams: t.teams.filter(team => team.id !== teamId) })) }};
      break;
    }
    case 'ADD_PLAYER_TO_TEAM': {
      const { teamId, player } = action.payload;
      newState = { ...state, config: { ...state.config, tournaments: state.config.tournaments.map(t => ({ ...t, teams: t.teams.map(team => team.id === teamId ? { ...team, players: [...team.players, { ...player, id: safeUUID() }] } : team) })) } };
      toastMessage = { title: "Jugador Añadido", description: `Jugador ${player.number ? `#${player.number} ` : ''}${player.name} añadido.` };
      break;
    }
    case 'UPDATE_PLAYER_IN_TEAM': {
      const { teamId, playerId, updates } = action.payload;
      newState = { ...state, config: { ...state.config, tournaments: state.config.tournaments.map(t => ({ ...t, teams: t.teams.map(team => team.id === teamId ? { ...t, players: team.players.map(p => p.id === playerId ? { ...p, ...updates } : p) } : team) })) } };
      break;
    }
    case 'REMOVE_PLAYER_FROM_TEAM': {
      const { teamId, playerId } = action.payload;
      newState = { ...state, config: { ...state.config, tournaments: state.config.tournaments.map(t => ({ ...t, teams: t.teams.map(team => team.id === teamId ? { ...t, players: team.players.filter(p => p.id !== playerId) } : team) })) }};
      break;
    }
    case 'LOAD_TEAMS_FROM_FILE': { // Legacy: no longer used directly.
        // This case would need tournament context to be useful now.
        // For now, it does nothing to prevent incorrect data loading.
        break;
    }
    case 'SET_TEAM_ATTENDANCE': {
      const { team, playerIds } = action.payload;
      const selectedTournament = state.config.tournaments.find(t => t.id === state.config.selectedTournamentId);
      const teamData = selectedTournament?.teams.find(t => 
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
    case 'ADD_MATCH_TO_TOURNAMENT': {
        const { tournamentId, match } = action.payload;
        // Correct way: create a new tournaments array, then map over it.
        const newTournaments = state.config.tournaments.map(t => {
            if (t.id === tournamentId) {
                // Create a new tournament object with a new matches array
                return { ...t, matches: [...(t.matches || []), { ...match, id: safeUUID() }] };
            }
            return t;
        });
        newState = { ...state, config: { ...state.config, tournaments: newTournaments } };
        break;
    }
    case 'UPDATE_MATCH_IN_TOURNAMENT': {
        const { tournamentId, match } = action.payload;
        const newTournaments = state.config.tournaments.map(t => {
            if (t.id === tournamentId) {
                // Create a new tournament object with a new matches array
                const newMatches = (t.matches || []).map(m => m.id === match.id ? match : m);
                return { ...t, matches: newMatches };
            }
            return t;
        });
        newState = { ...state, config: { ...state.config, tournaments: newTournaments } };
        break;
    }
    case 'DELETE_MATCH_FROM_TOURNAMENT': {
        const { tournamentId, matchId } = action.payload;
        const newTournaments = state.config.tournaments.map(t => {
             if (t.id === tournamentId) {
                const newMatches = (t.matches || []).filter(m => m.id !== matchId);
                return { ...t, matches: newMatches };
             }
             return t;
        });
        newState = { ...state, config: { ...state.config, tournaments: newTournaments } };
        break;
    }
    case 'SAVE_MATCH_SUMMARY': {
      const { matchId, summary } = action.payload;
      const tournamentId = state.config.selectedTournamentId;
      if (!tournamentId) break;

      const newTournaments = state.config.tournaments.map(t => {
        if (t.id === tournamentId) {
          const newMatches = t.matches.map(m =>
            m.id === matchId ? { ...m, summary } : m
          );
          return { ...t, matches: newMatches };
        }
        return t;
      });
      newState = { ...state, config: { ...state.config, tournaments: newTournaments }};
      break;
    }
     case 'UPDATE_LIVE_STATE':
        newState = { ...state, live: { ...state.live, ...action.payload } };
        break;
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
          selectedMatchCategory: '', // Resets match category
          tunnel: IN_CODE_INITIAL_TUNNEL_STATE,
        }
      };
      toastMessage = { title: "Configuración Restablecida", description: "Todas las configuraciones han vuelto a sus valores predeterminados." };
      break;
    }
    case 'RESET_GAME_STATE': {
      const { defaultWarmUpDuration, autoStartWarmUp } = state.config;
      
      const resetLiveState: LiveState = {
        score: { home: 0, away: 0, homeShots: 0, awayShots: 0, homeGoals: [], awayGoals: [] },
        penalties: { home: [], away: [] },
        clock: {
          currentTime: defaultWarmUpDuration,
          currentPeriod: 0,
          isClockRunning: autoStartWarmUp && defaultWarmUpDuration > 0,
          periodDisplayOverride: 'Warm-up',
          preTimeoutState: null,
          clockStartTimeMs: (autoStartWarmUp && defaultWarmUpDuration > 0) ? Date.now() : null,
          remainingTimeAtStartCs: (autoStartWarmUp && defaultWarmUpDuration > 0) ? defaultWarmUpDuration : null,
          absoluteElapsedTimeCs: 0,
          _liveAbsoluteElapsedTimeCs: 0,
        },
        shootout: INITIAL_SHOOTOUT_STATE,
        homeTeamName: 'Local',
        homeTeamSubName: undefined,
        awayTeamName: 'Visitante',
        awayTeamSubName: undefined,
        gameSummary: IN_CODE_INITIAL_GAME_SUMMARY,
        playHornTrigger: state.live.playHornTrigger,
        playPenaltyBeepTrigger: state.live.playPenaltyBeepTrigger,
        pendingPowerPlayGoal: null,
        overlayMessage: null,
        matchId: state.live.matchId, // Preserve the matchId
      };

      // Save the reset live state to the server immediately
      saveDataOnServer({ config: state.config, live: resetLiveState });

      newState = { ...state, live: resetLiveState };
      break;
    }
  }

  const nonOriginatingActionTypes: GameAction['type'][] = ['HYDRATE_FROM_SERVER', 'SET_STATE_FROM_LOCAL_BROADCAST'];
  if (action.type === 'TICK') return newState;
  if (nonOriginatingActionTypes.includes(action.type)) return { ...newState, _lastActionOriginator: undefined };
  
  return { ...newState, _lastActionOriginator: TAB_ID, _lastUpdatedTimestamp: newTimestamp, _lastToastMessage: toastMessage };
};

const GameStateObserver = () => {
    const { state, dispatch } = useGameState();
    const { toast } = showToast();
    const lastToastRef = useRef<GameState['_lastToastMessage']>(null);
    const prevPeriodDisplayOverrideRef = useRef<PeriodDisplayOverrideType>();

    useEffect(() => {
        if (state._lastToastMessage && state._lastToastMessage !== lastToastRef.current) {
            toast(state._lastToastMessage);
            lastToastRef.current = state._lastToastMessage;
        }
    }, [state._lastToastMessage, toast]);
    
    useEffect(() => {
        const currentOverride = state.live?.clock?.periodDisplayOverride;

        if (prevPeriodDisplayOverrideRef.current !== 'End of Game' && currentOverride === 'End of Game' && state.live.matchId) {
             const summary = generateSummaryData(state);
            if (summary) {
                dispatch({
                    type: 'SAVE_MATCH_SUMMARY',
                    payload: { matchId: state.live.matchId, summary }
                });
                toast({
                    title: "Resumen Guardado",
                    description: "El resumen del partido finalizado se ha guardado automáticamente."
                });
            }
        }

        prevPeriodDisplayOverrideRef.current = currentOverride;
    }, [state.live?.clock?.periodDisplayOverride, state.live?.matchId, state, dispatch, toast]);


    return null;
}


export const GameStateProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(gameReducer, getInitialState());
  const [isLoading, setIsLoading] = useState(true);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const syncToServer = useCallback(async (stateToSync: GameState) => {
    try {
        await saveDataOnServer({ config: stateToSync.config, live: stateToSync.live });
    } catch (error) {
      showToast({
        title: "Error de Sincronización",
        description: "No se pudo guardar la configuración en el servidor.",
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
    const fetchInitialData = async () => {
      try {
        const res = await fetch('/api/db');
        if (res.ok) {
          const data: GameState = await res.json();
          dispatch({ type: 'HYDRATE_FROM_SERVER', payload: data });
        } else {
          // If fetching fails, we might fall back to a default state or show an error
          dispatch({ type: 'HYDRATE_FROM_SERVER', payload: getInitialState() });
        }
      } catch (error) {
        console.error("Failed to fetch initial state from server:", error);
        dispatch({ type: 'HYDRATE_FROM_SERVER', payload: getInitialState() });
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();

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
  }, []);


  useEffect(() => {
    if (isLoading || typeof window === 'undefined' || !state._lastActionOriginator) return;

    if (state._lastActionOriginator === TAB_ID) {
      try {
        channelRef.current?.postMessage(state);
        syncToServer(state);
      } catch (error) {
        console.error("Error broadcasting or saving state:", error);
      }
    }
  }, [state, isLoading, syncToServer]);
  
  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    const tickInterval = state.config.tickIntervalMs || 200;
    if (state.live?.clock && (state.live.clock.isClockRunning || state.live.clock.isFlashingZero) && isPageVisible && !isLoading) {
        timerId = setInterval(() => dispatch({ type: 'TICK' }), tickInterval);
    }
    return () => clearInterval(timerId);
  }, [state.live?.clock, isPageVisible, isLoading, state.config.tickIntervalMs]);
  

  return (
    <GameStateContext.Provider value={{ state, dispatch, isLoading }}>
      {children}
      <GameStateObserver />
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
  if (override === "End of Game") return "FINALIZADO";
  if (override === "AwaitingDecision") return "PRE-FINAL";
  if (override === "Shootout" || (shootoutState && shootoutState.isActive)) {
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

export const getCategoryNameById = (categoryId: string, availableCategories: CategoryData[] | undefined): string | undefined => {
  if (!Array.isArray(availableCategories)) return undefined;
  const category = availableCategories.find(cat => cat && typeof cat === 'object' && cat.id === categoryId);
  return category ? category.name : undefined;
};

export const generateSummaryData = (state: GameState): GameSummary | null => {
    const { live, config } = state;
    if (!live || !config) return null;

    const summary: GameSummary = JSON.parse(JSON.stringify(live.gameSummary));

    const statsByPeriod: Record<string, any> = {};

    const allEvents = [
        ...summary.home.goals.map(e => ({ ...e, type: 'goal', team: 'home' })),
        ...summary.away.goals.map(e => ({ ...e, type: 'goal', team: 'away' })),
        ...summary.home.penalties.map(e => ({ ...e, type: 'penalty', team: 'home' })),
        ...summary.away.penalties.map(e => ({ ...e, type: 'penalty', team: 'away' })),
        ...(summary.home.homeShotsLog || []).map(e => ({ ...e, type: 'shot', team: 'home' })),
        ...(summary.away.awayShotsLog || []).map(e => ({ ...e, type: 'shot', team: 'away' })),
    ];

    allEvents.forEach(event => {
        const periodText = event.periodText || event.addPeriodText;
        if (!periodText || periodText.toLowerCase().includes('warm-up')) return;

        if (!statsByPeriod[periodText]) {
            statsByPeriod[periodText] = {
                home: { goals: [], penalties: [], playerStats: [] },
                away: { goals: [], penalties: [], playerStats: [] }
            };
        }

        const teamStats = statsByPeriod[periodText][event.team];
        if (event.type === 'goal') teamStats.goals.push(event);
        if (event.type === 'penalty') teamStats.penalties.push(event);
    });

    for (const period in statsByPeriod) {
        const homeAttendance = summary.attendance.home || [];
        const awayAttendance = summary.attendance.away || [];
        const homePlayerStatsMap = new Map<string, SummaryPlayerStats>();
        const awayPlayerStatsMap = new Map<string, SummaryPlayerStats>();

        homeAttendance.forEach(p => homePlayerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));
        awayAttendance.forEach(p => awayPlayerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));

        statsByPeriod[period].home.goals.forEach((goal: GoalLog) => {
            const scorerId = homeAttendance.find(p => p.number === goal.scorer?.playerNumber)?.id;
            if (scorerId && homePlayerStatsMap.has(scorerId)) homePlayerStatsMap.get(scorerId)!.goals++;
            const assistId = homeAttendance.find(p => p.number === goal.assist?.playerNumber)?.id;
            if (assistId && homePlayerStatsMap.has(assistId)) homePlayerStatsMap.get(assistId)!.assists++;
        });
         statsByPeriod[period].away.goals.forEach((goal: GoalLog) => {
            const scorerId = awayAttendance.find(p => p.number === goal.scorer?.playerNumber)?.id;
            if (scorerId && awayPlayerStatsMap.has(scorerId)) awayPlayerStatsMap.get(scorerId)!.goals++;
            const assistId = awayAttendance.find(p => p.number === goal.assist?.playerNumber)?.id;
            if (assistId && awayPlayerStatsMap.has(assistId)) awayPlayerStatsMap.get(assistId)!.assists++;
        });

        (summary.home.homeShotsLog || []).filter(s => s.periodText === period).forEach(shot => {
             if (shot.playerId && homePlayerStatsMap.has(shot.playerId)) homePlayerStatsMap.get(shot.playerId)!.shots++;
        });
         (summary.away.awayShotsLog || []).filter(s => s.periodText === period).forEach(shot => {
             if (shot.playerId && awayPlayerStatsMap.has(shot.playerId)) awayPlayerStatsMap.get(shot.playerId)!.shots++;
        });
        
        statsByPeriod[period].home.playerStats = Array.from(homePlayerStatsMap.values());
        statsByPeriod[period].away.playerStats = Array.from(awayPlayerStatsMap.values());
    }

    summary.statsByPeriod = statsByPeriod;
    if(live.shootout && live.shootout.homeAttempts.length > 0) {
        summary.shootout = live.shootout;
    }

    return summary;
};

export { createDefaultFormatAndTimingsProfile, createDefaultScoreboardLayoutProfile };
