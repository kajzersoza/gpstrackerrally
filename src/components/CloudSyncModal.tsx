import React, { useState } from 'react';
import {
  X,
  Cloud,
  CloudUpload,
  CloudDownload,
  Share2,
  Copy,
  Check,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Edit3,
  Eye,
  Lock,
  Loader2,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { ActivitySession, SharedCloudTrack, UserProfile } from '../types';
import { uploadTrackToCloud, loadTrackByCode } from '../services/cloudTrackService';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionToShare?: ActivitySession | null;
  userProfile: UserProfile;
  onTrackLoaded: (loadedTrack: SharedCloudTrack) => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  sessionToShare,
  userProfile,
  onTrackLoaded,
}) => {
  // Tabs: 'share' (if session provided) or 'load'
  const [activeTab, setActiveTab] = useState<'share' | 'load'>(
    sessionToShare ? 'share' : 'load'
  );

  // Share state
  const [allowEdit, setAllowEdit] = useState<boolean>(
    userProfile.defaultAllowPublicEdit ?? true
  );
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadedTrack, setUploadedTrack] = useState<SharedCloudTrack | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Load state
  const [inputCode, setInputCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedPreview, setLoadedPreview] = useState<SharedCloudTrack | null>(null);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // Handle Share Upload
  const handleUpload = async () => {
    if (!sessionToShare) return;
    setIsUploading(true);
    try {
      const result = await uploadTrackToCloud(
        sessionToShare,
        allowEdit,
        userProfile.name || (userProfile.role === 'admin' ? 'Admin' : 'Versenyző')
      );
      setUploadedTrack(result);
    } catch (err: any) {
      console.error('Error uploading track:', err);
      alert('Hiba történt a felhőbe mentéskor: ' + (err.message || err));
    } finally {
      setIsUploading(false);
    }
  };

  // Copy shareable Link
  const handleCopyLink = () => {
    if (!uploadedTrack) return;
    const shareUrl = `${currentUrl}/?track=${uploadedTrack.shareCode}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Copy 6-char Code
  const handleCopyCode = () => {
    if (!uploadedTrack) return;
    navigator.clipboard.writeText(uploadedTrack.shareCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Handle Load By Code
  const handleSearchCode = async () => {
    if (!inputCode.trim()) return;
    setIsLoading(true);
    setLoadError(null);
    setLoadedPreview(null);
    try {
      const result = await loadTrackByCode(inputCode);
      if (result) {
        setLoadedPreview(result);
      } else {
        setLoadError('Nem található felhős track ezzel a kóddal: ' + inputCode.trim().toUpperCase());
      }
    } catch (err: any) {
      console.error('Error loading track:', err);
      setLoadError('Hiba történt a betöltéskor: ' + (err.message || err));
    } finally {
      setIsLoading(false);
    }
  };

  // Accept and load preview into main history
  const handleAcceptLoadedTrack = () => {
    if (!loadedPreview) return;
    onTrackLoaded(loadedPreview);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-[#f8faff]">
          <div className="flex items-center gap-2.5 text-[#0050cb]">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#0050cb] flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 font-heading">
                Felhő Megosztás & Szinkronizáció
              </h2>
              <p className="text-[11px] font-semibold text-slate-500">
                Google Firestore Valós Idejű Megosztás
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 p-1.5 gap-1.5">
          {sessionToShare && (
            <button
              onClick={() => setActiveTab('share')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'share'
                  ? 'bg-white text-[#0050cb] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CloudUpload className="w-4 h-4" />
              <span>Track Megosztása</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('load')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'load'
                ? 'bg-white text-[#0050cb] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CloudDownload className="w-4 h-4" />
            <span>Track Betöltése Kóddal</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-sm">
          {/* TAB 1: SHARE TRACK */}
          {activeTab === 'share' && sessionToShare && (
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-100">
                <span className="text-[11px] font-bold text-blue-600 uppercase">
                  Kiválasztott Track
                </span>
                <div className="text-sm font-black text-slate-800 mt-0.5">
                  {sessionToShare.title}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {sessionToShare.formattedDate} • {sessionToShare.totalDistanceKm.toFixed(2)} km • {sessionToShare.splits.length} résztáv/pont
                </div>
              </div>

              {!uploadedTrack ? (
                <div className="space-y-4">
                  {/* Permissions selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-[#0050cb]" />
                      <span>Szerkesztési Jogosultság Beállítása</span>
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAllowEdit(true)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                          allowEdit
                            ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-emerald-800 flex items-center gap-1">
                            <Edit3 className="w-3.5 h-3.5 text-emerald-600" /> Közös Szerkesztés
                          </span>
                          {allowEdit && <Check className="w-4 h-4 text-emerald-600" />}
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">
                          Bárki a kóddal módosíthatja a pontokat és a megjegyzéseket.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAllowEdit(false)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                          !allowEdit
                            ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-blue-900 flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5 text-blue-600" /> Csak Megtekintés
                          </span>
                          {!allowEdit && <Check className="w-4 h-4 text-blue-600" />}
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">
                          Zárolt mód: mások csak láthatják, a felhőben nem írhatják felül.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Upload button */}
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="w-full bg-[#0050cb] hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Feltöltés a felhőbe...</span>
                      </>
                    ) : (
                      <>
                        <CloudUpload className="w-4 h-4" />
                        <span>Megosztási Kód Generálása</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* Generated Share Info */
                <div className="space-y-4 animate-in fade-in-50 duration-300">
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 mb-1">
                      <Check className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                      Sikeres Felhő Megosztás!
                    </div>

                    {/* Big Share Code Box */}
                    <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between">
                      <div className="text-left">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">
                          Csapat / Rally Kód
                        </div>
                        <div className="text-2xl font-black text-[#0050cb] font-heading tracking-wider">
                          {uploadedTrack.shareCode}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="bg-blue-50 hover:bg-blue-100 text-[#0050cb] px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      >
                        {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedCode ? 'Másolva!' : 'Kód Másolása'}</span>
                      </button>
                    </div>

                    {/* Permissions badge */}
                    <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-white/80 px-2.5 py-1 rounded-full border border-slate-200">
                      {uploadedTrack.allowPublicEdit ? (
                        <>
                          <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Közös szerkesztés engedélyezve</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 text-blue-600" />
                          <span>Zárolva (Csak megtekintés)</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Share URL Button */}
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="w-full bg-[#0050cb] hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                    <span>{copiedLink ? 'Közvetlen Web Link Másolva!' : 'Közvetlen Link Másolása'}</span>
                  </button>

                  <p className="text-[11px] text-slate-500 text-center">
                    Küldd el ezt a 6 jegyű kódot vagy linket a csapattársaidnak!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LOAD TRACK BY CODE */}
          {activeTab === 'load' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Add meg a 6 jegyű Rally / Track kódot
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchCode();
                      }
                    }}
                    placeholder="Pl. RLY-482"
                    className="flex-1 uppercase font-heading font-black tracking-wider text-base bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0050cb]/40 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleSearchCode}
                    disabled={isLoading || !inputCode.trim()}
                    className="bg-[#0050cb] hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                    <span>Keresés</span>
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {loadError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-2xl text-xs font-semibold border border-red-100 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{loadError}</span>
                </div>
              )}

              {/* Loaded Preview Box */}
              {loadedPreview && (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3 animate-in fade-in-50 duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                      Talált Track: {loadedPreview.shareCode}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-800">
                      {loadedPreview.allowPublicEdit ? '✏️ Szerkeszthető' : '👁️ Csak megtekintés'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-black text-slate-800 font-heading">
                      {loadedPreview.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Feltöltő: <span className="font-bold">{loadedPreview.ownerName}</span> • {loadedPreview.sessionData.totalDistanceKm.toFixed(2)} km • {loadedPreview.sessionData.splits.length} résztáv/pont
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAcceptLoadedTrack}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <Check className="w-4 h-4" />
                    <span>Track Betöltése az Előzményekbe</span>
                  </button>
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 text-xs text-slate-500 space-y-1">
                <div className="font-bold text-slate-700 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#0050cb]" />
                  <span>Hogyan működik?</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  A betöltött track automatikusan bekerül a helyi előzményeid közé. Ha a megosztó engedélyezte a szerkesztést, a pontok és leírások módosításait azonnal visszaszinkronizálhatod a felhőbe!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
