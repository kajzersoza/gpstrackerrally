import React, { useState, useRef } from 'react';
import {
  Calendar,
  Clock,
  Route,
  Download,
  Trash2,
  ChevronRight,
  ArrowLeft,
  AlertTriangle,
  Check,
  Edit3,
  Camera,
  MessageSquare,
  Cloud,
  CloudUpload,
  CloudDownload,
  Share2,
  Navigation,
  Play,
  MapPin,
} from 'lucide-react';
import { ActivitySession, Split, UserSettings, UserProfile } from '../types';
import {
  formatElapsedTime,
  exportToGPX,
  formatDistanceByUnit,
  getCumulativeDistanceForSplit,
  getFullSessionSplits,
} from '../utils/geoUtils';
import { OsmMap } from './OsmMap';
import { SplitDetailModal } from './SplitDetailModal';
import { ErrorBoundary } from './ErrorBoundary';

interface HistoryViewProps {
  sessions: ActivitySession[];
  settings: UserSettings;
  userProfile?: UserProfile;
  onDeleteSession: (id: string) => void;
  onUpdateSession?: (updatedSession: ActivitySession) => void;
  onBack: () => void;
  onOpenCloudShare?: (session: ActivitySession) => void;
  onOpenCloudLoad?: () => void;
  onLoadSessionForTracking?: (session: ActivitySession) => void;
  onOpenRoutePlanner?: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  sessions,
  settings,
  userProfile,
  onDeleteSession,
  onUpdateSession,
  onBack,
  onOpenCloudShare,
  onOpenCloudLoad,
  onLoadSessionForTracking,
  onOpenRoutePlanner,
}) => {
  const [selectedSession, setSelectedSession] = useState<ActivitySession | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<ActivitySession | null>(null);
  const [focusedSplitId, setFocusedSplitId] = useState<string | null>(null);
  const [editingSplit, setEditingSplit] = useState<Split | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const handleExportGPX = (session: ActivitySession) => {
    const gpxData = exportToGPX(session.title, session.coordinates, session.startTime);
    const blob = new Blob([gpxData], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gps-activity-${session.id}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('GPX fájl letöltése elindult');
  };

  const confirmDelete = () => {
    if (!sessionToDelete) return;
    const id = sessionToDelete.id;
    onDeleteSession(id);
    if (selectedSession?.id === id) {
      setSelectedSession(null);
    }
    setSessionToDelete(null);
    showToast('Tevékenység sikeresen törölve');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f4f7fb] relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-fade-in pointer-events-none">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Delete Confirmation Modal (Avoids window.confirm iframe blocks) */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-100 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-center font-black text-slate-800 text-lg font-heading">
              Tevékenység törlése?
            </h3>
            <p className="text-center text-xs text-slate-500 mt-1 mb-5">
              Biztosan törölni szeretnéd a(z) <strong className="text-slate-800 font-bold">"{sessionToDelete.title}"</strong> tracket? Ez a művelet nem visszavonható.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 active:scale-95 transition-all"
              >
                Mégsem
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-600/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Törlés</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedSession ? (
        /* Detailed Session View */
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <header className="flex-shrink-0 flex items-center justify-between px-3.5 py-2.5 bg-white border-b border-slate-100 shadow-2xs">
            <button
              onClick={() => setSelectedSession(null)}
              className="flex items-center gap-1 text-[#0050cb] font-bold text-sm hover:bg-blue-50 px-2 py-1 rounded-lg active:scale-95 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Vissza</span>
            </button>
            <h2 className="text-base font-black text-slate-800 truncate max-w-[220px] font-heading">
              {selectedSession.title}
            </h2>
            <div className="flex items-center gap-1.5">
              {onLoadSessionForTracking && (
                <button
                  type="button"
                  onClick={() => onLoadSessionForTracking(selectedSession)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0060e6] hover:bg-[#0050cb] text-white rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all cursor-pointer"
                  title="Útvonal betöltése rögzítéshez és távolság követéshez"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Track Betöltése</span>
                  <span className="sm:hidden">Betöltés</span>
                </button>
              )}
              {onOpenCloudShare && (
                <button
                  type="button"
                  onClick={() => onOpenCloudShare(selectedSession)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                  title="Felhő Megosztás & Kód generálás"
                >
                  <CloudUpload className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => handleExportGPX(selectedSession)}
                className="p-1.5 text-[#0050cb] hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                title="GPX Exportálása"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setSessionToDelete(selectedSession)}
                className="p-1.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                title="Törlés"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Responsive Layout: Mobile stacked with fixed map on top, Tablet/Desktop side-by-side */}
          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden p-3 md:p-4 gap-3 md:gap-4">
            {/* Left Column (Fixed Map on Mobile, Metrics, and Scrollable Splits list) */}
            <div className="w-full md:w-80 lg:w-96 flex-1 md:flex-initial md:h-full flex flex-col min-h-0 gap-2.5 overflow-hidden flex-shrink-0">
              {/* Mobile-only Fixed Map preview */}
              <div className="block md:hidden w-full h-[175px] sm:h-[200px] rounded-2xl overflow-hidden shadow-sm border border-slate-200 relative flex-shrink-0 bg-slate-100">
                <ErrorBoundary fallbackTitle="Térkép előnézet nem elérhető">
                  <OsmMap
                    coordinates={selectedSession.coordinates}
                    currentLocation={null}
                    splits={getFullSessionSplits(selectedSession)}
                    mapLayer={settings.mapLayer}
                    interactive={true}
                    focusedSplitId={focusedSplitId}
                    onSelectSplit={(split) => setFocusedSplitId(split.id)}
                  />
                </ErrorBoundary>
              </div>

              {/* Quick Metrics */}
              <div className="grid grid-cols-2 gap-2 flex-shrink-0">
                <div className="bg-[#eaf2ff] px-3.5 py-2 rounded-2xl border border-blue-100/70 shadow-2xs flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Távolság</span>
                  {(() => {
                    const distObj = formatDistanceByUnit(selectedSession.totalDistanceKm, settings.unit);
                    return (
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-xl font-black text-[#0060e6] font-heading leading-tight">
                          {distObj.value}
                        </span>
                        <span className="text-xs font-bold text-[#0060e6] font-heading">
                          {distObj.unitLabel}
                        </span>
                      </div>
                    );
                  })()}
                </div>
                <div className="bg-white px-3.5 py-2 rounded-2xl border border-slate-100 shadow-2xs flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Időtartam</span>
                  <span className="text-base font-black text-slate-800 font-heading mt-0.5">
                    {formatElapsedTime(selectedSession.totalDurationSec)}
                  </span>
                </div>
              </div>

              {/* Scrollable Splits & Checkpoints List */}
              {(() => {
                const fullSplits = getFullSessionSplits(selectedSession);
                return (
                  <section className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs overflow-hidden">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-shrink-0">
                      <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                        <span>Útvonal Pontjai ({fullSplits.length})</span>
                      </h3>
                      <span className="text-[11px] font-medium text-slate-400">Görgethető lista</span>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0 space-y-2 mt-2 pr-1 custom-scrollbar overscroll-contain">
                      {fullSplits.length === 0 ? (
                        <div className="p-4 text-center text-xs font-bold text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                          Nincsenek rögzített pontok ebben a trackben.
                        </div>
                      ) : (
                        fullSplits.map((split) => {
                          const isStart = split.id.startsWith('start') || split.splitIndex === 0 || split.formattedIndex === 'START';
                          const isStop = split.id.startsWith('stop') || split.formattedIndex === 'CÉL';
                          const splitDist = formatDistanceByUnit(split.distanceKm, settings.unit);
                          const totalKm = isStart ? 0 : isStop ? selectedSession.totalDistanceKm : getCumulativeDistanceForSplit(split, selectedSession.splits);
                          const totalDist = formatDistanceByUnit(totalKm, settings.unit);
                          const isFocused = focusedSplitId === split.id;
                          const hasPhotos = split.photos && split.photos.length > 0;
                          const hasNotes = !!split.notes;

                          return (
                            <div
                              id={`history-split-${split.id}`}
                              key={split.id}
                              onClick={() => setFocusedSplitId(split.id === focusedSplitId ? null : split.id)}
                              className={`p-2.5 rounded-xl border-l-4 transition-all cursor-pointer flex flex-col gap-1.5 ${
                                isFocused
                                  ? isStart
                                    ? 'bg-emerald-100/90 border-l-emerald-600 ring-2 ring-emerald-500/40 shadow-md scale-[1.01]'
                                    : isStop
                                    ? 'bg-rose-100/90 border-l-rose-600 ring-2 ring-rose-500/40 shadow-md scale-[1.01]'
                                    : 'bg-blue-100/90 border-l-[#0050cb] ring-2 ring-[#0050cb]/30 shadow-md scale-[1.01]'
                                  : isStart
                                  ? 'bg-emerald-50/80 border-l-emerald-500 hover:bg-emerald-100/70 active:scale-[0.99]'
                                  : isStop
                                  ? 'bg-rose-50/80 border-l-rose-500 hover:bg-rose-100/70 active:scale-[0.99]'
                                  : 'bg-[#eaf2ff] border-l-[#0060e6] hover:bg-[#e1edff] active:scale-[0.99]'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span
                                    className={`text-sm font-black px-2 py-0.5 rounded-md text-center font-heading flex-shrink-0 ${
                                      isStart
                                        ? 'bg-emerald-600 text-white'
                                        : isStop
                                        ? 'bg-rose-600 text-white'
                                        : isFocused
                                        ? 'text-[#0050cb] text-base w-6'
                                        : 'text-[#0060e6] text-base w-6'
                                    }`}
                                  >
                                    {isStart ? '🚩 START' : isStop ? '🏁 CÉL' : split.formattedIndex}
                                  </span>
                                  <div className="min-w-0">
                                    <div
                                      className={`text-xs font-black truncate font-heading ${
                                        isStart
                                          ? 'text-emerald-800'
                                          : isStop
                                          ? 'text-rose-800'
                                          : 'text-[#0050cb]'
                                      }`}
                                    >
                                      {split.name || (isStart ? 'Kezdőpont' : isStop ? 'Cél / Befejezés' : `Résztáv #${split.formattedIndex}`)}
                                    </div>
                                    <div className="flex items-baseline gap-2 flex-wrap">
                                      <span className="text-base font-black text-slate-900 font-heading">
                                        {isStart ? '0.00 km' : `${splitDist.value} ${splitDist.unitLabel}`}
                                      </span>
                                      {!isStart && (
                                        <span className="text-xs font-bold text-slate-500 font-heading">
                                          (Össz: {totalDist.value} {totalDist.unitLabel})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span
                                    className={`text-sm font-bold font-mono ${
                                      isStart
                                        ? 'text-emerald-700'
                                        : isStop
                                        ? 'text-rose-700'
                                        : 'text-[#0060e6]'
                                    }`}
                                  >
                                    {split.formattedTime}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingSplit(split);
                                    }}
                                    className="p-1.5 bg-white/80 hover:bg-white text-slate-700 hover:text-blue-700 rounded-lg shadow-2xs transition-all active:scale-90 cursor-pointer border border-slate-200"
                                    title="Pont szerkesztése, megjegyzés, fotó, megosztás"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Notes / Photos preview badge */}
                              {(hasNotes || hasPhotos) && (
                                <div className="flex items-center gap-2 pt-0.5 pl-2 flex-wrap text-[11px]">
                                  {hasNotes && (
                                    <div className="flex items-center gap-1 bg-white/70 px-2 py-0.5 rounded-md text-slate-700 font-medium truncate max-w-[220px]">
                                      <MessageSquare className="w-3 h-3 text-slate-600 flex-shrink-0" />
                                      <span className="truncate">{split.notes}</span>
                                    </div>
                                  )}
                                  {hasPhotos && (
                                    <div className="flex items-center gap-1 bg-white/70 px-2 py-0.5 rounded-md text-blue-700 font-bold">
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
                );
              })()}
            </div>

            {/* Right Column for Desktop / Tablet: Full-height Map */}
            <div className="hidden md:flex flex-1 min-w-[320px] h-full rounded-2xl overflow-hidden shadow-sm border border-slate-200 relative bg-slate-100">
              <ErrorBoundary fallbackTitle="Térkép nem elérhető">
                <OsmMap
                  coordinates={selectedSession.coordinates}
                  currentLocation={null}
                  splits={getFullSessionSplits(selectedSession)}
                  mapLayer={settings.mapLayer}
                  interactive={true}
                  focusedSplitId={focusedSplitId}
                  onSelectSplit={(split) => setFocusedSplitId(split.id)}
                />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      ) : (
        /* Sessions List View */
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <header className="flex-shrink-0 px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1 text-[#0050cb] font-bold text-sm hover:bg-blue-50 px-2 py-1 rounded-xl active:scale-95 transition-all cursor-pointer"
                title="Vissza a Főoldalra"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Vissza</span>
              </button>
              <h1 className="text-lg font-black text-slate-800">Előzmények</h1>
            </div>
            <div className="flex items-center gap-2">
              {onOpenRoutePlanner && (
                <button
                  type="button"
                  onClick={onOpenRoutePlanner}
                  className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <Route className="w-3.5 h-3.5" />
                  <span>Új Tervezés</span>
                </button>
              )}
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {sessions.length} mentve
              </span>
            </div>
          </header>

          {/* List with max-w-4xl container */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-3">
              {/* Quick Cloud Sync / Code Load Bar */}
              {onOpenCloudLoad && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50/60 p-3.5 rounded-2xl border border-blue-100/80 shadow-2xs flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#0050cb] text-white flex items-center justify-center">
                      <Cloud className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-800 font-heading">
                        Felhős Track Betöltése
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        Közös rally pályák és csapattársak adatai
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenCloudLoad}
                    className="bg-[#0050cb] hover:bg-blue-700 active:bg-blue-800 text-white px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    <CloudDownload className="w-3.5 h-3.5" />
                    <span>Kód megadása</span>
                  </button>
                </div>
              )}

            {sessions.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white rounded-2xl border border-slate-100 shadow-sm mt-4">
                <Route className="w-12 h-12 text-blue-300 mb-2" />
                <h3 className="text-base font-bold text-slate-700">Még nincsenek mentett trackek</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Indíts egy nyomkövetést a Főoldalon, vagy tölts be egy tracket felhő kóddal!
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                  {onOpenRoutePlanner && (
                    <button
                      type="button"
                      onClick={onOpenRoutePlanner}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Route className="w-3.5 h-3.5" />
                      <span>Útvonal Tervezése (Tervező)</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onBack}
                    className="bg-[#0060e6] hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    Ugrás az Activity nézethez
                  </button>
                  {onOpenCloudLoad && (
                    <button
                      type="button"
                      onClick={onOpenCloudLoad}
                      className="bg-white border border-slate-200 text-[#0050cb] hover:bg-slate-50 px-4 py-2 rounded-xl text-xs font-bold shadow-2xs active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <CloudDownload className="w-3.5 h-3.5" />
                      <span>Kód beírása</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              sessions.map((session) => {
                const distObj = formatDistanceByUnit(session.totalDistanceKm, settings.unit);

                return (
                  <div
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:border-blue-200 transition-all cursor-pointer flex items-center justify-between group relative"
                  >
                    <div className="space-y-1.5 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {session.formattedDate}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {session.formattedStartTime}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0050cb] transition-colors">
                        {session.title}
                      </h3>

                      <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                        <div>
                          Táv:{' '}
                          <strong className="text-slate-900 font-heading font-bold">
                            {distObj.value} {distObj.unitLabel}
                          </strong>
                        </div>
                        <div>
                          Idő:{' '}
                          <strong className="text-slate-900 font-mono font-bold">
                            {formatElapsedTime(session.totalDurationSec)}
                          </strong>
                        </div>
                        <div>
                          Laps: <strong className="text-[#0050cb] font-bold">{session.splits.length}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 pl-2">
                      {/* Direct Load Track Button on List Card */}
                      {onLoadSessionForTracking && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLoadSessionForTracking(session);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-[#eaf2ff] hover:bg-[#0060e6] text-[#0060e6] hover:text-white rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs"
                          title="Betöltés navigációhoz / rögzítéshez"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Betöltés</span>
                        </button>
                      )}
                      {/* Cloud Share Button */}
                      {onOpenCloudShare && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenCloudShare(session);
                          }}
                          className="p-2 text-slate-400 hover:text-[#0050cb] hover:bg-blue-50 rounded-xl transition-all active:scale-95 cursor-pointer"
                          title="Megosztás felhőben"
                        >
                          <CloudUpload className="w-4 h-4" />
                        </button>
                      )}
                      {/* Direct Delete Button on List Card */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSessionToDelete(session);
                        }}
                        className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-95 cursor-pointer"
                        title="Törlés"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="p-1 text-slate-400 group-hover:text-[#0050cb] transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            </div>
          </div>
        </div>
      )}

      {/* Split Details & Edit Modal */}
      {editingSplit && selectedSession && (
        <SplitDetailModal
          split={editingSplit}
          allSplits={selectedSession.splits}
          unit={settings.unit}
          presets={settings.pointPresets}
          isOpen={true}
          onClose={() => setEditingSplit(null)}
          onSave={(updatedSplit) => {
            const updatedSplits = selectedSession.splits.map((s) =>
              s.id === updatedSplit.id ? updatedSplit : s
            );
            const updatedSession = {
              ...selectedSession,
              splits: updatedSplits,
            };
            setSelectedSession(updatedSession);
            if (onUpdateSession) {
              onUpdateSession(updatedSession);
            }
            showToast('Résztáv módosításai mentve!');
            setEditingSplit(null);
          }}
        />
      )}
    </div>
  );
};

