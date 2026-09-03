export type MoodHealthAvailability = {
  available: boolean;
  reason:
    | 'available'
    | 'ios_version'
    | 'health_data_unavailable'
    | 'native_module_missing'
    | 'unsupported_platform';
};

/** This is WRITE authorization only. HealthKit does not reveal read denial. */
export type WriteAuthorization = 'notDetermined' | 'denied' | 'authorized';

export type AuthorizationResult = {
  /** Completion of the request, not confirmation of permission to read. */
  requestCompleted: boolean;
  writeAuthorization: WriteAuthorization;
};

export type ObservationStatus = {
  enabled: boolean;
  observing: boolean;
  backgroundDelivery: 'disabled' | 'enabled' | 'unavailable';
  /** In-memory invalidation counter; it is not a HealthKit sample or cursor. */
  revision: number;
  errorCode?: string;
};

export type StateOfMindChangeEvent = {
  reason: 'changed' | 'foreground' | 'error';
  revision: number;
  errorCode?: string;
};

export type MoodHealthSubscription = { remove(): void };

export type StateOfMindSample = {
  uuid: string;
  timestamp: number;
  kind: 'momentaryEmotion' | 'dailyMood';
  valence: number;
  /** Original Apple enum values, without lossy remapping into local moods. */
  labels: number[];
  associations: number[];
  sourceName: string;
  sourceBundleId: string;
  isFromThisApp: boolean;
};

/** Apple enum names only; sleep, finances and dailyTasks are not enum cases. */
export const HEALTH_ASSOCIATIONS = [
  'work',
  'friends',
  'family',
  'partner',
  'fitness',
  'health',
  'hobbies',
  'education',
  'identity',
  'community',
  'currentEvents',
  'travel',
  'dating',
] as const;

export type HealthAssociation = (typeof HEALTH_ASSOCIATIONS)[number];

export type SaveStateOfMindInput = {
  /** Stable across retries and edits: moodtracker:<local entry id>. */
  syncIdentifier: string;
  /** Positive safe integer; increment for edits, retain for retries. */
  syncVersion: number;
  timestamp: number;
  valence: number;
  kind: 'momentaryEmotion';
  associations: HealthAssociation[];
};

export const MAX_QUERY_LIMIT = 5000;
export const MAX_QUERY_DAYS = 366;

export interface NativeMoodHealthModule {
  getAvailability(): MoodHealthAvailability;
  getWriteAuthorization(): WriteAuthorization;
  requestAuthorization(read: boolean, write: boolean): Promise<AuthorizationResult>;
  getObservationStatus(): ObservationStatus;
  startObservingStateOfMind(): Promise<ObservationStatus>;
  stopObservingStateOfMind(): Promise<ObservationStatus>;
  addListener(
    eventName: 'onStateOfMindChange',
    listener: (event: StateOfMindChangeEvent) => void,
  ): MoodHealthSubscription;
  queryStateOfMind(startMs: number, endMs: number, limit: number): Promise<StateOfMindSample[]>;
  saveStateOfMind(input: SaveStateOfMindInput): Promise<{ uuid: string }>;
}
