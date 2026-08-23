import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import {
  X,
  Compass,
  MapPin,
  Plus,
  Trash2,
  Undo2,
  Save,
  Navigation,
  Car,
  Bike,
  Footprints,
  Layers,
  ChevronDown,
  ChevronUp,
  Tag,
  Clock,
  Gauge,
  Sparkles,
  Download,
  Crosshair,
  Edit2,
  Check,
  AlertCircle,
  HelpCircle,
  Flag,
  Target,
} from 'lucide-react';
import {
  Coordinate,
  Split,
  ActivitySession,
  UserSettings,
  ActivityMode,
} from '../types';
import {
  calculateDistance,
  formatDistanceByUnit,
  formatElapsedTime,
  formatSplitDuration,
  formatClockTime,
  calculateSplitTrend,
  exportToGPX,
} from '../utils/geoUtils';
import { MapLayerType } from './OsmMap';
import { DEFAULT_RALLY_PRESETS, getPresetIcon } from '../constants/rallyPresets';

interface RoutePlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  currentGpsLocation: Coordinate | null;
  onSavePlannedSession: (session: ActivitySession, loadForTracking?: boolean) => void;
}

interface PlannedPoint {
  id: string;
  lat: number;
  lng: number;
  isSplit: boolean;
  name: string;
  notes?: string;
  distanceFromPrevKm: number;
  cumulativeDistKm: number;
}

type PlannerTool = 'add-track' | 'add-split';

const SPEED_PRESETS = [
  { label: 'Autó (60 km/h)', speedKmh: 60, icon: Car, mode: 'car' as ActivityMode },
  { label: 'Rally / Gyors (85 km/h)', speedKmh: 85, icon: Gauge, mode: 'car' as ActivityMode },
  { label: 'Motor (50 km/h)', speedKmh: 50, icon: Compass, mode: 'car' as ActivityMode },
  { label: 'Kerékpár (22 km/h)', speedKmh: 22, icon: Bike, mode: 'cycling' as ActivityMode },
  { label: 'Futás (10 km/h)', speedKmh: 10, icon: Footprints, mode: 'walking' as ActivityMode },
  { label: 'Gyalog (4.5 km/h)', speedKmh: 4.5, icon: Footprints, mode: 'walking' as ActivityMode },
];

/**
 * Geometric projection of point (lat, lng) onto segment (lat1, lng1)-(lat2, lng2)
 */
function projectPointOnSegment(
  lat: number,
  lng: number,
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): { projLat: number; projLng: number; distKm: number; t: number } {
  const midLat = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const cosMidLat = Math.cos(midLat);

  const dx = (lng2 - lng1) * cosMidLat;
  const dy = lat2 - lat1;
  const px = (lng - lng1) * cosMidLat;
  const py = lat - lat1;

  const segLenSq = dx * dx + dy * dy;
  let t = 0;
  if (segLenSq > 0) {
    t = Math.max(0, Math.min(1, (px * dx + py * dy) / segLenSq));
  }

  const projLat = lat1 + t * (lat2 - lat1);
  const projLng = lng1 + t * (lng2 - lng1);
  const distKm = calculateDistance(lat, lng, projLat, projLng);

  return { projLat, projLng, distKm, t };
}

export const RoutePlannerModal: React.FC<RoutePlannerModalProps> = ({
  isOpen,
  onClose,
  settings,
  currentGpsLocation,
  onSavePlannedSession,
}) => {
  const [points, setPoints] = useState<PlannedPoint[]>([]);
  const [activeTool, setActiveTool] = useState<PlannerTool>('add-track');
  const [routeTitle, setRouteTitle] = useState<string>('Tervezett Rally Útvonal');
  const [targetSpeedKmh, setTargetSpeedKmh] = useState<number>(60);
  const [activityMode, setActivityMode] = useState<ActivityMode>(settings.activityMode || 'car');
  const [mapLayer, setMapLayer] = useState<MapLayerType>(settings.mapLayer || 'osm');
  const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false);
  const [showPointsList, setShowPointsList] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Edit point state
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [editingPointName, setEditingPointName] = useState<string>('');
  const [editingPointNotes, setEditingPointNotes] = useState<string>('');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const polylineCasingRef = useRef<L.Polyline | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const snapIndicatorRef = useRef<L.Polyline | null>(null);

  const presets = settings.pointPresets && settings.pointPresets.length > 0 ? settings.pointPresets : DEFAULT_RALLY_PRESETS;

  // Show quick toast notification
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const initialCenter: [number, number] = currentGpsLocation
      ? [currentGpsLocation.lat, currentGpsLocation.lng]
      : points.length > 0
      ? [points[0].lat, points[0].lng]
      : [47.4979, 19.0402]; // Budapest / default center

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    const getTileUrl = (layer: MapLayerType) => {
      switch (layer) {
        case 'voyager':
          return 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
        case 'positron':
          return 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        case 'cyclosm':
          return 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png';
        case 'satellite':
          return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        case 'osm':
        default:
          return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      }
    };

    const tileLayer = L.tileLayer(getTileUrl(mapLayer), {
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Track polyline layers
    const casing = L.polyline([], {
      color: '#ffffff',
      weight: 8,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    const poly = L.polyline([], {
      color: '#0066ff',
      weight: 5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    const snapLine = L.polyline([], {
      color: '#9333ea',
      weight: 3,
      dashArray: '5, 5',
      opacity: 0.8,
    }).addTo(map);

    polylineCasingRef.current = casing;
    polylineRef.current = poly;
    snapIndicatorRef.current = snapLine;

    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;

    mapRef.current = map;

    // Invalidate size on open
    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [isOpen]);

  // Update Tile Layer when layer changes
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    const getTileUrl = (layer: MapLayerType) => {
      switch (layer) {
        case 'voyager':
          return 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
        case 'positron':
          return 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        case 'cyclosm':
          return 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png';
        case 'satellite':
          return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        case 'osm':
        default:
          return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      }
    };

    tileLayerRef.current.setUrl(getTileUrl(mapLayer));
  }, [mapLayer]);

  // Recalculate and render markers & lines when points state changes
  useEffect(() => {
    if (!mapRef.current || !polylineRef.current || !polylineCasingRef.current || !markersGroupRef.current) return;

    const latlngs: [number, number][] = points.map((p) => [p.lat, p.lng]);
    polylineRef.current.setLatLngs(latlngs);
    polylineCasingRef.current.setLatLngs(latlngs);

    const group = markersGroupRef.current;
    group.clearLayers();

    // Find splits to number them
    let splitCount = 0;

    points.forEach((pt, index) => {
      const isStart = index === 0;
      const isEnd = index === points.length - 1 && points.length > 1;

      if (pt.isSplit || isStart || isEnd) {
        if (pt.isSplit && !isStart && !isEnd) {
          splitCount++;
        }

        const badgeText = isStart
          ? 'START'
          : isEnd
          ? 'CÉL'
          : `#${String(splitCount).padStart(2, '0')}`;

        const bgClass = isStart
          ? 'bg-emerald-600 border-white text-white'
          : isEnd
          ? 'bg-rose-600 border-white text-white'
          : 'bg-purple-700 border-white text-white';

        const customIcon = L.divIcon({
          className: 'custom-planner-marker',
          html: `
            <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
              <div style="box-shadow: 0 4px 12px rgba(0,0,0,0.35); border-radius: 9999px; padding: 4px 9px; font-weight: 900; font-size: 11px; display: flex; align-items: center; gap: 4px; border: 2px solid white; white-space: nowrap;" class="${bgClass}">
                <span>${badgeText}</span>
                ${pt.name ? `<span style="font-size: 10px; font-weight: 700; opacity: 0.95; max-width: 90px; overflow: hidden; text-overflow: ellipsis;">${pt.name}</span>` : ''}
              </div>
              <div style="width: 2px; height: 8px; background: #1e293b;"></div>
              <div style="width: 6px; height: 6px; border-radius: 50%; background: #1e293b;"></div>
            </div>
          `,
          iconSize: [0, 0],
        });

        const marker = L.marker([pt.lat, pt.lng], {
          icon: customIcon,
          draggable: true,
        }).addTo(group);

        marker.on('dragend', (evt: any) => {
          const newPos = evt.target.getLatLng();
          handleMovePoint(pt.id, newPos.lat, newPos.lng);
        });

        marker.on('click', (evt: any) => {
          L.DomEvent.stopPropagation(evt);
          openEditPoint(pt);
        });
      } else {
        // Small node dot for regular track points
        const nodeIcon = L.divIcon({
          className: 'custom-node-marker',
          html: `
            <div style="transform: translate(-50%, -50%); width: 12px; height: 12px; border-radius: 50%; background: #0066ff; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4); cursor: pointer;"></div>
          `,
          iconSize: [0, 0],
        });

        const nodeMarker = L.marker([pt.lat, pt.lng], {
          icon: nodeIcon,
          draggable: true,
        }).addTo(group);

        nodeMarker.on('dragend', (evt: any) => {
          const newPos = evt.target.getLatLng();
          handleMovePoint(pt.id, newPos.lat, newPos.lng);
        });

        nodeMarker.on('click', (evt: any) => {
          L.DomEvent.stopPropagation(evt);
          openEditPoint(pt);
        });
      }
    });
  }, [points]);

  // Click handler on map to add points based on active tool
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      if (activeTool === 'add-track') {
        // Nyomvonal rajzolása mód: egymás utáni pontok lerakása
        handleAddTrackPoint(lat, lng);
      } else if (activeTool === 'add-split') {
        // Pont / Résztáv beszúrás mód: a nyomvonal legközelebbi pontjára illesztés
        handleInsertSplitClosestToRoute(lat, lng);
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [activeTool, points]);

  // 1. Nyomvonal folyamatos rajzolása (Kezdőpont / következő szakaszpont)
  const handleAddTrackPoint = (lat: number, lng: number) => {
    setPoints((prev) => {
      const isFirst = prev.length === 0;

      let distanceFromPrev = 0;
      let cumDist = 0;

      if (!isFirst) {
        const lastPt = prev[prev.length - 1];
        distanceFromPrev = calculateDistance(lastPt.lat, lastPt.lng, lat, lng);
        cumDist = +(lastPt.cumulativeDistKm + distanceFromPrev).toFixed(4);
      }

      const newPoint: PlannedPoint = {
        id: 'plan-pt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        lat,
        lng,
        isSplit: isFirst, // A kezdőpont automatikusan START
        name: isFirst ? 'START - Rajt' : '',
        distanceFromPrevKm: +distanceFromPrev.toFixed(4),
        cumulativeDistKm: cumDist,
      };

      if (isFirst) {
        showToast('📍 Kezdőpont (Rajt) elhelyezve! Kattints a nyomvonal folytatásához.');
      }

      return [...prev, newPoint];
    });
  };

  // 2. Pont / Résztáv beszúrás mód (A nyomvonal legközelebbi szakaszára vetíti)
  const handleInsertSplitClosestToRoute = (lat: number, lng: number) => {
    if (points.length === 0) {
      // Ha még nincs nyomvonal, az első pont lesz a Kezdőpont
      handleAddTrackPoint(lat, lng);
      showToast('📍 Kezdőpont letéve. Rajzolj további útvonalszakaszokat!');
      return;
    }

    if (points.length === 1) {
      // Csak 1 pont van, hozzáadjuk a második pontot mint résztávot
      const lastPt = points[0];
      const dist = calculateDistance(lastPt.lat, lastPt.lng, lat, lng);
      const cumDist = +dist.toFixed(4);

      const newPt: PlannedPoint = {
        id: 'plan-split-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        lat,
        lng,
        isSplit: true,
        name: 'Pont #1',
        distanceFromPrevKm: cumDist,
        cumulativeDistKm: cumDist,
      };

      setPoints([points[0], newPt]);
      openEditPoint(newPt);
      showToast('🎯 Új ellenőrzőpont (#1) hozzáadva!');
      return;
    }

    // Ha van legalább 2 pont (létező nyomvonal): megtaláljuk a legközelebbi vonalszakaszt
    let bestSegmentIndex = 0;
    let minDistanceKm = Infinity;
    let bestProjLat = lat;
    let bestProjLng = lng;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const { projLat, projLng, distKm } = projectPointOnSegment(lat, lng, p1.lat, p1.lng, p2.lat, p2.lng);

      if (distKm < minDistanceKm) {
        minDistanceKm = distKm;
        bestSegmentIndex = i;
        bestProjLat = projLat;
        bestProjLng = projLng;
      }
    }

    // Ideiglenes vizuális segédvonal a kattintott hely és az illesztett pont között
    if (snapIndicatorRef.current && (minDistanceKm * 1000) > 5) {
      snapIndicatorRef.current.setLatLngs([
        [lat, lng],
        [bestProjLat, bestProjLng],
      ]);
      setTimeout(() => {
        snapIndicatorRef.current?.setLatLngs([]);
      }, 1200);
    }

    // Számoljuk meg hányadik résztáv
    const currentSplitsCount = points.filter((p) => p.isSplit && p !== points[0]).length + 1;

    const newPt: PlannedPoint = {
      id: 'plan-split-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      lat: bestProjLat,
      lng: bestProjLng,
      isSplit: true,
      name: `Pont #${currentSplitsCount}`,
      distanceFromPrevKm: 0,
      cumulativeDistKm: 0,
    };

    // Beszúrjuk a legközelebbi szegmens közé
    const updated = [...points];
    updated.splice(bestSegmentIndex + 1, 0, newPt);

    // Távolságok újraszámolása
    let cum = 0;
    for (let i = 0; i < updated.length; i++) {
      if (i === 0) {
        updated[i].distanceFromPrevKm = 0;
        updated[i].cumulativeDistKm = 0;
      } else {
        const d = calculateDistance(updated[i - 1].lat, updated[i - 1].lng, updated[i].lat, updated[i].lng);
        cum += d;
        updated[i].distanceFromPrevKm = +d.toFixed(4);
        updated[i].cumulativeDistKm = +cum.toFixed(4);
      }
    }

    setPoints(updated);
    openEditPoint(newPt);
    showToast(`🎯 Pont illesztve a nyomvonalhoz (${(minDistanceKm * 1000).toFixed(0)} m-re bökve)`);
  };

  // Kezdőpont beállítása aktuális GPS pozícióra
  const handleSetGpsAsStartOrNext = () => {
    if (!currentGpsLocation) {
      alert('Nincs elérhető GPS pozíció! Ellenőrizd a helymeghatározás engedélyezését.');
      return;
    }

    if (points.length === 0) {
      handleAddTrackPoint(currentGpsLocation.lat, currentGpsLocation.lng);
      showToast('📍 Aktuális GPS pozíció beállítva Kezdőpontként (START)!');
    } else {
      handleAddTrackPoint(currentGpsLocation.lat, currentGpsLocation.lng);
      showToast('📍 GPS pont hozzáadva a nyomvonalhoz.');
    }

    if (mapRef.current) {
      mapRef.current.panTo([currentGpsLocation.lat, currentGpsLocation.lng]);
    }
  };

  // Move point when dragged
  const handleMovePoint = (id: string, newLat: number, newLng: number) => {
    setPoints((prev) => {
      const index = prev.findIndex((p) => p.id === id);
      if (index === -1) return prev;

      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        lat: newLat,
        lng: newLng,
      };

      // Recalculate cumulative distances
      let cum = 0;
      for (let i = 0; i < updated.length; i++) {
        if (i === 0) {
          updated[i].distanceFromPrevKm = 0;
          updated[i].cumulativeDistKm = 0;
        } else {
          const d = calculateDistance(updated[i - 1].lat, updated[i - 1].lng, updated[i].lat, updated[i].lng);
          cum += d;
          updated[i].distanceFromPrevKm = +d.toFixed(4);
          updated[i].cumulativeDistKm = +cum.toFixed(4);
        }
      }

      return updated;
    });
  };

  // Undo last added point
  const handleUndo = () => {
    if (points.length === 0) return;
    setPoints((prev) => {
      const updated = prev.slice(0, prev.length - 1);
      return updated;
    });
    showToast('↩️ Utolsó pont visszavonva');
  };

  // Clear all points - 100% reliable in-app modal
  const executeClearAll = () => {
    setPoints([]);
    if (polylineRef.current) polylineRef.current.setLatLngs([]);
    if (polylineCasingRef.current) polylineCasingRef.current.setLatLngs([]);
    if (markersGroupRef.current) markersGroupRef.current.clearLayers();
    if (snapIndicatorRef.current) snapIndicatorRef.current.setLatLngs([]);
    setShowClearConfirm(false);
    showToast('🗑️ Útvonal és összes pont törölve');
  };

  // Recenter map on route bounds
  const handleFitBounds = () => {
    if (!mapRef.current || points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  };

  // Edit Point Modal / Dialog
  const openEditPoint = (pt: PlannedPoint) => {
    setEditingPointId(pt.id);
    setEditingPointName(pt.name || '');
    setEditingPointNotes(pt.notes || '');
  };

  const handleSavePointEdit = () => {
    if (!editingPointId) return;
    setPoints((prev) =>
      prev.map((p) =>
        p.id === editingPointId
          ? {
              ...p,
              name: editingPointName.trim(),
              notes: editingPointNotes.trim() || undefined,
            }
          : p
      )
    );
    setEditingPointId(null);
  };

  const handleToggleSplitStatus = (id: string) => {
    setPoints((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              isSplit: !p.isSplit,
            }
          : p
      )
    );
  };

  const handleDeleteSpecificPoint = (id: string) => {
    setPoints((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      // Recalculate
      let cum = 0;
      for (let i = 0; i < filtered.length; i++) {
        if (i === 0) {
          filtered[i].distanceFromPrevKm = 0;
          filtered[i].cumulativeDistKm = 0;
        } else {
          const d = calculateDistance(filtered[i - 1].lat, filtered[i - 1].lng, filtered[i].lat, filtered[i].lng);
          cum += d;
          filtered[i].distanceFromPrevKm = +d.toFixed(4);
          filtered[i].cumulativeDistKm = +cum.toFixed(4);
        }
      }
      return filtered;
    });
    if (editingPointId === id) {
      setEditingPointId(null);
    }
  };

  // Calculations: Total distance, splits, realistic timestamps, paces
  const totalDistanceKm = points.length > 0 ? points[points.length - 1].cumulativeDistKm : 0;
  const formattedDistance = formatDistanceByUnit(totalDistanceKm, settings.unit || 'm');

  // Calculate estimated total time based on chosen speed
  const estimatedTotalDurationSec = useMemo(() => {
    if (targetSpeedKmh <= 0 || totalDistanceKm <= 0) return 0;
    const hours = totalDistanceKm / targetSpeedKmh;
    return Math.round(hours * 3600);
  }, [totalDistanceKm, targetSpeedKmh]);

  // Construct standard ActivitySession & Splits ("mintha rendesen logoltunk volna")
  const generateCompleteSession = (): ActivitySession => {
    const startTime = Date.now() - estimatedTotalDurationSec * 1000;
    const endTime = Date.now();

    // Generate high-density interpolated coordinates with realistic timestamps
    const coordinates: Coordinate[] = [];
    let accumulatedDistance = 0;

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      if (i === 0) {
        coordinates.push({
          lat: pt.lat,
          lng: pt.lng,
          altitude: 120 + Math.random() * 20,
          speed: targetSpeedKmh / 3.6,
          accuracy: 3.5,
          timestamp: startTime,
        });
      } else {
        const prevPt = points[i - 1];
        const segDistKm = pt.distanceFromPrevKm;
        accumulatedDistance += segDistKm;

        // Add 2-8 intermediate interpolated coordinates for realistic smooth curves if distance is > 150m
        const steps = Math.max(1, Math.min(8, Math.floor(segDistKm / 0.15)));
        for (let s = 1; s <= steps; s++) {
          const ratio = s / steps;
          const lat = prevPt.lat + (pt.lat - prevPt.lat) * ratio;
          const lng = prevPt.lng + (pt.lng - prevPt.lng) * ratio;
          const currentCumDist = accumulatedDistance - segDistKm * (1 - ratio);
          const timeSecFromStart = totalDistanceKm > 0 ? (currentCumDist / totalDistanceKm) * estimatedTotalDurationSec : 0;

          coordinates.push({
            lat,
            lng,
            altitude: 120 + Math.sin(ratio * Math.PI) * 15 + Math.random() * 5,
            speed: (targetSpeedKmh + (Math.random() * 6 - 3)) / 3.6,
            accuracy: 3.0 + Math.random() * 2,
            timestamp: Math.round(startTime + timeSecFromStart * 1000),
          });
        }
      }
    }

    // Generate Splits from planned split points
    const splitPoints = points.filter((p, idx) => p.isSplit || idx === 0 || idx === points.length - 1);
    const splits: Split[] = [];

    let prevCumDist = 0;
    let prevCumTimeSec = 0;

    splitPoints.forEach((sp, idx) => {
      const splitIndex = idx + 1;
      const formattedIndex = String(splitIndex).padStart(2, '0');

      const splitDistKm = +(sp.cumulativeDistKm - prevCumDist).toFixed(3);
      const splitTimeSec = totalDistanceKm > 0
        ? Math.round((sp.cumulativeDistKm / totalDistanceKm) * estimatedTotalDurationSec) - prevCumTimeSec
        : 0;

      const paceSecPerKm = splitDistKm > 0 ? Math.round(splitTimeSec / splitDistKm) : 0;
      const prevPace = idx > 0 ? splits[idx - 1].paceSecPerKm : undefined;
      const trendResult = calculateSplitTrend(paceSecPerKm, prevPace);

      const splitObj: Split = {
        id: 'split-' + (idx + 1) + '-' + Date.now(),
        splitIndex,
        formattedIndex,
        name: sp.name || (idx === 0 ? 'START' : idx === splitPoints.length - 1 ? 'CÉL' : `Pont #${idx}`),
        notes: sp.notes,
        distanceKm: splitDistKm,
        formattedDistance: `${splitDistKm.toFixed(2)} km`,
        timeSec: Math.max(1, splitTimeSec),
        formattedTime: formatSplitDuration(Math.max(1, splitTimeSec)),
        paceSecPerKm,
        paceDiffSec: trendResult.trend === 'up' ? 5 : trendResult.trend === 'down' ? -5 : 0,
        formattedDiff: trendResult.formattedDiff,
        trend: trendResult.trend,
        totalDistanceKm: sp.cumulativeDistKm,
        totalTimeSec: prevCumTimeSec + Math.max(1, splitTimeSec),
        timestamp: Math.round(startTime + (prevCumTimeSec + splitTimeSec) * 1000),
        coordinate: {
          lat: sp.lat,
          lng: sp.lng,
          altitude: 120,
          timestamp: Math.round(startTime + (prevCumTimeSec + splitTimeSec) * 1000),
        },
      };

      splits.push(splitObj);
      prevCumDist = sp.cumulativeDistKm;
      prevCumTimeSec += Math.max(1, splitTimeSec);
    });

    const avgPaceSecPerKm = totalDistanceKm > 0 ? Math.round(estimatedTotalDurationSec / totalDistanceKm) : 0;
    const dateObj = new Date(startTime);
    const formattedDate = `${dateObj.getFullYear()}.${String(dateObj.getMonth() + 1).padStart(2, '0')}.${String(dateObj.getDate()).padStart(2, '0')}`;

    return {
      id: 'session-planned-' + Date.now(),
      title: routeTitle.trim() || 'Tervezett Rally Útvonal',
      startTime,
      endTime,
      formattedStartTime: formatClockTime(startTime),
      formattedDate,
      totalDistanceKm: +totalDistanceKm.toFixed(3),
      totalDurationSec: estimatedTotalDurationSec,
      avgPaceSecPerKm,
      maxSpeedKmh: Math.round(targetSpeedKmh * 1.18),
      avgSpeedKmh: targetSpeedKmh,
      splits,
      coordinates,
      notes: `Tervezővel létrehozott útvonal (${points.length} nyomvonal pont, ${splits.length} ellenőrzőpont). Átlagsebesség: ${targetSpeedKmh} km/h.`,
    };
  };

  const handleSaveToHistory = () => {
    if (points.length < 2) {
      alert('Kérlek rajzolj legalább 2 pontot az útvonal létrehozásához!');
      return;
    }
    const session = generateCompleteSession();
    onSavePlannedSession(session, false);
    onClose();
  };

  const handleSaveAndStartTracking = () => {
    if (points.length < 2) {
      alert('Kérlek rajzolj legalább 2 pontot az útvonal létrehozásához!');
      return;
    }
    const session = generateCompleteSession();
    onSavePlannedSession(session, true);
    onClose();
  };

  const handleExportGPXDirectly = () => {
    if (points.length < 2) {
      alert('Legalább 2 pont szükséges a GPX exporthoz!');
      return;
    }
    const session = generateCompleteSession();
    const gpxString = exportToGPX(session.title, session.coordinates, session.startTime);
    const blob = new Blob([gpxString], { type: 'application/gpx+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${session.title.replace(/\s+/g, '_')}_tervezett.gpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center">
      <div className="bg-white w-full h-full md:max-w-4xl md:h-[92vh] md:rounded-3xl shadow-2xl overflow-hidden flex flex-col relative">
        {/* Top Header */}
        <header className="px-4 py-3 bg-gradient-to-r from-[#0050cb] to-[#0066ff] text-white flex items-center justify-between shadow-md z-20 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-white/10 rounded-xl">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <input
                type="text"
                value={routeTitle}
                onChange={(e) => setRouteTitle(e.target.value)}
                placeholder="Útvonal elnevezése..."
                className="bg-white/15 hover:bg-white/20 focus:bg-white text-white focus:text-slate-900 px-2.5 py-0.5 rounded-lg font-black text-sm md:text-base outline-none transition-all w-full max-w-[180px] sm:max-w-xs font-heading"
              />
              <div className="text-[11px] text-blue-100 font-medium flex items-center gap-1.5">
                <span>{points.length} pont</span>
                <span>•</span>
                <span>{points.filter((p) => p.isSplit).length} résztáv</span>
                <span>•</span>
                <span className="font-bold text-amber-300">{formattedDistance.value} {formattedDistance.unitLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportGPXDirectly}
              disabled={points.length < 2}
              title="GPX Fájl letöltése"
              className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white rounded-xl transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Sub-header Toolbar / Mode Controls */}
        <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar z-20 flex-shrink-0 text-xs">
          {/* Tool mode switches */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              onClick={() => setActiveTool('add-track')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === 'add-track'
                  ? 'bg-[#0050cb] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Nyomvonal rajzolása</span>
            </button>
            <button
              onClick={() => setActiveTool('add-split')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === 'add-split'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>+ Pont / Résztáv beszúrás</span>
            </button>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSetGpsAsStartOrNext}
              title="Aktuális GPS helyzet beállítása kezdőpontként vagy következő pontként"
              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#0050cb] font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>{points.length === 0 ? '📍 GPS Kezdőpont' : '+ GPS Pont'}</span>
            </button>

            <button
              onClick={handleUndo}
              disabled={points.length === 0}
              title="Utolsó pont visszavonása"
              className="p-2 bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              <Undo2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={points.length === 0}
              title="Összes pont törlése"
              className="p-2 bg-white hover:bg-red-50 disabled:opacity-40 border border-slate-200 text-red-600 font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={handleFitBounds}
              disabled={points.length === 0}
              title="Útvonal teljes képernyőre igazítása"
              className="p-2 bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              <Navigation className="w-4 h-4 text-[#0050cb]" />
            </button>
          </div>
        </div>

        {/* Map Container Area */}
        <div className="flex-1 relative bg-slate-100 w-full min-h-[280px]">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Interactive Tool Banner Guide */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 max-w-[90%] pointer-events-none">
            <div className={`backdrop-blur-md text-white text-[11px] sm:text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-lg border flex items-center gap-2 ${
              activeTool === 'add-track'
                ? 'bg-slate-900/85 border-blue-400/40'
                : 'bg-purple-950/90 border-purple-400/50'
            }`}>
              <span className={`w-2 h-2 rounded-full animate-ping flex-shrink-0 ${
                activeTool === 'add-track' ? 'bg-blue-400' : 'bg-purple-400'
              }`} />
              <span className="truncate">
                {activeTool === 'add-track'
                  ? points.length === 0
                    ? '1. Lépés: Bökj a térképre a Kezdőpont (Rajt) letételéhez!'
                    : 'Nyomvonal rajzolása: Bökj a térképre az útvonal folytatásához!'
                  : 'Pont beszúrás: Bökj a nyomvonal közelébe — a pont a legközelebbi nyomvonal-szakaszra illeszkedik!'}
              </span>
            </div>
          </div>

          {/* Floating Map Layers Selector Button */}
          <div className="absolute top-3 right-3 z-10">
            <div className="relative">
              <button
                onClick={() => setShowLayerMenu(!showLayerMenu)}
                className="bg-white/95 backdrop-blur-md hover:bg-white text-slate-700 p-2.5 rounded-2xl shadow-lg border border-slate-200/80 transition-all cursor-pointer"
                title="Térképréteg választó"
              >
                <Layers className="w-4 h-4 text-[#0050cb]" />
              </button>

              {showLayerMenu && (
                <div className="absolute right-0 top-12 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 w-44 space-y-1 text-xs font-semibold z-20">
                  <div className="text-[10px] text-slate-400 font-bold uppercase px-2 py-1">Térképréteg</div>
                  {[
                    { id: 'osm', label: 'OpenStreetMap' },
                    { id: 'voyager', label: 'Carto Voyager' },
                    { id: 'positron', label: 'Carto Positron' },
                    { id: 'cyclosm', label: 'CyclOSM (Terep)' },
                    { id: 'satellite', label: 'Műholdkép (Esri)' },
                  ].map((l) => (
                    <button
                      key={l.id}
                      onClick={() => {
                        setMapLayer(l.id as MapLayerType);
                        setShowLayerMenu(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl flex items-center justify-between ${
                        mapLayer === l.id ? 'bg-blue-50 text-[#0050cb] font-bold' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span>{l.label}</span>
                      {mapLayer === l.id && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Toast Notification Banner */}
          {toastMessage && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 text-white font-bold text-xs px-4 py-2 rounded-2xl shadow-2xl border border-white/20 animate-in fade-in slide-in-from-bottom-2">
              {toastMessage}
            </div>
          )}
        </div>

        {/* Bottom Config & Points Panel */}
        <div className="bg-white border-t border-slate-200 flex flex-col z-20 flex-shrink-0">
          {/* Summary bar & toggle points drawer */}
          <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Távolság</span>
                <span className="font-black text-slate-900 text-sm font-heading">
                  {formattedDistance.value} {formattedDistance.unitLabel}
                </span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Becsült Idő</span>
                <span className="font-black text-slate-900 text-sm font-heading">
                  {formatElapsedTime(estimatedTotalDurationSec)}
                </span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div className="hidden sm:block">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Sebesség</span>
                <span className="font-black text-slate-900 text-sm font-heading">
                  {targetSpeedKmh} km/h
                </span>
              </div>
            </div>

            {/* Points list expand toggle */}
            <button
              onClick={() => setShowPointsList(!showPointsList)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700 shadow-2xs transition-all cursor-pointer"
            >
              <Tag className="w-3.5 h-3.5 text-purple-700" />
              <span>Pontok ({points.length})</span>
              {showPointsList ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Speed & Activity Mode Selector Bar */}
          <div className="px-4 py-2 bg-white flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar border-b border-slate-100 text-xs">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[11px] font-bold text-slate-500">Sebesség:</span>
              <div className="flex items-center gap-1">
                {SPEED_PRESETS.map((sp) => {
                  const Icon = sp.icon;
                  const isSelected = targetSpeedKmh === sp.speedKmh;
                  return (
                    <button
                      key={sp.label}
                      onClick={() => {
                        setTargetSpeedKmh(sp.speedKmh);
                        setActivityMode(sp.mode);
                      }}
                      className={`px-2 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 border border-[#0050cb] text-[#0050cb] shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{sp.speedKmh} km/h</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Collapsible Points List Section */}
          {showPointsList && (
            <div className="p-3 bg-slate-50 max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar border-b border-slate-200">
              {points.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-xs">
                  Még nincsenek pontok. Kattints a térképre vagy használd a GPS Kezdőpont gombot!
                </div>
              ) : (
                points.map((pt, idx) => {
                  const isStart = idx === 0;
                  const isEnd = idx === points.length - 1 && points.length > 1;
                  const isCheckpoint = pt.isSplit;

                  return (
                    <div
                      key={pt.id}
                      className={`p-2 rounded-xl bg-white border shadow-2xs flex items-center justify-between gap-2 text-xs transition-all ${
                        isCheckpoint ? 'border-purple-200 bg-purple-50/20' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded-md font-black text-[10px] flex-shrink-0 ${
                            isStart
                              ? 'bg-emerald-600 text-white'
                              : isEnd
                              ? 'bg-rose-600 text-white'
                              : isCheckpoint
                              ? 'bg-purple-700 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {isStart ? 'START' : isEnd ? 'CÉL' : isCheckpoint ? `RÉSZTÁV` : `#${idx + 1}`}
                        </span>

                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 truncate">
                            {pt.name || (isStart ? 'START - Rajt' : isEnd ? 'CÉL - Végpont' : `Nyomvonal pont #${idx + 1}`)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Össz: {pt.cumulativeDistKm} km ({pt.distanceFromPrevKm > 0 ? `+${(pt.distanceFromPrevKm * 1000).toFixed(0)}m` : '0m'})
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleToggleSplitStatus(pt.id)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                            pt.isSplit
                              ? 'bg-purple-100 text-purple-700 border border-purple-300'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          title={pt.isSplit ? 'Résztáv eltávolítása' : 'Átalakítás résztávvá'}
                        >
                          {pt.isSplit ? '✓ Split' : '+ Split'}
                        </button>
                        <button
                          onClick={() => openEditPoint(pt)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                          title="Szerkesztés"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSpecificPoint(pt.id)}
                          className="p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Törlés"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Action Footer Buttons */}
          <div className="p-3 bg-white flex flex-col sm:flex-row items-center gap-2 justify-end">
            <button
              onClick={handleSaveToHistory}
              disabled={points.length < 2}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Save className="w-4 h-4 text-[#0050cb]" />
              <span>Mentés az Előzményekbe</span>
            </button>

            <button
              onClick={handleSaveAndStartTracking}
              disabled={points.length < 2}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0050cb] to-[#0066ff] hover:from-blue-700 hover:to-blue-600 disabled:opacity-40 text-white font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <Navigation className="w-4 h-4" />
              <span>Mentés & Követés / Navigáció Indítása</span>
            </button>
          </div>
        </div>

        {/* Clear All Confirmation Modal */}
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-2xl border border-slate-200 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-base">Útvonal törlése?</h4>
                <p className="text-xs text-slate-500 mt-1">Biztosan törölni szeretnéd az eddig megrajzolt teljes útvonalat és az összes pontot?</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Mégse
                </button>
                <button
                  type="button"
                  onClick={executeClearAll}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 font-black text-xs text-white shadow-sm transition-all cursor-pointer"
                >
                  Igen, törlés
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Single Point Modal / Popup */}
        {editingPointId && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-1.5 font-black text-slate-800 text-sm">
                  <Tag className="w-4 h-4 text-[#0050cb]" />
                  <span>Pont Szerkesztése</span>
                </div>
                <button
                  onClick={() => setEditingPointId(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Pont Elnevezése</label>
                <input
                  type="text"
                  value={editingPointName}
                  onChange={(e) => setEditingPointName(e.target.value)}
                  placeholder="pl. START, Kanyar, Fotópont, CÉL..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0050cb]/40 focus:bg-white"
                />
              </div>

              {/* Quick Rally Preset Chips */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Gyors Sablonok</label>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-100 custom-scrollbar">
                  {presets.map((preset) => {
                    const icon = getPresetIcon(preset);
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setEditingPointName(preset)}
                        className="px-2 py-1 bg-white hover:bg-blue-50 hover:text-[#0050cb] border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-700 shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                      >
                        <span>{icon}</span>
                        <span>{preset}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Megjegyzés / Rally Itiner Adat</label>
                <textarea
                  value={editingPointNotes}
                  onChange={(e) => setEditingPointNotes(e.target.value)}
                  placeholder="pl. Jobb 3 szűkül, 50m lassító, kavicsos szakasz..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0050cb]/40 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPointId(null)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-bold"
                >
                  Mégse
                </button>
                <button
                  type="button"
                  onClick={handleSavePointEdit}
                  className="px-4 py-1.5 rounded-xl bg-[#0050cb] text-white font-bold shadow-sm"
                >
                  Alkalmaz
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
