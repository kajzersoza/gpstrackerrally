import React, { useState } from 'react';
import {
  User,
  Award,
  Flame,
  Zap,
  ShieldCheck,
  Smartphone,
  Info,
  RefreshCw,
  Crown,
  Shield,
  Lock,
  Unlock,
  KeyRound,
  Edit3,
  Eye,
  Cloud,
  CloudDownload,
  Users,
  Check,
} from 'lucide-react';
import { ActivitySession, UserSettings, UserProfile, UserRole } from '../types';
import { formatElapsedTime } from '../utils/geoUtils';

interface ProfileViewProps {
  sessions: ActivitySession[];
  settings: UserSettings;
  userProfile: UserProfile;
  onUpdateProfile: (newProfile: Partial<UserProfile>) => void;
  onResetData: () => void;
  onOpenCloudSync?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  sessions,
  settings,
  userProfile,
  onUpdateProfile,
  onResetData,
  onOpenCloudSync,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isEditingPin, setIsEditingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // Lifetime stats calculations
  const totalKm = sessions.reduce((acc, s) => acc + s.totalDistanceKm, 0);
  const totalSec = sessions.reduce((acc, s) => acc + s.totalDurationSec, 0);
  const totalSplits = sessions.reduce((acc, s) => acc + s.splits.length, 0);

  const isMiles = settings.unit === 'mi';
  const displayTotalDistance = isMiles
    ? `${(totalKm * 0.621371).toFixed(1)} mi`
    : `${totalKm.toFixed(1)} km`;

  // Toggle Admin Lock/Unlock with PIN
  const handleUnlockAdmin = () => {
    if (pinInput === userProfile.adminPin || pinInput === '1234') {
      onUpdateProfile({ isAdminUnlocked: true, role: 'admin' });
      setPinInput('');
      setPinError(false);
      showNotification('Admin jogosultság sikeresen feloldva!');
    } else {
      setPinError(true);
    }
  };

  const handleLockAdmin = () => {
    onUpdateProfile({ isAdminUnlocked: false, role: 'editor' });
    showNotification('Admin felület lezárva.');
  };

  const handleSaveNewPin = () => {
    if (newPin.trim().length >= 4) {
      onUpdateProfile({ adminPin: newPin.trim() });
      setIsEditingPin(false);
      setNewPin('');
      showNotification('Új Admin PIN kód elmentve!');
    }
  };

  const handleRoleSelect = (role: UserRole) => {
    if (role === 'admin' && !userProfile.isAdminUnlocked) {
      // Prompt for PIN unlock
      setPinError(false);
      return;
    }
    onUpdateProfile({ role });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f4f7fb] relative">
      {/* Toast */}
      {toast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-fade-in pointer-events-none">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
        <h1 className="text-xl font-black text-[#0050cb] font-heading">Profil & Jogosultságok</h1>
        {onOpenCloudSync && (
          <button
            type="button"
            onClick={onOpenCloudSync}
            className="bg-blue-50 hover:bg-blue-100 text-[#0050cb] px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <CloudDownload className="w-4 h-4" />
            <span>Track Betöltése Kóddal</span>
          </button>
        )}
      </header>

      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* 1. User & Team Card */}
        <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-md ${
                userProfile.role === 'admin' ? 'bg-[#0050cb]' : 'bg-emerald-600'
              }`}
            >
              {userProfile.role === 'admin' ? <Crown className="w-7 h-7" /> : <User className="w-7 h-7" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-800 leading-tight truncate font-heading">
                  {userProfile.name || 'Rally Felhasználó'}
                </h2>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                    userProfile.role === 'admin'
                      ? 'bg-blue-50 text-[#0050cb] border-blue-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {userProfile.role === 'admin' ? '👑 Admin' : '👤 Csapattag'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {userProfile.teamName || 'Rally & GPS Tracking Csapat'}
              </p>
            </div>
          </div>

          {/* Name & Team Inline Editing */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Név</label>
              <input
                type="text"
                value={userProfile.name}
                onChange={(e) => onUpdateProfile({ name: e.target.value })}
                placeholder="Neved..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0050cb]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Csapat / Rally név</label>
              <input
                type="text"
                value={userProfile.teamName}
                onChange={(e) => onUpdateProfile({ teamName: e.target.value })}
                placeholder="Csapatod neve..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0050cb]"
              />
            </div>
          </div>
        </div>

        {/* 2. ADMINISZTRÁTORI JOGOSULTSÁG & MEGOSZTÁS KEZELŐ */}
        <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#0050cb]" />
              <div>
                <h3 className="text-sm font-black text-slate-800 font-heading">
                  Admin Jogosultság & Megosztás
                </h3>
                <p className="text-[11px] text-slate-500">
                  Döntsd el, hogy mások szerkeszthetik vagy csak nézhetik a trackeket
                </p>
              </div>
            </div>

            {userProfile.isAdminUnlocked ? (
              <button
                type="button"
                onClick={handleLockAdmin}
                className="text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-xl border border-amber-200 flex items-center gap-1 transition-all cursor-pointer"
                title="Admin felület zárolása PIN-kóddal"
              >
                <Unlock className="w-3.5 h-3.5 text-amber-600" />
                <span>Feloldva</span>
              </button>
            ) : (
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Lezárva</span>
              </span>
            )}
          </div>

          {/* If Admin is Locked: Show PIN unlock input */}
          {!userProfile.isAdminUnlocked ? (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                <KeyRound className="w-4 h-4 text-amber-600" />
                <span>Admin mód feloldása PIN-kóddal</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Az Admin jogokhoz és a védelmi beállítások módosításához add meg az Admin PIN-t (alapértelmezett: <strong>1234</strong>).
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUnlockAdmin();
                  }}
                  placeholder="PIN (1234)"
                  className="w-28 bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-center text-sm font-mono font-bold tracking-widest text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0050cb]"
                />
                <button
                  type="button"
                  onClick={handleUnlockAdmin}
                  className="bg-[#0050cb] hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all cursor-pointer active:scale-95"
                >
                  Feloldás
                </button>
              </div>
              {pinError && (
                <p className="text-[11px] font-bold text-red-600">
                  Hibás PIN kód! Próbáld az alapértelmezett "1234"-et.
                </p>
              )}
            </div>
          ) : (
            /* Admin Unlocked Controls */
            <div className="space-y-3.5">
              {/* Role Selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Aktív Szerepköröd
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleRoleSelect('admin')}
                    className={`p-2.5 rounded-2xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                      userProfile.role === 'admin'
                        ? 'bg-blue-50 border-[#0050cb] ring-2 ring-[#0050cb]/20 text-[#0050cb]'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Crown className="w-4 h-4" />
                    <div>
                      <div className="text-xs font-black">Adminisztrátor</div>
                      <div className="text-[10px] text-slate-500">Pályamester & Rendező</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoleSelect('editor')}
                    className={`p-2.5 rounded-2xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                      userProfile.role === 'editor'
                        ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-600/20 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <div>
                      <div className="text-xs font-black">Csapattag</div>
                      <div className="text-[10px] text-slate-500">Versenyző & Navigátor</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Default Sharing Permission Toggle */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-[#0050cb]" />
                      <span>Mások szerkeszthetik a megosztott trackeket?</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {userProfile.defaultAllowPublicEdit
                        ? 'Igen: A csapattársak a kóddal szerkeszthetik a pontokat és leírásokat.'
                        : 'Nem: Mások csak megnézhetik, nem módosíthatják a felhőben az eredetit.'}
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    checked={userProfile.defaultAllowPublicEdit}
                    onChange={(e) =>
                      onUpdateProfile({ defaultAllowPublicEdit: e.target.checked })
                    }
                    className="w-5 h-5 accent-[#0050cb] cursor-pointer rounded"
                  />
                </div>
              </div>

              {/* Change Admin PIN */}
              <div className="pt-1">
                {!isEditingPin ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingPin(true)}
                    className="text-xs font-bold text-[#0050cb] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Admin PIN módosítása (Jelenlegi: {userProfile.adminPin})</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <input
                      type="text"
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="Új 4-6 számjegyű PIN"
                      className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 w-36"
                    />
                    <button
                      type="button"
                      onClick={handleSaveNewPin}
                      disabled={newPin.trim().length < 4}
                      className="bg-[#0050cb] disabled:opacity-40 text-white text-xs font-bold px-3 py-1 rounded-lg"
                    >
                      Mentés
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingPin(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1"
                    >
                      Mégse
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3. Aggregate Lifetime Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#eaf2ff] rounded-2xl p-3.5 border-l-4 border-l-[#0060e6] shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-[#0060e6]" /> Összes Távolság
            </span>
            <div className="text-2xl font-black text-[#0060e6] mt-1 font-heading">
              {displayTotalDistance}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-amber-500" /> Trackek Száma
            </span>
            <div className="text-2xl font-black text-slate-800 mt-1 font-heading">
              {sessions.length} <span className="text-xs font-normal text-slate-400">alkalom</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase">Összes Idő</span>
            <div className="text-xl font-black text-slate-800 font-mono mt-1">
              {formatElapsedTime(totalSec)}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase">Résztávok</span>
            <div className="text-xl font-black text-slate-800 mt-1 font-heading">
              {totalSplits} <span className="text-xs font-normal text-slate-400">részidő</span>
            </div>
          </div>
        </div>

        {/* 4. Danger zone / Reset */}
        <div className="pt-2">
          <button
            onClick={() => {
              if (
                confirm(
                  'Biztosan törölni szeretnéd az összes mentett tracket és alaphelyzetbe állítani az adatokat?'
                )
              ) {
                onResetData();
              }
            }}
            className="w-full bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Helyi trackek és adatok alaphelyzetbe állítása
          </button>
        </div>
      </div>
    </div>
  );
};
