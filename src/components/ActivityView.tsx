import React, { useRef, useEffect, useState } from 'react';
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
} from 'lucide-react';
import { Coordinate, Split, TrackingStatus, UserSettings, ActivityMode } from '../types';
import { OsmMap, MapLayerType } from './OsmMap';
import { SplitDetailModal } from './SplitDetailModal';
import {
  formatElapsedTime,
  formatDMS,
  formatDistanceByUnit,
  getCumulativeDistanceForSplit,
  exportToGPX,
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
  const splitsContainerRef = useRef<HTMLDivElement>(null);
  const [focusedSplitId, setFocusedSplitId] = useState<string | null>(null);
  const [editingSplit, setEditingSplit] = useState<Split | null>(null);

  // Auto scroll to top of splits when new split is added (since newest split is at the top)
  useEffect(() => {
    if (splitsContainerRef.current) {
      splitsContainerRef.current.scrollTop = 0;
    }
  }, [splits.length]);

  // Compute active DMS coordinates
  const activeLat = currentLocation?.lat ?? (coordinates.length > 0 ? coordinates[coordinates.length - 1].lat : 37.777528);
  const activeLng = currentLocation?.lng ?? (coordinates.length > 0 ? coordinates[coordinates.length - 1].lng : -122.416389);
  const dms = formatDMS(activeLat, activeLng);

  // Start clock display (e.g. 14:30 or current time)
  const displayClock = React.useMemo(() => {
    const timeToUse = startTime ? new Date(startTime) : new Date();
    const hh = timeToUse.getHours().toString().padStart(2, '0');
    const mm = timeToUse.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  }, [startTime]);

  // Display distance formatted according to selected unit (km, m, mi)
  const formattedDistanceObj = formatDistanceByUnit(totalDistanceKm, settings.unit);

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
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-white/95 border-b border-slate-100 z-20">
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
        <div className="hidden md:flex items-center gap-3 text-xs">
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
          {trackingStatus === 'idle' && (
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
      <main className="hidden md:flex flex-1 min-h-0 p-3 lg:p-4 gap-3 lg:gap-4 overflow-hidden">
        {/* ------------------------------------------------------------- */}
        {/* BAL OLDALT (LEFT): Gombok, Vezérlés & Műveletek               */}
        {/* ------------------------------------------------------------- */}
        <section className="w-60 lg:w-72 xl:w-80 shrink-0 flex flex-col justify-between gap-3 bg-white/90 rounded-2xl border border-slate-200/80 shadow-xs p-3.5 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col gap-3">
            <div className="pb-1 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider font-heading">
                Vezérlés & Műveletek
              </h2>
              <span className="text-[11px] font-mono font-bold text-[#0060e6]">
                {displayClock}
              </span>
            </div>

            {/* 1. Start / Pause / Resume Button */}
            {trackingStatus === 'idle' && (
              <button
                id="btn-desktop-start"
                onClick={onStart}
                className="w-full h-14 bg-[#0066ff] hover:bg-[#0054d6] active:bg-[#0048b8] text-white font-black text-lg rounded-2xl shadow-[0_6px_16px_rgba(0,102,255,0.3)] active:scale-98 transition-all flex items-center justify-center gap-2.5 cursor-pointer font-heading"
              >
                <Play className="w-6 h-6 fill-current" />
                <span>Start Nyomkövetés</span>
              </button>
            )}

            {trackingStatus === 'running' && (
              <button
                id="btn-desktop-pause"
                onClick={onPause}
                className="w-full h-14 bg-[#e67e00] hover:bg-[#c96e00] active:bg-[#a85c00] text-white font-black text-lg rounded-2xl shadow-[0_6px_16px_rgba(230,126,0,0.3)] active:scale-98 transition-all flex items-center justify-center gap-2.5 cursor-pointer font-heading"
              >
                <Pause className="w-6 h-6 fill-current" />
                <span>Szünet (Pause)</span>
              </button>
            )}

            {trackingStatus === 'paused' && (
              <button
                id="btn-desktop-resume"
                onClick={onResume}
                className="w-full h-14 bg-[#0066ff] hover:bg-[#0054d6] active:bg-[#0048b8] text-white font-black text-lg rounded-2xl shadow-[0_6px_16px_rgba(0,102,255,0.3)] active:scale-98 transition-all flex items-center justify-center gap-2.5 cursor-pointer font-heading"
              >
                <Play className="w-6 h-6 fill-current" />
                <span>Folytatás (Resume)</span>
              </button>
            )}

            {/* 2. Résztáv (Split / Lap) Button */}
            <button
              id="btn-desktop-split"
              onClick={onSplit}
              disabled={trackingStatus === 'idle'}
              className={`w-full h-13 font-black text-base rounded-2xl transition-all flex items-center justify-center gap-2 font-heading ${
                trackingStatus === 'idle'
                  ? 'bg-slate-100 border border-slate-200 text-slate-400 opacity-50 cursor-not-allowed shadow-none'
                  : 'bg-white border-2 border-[#0066ff] text-[#0066ff] hover:bg-blue-50 active:bg-blue-100 shadow-sm active:scale-98 cursor-pointer'
              }`}
            >
              <Flag className="w-5 h-5 text-[#0066ff]" />
              <span>Résztáv rögzítése ({splits.length})</span>
            </button>

            {/* 3. Stop Button */}
            <button
              id="btn-desktop-stop"
              onClick={onStop}
              disabled={trackingStatus === 'idle'}
              className={`w-full h-12 font-black text-base rounded-2xl transition-all flex items-center justify-center gap-2 font-heading ${
                trackingStatus === 'idle'
                  ? 'bg-red-50 border border-red-100 text-red-300 opacity-40 cursor-not-allowed shadow-none'
                  : 'bg-[#ba1a1a] hover:bg-[#a01616] active:bg-[#851212] text-white shadow-[0_4px_12px_rgba(186,26,26,0.25)] active:scale-98 cursor-pointer'
              }`}
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Leállítás & Mentés (Stop)</span>
            </button>

            {/* Activity Mode Switcher */}
            <div className="pt-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Tevékenység Típusa
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['car', 'cycling', 'walking'] as ActivityMode[]).map((mode) => {
                  const isActive = settings.activityMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onUpdateSettings && onUpdateSettings({ activityMode: mode })}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#eaf2ff] text-[#0050cb] border-blue-300 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {getActivityIcon(mode)}
                      <span className="text-[10px] mt-1">{getActivityLabel(mode)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Info Status in Left Column */}
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2 text-xs">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 space-y-1.5">
              <div className="flex items-center justify-between text-slate-500 font-medium text-[11px]">
                <span>GPS Állapot:</span>
                <span className="font-bold text-slate-800">
                  {settings.simulationMode ? 'Szimuláció' : 'Valós GPS'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500 font-medium text-[11px]">
                <span>Átlagsebesség:</span>
                <span className="font-bold text-slate-800">{avgSpeed} km/h</span>
              </div>
              <div className="flex items-center justify-between text-slate-500 font-medium text-[11px]">
                <span>Pontok száma:</span>
                <span className="font-bold text-[#0050cb]">{coordinates.length} db</span>
              </div>
            </div>

            <button
              onClick={onOpenCoordinates}
              type="button"
              className="w-full py-2 px-3 bg-white hover:bg-blue-50 border border-slate-200 text-[#0050cb] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Koordináta részletek</span>
            </button>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* KÖZÉPEN (MIDDLE): Adatok & Résztávok                          */}
        {/* ------------------------------------------------------------- */}
        <section className="flex-1 min-w-[300px] max-w-xl xl:max-w-2xl flex flex-col min-h-0 gap-3 overflow-hidden">
          {/* 1. Összes Távolság Banner */}
          <div className="flex-shrink-0 bg-[#eaf2ff] rounded-2xl px-5 py-4 shadow-[0_2px_10px_rgba(0,102,255,0.06)] border border-blue-100/70 flex items-baseline relative">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700/80 mb-0.5">
                Összes Megtett Távolság
              </span>
              <div className="flex items-baseline">
                <span className="text-4xl lg:text-5xl font-black tracking-tight text-[#0060e6] leading-none font-heading">
                  {formattedDistanceObj.value}
                </span>
                <span className="text-2xl font-bold text-[#0060e6] ml-2.5 select-none font-heading">
                  {formattedDistanceObj.unitLabel}
                </span>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white/80 px-2.5 py-1 rounded-full border border-blue-200/60 shadow-2xs">
                {getActivityIcon(settings.activityMode)}
                <span className="text-xs font-bold text-slate-700">{getActivityLabel(settings.activityMode)}</span>
              </div>

              {trackingStatus === 'running' && (
                <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[11px] font-bold uppercase tracking-wider">Élő</span>
                </div>
              )}
            </div>
          </div>

          {/* 2. Idő & GPS Koordináták Grid (2 Columns) */}
          <div className="flex-shrink-0 grid grid-cols-2 gap-2.5">
            {/* Left: Time Card */}
            <div className="bg-white rounded-2xl px-4 py-3 shadow-xs border border-slate-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Eltelt Idő</span>
                <span className="text-slate-400">Kezdés: {displayClock}</span>
              </div>
              <span className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight leading-tight mt-1 font-heading">
                {formatElapsedTime(elapsedSeconds)}
              </span>
            </div>

            {/* Right: GPS Coordinates Card */}
            <button
              id="btn-desktop-coordinates-card"
              onClick={onOpenCoordinates}
              title="Kattints a koordináták részleteihez és másolásához"
              className="bg-white hover:bg-blue-50/40 rounded-2xl px-4 py-3 shadow-xs border border-slate-200/80 hover:border-blue-300 flex flex-col justify-between text-left transition-all active:scale-98 cursor-pointer relative group"
            >
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>GPS Pozíció</span>
                <MapPin className="w-3.5 h-3.5 text-[#0060e6] group-hover:scale-110 transition-transform" />
              </div>
              {settings.coordinateFormat === 'dms' ? (
                <div className="mt-1 font-mono font-bold text-slate-800 text-[13.5px] lg:text-[14.5px] leading-tight">
                  <div>{dms.latDms}</div>
                  <div className="text-slate-600">{dms.lngDms}</div>
                </div>
              ) : (
                <div className="mt-1 font-mono font-bold text-slate-800 text-[13.5px] lg:text-[14.5px] leading-tight">
                  <div>{activeLat.toFixed(6)}°</div>
                  <div className="text-slate-600">{activeLng.toFixed(6)}°</div>
                </div>
              )}
            </button>
          </div>

          {/* 3. Görgethető Résztávok (Splits) Panel */}
          <div className="flex-1 flex flex-col min-h-0 bg-white/70 rounded-2xl border border-slate-200/80 p-3 shadow-xs overflow-hidden">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider font-heading flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5 text-[#0060e6]" />
                <span>Rögzített Résztávok ({splits.length})</span>
              </h3>
              <span className="text-[11px] font-medium text-slate-400">
                Kattints a térképes pozícióhoz
              </span>
            </div>

            <div
              ref={splitsContainerRef}
              className="flex-1 overflow-y-auto min-h-0 space-y-2 mt-2 pr-1 custom-scrollbar pb-1"
            >
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
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* MOBILE VIEW (< md)                                                        */}
      {/* Stacked phone view with fixed layout and scrollable splits                */}
      {/* ========================================================================= */}
      <main className="flex md:hidden flex-1 flex-col min-h-0 px-3.5 pt-2 pb-2 gap-2.5 overflow-hidden">
        {/* 1. Mobile OSM Map */}
        <section className="flex-shrink-0 w-full h-[155px] sm:h-[185px] rounded-2xl overflow-hidden shadow-sm border border-slate-200/70 relative">
          <OsmMap
            coordinates={coordinates}
            currentLocation={currentLocation}
            splits={splits}
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
        <section className="flex-shrink-0 bg-[#eaf2ff] rounded-2xl px-4 py-3 shadow-[0_2px_8px_rgba(0,102,255,0.06)] border border-blue-100/60 flex items-baseline relative">
          <span className="text-[38px] font-black tracking-tight text-[#0060e6] leading-none font-heading">
            {formattedDistanceObj.value}
          </span>
          <span className="text-xl font-bold text-[#0060e6] ml-2 select-none font-heading">
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

        {/* 3. Mobile Time & Coordinates Grid */}
        <section className="flex-shrink-0 grid grid-cols-2 gap-2.5">
          <div className="bg-white rounded-2xl px-3.5 py-2.5 min-h-[70px] shadow-sm border border-slate-100/80 flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-500 tracking-wide">
              {displayClock}
            </span>
            <span className="text-[22px] font-black text-slate-900 tracking-tight leading-tight mt-0.5 font-heading">
              {formatElapsedTime(elapsedSeconds)}
            </span>
          </div>

          <button
            id="btn-coordinates-card"
            onClick={onOpenCoordinates}
            title="Kattints a koordináták részleteihez és megosztásához"
            className="bg-white hover:bg-blue-50/40 rounded-2xl px-3.5 py-2.5 min-h-[70px] shadow-sm border border-slate-100/80 flex flex-col justify-center text-left transition-all active:scale-98 cursor-pointer relative group"
          >
            <div className="absolute top-2 right-2 opacity-60">
              <MapPin className="w-3.5 h-3.5 text-[#0060e6]" />
            </div>

            {settings.coordinateFormat === 'dms' ? (
              <>
                <span className="text-[13.5px] font-bold text-slate-850 font-mono leading-tight tracking-tight pr-4">
                  {dms.latDms}
                </span>
                <span className="text-[13.5px] font-bold text-slate-850 font-mono leading-tight tracking-tight mt-0.5 pr-4">
                  {dms.lngDms}
                </span>
              </>
            ) : (
              <>
                <span className="text-[13.5px] font-bold text-slate-850 font-mono leading-tight pr-4">
                  {activeLat.toFixed(6)}°
                </span>
                <span className="text-[13.5px] font-bold text-slate-850 font-mono leading-tight mt-0.5 pr-4">
                  {activeLng.toFixed(6)}°
                </span>
              </>
            )}
          </button>
        </section>

        {/* 4. Mobile Scrollable Splits */}
        <section className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          <div
            ref={splitsContainerRef}
            className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-0.5 custom-scrollbar pb-1"
          >
            {trackingStatus !== 'idle' && (
              <div className="bg-[#f0f6ff] rounded-2xl p-2.5 border-2 border-dashed border-[#0060e6]/40 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center w-8 h-8 select-none">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#0060e6] opacity-75 animate-ping"></span>
                    <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-[#0060e6] text-white text-sm font-black font-heading shadow-md shadow-blue-500/50">
                      {(splits.length + 1).toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="text-lg font-black text-slate-900 font-heading leading-tight">
                        {formatDistanceByUnit(currentSplitDistanceKm, settings.unit).value}{' '}
                        {formatDistanceByUnit(currentSplitDistanceKm, settings.unit).unitLabel}
                      </span>
                      <span className="text-xs font-bold text-slate-500 font-heading ml-1">
                        {formatDistanceByUnit(totalDistanceKm, settings.unit).value}{' '}
                        {formatDistanceByUnit(totalDistanceKm, settings.unit).unitLabel}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-xs font-bold text-[#0060e6] font-mono px-2.5 py-1 bg-white rounded-xl shadow-xs border border-blue-100">
                  {Math.floor(currentSplitTimeSec / 60).toString().padStart(2, '0')}:
                  {(currentSplitTimeSec % 60).toString().padStart(2, '0')}
                </div>
              </div>
            )}

            {splits.length === 0 && trackingStatus === 'idle' ? (
              <div className="h-full flex flex-col items-center justify-center p-4 text-center text-slate-400 bg-white/60 rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs font-medium text-slate-500">
                  Nincsenek rögzített résztávok.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Kattints a <strong className="text-[#0060e6]">Start</strong> gombra a GPS követés megkezdéséhez!
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
                        ? 'bg-blue-100/90 border-l-[#0050cb] ring-2 ring-[#0050cb]/30 shadow-md scale-[1.01]'
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
                              {formattedTotalDist.value} {formattedTotalDist.unitLabel}
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
                          className="p-1.5 bg-white/80 hover:bg-white text-[#0050cb] hover:text-blue-700 rounded-lg shadow-2xs transition-all active:scale-90 cursor-pointer border border-blue-200/50"
                          title="Résztáv szerkesztése"
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
          </div>
        </section>

        {/* 5. Mobile Action Buttons (Start, Split, Stop) */}
        <section className="flex-shrink-0 grid grid-cols-3 gap-2.5 pt-1">
          {trackingStatus === 'idle' && (
            <button
              id="btn-start-tracking"
              onClick={onStart}
              className="bg-[#0066ff] hover:bg-[#0054d6] active:bg-[#0048b8] text-white font-black text-base py-3 rounded-2xl shadow-[0_4px_12px_rgba(0,102,255,0.3)] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer font-heading"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start</span>
            </button>
          )}

          {trackingStatus === 'running' && (
            <button
              id="btn-pause-tracking"
              onClick={onPause}
              className="bg-[#e67e00] hover:bg-[#c96e00] active:bg-[#a85c00] text-white font-black text-base py-3 rounded-2xl shadow-[0_4px_12px_rgba(230,126,0,0.3)] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer font-heading"
            >
              <Pause className="w-4 h-4 fill-current" />
              <span>Pause</span>
            </button>
          )}

          {trackingStatus === 'paused' && (
            <button
              id="btn-resume-tracking"
              onClick={onResume}
              className="bg-[#0066ff] hover:bg-[#0054d6] active:bg-[#0048b8] text-white font-black text-base py-3 rounded-2xl shadow-[0_4px_12px_rgba(0,102,255,0.3)] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer font-heading"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Resume</span>
            </button>
          )}

          <button
            id="btn-split-lap"
            onClick={onSplit}
            disabled={trackingStatus === 'idle'}
            className={`font-black text-base py-3 rounded-2xl transition-all flex items-center justify-center gap-1.5 font-heading ${
              trackingStatus === 'idle'
                ? 'bg-slate-100/80 border-2 border-slate-200 text-slate-300 opacity-40 cursor-not-allowed shadow-none'
                : 'bg-white border-2 border-[#0066ff] text-[#0066ff] hover:bg-blue-50/60 active:bg-blue-100/60 shadow-sm active:scale-95 cursor-pointer'
            }`}
          >
            <Flag className="w-4 h-4" />
            <span>Résztáv</span>
          </button>

          <button
            id="btn-stop-tracking"
            onClick={onStop}
            disabled={trackingStatus === 'idle'}
            className={`font-black text-base py-3 rounded-2xl transition-all flex items-center justify-center gap-1.5 font-heading ${
              trackingStatus === 'idle'
                ? 'bg-red-100/60 border border-red-200/50 text-red-300/80 opacity-40 cursor-not-allowed shadow-none'
                : 'bg-[#ba1a1a] hover:bg-[#a01616] active:bg-[#851212] text-white shadow-[0_4px_12px_rgba(186,26,26,0.25)] active:scale-95 cursor-pointer'
            }`}
          >
            <Square className="w-4 h-4 fill-current" />
            <span>Stop</span>
          </button>
        </section>
      </main>

      {/* Split Details & Edit Modal (Name, Notes, Photos, Share) */}
      {editingSplit && (
        <SplitDetailModal
          split={editingSplit}
          allSplits={splits}
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


