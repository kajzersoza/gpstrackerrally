import React from 'react';
import { X, Navigation, History, Settings, Play, Sparkles, Download, Info, CheckCircle2, RotateCcw } from 'lucide-react';
import { ActiveTab, UserSettings } from '../types';

interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenSettings: () => void;
  onLoadDemoData: () => void;
  onExportCurrentGPX: () => void;
  onResetData?: () => void;
  onOpenCloudSync?: () => void;
  hasTrackData: boolean;
}

export const MenuDrawer: React.FC<MenuDrawerProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  onOpenSettings,
  onLoadDemoData,
  onExportCurrentGPX,
  onResetData,
  onOpenCloudSync,
  hasTrackData,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer Content */}
      <div className="relative w-72 max-w-[80vw] bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-[#0050cb] to-[#0066ff] text-white flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black font-heading tracking-tight">GPS TRACKER</h2>
            <p className="text-xs text-blue-100 font-medium">PWA OpenStreetMap Futó App</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu Navigation */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 text-sm custom-scrollbar">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1">
            Navigáció
          </div>

          <button
            onClick={() => {
              onSelectTab('activity');
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-700 hover:bg-blue-50 hover:text-[#0050cb] font-bold transition-colors text-left"
          >
            <Navigation className="w-4 h-4 text-[#0050cb]" />
            <span>Aktív Nyomkövetés</span>
          </button>

          <button
            onClick={() => {
              onSelectTab('history');
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-700 hover:bg-blue-50 hover:text-[#0050cb] font-bold transition-colors text-left"
          >
            <History className="w-4 h-4 text-[#0050cb]" />
            <span>Előzmények & Trackek</span>
          </button>

          <button
            onClick={() => {
              onSelectTab('maps');
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-700 hover:bg-blue-50 hover:text-[#0050cb] font-bold transition-colors text-left"
          >
            <Navigation className="w-4 h-4 text-[#0050cb]" />
            <span>Térkép Teljes Képernyő</span>
          </button>

          <div className="my-2 border-t border-slate-100" />

          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1">
            Gyorsműveletek
          </div>

          {onOpenCloudSync && (
            <button
              onClick={() => {
                onOpenCloudSync();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-700 hover:bg-blue-50 hover:text-[#0050cb] font-semibold transition-colors text-left"
            >
              <Sparkles className="w-4 h-4 text-[#0050cb]" />
              <span>Felhő Megosztás & Betöltés</span>
            </button>
          )}

          <button
            onClick={() => {
              onLoadDemoData();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-700 hover:bg-blue-50 hover:text-[#0050cb] font-semibold transition-colors text-left"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Képernyő Minta Adatok (12.45 km)</span>
          </button>

          <button
            disabled={!hasTrackData}
            onClick={() => {
              onExportCurrentGPX();
              onClose();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold transition-colors text-left ${
              hasTrackData
                ? 'text-slate-700 hover:bg-blue-50 hover:text-[#0050cb]'
                : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Aktuális GPX Export</span>
          </button>

          <button
            onClick={() => {
              onOpenSettings();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-700 hover:bg-blue-50 hover:text-[#0050cb] font-semibold transition-colors text-left"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span>Beállítások</span>
          </button>

          {onResetData && (
            <button
              onClick={() => {
                onResetData();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-700 hover:bg-red-50 hover:text-red-600 font-semibold transition-colors text-left"
            >
              <RotateCcw className="w-4 h-4 text-red-500" />
              <span>Alaphelyzet beállítás (Autó, Méter, Kézi)</span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 space-y-1">
          <div className="font-bold text-slate-700">GPS Tracker PWA v1.0</div>
          <div className="text-[11px] text-slate-400">OpenStreetMap & Geolocation API</div>
        </div>
      </div>
    </div>
  );
};
