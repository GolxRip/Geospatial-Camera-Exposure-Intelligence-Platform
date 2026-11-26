'use client';

import * as React from 'react';
import { Minus, Plus } from '@phosphor-icons/react/dist/ssr';
import type { Map as MlMap, GeoJSONSource, MapMouseEvent, StyleSpecification } from 'maplibre-gl';
import { EmptyState } from '@/components/ui/empty-state';
import type { MapDevice } from '@/lib/data/types';
import { buildMapStyle } from '@/styles/map-style';
import { cn } from '@/lib/utils';

import 'maplibre-gl/dist/maplibre-gl.css';

export interface DeviceMapProps {
  devices: MapDevice[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Optional MapLibre style URL (e.g. self-hosted vector tiles). Omit to use PMTiles if built or the self-hosted boundary fallback. */
  styleUrl?: string;
  /** Initial / target camera center [lon, lat]. */
  center?: [number, number];
  /** Initial / target zoom level. */
  zoom?: number;
  /** Shown over the map when there are no devices, for example the offline state. */
  emptyState?: React.ReactNode;
  label?: string;
  className?: string;
}

const INK_0 = '#0a0c0b';
const INK_1 = '#101311';
const INK_2 = '#171b19';
const BONE = '#e7eae3';
const BONE_2 = '#a4aaa1';
const SIGNAL = '#f3a33a';
const INK_3 = '#202522';

/** Self-hosted Natural Earth GeoJSON fallback style (zero external requests). */
function boundaryFallbackStyle(origin: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      countries: {
        type: 'geojson',
        data: `${origin}/map/south-asia-countries.geojson`,
      },
      states: {
        type: 'geojson',
        data: `${origin}/map/india-states.geojson`,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': INK_0 } },
      { id: 'land', type: 'fill', source: 'countries', paint: { 'fill-color': INK_1 } },
      {
        id: 'states',
        type: 'line',
        source: 'states',
        paint: { 'line-color': INK_2, 'line-width': 1 },
      },
      {
        id: 'borders',
        type: 'line',
        source: 'countries',
        paint: { 'line-color': 'rgba(231,234,227,0.22)', 'line-width': 1 },
      },
    ],
  };
}

async function resolveMapStyle(styleUrl?: string): Promise<{
  style: StyleSpecification | string;
  usesPmtiles: boolean;
}> {
  if (styleUrl) return { style: styleUrl, usesPmtiles: false };
  const origin = window.location.origin;
  try {
    const res = await fetch('/tiles/basemap.json', { cache: 'no-store' });
    if (res.ok) {
      const meta = (await res.json()) as { available?: boolean };
      if (meta.available === true) {
        const head = await fetch('/tiles/india.pmtiles', { method: 'HEAD' });
        if (head.ok) {
          return {
            style: buildMapStyle({ origin, basemapUrl: '/tiles/india.pmtiles' }),
            usesPmtiles: true,
          };
        }
      }
    }
  } catch {
    // Fall back to self-hosted boundary GeoJSON below
  }
  return { style: boundaryFallbackStyle(origin), usesPmtiles: false };
}

/** Draw a marker or a cluster count to an ImageData: shapes follow TierShape (circle, ring, diamond, diamond with a ring). */
function drawIcon(
  name: string,
  ratio: number,
): { width: number; height: number; data: Uint8ClampedArray } | null {
  const draw = (size: number, fn: (c: CanvasRenderingContext2D, s: number) => void) => {
    const px = Math.round(size * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const c = canvas.getContext('2d');
    if (!c) return null;
    c.scale(ratio, ratio);
    fn(c, size);
    const img = c.getImageData(0, 0, px, px);
    return { width: px, height: px, data: img.data };
  };
  const diamond = (c: CanvasRenderingContext2D, m: number, r: number) => {
    c.beginPath();
    c.moveTo(m, m - r);
    c.lineTo(m + r, m);
    c.lineTo(m, m + r);
    c.lineTo(m - r, m);
    c.closePath();
  };
  if (name.startsWith('cluster-')) {
    const n = name.slice(8);
    const size = n.length >= 3 ? 46 : n.length === 2 ? 38 : 32;
    return draw(size, (c, s) => {
      c.beginPath();
      c.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
      c.fillStyle = INK_3;
      c.fill();
      c.strokeStyle = BONE_2;
      c.lineWidth = 1;
      c.stroke();
      c.fillStyle = BONE;
      c.font = '500 12px ui-monospace, Menlo, monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(n, s / 2, s / 2 + 0.5);
    });
  }
  return draw(20, (c, s) => {
    const m = s / 2;
    if (name === 'tier-high') {
      c.beginPath();
      c.arc(m, m, 5, 0, Math.PI * 2);
      c.fillStyle = BONE_2;
      c.globalAlpha = 0.7;
      c.fill();
    } else if (name === 'tier-medium') {
      c.beginPath();
      c.arc(m, m, 5.5, 0, Math.PI * 2);
      c.strokeStyle = SIGNAL;
      c.globalAlpha = 0.65;
      c.lineWidth = 2;
      c.stroke();
    } else if (name === 'tier-low' || name === 'tier-gate') {
      diamond(c, m, 6);
      c.fillStyle = SIGNAL;
      c.fill();
      if (name === 'tier-gate') {
        c.beginPath();
        c.arc(m, m, 8.5, 0, Math.PI * 2);
        c.strokeStyle = SIGNAL;
        c.lineWidth = 1.2;
        c.stroke();
      }
    } else {
      c.beginPath();
      c.moveTo(m - 5, m);
      c.lineTo(m + 5, m);
      c.strokeStyle = BONE_2;
      c.lineWidth = 2;
      c.stroke();
    }
  });
}

function toGeoJson(devices: MapDevice[], selectedId?: string | null): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: devices.map((d) => ({
      type: 'Feature',
      id: undefined,
      geometry: { type: 'Point', coordinates: [d.lon, d.lat] },
      properties: {
        id: d.id,
        icon: d.gateTripped ? 'tier-gate' : d.tier ? `tier-${d.tier}` : 'tier-none',
        selected: d.id === selectedId,
      },
    })),
  };
}

/**
 * The device map (FRONTEND_SPEC.md section 10.2): MapLibre GL JS with a clustered GeoJSON source, self-hosted
 * India/South Asia boundary GeoJSON fallback (or PMTiles when built), and visible OpenStreetMap attribution.
 */
export function DeviceMap({
  devices,
  selectedId,
  onSelect,
  styleUrl,
  center = [79, 22],
  zoom = 3.8,
  emptyState,
  label = 'Map of device positions',
  className,
}: DeviceMapProps) {
  const host = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<MlMap | null>(null);
  const [ready, setReady] = React.useState(false);
  const [hasPmtiles, setHasPmtiles] = React.useState(false);
  const onSelectRef = React.useRef(onSelect);
  const latest = React.useRef({ devices, selectedId, center, zoom });
  React.useEffect(() => {
    onSelectRef.current = onSelect;
    latest.current = { devices, selectedId, center, zoom };
  });

  React.useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    (async () => {
      const ml = await import('maplibre-gl');
      const { style, usesPmtiles } = await resolveMapStyle(styleUrl);
      if (cancelled || !host.current) return;
      if (usesPmtiles) {
        const { registerPmtiles } = await import('@/lib/map/pmtiles');
        registerPmtiles(ml);
      }
      setHasPmtiles(usesPmtiles);
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      map = new ml.Map({
        container: host.current,
        style,
        center: latest.current.center,
        zoom: latest.current.zoom,
        minZoom: 2,
        maxZoom: 16,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        fadeDuration: reduce ? 0 : 150,
      });
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();

      map.on('styleimagemissing', (e) => {
        const ratio = 2;
        const img = drawIcon(e.id, ratio);
        if (img && !map!.hasImage(e.id)) map!.addImage(e.id, img, { pixelRatio: ratio });
      });

      map.on('load', () => {
        if (!map) return;
        map.addSource('devices', {
          type: 'geojson',
          data: toGeoJson(latest.current.devices, latest.current.selectedId),
          cluster: true,
          clusterRadius: 48,
          clusterMaxZoom: 10,
        });
        map.addLayer({
          id: 'clusters',
          type: 'symbol',
          source: 'devices',
          filter: ['has', 'point_count'],
          layout: {
            'icon-image': ['concat', 'cluster-', ['to-string', ['get', 'point_count']]],
            'icon-allow-overlap': true,
          },
        });
        map.addLayer({
          id: 'selected-ring',
          type: 'circle',
          source: 'devices',
          filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'selected'], true]],
          paint: {
            'circle-radius': 13,
            'circle-color': INK_0,
            'circle-opacity': 0,
            'circle-stroke-color': BONE,
            'circle-stroke-width': 2,
          },
        });
        map.addLayer({
          id: 'devices',
          type: 'symbol',
          source: 'devices',
          filter: ['!', ['has', 'point_count']],
          layout: { 'icon-image': ['get', 'icon'], 'icon-allow-overlap': true },
        });
        map.on('click', 'clusters', async (e: MapMouseEvent) => {
          const f = map!.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0];
          const clusterId = f?.properties?.cluster_id as number | undefined;
          if (clusterId === undefined) return;
          const src = map!.getSource('devices') as GeoJSONSource;
          const targetZoom = await src.getClusterExpansionZoom(clusterId);
          const coords = (f!.geometry as GeoJSON.Point).coordinates as [number, number];
          map!.easeTo({ center: coords, zoom: targetZoom, duration: reduce ? 0 : 400 });
        });
        map.on('click', 'devices', (e: MapMouseEvent) => {
          const id = map!.queryRenderedFeatures(e.point, { layers: ['devices'] })[0]?.properties
            ?.id as string | undefined;
          if (id) onSelectRef.current?.(id);
        });
        for (const l of ['clusters', 'devices']) {
          map.on('mouseenter', l, () => (map!.getCanvas().style.cursor = 'pointer'));
          map.on('mouseleave', l, () => (map!.getCanvas().style.cursor = ''));
        }
        setReady(true);
      });
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [styleUrl]);

  React.useEffect(() => {
    const src = mapRef.current?.getSource('devices') as GeoJSONSource | undefined;
    if (ready && src) src.setData(toGeoJson(devices, selectedId));
  }, [devices, selectedId, ready]);

  React.useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    m.easeTo({ center, zoom, duration: reduce ? 0 : 500 });
  }, [center, zoom, ready]);

  const zoomStep = (dir: 1 | -1) => {
    const m = mapRef.current;
    if (!m) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    m.easeTo({ zoom: m.getZoom() + dir, duration: reduce ? 0 : 250 });
  };

  return (
    <div className={cn('relative size-full min-h-64 overflow-hidden bg-ink-0', className)}>
      <div
        ref={host}
        role="region"
        aria-label={label}
        tabIndex={0}
        style={{ position: 'absolute', inset: 0 }}
      />
      <div className="absolute right-3 top-3 flex flex-col gap-2">
        {(
          [
            ['Zoom in', Plus, 1],
            ['Zoom out', Minus, -1],
          ] as const
        ).map(([name, Icon, dir]) => (
          <button
            key={name}
            type="button"
            aria-label={name}
            onClick={() => zoomStep(dir)}
            className="inline-flex size-11 items-center justify-center rounded-control border border-line-strong bg-ink-2 text-bone transition-surface hover:bg-ink-3"
          >
            <Icon aria-hidden size={16} />
          </button>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2">
        <p className="rounded-chip bg-ink-1 px-2 py-1 text-xs text-bone-2">Positions are estimates</p>
        <p className="rounded-chip border border-line bg-ink-1 px-2 py-1 text-xs text-bone-2">
          {hasPmtiles
            ? 'Basemap © OpenStreetMap contributors, Protomaps'
            : 'Map data © OpenStreetMap contributors · Natural Earth boundaries'}
        </p>
      </div>
      {devices.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="pointer-events-auto">
            {emptyState ?? (
              <EmptyState title="No devices to show">
                Devices appear here once data is connected.
              </EmptyState>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
