import { useEffect, useState } from "react";
import type { MovementPoint, EventOut } from "../lib/types";
import { X, Maximize2, Minimize2 } from "lucide-react";
import Map, { NavigationControl } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { DeckGL } from "@deck.gl/react";
import { ScatterplotLayer, LineLayer, ArcLayer, TextLayer } from "@deck.gl/layers";
import "maplibre-gl/dist/maplibre-gl.css";

// ── STRICT GEOGRAPHIC BOUNDS ──────────────────────────────────────────────────
const INITIAL_VIEW = {
  longitude: 79.7400,   // Center of AP/Telangana corridor
  latitude: 15.9000,    // Center of AP/Telangana
  zoom: 7.2,            // Shows full AP + Telangana
  pitch: 0,
  bearing: 0
};

const MAX_BOUNDS: [[number, number], [number, number]] = [
  [76.7, 12.6], // SW Corner (AP/Telangana boundary)
  [84.8, 19.9]  // NE Corner (AP/Telangana boundary)
];

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

const SATELLITE_STYLE = {
  version: 8 as const,
  sources: {
    "satellite-raster": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      ],
      tileSize: 256,
      attribution: "Tiles &copy; Esri &mdash; Source: Esri, USDA, USGS, GeoEye, and the GIS User Community"
    }
  },
  layers: [
    {
      id: "satellite-layer",
      type: "raster" as const,
      source: "satellite-raster",
      minzoom: 0,
      maxzoom: 20
    }
  ]
};

// ── Suspect colors ────────────────────────────────────────────────────────────
const SUSPECT_COLORS: Record<string, [number, number, number, number]> = {
  "Suspect A": [59, 130, 246, 220],   // blue
  "Suspect B": [139, 92, 246, 220],   // violet
  "Suspect C": [16, 185, 129, 220],   // emerald
  "Suspect D": [245, 158, 11, 220],   // amber
  "Suspect E": [107, 114, 128, 180],  // gray
  "Active Suspect": [59, 130, 246, 220]
};

const SUSPECT_HOME_TOWERS: Record<string, [number, number]> = {
  "Suspect A": [80.0499, 15.5057], // TWR-ONG-001
  "Suspect B": [80.0499, 15.5057], // TWR-ONG-001
  "Suspect C": [78.4983, 17.4399], // TWR-HYD-001
  "Suspect D": [79.9865, 14.4426], // TWR-NLR-001
  "Suspect E": [80.4365, 16.3067], // TWR-GNT-001
};

const ALL_TOWERS = [
  {"id": "TWR-ONG-001", "name": "Ongole Central",     "lat": 15.5057, "lon": 80.0499, "district": "Prakasham"},
  {"id": "TWR-ONG-002", "name": "Ongole East",        "lat": 15.5120, "lon": 80.0620, "district": "Prakasham"},
  {"id": "TWR-MRT-001", "name": "Markapur",           "lat": 15.7333, "lon": 79.2667, "district": "Prakasham"},
  {"id": "TWR-CDD-001", "name": "Chirala",            "lat": 15.8167, "lon": 80.3500, "district": "Prakasham"},
  {"id": "TWR-KAN-001", "name": "Kandukur",           "lat": 15.2167, "lon": 79.9000, "district": "Prakasham"},
  {"id": "TWR-GNT-001", "name": "Guntur Junction",   "lat": 16.3067, "lon": 80.4365, "district": "Guntur"},
  {"id": "TWR-VJA-001", "name": "Vijayawada Central","lat": 16.5062, "lon": 80.6480, "district": "Krishna"},
  {"id": "TWR-NLR-001", "name": "Nellore Town",      "lat": 14.4426, "lon": 79.9865, "district": "Nellore"},
  {"id": "TWR-HYD-001", "name": "Hyderabad Secunderabad","lat": 17.4399, "lon": 78.4983, "district": "Hyderabad"},
  {"id": "TWR-HYD-002", "name": "LB Nagar",          "lat": 17.3453, "lon": 78.5479, "district": "Hyderabad"},
];

interface Props {
  movements: MovementPoint[];
  events?: EventOut[];
  suspectLabel?: string;
  cctvDetections?: any[];
}

export default function MovementMap({ movements, events = [], suspectLabel, cctvDetections = [] }: Props) {
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const [hoveredTower, setHoveredTower] = useState<any>(null);
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedTower, setSelectedTower] = useState<any>(null);
  const [selectedCctv, setSelectedCctv] = useState<any>(null);

  // Fullscreen, style, and pulsing animation states
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapStyleMode, setMapStyleMode] = useState<"vector" | "satellite">("vector");

  // Esc key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };
    if (isFullscreen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const getDayNumber = (tsStr: string) => {
    const ts = new Date(tsStr);
    const start = new Date("2024-01-01T00:00:00");
    const diffTime = ts.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.min(30, Math.max(1, diffDays));
  };

  // Group movement data by suspect
  const suspectGroups: Record<string, any[]> = {};
  movements.forEach(m => {
    const label = (m as any).suspect_label || suspectLabel || "Active Suspect";
    if (!suspectGroups[label]) {
      suspectGroups[label] = [];
    }
    suspectGroups[label].push({
      lat: m.lat,
      lon: m.lon,
      timestamp: new Date(m.timestamp).getTime(),
      day: getDayNumber(m.timestamp),
      co_location: m.co_location,
      co_location_with: m.co_location_with,
      tower_id: m.tower_id
    });
  });

  const suspectsList = Object.keys(suspectGroups);

  // Construct towers list with visit details
  const towers = ALL_TOWERS.map(t => {
    const towerMovements = movements.filter(m => m.tower_id === t.id);
    const hasColocation = towerMovements.some(m => m.co_location);

    const visits: any[] = [];
    towerMovements.forEach(m => {
      const day = getDayNumber(m.timestamp);
      const time = new Date(m.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

      const exists = visits.some(v => v.suspect === ((m as any).suspect_label || suspectLabel || "Active Suspect") && v.day === day && v.time === time);
      if (!exists) {
        visits.push({
          suspect: (m as any).suspect_label || suspectLabel || "Active Suspect",
          day,
          time,
          coLocationWith: m.co_location_with || []
        });
      }

      if (m.co_location_with) {
        m.co_location_with.forEach(other => {
          const otherExists = visits.some(v => v.suspect === other && v.day === day && v.time === time);
          if (!otherExists) {
            visits.push({
              suspect: other,
              day,
              time,
              coLocationWith: []
            });
          }
        });
      }
    });

    return {
      ...t,
      hasColocation,
      visits: visits.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))
    };
  });

  // Suspect current position layer input (final positions)
  const currentSuspectPositions: any[] = [];
  Object.entries(suspectGroups).forEach(([label, pts]) => {
    const sorted = [...pts].sort((a, b) => a.timestamp - b.timestamp);
    if (sorted.length > 0) {
      const lastPt = sorted[sorted.length - 1];
      currentSuspectPositions.push({
        label,
        lat: lastPt.lat,
        lon: lastPt.lon,
        color: SUSPECT_COLORS[label] || [59, 130, 246, 220]
      });
    }
  });

  // Co-location Arcs layer input
  const coLocationEvents: any[] = [];
  movements.forEach(m => {
    if (m.co_location && m.co_location_with && m.co_location_with.length > 0) {
      m.co_location_with.forEach(other => {
        const homeCoords = SUSPECT_HOME_TOWERS[other];
        if (homeCoords) {
          coLocationEvents.push({
            fromLon: homeCoords[0],
            fromLat: homeCoords[1],
            toLon: m.lon,
            toLat: m.lat,
            suspectPair: `${other} met at ${m.tower_id}`
          });
        }
      });
    }
  });

  // Extract IMEI swaps closest to active movements
  const imeiSwaps = events
    .filter(ev => ev.event_type === "IMEI_SWAP" && ev.occurred_at)
    .map(ev => {
      const ts = new Date(ev.occurred_at!).getTime();
      let closestPt: any = null;
      let minDiff = Infinity;

      movements.forEach(m => {
        const mTime = new Date(m.timestamp).getTime();
        const diff = Math.abs(mTime - ts);
        if (diff < minDiff) {
          minDiff = diff;
          closestPt = m;
        }
      });

      const tower = closestPt ? ALL_TOWERS.find(t => t.id === closestPt.tower_id) : null;
      return {
        ...ev,
        tower
      };
    })
    .filter((swap): swap is typeof swap & { tower: any } => swap.tower !== null);

  // Construct DeckGL Layers
  const layers: any[] = [
    // Layer 1: Cell towers Scatterplot
    new ScatterplotLayer({
      id: "scatterplot-towers",
      data: towers,
      getPosition: (d: any) => [d.lon, d.lat],
      getRadius: (d: any) => (d.hasColocation ? 900 : 500),
      getFillColor: (d: any) => (d.hasColocation ? [239, 68, 68, 220] : [255, 255, 255, 220]),
      getLineColor: (d: any) => (d.hasColocation ? [185, 28, 28, 255] : [71, 85, 105, 255]),
      lineWidthMinPixels: 2,
      stroked: true,
      filled: true,
      pickable: true,
      onHover: (info: any) => {
        if (info.object) {
          setHoveredTower(info.object);
          setHoverCoords({ x: info.x, y: info.y });
        } else {
          setHoveredTower(null);
        }
      },
      onClick: (info: any) => {
        if (info.object) {
          setSelectedTower(info.object);
          setSelectedCctv(null);
        }
      }
    }),

    // Concentric target rings for co-location towers to make them stand out
    new ScatterplotLayer({
      id: "scatterplot-colocations-rings",
      data: towers.filter(t => t.hasColocation),
      getPosition: (d: any) => [d.lon, d.lat],
      getRadius: 1600,
      getFillColor: [0, 0, 0, 0],
      getLineColor: [239, 68, 68, 255],
      lineWidthMinPixels: 1.5,
      stroked: true,
      filled: false,
      pickable: false
    }),

    // Layer 2: Cell tower text labels
    new TextLayer({
      id: "text-tower-labels",
      data: towers,
      getPosition: (d: any) => [d.lon, d.lat],
      getText: (d: any) => d.name,
      getSize: 10,
      getColor: mapStyleMode === "satellite" ? [255, 255, 255, 255] : [30, 41, 59, 255],
      getTextAnchor: "middle",
      getAlignmentBaseline: "bottom",
      getPixelOffset: [0, -14],
      fontFamily: "Inter, sans-serif",
      fontWeight: 600,
      visible: true
    }),

    // Layer 3: IMEI Swap warning markers
    new ScatterplotLayer({
      id: "scatterplot-imei-swaps",
      data: imeiSwaps,
      getPosition: (d: any) => [d.tower.lon, d.tower.lat],
      getRadius: 1600,
      getFillColor: [245, 158, 11, 230], // Amber
      getLineColor: [255, 255, 255, 255],
      lineWidthMinPixels: 2,
      stroked: true,
      filled: true,
      pickable: true,
      onHover: (info: any) => {
        if (info.object) {
          setHoveredTower({
            id: info.object.tower.id,
            name: `IMEI Swap Registered`,
            district: `${info.object.detail.old_imei?.slice(-6)} ➔ ${info.object.detail.new_imei?.slice(-6)}`,
            lat: info.object.tower.lat,
            lon: info.object.tower.lon,
            hasColocation: false,
            customMessage: `Swap on ${info.object.detail.msisdn}`
          });
          setHoverCoords({ x: info.x, y: info.y });
        } else {
          setHoveredTower(null);
        }
      }
    }),

    // Text labels for IMEI Swaps
    new TextLayer({
      id: "text-imei-swaps",
      data: imeiSwaps,
      getPosition: (d: any) => [d.tower.lon, d.tower.lat],
      getText: (d: any) => `⚠ IMEI SWAP (${d.detail.new_imei?.slice(-4)})`,
      getSize: 10,
      getColor: [245, 158, 11, 255],
      getTextAnchor: "middle",
      getAlignmentBaseline: "bottom",
      getPixelOffset: [0, 24],
      fontFamily: "monospace",
      fontWeight: 700
    }),

    // Layer 4: Suspect current positions (target indicator ring)
    new ScatterplotLayer({
      id: "scatterplot-suspects-pulse",
      data: currentSuspectPositions,
      getPosition: (d: any) => [d.lon, d.lat],
      getRadius: 2000,
      getFillColor: (d: any) => [d.color[0], d.color[1], d.color[2], 50],
      getLineColor: (d: any) => [d.color[0], d.color[1], d.color[2], 200],
      lineWidthMinPixels: 1.5,
      stroked: true,
      filled: true,
      pickable: false
    }),

    // Layer 4: Suspect current positions (actual dot)
    new ScatterplotLayer({
      id: "scatterplot-suspects",
      data: currentSuspectPositions,
      getPosition: (d: any) => [d.lon, d.lat],
      getRadius: 1200,
      getFillColor: (d: any) => d.color,
      getLineColor: [255, 255, 255, 255],
      lineWidthMinPixels: 2,
      stroked: true,
      filled: true,
      pickable: false
    }),

    // Layer 5: Co-location arcs
    new ArcLayer({
      id: "arc-colocations",
      data: coLocationEvents,
      getSourcePosition: (d: any) => [d.fromLon, d.fromLat],
      getTargetPosition: (d: any) => [d.toLon, d.toLat],
      getSourceColor: [139, 92, 246, 180],
      getTargetColor: [239, 68, 68, 180],
      getWidth: 2.5,
      visible: true
    })
  ];

  if (cctvDetections && cctvDetections.length > 0) {
    layers.push(
      new ScatterplotLayer({
        id: "cctv-cameras",
        data: cctvDetections,
        getPosition: (d: any) => [d.camera_lon, d.camera_lat],
        getRadius: 350,
        getFillColor: (d: any) => d.correlation_status === 'CONFIRMED'
          ? [22, 163, 74, 220]   // green-600
          : [245, 158, 11, 180], // amber-500
        getLineColor: [255, 255, 255, 255],
        lineWidthMinPixels: 2,
        stroked: true,
        filled: true,
        pickable: true,
        onHover: (info: any) => {
          if (info.object) {
            setHoveredTower({
              id: info.object.camera_id,
              name: `📷 ${info.object.camera_name}`,
              district: `Face match: ${Math.round(info.object.confidence_score * 100)}%`,
              lat: info.object.camera_lat,
              lon: info.object.camera_lon,
              customMessage: `CDR match: ${info.object.matched_tower_id} (${info.object.correlation_status})`
            });
            setHoverCoords({ x: info.x, y: info.y });
          } else {
            setHoveredTower(null);
          }
        },
        onClick: (info: any) => {
          if (info.object) {
            setSelectedCctv(info.object);
            setSelectedTower(null);
          }
        }
      })
    );

    layers.push(
      new TextLayer({
        id: "cctv-labels",
        data: cctvDetections,
        getPosition: (d: any) => [d.camera_lon, d.camera_lat],
        getText: () => "📷",
        fontSize: 12,
        getPixelOffset: [0, -14],
        fontFamily: "Inter, sans-serif"
      })
    );
  }

  // Layer 3: Suspect movement LineLayers fully drawn
  Object.entries(suspectGroups).forEach(([label, pts]) => {
    const sorted = [...pts].sort((a, b) => a.timestamp - b.timestamp);
    const segments = sorted.slice(0, -1).map((p, i) => {
      const rgb = SUSPECT_COLORS[label] || [59, 130, 246, 220];
      return {
        from: [p.lon, p.lat],
        to: [sorted[i + 1].lon, sorted[i + 1].lat],
        color: [...rgb]
      };
    });

    // 1. Trace background glow layer
    layers.push(
      new LineLayer({
        id: `line-suspect-glow-${label}`,
        data: segments,
        getSourcePosition: (d: any) => d.from,
        getTargetPosition: (d: any) => d.to,
        getColor: (d: any) => [d.color[0], d.color[1], d.color[2], Math.round(d.color[3] * 0.25)],
        getWidth: 9.0,
        pickable: false
      })
    );

    // 2. Trace foreground sharp core layer
    layers.push(
      new LineLayer({
        id: `line-suspect-path-${label}`,
        data: segments,
        getSourcePosition: (d: any) => d.from,
        getTargetPosition: (d: any) => d.to,
        getColor: (d: any) => d.color,
        getWidth: 3.5,
        pickable: false
      })
    );
  });

  const formatSimulatedVisit = (v: any) => {
    const time = v.time;
    const match = time.match(/(\d+):(\d+)/);
    if (match) {
      const hh = parseInt(match[1]);
      const mm = parseInt(match[2]);
      const dur = 20 + (hh * mm) % 11;
      const startMin = mm - Math.floor(dur / 2);
      const endMin = mm + Math.ceil(dur / 2);
      const pad = (n: number) => String(n).padStart(2, "0");

      let startH = hh;
      let startM = startMin;
      if (startM < 0) {
        startM += 60;
        startH -= 1;
      }
      let endH = hh;
      let endM = endMin;
      if (endM >= 60) {
        endM -= 60;
        endH += 1;
      }
      return `Day ${v.day} ${pad(startH)}:${pad(startM)}–${pad(endH)}:${pad(endM)} (${dur} min)`;
    }
    return `Day ${v.day} ${time} (25 min)`;
  };

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
        <DeckGL
          viewState={viewState}
          onViewStateChange={(e: any) => setViewState(e.viewState as any)}
          controller={{ doubleClickZoom: false, dragRotate: false }}
          layers={layers}
          getCursor={({ isHovering }) => (isHovering ? "pointer" : "default")}
        >
          <Map
            mapLib={maplibregl}
            mapStyle={mapStyleMode === "satellite" ? (SATELLITE_STYLE as any) : MAP_STYLE}
            maxBounds={MAX_BOUNDS}
            minZoom={6.5}
            maxZoom={14}
            {...viewState}
          >
            <NavigationControl position="bottom-left" showCompass={false} />
          </Map>
        </DeckGL>

        {/* Map Mode & Fullscreen Controls (Top-Right) */}
        <div className="absolute top-3 right-3 z-10 flex gap-2 font-sans">
          <div className="bg-white border border-slate-200 rounded px-2.5 py-1 flex items-center gap-1.5 shadow-sm text-slate-700">
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">Map Style:</span>
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

        {/* Hover Popup */}
        {hoveredTower && (
          <div
            className="absolute bg-slate-950/90 backdrop-blur-sm border border-slate-800 text-white rounded shadow-xl p-2.5 pointer-events-none z-20 text-[10px] max-w-[210px] font-sans"
            style={{ left: hoverCoords.x + 12, top: hoverCoords.y - 12 }}
          >
            <div className="font-semibold text-slate-100">{hoveredTower.name}</div>
            <div className="text-slate-400 font-mono text-[9px] mt-0.5">{hoveredTower.id} · {hoveredTower.district} Dist.</div>
            <div className="text-slate-400 text-[8px] mt-0.5">{hoveredTower.lat.toFixed(4)}°N, {hoveredTower.lon.toFixed(4)}°E</div>
            {hoveredTower.customMessage && (
              <div className="mt-1 text-cyan-400 font-mono text-[8px] font-semibold">{hoveredTower.customMessage}</div>
            )}
            {hoveredTower.hasColocation && (
              <div className="mt-1.5 text-red-400 font-bold uppercase text-[8px] tracking-wider">⚠ Co-location site</div>
            )}
          </div>
        )}

        {/* Selected Click Panel (Right-Side) */}
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
                    const rgb = SUSPECT_COLORS[v.suspect] || [59, 130, 246, 220];
                    const hexColor = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
                    return (
                      <div key={idx} className="text-[10px] border-b border-slate-50 pb-1.5 last:border-0">
                        <div className="flex justify-between">
                          <span style={{ color: hexColor }} className="font-bold font-mono">{v.suspect}</span>
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

        {/* Selected CCTV Panel (Right-Side) */}
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
                <p className="text-xs text-zinc-700 font-medium font-mono">
                  {selectedCctv.matched_tower_id}
                </p>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold mt-1 uppercase ${
                  selectedCctv.correlation_status === 'CONFIRMED'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {selectedCctv.correlation_status}
                </span>
              </div>

              <div>
                <h4 className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Correlation Detail</h4>
                <p className="text-xs text-zinc-600 leading-tight">{selectedCctv.notes}</p>
              </div>

              {selectedCctv.frame_image_path && (
                <div className="mt-3">
                  <a
                    href={selectedCctv.frame_image_path}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 font-bold hover:underline text-[10px] block"
                  >
                    View frame →
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Legend (Bottom-Right) */}
        <div className="absolute bottom-3 right-3 z-10 bg-white border border-slate-200 rounded p-2.5 shadow-sm text-[9px] font-sans max-w-[150px]">
          <h5 className="font-bold text-slate-700 uppercase tracking-wider mb-1.5 border-b border-slate-100 pb-1">Legend</h5>
          <div className="flex flex-col gap-1.5">
            {suspectsList.map(s => {
              const rgb = SUSPECT_COLORS[s] || [59, 130, 246, 220];
              const hexColor = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
              return (
                <div key={s} className="flex items-center gap-2">
                  <div style={{ width: 14, height: 2, background: hexColor, borderRadius: 1 }} />
                  <span className="text-slate-600 font-mono">{s}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2.5 h-2.5 rounded-full bg-white border border-slate-600" />
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

      {/* Scrubber footer bar */}
      <div style={{ padding: "6px 14px 8px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", flexShrink: 0 }} className="flex justify-between items-center text-[10px] font-mono text-slate-500 z-10">
        <div>Timeline Data: Fully Loaded (30 Days)</div>
        <div>NH-16 Corridor: Prakasham District AP</div>
      </div>
    </div>
  );
}
