import { useEffect, useState, useCallback } from "react";
import type { MovementPoint, EventOut } from "../lib/types";
import { X, Maximize2, Minimize2 } from "lucide-react";
import {
  Map,
  MapControls,
  MapMarker,
  MapRoute,
  MapArc,
  type MapArcDatum,
} from "@/components/ui/map";

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const INITIAL_CENTER: [number, number] = [79.7400, 15.9000];
const INITIAL_ZOOM = 7.2;

// Light tile style (CARTO Positron — clean white/light to blend with UI)
const LIGHT_MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const SATELLITE_MAP_STYLE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

// Suspect palette (hex for mapcn)
const SUSPECT_HEX_COLORS: Record<string, string> = {
  "Suspect A": "#3b82f6",   // blue
  "Suspect B": "#8b5cf6",   // violet
  "Suspect C": "#10b981",   // emerald
  "Suspect D": "#f59e0b",   // amber
  "Suspect E": "#6b7280",   // gray
  "Active Suspect": "#3b82f6",
};

const SUSPECT_HOME_TOWERS: Record<string, [number, number]> = {
  "Suspect A": [80.0499, 15.5057],
  "Suspect B": [80.0499, 15.5057],
  "Suspect C": [78.4983, 17.4399],
  "Suspect D": [79.9865, 14.4426],
  "Suspect E": [80.4365, 16.3067],
};

const ALL_TOWERS = [
  { id: "TWR-ONG-001", name: "Ongole Central",          lat: 15.5057, lon: 80.0499, district: "Prakasham" },
  { id: "TWR-ONG-002", name: "Ongole East",             lat: 15.5120, lon: 80.0620, district: "Prakasham" },
  { id: "TWR-MRT-001", name: "Markapur",                lat: 15.7333, lon: 79.2667, district: "Prakasham" },
  { id: "TWR-CDD-001", name: "Chirala",                 lat: 15.8167, lon: 80.3500, district: "Prakasham" },
  { id: "TWR-KAN-001", name: "Kandukur",                lat: 15.2167, lon: 79.9000, district: "Prakasham" },
  { id: "TWR-GNT-001", name: "Guntur Junction",         lat: 16.3067, lon: 80.4365, district: "Guntur" },
  { id: "TWR-VJA-001", name: "Vijayawada Central",      lat: 16.5062, lon: 80.6480, district: "Krishna" },
  { id: "TWR-NLR-001", name: "Nellore Town",            lat: 14.4426, lon: 79.9865, district: "Nellore" },
  { id: "TWR-HYD-001", name: "Hyderabad Secunderabad",  lat: 17.4399, lon: 78.4983, district: "Hyderabad" },
  { id: "TWR-HYD-002", name: "LB Nagar",               lat: 17.3453, lon: 78.5479, district: "Hyderabad" },
];

// ── OSRM Road Routing ──────────────────────────────────────────────────────────
async function fetchOsrmRoute(
  points: [number, number][]
): Promise<[number, number][]> {
  if (points.length < 2) return points;
  try {
    const coordStr = points.map(([lon, lat]) => `${lon},${lat}`).join(";");
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`
    );
    if (!res.ok) throw new Error("OSRM error");
    const data = await res.json();
    if (data.routes && data.routes[0]) {
      return data.routes[0].geometry.coordinates as [number, number][];
    }
  } catch {
    // fallback to straight lines
  }
  return points;
}

// ── PROPS ─────────────────────────────────────────────────────────────────────
interface Props {
  movements: MovementPoint[];
  events?: EventOut[];
  suspectLabel?: string;
  cctvDetections?: any[];
}

// ── COMPONENT ──────────────────────────────────────────────────────────────────
export default function MovementMap({
  movements,
  events = [],
  suspectLabel,
  cctvDetections = [],
}: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapStyleMode, setMapStyleMode] = useState<"vector" | "satellite">("vector");
  const [selectedTower, setSelectedTower] = useState<any>(null);
  const [selectedCctv, setSelectedCctv] = useState<any>(null);

  // Road-following route coordinates per suspect
  const [suspectRoutes, setSuspectRoutes] = useState<
    Record<string, [number, number][]>
  >({});

  // ── Esc key to exit fullscreen ────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    if (isFullscreen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // ── Group movements by suspect ────────────────────────────────────────────
  const getDayNumber = (tsStr: string) => {
    const ts = new Date(tsStr);
    const start = new Date("2024-01-01T00:00:00");
    const diffDays = Math.floor((ts.getTime() - start.getTime()) / 86400000) + 1;
    return Math.min(30, Math.max(1, diffDays));
  };

  const suspectGroups: Record<string, any[]> = {};
  movements.forEach((m) => {
    const label = (m as any).suspect_label || suspectLabel || "Active Suspect";
    if (!suspectGroups[label]) suspectGroups[label] = [];
    suspectGroups[label].push({
      lat: m.lat,
      lon: m.lon,
      timestamp: new Date(m.timestamp).getTime(),
      day: getDayNumber(m.timestamp),
      co_location: m.co_location,
      co_location_with: m.co_location_with,
      tower_id: m.tower_id,
    });
  });

  const suspectsList = Object.keys(suspectGroups);

  // ── Build tower visit data ────────────────────────────────────────────────
  const towers = ALL_TOWERS.map((t) => {
    const towerMovements = movements.filter((m) => m.tower_id === t.id);
    const hasColocation = towerMovements.some((m) => m.co_location);

    const visits: any[] = [];
    towerMovements.forEach((m) => {
      const day = getDayNumber(m.timestamp);
      const time = new Date(m.timestamp).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const suspLabel = (m as any).suspect_label || suspectLabel || "Active Suspect";
      const exists = visits.some(
        (v) => v.suspect === suspLabel && v.day === day && v.time === time
      );
      if (!exists) {
        visits.push({
          suspect: suspLabel,
          day,
          time,
          coLocationWith: m.co_location_with || [],
        });
      }
      if (m.co_location_with) {
        m.co_location_with.forEach((other) => {
          const otherExists = visits.some(
            (v) => v.suspect === other && v.day === day && v.time === time
          );
          if (!otherExists)
            visits.push({ suspect: other, day, time, coLocationWith: [] });
        });
      }
    });

    return {
      ...t,
      hasColocation,
      visits: visits.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time)),
    };
  });

  // ── IMEI swap events ──────────────────────────────────────────────────────
  const imeiSwaps = events
    .filter((ev) => ev.event_type === "IMEI_SWAP" && ev.occurred_at)
    .map((ev) => {
      const ts = new Date(ev.occurred_at!).getTime();
      let closestPt: any = null;
      let minDiff = Infinity;
      movements.forEach((m) => {
        const diff = Math.abs(new Date(m.timestamp).getTime() - ts);
        if (diff < minDiff) { minDiff = diff; closestPt = m; }
      });
      const tower = closestPt ? ALL_TOWERS.find((t) => t.id === closestPt.tower_id) : null;
      return { ...ev, tower };
    })
    .filter((s): s is typeof s & { tower: any } => s.tower !== null);

  // ── Co-location arcs for MapArc ───────────────────────────────────────────
  const coLocationArcs: MapArcDatum[] = [];
  movements.forEach((m) => {
    if (m.co_location && m.co_location_with && m.co_location_with.length > 0) {
      m.co_location_with.forEach((other) => {
        const homeCoords = SUSPECT_HOME_TOWERS[other];
        if (homeCoords) {
          coLocationArcs.push({
            id: `coloc-${other}-${m.timestamp}-${m.lon}-${m.lat}`,
            from: homeCoords,
            to: [m.lon, m.lat],
          });
        }
      });
    }
  });

  // ── Last positions ────────────────────────────────────────────────────────
  const currentPositions: Record<string, { lat: number; lon: number }> = {};
  Object.entries(suspectGroups).forEach(([label, pts]) => {
    const sorted = [...pts].sort((a, b) => a.timestamp - b.timestamp);
    if (sorted.length > 0) {
      const last = sorted[sorted.length - 1];
      currentPositions[label] = { lat: last.lat, lon: last.lon };
    }
  });

  // ── Fetch OSRM road routes ────────────────────────────────────────────────
  const fetchRoutes = useCallback(async () => {
    const routeResults: Record<string, [number, number][]> = {};
    await Promise.all(
      Object.entries(suspectGroups).map(async ([label, pts]) => {
        const sorted = [...pts].sort((a, b) => a.timestamp - b.timestamp);
        if (sorted.length < 2) {
          routeResults[label] = sorted.map((p) => [p.lon, p.lat]);
          return;
        }
        // Deduplicate consecutive identical positions
        const unique: [number, number][] = [];
        sorted.forEach((p) => {
          const coords: [number, number] = [p.lon, p.lat];
          if (
            unique.length === 0 ||
            unique[unique.length - 1][0] !== coords[0] ||
            unique[unique.length - 1][1] !== coords[1]
          ) {
            unique.push(coords);
          }
        });
        // OSRM max 100 waypoints — sample if needed
        const sampled =
          unique.length > 25
            ? unique.filter((_, i) => i % Math.ceil(unique.length / 25) === 0)
            : unique;
        routeResults[label] = await fetchOsrmRoute(sampled);
      })
    );
    setSuspectRoutes(routeResults);
  }, [movements]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (movements.length > 0) fetchRoutes();
  }, [movements, fetchRoutes]);

  // ── Satellite style object ────────────────────────────────────────────────
  const satelliteStyle = {
    version: 8 as const,
    sources: {
      "satellite-raster": {
        type: "raster" as const,
        tiles: [SATELLITE_MAP_STYLE],
        tileSize: 256,
        attribution: "Tiles © Esri",
      },
    },
    layers: [
      {
        id: "satellite-layer",
        type: "raster" as const,
        source: "satellite-raster",
        minzoom: 0,
        maxzoom: 20,
      },
    ],
  };

  const formatSimulatedVisit = (v: any) => {
    const match = v.time.match(/(\d+):(\d+)/);
    if (match) {
      const hh = parseInt(match[1]);
      const mm = parseInt(match[2]);
      const dur = 20 + (hh * mm) % 11;
      const pad = (n: number) => String(n).padStart(2, "0");
      let startH = hh, startM = mm - Math.floor(dur / 2);
      if (startM < 0) { startM += 60; startH -= 1; }
      let endH = hh, endM = mm + Math.ceil(dur / 2);
      if (endM >= 60) { endM -= 60; endH += 1; }
      return `Day ${v.day} ${pad(startH)}:${pad(startM)}–${pad(endH)}:${pad(endM)} (${dur} min)`;
    }
    return `Day ${v.day} ${v.time} (25 min)`;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={
        isFullscreen
          ? { position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 9999, backgroundColor: "#f8fafc", display: "flex", flexDirection: "column" }
          : { width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative" }
      }
      className="font-sans text-slate-700"
    >
      <div style={{ flex: 1, position: "relative" }}>
        <Map
          center={INITIAL_CENTER}
          zoom={INITIAL_ZOOM}
          theme="light"
          styles={
            mapStyleMode === "satellite"
              ? { light: satelliteStyle as any, dark: satelliteStyle as any }
              : { light: LIGHT_MAP_STYLE, dark: LIGHT_MAP_STYLE }
          }
          className="w-full h-full"
        >
          <MapControls showZoom showLocate={false} />

          {/* ── Per-suspect OSRM road-following routes ── */}
          {Object.entries(suspectRoutes).map(([label, coords]) => {
            const hexColor = SUSPECT_HEX_COLORS[label] || "#3b82f6";
            return coords.length >= 2 ? (
              <MapRoute
                key={`route-${label}`}
                id={`route-${label.replace(/\s+/g, "-")}`}
                coordinates={coords}
                color={hexColor}
                width={4}
                opacity={0.85}
              />
            ) : null;
          })}

          {/* ── Co-location arcs ── */}
          {coLocationArcs.length > 0 && (
            <MapArc
              id="colocation-arcs"
              data={coLocationArcs}
              curvature={0.5}
              paint={{
                "line-color": "#8b5cf6",
                "line-width": 2,
                "line-opacity": 0.7,
              }}
            />
          )}

          {/* ── Cell tower markers ── */}
          {towers.map((tower) => (
            <MapMarker
              key={tower.id}
              longitude={tower.lon}
              latitude={tower.lat}
              onClick={() => { setSelectedTower(tower); setSelectedCctv(null); }}
            >
              <div
                title={tower.name}
                style={{
                  width: tower.hasColocation ? 20 : 14,
                  height: tower.hasColocation ? 20 : 14,
                  borderRadius: "50%",
                  backgroundColor: tower.hasColocation ? "#ef4444" : "#ffffff",
                  border: tower.hasColocation ? "2.5px solid #b91c1c" : "2px solid #475569",
                  boxShadow: tower.hasColocation
                    ? "0 0 0 4px rgba(239,68,68,0.18)"
                    : "0 1px 4px rgba(0,0,0,0.18)",
                  cursor: "pointer",
                  transition: "transform 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.25)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              />
            </MapMarker>
          ))}

          {/* ── IMEI swap markers ── */}
          {imeiSwaps.map((swap, i) => (
            <MapMarker
              key={`imei-${i}`}
              longitude={swap.tower.lon}
              latitude={swap.tower.lat}
            >
              <div
                title={`IMEI Swap: ${(swap.detail as any)?.old_imei?.slice(-6)} → ${(swap.detail as any)?.new_imei?.slice(-6)}`}
                style={{
                  background: "#f59e0b",
                  border: "2px solid #fff",
                  borderRadius: "50%",
                  width: 16,
                  height: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 8,
                  fontWeight: 700,
                  color: "#fff",
                  cursor: "default",
                  boxShadow: "0 0 0 3px rgba(245,158,11,0.25)",
                }}
              >
                ⚠
              </div>
            </MapMarker>
          ))}

          {/* ── Suspect current-position markers ── */}
          {Object.entries(currentPositions).map(([label, pos]) => {
            const hex = SUSPECT_HEX_COLORS[label] || "#3b82f6";
            return (
              <MapMarker key={`susp-${label}`} longitude={pos.lon} latitude={pos.lat}>
                <div
                  title={label}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    backgroundColor: hex,
                    border: "2px solid white",
                    boxShadow: `0 0 0 4px ${hex}33`,
                    cursor: "default",
                  }}
                />
              </MapMarker>
            );
          })}

          {/* ── CCTV camera markers ── */}
          {cctvDetections.map((det) => (
            <MapMarker
              key={det.camera_id}
              longitude={det.camera_lon}
              latitude={det.camera_lat}
              onClick={() => { setSelectedCctv(det); setSelectedTower(null); }}
            >
              <div
                title={`📷 ${det.camera_name}`}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "4px",
                  backgroundColor: det.correlation_status === "CONFIRMED" ? "#16a34a" : "#f59e0b",
                  border: "2px solid #fff",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  cursor: "pointer",
                }}
              >
                📷
              </div>
            </MapMarker>
          ))}
        </Map>

        {/* ── Map Style + Fullscreen controls ── */}
        <div className="absolute top-3 right-3 z-10 flex gap-2 font-sans">
          <div className="bg-white border border-slate-200 rounded px-2.5 py-1 flex items-center gap-1.5 shadow-sm text-slate-700">
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">
              Map Style:
            </span>
            <select
              value={mapStyleMode}
              onChange={(e) => setMapStyleMode(e.target.value as "vector" | "satellite")}
              className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-slate-400 font-sans cursor-pointer font-medium text-slate-700"
            >
              <option value="vector">Streets / Map</option>
              <option value="satellite">Satellite Imagery</option>
            </select>
          </div>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 p-1.5 rounded shadow-sm flex items-center justify-center transition-colors cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen Map"}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>

        {/* ── Tower click detail panel ── */}
        {selectedTower && (
          <div className="absolute right-0 top-0 bottom-0 w-60 bg-white border-l border-slate-200 z-30 p-4 overflow-y-auto shadow-lg flex flex-col font-sans">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Cell Site Detail</span>
                <h3 className="text-sm font-bold text-slate-800 mt-0.5">{selectedTower.name}</h3>
                <p className="text-[10px] text-slate-500 font-mono">{selectedTower.id}</p>
              </div>
              <button
                onClick={() => setSelectedTower(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-50 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            <div className="text-[10px] text-slate-500 font-mono space-y-1 py-2 border-y border-slate-100">
              <div>Coords: {selectedTower.lat.toFixed(4)}°N · {selectedTower.lon.toFixed(4)}°E</div>
              <div>District: {selectedTower.district} District, AP</div>
            </div>
            {selectedTower.hasColocation && (
              <div className="mt-3 p-2 bg-red-50 border-l-2 border-red-500 text-[9px] text-red-700 font-semibold rounded-sm">
                ⚠ SUSPECTS CONVERGED IN 30-MIN WINDOW
              </div>
            )}
            <div className="mt-4 flex-1">
              <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Logged Visits</h4>
              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {selectedTower.visits.length > 0 ? (
                  selectedTower.visits.map((v: any, idx: number) => {
                    const hex = SUSPECT_HEX_COLORS[v.suspect] || "#3b82f6";
                    return (
                      <div key={idx} className="text-[10px] border-b border-slate-50 pb-1.5 last:border-0">
                        <div className="flex justify-between">
                          <span style={{ color: hex }} className="font-bold font-mono">{v.suspect}</span>
                          <span className="text-slate-400 text-[8px] font-mono">Day {v.day}</span>
                        </div>
                        <div className="text-slate-500 text-[9px] mt-0.5">{formatSimulatedVisit(v)}</div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-[10px] text-slate-400 font-mono italic">No visits registered.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── CCTV click detail panel ── */}
        {selectedCctv && (
          <div className="absolute right-0 top-0 bottom-0 w-60 bg-white border-l border-slate-200 z-30 p-4 overflow-y-auto shadow-lg flex flex-col font-sans">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">CCTV Camera Detail</span>
                <h3 className="text-sm font-bold text-slate-800 mt-0.5">📷 {selectedCctv.camera_name}</h3>
                <p className="text-[10px] text-zinc-500 font-mono">{selectedCctv.camera_id}</p>
              </div>
              <button
                onClick={() => setSelectedCctv(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-50 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            <div className="text-[10px] text-slate-500 font-mono space-y-1 py-2 border-y border-slate-100">
              <div>Coords: {selectedCctv.camera_lat.toFixed(4)}°N · {selectedCctv.camera_lon.toFixed(4)}°E</div>
              <div>Detection: {new Date(selectedCctv.detection_timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
            </div>
            <div className="mt-3 p-2 bg-emerald-50 border-l-2 border-emerald-500 text-[10px] text-emerald-800 font-semibold rounded-sm">
              Face match confidence: {Math.round(selectedCctv.confidence_score * 100)}%
            </div>
            <div className="mt-4 flex-1 space-y-3">
              <div>
                <h4 className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">CDR Match</h4>
                <p className="text-xs text-zinc-700 font-medium font-mono">{selectedCctv.matched_tower_id}</p>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold mt-1 uppercase ${selectedCctv.correlation_status === "CONFIRMED" ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                  {selectedCctv.correlation_status}
                </span>
              </div>
              <div>
                <h4 className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Correlation Detail</h4>
                <p className="text-xs text-zinc-600 leading-tight">{selectedCctv.notes}</p>
              </div>
              {selectedCctv.frame_image_path && (
                <div className="mt-3">
                  <a href={selectedCctv.frame_image_path} target="_blank" rel="noreferrer" className="text-indigo-600 font-bold hover:underline text-[10px] block">
                    View frame →
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Legend ── */}
        <div className="absolute bottom-3 right-3 z-10 bg-white/95 border border-slate-200 rounded p-2.5 shadow-sm text-[9px] font-sans max-w-[150px]">
          <h5 className="font-bold text-slate-700 uppercase tracking-wider mb-1.5 border-b border-slate-100 pb-1">Legend</h5>
          <div className="flex flex-col gap-1.5">
            {suspectsList.map((s) => {
              const hex = SUSPECT_HEX_COLORS[s] || "#3b82f6";
              return (
                <div key={s} className="flex items-center gap-2">
                  <div style={{ width: 14, height: 3, background: hex, borderRadius: 2 }} />
                  <span className="text-slate-600 font-mono">{s}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2.5 h-2.5 rounded-full bg-white border border-slate-500" />
              <span className="text-slate-600">Cell Site</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-red-700" />
              <span className="text-red-600 font-semibold">Co-location Site</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-amber-600" />
              <span className="text-amber-600 font-semibold">IMEI Swap Site</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600 font-semibold">📷 Green = CCTV Match</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div
        style={{ padding: "6px 14px 8px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", flexShrink: 0 }}
        className="flex justify-between items-center text-[10px] font-mono text-slate-500 z-10"
      >
        <div>Timeline Data: Fully Loaded (30 Days) · Road-Following Routes via OSRM</div>
        <div>NH-16 Corridor: Prakasham District AP</div>
      </div>
    </div>
  );
}
