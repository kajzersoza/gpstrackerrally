import React, { useState, useRef } from 'react';
import {
  X,
  MapPin,
  Share2,
  Camera,
  Image as ImageIcon,
  Trash2,
  Check,
  ExternalLink,
  Copy,
  Clock,
  Navigation,
  FileText,
  Tag,
  Maximize2,
} from 'lucide-react';
import { Split, UserSettings } from '../types';
import { formatDistanceByUnit, getCumulativeDistanceForSplit } from '../utils/geoUtils';
import { DEFAULT_RALLY_PRESETS, getPresetIcon } from '../constants/rallyPresets';

interface SplitDetailModalProps {
  split: Split;
  allSplits?: Split[];
  unit: UserSettings['unit'];
  presets?: string[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedSplit: Split) => void;
}

export const SplitDetailModal: React.FC<SplitDetailModalProps> = ({
  split,
  allSplits = [],
  unit,
  presets = DEFAULT_RALLY_PRESETS,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(split.name || '');
  const [notes, setNotes] = useState(split.notes || '');
  const [photos, setPhotos] = useState<string[]>(split.photos || []);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const activePresets = presets && presets.length > 0 ? presets : DEFAULT_RALLY_PRESETS;

  const splitDist = formatDistanceByUnit(split.distanceKm, unit);
  const cumulativeKm = getCumulativeDistanceForSplit(split, allSplits);
  const totalDist = formatDistanceByUnit(cumulativeKm, unit);

  // Compress and convert image to data URL
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
            setPhotos((prev) => [...prev, compressedDataUrl]);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

    if (e.target) {
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const updated: Split = {
      ...split,
      name: name.trim() || undefined,
      notes: notes.trim() || undefined,
      photos: photos.length > 0 ? photos : undefined,
    };
    onSave(updated);
    onClose();
  };

  // Generate shareable text and links
  const coord = split.coordinate;
  const mapsUrl = coord ? `https://www.google.com/maps?q=${coord.lat},${coord.lng}` : '';
  const osmUrl = coord ? `https://www.openstreetmap.org/?mlat=${coord.lat}&mlon=${coord.lng}#map=17/${coord.lat}/${coord.lng}` : '';

  const getShareText = () => {
    const titleText = name ? `🚩 ${name} (Résztáv #${split.formattedIndex})` : `🚩 Résztáv #${split.formattedIndex}`;
    const lines = [
      titleText,
      `📏 Szakasz távolság: ${splitDist.value} ${splitDist.unitLabel}`,
      `⏱️ Szakasz idő: ${split.formattedTime}`,
      `📍 Össztáv a starttól: ${totalDist.value} ${totalDist.unitLabel}`,
    ];

    if (notes) {
      lines.push(`📝 Megjegyzés: ${notes}`);
    }

    if (coord) {
      lines.push(`🌐 GPS: ${coord.lat.toFixed(6)}, ${coord.lng.toFixed(6)}`);
      lines.push(`🗺️ Google Térkép: ${mapsUrl}`);
    }

    return lines.join('\n');
  };

  const handleShare = async () => {
    const shareText = getShareText();
    const shareTitle = name ? `${name} - Résztáv #${split.formattedIndex}` : `Résztáv #${split.formattedIndex}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: mapsUrl || undefined,
        });
        return;
      } catch {
        // Fallback to clipboard if share was cancelled or failed
      }
    }

    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-[#f8faff]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0050cb] text-white flex items-center justify-center font-black font-heading text-lg shadow-sm">
              #{split.formattedIndex}
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 font-heading leading-tight">
                {name || `Résztáv #${split.formattedIndex}`}
              </h2>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mt-0.5 font-heading">
                <span>{splitDist.value} {splitDist.unitLabel}</span>
                <span>•</span>
                <span>{split.formattedTime}</span>
                <span>•</span>
                <span className="text-[#0050cb]">Össz: {totalDist.value} {totalDist.unitLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleShare}
              className="p-2 text-[#0050cb] hover:bg-blue-100/70 rounded-xl transition-colors active:scale-95 cursor-pointer"
              title="Résztáv megosztása"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors active:scale-95 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {/* Toast for copy */}
          {copiedToast && (
            <div className="bg-emerald-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center justify-between shadow-md">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Résztáv adatai vágólapra másolva!
              </span>
            </div>
          )}

          {/* 1. Point Name / Title */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              <Tag className="w-3.5 h-3.5 text-[#0050cb]" />
              <span>Résztáv / Pont elnevezése</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pl. Start pont, Cél pont, Figyelmeztetés, Lassító..."
              className="w-full bg-[#f8faff] border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0050cb]/40 focus:bg-white transition-all"
            />

            {/* Quick preset chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {activePresets.map((preset) => {
                const icon = getPresetIcon(preset);
                const isSelected = name === preset || name.includes(preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setName(preset)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#0050cb] text-white border-[#0050cb] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>{icon}</span>
                    <span>{preset}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Notes / Comments */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              <FileText className="w-3.5 h-3.5 text-[#0050cb]" />
              <span>Megjegyzések / Leírás</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Írj megjegyzést ehhez a ponthoz (útviszonyok, látványosság, élmények)..."
              className="w-full bg-[#f8faff] border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0050cb]/40 focus:bg-white transition-all resize-none"
            />
          </div>

          {/* 3. Photos / Images */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Camera className="w-3.5 h-3.5 text-[#0050cb]" />
                <span>Képek / Fotók ({photos.length})</span>
              </label>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-xs font-bold text-[#0050cb] hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Kép hozzáadása</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageUpload}
            />

            {/* Photo Gallery Grid */}
            {photos.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mt-2">
                {photos.map((photo, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-xl overflow-hidden aspect-square border border-slate-200 shadow-2xs bg-slate-100"
                  >
                    <img
                      src={photo}
                      alt={`Résztáv fotó ${idx + 1}`}
                      className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => setPreviewPhoto(photo)}
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 pointer-events-none">
                      <span className="text-white text-xs font-bold drop-shadow">Nagyítás</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePhoto(idx);
                      }}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-lg opacity-90 hover:opacity-100 shadow-md cursor-pointer"
                      title="Kép törlése"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-[#0050cb] rounded-2xl p-4 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-blue-50/30"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 text-[#0050cb] flex items-center justify-center mx-auto mb-1.5">
                  <Camera className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-slate-700">Kattints fotó készítéséhez vagy feltöltéséhez</p>
                <p className="text-[11px] text-slate-400 mt-0.5">JPG, PNG, WebP formátumok támogatottak</p>
              </div>
            )}
          </div>

          {/* 4. GPS Coordinates Info & External Map Links */}
          {coord && (
            <div className="bg-[#f8faff] rounded-2xl p-3.5 border border-slate-200/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 uppercase">
                  <Navigation className="w-3.5 h-3.5 text-[#0050cb]" />
                  <span>GPS Pozíció</span>
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  {coord.lat.toFixed(6)}, {coord.lng.toFixed(6)}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold py-1.5 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                  <span>Google Térkép</span>
                </a>
                <a
                  href={osmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold py-1.5 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                  <span>OpenStreetMap</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <footer className="flex-shrink-0 flex items-center gap-2 px-5 py-3.5 border-t border-slate-100 bg-[#f8faff]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            Mégse
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="px-4 py-2.5 rounded-xl font-bold text-sm bg-blue-50 hover:bg-blue-100 text-[#0050cb] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Megosztás</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-[#0060e6] hover:bg-blue-700 text-white flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Mentés</span>
          </button>
        </footer>
      </div>

      {/* Fullscreen Photo Lightbox Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-60 bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <button
            onClick={() => setPreviewPhoto(null)}
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={previewPhoto}
            alt="Nagyított fotó"
            className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
