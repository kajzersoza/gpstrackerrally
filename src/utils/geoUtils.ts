import { Coordinate, Split } from '../types';

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
