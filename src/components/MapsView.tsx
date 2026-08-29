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

  // Speed calculation
  const currentSpeedKmh = useMemo(() => {
    if (currentLocation?.speed != null && currentLocation.speed >= 0) {
      return Math.round(currentLocation.speed * 3.6);
    }
    if (elapsedSeconds > 0 && totalDistanceKm > 0) {
      return Math.round((totalDistanceKm / (elapsedSeconds / 3600)));
    }
    return 0;
  }, [currentLocation, elapsedSeconds, totalDistanceKm]);

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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f4f7fb] relative select-none">
      {/* Top Header Bar */}
      <header className="flex-shrink-0 px-3 sm:px-4 py-2.5 bg-white/95 backdrop-blur-md border-b border-slate-200 flex items-center justify-between z-20 shadow-2xs">
        <div className="flex items-center gap-2">
          {/* Tracking Status indicator */}
          {trackingStatus === 'running' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-black animate-pulse shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>RÖGZÍTÉS</span>
            </div>
          ) : trackingStatus === 'paused' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-black shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>SZÜNET</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-full text-xs font-bold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              <span>KÉSZENLÉT</span>
            </div>
          )}

          {/* Activity mode icon */}
          <span className="text-xs font-bold text-slate-500 hidden sm:inline-flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
            {settings.activityMode === 'car' ? '🚗 Autó' : settings.activityMode === 'cycling' ? '🚴 Kerékpár' : '🚶 Gyalog'}
          </span>
        </div>

        {/* Right side: Live Clock & Coordinates button */}
        <div className="flex items-center gap-1.5">
          {/* Current Live Time */}
          <div className="flex items-center gap-1 text-xs font-mono font-bold text-[#0050cb] bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-200 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-[#0050cb]" />
            <span>{liveClock}</span>
          </div>

          {/* Coordinates button */}
          <button
            type="button"
            onClick={onOpenCoordinates}
            className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-xl transition-all border border-slate-200 active:scale-95 cursor-pointer shadow-2xs"
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
          onLayerChange={(layer) => onUpdateSettings({ mapLayer: layer })}
          onSelectSplit={(split) => setEditingSplit(split)}
        />

        {/* Floating Top-Left HUD Pill: Live Metrics during Tracking or Paused */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 max-w-[calc(100vw-80px)] sm:max-w-xs pointer-events-none">
          {/* Collapsible HUD Card */}
          <div className="bg-white/95 backdrop-blur-md px-3 py-2 sm:p-3 rounded-2xl shadow-xl border border-slate-200/90 pointer-events-auto transition-all">
            <div
              className={`flex items-center justify-between gap-3 cursor-pointer select-none ${showHudCard ? 'pb-1.5 border-b border-slate-100' : ''}`}
              onClick={() => setShowHudCard(!showHudCard)}
            >
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider">
                <Gauge className="w-3.5 h-3.5 text-[#0050cb]" />
                {showHudCard ? (
                  <span>Élő Műszerfal</span>
                ) : (
                  <span className="font-mono font-black text-[#0050cb] text-sm normal-case tracking-normal flex items-baseline gap-1">
                    <span>{formattedDistance.value}</span>
                    <span className="text-xs font-bold text-slate-500">{formattedDistance.unitLabel}</span>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowHudCard(!showHudCard);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 cursor-pointer"
                title={showHudCard ? 'Műszerfal összecsukása' : 'Műszerfal lenyitása'}
                aria-label={showHudCard ? 'Műszerfal összecsukása' : 'Műszerfal lenyitása'}
              >
                {showHudCard ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showHudCard && (
              <div className="mt-2 space-y-2">
                {/* Time and Distance Primary Metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Össz. Idő</div>
                    <div className="text-base font-black font-mono text-slate-800 leading-tight mt-0.5">
                      {formatElapsedTime(elapsedSeconds)}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Távolság</div>
                    <div className="text-base font-black font-mono text-[#0050cb] leading-tight mt-0.5">
                      {formattedDistance.value} <span className="text-xs font-bold text-slate-500">{formattedDistance.unitLabel}</span>
                    </div>
                  </div>
                </div>

                {/* Speed & Current Split Metrics */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">Sebesség:</span>
                    <span className="font-mono font-black text-slate-700">{currentSpeedKmh} km/h</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">Akt. szakasz:</span>
                    <span className="font-mono font-bold text-slate-700">{formattedSplitDist.value} {formattedSplitDist.unitLabel}</span>
                  </div>
                </div>

                {/* GPS Coordinates preview */}
                <div className="pt-1.5 border-t border-slate-100 text-[10px] font-mono text-slate-500 flex items-center justify-between">
                  <span>Pontok: <b>{coordinates.length}</b></span>
                  <span>Splitek: <b>{splits.length}</b></span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Floating Right Map Tool Controls */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 pointer-events-auto">
          {/* Zoom In & Zoom Out Controls */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/90 flex flex-col overflow-hidden">
            <button
              id="btn-large-map-zoom-in"
              type="button"
              onClick={() => mapRef.current?.zoomIn()}
              className="p-3 text-slate-700 hover:text-[#0050cb] hover:bg-slate-50 active:bg-blue-50 transition-all border-b border-slate-100 cursor-pointer flex items-center justify-center"
              title="Nagyítás (+)"
              aria-label="Nagyítás (+)"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </button>
            <button
              id="btn-large-map-zoom-out"
              type="button"
              onClick={() => mapRef.current?.zoomOut()}
              className="p-3 text-slate-700 hover:text-[#0050cb] hover:bg-slate-50 active:bg-blue-50 transition-all cursor-pointer flex items-center justify-center"
              title="Kicsinyítés (-)"
              aria-label="Kicsinyítés (-)"
            >
              <Minus className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Recenter Button */}
          <button
            id="btn-large-map-recenter"
            type="button"
            onClick={() => mapRef.current?.recenter()}
            className="p-3 bg-white/95 backdrop-blur-md hover:bg-white text-slate-700 hover:text-[#0050cb] active:text-[#0050cb] rounded-2xl shadow-xl border border-slate-200/90 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
            title="Centrálás jelenlegi helyre"
            aria-label="Centrálás jelenlegi helyre"
          >
            <Crosshair className="w-5 h-5" />
          </button>

          {/* Layer Selector Trigger Button */}
          <button
            id="btn-large-map-layer-selector"
            type="button"
            onClick={() => setShowLayerPicker(!showLayerPicker)}
            className={`p-3 rounded-2xl shadow-xl border transition-all cursor-pointer flex items-center justify-center ${
              showLayerPicker
                ? 'bg-[#0050cb] text-white border-blue-600'
                : 'bg-white/95 backdrop-blur-md text-slate-700 hover:bg-slate-50 border-slate-200/90'
            }`}
            title="Térképréteg váltása"
            aria-label="Térképréteg váltása"
          >
            <Layers className="w-5 h-5" />
          </button>

          {/* Quick Preset Bar Toggle */}
          <button
            id="btn-large-map-preset-toggle"
            type="button"
            onClick={() => setShowPresetsBar(!showPresetsBar)}
            className={`p-3 rounded-2xl shadow-xl border transition-all cursor-pointer flex items-center justify-center ${
              showPresetsBar
                ? 'bg-amber-500 text-white border-amber-600'
                : 'bg-white/95 backdrop-blur-md text-slate-700 hover:bg-slate-50 border-slate-200/90'
            }`}
            title="Gyors itiner sablonok megjelenítése/elrejtése"
            aria-label="Gyors itiner sablonok megjelenítése/elrejtése"
          >
            <Tag className="w-5 h-5" />
          </button>
        </div>

        {/* Layer Selector Popup Menu */}
        {showLayerPicker && (
          <div className="absolute top-16 right-3 z-20 bg-white/95 backdrop-blur-md p-2 rounded-2xl shadow-2xl border border-slate-200 flex flex-col gap-1 min-w-[140px] animate-in fade-in zoom-in-95">
            <div className="text-[10px] font-black uppercase text-slate-400 px-2 py-1">Térképréteg</div>
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold text-left transition-all flex items-center justify-between cursor-pointer ${
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

        {/* Floating Bottom Recording Dock & Quick Presets */}
        <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-col gap-2 pointer-events-auto">
          {/* Quick Rally Preset Waypoint Buttons (Horizontally scrollable) */}
          {showPresetsBar && trackingStatus !== 'idle' && (
            <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-2xl shadow-lg border border-slate-200/90 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1.5 flex-shrink-0 flex items-center gap-1">
                <Tag className="w-3 h-3 text-amber-500" />
                <span>Sablonok:</span>
              </span>
              {presetsToUse.map((preset) => {
                const icon = getPresetIcon(preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleQuickPresetSplit(preset)}
                    className="flex-shrink-0 px-2.5 py-1.5 bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-90 cursor-pointer shadow-2xs"
                    title={`Új útpont rögzítése: ${preset}`}
                  >
                    <span>{icon}</span>
                    <span className="whitespace-nowrap">{preset}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Main Action Bar */}
          <div className="bg-white/95 backdrop-blur-md p-2 sm:p-2.5 rounded-2xl shadow-2xl border border-slate-200 flex items-center justify-between gap-2">
            {trackingStatus === 'idle' ? (
              /* IDLE STATE: Big Start Recording Button */
              <div className="w-full flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500 font-medium pl-2 hidden sm:block">
                  {coordinates.length > 0 ? `${coordinates.length} pont a térképen` : 'Készenlétben • Nyomd meg az indítást'}
                </div>

                <button
                  type="button"
                  onClick={onStart}
                  className="w-full sm:w-auto flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-500/25 transition-all active:scale-95 cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>RÖGZÍTÉS INDÍTÁSA</span>
                </button>
              </div>
            ) : trackingStatus === 'running' ? (
              /* RUNNING STATE: Stop, Pause, and BIG SPLIT / WAYPOINT BUTTON */
              <div className="w-full flex items-center gap-2">
                {/* Stop / Finish Button */}
                <button
                  type="button"
                  onClick={() => setShowStopConfirm(true)}
                  className="px-3.5 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-90 cursor-pointer shadow-2xs flex-shrink-0"
                  title="Rögzítés befejezése és mentése"
                >
                  <Square className="w-4 h-4 fill-current text-red-600" />
                  <span className="hidden sm:inline">Befejezés</span>
                </button>

                {/* Pause Button */}
                <button
                  type="button"
                  onClick={onPause}
                  className="px-3.5 py-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-90 cursor-pointer shadow-2xs flex-shrink-0"
                  title="Rögzítés szüneteltetése"
                >
                  <Pause className="w-4 h-4 fill-current text-amber-600" />
                  <span className="hidden sm:inline">Szünet</span>
                </button>

                {/* BIG PROMINENT RALLY SPLIT / CHECKPOINT BUTTON */}
                <button
                  type="button"
                  onClick={() => onSplit()}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#0050cb] via-blue-600 to-[#0066ff] hover:from-blue-700 hover:to-blue-600 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 transition-all active:scale-95 cursor-pointer ring-2 ring-blue-400/30"
                >
                  <Flag className="w-5 h-5 fill-current" />
                  <span>RÉSZTÁV / ÚTPONT ({splits.length + 1})</span>
                </button>
              </div>
            ) : (
              /* PAUSED STATE: Stop, Split, and Glowing RESUME Button */
              <div className="w-full flex items-center gap-2">
                {/* Stop / Finish Button */}
                <button
                  type="button"
                  onClick={() => setShowStopConfirm(true)}
                  className="px-3.5 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-90 cursor-pointer shadow-2xs flex-shrink-0"
                  title="Rögzítés befejezése és mentése"
                >
                  <Square className="w-4 h-4 fill-current text-red-600" />
                  <span>Befejezés</span>
                </button>

                {/* Split even while paused */}
                <button
                  type="button"
                  onClick={() => onSplit()}
                  className="px-3.5 py-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0050cb] border border-blue-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-90 cursor-pointer shadow-2xs flex-shrink-0"
                  title="Útpont rögzítése a jelenlegi pozíción"
                >
                  <Flag className="w-4 h-4" />
                  <span>Útpont</span>
                </button>

                {/* Big Glowing Resume Button */}
                <button
                  type="button"
                  onClick={onResume}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 transition-all active:scale-95 cursor-pointer animate-pulse ring-2 ring-emerald-400/40"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>FOLYTATÁS</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stop / Finish Confirmation Modal */}
      {showStopConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
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
