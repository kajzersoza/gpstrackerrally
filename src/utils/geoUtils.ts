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
  nextSplit: {
    split: Split;
    index: number;
    total: number;
    name: string;
    distanceKm: number;
    distanceMeters: number;
    formattedRelative: string; // e.g. "-352 m"
    bearingDeg: number;
    bearingCompass: string;
    isReached: boolean;
  } | null;
  splitsProgress: Array<{
    split: Split;
    distanceMeters: number;
    formattedDistance: string;
    formattedRelative: string;
    isReached: boolean;
    bearingCompass: string;
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
 * Calculates dynamic metrics relative to a loaded reference track
 */
export function calculateReferenceMetrics(
  currentLoc: Coordinate | null,
  referenceSession: ActivitySession,
  unit: 'km' | 'm' | 'mi' = 'm'
): ReferenceTrackMetrics | null {
  const coords = referenceSession.coordinates;
  if (!coords || coords.length === 0) return null;

  const startCoord = coords[0];
  const endCoord = coords[coords.length - 1];

  const activePos = currentLoc || startCoord;

  // Distance from reference Start
  const distFromStartKm = calculateDistance(startCoord.lat, startCoord.lng, activePos.lat, activePos.lng);
  const distFromStartMeters = Math.round(distFromStartKm * 1000);
  const formattedStartObj = formatDistanceByUnit(distFromStartKm, unit);
  const formattedDistanceFromStart = `+${formattedStartObj.value} ${formattedStartObj.unitLabel}`;

  // Distance to reference End/Stop
  const distToEndKm = calculateDistance(activePos.lat, activePos.lng, endCoord.lat, endCoord.lng);
  const distToEndMeters = Math.round(distToEndKm * 1000);
  const formattedEndObj = formatDistanceByUnit(distToEndKm, unit);
  const formattedDistanceToEnd = `-${formattedEndObj.value} ${formattedEndObj.unitLabel}`;

  // Find closest coordinate along the reference path
  let minDistanceToPath = Infinity;
  let closestCoord: Coordinate = coords[0];
  let closestIndex = 0;

  for (let i = 0; i < coords.length; i++) {
    const d = calculateDistance(activePos.lat, activePos.lng, coords[i].lat, coords[i].lng);
    if (d < minDistanceToPath) {
      minDistanceToPath = d;
      closestCoord = coords[i];
      closestIndex = i;
    }
  }

  const crossTrackDistanceMeters = Math.round(minDistanceToPath * 1000);
  const progressPercent = Math.min(100, Math.max(0, Math.round((closestIndex / Math.max(1, coords.length - 1)) * 100)));

  // Calculate splits progress using the full sequence including Start and Stop
  const sortedSplits = getFullSessionSplits(referenceSession);

  const PROXIMITY_THRESHOLD_METERS = 35; // within 35 meters is considered reached
  let nextSplitObj: ReferenceTrackMetrics['nextSplit'] = null;

  const splitsProgress = sortedSplits.map((split, idx) => {
    let splitCoord = split.coordinate;
    if (!splitCoord) {
      // Find approximate coordinate from reference track coordinates
      const fraction = (idx + 1) / Math.max(1, sortedSplits.length);
      const cIdx = Math.min(coords.length - 1, Math.floor(fraction * (coords.length - 1)));
      splitCoord = coords[cIdx];
    }

    const distKm = splitCoord
      ? calculateDistance(activePos.lat, activePos.lng, splitCoord.lat, splitCoord.lng)
      : 0;
    const distMeters = Math.round(distKm * 1000);
    const bearingDeg = splitCoord ? calculateBearing(activePos.lat, activePos.lng, splitCoord.lat, splitCoord.lng) : 0;
    const bearingCompass = getCompassDirection(bearingDeg);

    // Is it reached? If user is past this split's position or within threshold
    const isReached = distMeters <= PROXIMITY_THRESHOLD_METERS;

    // Formatting for display: e.g. "-352 m" if not reached
    const relObj = formatDistanceByUnit(distKm, unit);
    const formattedRelative = isReached ? '✓ Érintve' : `-${relObj.value} ${relObj.unitLabel}`;

    return {
      split,
      distanceMeters: distMeters,
      formattedDistance: `${relObj.value} ${relObj.unitLabel}`,
      formattedRelative,
      isReached,
      bearingCompass,
    };
  });

  // Identify next unreached split
  const firstUnreached = splitsProgress.find((sp) => !sp.isReached);
  if (firstUnreached) {
    const split = firstUnreached.split;
    const splitCoord = split.coordinate || closestCoord;
    const distKm = calculateDistance(activePos.lat, activePos.lng, splitCoord.lat, splitCoord.lng);
    const distMeters = Math.round(distKm * 1000);
    const bearingDeg = calculateBearing(activePos.lat, activePos.lng, splitCoord.lat, splitCoord.lng);
    const bearingCompass = getCompassDirection(bearingDeg);
    const relObj = formatDistanceByUnit(distKm, unit);

    nextSplitObj = {
      split,
      index: split.splitIndex || (sortedSplits.indexOf(split) + 1),
      total: sortedSplits.length,
      name: split.name || `#${split.formattedIndex || split.splitIndex}`,
      distanceKm: distKm,
      distanceMeters: distMeters,
      formattedRelative: `-${relObj.value} ${relObj.unitLabel}`,
      bearingDeg,
      bearingCompass,
      isReached: false,
    };
  }

  return {
    distanceFromStartKm: distFromStartKm,
    distanceFromStartMeters: distFromStartMeters,
    formattedDistanceFromStart,
    distanceToEndKm: distToEndKm,
    distanceToEndMeters: distToEndMeters,
    formattedDistanceToEnd,
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
