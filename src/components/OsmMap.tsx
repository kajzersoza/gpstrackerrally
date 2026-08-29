import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import L from 'leaflet';
import { Crosshair, Layers, Plus, Minus, Check } from 'lucide-react';
import { Coordinate, Split } from '../types';

export type MapLayerType = 'osm' | 'voyager' | 'positron' | 'cyclosm' | 'satellite';

export interface OsmMapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  recenter: () => void;
  getMap: () => L.Map | null;
}

export interface OsmMapProps {
  coordinates: Coordinate[];
  currentLocation: Coordinate | null;
  splits?: Split[];
  referenceCoordinates?: Coordinate[];
  referenceSplits?: Split[];
  referenceTitle?: string;
  mapLayer?: MapLayerType;
  isTracking?: boolean;
  className?: string;
  interactive?: boolean;
  onRecenter?: () => void;
  showLayerSelector?: boolean;
  showZoomControls?: boolean;
  zoomControlsPosition?: 'top-left' | 'top-right' | 'bottom-right' | 'right' | 'hidden';
  onLayerChange?: (layer: MapLayerType) => void;
  focusedSplitId?: string | null;
  onSelectSplit?: (split: Split) => void;
}

export const OsmMap = forwardRef<OsmMapHandle, OsmMapProps>(({
  coordinates,
  currentLocation,
  splits = [],
  referenceCoordinates = [],
  referenceSplits = [],
  referenceTitle = '',
  mapLayer = 'osm',
  isTracking = false,
  className = '',
  interactive = true,
  onRecenter,
  showLayerSelector = true,
  showZoomControls = true,
  zoomControlsPosition = 'top-left',
  onLayerChange,
  focusedSplitId = null,
  onSelectSplit,
}, ref) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const polylineCasingRef = useRef<L.Polyline | null>(null);
  const referencePolylineRef = useRef<L.Polyline | null>(null);
  const referencePolylineCasingRef = useRef<L.Polyline | null>(null);
  const currentMarkerRef = useRef<L.Marker | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const stopMarkerRef = useRef<L.Marker | null>(null);
  const splitMarkersGroupRef = useRef<L.LayerGroup | null>(null);
  const referenceMarkersGroupRef = useRef<L.LayerGroup | null>(null);
  const splitMarkersMapRef = useRef<Map<string, L.Marker>>(new Map());
  const hasInitialCenteredRef = useRef<boolean>(false);
  const [showLayersMenu, setShowLayersMenu] = useState(false);
  const [internalLayer, setInternalLayer] = useState<MapLayerType>(mapLayer);

  // Sync internal layer with prop if prop changes
  useEffect(() => {
    setInternalLayer(mapLayer);
  }, [mapLayer]);

  // Map Tile URL providers
  const getTileConfig = (layer: string) => {
    switch (layer) {
      case 'voyager':
        return {
          url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
          attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 19,
        };
      case 'positron':
        return {
          url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
          attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 19,
        };
      case 'cyclosm':
        return {
          url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
          maxZoom: 18,
        };
      case 'satellite':
        return {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution: '&copy; Esri',
          maxZoom: 18,
        };
      case 'osm':
      default:
        return {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        };
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const defaultCenter: [number, number] = currentLocation
      ? [currentLocation.lat, currentLocation.lng]
      : coordinates.length > 0
      ? [coordinates[coordinates.length - 1].lat, coordinates[coordinates.length - 1].lng]
      : referenceCoordinates.length > 0
      ? [referenceCoordinates[0].lat, referenceCoordinates[0].lng]
      : [37.7775, -122.4164]; // San Francisco default

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 14,
      zoomControl: false,
      attributionControl: true,
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: false,
    });

    const tileConfig = getTileConfig(internalLayer);
    const tileLayer = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Reference / Loaded Track Polylines (purple dashed guide line)
    const refPolyCasing = L.polyline([], {
      color: '#ffffff',
      weight: 6,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
    referencePolylineCasingRef.current = refPolyCasing;

    const refPoly = L.polyline([], {
      color: '#7c3aed',
      weight: 4,
      opacity: 0.9,
      dashArray: '8, 6',
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
    referencePolylineRef.current = refPoly;

    // Active Live Polyline casing (shadow/border for high contrast on all map layers)
    const polylineCasing = L.polyline([], {
      color: '#ffffff',
      weight: 7,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
    polylineCasingRef.current = polylineCasing;

    // Main vibrant path polyline
    const polyline = L.polyline([], {
      color: '#0060e6',
      weight: 4.5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
    polylineRef.current = polyline;

    mapRef.current = map;

    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Tile Layer when layer changes
  useEffect(() => {
    if (!mapRef.current) return;
    const tileConfig = getTileConfig(internalLayer);

    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    const newTileLayer = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
    }).addTo(mapRef.current);

    tileLayerRef.current = newTileLayer;
  }, [internalLayer]);

  // Update Reference / Loaded Track Layer & Markers
  useEffect(() => {
    if (!mapRef.current) return;

    const refLatLngs: [number, number][] = referenceCoordinates.map((c) => [c.lat, c.lng]);

    if (referencePolylineCasingRef.current) {
      referencePolylineCasingRef.current.setLatLngs(refLatLngs);
    }
    if (referencePolylineRef.current) {
      referencePolylineRef.current.setLatLngs(refLatLngs);
    }

    if (!referenceMarkersGroupRef.current) {
      referenceMarkersGroupRef.current = L.layerGroup().addTo(mapRef.current);
    }
    referenceMarkersGroupRef.current.clearLayers();

    if (refLatLngs.length > 0) {
      const startSplit = referenceSplits?.find((s) => s.id.startsWith('start') || s.splitIndex === 0);
      const stopSplit = referenceSplits?.find(
        (s) => s.id.startsWith('stop') || s.formattedIndex === 'CÉL' || s.splitIndex === (referenceSplits?.length || 0)
      );

      // 1. Reference Start Marker
      const refStartPos = refLatLngs[0];
      const startHasPhotos = startSplit?.photos && startSplit.photos.length > 0;
      const startHasNotes = !!startSplit?.notes;
      const refStartIcon = L.divIcon({
        className: 'custom-ref-start-badge',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; width: 88px; cursor: pointer; user-select: none;">
            <div style="display: inline-flex; align-items: center; gap: 3px; background: #6d28d9; color: #ffffff; font-family: ui-sans-serif, system-ui, sans-serif; font-weight: 800; font-size: 10.5px; line-height: 1; padding: 3px 6px; border-radius: 6px; border: 1.5px solid #ffffff; box-shadow: 0 4px 10px rgba(109, 40, 217, 0.45); white-space: nowrap; z-index: 2;">
              <span>🎯</span>
              <span>Ref-START</span>
              ${startHasPhotos ? '<span style="font-size: 9px;">📷</span>' : ''}
              ${startHasNotes && !startHasPhotos ? '<span style="font-size: 9px;">💬</span>' : ''}
            </div>
            <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid #6d28d9; margin-top: -1px; z-index: 1;"></div>
          </div>
        `,
        iconSize: [88, 28],
        iconAnchor: [44, 28],
        popupAnchor: [0, -28],
      });

      let startPhotoHtml = '';
      if (startSplit?.photos && startSplit.photos.length > 0) {
        startPhotoHtml = `
          <div style="display: flex; gap: 4px; margin-top: 6px; overflow-x: auto; padding-bottom: 2px;">
            ${startSplit.photos.slice(0, 3).map((p) => `<img src="${p}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1;" />`).join('')}
            ${startSplit.photos.length > 3 ? `<div style="width: 44px; height: 44px; border-radius: 6px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; color: #475569;">+${startSplit.photos.length - 3}</div>` : ''}
          </div>
        `;
      }

      let startNotesHtml = '';
      if (startSplit?.notes) {
        startNotesHtml = `
          <div style="color: #475569; font-size: 11px; margin-top: 4px; font-style: italic; background: #f5f3ff; padding: 3px 6px; border-radius: 4px; border-left: 2px solid #6d28d9;">
            ${startSplit.notes}
          </div>
        `;
      }

      const startM = L.marker(refStartPos, { icon: refStartIcon, zIndexOffset: 450 }).bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; line-height: 1.45; padding: 2px 4px; max-width: 200px;">
          <div style="font-weight: 800; color: #6d28d9; font-size: 13px; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">
            <span>🎯</span>
            <span>${startSplit?.name || 'Betöltött Útvonal START'}</span>
          </div>
          <div style="color: #334155;"><b>Kezdés:</b> ${startSplit?.formattedTime || '00:00'}</div>
          ${startNotesHtml}
          ${startPhotoHtml}
        </div>
      `);

      if (onSelectSplit) {
        startM.on('click', () => {
          onSelectSplit(
            startSplit || {
              id: 'start-ref',
              splitIndex: 0,
              formattedIndex: 'START',
              name: '🚩 Ref-START (Kezdőpont)',
              distanceKm: 0,
              formattedDistance: '0.00 km',
              timeSec: 0,
              formattedTime: '00:00',
              paceSecPerKm: 0,
              totalDistanceKm: 0,
              totalTimeSec: 0,
              timestamp: Date.now(),
              coordinate: referenceCoordinates[0],
              notes: 'Betöltött útvonal kezdőpontja',
            }
          );
        });
      }

      referenceMarkersGroupRef.current.addLayer(startM);
      splitMarkersMapRef.current.set('start-ref', startM);
      splitMarkersMapRef.current.set('ref-start', startM);
      splitMarkersMapRef.current.set('start', startM);
      if (startSplit?.id) {
        splitMarkersMapRef.current.set(startSplit.id, startM);
      }

      // 2. Reference Finish Marker
      if (refLatLngs.length > 1) {
        const refEndPos = refLatLngs[refLatLngs.length - 1];
        const stopHasPhotos = stopSplit?.photos && stopSplit.photos.length > 0;
        const stopHasNotes = !!stopSplit?.notes;
        const refEndIcon = L.divIcon({
          className: 'custom-ref-end-badge',
          html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; width: 84px; cursor: pointer; user-select: none;">
              <div style="display: inline-flex; align-items: center; gap: 3px; background: #be185d; color: #ffffff; font-family: ui-sans-serif, system-ui, sans-serif; font-weight: 800; font-size: 10.5px; line-height: 1; padding: 3px 6px; border-radius: 6px; border: 1.5px solid #ffffff; box-shadow: 0 4px 10px rgba(190, 24, 93, 0.45); white-space: nowrap; z-index: 2;">
                <span>🏁</span>
                <span>Ref-CÉL</span>
                ${stopHasPhotos ? '<span style="font-size: 9px;">📷</span>' : ''}
                ${stopHasNotes && !stopHasPhotos ? '<span style="font-size: 9px;">💬</span>' : ''}
              </div>
              <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid #be185d; margin-top: -1px; z-index: 1;"></div>
            </div>
          `,
          iconSize: [84, 28],
          iconAnchor: [42, 28],
          popupAnchor: [0, -28],
        });

        let stopPhotoHtml = '';
        if (stopSplit?.photos && stopSplit.photos.length > 0) {
          stopPhotoHtml = `
            <div style="display: flex; gap: 4px; margin-top: 6px; overflow-x: auto; padding-bottom: 2px;">
              ${stopSplit.photos.slice(0, 3).map((p) => `<img src="${p}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1;" />`).join('')}
              ${stopSplit.photos.length > 3 ? `<div style="width: 44px; height: 44px; border-radius: 6px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; color: #475569;">+${stopSplit.photos.length - 3}</div>` : ''}
            </div>
          `;
        }

        let stopNotesHtml = '';
        if (stopSplit?.notes) {
          stopNotesHtml = `
            <div style="color: #475569; font-size: 11px; margin-top: 4px; font-style: italic; background: #fdf2f8; padding: 3px 6px; border-radius: 4px; border-left: 2px solid #be185d;">
              ${stopSplit.notes}
            </div>
          `;
        }

        const endM = L.marker(refEndPos, { icon: refEndIcon, zIndexOffset: 450 }).bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; line-height: 1.45; padding: 2px 4px; max-width: 200px;">
            <div style="font-weight: 800; color: #be185d; font-size: 13px; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">
              <span>🏁</span>
              <span>${stopSplit?.name || 'Betöltött Útvonal CÉL'}</span>
            </div>
            <div style="color: #334155;"><b>Össztáv:</b> ${stopSplit?.formattedDistance || `${(referenceCoordinates.length > 0 ? 0 : 0)} km`}</div>
            ${stopNotesHtml}
            ${stopPhotoHtml}
          </div>
        `);

        if (onSelectSplit) {
          endM.on('click', () => {
            onSelectSplit(
              stopSplit || {
                id: 'stop-ref',
                splitIndex: 999,
                formattedIndex: 'CÉL',
                name: '🏁 Ref-CÉL (Végpont)',
                distanceKm: 0,
                formattedDistance: '0.00 km',
                timeSec: 0,
                formattedTime: '00:00',
                paceSecPerKm: 0,
                totalDistanceKm: 0,
                totalTimeSec: 0,
                timestamp: Date.now(),
                coordinate: referenceCoordinates[referenceCoordinates.length - 1],
                notes: 'Betöltött útvonal célvonala',
              }
            );
          });
        }

        referenceMarkersGroupRef.current.addLayer(endM);
        splitMarkersMapRef.current.set('stop-ref', endM);
        splitMarkersMapRef.current.set('ref-stop', endM);
        splitMarkersMapRef.current.set('ref-end', endM);
        splitMarkersMapRef.current.set('stop', endM);
        if (stopSplit?.id) {
          splitMarkersMapRef.current.set(stopSplit.id, endM);
        }
      }

      // 3. Reference Intermediate Splits / Waypoints Markers (excluding duplicate Start and Stop badges)
      if (referenceSplits && referenceSplits.length > 0) {
        referenceSplits.forEach((split, idx) => {
          if (
            split.id.startsWith('start') ||
            split.id.startsWith('stop') ||
            split.formattedIndex === 'START' ||
            split.formattedIndex === 'CÉL' ||
            split.splitIndex === 0
          ) {
            return;
          }

          let sLoc = split.coordinate;
          if (!sLoc && referenceCoordinates.length > 0) {
            const fraction = (idx + 1) / Math.max(1, referenceSplits.length);
            const cIdx = Math.min(referenceCoordinates.length - 1, Math.floor(fraction * (referenceCoordinates.length - 1)));
            sLoc = referenceCoordinates[cIdx];
          }
          if (sLoc) {
            const hasPhotos = split.photos && split.photos.length > 0;
            const hasNotes = !!split.notes;
            const badgeLabel = split.name
              ? (split.name.length > 10 ? split.name.slice(0, 9) + '…' : split.name)
              : `🎯 ${split.formattedIndex || split.splitIndex}`;
            const badgeWidth = split.name ? Math.min(115, 60 + split.name.length * 6) : 74;

            const sIcon = L.divIcon({
              className: 'custom-ref-split-badge',
              html: `
                <div style="position: relative; display: flex; flex-direction: column; align-items: center; width: ${badgeWidth}px; cursor: pointer; user-select: none;">
                  <div style="display: inline-flex; align-items: center; gap: 3px; background: #5b21b6; color: #ffffff; font-family: ui-sans-serif, system-ui, sans-serif; font-weight: 800; font-size: 10px; line-height: 1; padding: 3px 5px; border-radius: 5px; border: 1.5px solid #ffffff; box-shadow: 0 3px 8px rgba(91, 33, 182, 0.4); white-space: nowrap; z-index: 2; max-width: ${badgeWidth}px; overflow: hidden; text-overflow: ellipsis;">
                    <span>🎯</span>
                    <span>${badgeLabel}</span>
                    ${hasPhotos ? '<span style="font-size: 9px;">📷</span>' : ''}
                    ${hasNotes && !hasPhotos ? '<span style="font-size: 9px;">💬</span>' : ''}
                  </div>
                  <div style="width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #5b21b6; margin-top: -1px; z-index: 1;"></div>
                </div>
              `,
              iconSize: [badgeWidth, 26],
              iconAnchor: [badgeWidth / 2, 26],
              popupAnchor: [0, -26],
            });

            let refPhotoHtml = '';
            if (split.photos && split.photos.length > 0) {
              refPhotoHtml = `
                <div style="display: flex; gap: 4px; margin-top: 6px; overflow-x: auto; padding-bottom: 2px;">
                  ${split.photos.slice(0, 3).map((p) => `<img src="${p}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1;" />`).join('')}
                  ${split.photos.length > 3 ? `<div style="width: 44px; height: 44px; border-radius: 6px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; color: #475569;">+${split.photos.length - 3}</div>` : ''}
                </div>
              `;
            }

            let refNotesHtml = '';
            if (split.notes) {
              refNotesHtml = `
                <div style="color: #475569; font-size: 11px; margin-top: 4px; font-style: italic; background: #f5f3ff; padding: 3px 6px; border-radius: 4px; border-left: 2px solid #5b21b6;">
                  ${split.notes}
                </div>
              `;
            }

            const sMarker = L.marker([sLoc.lat, sLoc.lng], { icon: sIcon, zIndexOffset: 460 }).bindPopup(`
              <div style="font-family: sans-serif; font-size: 12px; line-height: 1.45; padding: 2px 4px; max-width: 200px;">
                <div style="font-weight: 800; color: #5b21b6; font-size: 13px; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">
                  <span>🎯</span>
                  <span>${split.name || `Betöltött Pont #${split.formattedIndex || split.splitIndex}`}</span>
                </div>
                <div style="color: #334155;"><b>Táv:</b> ${split.formattedDistance || split.distanceKm + ' km'}</div>
                ${split.formattedTime ? `<div style="color: #334155;"><b>Idő:</b> ${split.formattedTime}</div>` : ''}
                ${refNotesHtml}
                ${refPhotoHtml}
              </div>
            `);

            if (onSelectSplit) {
              sMarker.on('click', () => {
                onSelectSplit(split);
              });
            }

            referenceMarkersGroupRef.current?.addLayer(sMarker);
            if (split.id) {
              splitMarkersMapRef.current.set(split.id, sMarker);
            }
          }
        });
      }

      // If not tracking, fit map bounds to reference track or full session track
      if (!isTracking && mapRef.current) {
        const allPoints: [number, number][] = [
          ...refLatLngs,
          ...coordinates.map((c) => [c.lat, c.lng] as [number, number]),
        ];
        if (allPoints.length > 0) {
          try {
            const bounds = L.latLngBounds(allPoints);
            if (bounds.isValid()) {
              mapRef.current.fitBounds(bounds, { padding: [35, 35], maxZoom: 16 });
            }
          } catch {
            // Ignore fitBounds error
          }
        }
      }
    }
  }, [referenceCoordinates, referenceSplits, coordinates, isTracking, onSelectSplit]);

  // Update Polyline and Markers
  useEffect(() => {
    if (!mapRef.current) return;

    const latLngs: [number, number][] = coordinates.map((c) => [c.lat, c.lng]);

    // Update casing and main polyline
    if (polylineCasingRef.current) {
      polylineCasingRef.current.setLatLngs(latLngs);
    }
    if (polylineRef.current) {
      polylineRef.current.setLatLngs(latLngs);
    }

    // Start marker (Flag badge with sharp pointer tip)
    if (latLngs.length > 0) {
      const startLatLng = latLngs[0];
      const startIcon = L.divIcon({
        className: 'custom-start-badge',
        html: `
          <div style="
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 66px;
            cursor: pointer;
            user-select: none;
          ">
            <div style="
              display: inline-flex;
              align-items: center;
              gap: 4px;
              background: #059669;
              color: #ffffff;
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-weight: 800;
              font-size: 11px;
              line-height: 1;
              padding: 4px 7px 4px 6px;
              border-radius: 6px;
              border: 1.5px solid #ffffff;
              box-shadow: 0 4px 10px rgba(5, 150, 105, 0.45);
              white-space: nowrap;
              z-index: 2;
            ">
              <span style="font-size: 10px;">🚩</span>
              <span>START</span>
            </div>
            <!-- Sharp needle tip pointing directly at coordinate -->
            <div style="
              width: 0;
              height: 0;
              border-left: 5px solid transparent;
              border-right: 5px solid transparent;
              border-top: 7px solid #059669;
              margin-top: -1px;
              z-index: 1;
              filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));
            "></div>
          </div>
        `,
        iconSize: [66, 30],
        iconAnchor: [33, 30],
        popupAnchor: [0, -30],
      });

      if (!startMarkerRef.current) {
        startMarkerRef.current = L.marker(startLatLng, {
          icon: startIcon,
          zIndexOffset: 600,
        }).addTo(mapRef.current);
        startMarkerRef.current.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; font-weight: bold; color: #059669; padding: 2px;">
            🚩 START Pont (Indulás)
          </div>
        `);
      } else {
        startMarkerRef.current.setLatLng(startLatLng);
        startMarkerRef.current.setIcon(startIcon);
      }

      if (onSelectSplit && startMarkerRef.current) {
        startMarkerRef.current.off('click');
        startMarkerRef.current.on('click', () => {
          const startSplit = splits?.find((s) => s.id.startsWith('start') || s.splitIndex === 0) || {
            id: 'start-point',
            splitIndex: 0,
            formattedIndex: 'START',
            name: '🚩 START Pont (Indulás)',
            distanceKm: 0,
            formattedDistance: '0.00 km',
            timeSec: 0,
            formattedTime: '00:00',
            paceSecPerKm: 0,
            totalDistanceKm: 0,
            totalTimeSec: 0,
            timestamp: coordinates[0]?.timestamp || Date.now(),
            coordinate: coordinates[0],
            notes: 'Automatikusan rögzített kezdőpont',
          };
          onSelectSplit(startSplit);
        });
      }

      splitMarkersMapRef.current.set('start', startMarkerRef.current);
      splitMarkersMapRef.current.set('start-point', startMarkerRef.current);
    } else if (startMarkerRef.current) {
      mapRef.current.removeLayer(startMarkerRef.current);
      startMarkerRef.current = null;
    }

    // Stop marker (Flag badge with sharp pointer tip at the end of track when not actively recording or session is stopped)
    if (latLngs.length > 1 && !isTracking) {
      const stopLatLng = latLngs[latLngs.length - 1];
      const stopIcon = L.divIcon({
        className: 'custom-stop-badge',
        html: `
          <div style="
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 62px;
            cursor: pointer;
            user-select: none;
          ">
            <div style="
              display: inline-flex;
              align-items: center;
              gap: 4px;
              background: #e11d48;
              color: #ffffff;
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-weight: 800;
              font-size: 11px;
              line-height: 1;
              padding: 4px 7px 4px 6px;
              border-radius: 6px;
              border: 1.5px solid #ffffff;
              box-shadow: 0 4px 10px rgba(225, 29, 72, 0.45);
              white-space: nowrap;
              z-index: 2;
            ">
              <span style="font-size: 10px;">🏁</span>
              <span>STOP</span>
            </div>
            <!-- Sharp needle tip pointing directly at coordinate -->
            <div style="
              width: 0;
              height: 0;
              border-left: 5px solid transparent;
              border-right: 5px solid transparent;
              border-top: 7px solid #e11d48;
              margin-top: -1px;
              z-index: 1;
              filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));
            "></div>
          </div>
        `,
        iconSize: [62, 30],
        iconAnchor: [31, 30],
        popupAnchor: [0, -30],
      });

      if (!stopMarkerRef.current) {
        stopMarkerRef.current = L.marker(stopLatLng, {
          icon: stopIcon,
          zIndexOffset: 600,
        }).addTo(mapRef.current);
        stopMarkerRef.current.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; font-weight: bold; color: #e11d48; padding: 2px;">
            🏁 STOP Pont (Cél)
          </div>
        `);
      } else {
        stopMarkerRef.current.setLatLng(stopLatLng);
        stopMarkerRef.current.setIcon(stopIcon);
      }

      if (onSelectSplit && stopMarkerRef.current) {
        stopMarkerRef.current.off('click');
        stopMarkerRef.current.on('click', () => {
          const stopSplit = splits?.find(
            (s) => s.id.startsWith('stop') || s.formattedIndex === 'CÉL' || s.splitIndex === (splits?.length || 0)
          ) || {
            id: 'stop-point',
            splitIndex: 999,
            formattedIndex: 'STOP',
            name: '🏁 STOP Pont (Cél)',
            distanceKm: 0,
            formattedDistance: '0.00 km',
            timeSec: 0,
            formattedTime: '00:00',
            paceSecPerKm: 0,
            totalDistanceKm: 0,
            totalTimeSec: 0,
            timestamp: coordinates[coordinates.length - 1]?.timestamp || Date.now(),
            coordinate: coordinates[coordinates.length - 1],
            notes: 'Automatikusan rögzített célvonal',
          };
          onSelectSplit(stopSplit);
        });
      }

      splitMarkersMapRef.current.set('stop', stopMarkerRef.current);
      splitMarkersMapRef.current.set('stop-point', stopMarkerRef.current);
    } else if (stopMarkerRef.current) {
      mapRef.current.removeLayer(stopMarkerRef.current);
      stopMarkerRef.current = null;
    }

    // Current location marker with pulsing effect and sharp crosshair center
    const activeLoc = currentLocation || (coordinates.length > 0 ? coordinates[coordinates.length - 1] : null);

    if (activeLoc) {
      const activeLatLng: [number, number] = [activeLoc.lat, activeLoc.lng];

      const customIcon = L.divIcon({
        className: 'custom-gps-icon',
        html: `
          <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 28px; height: 28px; border-radius: 9999px; background: rgba(0, 96, 230, 0.28);" class="gps-pulse-marker"></div>
            <div style="width: 14px; height: 14px; border-radius: 9999px; background: #0060e6; border: 2.5px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.4); z-index: 2;"></div>
            <div style="position: absolute; width: 2px; height: 2px; border-radius: 9999px; background: #ffffff; z-index: 3;"></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
      });

      if (!currentMarkerRef.current) {
        currentMarkerRef.current = L.marker(activeLatLng, { icon: customIcon }).addTo(mapRef.current);
      } else {
        currentMarkerRef.current.setLatLng(activeLatLng);
        currentMarkerRef.current.setIcon(customIcon);
      }

      // If active tracking, smoothly center map on current position so the growing line is followed
      if (isTracking && mapRef.current) {
        mapRef.current.panTo(activeLatLng, { animate: true, duration: 0.4 });
      } else if (mapRef.current && !hasInitialCenteredRef.current && currentLocation) {
        // Automatically jump to current GPS position on startup
        mapRef.current.setView(activeLatLng, 15, { animate: true });
        hasInitialCenteredRef.current = true;
      }
    }

    // Render Split (Résztáv) markers on the map with sharp pointy needle tip
    if (!splitMarkersGroupRef.current && mapRef.current) {
      splitMarkersGroupRef.current = L.layerGroup().addTo(mapRef.current);
    }

    if (splitMarkersGroupRef.current) {
      splitMarkersGroupRef.current.clearLayers();
      splitMarkersMapRef.current.clear();

      if (splits && splits.length > 0) {
        splits.forEach((split) => {
          let splitLoc = split.coordinate;

          // If no direct coordinate, find closest coordinate from coordinates array or position along path
          if (!splitLoc && coordinates.length > 0) {
            splitLoc = coordinates.find((c) => Math.abs(c.timestamp - split.timestamp) < 5000);
            if (!splitLoc && split.splitIndex) {
              const fraction = Math.min(1, split.splitIndex / Math.max(1, splits.length));
              const idx = Math.min(coordinates.length - 1, Math.floor(fraction * (coordinates.length - 1)));
              splitLoc = coordinates[idx];
            }
          }

          if (splitLoc) {
            const hasPhotos = split.photos && split.photos.length > 0;
            const hasNotes = !!split.notes;
            const splitBadgeWidth = split.name ? Math.min(110, 56 + split.name.length * 6) : 54;
            const splitBadgeHeight = 30;
            const displayName = split.name
              ? (split.name.length > 10 ? split.name.slice(0, 9) + '…' : split.name)
              : `#${split.formattedIndex || split.splitIndex}`;

            const splitIcon = L.divIcon({
              className: 'custom-split-badge',
              html: `
                <div style="
                  position: relative;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  width: ${splitBadgeWidth}px;
                  cursor: pointer;
                  user-select: none;
                ">
                  <div style="
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                    background: #0050cb;
                    color: #ffffff;
                    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-weight: 800;
                    font-size: 11px;
                    line-height: 1;
                    padding: 4px 6px 4px 5px;
                    border-radius: 6px;
                    border: 1.5px solid #ffffff;
                    box-shadow: 0 4px 10px rgba(0, 80, 203, 0.45);
                    white-space: nowrap;
                    z-index: 2;
                    max-width: ${splitBadgeWidth}px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                  ">
                    <span style="font-size: 10px;">🚩</span>
                    <span>${displayName}</span>
                    ${hasPhotos ? '<span style="font-size: 9px;">📷</span>' : ''}
                    ${hasNotes && !hasPhotos ? '<span style="font-size: 9px;">💬</span>' : ''}
                  </div>
                  <!-- Sharp needle tip pointing directly at coordinate -->
                  <div style="
                    width: 0;
                    height: 0;
                    border-left: 5px solid transparent;
                    border-right: 5px solid transparent;
                    border-top: 7px solid #0050cb;
                    margin-top: -1px;
                    z-index: 1;
                    filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));
                  "></div>
                </div>
              `,
              iconSize: [splitBadgeWidth, splitBadgeHeight],
              iconAnchor: [splitBadgeWidth / 2, splitBadgeHeight],
              popupAnchor: [0, -splitBadgeHeight],
            });

            const splitMarker = L.marker([splitLoc.lat, splitLoc.lng], {
              icon: splitIcon,
              zIndexOffset: 500,
            });

            // Build photo preview HTML if available
            let photoHtml = '';
            if (split.photos && split.photos.length > 0) {
              photoHtml = `
                <div style="display: flex; gap: 4px; margin-top: 6px; overflow-x: auto; padding-bottom: 2px;">
                  ${split.photos.slice(0, 3).map((p) => `<img src="${p}" style="width: 42px; height: 42px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1;" />`).join('')}
                  ${split.photos.length > 3 ? `<div style="width: 42px; height: 42px; border-radius: 6px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; color: #475569;">+${split.photos.length - 3}</div>` : ''}
                </div>
              `;
            }

            let notesHtml = '';
            if (split.notes) {
              notesHtml = `
                <div style="color: #475569; font-size: 11px; margin-top: 4px; font-style: italic; background: #f1f5f9; padding: 3px 6px; border-radius: 4px; border-left: 2px solid #0050cb;">
                  ${split.notes.length > 70 ? split.notes.slice(0, 68) + '…' : split.notes}
                </div>
              `;
            }

            splitMarker.bindPopup(`
              <div style="font-family: sans-serif; font-size: 12px; line-height: 1.45; padding: 2px 4px; max-width: 200px;">
                <div style="font-weight: 800; color: #0050cb; font-size: 13px; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">
                  <span>🚩</span>
                  <span>${split.name || `Résztáv #${split.formattedIndex || split.splitIndex}`}</span>
                </div>
                <div style="color: #334155;"><b>Távolság:</b> ${split.formattedDistance || split.distanceKm + ' km'}</div>
                <div style="color: #334155;"><b>Részidő:</b> ${split.formattedTime}</div>
                ${split.totalDistanceKm ? `<div style="color: #64748b; font-size: 11px; margin-top: 2px;">Össz. táv: ${split.totalDistanceKm.toFixed(2)} km</div>` : ''}
                ${notesHtml}
                ${photoHtml}
              </div>
            `);

            if (onSelectSplit) {
              splitMarker.on('click', () => {
                onSelectSplit(split);
              });
            }

            splitMarkersGroupRef.current?.addLayer(splitMarker);
            splitMarkersMapRef.current.set(split.id, splitMarker);
          }
        });
      }
    }
  }, [coordinates, currentLocation, isTracking, splits, onSelectSplit]);

  // Handle zooming to focused split marker safely
  useEffect(() => {
    if (!mapRef.current || !focusedSplitId) return;

    try {
      const container = mapContainerRef.current;
      // Do nothing if container is hidden or not mounted (e.g. display: none in responsive breakpoints)
      if (!container || container.offsetWidth <= 0 || container.offsetHeight <= 0) {
        return;
      }

      // Invalidate size to ensure Leaflet has up-to-date container bounds
      mapRef.current.invalidateSize({ animate: false });

      const mapSize = mapRef.current.getSize();
      if (!mapSize || mapSize.x <= 0 || mapSize.y <= 0) {
        return;
      }

      let targetLatLng: [number, number] | null = null;
      let targetMarker: L.Marker | null = null;

      const marker = splitMarkersMapRef.current.get(focusedSplitId);
      if (marker && typeof marker.getLatLng === 'function') {
        const ll = marker.getLatLng();
        if (ll && typeof ll.lat === 'number' && typeof ll.lng === 'number' && !isNaN(ll.lat) && !isNaN(ll.lng)) {
          targetLatLng = [ll.lat, ll.lng];
          targetMarker = marker;
        }
      }

      if (!targetLatLng) {
        // Fallback: look up coordinate in active splits or reference splits
        const targetSplit =
          (splits || []).find((s) => s.id === focusedSplitId) ||
          (referenceSplits || []).find((s) => s.id === focusedSplitId);

        if (
          targetSplit?.coordinate &&
          typeof targetSplit.coordinate.lat === 'number' &&
          typeof targetSplit.coordinate.lng === 'number' &&
          !isNaN(targetSplit.coordinate.lat) &&
          !isNaN(targetSplit.coordinate.lng)
        ) {
          targetLatLng = [targetSplit.coordinate.lat, targetSplit.coordinate.lng];
        } else if (focusedSplitId.startsWith('start') || focusedSplitId === 'ref-start' || focusedSplitId === 'start-ref') {
          if (coordinates.length > 0) {
            targetLatLng = [coordinates[0].lat, coordinates[0].lng];
          } else if (referenceCoordinates.length > 0) {
            targetLatLng = [referenceCoordinates[0].lat, referenceCoordinates[0].lng];
          }
          targetMarker = startMarkerRef.current || splitMarkersMapRef.current.get('start-ref') || splitMarkersMapRef.current.get('start') || null;
        } else if (
          focusedSplitId.startsWith('stop') ||
          focusedSplitId.startsWith('end') ||
          focusedSplitId === 'ref-stop' ||
          focusedSplitId === 'ref-end' ||
          focusedSplitId === 'stop-ref'
        ) {
          if (coordinates.length > 0) {
            targetLatLng = [coordinates[coordinates.length - 1].lat, coordinates[coordinates.length - 1].lng];
          } else if (referenceCoordinates.length > 0) {
            targetLatLng = [referenceCoordinates[referenceCoordinates.length - 1].lat, referenceCoordinates[referenceCoordinates.length - 1].lng];
          }
          targetMarker = stopMarkerRef.current || splitMarkersMapRef.current.get('stop-ref') || splitMarkersMapRef.current.get('stop') || null;
        }
      }

      if (targetLatLng && mapRef.current) {
        try {
          mapRef.current.flyTo(targetLatLng, 17, { animate: true, duration: 0.6 });
        } catch {
          // If flyTo fails for any animation math reason, setView directly
          mapRef.current.setView(targetLatLng, 17);
        }

        if (targetMarker) {
          const m = targetMarker;
          setTimeout(() => {
            try {
              if (m && mapRef.current && mapRef.current.hasLayer(m)) {
                m.openPopup();
              }
            } catch (popupErr) {
              console.warn('Marker popup open error caught safely:', popupErr);
            }
          }, 350);
        }
      }
    } catch (err) {
      console.warn('Map zoom to split error caught safely:', err);
    }
  }, [focusedSplitId, splits, referenceSplits]);

  const handleRecenterClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!mapRef.current) return;

    const targetPos = currentLocation
      ? [currentLocation.lat, currentLocation.lng]
      : coordinates.length > 0
      ? [coordinates[coordinates.length - 1].lat, coordinates[coordinates.length - 1].lng]
      : [37.7775, -122.4164];

    mapRef.current.setView(targetPos as [number, number], 15, { animate: true });

    if (onRecenter) {
      onRecenter();
    }
  };

  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      if (mapRef.current) {
        mapRef.current.zoomIn();
      }
    },
    zoomOut: () => {
      if (mapRef.current) {
        mapRef.current.zoomOut();
      }
    },
    recenter: () => {
      if (!mapRef.current) return;
      const targetPos = currentLocation
        ? [currentLocation.lat, currentLocation.lng]
        : coordinates.length > 0
        ? [coordinates[coordinates.length - 1].lat, coordinates[coordinates.length - 1].lng]
        : [37.7775, -122.4164];
      mapRef.current.setView(targetPos as [number, number], 15, { animate: true });
    },
    getMap: () => mapRef.current,
  }), [currentLocation, coordinates]);

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mapRef.current) {
      mapRef.current.zoomIn();
    }
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mapRef.current) {
      mapRef.current.zoomOut();
    }
  };

  const handleSelectLayer = (layerKey: MapLayerType) => {
    setInternalLayer(layerKey);
    setShowLayersMenu(false);
    if (onLayerChange) {
      onLayerChange(layerKey);
    }
  };

  const layersList: { key: MapLayerType; name: string; desc: string }[] = [
    { key: 'osm', name: 'OpenStreetMap', desc: 'Alapértelmezett' },
    { key: 'voyager', name: 'Carto Voyager', desc: 'Színes & Részletes' },
    { key: 'positron', name: 'Positron Light', desc: 'Letisztult világos' },
    { key: 'cyclosm', name: 'CyclOSM', desc: 'Kerékpár & Terep' },
    { key: 'satellite', name: 'Esri Műhold', desc: 'Műholdkép' },
  ];

  const zoomPosClass =
    zoomControlsPosition === 'top-right'
      ? 'top-12 right-2.5'
      : zoomControlsPosition === 'bottom-right'
      ? 'bottom-12 right-2.5'
      : zoomControlsPosition === 'right'
      ? 'top-1/2 -translate-y-1/2 right-2.5'
      : 'top-2.5 left-2.5';

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* Leaflet Map Div */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Layer selector button & menu (Top Right) */}
      {showLayerSelector && (
        <div className="absolute top-2.5 right-2.5 z-20">
          <button
            id="btn-map-layer-selector"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowLayersMenu(!showLayersMenu);
            }}
            className="w-8 h-8 bg-white/95 hover:bg-white text-slate-700 hover:text-[#0050cb] rounded-xl shadow-md flex items-center justify-center border border-slate-200/80 active:scale-95 transition-all cursor-pointer"
            title="Térképréteg váltása"
          >
            <Layers className="w-4 h-4" />
          </button>

          {showLayersMenu && (
            <>
              {/* Invisible backdrop to dismiss when clicking elsewhere */}
              <div
                className="fixed inset-0 z-20 cursor-default"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLayersMenu(false);
                }}
              />
              <div
                className="absolute right-0 top-10 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-1.5 px-1.5 w-[175px] max-h-[125px] sm:max-h-[150px] overflow-y-auto overscroll-contain flex flex-col gap-1 text-xs z-30 animate-in fade-in zoom-in-95 duration-100 custom-scrollbar"
                onClick={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-0.5 z-10">
                  Térképréteg
                </div>
                {layersList.map((item) => {
                  const isActive = internalLayer === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleSelectLayer(item.key)}
                      className={`flex items-center justify-between w-full text-left px-2 py-1.5 rounded-xl transition-colors cursor-pointer shrink-0 ${
                        isActive
                          ? 'bg-[#eaf2ff] text-[#0050cb] font-bold'
                          : 'hover:bg-slate-50 text-slate-700 font-medium'
                      }`}
                    >
                      <div className="min-w-0 pr-1">
                        <div className="leading-tight truncate text-[11.5px]">{item.name}</div>
                        <div className="text-[9.5px] text-slate-400 font-normal truncate">{item.desc}</div>
                      </div>
                      {isActive && <Check className="w-3.5 h-3.5 text-[#0050cb] stroke-[2.5] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Zoom Controls */}
      {showZoomControls && zoomControlsPosition !== 'hidden' && (
        <div className={`absolute z-10 flex flex-col bg-white/95 rounded-xl shadow-md border border-slate-200/80 overflow-hidden ${zoomPosClass}`}>
          <button
            id="btn-map-zoom-in"
            type="button"
            onClick={handleZoomIn}
            title="Nagyítás (+)"
            className="w-8 h-8 flex items-center justify-center text-slate-700 hover:text-[#0050cb] hover:bg-slate-50 active:bg-slate-100 transition-colors border-b border-slate-100 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
          <button
            id="btn-map-zoom-out"
            type="button"
            onClick={handleZoomOut}
            title="Kicsinyítés (-)"
            className="w-8 h-8 flex items-center justify-center text-slate-700 hover:text-[#0050cb] hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
          >
            <Minus className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      )}

      {/* Crosshair / Recenter Button (Bottom Right) */}
      <button
        id="btn-recenter-map"
        type="button"
        onClick={handleRecenterClick}
        title="Centrálás jelenlegi helyre"
        className="absolute bottom-2.5 right-2.5 z-10 w-8 h-8 bg-white/95 hover:bg-white text-slate-700 hover:text-[#0050cb] rounded-xl shadow-md flex items-center justify-center border border-slate-200/80 active:scale-90 transition-transform cursor-pointer"
      >
        <Crosshair className="w-4 h-4 text-slate-700 hover:text-[#0050cb]" />
      </button>
    </div>
  );
});

OsmMap.displayName = 'OsmMap';

