import { Coordinate, Split, ActivitySession } from '../types';

/**
 * Calculates Haversine distance between two points in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Formats a coordinate into DMS (Degrees, Minutes, Seconds) format
 * e.g., 37°46'39.1"N  122°24'59.0"W
 */
export function formatDMS(lat: number, lng: number): { latDms: string; lngDms: string; fullDms: string } {
  const formatComponent = (val: number, isLat: boolean) => {
    const direction = isLat ? (val >= 0 ? 'N' : 'S') : val >= 0 ? 'E' : 'W';
    const absolute = Math.abs(val);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);

    return `${degrees}°${minutes.toString().padStart(2, '0')}'${seconds.padStart(4, '0')}"${direction}`;
  };

  const latDms = formatComponent(lat, true);
  const lngDms = formatComponent(lng, false);

  return {
    latDms,
    lngDms,
    fullDms: `${latDms} ${lngDms}`,
  };
}

/**
 * Formats elapsed seconds into HH:MM:SS
 * e.g., 3252 -> "00:54:12"
 */
export function formatElapsedTime(totalSec: number): string {
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = Math.floor(totalSec % 60);

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
}

/**
 * Formats seconds into MM:SS
 * e.g., 312 -> "05:12"
 */
export function formatSplitDuration(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = Math.floor(totalSec % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Formats timestamp into HH:mm clock time
 * e.g., 14:30
 */
export function formatClockTime(timestamp: number | Date): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Calculates pace difference and trend against the previous split
 */
export function calculateSplitTrend(
  currentPaceSec: number,
  previousPaceSec?: number
): { formattedDiff: string; trend: 'up' | 'down' | 'same' } {
  if (previousPaceSec === undefined || previousPaceSec === 0) {
    return { formattedDiff: '+0:00', trend: 'same' };
  }

  const diffSec = currentPaceSec - previousPaceSec;
  const isSlower = diffSec > 0; // + pace means took longer (trend up icon in screenshot)
  const isFaster = diffSec < 0; // - pace means faster (trend down icon in screenshot)

  const absDiff = Math.abs(Math.round(diffSec));
  const diffMin = Math.floor(absDiff / 60);
  const diffSecRemaining = absDiff % 60;
  const formattedTime = `${diffMin}:${diffSecRemaining.toString().padStart(2, '0')}`;

  if (isSlower) {
    return {
      formattedDiff: `+${formattedTime}`,
      trend: 'up',
    };
  } else if (isFaster) {
    return {
      formattedDiff: `-${formattedTime}`,
      trend: 'down',
    };
  } else {
    return {
      formattedDiff: `±0:00`,
      trend: 'same',
    };
  }
}

/**
 * Generates initial initial demo/reference coordinates matching San Francisco route (from screenshot)
 */
export const SAN_FRANCISCO_BASE: [number, number] = [37.777528, -122.416389];

export function getInitialDemoPath(): Coordinate[] {
  // Generate a realistic path around San Francisco
  const now = Date.now();
  const baseLat = 37.7775;
  const baseLng = -122.4164;
  
  const path: Coordinate[] = [];
  const waypoints = [
    [37.7775, -122.4164],
    [37.7801, -122.4128],
    [37.7850, -122.4080],
    [37.7910, -122.4030],
    [37.7980, -122.4090],
    [37.8020, -122.4140],
    [37.8050, -122.4200],
    [37.8010, -122.4280],
    [37.7940, -122.4330],
    [37.7880, -122.4310],
    [37.7810, -122.4250],
    [37.7775, -122.4164],
  ];

  for (let i = 0; i < waypoints.length; i++) {
    path.push({
      lat: waypoints[i][0],
      lng: waypoints[i][1],
      altitude: 15 + Math.sin(i) * 10,
      speed: 3.2,
      accuracy: 5,
      timestamp: now - (waypoints.length - i) * 60000,
    });
  }

  return path;
}

/**
 * Generate sample splits matching the user screenshot for demo/initial view
 */
export function getInitialDemoSplits(): Split[] {
  return [
    {
      id: 'split-4',
      splitIndex: 4,
      formattedIndex: '04',
      distanceKm: 1.0,
      formattedDistance: '1.0 km',
      timeSec: 312, // 5:12
      formattedTime: '05:12',
      paceSecPerKm: 312,
      paceDiffSec: 14,
      formattedDiff: '+0:14',
      trend: 'up',
      totalDistanceKm: 4.0,
      totalTimeSec: 1215,
      timestamp: Date.now() - 300000,
    },
    {
      id: 'split-3',
      splitIndex: 3,
      formattedIndex: '03',
      distanceKm: 1.0,
      formattedDistance: '1.0 km',
      timeSec: 298, // 4:58
      formattedTime: '04:58',
      paceSecPerKm: 298,
      paceDiffSec: -2,
      formattedDiff: '-0:02',
      trend: 'down',
      totalDistanceKm: 3.0,
      totalTimeSec: 903,
      timestamp: Date.now() - 612000,
    },
    {
      id: 'split-2',
      splitIndex: 2,
      formattedIndex: '02',
      distanceKm: 1.0,
      formattedDistance: '1.0 km',
      timeSec: 300, // 5:00
      formattedTime: '05:00',
      paceSecPerKm: 300,
      paceDiffSec: -8,
      formattedDiff: '-0:08',
      trend: 'down',
      totalDistanceKm: 2.0,
      totalTimeSec: 605,
      timestamp: Date.now() - 910000,
    },
    {
      id: 'split-1',
      splitIndex: 1,
      formattedIndex: '01',
      distanceKm: 1.0,
      formattedDistance: '1.0 km',
      timeSec: 308, // 5:08
      formattedTime: '05:08',
      paceSecPerKm: 308,
      paceDiffSec: 0,
      formattedDiff: '+0:00',
      trend: 'same',
      totalDistanceKm: 1.0,
      totalTimeSec: 308,
      timestamp: Date.now() - 1218000,
    },
  ];
}

/**
 * Compute the reliable cumulative distance from start point to this split
 */
export function getCumulativeDistanceForSplit(split: Split, allSplits: Split[]): number {
  if (typeof split.totalDistanceKm === 'number' && split.totalDistanceKm > 0) {
    return split.totalDistanceKm;
  }
  // Fallback calculation: sum distances of all splits up to this splitIndex
  const sorted = [...allSplits].sort((a, b) => a.splitIndex - b.splitIndex);
  let sum = 0;
  for (const s of sorted) {
    sum += s.distanceKm || 0;
    if (s.id === split.id || s.splitIndex === split.splitIndex) {
      break;
    }
  }
  return sum > 0 ? +sum.toFixed(3) : split.distanceKm || 0;
}

/**
 * Format distance according to unit: km, m, or mi
 */
export function formatDistanceByUnit(
  distanceKm: number,
  unit: 'km' | 'm' | 'mi'
): { value: string; unitLabel: string } {
  if (unit === 'm') {
    const meters = Math.round(distanceKm * 1000);
    return {
      value: meters.toLocaleString('hu-HU').replace(/,/g, ' '),
      unitLabel: 'm',
    };
  } else if (unit === 'mi') {
    return {
      value: (distanceKm * 0.621371).toFixed(2),
      unitLabel: 'mi',
    };
  } else {
    return {
      value: distanceKm.toFixed(2),
      unitLabel: 'km',
    };
  }
}

/**
 * Detailed coordinate multi-format representations
 */
export function getDetailedCoordinates(lat: number, lng: number) {
  // DMS
  const dms = formatDMS(lat, lng);

  // Decimal Degrees
  const dd = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

  // Degree Decimal Minutes (DDM)
  const formatDDM = (val: number, isLat: boolean) => {
    const dir = isLat ? (val >= 0 ? 'N' : 'S') : val >= 0 ? 'E' : 'W';
    const abs = Math.abs(val);
    const deg = Math.floor(abs);
    const min = ((abs - deg) * 60).toFixed(4);
    return `${deg}° ${min}' ${dir}`;
  };
  const ddm = `${formatDDM(lat, true)}, ${formatDDM(lng, false)}`;

  // UTM approximation
  const zone = Math.floor((lng + 180) / 6) + 1;
  const latBand = lat >= 0 ? 'N' : 'S';
  const utmEst = `Zóna ${zone}${latBand} (${lat >= 0 ? 'Északi' : 'Déli'} félteke)`;

  // Web Map URLs
  const googleMapsUrl = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lng.toFixed(6)}#map=17/${lat.toFixed(6)}/${lng.toFixed(6)}`;
  const geoUri = `geo:${lat.toFixed(6)},${lng.toFixed(6)}`;

  return {
    dms: dms.fullDms,
    latDms: dms.latDms,
    lngDms: dms.lngDms,
    dd,
    ddm,
    utm: utmEst,
    googleMapsUrl,
    osmUrl,
    geoUri,
  };
}

/**
 * Exports coordinates to GPX XML file format
 */
export function exportToGPX(
  activityTitle: string,
  coordinates: Coordinate[],
  startTime: number
): string {
  const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GPS TRACKER PWA" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(activityTitle)}</name>
    <time>${new Date(startTime).toISOString()}</time>
  </metadata>
  <trk>
    <name>${escapeXml(activityTitle)}</name>
    <trkseg>`;

  const trkpts = coordinates
    .map(
      (c) => `      <trkpt lat="${c.lat.toFixed(6)}" lon="${c.lng.toFixed(6)}">
        <ele>${(c.altitude || 0).toFixed(1)}</ele>
        <time>${new Date(c.timestamp).toISOString()}</time>
      </trkpt>`
    )
    .join('\n');

  const gpxFooter = `
    </trkseg>
  </trk>
</gpx>`;

  return `${gpxHeader}\n${trkpts}${gpxFooter}`;
}

/**
 * Calculates initial bearing from point 1 to point 2 in degrees (0..360)
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const lat1Rad = lat1 * (Math.PI / 180);
  const lat2Rad = lat2 * (Math.PI / 180);

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  const brng = Math.atan2(y, x);
  return ((brng * 180 / Math.PI) + 360) % 360;
}

/**
 * Converts degrees into 16-point Hungarian compass direction label
 */
export function getCompassDirection(bearingDeg: number): string {
  const directions = ['É', 'ÉÉK', 'ÉK', 'KÉK', 'K', 'KDK', 'DK', 'DDK', 'D', 'DDNY', 'DNY', 'NYDNY', 'NY', 'NYÉNY', 'ÉNY', 'ÉÉNY'];
  const index = Math.round(bearingDeg / 22.5) % 16;
  return directions[index] || 'É';
}

export interface ReferenceTrackMetrics {
  distanceFromStartKm: number;
  distanceFromStartMeters: number;
  formattedDistanceFromStart: string; // e.g. "+1.25 km" or "+1 250 m"
  distanceToEndKm: number;
  distanceToEndMeters: number;
  formattedDistanceToEnd: string; // e.g. "-3.42 km" or "-3 420 m"
  userTrackDistKm: number;
  totalTrackKm: number;
  isOnTrack: boolean; // within ~100m corridor of the track
  activeSplitIndex: number; // 0-based index of current active / upcoming split
  nextSplit: {
    split: Split;
    index: number;
    total: number;
    name: string;
    distanceKm: number;
    distanceMeters: number;
    formattedRelative: string; // e.g. "-352 m" or "+120 m"
    bearingDeg: number;
    bearingCompass: string;
    isReached: boolean;
    isPassed: boolean;
  } | null;
  splitsProgress: Array<{
    split: Split;
    distanceMeters: number;
    absDistanceMeters: number;
    directDistanceMeters: number;
    formattedDistance: string;
    formattedRelative: string;
    isReached: boolean;
    isPassed: boolean;
    bearingCompass: string;
    alongTrackDistKm: number;
  }>;
  closestCoordinate: Coordinate | null;
  crossTrackDistanceMeters: number;
  progressPercent: number;
}

/**
 * Constructs the complete array of waypoints for a session,
 * explicitly including the START (Indulási pont / Kezdőpont) and STOP / CÉL (Végpont / Cél)
 * alongside any recorded intermediate splits.
 */
export function getFullSessionSplits(session: ActivitySession): Split[] {
  const coords = session.coordinates || [];
  const rawSplits = session.splits || [];

  if (coords.length === 0 && rawSplits.length === 0) {
    return [];
  }

  const result: Split[] = [];

  // Check if a start split already exists
  const hasExistingStart = rawSplits.some(
    (s) => s.id.startsWith('start') || s.splitIndex === 0 || s.name?.toLowerCase().includes('start')
  );

  if (!hasExistingStart && coords.length > 0) {
    const startCoord = coords[0];
    const startTimeFormatted =
      session.formattedStartTime || (session.startTime ? formatClockTime(session.startTime) : '00:00');
    result.push({
      id: `start-${session.id}`,
      splitIndex: 0,
      formattedIndex: 'START',
      name: '🚩 START (Kezdőpont)',
      distanceKm: 0,
      formattedDistance: '0.00 km',
      timeSec: 0,
      formattedTime: startTimeFormatted,
      paceSecPerKm: 0,
      totalDistanceKm: 0,
      totalTimeSec: 0,
      timestamp: session.startTime || Date.now(),
      coordinate: startCoord,
      notes: 'Automatikusan rögzített kezdőpont / Indulási koordináta',
    });
  }

  // Add all intermediate splits sorted by splitIndex / timestamp
  const sortedSplits = [...rawSplits].sort((a, b) => {
    if (a.splitIndex !== b.splitIndex) return a.splitIndex - b.splitIndex;
    return a.timestamp - b.timestamp;
  });

  sortedSplits.forEach((s) => {
    // If it's already a start or stop, avoid duplication
    if (result.some((existing) => existing.id === s.id)) return;
    result.push(s);
  });

  // Check if a stop/finish split already exists
  const hasExistingStop = result.some(
    (s) =>
      s.id.startsWith('stop') ||
      s.formattedIndex === 'CÉL' ||
      s.name?.toLowerCase().includes('cél') ||
      s.name?.toLowerCase().includes('stop')
  );

  if (!hasExistingStop && coords.length > 1) {
    const endCoord = coords[coords.length - 1];
    const endTime =
      session.endTime ||
      (session.startTime ? session.startTime + session.totalDurationSec * 1000 : Date.now());
    const endTimeFormatted = formatClockTime(endTime);
    result.push({
      id: `stop-${session.id}`,
      splitIndex: result.length + 1,
      formattedIndex: 'CÉL',
      name: '🏁 STOP (Cél / Végpont)',
      distanceKm: session.totalDistanceKm,
      formattedDistance: `${session.totalDistanceKm.toFixed(2)} km`,
      timeSec: session.totalDurationSec,
      formattedTime: endTimeFormatted,
      paceSecPerKm: session.avgPaceSecPerKm,
      totalDistanceKm: session.totalDistanceKm,
      totalTimeSec: session.totalDurationSec,
      timestamp: endTime,
      coordinate: endCoord,
      notes: 'Automatikusan rögzített célvonal / Befejezési koordináta',
    });
  }

  return result;
}

/**
 * Projects a coordinate onto the continuous polyline formed by all points of a track log.
 * Computes the exact closest point on any segment of the entire log, the perpendicular distance,
 * and the cumulative along-track distance from the log's start.
 */
export function projectPointOntoPolyline(
  point: Coordinate,
  coords: Coordinate[],
  cumDist: number[]
): {
  closestPoint: Coordinate;
  alongTrackDistKm: number;
  crossTrackDistanceKm: number;
  segmentIndex: number;
} {
  if (coords.length === 0) {
    return {
      closestPoint: point,
      alongTrackDistKm: 0,
      crossTrackDistanceKm: 0,
      segmentIndex: 0,
    };
  }

  if (coords.length === 1) {
    const d = calculateDistance(point.lat, point.lng, coords[0].lat, coords[0].lng);
    return {
      closestPoint: coords[0],
      alongTrackDistKm: 0,
      crossTrackDistanceKm: d,
      segmentIndex: 0,
    };
  }

  let minCrossTrackKm = Infinity;
  let bestPoint: Coordinate = coords[0];
  let bestAlongTrackKm = 0;
  let bestSegmentIndex = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const segDistKm = Math.max(0, cumDist[i + 1] - cumDist[i]);

    if (segDistKm < 0.000001) {
      const d = calculateDistance(point.lat, point.lng, p1.lat, p1.lng);
      if (d < minCrossTrackKm) {
        minCrossTrackKm = d;
        bestPoint = p1;
        bestAlongTrackKm = cumDist[i];
        bestSegmentIndex = i;
      }
      continue;
    }

    const midLatRad = deg2rad((p1.lat + p2.lat) / 2);
    const cosLat = Math.cos(midLatRad);

    const dx = (p2.lng - p1.lng) * cosLat;
    const dy = p2.lat - p1.lat;
    const segLenSq = dx * dx + dy * dy;

    let u = 0;
    if (segLenSq > 0) {
      u = ((point.lng - p1.lng) * cosLat * dx + (point.lat - p1.lat) * dy) / segLenSq;
    }
    const uClamped = Math.max(0, Math.min(1, u));

    const projLat = p1.lat + uClamped * (p2.lat - p1.lat);
    const projLng = p1.lng + uClamped * (p2.lng - p1.lng);

    const d = calculateDistance(point.lat, point.lng, projLat, projLng);
    if (d < minCrossTrackKm) {
      minCrossTrackKm = d;
      bestPoint = {
        lat: projLat,
        lng: projLng,
        timestamp: p1.timestamp ?? Date.now(),
        altitude:
          p1.altitude !== undefined && p2.altitude !== undefined
            ? p1.altitude + uClamped * (p2.altitude - p1.altitude)
            : p1.altitude,
      };
      bestAlongTrackKm = cumDist[i] + uClamped * segDistKm;
      bestSegmentIndex = i;
    }
  }

  return {
    closestPoint: bestPoint,
    alongTrackDistKm: bestAlongTrackKm,
    crossTrackDistanceKm: minCrossTrackKm,
    segmentIndex: bestSegmentIndex,
  };
}

/**
 * Calculates dynamic metrics relative to a loaded reference track.
 * Compares the user's GPS signal to any point of the entire logged route path,
 * computing continuous along-track distances, +/- relative distances to all points,
 * and next upcoming checkpoints.
 *
 * Signs:
 *  "-" when approaching an upcoming point along the route (remaining distance)
 *  "+" after passing a point along the route (elapsed distance since the point)
 */
export function calculateReferenceMetrics(
  currentLoc: Coordinate | null,
  referenceSession: ActivitySession,
  unit: 'km' | 'm' | 'mi' = 'm'
): ReferenceTrackMetrics | null {
  const coords = referenceSession.coordinates;
  if (!coords || coords.length === 0) return null;

  const activePos = currentLoc || coords[0];

  // 1. Precalculate cumulative path distances along the entire continuous logged track
  const cumDist: number[] = new Array(coords.length);
  cumDist[0] = 0;
  for (let i = 1; i < coords.length; i++) {
    cumDist[i] = cumDist[i - 1] + calculateDistance(coords[i - 1].lat, coords[i - 1].lng, coords[i].lat, coords[i].lng);
  }
  const totalTrackKm = cumDist[coords.length - 1] || referenceSession.totalDistanceKm || 0;

  // 2. Find the user's exact closest projection onto ANY point/segment of the entire continuous route log
  const userProjection = projectPointOntoPolyline(activePos, coords, cumDist);
  const userTrackDistKm = userProjection.alongTrackDistKm;
  const closestCoord = userProjection.closestPoint;
  const crossTrackDistanceMeters = Math.round(userProjection.crossTrackDistanceKm * 1000);
  const isOnTrack = crossTrackDistanceMeters <= 100; // within ~100m corridor

  // 3. Elapsed distance along track from Start (+) and Remaining to End (-)
  const distanceFromStartKm = userTrackDistKm;
  const distFromStartMeters = Math.round(distanceFromStartKm * 1000);
  const formattedStartObj = formatDistanceByUnit(distanceFromStartKm, unit);
  const formattedDistanceFromStart = `+${formattedStartObj.value} ${formattedStartObj.unitLabel}`;

  const distanceToEndKm = Math.max(0, totalTrackKm - userTrackDistKm);
  const distToEndMeters = Math.round(distanceToEndKm * 1000);
  const formattedEndObj = formatDistanceByUnit(distanceToEndKm, unit);
  const formattedDistanceToEnd = `-${formattedEndObj.value} ${formattedEndObj.unitLabel}`;

  const progressPercent = totalTrackKm > 0
    ? Math.min(100, Math.max(0, Math.round((userTrackDistKm / totalTrackKm) * 100)))
    : 0;

  // 4. Calculate full checkpoints sequence (Start, intermediate splits/waypoints, Stop)
  const sortedSplits = getFullSessionSplits(referenceSession);

  // Map each split to its precise along-track distance along the continuous log
  const splitsProgress = sortedSplits.map((split, idx) => {
    let alongTrackDistKm = 0;
    const isStart = split.id.startsWith('start') || split.splitIndex === 0 || split.formattedIndex === 'START';
    const isStop = split.id.startsWith('stop') || split.formattedIndex === 'CÉL';

    if (isStart) {
      alongTrackDistKm = 0;
    } else if (isStop) {
      alongTrackDistKm = totalTrackKm;
    } else if (split.coordinate) {
      // Project the split coordinate onto the continuous polyline of the track log
      const splitProj = projectPointOntoPolyline(split.coordinate, coords, cumDist);
      alongTrackDistKm = splitProj.alongTrackDistKm;
    } else if (typeof split.totalDistanceKm === 'number' && split.totalDistanceKm > 0 && split.totalDistanceKm <= totalTrackKm * 1.05) {
      alongTrackDistKm = split.totalDistanceKm;
    } else {
      const frac = (idx + 1) / Math.max(1, sortedSplits.length);
      const cIdx = Math.min(coords.length - 1, Math.floor(frac * (coords.length - 1)));
      alongTrackDistKm = cumDist[cIdx];
    }

    // Relative difference along the track:
    // diffKm > 0: user is before this split (approaching along track) -> "-"
    // diffKm < 0: user has passed this split (passed/left along track) -> "+"
    const diffKm = alongTrackDistKm - userTrackDistKm;
    const diffMeters = Math.round(diffKm * 1000);
    const absDiffKm = Math.abs(diffKm);
    const absDiffMeters = Math.abs(diffMeters);

    const isPassed = diffKm < -0.015; // passed by more than 15 meters along the continuous track
    const isApproaching = diffKm > 0.015; // approaching by more than 15 meters
    const isAtPoint = absDiffMeters <= 15;

    const formattedObj = formatDistanceByUnit(absDiffKm, unit);
    let formattedRelative = '';
    if (isApproaching) {
      // Közeledünk a ponthoz az útvonal mentén -> "-"
      formattedRelative = `-${formattedObj.value} ${formattedObj.unitLabel}`;
    } else if (isPassed) {
      // Elhagytuk a pontot az útvonal mentén -> "+"
      formattedRelative = `+${formattedObj.value} ${formattedObj.unitLabel}`;
    } else {
      // Pontosan a pontnál vagyunk
      formattedRelative = `0 ${formattedObj.unitLabel}`;
    }

    const splitCoord = split.coordinate || (coords.length > 0 ? coords[0] : activePos);
    const bearingDeg = splitCoord ? calculateBearing(activePos.lat, activePos.lng, splitCoord.lat, splitCoord.lng) : 0;
    const bearingCompass = getCompassDirection(bearingDeg);

    const directDistKm = splitCoord
      ? calculateDistance(activePos.lat, activePos.lng, splitCoord.lat, splitCoord.lng)
      : absDiffKm;
    const directDistanceMeters = Math.round(directDistKm * 1000);

    return {
      split,
      distanceMeters: diffMeters,
      absDistanceMeters: absDiffMeters,
      directDistanceMeters,
      formattedDistance: `${formattedObj.value} ${formattedObj.unitLabel}`,
      formattedRelative,
      isReached: isPassed || isAtPoint,
      isPassed,
      bearingCompass,
      alongTrackDistKm,
    };
  });

  // Find the NEXT upcoming split along the track path in sequential forward order
  // "mindegy melyikhez vagyok közelebb a következőt mutassa"
  let upcomingIndex = -1;

  for (let i = 0; i < splitsProgress.length; i++) {
    const sp = splitsProgress[i];
    const isStartPoint = sp.split.id.startsWith('start') || sp.split.splitIndex === 0 || sp.split.formattedIndex === 'START';

    // If it's the START point and user has already started progressing along the track (> 20 meters), advance to the next split
    if (isStartPoint && (sp.isPassed || userTrackDistKm > 0.020)) {
      continue;
    }

    // The first point along the route that hasn't been passed yet is the NEXT upcoming checkpoint
    if (!sp.isPassed) {
      upcomingIndex = i;
      break;
    }
  }

  // If all checkpoints have been passed, target the last point (CÉL / STOP)
  if (upcomingIndex === -1) {
    upcomingIndex = Math.max(0, splitsProgress.length - 1);
  }

  const activeSplitIndex = Math.max(0, upcomingIndex);

  const activeSp = splitsProgress[activeSplitIndex];
  let nextSplitObj: ReferenceTrackMetrics['nextSplit'] = null;

  if (activeSp) {
    const split = activeSp.split;
    const splitCoord = split.coordinate || closestCoord;
    const bearingDeg = splitCoord ? calculateBearing(activePos.lat, activePos.lng, splitCoord.lat, splitCoord.lng) : 0;
    const bearingCompass = getCompassDirection(bearingDeg);

    nextSplitObj = {
      split,
      index: split.splitIndex || (activeSplitIndex + 1),
      total: sortedSplits.length,
      name: split.name || (split.id.startsWith('start') ? 'START' : split.id.startsWith('stop') ? 'CÉL' : `#${split.formattedIndex || activeSplitIndex}`),
      distanceKm: activeSp.absDistanceMeters / 1000,
      distanceMeters: activeSp.absDistanceMeters,
      formattedRelative: activeSp.formattedRelative,
      bearingDeg,
      bearingCompass,
      isReached: activeSp.isReached,
      isPassed: activeSp.isPassed,
    };
  }

  return {
    distanceFromStartKm,
    distanceFromStartMeters: distFromStartMeters,
    formattedDistanceFromStart,
    distanceToEndKm,
    distanceToEndMeters: distToEndMeters,
    formattedDistanceToEnd,
    userTrackDistKm,
    totalTrackKm,
    isOnTrack,
    activeSplitIndex,
    nextSplit: nextSplitObj,
    splitsProgress,
    closestCoordinate: closestCoord,
    crossTrackDistanceMeters,
    progressPercent,
  };
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}
