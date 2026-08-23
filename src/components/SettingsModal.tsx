import React, { useState } from 'react';
import {
  X,
  Sliders,
  Volume2,
  Vibrate,
  MapPin,
  Play,
  Footprints,
  Bike,
  Car,
  RotateCcw,
  Tag,
  Plus,
  Trash2,
  Check,
  Compass,
  Map,
  Sparkles,
} from 'lucide-react';
import { UserSettings, ActivityMode } from '../types';
import { DEFAULT_RALLY_PRESETS, getPresetIcon } from '../constants/rallyPresets';

interface SettingsModalProps {
  isOpen: boolean;
  settings: UserSettings;
  onClose: () => void;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onResetDefaults?: () => void;
  onOpenRoutePlanner?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onClose,
  onUpdateSettings,
  onResetDefaults,
  onOpenRoutePlanner,
}) => {
  const [newPresetText, setNewPresetText] = useState('');

  if (!isOpen) return null;

  const currentPresets =
    settings.pointPresets && settings.pointPresets.length > 0
      ? settings.pointPresets
      : DEFAULT_RALLY_PRESETS;

  const handleAddPreset = () => {
    const trimmed = newPresetText.trim();
    if (!trimmed) return;
    if (currentPresets.includes(trimmed)) {
      setNewPresetText('');
      return;
    }
    const updated = [...currentPresets, trimmed];
    onUpdateSettings({ pointPresets: updated });
    setNewPresetText('');
  };

  const handleRemovePreset = (presetToRemove: string) => {
    const updated = currentPresets.filter((p) => p !== presetToRemove);
    onUpdateSettings({ pointPresets: updated });
  };

  const handleResetRallyPresets = () => {
    onUpdateSettings({ pointPresets: DEFAULT_RALLY_PRESETS });
  };

  const handleActivityModeChange = (mode: ActivityMode) => {
    onUpdateSettings({ activityMode: mode });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 text-[#0050cb]">
            <Sliders className="w-5 h-5" />
            <h2 className="text-lg font-black text-slate-800">Beállítások</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-sm">
          {/* 🌟 Útvonaltervező (Tervező) Prominent Feature */}
          {onOpenRoutePlanner && (
            <div className="p-3.5 bg-gradient-to-br from-blue-50 via-indigo-50/40 to-purple-50/50 rounded-2xl border-2 border-[#0050cb]/20 shadow-2xs space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-[#0050cb] text-white rounded-xl shadow-xs">
                    <Map className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Útvonaltervező</span>
                      <span className="text-[9px] bg-purple-600 text-white font-extrabold px-1.5 py-0.2 rounded-full uppercase tracking-normal">Új</span>
                    </h3>
                    <p className="text-[11px] text-slate-600 font-medium">
                      Térképes útvonal és ellenőrzőpontok manuális megrajzolása
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 leading-relaxed">
                Tervezz útvonalat kattintással a térképen, adj hozzá számozott résztávokat/rally pontokat, mintha valós időben logoltál volna.
              </p>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRoutePlanner();
                }}
                className="w-full py-2 px-3 bg-[#0050cb] hover:bg-blue-700 active:scale-98 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>Útvonaltervező Megnyitása</span>
              </button>
            </div>
          )}

          {/* 1. Activity / Tracking Mode (Gyalog, Kerékpár, Autó) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Rögzítés Módja
            </label>
            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-2xl">
              <button
                onClick={() => handleActivityModeChange('walking')}
                className={`py-2 px-1.5 rounded-xl font-bold text-xs flex flex-col items-center gap-1 transition-all ${
                  settings.activityMode === 'walking'
                    ? 'bg-white text-[#0060e6] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Footprints className="w-4 h-4" />
                <span>Gyalog</span>
              </button>
              <button
                onClick={() => handleActivityModeChange('cycling')}
                className={`py-2 px-1.5 rounded-xl font-bold text-xs flex flex-col items-center gap-1 transition-all ${
                  settings.activityMode === 'cycling'
                    ? 'bg-white text-[#0060e6] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Bike className="w-4 h-4" />
                <span>Kerékpár</span>
              </button>
              <button
                onClick={() => handleActivityModeChange('car')}
                className={`py-2 px-1.5 rounded-xl font-bold text-xs flex flex-col items-center gap-1 transition-all ${
                  settings.activityMode === 'car'
                    ? 'bg-white text-[#0060e6] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Car className="w-4 h-4" />
                <span>Autó</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 font-medium px-1">
              {settings.activityMode === 'car' && '🚗 Autó: 1 másodpercenkénti sűrű GPS mintavételezés gyors haladáshoz.'}
              {settings.activityMode === 'cycling' && '🚲 Kerékpár: 2.5 másodpercenkénti kiegyensúlyozott mintavételezés.'}
              {settings.activityMode === 'walking' && '🚶 Gyalog: 5 másodpercenkénti energiatakarékos mintavételezés.'}
            </p>
          </div>

          {/* 2. Distance Unit Selection (km, m, mi) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Távolság Kijelzése (Mértékegység)
            </label>
            <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => onUpdateSettings({ unit: 'km' })}
                className={`py-2 rounded-lg font-bold text-xs transition-all ${
                  settings.unit === 'km' ? 'bg-white text-[#0060e6] shadow-sm' : 'text-slate-600'
                }`}
              >
                Kilométer (km)
              </button>
              <button
                onClick={() => onUpdateSettings({ unit: 'm' })}
                className={`py-2 rounded-lg font-bold text-xs transition-all ${
                  settings.unit === 'm' ? 'bg-white text-[#0060e6] shadow-sm' : 'text-slate-600'
                }`}
              >
                Méter (m)
              </button>
              <button
                onClick={() => onUpdateSettings({ unit: 'mi' })}
                className={`py-2 rounded-lg font-bold text-xs transition-all ${
                  settings.unit === 'mi' ? 'bg-white text-[#0060e6] shadow-sm' : 'text-slate-600'
                }`}
              >
                Mérföld (mi)
              </button>
            </div>
          </div>

          {/* 3. Auto Split Interval */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Automatikus Résztáv (Auto-Split)
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { val: 0.5, label: '0.5 km' },
                { val: 1.0, label: '1.0 km' },
                { val: 2.0, label: '2.0 km' },
                { val: 5.0, label: '5.0 km' },
                { val: 10.0, label: '10 km' },
                { val: 0, label: 'Kézi' },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => onUpdateSettings({ autoSplitDistanceKm: opt.val })}
                  className={`py-2 px-1 rounded-xl font-bold text-xs border text-center transition-all ${
                    settings.autoSplitDistanceKm === opt.val
                      ? 'bg-blue-50 border-[#0060e6] text-[#0060e6]'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Coordinate Format */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Főképernyő Koordináta Formátum
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => onUpdateSettings({ coordinateFormat: 'dms' })}
                className={`py-2 rounded-lg font-bold text-xs transition-all ${
                  settings.coordinateFormat === 'dms' ? 'bg-white text-[#0060e6] shadow-sm' : 'text-slate-600'
                }`}
              >
                DMS (37°46'39"N)
              </button>
              <button
                onClick={() => onUpdateSettings({ coordinateFormat: 'decimal' })}
                className={`py-2 rounded-lg font-bold text-xs transition-all ${
                  settings.coordinateFormat === 'decimal' ? 'bg-white text-[#0060e6] shadow-sm' : 'text-slate-600'
                }`}
              >
                Tizedes (37.7775°)
              </button>
            </div>
          </div>

          {/* 5. Audio & Haptic Toggles */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-700">Hangjelzés résztávoknál</span>
              </div>
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => onUpdateSettings({ soundEnabled: e.target.checked })}
                className="w-4 h-4 accent-[#0060e6] cursor-pointer rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Vibrate className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-700">Rezgés (Haptic feedback)</span>
              </div>
              <input
                type="checkbox"
                checked={settings.hapticsEnabled}
                onChange={(e) => onUpdateSettings({ hapticsEnabled: e.target.checked })}
                className="w-4 h-4 accent-[#0060e6] cursor-pointer rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-700">Nagy pontosságú GPS</span>
              </div>
              <input
                type="checkbox"
                checked={settings.highAccuracy}
                onChange={(e) => onUpdateSettings({ highAccuracy: e.target.checked })}
                className="w-4 h-4 accent-[#0060e6] cursor-pointer rounded"
              />
            </div>
          </div>

          {/* Rally / Pont Elnevezési Sablonok */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#0050cb]" />
                <span>Rally / Pont Elnevezések</span>
              </label>
              <button
                type="button"
                onClick={handleResetRallyPresets}
                className="text-[11px] font-bold text-[#0050cb] hover:underline cursor-pointer"
                title="Visszaállítás az alapértelmezett Rally sablonokra"
              >
                Rally alapértékek
              </button>
            </div>

            {/* Input to add custom name */}
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newPresetText}
                onChange={(e) => setNewPresetText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPreset();
                  }
                }}
                placeholder="Új fix elnevezés hozzáadása..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0050cb]/40 focus:bg-white transition-all"
              />
              <button
                type="button"
                onClick={handleAddPreset}
                disabled={!newPresetText.trim()}
                className="bg-[#0050cb] disabled:opacity-40 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Hozzáad</span>
              </button>
            </div>

            {/* List of current preset chips with remove button */}
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200/70 custom-scrollbar">
              {currentPresets.map((preset) => {
                const icon = getPresetIcon(preset);
                return (
                  <div
                    key={preset}
                    className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 shadow-2xs group"
                  >
                    <span>{icon}</span>
                    <span className="font-semibold text-[11px]">{preset}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePreset(preset)}
                      className="text-slate-300 hover:text-red-600 transition-colors p-0.5 rounded-sm cursor-pointer ml-0.5"
                      title={`${preset} törlése`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400">
              Ezek a rally biztonsági és egyedi fix elnevezések gyorsgombként megjelennek a résztávoknál.
            </p>
          </div>

          {/* 6. Simulation Mode */}
          <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-[#0060e6]" />
                <div>
                  <div className="text-xs font-bold text-slate-800">GPS Szimuláció (Demo Mód)</div>
                  <div className="text-[11px] text-slate-500">Benti/asztali teszteléshez</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.simulationMode}
                onChange={(e) => onUpdateSettings({ simulationMode: e.target.checked })}
                className="w-4 h-4 accent-[#0060e6] cursor-pointer rounded"
              />
            </div>

            {settings.simulationMode && (
              <div className="pt-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">Szimulált sebesség:</span>
                <div className="flex gap-1">
                  {[1, 2, 5, 10].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => onUpdateSettings({ simulationSpeed: spd })}
                      className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                        settings.simulationSpeed === spd
                          ? 'bg-[#0060e6] text-white'
                          : 'bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 7. Alaphelyzet beállítás (Reset to Default: Autó, Méter, Kézi) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                if (onResetDefaults) {
                  onResetDefaults();
                } else {
                  onUpdateSettings({
                    activityMode: 'car',
                    unit: 'm',
                    autoSplitDistanceKm: 0,
                    coordinateFormat: 'dms',
                    mapLayer: 'osm',
                    highAccuracy: true,
                    soundEnabled: true,
                    hapticsEnabled: true,
                    simulationMode: false,
                    pointPresets: DEFAULT_RALLY_PRESETS,
                  });
                }
              }}
              className="w-full py-2.5 px-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:scale-98 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-[#0060e6]" />
              <span>Alaphelyzet beállítás (Autó, Méter, Kézi)</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="w-full bg-[#0060e6] hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-colors cursor-pointer"
          >
            Mentés & Bezárás
          </button>
        </div>
      </div>
    </div>
  );
};
