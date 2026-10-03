import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Layers,
  Compass,
  Play,
  Pause,
  Square,
  Flag,
  Navigation,
  Crosshair,
  Route,
  X,
  Target,
  Clock,
  Gauge,
  Tag,
  ChevronUp,
  ChevronDown,
  Info,
  Maximize2,
  Sparkles,
  Plus,
  Minus,
  Mountain,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Coordinate, Split, TrackingStatus, UserSettings, ActivitySession } from '../types';
import { OsmMap, OsmMapHandle, MapLayerType } from './OsmMap';
import { SplitDetailModal } from './SplitDetailModal';
import {
  formatElapsedTime,
  formatDMS,
  formatDistanceByUnit,
  formatSplitDuration,
  calculateReferenceMetrics,
  ReferenceTrackMetrics,
  calculateSlopeMetrics,
  SlopeMetrics,
  calculateDistance,
} from '../utils/geoUtils';
import { DEFAULT_RALLY_PRESETS, getPresetIcon } from '../constants/rallyPresets';

interface MapsViewProps {
  trackingStatus: TrackingStatus;
  elapsedSeconds: number;
  totalDistanceKm: number;
  startTime: number | null;
  currentLocation: Coordinate | null;
  coordinates: Coordinate[];
  splits: Split[];
  currentSplitTimeSec: number;
  currentSplitDistanceKm: number;
  settings: UserSettings;
  loadedSession?: ActivitySession | null;
  onUnloadSession?: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onSplit: (presetName?: string, presetNotes?: string) => void;
  onStop: () => void;
  onUpdateSplit?: (updatedSplit: Split) => void;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onOpenSettings?: () => void;
  onOpenCoordinates?: () => void;
}

export const MapsView: React.FC<MapsViewProps> = ({
  trackingStatus,
  elapsedSeconds,
  totalDistanceKm,
  startTime,
  currentLocation,
  coordinates,
  splits,
  currentSplitTimeSec,
  currentSplitDistanceKm,
  settings,
  loadedSession = null,
  onUnloadSession,
  onStart,
  onPause,
  onResume,
  onSplit,
  onStop,
  onUpdateSplit,
  onUpdateSettings,
  onOpenSettings,
  onOpenCoordinates,
}) => {
  const mapRef = useRef<OsmMapHandle>(null);
  const [editingSplit, setEditingSplit] = useState<Split | null>(null);
  const [showPresetsBar, setShowPresetsBar] = useState<boolean>(true);
  const [showHudCard, setShowHudCard] = useState<boolean>(true);
  const [showLayerPicker, setShowLayerPicker] = useState<boolean>(false);
  const [showStopConfirm, setShowStopConfirm] = useState<boolean>(false);

  // Responsive orientation detection: true when screen width > height (landscape view)
  const [isLandscape, setIsLandscape] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth > window.innerHeight;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Live real-time ticking clock (always showing exact current time)
  const [currentWallTime, setCurrentWallTime] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentWallTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const liveClock = useMemo(() => {
    const hh = currentWallTime.getHours().toString().padStart(2, '0');
    const mm = currentWallTime.getMinutes().toString().padStart(2, '0');
    const ss = currentWallTime.getSeconds().toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }, [currentWallTime]);

  // Active coordinates
  const activeLat = currentLocation?.lat ?? (coordinates.length > 0 ? coordinates[coordinates.length - 1].lat : (loadedSession?.coordinates[0]?.lat ?? 37.777528));
  const activeLng = currentLocation?.lng ?? (coordinates.length > 0 ? coordinates[coordinates.length - 1].lng : (loadedSession?.coordinates[0]?.lng ?? -122.416389));
  const dms = formatDMS(activeLat, activeLng);

  // Reference track corridor metrics
  const referenceMetrics: ReferenceTrackMetrics | null = useMemo(() => {
    if (!loadedSession) return null;
    return calculateReferenceMetrics(currentLocation, loadedSession, settings.unit);
  }, [loadedSession, currentLocation, settings.unit]);

  // Rolling GPS trail buffer: keeps track of recent GPS fixes continuously,
  // guaranteeing a stable baseline even in standby or when workout has just started
  const [recentGpsTrail, setRecentGpsTrail] = useState<Coordinate[]>([]);
  const lastBufferedLocRef = useRef<{ lat: number; lng: number; alt: number | null } | null>(null);

  useEffect(() => {
    if (currentLocation && typeof currentLocation.lat === 'number' && typeof currentLocation.lng === 'number') {
      const last = lastBufferedLocRef.current;
      if (
        !last ||
        last.lat !== currentLocation.lat ||
        last.lng !== currentLocation.lng ||
        last.alt !== (currentLocation.altitude ?? null)
      ) {
        lastBufferedLocRef.current = {
          lat: currentLocation.lat,
          lng: currentLocation.lng,
          alt: currentLocation.altitude ?? null,
        };
        setRecentGpsTrail((prev) => {
          const next = [...prev.slice(-60), currentLocation];
          return next;
        });
      }
    }
  }, [currentLocation]);

  // Speed calculation: uses direct hardware speed if available, or dynamically derives speed
  // from recent GPS trail points (over last 2-5 seconds). Fallback to session average.
  const currentSpeedKmh = useMemo(() => {
    // 1. Direct hardware speed if reported and valid
    if (currentLocation?.speed != null && currentLocation.speed >= 0 && !isNaN(currentLocation.speed)) {
      return Math.round(currentLocation.speed * 3.6);
    }
    // 2. Real-time speed computed from recent GPS trail points (last 2-5 seconds)
    const trail = coordinates && coordinates.length >= 2 ? coordinates : recentGpsTrail;
    if (trail.length >= 2) {
      const pLatest = trail[trail.length - 1];
      let pEarlier = trail[0];
      for (let i = trail.length - 2; i >= 0; i--) {
        const dt = (pLatest.timestamp && trail[i].timestamp) ? (pLatest.timestamp - trail[i].timestamp) / 1000 : 0;
        if (dt >= 2.0) {
          pEarlier = trail[i];
          break;
        }
      }
      const dtSec = (pLatest.timestamp && pEarlier.timestamp) ? (pLatest.timestamp - pEarlier.timestamp) / 1000 : 0;
      if (dtSec >= 1 && dtSec <= 20) {
        const dM = calculateDistance(pEarlier.lat, pEarlier.lng, pLatest.lat, pLatest.lng) * 1000;
        const derivedSpeed = (dM / dtSec) * 3.6;
        if (derivedSpeed >= 0 && derivedSpeed < 250) {
          return Math.round(derivedSpeed);
        }
      }
    }
    // 3. Fallback to session average speed if running
    if (elapsedSeconds > 0 && totalDistanceKm > 0) {
      return Math.round((totalDistanceKm / (elapsedSeconds / 3600)));
    }
    return 0;
  }, [currentLocation, coordinates, recentGpsTrail, elapsedSeconds, totalDistanceKm]);

  // Track coordinates for slope calculation: prioritize recorded route (coordinates)
  // when active (>= 4 points), or use recent continuous GPS trail buffer in standby / initial phase
  const trackForSlope = useMemo(() => {
    if (coordinates && coordinates.length >= 4) {
      return coordinates;
    }
    if (recentGpsTrail.length > 0) {
      return recentGpsTrail;
    }
    return coordinates || [];
  }, [coordinates, recentGpsTrail]);

  // Rolling slope metrics ref for hysteresis and temporal smoothing
  const lastSlopeMetricsRef = useRef<SlopeMetrics | null>(null);

  // Slope / Incline / Grade calculation (Lejtmenet / Felfelé menet szög és meredekség)
  // Incorporates 1-2 forward lookahead points along heading and robust hysteresis
  const slopeMetrics: SlopeMetrics = useMemo(() => {
    const metrics = calculateSlopeMetrics(
      currentLocation,
      trackForSlope,
      currentSpeedKmh,
      lastSlopeMetricsRef.current
    );
    lastSlopeMetricsRef.current = metrics;
    return metrics;
  }, [currentLocation, trackForSlope, currentSpeedKmh]);

  // Formatted main distance
  const formattedDistance = formatDistanceByUnit(totalDistanceKm, settings.unit);
  const formattedSplitDist = formatDistanceByUnit(currentSplitDistanceKm, settings.unit);

  const presetsToUse = settings.pointPresets && settings.pointPresets.length > 0
    ? settings.pointPresets
    : DEFAULT_RALLY_PRESETS;

  // Handle quick split with preset
  const handleQuickPresetSplit = (presetName: string) => {
    onSplit(presetName);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full overflow-hidden bg-[#f4f7fb] relative select-none">
      {/* Top Header Bar - Compact for landscape & 800x600 */}
      <header className="flex-shrink-0 px-2.5 sm:px-4 py-1 sm:py-1.5 bg-white/95 backdrop-blur-md border-b border-slate-200 flex items-center justify-between z-20 shadow-2xs">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Tracking Status indicator */}
          {trackingStatus === 'running' ? (
            <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-black animate-pulse shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>RÖGZÍTÉS</span>
            </div>
          ) : trackingStatus === 'paused' ? (
            <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-black shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>SZÜNET</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-full text-xs font-bold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              <span>KÉSZENLÉT</span>
            </div>
          )}

          {/* Activity mode icon */}
          <span className="text-xs font-bold text-slate-500 hidden sm:inline-flex items-center gap-1 bg-slate-50 px-2 py-0.5 sm:py-1 rounded-lg border border-slate-100">
            {settings.activityMode === 'car' ? '🚗 Autó' : settings.activityMode === 'cycling' ? '🚴 Kerékpár' : '🚶 Gyalog'}
          </span>
        </div>

        {/* Right side: Live Clock & Coordinates button */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Current Live Time */}
          <div className="flex items-center gap-1 text-xs font-mono font-bold text-[#0050cb] bg-blue-50 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl border border-blue-200 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-[#0050cb]" />
            <span>{liveClock}</span>
          </div>

          {/* Coordinates button */}
          <button
            type="button"
            onClick={onOpenCoordinates}
            className="flex items-center gap-1 sm:gap-1.5 text-xs font-mono font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl transition-all border border-slate-200 active:scale-95 cursor-pointer shadow-2xs"
            title="GPS Koordináták megnyitása"
          >
            <Compass className="w-3.5 h-3.5 text-[#0050cb]" />
            <span className="hidden sm:inline">{activeLat.toFixed(4)}°, {activeLng.toFixed(4)}°</span>
            <span className="sm:hidden">GPS</span>
          </button>
        </div>
      </header>

      {/* Loaded Session / Reference Track Alert Banner */}
      {loadedSession && (
        <div className="flex-shrink-0 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white px-3 sm:px-4 py-2 flex items-center justify-between z-20 shadow-md border-b border-purple-600">
          <div className="flex items-center gap-2 overflow-hidden mr-2">
            <span className="p-1 bg-white/20 rounded-lg text-sm">🎯</span>
            <div className="truncate">
              <div className="text-xs font-black truncate flex items-center gap-1.5">
                <span className="text-purple-200 font-medium">Betöltött útvonal:</span>
                <span className="font-bold underline decoration-purple-300">{loadedSession.title}</span>
              </div>
              <div className="text-[11px] text-purple-100 flex items-center gap-2 mt-0.5">
                <span>{loadedSession.totalDistanceKm.toFixed(2)} km</span>
                <span>•</span>
                <span>{(loadedSession.splits || []).length} ellenőrzőpont</span>
                {referenceMetrics?.nextSplit && (
                  <>
                    <span>•</span>
                    <span className="font-bold text-amber-200">
                      Következő: {referenceMetrics.nextSplit.name} ({referenceMetrics.nextSplit.distanceKm.toFixed(2)} km)
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {onUnloadSession && (
            <button
              type="button"
              onClick={onUnloadSession}
              className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95 flex-shrink-0"
              title="Betöltött útvonal eltávolítása"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Eltávolítás</span>
            </button>
          )}
        </div>
      )}

      {/* Main Full-Height Map Container */}
      <div className="flex-1 w-full h-full relative overflow-hidden">
        <OsmMap
          ref={mapRef}
          coordinates={coordinates}
          currentLocation={currentLocation}
          splits={splits}
          referenceCoordinates={loadedSession?.coordinates}
          referenceSplits={loadedSession?.splits}
          referenceTitle={loadedSession?.title}
          mapLayer={settings.mapLayer}
          isTracking={trackingStatus === 'running'}
          interactive={true}
          showLayerSelector={false}
          showZoomControls={false}
          projectedCoordinates={slopeMetrics.projectedPoints}
          onLayerChange={(layer) => onUpdateSettings({ mapLayer: layer })}
          onSelectSplit={(split) => setEditingSplit(split)}
        />

        {/* LANDSCAPE COCKPIT COLUMN (Fekvő nézetben a bal oldalon: Idő, alatta Aktuális sebesség, alatta Start, alatta Stop, és elkülönítve nagyobb gomb függőlegesen a Résztáv) */}
        {isLandscape && (
          <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 z-10 flex flex-col gap-1.5 w-[230px] sm:w-[250px] max-h-[calc(100%-12px)] pointer-events-auto select-none overflow-y-auto custom-scrollbar animate-in fade-in duration-150">
            {/* Reference Track Next Waypoint (if route loaded) */}
            {loadedSession && referenceMetrics?.nextSplit && (
              <div className="bg-purple-50/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-purple-200 shadow-sm text-xs">
                <div className="flex items-center justify-between text-[10px] font-bold text-purple-600 uppercase">
                  <span className="flex items-center gap-1">
                    <Target className="w-3 h-3 text-purple-600" />
                    <span>Következő pont</span>
                  </span>
                  <span>{referenceMetrics.nextSplit.index}/{referenceMetrics.nextSplit.total}</span>
                </div>
                <div className="text-xs font-black text-slate-800 truncate mt-0.5" title={referenceMetrics.nextSplit.name}>
                  {referenceMetrics.nextSplit.name}
                </div>
                <div className="text-base font-black font-mono text-purple-700 leading-tight">
                  {referenceMetrics.nextSplit.formattedRelative}
                </div>
              </div>
            )}

            {/* 1. IDŐ (Idő az jó) */}
            <div className="bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl sm:rounded-2xl shadow-lg border border-slate-200/90">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#0050cb]" />
                  <span>Idő</span>
                </span>
                <span className="font-mono text-[#0050cb] font-bold text-[11px]">
                  {formattedDistance.value} {formattedDistance.unitLabel}
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 leading-tight mt-0.5">
                {formatElapsedTime(elapsedSeconds)}
              </div>
              {/* Slope summary tag */}
              <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100 text-[10px] font-bold font-mono">
                <span className="text-slate-400 uppercase font-sans text-[9.5px]">Lejtés:</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  slopeMetrics.direction === 'up'
                    ? 'bg-emerald-100 text-emerald-800'
                    : slopeMetrics.direction === 'down'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {slopeMetrics.formattedGrade} {slopeMetrics.shortLabel}
                </span>
              </div>
            </div>

            {/* 2. AKTUÁLIS SEBESSÉG (alatta legyen az aktuális sebesség) */}
            <div className="bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl sm:rounded-2xl shadow-lg border border-slate-200/90">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none">
                <span className="flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-slate-400" />
                  <span>Aktuális sebesség</span>
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 leading-tight mt-0.5 flex items-baseline gap-1">
                <span>{currentSpeedKmh}</span>
                <span className="text-xs font-bold text-slate-500 font-sans">km/h</span>
              </div>
            </div>

            {/* 3. VEZÉRLÉS: Alatta a START, alatta a STOP, és ELKÜLÖNÍTVE nagyobb gomb függőlegesen a RÉSZTÁV */}
            <div className="bg-white/95 backdrop-blur-md p-1.5 rounded-xl sm:rounded-2xl shadow-lg border border-slate-200/90 flex gap-1.5 items-stretch">
              {/* Bal oszlop: START, alatta a STOP */}
              <div className="flex-1 flex flex-col gap-1.5 justify-between">
                {/* START / SZÜNET / FOLYTATÁS */}
                {trackingStatus === 'idle' ? (
                  <button
                    type="button"
                    onClick={onStart}
                    className="w-full py-2 sm:py-2.5 px-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/25 transition-all active:scale-95 cursor-pointer flex-1"
                  >
                    <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current shrink-0" />
                    <span>START</span>
                  </button>
                ) : trackingStatus === 'running' ? (
                  <button
                    type="button"
                    onClick={onPause}
                    className="w-full py-2 sm:py-2.5 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-2xs flex-1"
                    title="Rögzítés szüneteltetése"
                  >
                    <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current text-amber-600 shrink-0" />
                    <span>SZÜNET</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onResume}
                    className="w-full py-2 sm:py-2.5 px-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/30 transition-all active:scale-95 cursor-pointer animate-pulse ring-2 ring-emerald-400/40 flex-1"
                  >
                    <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current shrink-0" />
                    <span>FOLYTATÁS</span>
                  </button>
                )}

                {/* STOP (alatta a stop) */}
                <button
                  id="btn-landscape-stop"
                  type="button"
                  disabled={trackingStatus === 'idle'}
                  onClick={() => setShowStopConfirm(true)}
                  className={`w-full py-1.5 sm:py-2 px-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer flex-1 ${
                    trackingStatus === 'idle'
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50'
                      : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 shadow-2xs'
                  }`}
                  title="Rögzítés befejezése és mentése"
                >
                  <Square className="w-3.5 h-3.5 fill-current text-red-600 shrink-0" />
                  <span>STOP</span>
                </button>
              </div>

              {/* Jobb oszlop: ELKÜLÖNÍTVE nagyobb gomb FÜGGŐLEGESEN a RÉSZTÁV gomb */}
              <div className="w-[88px] sm:w-[98px] flex border-l border-slate-200/80 pl-1.5">
                <button
                  type="button"
                  disabled={trackingStatus === 'idle'}
                  onClick={() => onSplit()}
                  className={`w-full h-full min-h-[78px] py-1.5 px-1 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm flex flex-col items-center justify-center gap-1 shadow-lg transition-all active:scale-95 cursor-pointer select-none ${
                    trackingStatus === 'idle'
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50'
                      : 'bg-gradient-to-br from-[#0050cb] via-blue-600 to-[#0066ff] hover:from-blue-700 hover:to-blue-600 text-white shadow-blue-500/35 ring-2 ring-blue-400/40'
                  }`}
                  title="Új résztáv rögzítése"
                >
                  <Flag className="w-4 h-4 sm:w-5 sm:h-5 fill-current shrink-0" />
                  <span className="tracking-wide uppercase text-center leading-none text-[11px] sm:text-xs">RÉSZTÁV</span>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                    trackingStatus === 'idle' ? 'bg-slate-200 text-slate-500' : 'bg-white/20 text-white'
                  }`}>
                    #{splits.length + 1}
                  </span>
                </button>
              </div>
            </div>

            {/* GPS & Points mini footer in landscape */}
            <div className="px-2 text-[10px] font-mono text-slate-500 flex items-center justify-between">
              <span>Pontok: {coordinates.length}</span>
              <span>GPS: ±{currentLocation?.accuracy ? Math.round(currentLocation.accuracy) : 5}m</span>
            </div>
          </div>
        )}

        {/* PORTRAIT HUD CARD (Álló nézetben: Összecsukható Élő Műszerfal) */}
        {!isLandscape && (
          <div className={`absolute top-1.5 sm:top-2 left-1.5 sm:left-2 z-10 flex flex-col pointer-events-none transition-all ${
            showHudCard
              ? 'w-[calc(100vw-12px)] max-w-[280px] sm:w-[260px] max-h-[calc(100%-12px)]'
              : 'max-w-[calc(100vw-60px)] sm:max-w-[300px]'
          }`}>
            {/* Collapsible HUD Card */}
            <div className="bg-white/95 backdrop-blur-md px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/90 pointer-events-auto transition-all max-h-[calc(100%-4px)] overflow-y-auto custom-scrollbar">
              <div
                className={`flex items-center justify-between gap-2 cursor-pointer select-none ${showHudCard ? 'pb-0.5 border-b border-slate-100' : ''}`}
                onClick={() => setShowHudCard(!showHudCard)}
              >
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider overflow-hidden">
                  {loadedSession ? (
                    <Target className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                  ) : (
                    <Gauge className="w-3.5 h-3.5 text-[#0050cb] flex-shrink-0" />
                  )}

                  {showHudCard ? (
                    <span>{loadedSession ? 'Következő pont' : 'Élő Műszerfal'}</span>
                  ) : loadedSession && referenceMetrics?.nextSplit ? (
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="text-[11px] font-bold text-slate-600 truncate max-w-[85px] sm:max-w-[120px]">
                        {referenceMetrics.nextSplit.name}:
                      </span>
                      <span className="font-mono font-black text-purple-700 text-sm normal-case tracking-normal">
                        {referenceMetrics.nextSplit.formattedRelative}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="font-mono font-black text-[#0050cb] text-base normal-case tracking-normal flex items-baseline gap-1">
                        <span>{formattedDistance.value}</span>
                        <span className="text-xs font-bold text-slate-500">{formattedDistance.unitLabel}</span>
                      </span>
                      {trackingStatus === 'running' && (
                        <span className={`text-xs font-mono font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
                          slopeMetrics.direction === 'up'
                            ? 'bg-emerald-100 text-emerald-800'
                            : slopeMetrics.direction === 'down'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          <span>{slopeMetrics.direction === 'up' ? '↗' : slopeMetrics.direction === 'down' ? '↘' : '─'}</span>
                          <span>{slopeMetrics.formattedGrade}</span>
                          <span className="text-[10px] font-bold text-slate-500 font-mono">({slopeMetrics.formattedAngle})</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowHudCard(!showHudCard);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 cursor-pointer flex-shrink-0"
                  title={showHudCard ? 'Műszerfal összecsukása' : 'Műszerfal lenyitása'}
                  aria-label={showHudCard ? 'Műszerfal összecsukása' : 'Műszerfal lenyitása'}
                >
                  {showHudCard ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showHudCard && (
                <>
                  {loadedSession && referenceMetrics?.nextSplit ? (
                    <div className="mt-1 space-y-1">
                      {/* Next Checkpoint Highlight Box */}
                      <div className="bg-gradient-to-br from-purple-50 to-indigo-50/80 px-2 py-1 rounded-xl border border-purple-200/80 shadow-2xs">
                        <div className="flex items-center justify-between text-[10px] font-bold text-purple-600 uppercase tracking-wider">
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3 text-purple-600" />
                            <span>Következő pont</span>
                          </span>
                          <span className="px-1.5 py-0.5 bg-purple-100/90 text-purple-800 rounded font-mono text-[9.5px]">
                            {referenceMetrics.nextSplit.index} / {referenceMetrics.nextSplit.total}
                          </span>
                        </div>

                        <div className="text-sm font-black text-slate-800 truncate mt-0.5" title={referenceMetrics.nextSplit.name}>
                          {referenceMetrics.nextSplit.name}
                        </div>

                        <div className="flex items-baseline justify-between mt-0.5">
                          <div className="text-xl sm:text-2xl font-black font-mono text-purple-700 leading-tight">
                            {referenceMetrics.nextSplit.formattedRelative}
                          </div>
                          <div className="flex items-center gap-1 text-xs font-bold text-slate-700 bg-white/90 px-1.5 py-0.5 rounded-lg border border-purple-100">
                            <Compass className="w-3.5 h-3.5 text-purple-600" />
                            <span>{referenceMetrics.nextSplit.bearingCompass}</span>
                            <span className="text-[11px] font-mono text-slate-400">({Math.round(referenceMetrics.nextSplit.bearingDeg)}°)</span>
                          </div>
                        </div>
                      </div>

                      {/* Route Context: Distance to Finish & From Start */}
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block leading-none">Célig:</span>
                          <span className="font-mono font-black text-indigo-700 text-sm sm:text-base leading-tight block mt-0.5">
                            {referenceMetrics.formattedDistanceToEnd}
                          </span>
                        </div>
                        <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block leading-none">Starttól:</span>
                          <span className="font-mono font-bold text-slate-700 text-sm sm:text-base leading-tight block mt-0.5">
                            {referenceMetrics.formattedDistanceFromStart}
                          </span>
                        </div>
                      </div>

                      {/* Route Corridor Status, Speed, and Slope Angle */}
                      <div className="pt-1 border-t border-slate-100 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs font-mono text-slate-600">
                          <span className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${referenceMetrics.isOnTrack ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            <span className="font-sans font-bold text-xs">
                              {referenceMetrics.isOnTrack ? 'Útvonalon' : `Eltérés: ±${referenceMetrics.crossTrackDistanceMeters}m`}
                            </span>
                          </span>
                          {trackingStatus === 'running' ? (
                            <span className="font-bold text-slate-800">
                              {currentSpeedKmh} km/h
                            </span>
                          ) : (
                            <span className="text-slate-400 font-sans text-xs">
                              {loadedSession.totalDistanceKm.toFixed(1)} km
                            </span>
                          )}
                        </div>

                        {/* Live Slope in reference track mode: Clean row with big %, small °, and label only */}
                        <div className={`px-2 py-0.5 rounded-lg border flex items-center justify-between text-xs ${
                          slopeMetrics.direction === 'up'
                            ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                            : slopeMetrics.direction === 'down'
                            ? 'bg-blue-50/90 border-blue-200 text-blue-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}>
                          <div className="flex items-baseline gap-1 font-mono">
                            <span className={`font-black text-sm sm:text-base ${
                              slopeMetrics.direction === 'up'
                                ? 'text-emerald-700'
                                : slopeMetrics.direction === 'down'
                                ? 'text-blue-700'
                                : 'text-slate-800'
                            }`}>
                              {slopeMetrics.formattedGrade}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500 font-mono">
                              {slopeMetrics.formattedAngle}
                            </span>
                          </div>
                          <span className="font-bold text-xs">
                            {slopeMetrics.shortLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 space-y-1">
                      {/* Time and Distance Primary Metrics with larger typography and compact vertical padding */}
                      <div className="grid grid-cols-2 gap-1">
                        <div className="bg-slate-50/90 px-2 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 leading-none">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Össz. Idő</span>
                          </div>
                          <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 leading-tight mt-0.5">
                            {formatElapsedTime(elapsedSeconds)}
                          </div>
                        </div>

                        <div className="bg-blue-50/60 px-2 py-1 rounded-lg border border-blue-100 shadow-2xs">
                          <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1 leading-none">
                            <Navigation className="w-3 h-3 text-[#0050cb]" />
                            <span>Távolság</span>
                          </div>
                          <div className="text-xl sm:text-2xl font-black font-mono text-[#0050cb] leading-tight mt-0.5 flex items-baseline gap-1">
                            <span>{formattedDistance.value}</span>
                            <span className="text-xs font-bold text-slate-500">{formattedDistance.unitLabel}</span>
                          </div>
                        </div>
                      </div>

                      {/* Speed & Current Split Metrics with larger numbers and compact vertical padding */}
                      <div className="grid grid-cols-2 gap-1 bg-slate-50/80 px-2 py-1 rounded-lg border border-slate-200/80">
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1 leading-none">
                            <Gauge className="w-3 h-3 text-slate-400" />
                            <span>Sebesség</span>
                          </span>
                          <div className="text-lg sm:text-xl font-black font-mono text-slate-900 leading-tight mt-0.5">
                            {currentSpeedKmh} <span className="text-xs font-bold text-slate-500">km/h</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1 leading-none">
                            <Flag className="w-3 h-3 text-slate-400" />
                            <span>Akt. szakasz</span>
                          </span>
                          <div className="text-lg sm:text-xl font-black font-mono text-slate-900 leading-tight mt-0.5 flex items-baseline gap-1">
                            <span>{formattedSplitDist.value}</span>
                            <span className="text-xs font-bold text-slate-500">{formattedSplitDist.unitLabel}</span>
                          </div>
                        </div>
                      </div>

                      {/* Live Slope Box: Big percentage first, smaller degree, clean labels only (Sík terep, Emelkedő, Lejtő) */}
                      <div className={`px-2 py-0.5 rounded-lg border flex items-center justify-between transition-all ${
                        slopeMetrics.direction === 'up'
                          ? 'bg-gradient-to-br from-emerald-50 via-teal-50/80 to-emerald-50 border-emerald-300 shadow-2xs text-emerald-900'
                          : slopeMetrics.direction === 'down'
                          ? 'bg-gradient-to-br from-sky-50 via-blue-50/80 to-sky-50 border-blue-300 shadow-2xs text-blue-900'
                          : 'bg-slate-50/90 border-slate-200/80 text-slate-800'
                      }`}>
                        {/* Big percentage first, smaller degree */}
                        <div className="flex items-baseline gap-1 font-mono">
                          <span className={`text-2xl sm:text-3xl font-black tracking-tight leading-none ${
                            slopeMetrics.direction === 'up'
                              ? 'text-emerald-700'
                              : slopeMetrics.direction === 'down'
                              ? 'text-blue-700'
                              : 'text-slate-800'
                          }`}>
                            {slopeMetrics.formattedGrade}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-slate-500 font-mono">
                            {slopeMetrics.formattedAngle}
                          </span>
                        </div>

                        {/* Clean label only: Sík terep / Emelkedő / Lejtő */}
                        <span className={`px-2 py-0.5 rounded-md text-xs font-bold leading-none ${
                          slopeMetrics.direction === 'up'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : slopeMetrics.direction === 'down'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-slate-200/70 text-slate-700'
                        }`}>
                          {slopeMetrics.shortLabel}
                        </span>
                      </div>

                      {/* GPS Coordinates preview - compact */}
                      <div className="pt-0.5 border-t border-slate-200/80 text-[10px] font-mono text-slate-600 flex items-center justify-between leading-none">
                        <span>Pontok: <b className="text-slate-800">{coordinates.length}</b></span>
                        <span>Splitek: <b className="text-slate-800">{splits.length}</b></span>
                        <span>GPS: <b className="text-slate-800">±{currentLocation?.accuracy ? Math.round(currentLocation.accuracy) : 5}m</b></span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Floating Map Tool Controls - Top-right horizontal bar in landscape/short screens, vertical stack in portrait */}
        <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 z-10 flex flex-col landscape:flex-row max-h-[680px]:flex-row items-center gap-1 sm:gap-1.5 pointer-events-auto">
          {/* Zoom In & Zoom Out Controls */}
          <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/90 flex flex-col landscape:flex-row max-h-[680px]:flex-row overflow-hidden">
            <button
              id="btn-large-map-zoom-in"
              type="button"
              onClick={() => mapRef.current?.zoomIn()}
              className="p-1.5 sm:p-2 text-slate-700 hover:text-[#0050cb] hover:bg-slate-50 active:bg-blue-50 transition-all border-b landscape:border-b-0 landscape:border-r max-h-[680px]:border-b-0 max-h-[680px]:border-r border-slate-100 cursor-pointer flex items-center justify-center"
              title="Nagyítás (+)"
              aria-label="Nagyítás (+)"
            >
              <Plus className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.5]" />
            </button>
            <button
              id="btn-large-map-zoom-out"
              type="button"
              onClick={() => mapRef.current?.zoomOut()}
              className="p-1.5 sm:p-2 text-slate-700 hover:text-[#0050cb] hover:bg-slate-50 active:bg-blue-50 transition-all cursor-pointer flex items-center justify-center"
              title="Kicsinyítés (-)"
              aria-label="Kicsinyítés (-)"
            >
              <Minus className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.5]" />
            </button>
          </div>

          {/* Recenter Button */}
          <button
            id="btn-large-map-recenter"
            type="button"
            onClick={() => mapRef.current?.recenter()}
            className="p-1.5 sm:p-2 bg-white/95 backdrop-blur-md hover:bg-white text-slate-700 hover:text-[#0050cb] active:text-[#0050cb] rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/90 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
            title="Centrálás jelenlegi helyre"
            aria-label="Centrálás jelenlegi helyre"
          >
            <Crosshair className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* Layer Selector Trigger Button */}
          <button
            id="btn-large-map-layer-selector"
            type="button"
            onClick={() => setShowLayerPicker(!showLayerPicker)}
            className={`p-1.5 sm:p-2 rounded-xl sm:rounded-2xl shadow-xl border transition-all cursor-pointer flex items-center justify-center ${
              showLayerPicker
                ? 'bg-[#0050cb] text-white border-blue-600'
                : 'bg-white/95 backdrop-blur-md text-slate-700 hover:bg-slate-50 border-slate-200/90'
            }`}
            title="Térképréteg váltása"
            aria-label="Térképréteg váltása"
          >
            <Layers className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* Quick Preset Bar Toggle */}
          <button
            id="btn-large-map-preset-toggle"
            type="button"
            onClick={() => setShowPresetsBar(!showPresetsBar)}
            className={`p-1.5 sm:p-2 rounded-xl sm:rounded-2xl shadow-xl border transition-all cursor-pointer flex items-center justify-center ${
              showPresetsBar
                ? 'bg-amber-500 text-white border-amber-600'
                : 'bg-white/95 backdrop-blur-md text-slate-700 hover:bg-slate-50 border-slate-200/90'
            }`}
            title="Gyors itiner sablonok megjelenítése/elrejtése"
            aria-label="Gyors itiner sablonok megjelenítése/elrejtése"
          >
            <Tag className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
        </div>

        {/* Layer Selector Popup Menu */}
        {showLayerPicker && (
          <div className="absolute top-10 landscape:top-10 max-h-[680px]:top-10 sm:top-12 right-1.5 sm:right-2 z-20 bg-white/95 backdrop-blur-md p-1.5 rounded-xl sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col gap-1 min-w-[140px] max-h-[220px] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="text-[10px] font-black uppercase text-slate-400 px-2 py-0.5">Térképréteg</div>
            {(['osm', 'voyager', 'positron', 'cyclosm', 'satellite'] as MapLayerType[]).map((layer) => {
              const names: Record<MapLayerType, string> = {
                osm: 'Standard OSM',
                voyager: 'Voyager',
                positron: 'Positron (Világos)',
                cyclosm: 'CyclOSM / Terep',
                satellite: 'Műhold',
              };
              const active = settings.mapLayer === layer;
              return (
                <button
                  key={layer}
                  type="button"
                  onClick={() => {
                    onUpdateSettings({ mapLayer: layer });
                    setShowLayerPicker(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold text-left transition-all flex items-center justify-between cursor-pointer ${
                    active ? 'bg-[#0050cb] text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{names[layer]}</span>
                  {active && <span className="text-xs">✓</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Floating Bottom Recording Dock & Quick Presets - In landscape mode, primary controls are on the left cockpit */}
        <div className={`absolute bottom-1.5 sm:bottom-2 right-1.5 sm:right-2 z-10 flex flex-col gap-1 pointer-events-auto transition-all ${
          showHudCard
            ? 'left-1.5 sm:left-2 landscape:left-auto landscape:max-w-lg max-h-[680px]:left-auto max-h-[680px]:max-w-lg'
            : 'left-1.5 sm:left-2 landscape:left-auto landscape:max-w-lg max-h-[680px]:left-auto max-h-[680px]:max-w-lg'
        }`}>
          {/* Quick Rally Preset Waypoint Buttons (Horizontally scrollable) */}
          {showPresetsBar && trackingStatus !== 'idle' && (
            <div className="bg-white/90 backdrop-blur-md p-1 rounded-xl shadow-lg border border-slate-200/90 flex items-center gap-1 overflow-x-auto custom-scrollbar">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 flex-shrink-0 flex items-center gap-1">
                <Tag className="w-3 h-3 text-amber-500" />
                <span className="hidden sm:inline">Sablonok:</span>
              </span>
              {presetsToUse.map((preset) => {
                const icon = getPresetIcon(preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleQuickPresetSplit(preset)}
                    className="flex-shrink-0 px-2 py-0.5 bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-all active:scale-90 cursor-pointer shadow-2xs"
                    title={`Új útpont rögzítése: ${preset}`}
                  >
                    <span>{icon}</span>
                    <span className="whitespace-nowrap">{preset}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Main Action Bar - Shown in Portrait, hidden in Landscape where controls are in the left cockpit */}
          <div className="bg-white/95 backdrop-blur-md p-1 sm:p-1.5 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200 landscape:hidden max-h-[680px]:hidden flex items-center justify-between gap-1 sm:gap-1.5">
            {trackingStatus === 'idle' ? (
              /* IDLE STATE: Big Start Recording Button */
              <div className="w-full flex items-center justify-between gap-2">
                <div className="text-xs text-slate-500 font-medium pl-1.5 hidden sm:block">
                  {coordinates.length > 0 ? `${coordinates.length} pont a térképen` : 'Készenlétben • Indítás gomb'}
                </div>

                <button
                  type="button"
                  onClick={onStart}
                  className="w-full sm:w-auto flex-1 py-1.5 sm:py-2 px-3 sm:px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/25 transition-all active:scale-95 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>RÖGZÍTÉS INDÍTÁSA</span>
                </button>
              </div>
            ) : trackingStatus === 'running' ? (
              /* RUNNING STATE: Stop, Pause, and BIG SPLIT / WAYPOINT BUTTON */
              <div className="w-full flex items-center gap-1 sm:gap-1.5">
                {/* Stop / Finish Button */}
                <button
                  id="btn-maps-stop"
                  type="button"
                  onClick={() => setShowStopConfirm(true)}
                  className="px-2 sm:px-2.5 py-1.5 rounded-lg sm:rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-90 cursor-pointer shadow-2xs flex-shrink-0"
                  title="Rögzítés befejezése és mentése"
                >
                  <Square className="w-3.5 h-3.5 fill-current text-red-600" />
                  <span>Befejezés</span>
                </button>

                {/* Pause Button */}
                <button
                  type="button"
                  onClick={onPause}
                  className="px-2 sm:px-2.5 py-1.5 rounded-lg sm:rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-90 cursor-pointer shadow-2xs flex-shrink-0"
                  title="Rögzítés szüneteltetése"
                >
                  <Pause className="w-3.5 h-3.5 fill-current text-amber-600" />
                  <span>Szünet</span>
                </button>

                {/* BIG PROMINENT RALLY SPLIT / CHECKPOINT BUTTON */}
                <button
                  type="button"
                  onClick={() => onSplit()}
                  className="flex-1 py-1.5 sm:py-2 px-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-[#0050cb] via-blue-600 to-[#0066ff] hover:from-blue-700 hover:to-blue-600 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/30 transition-all active:scale-95 cursor-pointer ring-2 ring-blue-400/30 min-w-0 truncate"
                >
                  <Flag className="w-3.5 h-3.5 fill-current shrink-0" />
                  <span className="truncate">RÉSZTÁV ({splits.length + 1})</span>
                </button>
              </div>
            ) : (
              /* PAUSED STATE: Stop, Split, and Glowing RESUME Button */
              <div className="w-full flex items-center gap-1 sm:gap-1.5">
                {/* Stop / Finish Button */}
                <button
                  id="btn-maps-stop-paused"
                  type="button"
                  onClick={() => setShowStopConfirm(true)}
                  className="px-2 sm:px-2.5 py-1.5 rounded-lg sm:rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-90 cursor-pointer shadow-2xs flex-shrink-0"
                  title="Rögzítés befejezése és mentése"
                >
                  <Square className="w-3.5 h-3.5 fill-current text-red-600" />
                  <span>Befejezés</span>
                </button>

                {/* Split even while paused */}
                <button
                  type="button"
                  onClick={() => onSplit()}
                  className="px-2 sm:px-2.5 py-1.5 rounded-lg sm:rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0050cb] border border-blue-200 font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-90 cursor-pointer shadow-2xs flex-shrink-0"
                  title="Útpont rögzítése a jelenlegi pozíción"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Útpont</span>
                </button>

                {/* Big Glowing Resume Button */}
                <button
                  type="button"
                  onClick={onResume}
                  className="flex-1 py-1.5 sm:py-2 px-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/30 transition-all active:scale-95 cursor-pointer animate-pulse ring-2 ring-emerald-400/40 min-w-0 truncate"
                >
                  <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                  <span className="truncate">FOLYTATÁS</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stop / Finish Confirmation Modal */}
      {showStopConfirm && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowStopConfirm(false)}
        >
          <div
            className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                <Square className="w-6 h-6 fill-current" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800">Rögzítés befejezése?</h3>
                <p className="text-xs text-slate-500">Az eddigi nyomvonal és az ellenőrzőpontok elmentődnek az Előzményekbe.</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span>Rögzített idő:</span>
                <span className="font-mono font-bold text-slate-800">{formatElapsedTime(elapsedSeconds)}</span>
              </div>
              <div className="flex justify-between">
                <span>Össztávolság:</span>
                <span className="font-mono font-bold text-slate-800">{formattedDistance.value} {formattedDistance.unitLabel}</span>
              </div>
              <div className="flex justify-between">
                <span>Rögzített résztávok:</span>
                <span className="font-mono font-bold text-slate-800">{splits.length} db</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowStopConfirm(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Mégse
              </button>
              <button
                id="btn-maps-confirm-save"
                type="button"
                onClick={() => {
                  setShowStopConfirm(false);
                  onStop();
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-md shadow-red-600/20 cursor-pointer"
              >
                Befejezés & Mentés
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split Details / Point Edit Modal */}
      {editingSplit && (
        <SplitDetailModal
          split={editingSplit}
          allSplits={splits}
          unit={settings.unit}
          presets={settings.pointPresets}
          isOpen={true}
          onClose={() => setEditingSplit(null)}
          onSave={(updatedSplit) => {
            if (onUpdateSplit) {
              onUpdateSplit(updatedSplit);
            }
            setEditingSplit(null);
          }}
        />
      )}
    </div>
  );
};
