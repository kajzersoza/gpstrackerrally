import React from 'react';
import { Layers, Compass, Zap, Navigation } from 'lucide-react';
import { Coordinate, UserSettings } from '../types';
import { OsmMap } from './OsmMap';
import { formatDMS } from '../utils/geoUtils';

interface MapsViewProps {
  coordinates: Coordinate[];
  currentLocation: Coordinate | null;
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
}

export const MapsView: React.FC<MapsViewProps> = ({
  coordinates,
  currentLocation,
  settings,
  onUpdateSettings,
}) => {
  const activeLat = currentLocation?.lat ?? (coordinates.length > 0 ? coordinates[coordinates.length - 1].lat : 37.777528);
  const activeLng = currentLocation?.lng ?? (coordinates.length > 0 ? coordinates[coordinates.length - 1].lng : -122.416389);
  const dms = formatDMS(activeLat, activeLng);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f4f7fb] relative">
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 bg-white/95 border-b border-slate-100 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-[#0050cb]" />
          <h1 className="text-xl font-black text-[#0050cb]">OpenStreetMap Nézet</h1>
        </div>
        <div className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
          {activeLat.toFixed(4)}°, {activeLng.toFixed(4)}°
        </div>
      </header>

      {/* Full-height OSM Map */}
      <div className="flex-1 w-full h-full relative">
        <OsmMap
          coordinates={coordinates}
          currentLocation={currentLocation}
          mapLayer={settings.mapLayer}
          interactive={true}
          showLayerSelector={true}
          onLayerChange={(layer) => onUpdateSettings({ mapLayer: layer })}
        />

        {/* Floating Top-Left Status Card */}
        <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-xs p-2.5 rounded-2xl shadow-md border border-slate-200/80 max-w-[200px]">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">GPS Pozíció</div>
          <div className="text-xs font-mono font-bold text-slate-800 leading-tight mt-0.5">
            {dms.latDms}
          </div>
          <div className="text-xs font-mono font-bold text-slate-800 leading-tight">
            {dms.lngDms}
          </div>
          {coordinates.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Rögzített pontok:</span>
              <span className="font-bold text-[#0050cb]">{coordinates.length}</span>
            </div>
          )}
        </div>

        {/* Floating Bottom Quick Layer Switcher */}
        <div className="absolute bottom-4 left-3 right-16 z-10 bg-white/95 backdrop-blur-xs p-1.5 rounded-2xl shadow-lg border border-slate-200 flex items-center justify-around gap-1">
          <button
            onClick={() => onUpdateSettings({ mapLayer: 'osm' })}
            className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all text-center ${
              settings.mapLayer === 'osm' ? 'bg-[#0060e6] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            OSM
          </button>
          <button
            onClick={() => onUpdateSettings({ mapLayer: 'voyager' })}
            className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all text-center ${
              settings.mapLayer === 'voyager' ? 'bg-[#0060e6] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Voyager
          </button>
          <button
            onClick={() => onUpdateSettings({ mapLayer: 'positron' })}
            className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all text-center ${
              settings.mapLayer === 'positron' ? 'bg-[#0060e6] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Positron
          </button>
          <button
            onClick={() => onUpdateSettings({ mapLayer: 'satellite' })}
            className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all text-center ${
              settings.mapLayer === 'satellite' ? 'bg-[#0060e6] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Műhold
          </button>
        </div>
      </div>
    </div>
  );
};
