import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Menu,
  Settings as SettingsIcon,
  MapPin,
  Footprints,
  Bike,
  Car,
  Play,
  Pause,
  Square,
  Flag,
  Edit3,
  Camera,
  MessageSquare,
  Share2,
  Navigation,
  Download,
  Crosshair,
  Radio,
  Gauge,
  Layers,
  Target,
  Compass,
  X,
  CheckCircle2,
  Route,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { Coordinate, Split, TrackingStatus, UserSettings, ActivityMode, ActivitySession } from '../types';
import { OsmMap, MapLayerType } from './OsmMap';
import { SplitDetailModal } from './SplitDetailModal';
import {
  formatElapsedTime,
  formatDMS,
  formatDistanceByUnit,
  getCumulativeDistanceForSplit,
  exportToGPX,
  calculateReferenceMetrics,
  getFullSessionSplits,
  ReferenceTrackMetrics,
} from '../utils/geoUtils';

interface ActivityViewProps {
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
  onSplit: () => void;
  onStop: () => void;
  onOpenSettings: () => void;
  onOpenMenu: () => void;
  onOpenCoordinates: () => void;
  onLayerChange?: (layer: MapLayerType) => void;
  onUpdateSplit?: (updatedSplit: Split) => void;
  onUpdateSettings?: (newSettings: Partial<UserSettings>) => void;
  onExportGPX?: () => void;
}

export const ActivityView: React.FC<ActivityViewProps> = ({
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
  onOpenSettings,
  onOpenMenu,
  onOpenCoordinates,
  onLayerChange,
  onUpdateSplit,
  onUpdateSettings,
  onExportGPX,
}) => {
  const desktopSplitsContainerRef = useRef<HTMLDivElement>(null);
  const mobileSplitsContainerRef = useRef<HTMLDivElement>(null);
  const [focusedSplitId, setFocusedSplitId] = useState<string | null>(null);
  const [editingSplit, setEditingSplit] = useState<Split | null>(null);
  const [splitsTab, setSplitsTab] = useState<'active' | 'loaded'>('active');

  // If a reference session is loaded or unloaded, switch default tab appropriately
  useEffect(() => {
    if (loadedSession) {
      setSplitsTab('loaded');
    } else {
      setSplitsTab('active');
    }
  }, [loadedSession?.id]);

  // Compute active DMS coordinates
  const activeLat = currentLocation?.lat ?? (coordinates.length > 0 ? coordinates[coordinates.length - 1].lat : (loadedSession?.coordinates[0]?.lat ?? 37.777528));
  const activeLng = currentLocation?.lng ?? (coordinates.length > 0 ? coordinates[coordinates.length - 1].lng : (loadedSession?.coordinates[0]?.lng ?? -122.416389));
  const dms = formatDMS(activeLat, activeLng);

  // Start clock display (e.g. 14:30 or current time)
  const displayClock = useMemo(() => {
    const timeToUse = startTime ? new Date(startTime) : new Date();
    const hh = timeToUse.getHours().toString().padStart(2, '0');
    const mm = timeToUse.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  }, [startTime]);

  // Display distance formatted according to selected unit (km, m, mi)
  const formattedDistanceObj = formatDistanceByUnit(totalDistanceKm, settings.unit);

  // Compute reference track relative metrics along track corridor
  const referenceMetrics: ReferenceTrackMetrics | null = useMemo(() => {
    if (!loadedSession) return null;
    return calculateReferenceMetrics(currentLocation, loadedSession, settings.unit);
  }, [loadedSession, currentLocation, settings.unit]);

  const loadedSessionSplits = useMemo(() => {
    if (!loadedSession) return undefined;
    return getFullSessionSplits(loadedSession);
  }, [loadedSession]);

  // Auto-scroll loaded checkpoints list so that the current active/closest point is always the 3rd item in view
  const activeSplitIndex = referenceMetrics?.activeSplitIndex ?? 0;

  useEffect(() => {
    if (!referenceMetrics || splitsTab !== 'loaded') return;

    // Target item to align to the top so active item is 3rd (slot index 2)
    const targetTopIndex = Math.max(0, activeSplitIndex - 2);

    // Desktop auto-scroll
    if (desktopSplitsContainerRef.current) {
      const targetEl = desktopSplitsContainerRef.current.querySelector<HTMLElement>(`#desktop-ref-split-${targetTopIndex}`);
      if (targetEl) {
        const containerTop = desktopSplitsContainerRef.current.getBoundingClientRect().top;
        const elTop = targetEl.getBoundingClientRect().top;
        const currentScroll = desktopSplitsContainerRef.current.scrollTop;
        desktopSplitsContainerRef.current.scrollTo({
          top: Math.max(0, currentScroll + (elTop - containerTop)),
          behavior: 'smooth',
        });
      }
    }

    // Mobile auto-scroll
    if (mobileSplitsContainerRef.current) {
      const targetEl = mobileSplitsContainerRef.current.querySelector<HTMLElement>(`#mobile-ref-split-${targetTopIndex}`);
      if (targetEl) {
        const containerTop = mobileSplitsContainerRef.current.getBoundingClientRect().top;
        const elTop = targetEl.getBoundingClientRect().top;
        const currentScroll = mobileSplitsContainerRef.current.scrollTop;
        mobileSplitsContainerRef.current.scrollTo({
          top: Math.max(0, currentScroll + (elTop - containerTop)),
          behavior: 'smooth',
        });
      }
    }
  }, [activeSplitIndex, splitsTab, referenceMetrics]);

  // Auto scroll to top of live splits when new split is added
  useEffect(() => {
    if (desktopSplitsContainerRef.current && splitsTab === 'active') {
      desktopSplitsContainerRef.current.scrollTop = 0;
    }
    if (mobileSplitsContainerRef.current && splitsTab === 'active') {
      mobileSplitsContainerRef.current.scrollTop = 0;
    }
  }, [splits.length, splitsTab]);

  const getActivityIcon = (mode: ActivityMode) => {
    switch (mode) {
      case 'cycling':
        return <Bike className="w-4 h-4" />;
      case 'car':
        return <Car className="w-4 h-4" />;
      case 'walking':
      default:
        return <Footprints className="w-4 h-4" />;
    }
  };

  const getActivityLabel = (mode: ActivityMode) => {
    switch (mode) {
      case 'cycling':
        return 'Kerékpár';
      case 'car':
        return 'Autó';
      case 'walking':
      default:
        return 'Gyalog';
    }
  };

  const avgSpeed = elapsedSeconds > 0 ? ((totalDistanceKm / (elapsedSeconds / 3600)).toFixed(1)) : '0.0';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f4f7fb]">
      {/* 1. Header (Menu, Title: GPS TRACKER, Quick Status, Settings) */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-white/95 border-b border-slate-100 z-20">
        <div className="flex items-center gap-3">
          <button
            id="btn-open-menu"
            onClick={onOpenMenu}
            aria-label="Menü"
            className="p-1.5 -ml-1 text-[#0050cb] hover:bg-blue-50 rounded-xl transition-colors active:scale-95 cursor-pointer"
          >
            <Menu className="w-6 h-6 stroke-[2.5]" />
          </button>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#0050cb] select-none font-heading flex items-center gap-2">
            <span>GPS TRACKER</span>
            <span className="hidden md:inline-flex text-[10px] uppercase font-bold tracking-widest bg-blue-50 text-[#0050cb] px-2 py-0.5 rounded-md border border-blue-200">
              {getActivityLabel(settings.activityMode)}
            </span>
          </h1>
        </div>

        {/* Desktop Header Quick Info */}
        <div className="hidden md:flex items-center gap-2.5 text-xs">
          {loadedSession && (
            <div className="flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full font-bold">
              <Target className="w-3.5 h-3.5 text-purple-600" />
              <span className="truncate max-w-[140px]">{loadedSession.title}</span>
            </div>
          )}

          {trackingStatus === 'running' && (
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>ÉLŐ NYOMKÖVETÉS</span>
            </div>
          )}
          {trackingStatus === 'paused' && (
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full font-bold">
              <Pause className="w-3 h-3 fill-current" />
              <span>SZÜNETEL</span>
            </div>
          )}
          {trackingStatus === 'idle' && !loadedSession && (
            <div className="flex items-center gap-1.5 bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-semibold">
              <Radio className="w-3 h-3 text-slate-400" />
              <span>Készenlétben</span>
            </div>
          )}

          <div className="font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
            {activeLat.toFixed(5)}°, {activeLng.toFixed(5)}°
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onExportGPX && coordinates.length > 0 && (
            <button
              onClick={onExportGPX}
              aria-label="GPX Letöltése"
              title="Aktív GPX letöltése"
              className="hidden sm:flex p-1.5 text-slate-600 hover:text-[#0050cb] hover:bg-blue-50 rounded-xl transition-colors active:scale-95 cursor-pointer"
            >
              <Download className="w-5 h-5" />
            </button>
          )}

          <button
            id="btn-open-settings"
            onClick={onOpenSettings}
            aria-label="Beállítások"
            className="p-1.5 -mr-1 text-[#424656] hover:text-[#0050cb] hover:bg-blue-50 rounded-xl transition-colors active:scale-95 cursor-pointer"
          >
            <SettingsIcon className="w-6 h-6 stroke-[2.2]" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* DESKTOP & TABLET VIEW (md: and above)                                    */}
      {/* Required Layout: [BAL: Gombok] -> [KÖZÉP: Adatok] -> [JOBB: Térkép]       */}
      {/* ========================================================================= */}
      <main className="hidden md:flex flex-1 min-h-0 p-2.5 lg:p-3.5 gap-2.5 lg:gap-3.5 overflow-hidden">
        {/* ------------------------------------------------------------- */}
        {/* BAL OLDALT (LEFT): Gombok, Vezérlés & Műveletek               */}
        {/* ------------------------------------------------------------- */}
        <section className="w-44 md:w-48 lg:w-52 shrink-0 flex flex-col justify-between gap-2 bg-white/95 rounded-2xl border border-slate-200/80 shadow-xs p-2.5 overflow-hidden">
          <div className="flex flex-col gap-2">
            {/* Clock & Status Header */}
            <div className="pb-1 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-[#0060e6]">
                {displayClock}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {trackingStatus === 'running' ? '● Aktív' : trackingStatus === 'paused' ? '❚❚ Szünet' : 'Kész'}
              </span>
            </div>

            {/* 1. Start / Pause / Resume Button */}
            {trackingStatus === 'idle' && (
              <button
                id="btn-desktop-start"
                onClick={onStart}
                className="w-full h-11 bg-[#0066ff] hover:bg-[#0054d6] active:bg-[#0048b8] text-white font-black text-sm md:text-base rounded-xl shadow-[0_4px_12px_rgba(0,102,255,0.25)] active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer font-heading"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>{loadedSession ? 'Indítás' : 'Start'}</span>
              </button>
            )}

            {trackingStatus === 'running' && (
              <button
                id="btn-desktop-pause"
                onClick={onPause}
                className="w-full h-11 bg-[#e67e00] hover:bg-[#c96e00] active:bg-[#a85c00] text-white font-black text-sm md:text-base rounded-xl shadow-[0_4px_12px_rgba(230,126,0,0.25)] active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer font-heading"
              >
                <Pause className="w-5 h-5 fill-current" />
                <span>Szünet</span>
              </button>
            )}

            {trackingStatus === 'paused' && (
              <button
                id="btn-desktop-resume"
                onClick={onResume}
                className="w-full h-11 bg-[#0066ff] hover:bg-[#0054d6] active:bg-[#0048b8] text-white font-black text-sm md:text-base rounded-xl shadow-[0_4px_12px_rgba(0,102,255,0.25)] active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer font-heading"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Folytatás</span>
              </button>
            )}

            {/* 2. Résztáv (Split / Lap) Button */}
            <button
              id="btn-desktop-split"
              onClick={onSplit}
              disabled={trackingStatus === 'idle'}
              className={`w-full h-10 font-black text-xs md:text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 font-heading ${
                trackingStatus === 'idle'
                  ? 'bg-slate-100 border border-slate-200 text-slate-400 opacity-50 cursor-not-allowed shadow-none'
                  : 'bg-white border-2 border-[#0066ff] text-[#0066ff] hover:bg-blue-50 active:bg-blue-100 shadow-2xs active:scale-98 cursor-pointer'
              }`}
            >
              <Flag className="w-4 h-4 text-[#0066ff]" />
              <span>Résztáv ({splits.length})</span>
            </button>

            {/* 3. Stop Button */}
            <button
              id="btn-desktop-stop"
              onClick={onStop}
              disabled={trackingStatus === 'idle'}
              className={`w-full h-9 font-black text-xs md:text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 font-heading ${
                trackingStatus === 'idle'
                  ? 'bg-red-50 border border-red-100 text-red-300 opacity-40 cursor-not-allowed shadow-none'
                  : 'bg-[#ba1a1a] hover:bg-[#a01616] active:bg-[#851212] text-white shadow-[0_3px_10px_rgba(186,26,26,0.2)] active:scale-98 cursor-pointer'
              }`}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </button>

            {/* Activity Mode Switcher */}
            <div className="pt-1">
              <div className="grid grid-cols-3 gap-1">
                {(['car', 'cycling', 'walking'] as ActivityMode[]).map((mode) => {
                  const isActive = settings.activityMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onUpdateSettings && onUpdateSettings({ activityMode: mode })}
                      className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#eaf2ff] text-[#0050cb] border-blue-300 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {getActivityIcon(mode)}
                      <span className="text-[9px] mt-0.5">{getActivityLabel(mode)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Info Status in Left Column */}
          <div className="pt-1.5 border-t border-slate-100 flex flex-col gap-1.5 text-xs">
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/70 space-y-1">
              <div className="flex items-center justify-between text-slate-500 font-medium text-[10.5px]">
                <span>GPS:</span>
                <span className="font-bold text-slate-800">
                  {settings.simulationMode ? 'Szimuláció' : 'Valós'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500 font-medium text-[10.5px]">
                <span>Átlag:</span>
                <span className="font-bold text-slate-800">{avgSpeed} km/h</span>
              </div>
              <div className="flex items-center justify-between text-slate-500 font-medium text-[10.5px]">
                <span>Pontok:</span>
                <span className="font-bold text-[#0050cb]">{coordinates.length} db</span>
              </div>
            </div>

            <button
              onClick={onOpenCoordinates}
              type="button"
              className="w-full py-1.5 px-2 bg-white hover:bg-blue-50 border border-slate-200 text-[#0050cb] rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <MapPin className="w-3 h-3" />
              <span>Koordináták</span>
            </button>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* KÖZÉPEN (MIDDLE): Adatok, Relatív Távolságok & Résztávok       */}
        {/* ------------------------------------------------------------- */}
        <section className="flex-1 min-w-[280px] max-w-xl xl:max-w-2xl flex flex-col min-h-0 gap-2 overflow-hidden">
          {/* Loaded Track Banner (if a track is loaded) */}
          {loadedSession && (
            <div className="flex-shrink-0 bg-purple-50/90 border border-purple-200 rounded-xl px-2.5 py-1.5 shadow-2xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Target className="w-4 h-4 text-purple-600 shrink-0" />
                <div className="min-w-0 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-800 truncate">
                    {loadedSession.title}
                  </span>
                  <span className="text-[11px] text-purple-900/80 font-medium">
                    {formatDistanceByUnit(loadedSession.totalDistanceKm, settings.unit).value} {formatDistanceByUnit(loadedSession.totalDistanceKm, settings.unit).unitLabel} • {loadedSession.splits?.length || 0} pont
                  </span>
                  {referenceMetrics && (
                    <span className="text-[11px] font-bold text-purple-700">
                      • {referenceMetrics.progressPercent}%
                    </span>
                  )}
                </div>
              </div>

              {onUnloadSession && (
                <button
                  type="button"
                  onClick={onUnloadSession}
                  className="p-1 text-purple-400 hover:text-purple-700 hover:bg-purple-100 rounded-lg transition-all cursor-pointer"
                  title="Betöltött útvonal bezárása"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* 1. Megtett Távolság Display (Compact, cím nélkül) */}
          <div className="flex-shrink-0 bg-[#eaf2ff] rounded-xl px-3 py-1.5 shadow-2xs border border-blue-100/80 flex items-center justify-between relative">
            <div className="flex items-baseline">
              <span className="text-2xl md:text-3xl font-black tracking-tight text-[#0060e6] leading-none font-heading">
                {formattedDistanceObj.value}
              </span>
              <span className="text-base md:text-lg font-bold text-[#0060e6] ml-1.5 select-none font-heading">
                {formattedDistanceObj.unitLabel}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 bg-white/80 px-2 py-0.5 rounded-full border border-blue-200/60 shadow-2xs">
                {getActivityIcon(settings.activityMode)}
                <span className="text-[11px] font-bold text-slate-700">{getActivityLabel(settings.activityMode)}</span>
              </div>

              {trackingStatus === 'running' && (
                <div className="flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Élő</span>
                </div>
              )}
              {trackingStatus === 'paused' && (
                <div className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Szünet</span>
                </div>
              )}
            </div>
          </div>

          {/* 2. Relatív Távolságok / Live Információk (Kompakt kártyák fölösleges címek nélkül) */}
          {loadedSession && referenceMetrics ? (
            <div className="flex-shrink-0 grid grid-cols-3 gap-1.5">
              {/* Card 1: Legközelebbi Ponthoz viszonyított távolság */}
              <div className="bg-white rounded-xl p-2 shadow-2xs border border-purple-200/80 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] font-bold text-purple-700 uppercase">
                  <span>Legközelebbi</span>
                  {referenceMetrics.nextSplit && (
                    <span className="font-mono text-[10px] bg-purple-50 text-purple-700 font-bold px-1 py-0.2 rounded">
                      {referenceMetrics.nextSplit.bearingCompass}
                    </span>
                  )}
                </div>
                <div className="mt-0.5">
                  {referenceMetrics.nextSplit ? (
                    <>
                      <div className="text-lg md:text-xl font-black text-purple-700 font-heading leading-tight truncate tracking-tight">
                        {referenceMetrics.nextSplit.formattedRelative}
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 truncate mt-0.5">
                        {referenceMetrics.nextSplit.name}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Célban!</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: Starttól táv */}
              <div className="bg-white rounded-xl p-2 shadow-2xs border border-slate-200/80 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  Starttól
                </span>
                <div className="mt-0.5">
                  <div className="text-lg md:text-xl font-black text-emerald-600 font-heading leading-tight tracking-tight">
                    {referenceMetrics.formattedDistanceFromStart}
                  </div>
                </div>
              </div>

              {/* Card 3: Célig táv */}
              <div className="bg-white rounded-xl p-2 shadow-2xs border border-slate-200/80 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  Célig
                </span>
                <div className="mt-0.5">
                  <div className="text-lg md:text-xl font-black text-rose-600 font-heading leading-tight tracking-tight">
                    {referenceMetrics.formattedDistanceToEnd}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Standard Live Metrics if no track is loaded */
            <div className="flex-shrink-0 grid grid-cols-2 gap-1.5">
              {/* Left: Time Card */}
              <div className="bg-white rounded-xl px-3 py-1.5 shadow-2xs border border-slate-200/80 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Eltelt Idő</span>
                <span className="text-lg md:text-xl font-black text-slate-900 tracking-tight leading-tight font-heading">
                  {formatElapsedTime(elapsedSeconds)}
                </span>
              </div>

              {/* Right: GPS Coordinates Card */}
              <button
                id="btn-desktop-coordinates-card"
                onClick={onOpenCoordinates}
                title="Kattints a koordináták részleteihez és másolásához"
                className="bg-white hover:bg-blue-50/40 rounded-xl px-3 py-1.5 shadow-2xs border border-slate-200/80 hover:border-blue-300 flex flex-col justify-between text-left transition-all active:scale-98 cursor-pointer relative group"
              >
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                  <span>GPS Pozíció</span>
                  <MapPin className="w-3 h-3 text-[#0060e6] group-hover:scale-110 transition-transform" />
                </div>
                <div className="font-mono font-bold text-slate-800 text-xs truncate">
                  {activeLat.toFixed(5)}°, {activeLng.toFixed(5)}°
                </div>
              </button>
            </div>
          )}

          {/* 3. Görgethető Résztávok (Splits) Panel */}
          <div className="flex-1 flex flex-col min-h-0 bg-white/90 rounded-2xl border border-slate-200/80 p-2.5 shadow-xs overflow-hidden">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSplitsTab('active')}
                  className={`text-xs font-black uppercase tracking-wider font-heading flex items-center gap-1 px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                    splitsTab === 'active'
                      ? 'bg-blue-100 text-[#0050cb]'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <Flag className="w-3 h-3 text-[#0060e6]" />
                  <span>Rögzített ({splits.length})</span>
                </button>

                {loadedSession && (
                  <button
                    type="button"
                    onClick={() => setSplitsTab('loaded')}
                    className={`text-xs font-black uppercase tracking-wider font-heading flex items-center gap-1 px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                      splitsTab === 'loaded'
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <Target className="w-3 h-3 text-purple-600" />
                    <span>Betöltött Pontok ({referenceMetrics?.splitsProgress.length || loadedSessionSplits?.length || 0})</span>
                  </button>
                )}
              </div>
            </div>

            <div
              ref={desktopSplitsContainerRef}
              className="flex-1 overflow-y-auto min-h-0 space-y-2 mt-2 pr-1 custom-scrollbar pb-1"
            >
              {/* Tab 1: Active Live Splits */}
              {splitsTab === 'active' && (
                <>
                  {/* Live in-progress split indicator if tracking */}
                  {trackingStatus !== 'idle' && (
                    <div className="bg-[#f0f6ff] rounded-2xl p-2.5 border-2 border-dashed border-[#0060e6]/40 shadow-xs flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative flex items-center justify-center w-8 h-8 select-none">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-[#0060e6] opacity-75 animate-ping"></span>
                          <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-[#0060e6] text-white text-sm font-black font-heading shadow-sm">
                            {(splits.length + 1).toString().padStart(2, '0')}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-baseline gap-2.5 flex-wrap">
                            <span className="text-base lg:text-lg font-black text-slate-900 font-heading leading-tight">
                              {formatDistanceByUnit(currentSplitDistanceKm, settings.unit).value}{' '}
                              {formatDistanceByUnit(currentSplitDistanceKm, settings.unit).unitLabel}
                            </span>
                            <span className="text-xs font-bold text-slate-500 font-heading">
                              (Össz: {formatDistanceByUnit(totalDistanceKm, settings.unit).value}{' '}
                              {formatDistanceByUnit(totalDistanceKm, settings.unit).unitLabel})
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-[#0060e6] font-mono px-2.5 py-1 bg-white rounded-xl shadow-2xs border border-blue-100">
                        {Math.floor(currentSplitTimeSec / 60).toString().padStart(2, '0')}:
                        {(currentSplitTimeSec % 60).toString().padStart(2, '0')}
                      </div>
                    </div>
                  )}

                  {splits.length === 0 && trackingStatus === 'idle' ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-white/50 rounded-2xl border border-dashed border-slate-200">
                      <Flag className="w-8 h-8 text-blue-200 mb-2" />
                      <p className="text-xs font-bold text-slate-600">
                        Nincsenek még rögzített résztávok
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                        Kattints a bal oldali <strong className="text-[#0060e6]">Start</strong> gombra, majd a <strong>Résztáv</strong> gombbal rögzíthetsz szakaszokat!
                      </p>
                    </div>
                  ) : (
                    splits.map((split) => {
                      const formattedSplitDist = formatDistanceByUnit(split.distanceKm, settings.unit);
                      const totalKm = getCumulativeDistanceForSplit(split, splits);
                      const formattedTotalDist = formatDistanceByUnit(totalKm, settings.unit);
                      const isFocused = focusedSplitId === split.id;
                      const hasPhotos = split.photos && split.photos.length > 0;
                      const hasNotes = !!split.notes;

                      return (
                        <div
                          key={split.id}
                          onClick={() => setFocusedSplitId(split.id === focusedSplitId ? null : split.id)}
                          className={`rounded-2xl p-3 border-l-4 shadow-2xs flex flex-col gap-1.5 transition-all cursor-pointer ${
                            isFocused
                              ? 'bg-blue-100/90 border-l-[#0050cb] ring-2 ring-[#0050cb]/30 shadow-sm scale-[1.01]'
                              : 'bg-[#eaf2ff] border-l-[#0060e6] hover:bg-[#e4effe] active:scale-[0.99]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`text-xl font-black tracking-tight w-7 text-center select-none font-heading flex-shrink-0 ${
                                  isFocused ? 'text-[#0050cb]' : 'text-[#0060e6]'
                                }`}
                              >
                                {split.formattedIndex}
                              </span>
                              <div className="min-w-0">
                                {split.name && (
                                  <div className="text-xs font-black text-[#0050cb] truncate font-heading">
                                    {split.name}
                                  </div>
                                )}
                                <div className="flex items-baseline gap-2 flex-wrap">
                                  <span className="text-base font-black text-slate-900 font-heading leading-tight">
                                    {formattedSplitDist.value} {formattedSplitDist.unitLabel}
                                  </span>
                                  <span className="text-xs font-bold text-slate-500 font-heading">
                                    (Össz: {formattedTotalDist.value} {formattedTotalDist.unitLabel})
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-sm font-black text-[#0060e6] font-mono select-none">
                                {split.formattedTime}
                              </span>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSplit(split);
                                }}
                                className="p-1.5 bg-white/80 hover:bg-white text-[#0050cb] hover:text-blue-700 rounded-lg shadow-2xs transition-all active:scale-90 cursor-pointer border border-blue-200/50"
                                title="Résztáv szerkesztése, megjegyzés, fotó, megosztás"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {(hasNotes || hasPhotos) && (
                            <div className="flex items-center gap-2 pt-0.5 pl-9 flex-wrap text-[11px]">
                              {hasNotes && (
                                <div className="flex items-center gap-1 bg-white/70 px-2 py-0.5 rounded-md text-slate-700 font-medium truncate max-w-[200px]">
                                  <MessageSquare className="w-3 h-3 text-[#0050cb] flex-shrink-0" />
                                  <span className="truncate">{split.notes}</span>
                                </div>
                              )}
                              {hasPhotos && (
                                <div className="flex items-center gap-1 bg-white/70 px-2 py-0.5 rounded-md text-[#0050cb] font-bold">
                                  <Camera className="w-3 h-3 flex-shrink-0" />
                                  <span>{split.photos!.length} fotó</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {/* Tab 2: Loaded Track Waypoints with Dynamic Relative Distance along track */}
              {splitsTab === 'loaded' && referenceMetrics && (
                <div className="space-y-2">
                  {referenceMetrics.splitsProgress.map((sp, idx) => {
                    const isActivePoint = referenceMetrics.activeSplitIndex === idx;
                    const isFocused = focusedSplitId === sp.split.id;
                    const isStart = sp.split.id.startsWith('start') || sp.split.splitIndex === 0 || sp.split.formattedIndex === 'START';
                    const isStop = sp.split.id.startsWith('stop') || sp.split.formattedIndex === 'CÉL';
                    const hasNotes = !!sp.split.notes;
                    const hasPhotos = sp.split.photos && sp.split.photos.length > 0;

                    return (
                      <div
                        id={`desktop-ref-split-${idx}`}
                        key={sp.split.id || idx}
                        onClick={() => setFocusedSplitId(sp.split.id === focusedSplitId ? null : sp.split.id)}
                        className={`rounded-2xl p-3 border-l-4 shadow-2xs flex flex-col gap-1.5 transition-all cursor-pointer ${
                          isActivePoint
                            ? 'bg-purple-100/95 border-l-purple-600 ring-2 ring-purple-500/50 shadow-md scale-[1.01]'
                            : sp.isPassed
                            ? 'bg-emerald-50/70 border-l-emerald-500 hover:bg-emerald-50'
                            : isFocused
                            ? isStart
                              ? 'bg-emerald-100/80 border-l-emerald-600 ring-1 ring-emerald-400'
                              : isStop
                              ? 'bg-rose-100/80 border-l-rose-600 ring-1 ring-rose-400'
                              : 'bg-purple-50 border-l-purple-500 ring-1 ring-purple-300'
                            : isStart
                            ? 'bg-emerald-50/50 border-l-emerald-400 hover:bg-emerald-50'
                            : isStop
                            ? 'bg-rose-50/50 border-l-rose-400 hover:bg-rose-50'
                            : 'bg-white border-l-purple-300 hover:bg-purple-50/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`text-xs font-black px-2 py-0.5 rounded-md text-center font-heading flex-shrink-0 ${
                                isStart
                                  ? 'bg-emerald-600 text-white'
                                  : isStop
                                  ? 'bg-rose-600 text-white'
                                  : isActivePoint
                                  ? 'bg-purple-700 text-white'
                                  : sp.isPassed
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {isStart ? '🚩 START' : isStop ? '🏁 CÉL' : sp.isPassed ? '✓' : `#${sp.split.formattedIndex || idx}`}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-black text-slate-800 truncate font-heading flex items-center gap-1.5">
                                <span>{sp.split.name || (isStart ? 'Kezdőpont' : isStop ? 'Cél / Végpont' : `Ellenőrzőpont #${idx}`)}</span>
                                {isActivePoint && (
                                  <span className="text-[9px] uppercase bg-purple-600 text-white font-extrabold px-1.5 py-0.5 rounded-md shadow-2xs">
                                    🎯 Legközelebbi (3. a listában)
                                  </span>
                                )}
                                {sp.isPassed && !isActivePoint && (
                                  <span className="text-[9px] uppercase bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-md">
                                    ✓ Elhagyva
                                  </span>
                                )}
                              </div>
                              <div className="flex items-baseline gap-2 text-[11px] text-slate-500 mt-0.5">
                                <span>
                                  {isStart
                                    ? '0.00 km (Startvonal)'
                                    : isStop
                                    ? `Célvonal (${sp.split.formattedDistance || `${sp.split.distanceKm} km`})`
                                    : `Nyomvonal pozíció: ${sp.split.formattedDistance || `${sp.split.distanceKm} km`}`}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="flex flex-col items-end">
                              <span className={`font-black font-heading font-mono tracking-tight ${
                                isActivePoint
                                  ? 'text-purple-700 text-xl sm:text-2xl'
                                  : sp.isPassed
                                  ? 'text-emerald-600 text-lg sm:text-xl'
                                  : 'text-slate-800 text-lg sm:text-xl'
                              }`}>
                                {sp.formattedRelative}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono font-medium">
                                Irány: {sp.bearingCompass}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSplit(sp.split);
                              }}
                              className="p-1.5 bg-white/90 hover:bg-white text-slate-700 hover:text-purple-700 rounded-lg shadow-2xs transition-all active:scale-90 cursor-pointer border border-slate-200"
                              title="Pont részletei, megjegyzések, fotók"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Notes / Photos preview badge */}
                        {(hasNotes || hasPhotos) && (
                          <div className="flex items-center gap-2 pt-0.5 pl-2 flex-wrap text-[11px]">
                            {hasNotes && (
                              <div className="flex items-center gap-1 bg-white/80 px-2 py-0.5 rounded-md text-slate-700 font-medium truncate max-w-[220px]">
                                <MessageSquare className="w-3 h-3 text-purple-600 flex-shrink-0" />
                                <span className="truncate">{sp.split.notes}</span>
                              </div>
                            )}
                            {hasPhotos && (
                              <div className="flex items-center gap-1 bg-white/80 px-2 py-0.5 rounded-md text-purple-700 font-bold">
                                <Camera className="w-3 h-3 flex-shrink-0" />
                                <span>{sp.split.photos!.length} fotó</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* JOBB OLDALT (RIGHT): Térkép                                   */}
        {/* ------------------------------------------------------------- */}
        <section className="flex-1 min-w-[320px] h-full flex flex-col min-h-0 rounded-2xl overflow-hidden shadow-sm border border-slate-200/80 relative bg-slate-100">
          <OsmMap
            coordinates={coordinates}
            currentLocation={currentLocation}
            splits={splits}
            referenceCoordinates={loadedSession?.coordinates}
            referenceSplits={loadedSessionSplits}
            referenceTitle={loadedSession?.title}
            mapLayer={settings.mapLayer}
            isTracking={trackingStatus === 'running'}
            showLayerSelector={true}
            showZoomControls={true}
            onLayerChange={onLayerChange}
            focusedSplitId={focusedSplitId}
            onSelectSplit={(split) => setFocusedSplitId(split.id)}
          />

          {/* Floating map info badge */}
          <div className="absolute top-3 left-14 z-10 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-xl shadow-xs border border-slate-200/80 flex items-center gap-2 text-[11px] font-semibold text-slate-700 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-[#0060e6]"></span>
            <span>OpenStreetMap ({settings.mapLayer.toUpperCase()})</span>
            {loadedSession && (
              <span className="text-purple-700 font-bold ml-1">• Betöltött Guideline</span>
            )}
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* MOBILE VIEW (< md)                                                        */}
      {/* Stacked phone view with fixed layout and scrollable splits                */}
      {/* ========================================================================= */}
      <main className="flex md:hidden flex-1 flex-col min-h-0 px-3 pt-1.5 pb-2 gap-2 overflow-hidden">
        {/* Loaded Track Banner (Mobile) */}
        {loadedSession && (
          <div className="flex-shrink-0 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-2 px-2.5 shadow-2xs flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <Target className="w-4 h-4 text-purple-600 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-800 truncate">
                  🎯 {loadedSession.title}
                </div>
                <div className="text-[10px] text-purple-800 font-medium truncate">
                  {formatDistanceByUnit(loadedSession.totalDistanceKm, settings.unit).value} {formatDistanceByUnit(loadedSession.totalDistanceKm, settings.unit).unitLabel} • {referenceMetrics?.splitsProgress.length || loadedSessionSplits?.length || 0} pont
                </div>
              </div>
            </div>
            {onUnloadSession && (
              <button
                type="button"
                onClick={onUnloadSession}
                className="p-1 text-purple-400 hover:text-purple-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* 1. Mobile OSM Map */}
        <section className="flex-shrink-0 w-full h-[145px] sm:h-[175px] rounded-2xl overflow-hidden shadow-sm border border-slate-200/70 relative">
          <OsmMap
            coordinates={coordinates}
            currentLocation={currentLocation}
            splits={splits}
            referenceCoordinates={loadedSession?.coordinates}
            referenceSplits={loadedSessionSplits}
            referenceTitle={loadedSession?.title}
            mapLayer={settings.mapLayer}
            isTracking={trackingStatus === 'running'}
            showLayerSelector={true}
            showZoomControls={true}
            onLayerChange={onLayerChange}
            focusedSplitId={focusedSplitId}
            onSelectSplit={(split) => setFocusedSplitId(split.id)}
          />
        </section>

        {/* 2. Mobile Distance Display Card */}
        <section className="flex-shrink-0 bg-[#eaf2ff] rounded-2xl px-3.5 py-2.5 shadow-[0_2px_8px_rgba(0,102,255,0.06)] border border-blue-100/60 flex items-baseline relative">
          <span className="text-[32px] font-black tracking-tight text-[#0060e6] leading-none font-heading">
            {formattedDistanceObj.value}
          </span>
          <span className="text-lg font-bold text-[#0060e6] ml-2 select-none font-heading">
            {formattedDistanceObj.unitLabel}
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            <div className="flex items-center gap-1 bg-white/70 px-2 py-0.5 rounded-full border border-blue-200/50 shadow-2xs">
              {getActivityIcon(settings.activityMode)}
              <span className="text-[11px] font-bold text-slate-700">{getActivityLabel(settings.activityMode)}</span>
            </div>

            {trackingStatus === 'running' && (
              <div className="flex items-center gap-1 bg-blue-100/90 px-2 py-0.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Élő</span>
              </div>
            )}
            {trackingStatus === 'paused' && (
              <div className="bg-amber-100/90 px-2 py-0.5 rounded-full">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Szünet</span>
              </div>
            )}
          </div>
        </section>

        {/* 3. Mobile Relative Guidance / Info Grid */}
        {loadedSession && referenceMetrics ? (
          <section className="flex-shrink-0 grid grid-cols-3 gap-1.5">
            {/* Next split card */}
            <div className="bg-white rounded-xl p-2 sm:p-2.5 shadow-2xs border border-purple-200 flex flex-col justify-between min-h-[62px]">
              <span className="text-[10.5px] sm:text-[11px] font-extrabold text-purple-700 uppercase tracking-wide truncate">
                Következő
              </span>
              <div className="text-[17px] sm:text-lg font-black text-purple-700 font-heading leading-tight truncate tracking-tight">
                {referenceMetrics.nextSplit ? referenceMetrics.nextSplit.formattedRelative : '✓ Célban'}
              </div>
            </div>

            {/* From start */}
            <div className="bg-white rounded-xl p-2 sm:p-2.5 shadow-2xs border border-slate-100 flex flex-col justify-between min-h-[62px]">
              <span className="text-[10.5px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wide truncate">
                Starttól
              </span>
              <div className="text-[17px] sm:text-lg font-black text-emerald-600 font-heading leading-tight truncate tracking-tight">
                {referenceMetrics.formattedDistanceFromStart}
              </div>
            </div>

            {/* To end */}
            <div className="bg-white rounded-xl p-2 sm:p-2.5 shadow-2xs border border-slate-100 flex flex-col justify-between min-h-[62px]">
              <span className="text-[10.5px] sm:text-[11px] font-extrabold text-slate-500 uppercase tracking-wide truncate">
                Célig
              </span>
              <div className="text-[17px] sm:text-lg font-black text-rose-600 font-heading leading-tight truncate tracking-tight">
                {referenceMetrics.formattedDistanceToEnd}
              </div>
            </div>
          </section>
        ) : (
          <section className="flex-shrink-0 grid grid-cols-2 gap-2">
            <div className="bg-white rounded-2xl px-3.5 py-2 min-h-[58px] shadow-sm border border-slate-100/80 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-500 tracking-wide">
                {displayClock}
              </span>
              <span className="text-[20px] font-black text-slate-900 tracking-tight leading-tight font-heading">
                {formatElapsedTime(elapsedSeconds)}
              </span>
            </div>

            <button
              id="btn-coordinates-card"
              onClick={onOpenCoordinates}
              title="Kattints a koordináták részleteihez"
              className="bg-white hover:bg-blue-50/40 rounded-2xl px-3.5 py-2 min-h-[58px] shadow-sm border border-slate-100/80 flex flex-col justify-center text-left transition-all active:scale-98 cursor-pointer relative group"
            >
              <div className="absolute top-1.5 right-1.5 opacity-60">
                <MapPin className="w-3 h-3 text-[#0060e6]" />
              </div>
              <span className="text-[12px] font-bold text-slate-800 font-mono leading-tight truncate">
                {activeLat.toFixed(5)}°
              </span>
              <span className="text-[12px] font-bold text-slate-600 font-mono leading-tight truncate">
                {activeLng.toFixed(5)}°
              </span>
            </button>
          </section>
        )}

        {/* 4. Mobile Scrollable Splits */}
        <section className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {/* Mobile Split Tabs if loaded session exists */}
          {loadedSession && (
            <div className="flex items-center gap-1.5 pb-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => setSplitsTab('loaded')}
                className={`text-[11px] font-black uppercase tracking-wider font-heading flex items-center gap-1 px-2 py-0.5 rounded-lg transition-all ${
                  splitsTab === 'loaded'
                    ? 'bg-purple-100 text-purple-700 shadow-2xs font-extrabold'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <Target className="w-3 h-3 text-purple-600" />
                <span>Betöltött ({referenceMetrics?.splitsProgress.length || loadedSessionSplits?.length || 0})</span>
              </button>

              <button
                type="button"
                onClick={() => setSplitsTab('active')}
                className={`text-[11px] font-black uppercase tracking-wider font-heading flex items-center gap-1 px-2 py-0.5 rounded-lg transition-all ${
                  splitsTab === 'active'
                    ? 'bg-blue-100 text-[#0050cb] shadow-2xs font-extrabold'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <Flag className="w-3 h-3 text-[#0060e6]" />
                <span>Rögzített ({splits.length})</span>
              </button>
            </div>
          )}

          <div
            ref={mobileSplitsContainerRef}
            className="flex-1 overflow-y-auto min-h-0 space-y-1.5 pr-0.5 custom-scrollbar pb-1"
          >
            {/* Live split in progress (if active tab & tracking) */}
            {splitsTab === 'active' && trackingStatus !== 'idle' && (
              <div className="bg-[#f0f6ff] rounded-2xl p-2 border-2 border-dashed border-[#0060e6]/40 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="relative flex items-center justify-center w-7 h-7 select-none">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#0060e6] opacity-75 animate-ping"></span>
                    <span className="relative flex items-center justify-center w-7 h-7 rounded-full bg-[#0060e6] text-white text-xs font-black font-heading shadow-md">
                      {(splits.length + 1).toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-base font-black text-slate-900 font-heading leading-tight">
                        {formatDistanceByUnit(currentSplitDistanceKm, settings.unit).value}{' '}
                        {formatDistanceByUnit(currentSplitDistanceKm, settings.unit).unitLabel}
                      </span>
                      <span className="text-xs font-bold text-slate-500 font-heading">
                        (Össz: {formatDistanceByUnit(totalDistanceKm, settings.unit).value})
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-xs font-bold text-[#0060e6] font-mono px-2 py-0.5 bg-white rounded-lg shadow-2xs border border-blue-100">
                  {Math.floor(currentSplitTimeSec / 60).toString().padStart(2, '0')}:
                  {(currentSplitTimeSec % 60).toString().padStart(2, '0')}
                </div>
              </div>
            )}

            {/* Empty state for active splits */}
            {splitsTab === 'active' && splits.length === 0 && trackingStatus === 'idle' ? (
              <div className="h-full flex flex-col items-center justify-center p-3 text-center text-slate-400 bg-white/60 rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs font-medium text-slate-500">
                  Nincsenek rögzített résztávok.
                </p>
                <p className="text-[10.5px] text-slate-400 mt-0.5">
                  Kattints a <strong className="text-[#0060e6]">Start</strong> gombra a GPS követés megkezdéséhez!
                </p>
              </div>
            ) : splitsTab === 'active' ? (
              /* Active recorded splits on mobile */
              splits.map((split) => {
                const formattedSplitDist = formatDistanceByUnit(split.distanceKm, settings.unit);
                const totalKm = getCumulativeDistanceForSplit(split, splits);
                const formattedTotalDist = formatDistanceByUnit(totalKm, settings.unit);
                const isFocused = focusedSplitId === split.id;
                const hasPhotos = split.photos && split.photos.length > 0;
                const hasNotes = !!split.notes;

                return (
                  <div
                    key={split.id}
                    onClick={() => setFocusedSplitId(split.id === focusedSplitId ? null : split.id)}
                    className={`rounded-xl p-2.5 border-l-4 shadow-2xs flex flex-col gap-1 transition-all cursor-pointer ${
                      isFocused
                        ? 'bg-blue-100/90 border-l-[#0050cb] ring-2 ring-[#0050cb]/30 shadow-md'
                        : 'bg-[#eaf2ff] border-l-[#0060e6] hover:bg-[#e4effe]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-xl font-black tracking-tight w-7 text-center select-none font-heading flex-shrink-0 ${isFocused ? 'text-[#0050cb]' : 'text-[#0060e6]'}`}>
                          {split.formattedIndex}
                        </span>
                        <div className="min-w-0">
                          {split.name && (
                            <div className="text-sm font-black text-[#0050cb] truncate font-heading">
                              {split.name}
                            </div>
                          )}
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="text-base font-black text-slate-900 font-heading leading-tight">
                              {formattedSplitDist.value} {formattedSplitDist.unitLabel}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500 font-heading">
                              (Össz: {formattedTotalDist.value})
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-sm font-black text-[#0060e6] font-mono select-none">
                          {split.formattedTime}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSplit(split);
                          }}
                          className="p-1.5 bg-white/80 hover:bg-white text-[#0050cb] rounded-lg shadow-2xs border border-blue-200/50"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {(hasNotes || hasPhotos) && (
                      <div className="flex items-center gap-2 pl-7 text-[10.5px]">
                        {hasNotes && (
                          <div className="flex items-center gap-1 text-slate-600 truncate max-w-[190px]">
                            <MessageSquare className="w-2.5 h-2.5 text-[#0050cb] flex-shrink-0" />
                            <span className="truncate">{split.notes}</span>
                          </div>
                        )}
                        {hasPhotos && (
                          <div className="flex items-center gap-1 text-[#0050cb] font-bold">
                            <Camera className="w-2.5 h-2.5 flex-shrink-0" />
                            <span>{split.photos!.length} fotó</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : splitsTab === 'loaded' && referenceMetrics ? (
              /* Loaded Reference Track Waypoints on Mobile with 3rd-Item Follow-Along Positioning */
              referenceMetrics.splitsProgress.map((sp, idx) => {
                const isActivePoint = referenceMetrics.activeSplitIndex === idx;
                const isFocused = focusedSplitId === sp.split.id;
                const isStart = sp.split.id.startsWith('start') || sp.split.splitIndex === 0 || sp.split.formattedIndex === 'START';
                const isStop = sp.split.id.startsWith('stop') || sp.split.formattedIndex === 'CÉL';
                const hasNotes = !!sp.split.notes;
                const hasPhotos = sp.split.photos && sp.split.photos.length > 0;

                return (
                  <div
                    id={`mobile-ref-split-${idx}`}
                    key={sp.split.id || idx}
                    onClick={() => setFocusedSplitId(sp.split.id === focusedSplitId ? null : sp.split.id)}
                    className={`rounded-xl p-2.5 border-l-4 shadow-2xs flex flex-col gap-1 transition-all ${
                      isActivePoint
                        ? 'bg-purple-100 border-l-purple-600 ring-2 ring-purple-500/50 shadow-sm'
                        : sp.isPassed
                        ? 'bg-emerald-50/70 border-l-emerald-500'
                        : isFocused
                        ? 'bg-purple-50 border-l-purple-400 ring-1 ring-purple-300'
                        : isStart
                        ? 'bg-emerald-50/60 border-l-emerald-500'
                        : isStop
                        ? 'bg-rose-50/60 border-l-rose-500'
                        : 'bg-white border-l-purple-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`text-sm font-black px-2 py-0.5 rounded-lg flex-shrink-0 font-heading ${
                            isStart
                              ? 'bg-emerald-600 text-white'
                              : isStop
                              ? 'bg-rose-600 text-white'
                              : isActivePoint
                              ? 'bg-purple-700 text-white'
                              : sp.isPassed
                              ? 'bg-emerald-500 text-white'
                              : 'bg-purple-100 text-purple-700'
                          }`}
                        >
                          {isStart ? 'START' : isStop ? 'CÉL' : sp.isPassed ? '✓' : `#${sp.split.formattedIndex || idx}`}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-800 truncate flex items-center gap-1.5">
                            <span>{sp.split.name || (isStart ? 'Kezdőpont' : isStop ? 'Cél / Végpont' : `Pont #${idx}`)}</span>
                            {isActivePoint && (
                              <span className="text-[9px] uppercase bg-purple-600 text-white font-extrabold px-1.5 py-0.5 rounded">
                                🎯 Legközelebbi
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`font-black font-mono tracking-tight ${
                          isActivePoint ? 'text-purple-700 text-xl' : sp.isPassed ? 'text-emerald-600 text-lg' : 'text-slate-800 text-lg'
                        }`}>
                          {sp.formattedRelative}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSplit(sp.split);
                          }}
                          className="p-1.5 bg-white/90 hover:bg-white text-purple-700 rounded-lg shadow-2xs border border-purple-200"
                          title="Részletek, fotók, megjegyzések"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {(hasNotes || hasPhotos) && (
                      <div className="flex items-center gap-2 pl-1.5 text-[10.5px]">
                        {hasNotes && (
                          <div className="flex items-center gap-1 text-slate-600 truncate max-w-[190px]">
                            <MessageSquare className="w-2.5 h-2.5 text-purple-600 flex-shrink-0" />
                            <span className="truncate">{sp.split.notes}</span>
                          </div>
                        )}
                        {hasPhotos && (
                          <div className="flex items-center gap-1 text-purple-700 font-bold">
                            <Camera className="w-2.5 h-2.5 flex-shrink-0" />
                            <span>{sp.split.photos!.length} fotó</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : null}
          </div>
        </section>

        {/* 5. Mobile Action Buttons (Start, Split, Stop) */}
        <section className="flex-shrink-0 grid grid-cols-3 gap-2 pt-0.5">
          {trackingStatus === 'idle' && (
            <button
              id="btn-start-tracking"
              onClick={onStart}
              className="bg-[#0066ff] hover:bg-[#0054d6] active:bg-[#0048b8] text-white font-black text-sm py-2.5 rounded-2xl shadow-[0_4px_12px_rgba(0,102,255,0.3)] active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer font-heading"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start</span>
            </button>
          )}

          {trackingStatus === 'running' && (
            <button
              id="btn-pause-tracking"
              onClick={onPause}
              className="bg-[#e67e00] hover:bg-[#c96e00] active:bg-[#a85c00] text-white font-black text-sm py-2.5 rounded-2xl shadow-[0_4px_12px_rgba(230,126,0,0.3)] active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer font-heading"
            >
              <Pause className="w-4 h-4 fill-current" />
              <span>Pause</span>
            </button>
          )}

          {trackingStatus === 'paused' && (
            <button
              id="btn-resume-tracking"
              onClick={onResume}
              className="bg-[#0066ff] hover:bg-[#0054d6] active:bg-[#0048b8] text-white font-black text-sm py-2.5 rounded-2xl shadow-[0_4px_12px_rgba(0,102,255,0.3)] active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer font-heading"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Resume</span>
            </button>
          )}

          <button
            id="btn-split-lap"
            onClick={onSplit}
            disabled={trackingStatus === 'idle'}
            className={`font-black text-sm py-2.5 rounded-2xl transition-all flex items-center justify-center gap-1 font-heading ${
              trackingStatus === 'idle'
                ? 'bg-slate-100/80 border-2 border-slate-200 text-slate-300 opacity-40 cursor-not-allowed shadow-none'
                : 'bg-white border-2 border-[#0066ff] text-[#0066ff] hover:bg-blue-50/60 active:bg-blue-100/60 shadow-sm active:scale-95 cursor-pointer'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Résztáv</span>
          </button>

          <button
            id="btn-stop-tracking"
            onClick={onStop}
            disabled={trackingStatus === 'idle'}
            className={`font-black text-sm py-2.5 rounded-2xl transition-all flex items-center justify-center gap-1 font-heading ${
              trackingStatus === 'idle'
                ? 'bg-red-100/60 border border-red-200/50 text-red-300/80 opacity-40 cursor-not-allowed shadow-none'
                : 'bg-[#ba1a1a] hover:bg-[#a01616] active:bg-[#851212] text-white shadow-[0_4px_12px_rgba(186,26,26,0.25)] active:scale-95 cursor-pointer'
            }`}
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop</span>
          </button>
        </section>
      </main>

      {/* Split Details & Edit Modal (Name, Notes, Photos, Share) */}
      {editingSplit && (
        <SplitDetailModal
          split={editingSplit}
          allSplits={splitsTab === 'loaded' ? (loadedSessionSplits || splits) : splits}
          unit={settings.unit}
          presets={settings.pointPresets}
          isOpen={true}
          onClose={() => setEditingSplit(null)}
          onSave={(updated) => {
            if (onUpdateSplit) {
              onUpdateSplit(updated);
            }
            setEditingSplit(null);
          }}
        />
      )}
    </div>
  );
};

