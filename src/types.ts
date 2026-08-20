export interface Coordinate {
  lat: number;
  lng: number;
  altitude?: number | null;
  speed?: number | null;
  accuracy?: number | null;
  timestamp: number;
}

export interface Split {
  id: string;
  splitIndex: number; // 1, 2, 3, 4 ...
  formattedIndex: string; // "01", "02", "03", "04"
  name?: string; // Custom point name e.g. "Pihenő", "Kilátó", "Forrás"
  notes?: string; // Comments / notes for this point
  photos?: string[]; // Array of base64 / image URLs
  distanceKm: number; // e.g. 1.0
  formattedDistance: string; // "1.0 km"
  timeSec: number; // split duration in seconds
  formattedTime: string; // "05:12"
  paceSecPerKm: number;
  paceDiffSec?: number; // difference in seconds compared to previous split
  formattedDiff?: string; // "+0:14" or "-0:02"
  trend?: 'up' | 'down' | 'same'; // 'up' = slower/higher time (+), 'down' = faster/lower time (-)
  totalDistanceKm: number;
  totalTimeSec: number;
  timestamp: number;
  coordinate?: Coordinate;
}

export interface ActivitySession {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  formattedStartTime: string; // e.g. "14:30"
  formattedDate: string; // e.g. "2026.08.18"
  totalDistanceKm: number;
  totalDurationSec: number;
  avgPaceSecPerKm: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  splits: Split[];
  coordinates: Coordinate[];
  notes?: string;
}

export type TrackingStatus = 'idle' | 'running' | 'paused';

export type ActivityMode = 'walking' | 'cycling' | 'car';

export interface UserSettings {
  unit: 'km' | 'm' | 'mi';
  activityMode: ActivityMode;
  autoSplitDistanceKm: number; // 0 for disabled, 1.0 for 1km
  highAccuracy: boolean;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  coordinateFormat: 'dms' | 'decimal';
  mapLayer: 'osm' | 'voyager' | 'positron' | 'cyclosm' | 'satellite';
  simulationMode: boolean;
  simulationSpeed: number; // 1x, 2x, 5x, 10x
  pointPresets?: string[]; // Rally safety and custom point preset names
}

export type ActiveTab = 'activity' | 'history' | 'maps' | 'profile';

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface UserProfile {
  name: string;
  role: UserRole;
  adminPin: string; // PIN for unlocking Admin permissions (default "1234")
  isAdminUnlocked: boolean;
  defaultAllowPublicEdit: boolean; // When sharing, allow others to edit splits/notes
  teamName: string;
}

export interface SharedCloudTrack {
  id: string; // Firestore document ID
  shareCode: string; // e.g. "RLY-842"
  title: string;
  ownerUid: string;
  ownerName: string;
  allowPublicEdit: boolean; // true = anyone with code can edit; false = only admin/owner can edit
  sessionData: ActivitySession;
  createdAt: string;
  updatedAt: string;
}

