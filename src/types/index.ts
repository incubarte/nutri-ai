

export interface Penalty {
  id: string;
  playerNumber: string;
  startTime?: number; 
  expirationTime?: number;
  initialDuration: number; 
  _status?: 'running' | 'pending_concurrent' | 'pending_puck'; 
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
}

export interface FormatAndTimingsProfile extends FormatAndTimingsProfileData {
  id: string;
  name: string;
}

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
  initialDuration: number;
  addTimestamp: number;
  addGameTime: number;
  addPeriodText: string;
  endTimestamp?: number;
  endGameTime?: number;
  endPeriodText?: string;
  endReason?: 'completed' | 'deleted' | 'goal_on_pp';
  timeServed?: number;
}

export interface GameSummary {
  home: {
    goals: GoalLog[];
    penalties: PenaltyLog[];
  };
  away: {
    goals: GoalLog[];
    penalties: PenaltyLog[];
  };
  attendance: {
    home: string[]; 
    away: string[]; 
  };
}

export interface ConfigState extends FormatAndTimingsProfileData {
  formatAndTimingsProfiles: FormatAndTimingsProfile[];
  selectedFormatAndTimingsProfileId: string | null;
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
  scoreboardLayout: ScoreboardLayoutSettings;
  scoreboardLayoutProfiles: ScoreboardLayoutProfile[];
  selectedScoreboardLayoutProfileId: string | null;
  availableCategories: CategoryData[];
  selectedMatchCategory: string;
  teams: TeamData[];
  enableDebugMode: boolean;
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
}

export interface ScoreState {
  home: number;
  away: number;
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


export interface LiveGameState {
    clock: ClockState;
    score: ScoreState;
    penalties: PenaltiesState;
    homeTeamName: string;
    homeTeamSubName?: string;
    awayTeamName: string;
    awayTeamSubName?: string;
    // These are from config but useful for display
    playersPerTeamOnIce?: number; 
    numberOfRegularPeriods?: number; 
}
