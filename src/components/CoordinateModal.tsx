import React, { useState } from 'react';
import { X, Copy, Check, Share2, MapPin, ExternalLink, Compass } from 'lucide-react';
import { Coordinate } from '../types';
import { getDetailedCoordinates } from '../utils/geoUtils';

interface CoordinateModalProps {
  isOpen: boolean;
  onClose: () => void;
  coordinate: Coordinate | null;
}

export const CoordinateModal: React.FC<CoordinateModalProps> = ({
  isOpen,
  onClose,
  coordinate,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const lat = coordinate?.lat ?? 37.777528;
  const lng = coordinate?.lng ?? -122.416389;
  const details = getDetailedCoordinates(lat, lng);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleShare = async () => {
    const shareText = `📍 Jelenlegi GPS Pozíció:\n${details.dms}\n(${details.dd})\n\nTérkép:\n${details.googleMapsUrl}`;

    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: 'GPS Tracker Pozíció',
          text: shareText,
          url: details.googleMapsUrl,
        });
        setShareFeedback('Megosztva!');
        setTimeout(() => setShareFeedback(null), 2500);
        return;
      } catch (err) {
        // User cancelled or share not supported
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      setShareFeedback('Vágólapra másolva!');
      setTimeout(() => setShareFeedback(null), 2500);
    } catch {
      setShareFeedback('Másolás sikertelen');
    }
  };

  const formats = [
    {
      key: 'dms',
      label: 'DMS (Fok, Perc, Másodperc)',
      value: details.dms,
      description: `${details.latDms}  ${details.lngDms}`,
    },
    {
      key: 'dd',
      label: 'Tizedes Fok (DD / WGS84)',
      value: details.dd,
      description: 'Szabványos GPS koordináták navigációhoz',
    },
    {
      key: 'ddm',
      label: 'DDM (Fok és Tizedes Perc)',
      value: details.ddm,
      description: 'Hajózási és geocaching szabvány',
    },
    {
      key: 'utm',
      label: 'UTM / Rácshálózat Zóna',
      value: details.utm,
      description: 'Földrajzi zóna besorolás',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-[#eaf2ff]">
          <div className="flex items-center gap-2 text-[#0050cb]">
            <MapPin className="w-5 h-5" />
            <h2 className="text-lg font-black text-slate-800">GPS Pozíció & Koordináták</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar flex-1">
          {/* Share Button Prominent */}
          <button
            id="btn-share-coordinates"
            onClick={handleShare}
            className="w-full bg-[#0060e6] hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-2xl shadow-md flex items-center justify-center gap-2 text-sm transition-transform active:scale-98 cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>{shareFeedback || 'Aktuális Pozíció Megosztása'}</span>
          </button>

          {/* Formats list */}
          <div className="space-y-2.5 pt-1">
            {formats.map((fmt) => (
              <div
                key={fmt.key}
                className="p-3 bg-slate-50 hover:bg-blue-50/40 rounded-2xl border border-slate-100 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    {fmt.label}
                  </span>
                  <button
                    onClick={() => handleCopy(fmt.value, fmt.key)}
                    className="flex items-center gap-1 text-xs font-bold text-[#0060e6] hover:text-blue-800 p-1 rounded-md hover:bg-blue-100/50 transition-colors"
                    title="Másolás"
                  >
                    {copiedKey === fmt.key ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-[11px] text-emerald-600">Másolva</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[11px]">Másolás</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="text-sm font-black text-slate-900 font-mono select-all">
                  {fmt.value}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{fmt.description}</div>
              </div>
            ))}
          </div>

          {/* Quick External Map Openers */}
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Megnyitás Térképen
            </span>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={details.googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 bg-white border border-slate-200 hover:border-blue-300 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 hover:text-[#0060e6] shadow-2xs transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Google Maps
              </a>
              <a
                href={details.osmUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 bg-white border border-slate-200 hover:border-blue-300 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 hover:text-[#0060e6] shadow-2xs transition-colors"
              >
                <Compass className="w-3.5 h-3.5" /> OpenStreetMap
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Bezárás
          </button>
        </div>
      </div>
    </div>
  );
};
