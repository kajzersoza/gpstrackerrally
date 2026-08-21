import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Coordinate,
  Split,
  ActivitySession,
  TrackingStatus,
  UserSettings,
  ActiveTab,
  ActivityMode,
  UserProfile,
  SharedCloudTrack,
} from './types';
import {
  calculateDistance,
  calculateSplitTrend,
  formatSplitDuration,
  formatClockTime,
  getInitialDemoPath,
  getInitialDemoSplits,
  exportToGPX,
  SAN_FRANCISCO_BASE,
} from './utils/geoUtils';
import { playBeep, triggerHaptic } from './utils/soundUtils';
import { ActivityView } from './components/ActivityView';
import { HistoryView } from './components/HistoryView';
import { MapsView } from './components/MapsView';
import { ProfileView } from './components/ProfileView';
import { BottomNav } from './components/BottomNav';
import { SettingsModal } from './components/SettingsModal';
import { MenuDrawer } from './components/MenuDrawer';
import { CoordinateModal } from './components/CoordinateModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { loadTrackByCode } from './services/cloudTrackService';
import { DEFAULT_RALLY_PRESETS } from './constants/rallyPresets';

const STORAGE_KEY_SESSIONS = 'gps_tracker_sessions_v1';
const STORAGE_KEY_SETTINGS = 'gps_tracker_settings_v1';
const STORAGE_KEY_PROFILE = 'gps_tracker_profile_v1';

const DEFAULT_PROFILE: UserProfile = {
  name: 'Rally Admin',
  role: 'admin',
  adminPin: '1234',
  isAdminUnlocked: true,
  defaultAllowPublicEdit: true,
  teamName: 'Rally Csapat',
};

const DEFAULT_SETTINGS: UserSettings = {
  unit: 'm', // Méter
  activityMode: 'car', // Autó
  autoSplitDistanceKm: 0, // Kézi (0 = automatikus split kikapcsolva)
  highAccuracy: true,
  soundEnabled: true,
  hapticsEnabled: true,
  coordinateFormat: 'dms',
  mapLayer: 'osm',
  simulationMode: false,
  simulationSpeed: 1,
  pointPresets: DEFAULT_RALLY_PRESETS,
};

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>('activity');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isCoordinateModalOpen, setIsCoordinateModalOpen] = useState<boolean>(false);

  // Settings
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          pointPresets: parsed.pointPresets && parsed.pointPresets.length > 0 ? parsed.pointPresets : DEFAULT_RALLY_PRESETS,
        };
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Saved History Sessions - default empty (no sample loaded on fresh launch)
  const [savedSessions, setSavedSessions] = useState<ActivitySession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SESSIONS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return [];
  });

  // User Profile & Admin Permissions
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROFILE);
      if (saved) {
        return { ...DEFAULT_PROFILE, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_PROFILE;
  });

  // Loaded Track / Reference Track state (from History or Cloud)
  const [loadedSession, setLoadedSession] = useState<ActivitySession | null>(null);

  const handleLoadSessionForTracking = (session: ActivitySession) => {
    setLoadedSession(session);
    setActiveTab('activity');
  };

  const handleUnloadSession = () => {
    setLoadedSession(null);
  };

  const handleUpdateProfile = (newProfile: Partial<UserProfile>) => {
    setUserProfile((prev) => {
      const updated = { ...prev, ...newProfile };
      try {
        localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  // Cloud Sync Modal state
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState<boolean>(false);
  const [sessionToShare, setSessionToShare] = useState<ActivitySession | null>(null);

  const handleOpenCloudShare = (session: ActivitySession) => {
    setSessionToShare(session);
    setIsCloudSyncOpen(true);
  };

  const handleOpenCloudLoad = () => {
    setSessionToShare(null);
    setIsCloudSyncOpen(true);
  };

  const handleTrackLoadedFromCloud = (cloudTrack: SharedCloudTrack) => {
    // Add loaded track to saved sessions if not already present
    setSavedSessions((prev) => {
      const exists = prev.some((s) => s.id === cloudTrack.sessionData.id);
      let updatedList;
      if (exists) {
        updatedList = prev.map((s) => (s.id === cloudTrack.sessionData.id ? cloudTrack.sessionData : s));
      } else {
        updatedList = [cloudTrack.sessionData, ...prev];
      }
      try {
        localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(updatedList));
      } catch {
        // ignore
      }
      return updatedList;
    });
    setActiveTab('history');
  };

  // Check URL query parameter ?track=CODE on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const trackCode = params.get('track');
    if (trackCode) {
      loadTrackByCode(trackCode)
        .then((cloudTrack) => {
          if (cloudTrack) {
            handleTrackLoadedFromCloud(cloudTrack);
            // clean up URL param without reload
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        })
        .catch((err) => console.warn('Could not auto-load track from URL parameter:', err));
    }
  }, []);

  // Tracking State - starts clean at 0
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [totalDistanceKm, setTotalDistanceKm] = useState<number>(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [coordinates, setCoordinates] = useState<Coordinate[]>([]);
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [splits, setSplits] = useState<Split[]>([]);
  const [currentSplitDistanceKm, setCurrentSplitDistanceKm] = useState<number>(0);
  const [currentSplitTimeSec, setCurrentSplitTimeSec] = useState<number>(0);

  // Refs for tracking and simulation
  const watchIdRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocationRef = useRef<Coordinate | null>(currentLocation);
  const splitsRef = useRef<Split[]>(splits);
  const currentSplitDistRef = useRef<number>(currentSplitDistanceKm);
  const currentSplitTimeRef = useRef<number>(currentSplitTimeSec);
  const totalDistRef = useRef<number>(totalDistanceKm);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const lastLogTimestampRef = useRef<number>(0);

  // Dynamic GPS logging configuration based on user activity mode
  // (Autó: 1 mp-enként, Kerékpár: 2.5 mp-enként, Gyalog: 5 mp-enként)
  const getActivityModeConfig = useCallback((mode: ActivityMode) => {
    switch (mode) {
      case 'car':
        return {
          intervalMs: 1000, // 1 second (frequent logging for fast driving)
          minDistanceKm: 0.001, // 1 meter
          maxDistanceKm: 0.8,
          gpsTimeout: 5000,
          simSpeedMultiplier: 4.5,
        };
      case 'cycling':
        return {
          intervalMs: 2500, // 2.5 seconds (balanced interval for cycling)
          minDistanceKm: 0.002, // 2 meters
          maxDistanceKm: 0.3,
          gpsTimeout: 8000,
          simSpeedMultiplier: 2.0,
        };
      case 'walking':
      default:
        return {
          intervalMs: 5000, // 5 seconds (battery-saving and walking GPS jitter filter)
          minDistanceKm: 0.003, // 3 meters
          maxDistanceKm: 0.15,
          gpsTimeout: 12000,
          simSpeedMultiplier: 1.0,
        };
    }
  }, []);

  // Screen Wake Lock API management to prevent phone sleep during workout
  const requestWakeLock = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && navigator.wakeLock) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch {
      // Ignore if unsupported or denied
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch {
      // Ignore
    }
  }, []);

  // Web Worker background timer to ensure continuous tracking even when screen is locked
  useEffect(() => {
    try {
      const blob = new Blob([
        `let timer = null;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            if (timer) clearInterval(timer);
            timer = setInterval(function() {
              self.postMessage('tick');
            }, 1000);
          } else if (e.data === 'stop') {
            if (timer) clearInterval(timer);
            timer = null;
          }
        };`
      ], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);
      worker.onmessage = (e) => {
        if (e.data === 'tick') {
          setElapsedSeconds((prev) => prev + 1);
          setCurrentSplitTimeSec((prev) => prev + 1);
        }
      };
      workerRef.current = worker;
      return () => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
      };
    } catch {
      // Fallback to standard timer if Worker is not permitted
    }
  }, []);

  // Handle visibility change (e.g. screen unlocked)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && trackingStatus === 'running') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [trackingStatus, requestWakeLock]);

  // Keep refs in sync
  useEffect(() => {
    splitsRef.current = splits;
    currentSplitDistRef.current = currentSplitDistanceKm;
    currentSplitTimeRef.current = currentSplitTimeSec;
    totalDistRef.current = totalDistanceKm;
  }, [splits, currentSplitDistanceKm, currentSplitTimeSec, totalDistanceKm]);

  // Persist settings
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  // Persist sessions
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(savedSessions));
    } catch {
      // ignore
    }
  }, [savedSessions]);

  // Request browser GPS on first mount and immediately acquire real GPS coordinates
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator && !settings.simulationMode) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc: Coordinate = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            altitude: pos.coords.altitude,
            speed: pos.coords.speed,
            accuracy: pos.coords.accuracy,
            timestamp: Date.now(),
          };
          setCurrentLocation(loc);
          lastLocationRef.current = loc;
        },
        (err) => {
          console.warn('Geolocation initial query error:', err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, [settings.simulationMode]);

  // Perform a Lap / Split - accurately records the exact distance covered and captures split GPS coordinate
  const handleSplit = useCallback(() => {
    const splitIndex = splitsRef.current.length + 1;
    // Exactly how much distance was covered in this split (no artificial fallback to 1.0)
    const splitDist = Math.max(0, currentSplitDistRef.current);
    const splitSec = Math.max(0, currentSplitTimeRef.current);

    // Calculate pace in seconds per km (if distance is > 0)
    const paceSec = splitDist > 0.001 ? Math.round(splitSec / splitDist) : splitSec;

    // Previous split pace
    const prevSplit = splitsRef.current.length > 0 ? splitsRef.current[0] : undefined;
    const prevPace = prevSplit && prevSplit.distanceKm > 0.001 ? prevSplit.paceSecPerKm : undefined;

    const { formattedDiff, trend } = calculateSplitTrend(paceSec, prevPace);

    // Get current location coordinate for map marker
    const splitLocation = currentLocation || lastLocationRef.current || (coordinates.length > 0 ? coordinates[coordinates.length - 1] : undefined);

    const newSplit: Split = {
      id: `split-${Date.now()}-${splitIndex}`,
      splitIndex,
      formattedIndex: splitIndex.toString().padStart(2, '0'),
      distanceKm: splitDist,
      formattedDistance: `${splitDist.toFixed(2)} km`,
      timeSec: splitSec,
      formattedTime: formatSplitDuration(splitSec),
      paceSecPerKm: paceSec,
      formattedDiff,
      trend,
      totalDistanceKm: totalDistRef.current,
      totalTimeSec: elapsedSeconds,
      timestamp: Date.now(),
      coordinate: splitLocation ? { ...splitLocation } : undefined,
    };

    // Prepend to list so newest split is on top
    setSplits((prev) => [newSplit, ...prev]);

    // Reset current split metrics
    setCurrentSplitDistanceKm(0);
    setCurrentSplitTimeSec(0);
    currentSplitDistRef.current = 0;
    currentSplitTimeRef.current = 0;

    // Audio & Haptic feedback
    if (settings.soundEnabled) playBeep('split');
    if (settings.hapticsEnabled) triggerHaptic([50, 40, 50]);
  }, [elapsedSeconds, settings.soundEnabled, settings.hapticsEnabled, currentLocation, coordinates]);

  // Start Tracking
  const handleStart = () => {
    // If starting fresh from demo or idle
    if (elapsedSeconds === 3252 && totalDistanceKm === 12.45 && trackingStatus === 'idle') {
      // User is starting a new real workout session
      setElapsedSeconds(0);
      setTotalDistanceKm(0);
      setStartTime(Date.now());
      setCoordinates([]);
      setSplits([]);
      setCurrentSplitDistanceKm(0);
      setCurrentSplitTimeSec(0);
      lastLocationRef.current = null;
    } else if (!startTime) {
      setStartTime(Date.now());
    }

    setTrackingStatus('running');
    if (settings.soundEnabled) playBeep('start');
    if (settings.hapticsEnabled) triggerHaptic([60]);

    // Screen wake lock for background/continuous tracking
    requestWakeLock();

    // Start background timer: use worker if available, fallback to single interval (never run both)
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (workerRef.current) {
      workerRef.current.postMessage('start');
    } else {
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
        setCurrentSplitTimeSec((prev) => prev + 1);
      }, 1000);
    }

    // GPS Tracking or Simulation
    if (settings.simulationMode) {
      startSimulation();
    } else {
      startRealGeolocation();
    }
  };

  // Real Geolocation with activity-mode aware interval & filtering
  const startRealGeolocation = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      startSimulation();
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    const modeConfig = getActivityModeConfig(settings.activityMode);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        const newCoord: Coordinate = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          altitude: pos.coords.altitude,
          speed: pos.coords.speed,
          accuracy: pos.coords.accuracy,
          timestamp: now,
        };

        setCurrentLocation(newCoord);

        if (lastLocationRef.current) {
          const timeSinceLastLog = now - lastLogTimestampRef.current;
          const addedDist = calculateDistance(
            lastLocationRef.current.lat,
            lastLocationRef.current.lng,
            newCoord.lat,
            newCoord.lng
          );

          // Dynamic throttle: car logs frequently (every 1s), walking logs every 5s to save battery & avoid jitter
          if (timeSinceLastLog < modeConfig.intervalMs && addedDist < modeConfig.minDistanceKm * 2) {
            return;
          }

          // Track movement if distance >= min distance threshold for mode and realistic GPS speed
          if (addedDist >= modeConfig.minDistanceKm && addedDist < modeConfig.maxDistanceKm) {
            lastLogTimestampRef.current = now;
            setTotalDistanceKm((prev) => +(prev + addedDist).toFixed(3));
            setCurrentSplitDistanceKm((prev) => {
              const updated = +(prev + addedDist).toFixed(3);
              // Auto Split check
              if (
                settings.autoSplitDistanceKm > 0 &&
                updated >= settings.autoSplitDistanceKm
              ) {
                setTimeout(handleSplit, 0);
              }
              return updated;
            });
            setCoordinates((prev) => [...prev, newCoord]);
            lastLocationRef.current = newCoord;
          }
        } else {
          lastLogTimestampRef.current = now;
          lastLocationRef.current = newCoord;
          setCoordinates([newCoord]);
        }
      },
      (err) => {
        console.warn('Geolocation watch error:', err);
        startSimulation();
      },
      {
        enableHighAccuracy: settings.highAccuracy,
        maximumAge: 0,
        timeout: modeConfig.gpsTimeout,
      }
    );
  };

  // GPS Simulation (for indoor testing or demo)
  const startSimulation = () => {
    if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);

    let simLat = lastLocationRef.current?.lat || SAN_FRANCISCO_BASE[0];
    let simLng = lastLocationRef.current?.lng || SAN_FRANCISCO_BASE[1];
    let heading = Math.random() * Math.PI * 2;

    const modeConfig = getActivityModeConfig(settings.activityMode);
    const speedMultiplier = (settings.simulationSpeed || 1) * modeConfig.simSpeedMultiplier;
    const intervalMs = modeConfig.intervalMs;

    simulationIntervalRef.current = setInterval(() => {
      // Step distance scaled to mode frequency & speed
      const stepKm = (0.003 * speedMultiplier) * (intervalMs / 1000);
      heading += (Math.random() - 0.5) * 0.2; // Slight curve turn

      // Coordinate delta
      const dLat = (stepKm / 111) * Math.cos(heading);
      const dLng = (stepKm / (111 * Math.cos((simLat * Math.PI) / 180))) * Math.sin(heading);

      simLat += dLat;
      simLng += dLng;

      const newCoord: Coordinate = {
        lat: simLat,
        lng: simLng,
        altitude: 20 + Math.sin(Date.now() / 5000) * 8,
        speed: 3.5 * speedMultiplier,
        accuracy: 4,
        timestamp: Date.now(),
      };

      setCurrentLocation(newCoord);
      lastLocationRef.current = newCoord;
      setCoordinates((prev) => [...prev, newCoord]);
      setTotalDistanceKm((prev) => +(prev + stepKm).toFixed(3));

      setCurrentSplitDistanceKm((prev) => {
        const nextDist = +(prev + stepKm).toFixed(3);
        if (settings.autoSplitDistanceKm > 0 && nextDist >= settings.autoSplitDistanceKm) {
          setTimeout(handleSplit, 0);
        }
        return nextDist;
      });
    }, intervalMs);
  };

  // Pause Tracking
  const handlePause = () => {
    setTrackingStatus('paused');
    releaseWakeLock();
    if (workerRef.current) workerRef.current.postMessage('stop');
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (settings.soundEnabled) playBeep('click');
  };

  // Resume Tracking
  const handleResume = () => {
    handleStart();
  };

  // Stop Tracking & Save Session
  const handleStop = () => {
    if (settings.soundEnabled) playBeep('stop');
    if (settings.hapticsEnabled) triggerHaptic([100, 50, 100]);

    releaseWakeLock();
    if (workerRef.current) workerRef.current.postMessage('stop');
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setTrackingStatus('idle');

    // If there is an in-progress split with distance/time, finalize it so that total distance is fully accounted for
    let finalSplits = [...splitsRef.current];
    const remDist = currentSplitDistRef.current;
    const remTime = currentSplitTimeRef.current;

    if (remDist > 0.005 && remTime > 0) {
      const splitIndex = finalSplits.length + 1;
      const paceSec = remDist > 0.001 ? Math.round(remTime / remDist) : 0;
      const prevSplit = finalSplits.length > 0 ? finalSplits[0] : undefined;
      const prevPace = prevSplit && prevSplit.distanceKm > 0.001 ? prevSplit.paceSecPerKm : undefined;
      const { formattedDiff, trend } = calculateSplitTrend(paceSec, prevPace);

      const splitLoc = currentLocation || lastLocationRef.current || (coordinates.length > 0 ? coordinates[coordinates.length - 1] : undefined);

      const lastSplit: Split = {
        id: `split-${Date.now()}-${splitIndex}`,
        splitIndex,
        formattedIndex: splitIndex.toString().padStart(2, '0'),
        distanceKm: remDist,
        formattedDistance: `${remDist.toFixed(2)} km`,
        timeSec: remTime,
        formattedTime: formatSplitDuration(remTime),
        paceSecPerKm: paceSec,
        formattedDiff,
        trend,
        totalDistanceKm: totalDistRef.current,
        totalTimeSec: elapsedSeconds,
        timestamp: Date.now(),
        coordinate: splitLoc ? { ...splitLoc } : undefined,
      };
      finalSplits = [lastSplit, ...finalSplits];
      setSplits(finalSplits);
      setCurrentSplitDistanceKm(0);
      setCurrentSplitTimeSec(0);
      currentSplitDistRef.current = 0;
      currentSplitTimeRef.current = 0;
    }

    // Save session if we tracked anything
    if (totalDistanceKm > 0.02 || finalSplits.length > 0) {
      const startTimestamp = startTime || Date.now();
      const avgPace = totalDistanceKm > 0 ? Math.round(elapsedSeconds / totalDistanceKm) : 0;
      const avgSpeed = elapsedSeconds > 0 ? +((totalDistanceKm / (elapsedSeconds / 3600)).toFixed(1)) : 0;

      const dateObj = new Date(startTimestamp);
      const dateStr = `${dateObj.getFullYear()}.${(dateObj.getMonth() + 1).toString().padStart(2, '0')}.${dateObj.getDate().toString().padStart(2, '0')}`;

      const newSession: ActivitySession = {
        id: `activity-${Date.now()}`,
        title: `Track ${formatClockTime(startTimestamp)}`,
        startTime: startTimestamp,
        endTime: Date.now(),
        formattedStartTime: formatClockTime(startTimestamp),
        formattedDate: dateStr,
        totalDistanceKm,
        totalDurationSec: elapsedSeconds,
        avgPaceSecPerKm: avgPace,
        maxSpeedKmh: +(avgSpeed * 1.3).toFixed(1),
        avgSpeedKmh: avgSpeed,
        splits: finalSplits,
        coordinates: [...coordinates],
      };

      setSavedSessions((prev) => [newSession, ...prev]);
    }

    // Nullázás: Completely zero out the main screen so it's fresh and ready
    setTrackingStatus('idle');
    setElapsedSeconds(0);
    setTotalDistanceKm(0);
    setStartTime(null);
    setSplits([]);
    setCurrentSplitDistanceKm(0);
    setCurrentSplitTimeSec(0);

    // Reset GPS coordinates trail on the map
    if (currentLocation) {
      setCoordinates([currentLocation]);
      lastLocationRef.current = currentLocation;
    } else {
      setCoordinates([]);
      lastLocationRef.current = null;
    }

    // Reset all tracking refs
    splitsRef.current = [];
    currentSplitDistRef.current = 0;
    currentSplitTimeRef.current = 0;
    totalDistRef.current = 0;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Update Settings
  const handleUpdateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  // Load Demo Data matching the exact screenshot
  const handleLoadDemoData = () => {
    handlePause();
    setTrackingStatus('idle');
    setElapsedSeconds(3252);
    setTotalDistanceKm(12.45);
    const d = new Date();
    d.setHours(14, 30, 0, 0);
    setStartTime(d.getTime());
    const demoPath = getInitialDemoPath();
    setCoordinates(demoPath);
    setCurrentLocation(demoPath[demoPath.length - 1]);
    setSplits(getInitialDemoSplits());
    setCurrentSplitDistanceKm(0.45);
    setCurrentSplitTimeSec(132);
    setActiveTab('activity');
  };

  // Export current active track to GPX
  const handleExportCurrentGPX = () => {
    if (coordinates.length === 0) return;
    const gpx = exportToGPX('GPS Tracker Aktív Track', coordinates, startTime || Date.now());
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gps-track-${Date.now()}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Delete session from history
  const handleDeleteSession = (id: string) => {
    setSavedSessions((prev) => prev.filter((s) => s.id !== id));
  };

  // Update a split in the active live track
  const handleUpdateSplit = (updatedSplit: Split) => {
    setSplits((prev) => prev.map((s) => (s.id === updatedSplit.id ? updatedSplit : s)));
  };

  // Update a session in history (e.g. edited split, notes, photos)
  const handleUpdateSession = (updatedSession: ActivitySession) => {
    setSavedSessions((prev) =>
      prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
    );
  };

  // Reset all settings and data to default state (Autó, Méter, Kézi, 0 values)
  const handleResetData = () => {
    handlePause();
    setTrackingStatus('idle');
    setElapsedSeconds(0);
    setTotalDistanceKm(0);
    setStartTime(null);
    setCoordinates([]);
    setSplits([]);
    setCurrentSplitDistanceKm(0);
    setCurrentSplitTimeSec(0);
    setSavedSessions([]);
    setSettings(DEFAULT_SETTINGS);

    try {
      localStorage.removeItem(STORAGE_KEY_SESSIONS);
      localStorage.removeItem(STORAGE_KEY_SETTINGS);
    } catch {
      // ignore
    }

    // Refresh GPS location
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc: Coordinate = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            altitude: pos.coords.altitude,
            speed: pos.coords.speed,
            accuracy: pos.coords.accuracy,
            timestamp: Date.now(),
          };
          setCurrentLocation(loc);
          lastLocationRef.current = loc;
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    setActiveTab('activity');
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-[#f4f7fb] select-none overflow-hidden text-[#191c1e]">
      {/* Full-width responsive container */}
      <div className="w-full h-full flex flex-col overflow-hidden relative">
        {/* Active Tab View */}
        <ErrorBoundary fallbackTitle="Hiba történt az oldal betöltése során">
          {activeTab === 'activity' && (
            <ActivityView
              trackingStatus={trackingStatus}
              elapsedSeconds={elapsedSeconds}
              totalDistanceKm={totalDistanceKm}
              startTime={startTime}
              currentLocation={currentLocation}
              coordinates={coordinates}
              splits={splits}
              currentSplitTimeSec={currentSplitTimeSec}
              currentSplitDistanceKm={currentSplitDistanceKm}
              settings={settings}
              loadedSession={loadedSession}
              onUnloadSession={handleUnloadSession}
              onStart={handleStart}
              onPause={handlePause}
              onResume={handleResume}
              onSplit={handleSplit}
              onStop={handleStop}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenMenu={() => setIsMenuOpen(true)}
              onOpenCoordinates={() => setIsCoordinateModalOpen(true)}
              onLayerChange={(layer) => handleUpdateSettings({ mapLayer: layer })}
              onUpdateSplit={handleUpdateSplit}
              onUpdateSettings={handleUpdateSettings}
              onExportGPX={handleExportCurrentGPX}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              sessions={savedSessions}
              settings={settings}
              userProfile={userProfile}
              onDeleteSession={handleDeleteSession}
              onUpdateSession={handleUpdateSession}
              onBack={() => setActiveTab('activity')}
              onOpenCloudShare={handleOpenCloudShare}
              onOpenCloudLoad={handleOpenCloudLoad}
              onLoadSessionForTracking={handleLoadSessionForTracking}
            />
          )}

          {activeTab === 'maps' && (
            <MapsView
              coordinates={coordinates}
              currentLocation={currentLocation}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              sessions={savedSessions}
              settings={settings}
              userProfile={userProfile}
              onUpdateProfile={handleUpdateProfile}
              onResetData={handleResetData}
              onOpenCloudSync={handleOpenCloudLoad}
            />
          )}
        </ErrorBoundary>

        {/* Fixed Bottom Navigation */}
        <BottomNav activeTab={activeTab} onSelectTab={setActiveTab} />

        {/* Modals & Drawers */}
        <CoordinateModal
          isOpen={isCoordinateModalOpen}
          onClose={() => setIsCoordinateModalOpen(false)}
          coordinate={currentLocation ?? (coordinates.length > 0 ? coordinates[coordinates.length - 1] : null)}
        />

        <SettingsModal
          isOpen={isSettingsOpen}
          settings={settings}
          onClose={() => setIsSettingsOpen(false)}
          onUpdateSettings={handleUpdateSettings}
          onResetDefaults={handleResetData}
        />

        <MenuDrawer
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          onSelectTab={setActiveTab}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onLoadDemoData={handleLoadDemoData}
          onExportCurrentGPX={handleExportCurrentGPX}
          onResetData={handleResetData}
          onOpenCloudSync={handleOpenCloudLoad}
          hasTrackData={coordinates.length > 0}
        />

        {/* Cloud Sync & Share Modal */}
        <CloudSyncModal
          isOpen={isCloudSyncOpen}
          onClose={() => {
            setIsCloudSyncOpen(false);
            setSessionToShare(null);
          }}
          sessionToShare={sessionToShare}
          userProfile={userProfile}
          onTrackLoaded={handleTrackLoadedFromCloud}
        />
      </div>
    </div>
  );
}
