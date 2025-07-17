

export interface PlayerStats {
  name: string;
  shots: number;
  goals: number;
  assists: number;
}

export interface PenaltyTypeDefinition {
  id: string;
  name: string;
  duration: number;
  type: 'minor' | 'misconduct';
  isBenchPenalty?: boolean;
}

export interface Penalty {
  id:string;
  playerNumber: string;
  startTime?: number; 
  expirationTime?: number;
  initialDuration: number; 
  _status?: 'running' | 'pending_concurrent' | 'pending_puck'; 
  penaltyType?: 'minor' | 'misconduct';
  isBenchPenalty?: boolean;
  _limitReached?: ('quantity')[];
}

export type Team = 'home' | 'away';
export type PlayerType = 'player' | 'goalkeeper';

export interface PlayerData {
  id: string;
  number: string;
  type: PlayerType;
  name: string; 
}

export interface TeamData {
  id: string;
  name: string;
  subName?: string; 
  logoDataUrl?: string | null; 
  players: PlayerData[];
  category: string; 
}

export interface CategoryData {
  id: string; 
  name: string;
}

export interface FormatAndTimingsProfileData {
  id: string; // Add ID here to ensure it's always part of the data
  name: string; // Add name here for the same reason
  defaultWarmUpDuration: number;
  defaultPeriodDuration: number;
  defaultOTPeriodDuration: number;
  defaultBreakDuration: number;
  defaultPreOTBreakDuration: number;
  defaultTimeoutDuration: number;
  maxConcurrentPenalties: number;
  autoStartWarmUp: boolean;
  autoStartBreaks: boolean;
  autoStartPreOTBreaks: boolean;
  autoStartTimeouts: boolean;
  numberOfRegularPeriods: number;
  numberOfOvertimePeriods: number;
  playersPerTeamOnIce: number;
  penaltyTypes: PenaltyTypeDefinition[];
  defaultPenaltyTypeId: string | null;
  enableMaxPenaltiesLimit: boolean;
  maxPenaltiesPerPlayer: number;
}

export type FormatAndTimingsProfile = FormatAndTimingsProfileData;

export interface ScoreboardLayoutSettings {
  scoreboardVerticalPosition: number;
  scoreboardHorizontalPosition: number;
  clockSize: number;
  teamNameSize: number;
  scoreSize: number;
  periodSize: number;
  playersOnIceIconSize: number;
  categorySize: number;
  teamLabelSize: number;
  penaltiesTitleSize: number;
  penaltyPlayerNumberSize: number;
  penaltyTimeSize: number;
  penaltyPlayerIconSize: number;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  mainContentGap: number;
  scoreLabelGap: number;
}

export interface ScoreboardLayoutProfile extends ScoreboardLayoutSettings {
  id: string;
  name: string;
}

export interface GoalLog {
  id: string;
  team: Team;
  timestamp: number; 
  gameTime: number; 
  periodText: string;
  scorer?: {
    playerNumber: string;
    playerName?: string;
  };
  assist?: {
    playerNumber: string;
    playerName?: string;
  };
}

export interface PenaltyLog {
  id: string; 
  team: Team;
  playerNumber: string;
  playerName?: string;
  penaltyName?: string;
  initialDuration: number;
  penaltyType?: 'minor' | 'misconduct';
  isBenchPenalty?: boolean;
  addTimestamp: number;
  addGameTime: number;
  addPeriodText: string;
  endTimestamp?: number;
  endGameTime?: number;
  endPeriodText?: string;
  endReason?: 'completed' | 'deleted' | 'goal_on_pp';
  timeServed?: number;
}

export interface AttendedPlayerInfo {
  id: string;
  number: string;
  name: string;
}

export interface GameSummary {
  home: {
    goals: GoalLog[];
    penalties: PenaltyLog[];
    playerStats: Record<string, PlayerStats>; 
  };
  away: {
    goals: GoalLog[];
    penalties: PenaltyLog[];
    playerStats: Record<string, PlayerStats>;
  };
  attendance: {
    home: AttendedPlayerInfo[]; 
    away: AttendedPlayerInfo[]; 
  };
}

export interface TunnelState {
  subdomain: string | null;
  port: number;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  url: string | null;
  lastMessage: string | null;
}

export interface ConfigFields { // Interface for easier picking of fields
  playSoundAtPeriodEnd: boolean;
  customHornSoundDataUrl: string | null;
  enableTeamSelectionInMiniScoreboard: boolean;
  enablePlayerSelectionForPenalties: boolean;
  showAliasInPenaltyPlayerSelector: boolean;
  showAliasInControlsPenaltyList: boolean;
  showAliasInScoreboardPenalties: boolean;
  enablePenaltyCountdownSound: boolean;
  penaltyCountdownStartTime: number;
  customPenaltyBeepSoundDataUrl: string | null;
  scoreboardLayoutProfiles: ScoreboardLayoutProfile[];
  enableDebugMode: boolean;
  tunnel: TunnelState;
}

export interface ConfigState extends Omit<FormatAndTimingsProfileData, 'id' | 'name'>, ConfigFields {
  formatAndTimingsProfiles: FormatAndTimingsProfile[];
  selectedFormatAndTimingsProfileId: string | null;
  scoreboardLayout: ScoreboardLayoutSettings;
  selectedScoreboardLayoutProfileId: string | null;
  availableCategories: CategoryData[];
  selectedMatchCategory: string;
  teams: TeamData[];
}

export type PeriodDisplayOverrideType = 'Warm-up' | 'Break' | 'Pre-OT Break' | 'Time Out' | 'End of Game' | null;

export interface PreTimeoutState {
  period: number;
  time: number;
  isClockRunning: boolean;
  override: PeriodDisplayOverrideType;
  clockStartTimeMs: number | null;
  remainingTimeAtStartCs: number | null;
  absoluteElapsedTimeCs: number;
}

export interface ClockState {
  currentTime: number;
  currentPeriod: number;
  isClockRunning: boolean;
  periodDisplayOverride: PeriodDisplayOverrideType;
  preTimeoutState: PreTimeoutState | null;
  clockStartTimeMs: number | null;
  remainingTimeAtStartCs: number | null;
  absoluteElapsedTimeCs: number;
  _liveAbsoluteElapsedTimeCs: number;
  isFlashingZero?: boolean;
  flashingZeroEndTime?: number;
}

export interface ScoreState {
  home: number;
  away: number;
  homeShots: number;
  awayShots: number;
  homeGoals: GoalLog[];
  awayGoals: GoalLog[];
}

export interface PenaltiesState {
  home: Penalty[];
  away: Penalty[];
}

export interface LiveState {
  clock: ClockState;
  score: ScoreState;
  penalties: PenaltiesState;
  homeTeamName: string;
  homeTeamSubName?: string;
  awayTeamName: string;
  awayTeamSubName?: string;
  gameSummary: GameSummary;
  playHornTrigger: number;
  playPenaltyBeepTrigger: number;
}

export interface GameState {
  config: ConfigState;
  live: LiveState;
  _lastActionOriginator?: string;
  _lastUpdatedTimestamp?: number;
  _initialConfigLoadComplete?: boolean;
}

export interface LiveGameState extends LiveState {
    playersPerTeamOnIce?: number; 
    numberOfRegularPeriods?: number;
    teams?: TeamData[];
    selectedMatchCategory?: string;
    penaltyTypes?: PenaltyTypeDefinition[];
    defaultPenaltyTypeId?: string | null;
}

export interface MobileData {
    gameState: LiveGameState | null;
    penaltyConfig: {
        penaltyTypes: PenaltyTypeDefinition[];
        defaultPenaltyTypeId: string | null;
    }
}


// --- Remote Commands ---
export type RemoteCommand = 
  | { type: 'ADD_GOAL'; payload: { team: Team; scorerNumber: string; assistNumber?: string } }
  | { type: 'ADD_SHOT'; payload: { team: Team; playerNumber: string } }
  | { type: 'ADD_PENALTY'; payload: { team: Team; playerNumber: string; penaltyTypeId: string; } }
  | { type: 'ACTIVATE_PENDING_PUCK_PENALTIES' };


export type GameAction =
  | { type: 'TOGGLE_CLOCK' }
  | { type: 'SET_TIME'; payload: { minutes: number; seconds: number } }
  | { type: 'ADJUST_TIME'; payload: number }
  | { type: 'SET_PERIOD'; payload: number }
  | { type: 'RESET_PERIOD_CLOCK' }
  | { type: 'ADD_GOAL'; payload: Omit<GoalLog, 'id'> }
  | { type: 'EDIT_GOAL'; payload: { goalId: string; updates: Partial<GoalLog> } }
  | { type: 'DELETE_GOAL'; payload: { goalId: string } }
  | { type: 'ADD_PLAYER_SHOT'; payload: { team: Team; playerNumber: string } }
  | { type: 'FINISH_GAME_WITH_OT_GOAL'; payload: Omit<GoalLog, 'id'> }
  | { type: 'ADD_PENALTY'; payload: { team: Team; penalty: { playerNumber: string; penaltyTypeId: string; } } }
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
  | { type: 'ADD_EXTRA_OVERTIME' }
  | { type: 'ADD_FORMAT_AND_TIMINGS_PROFILE'; payload: { name: string; profileData?: Partial<FormatAndTimingsProfileData> } }
  | { type: 'UPDATE_SELECTED_FT_PROFILE_DATA', payload: Partial<FormatAndTimingsProfileData> }
  | { type: 'UPDATE_FORMAT_AND_TIMINGS_PROFILE_NAME'; payload: { profileId: string; newName: string } }
  | { type: 'REORDER_PENALTY_TYPES'; payload: { startIndex: number; endIndex: number } }
  | { type: 'DELETE_FORMAT_AND_TIMINGS_PROFILE'; payload: { profileId: string } }
  | { type: 'SELECT_FORMAT_AND_TIMINGS_PROFILE'; payload: { profileId: string | null } }
  | { type: 'LOAD_FORMAT_AND_TIMINGS_PROFILES'; payload: FormatAndTimingsProfile[] }
  | { type: 'UPDATE_CONFIG_FIELDS'; payload: Partial<ConfigFields> }
  | { type: 'UPDATE_LAYOUT_SETTINGS'; payload: Partial<ScoreboardLayoutSettings> }
  | { type: 'ADD_SCOREBOARD_LAYOUT_PROFILE'; payload: { name: string } }
  | { type: 'UPDATE_SCOREBOARD_LAYOUT_PROFILE_NAME'; payload: { profileId: string; newName: string } }
  | { type: 'DELETE_SCOREBOARD_LAYOUT_PROFILE'; payload: { profileId: string } }
  | { type: 'SELECT_SCOREBOARD_LAYOUT_PROFILE'; payload: { profileId: string } }
  | { type: 'SAVE_CURRENT_LAYOUT_TO_PROFILE' }
  | { type: 'LOAD_SOUND_AND_DISPLAY_CONFIG'; payload: Partial<Pick<ConfigState, 'playSoundAtPeriodEnd' | 'customHornSoundDataUrl' | 'enableTeamSelectionInMiniScoreboard' | 'enablePlayerSelectionForPenalties' | 'showAliasInPenaltyPlayerSelector' | 'showAliasInControlsPenaltyList' | 'showAliasInScoreboardPenalties' | 'scoreboardLayoutProfiles' | 'enablePenaltyCountdownSound' | 'penaltyCountdownStartTime' | 'customPenaltyBeepSoundDataUrl' | 'enableDebugMode' | 'tunnel'>> }
  | { type: 'SET_AVAILABLE_CATEGORIES'; payload: CategoryData[] }
  | { type: 'SET_SELECTED_MATCH_CATEGORY'; payload: string }
  | { type: 'UPDATE_TUNNEL_STATE', payload: Partial<TunnelState> }
  | { type: 'HYDRATE_FROM_STORAGE'; payload: Partial<GameState> }
  | { type: 'SET_STATE_FROM_LOCAL_BROADCAST'; payload: GameState }
  | { type: 'RESET_CONFIG_TO_DEFAULTS' }
  | { type: 'RESET_GAME_STATE' }
  | { type: 'ADD_TEAM'; payload: Omit<TeamData, 'id' | 'players'> & { players: PlayerData[] } }
  | { type: 'UPDATE_TEAM_DETAILS'; payload: { teamId: string; name: string; subName?: string; category: string; logoDataUrl?: string | null } }
  | { type: 'DELETE_TEAM'; payload: { teamId: string } }
  | { type: 'ADD_PLAYER_TO_TEAM'; payload: { teamId: string; player: Omit<PlayerData, 'id'> } }
  | { type: 'UPDATE_PLAYER_IN_TEAM'; payload: { teamId: string; playerId: string; updates: Partial<Pick<PlayerData, 'name' | 'number'>> } }
  | { type: 'REMOVE_PLAYER_FROM_TEAM'; payload: { teamId: string; playerId: string } }
  | { type: 'LOAD_TEAMS_FROM_FILE'; payload: TeamData[] }
  | { type: 'SET_TEAM_ATTENDANCE'; payload: { team: Team; playerIds: string[] } };
