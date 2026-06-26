import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { MovementPoint, EventOut } from "../lib/types";
import { X, Maximize2, Minimize2, Loader2 } from "lucide-react";
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  MapRoute,
  MapArc,
  MarkerTooltip,
  type MapArcDatum,
} from "@/components/ui/map";
import { cn } from "@/lib/utils";
import { MOCK_ROUTES, decodePolyline } from "../lib/mockRoutes";

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

// Helper to fuzzy-match coordinates in cache if no exact match is found
function findClosestCachedRoute(
  start: [number, number],
  end: [number, number]
): [number, number][] | null {
  let closestPoly: string | null = null;
  let minDistance = Infinity;
  let shouldReverse = false;

  const distSq = (p1: [number, number], p2: [number, number]) => {
    return Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2);
  };

  for (const key of Object.keys(MOCK_ROUTES)) {
    const parts = key.split("_");
    const c1 = parts[0].split(",").map(Number) as [number, number];
    const c2 = parts[1].split(",").map(Number) as [number, number];

    // Check forward match: start near c1, end near c2
    const dForward = distSq(start, c1) + distSq(end, c2);
    if (dForward < minDistance) {
      minDistance = dForward;
      closestPoly = MOCK_ROUTES[key];
      shouldReverse = false;
    }

    // Check backward match: start near c2, end near c1
    const dBackward = distSq(start, c2) + distSq(end, c1);
    if (dBackward < minDistance) {
      minDistance = dBackward;
      closestPoly = MOCK_ROUTES[key];
      shouldReverse = true;
    }
  }

  // Snapped to coordinates within a reasonable threshold (approx 15km)
  if (closestPoly && minDistance < 0.02) {
    const decoded = decodePolyline(closestPoly);
    return shouldReverse ? [...decoded].reverse() : decoded;
  }

  return null;
}

// ── OSRM Road Routing ──────────────────────────────────────────────────────────
async function fetchOsrmRoute(
  points: [number, number][]
): Promise<[number, number][]> {
  if (points.length < 2) return points;

  const promises = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];

    if (start[0] === end[0] && start[1] === end[1]) {
      promises.push(Promise.resolve([start]));
      continue;
    }

    const fetchSegment = async (): Promise<[number, number][]> => {
      // 1. Exact & reverse cache lookup
      const startLon = start[0].toFixed(4);
      const startLat = start[1].toFixed(4);
      const endLon = end[0].toFixed(4);
      const endLat = end[1].toFixed(4);

      const key1 = `${startLon},${startLat}_${endLon},${endLat}`;
      const key2 = `${endLon},${endLat}_${startLon},${startLat}`;

      const poly = MOCK_ROUTES[key1] || MOCK_ROUTES[key2];
      if (poly) {
        const decoded = decodePolyline(poly);
        if (!MOCK_ROUTES[key1] && MOCK_ROUTES[key2]) {
          return [...decoded].reverse();
        }
        return decoded;
      }

      // 2. Fuzzy cache lookup
      const fuzzy = findClosestCachedRoute(start, end);
      if (fuzzy) {
        return fuzzy;
      }

      // 3. Online fallback (if user's environment has access)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const url = `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?overview=simplified&geometries=polyline`;

      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data.routes && data.routes[0]) {
            return decodePolyline(data.routes[0].geometry);
          }
        }
      } catch (err) {
        clearTimeout(timeoutId);
      }

      // 4. Ultimate fallback to prevent straight lines: find the closest cached route regardless of threshold
      let closestPoly: string | null = null;
      let minDistance = Infinity;
      let shouldReverse = false;
      const distSq = (p1: [number, number], p2: [number, number]) => Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2);
      for (const key of Object.keys(MOCK_ROUTES)) {
        const parts = key.split("_");
        const c1 = parts[0].split(",").map(Number) as [number, number];
        const c2 = parts[1].split(",").map(Number) as [number, number];
        const dF = distSq(start, c1) + distSq(end, c2);
        if (dF < minDistance) { minDistance = dF; closestPoly = MOCK_ROUTES[key]; shouldReverse = false; }
        const dB = distSq(start, c2) + distSq(end, c1);
        if (dB < minDistance) { minDistance = dB; closestPoly = MOCK_ROUTES[key]; shouldReverse = true; }
      }
      if (closestPoly) {
        const decoded = decodePolyline(closestPoly);
        return shouldReverse ? [...decoded].reverse() : decoded;
      }

      return [start, end];
    };
    promises.push(fetchSegment());
  }


  try {
    const segments = await Promise.all(promises);
    const route: [number, number][] = [];
    segments.forEach((seg) => {
      seg.forEach((coord) => {
        if (
          route.length === 0 ||
          route[route.length - 1][0] !== coord[0] ||
          route[route.length - 1][1] !== coord[1]
        ) {
          route.push(coord);
        }
      });
    });
    return route;
  } catch (err) {
    // global fallback to straight lines
    return points;
  }
}

// ── PROPS ─────────────────────────────────────────────────────────────────────
interface Props {
  movements: MovementPoint[];
  events?: EventOut[];
  suspectLabel?: string;
  cctvDetections?: any[];
  onMapLoaded?: () => void;
}

// ── COMPONENT ──────────────────────────────────────────────────────────────────
export default function MovementMap({
  movements,
  events = [],
  suspectLabel,
  cctvDetections = [],
  onMapLoaded,
}: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapStyleMode, setMapStyleMode] = useState<"vector" | "satellite">("vector");
  const [selectedTower, setSelectedTower] = useState<any>(null);
  const [selectedCctv, setSelectedCctv] = useState<any>(null);

  // Road-following route coordinates per suspect
  const [suspectRoutes, setSuspectRoutes] = useState<
    Record<string, [number, number][]>
  >({});

  const [mapInstance, setMapInstance] = useState<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // ── Group movements by suspect ────────────────────────────────────────────
  const getDayNumber = useCallback((tsStr: string) => {
    const ts = new Date(tsStr);
    const start = new Date("2024-01-01T00:00:00");
    const diffDays = Math.floor((ts.getTime() - start.getTime()) / 86400000) + 1;
    return Math.min(30, Math.max(1, diffDays));
  }, []);

  const suspectGroups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    movements.forEach((m) => {
      const label = (m as any).suspect_label || suspectLabel || "Active Suspect";
      if (!groups[label]) groups[label] = [];
      groups[label].push({
        lat: m.lat,
        lon: m.lon,
        timestamp: new Date(m.timestamp).getTime(),
        day: getDayNumber(m.timestamp),
        co_location: m.co_location,
        co_location_with: m.co_location_with,
        tower_id: m.tower_id,
      });
    });
    return groups;
  }, [movements, suspectLabel, getDayNumber]);

  const suspectsList = Object.keys(suspectGroups);
  const routesReady = suspectsList.length === 0 || suspectsList.every((label) => suspectRoutes[label] !== undefined);
  const isFullyLoaded = mapLoaded && routesReady;

  // ── Track Map Load and Style Load Status ───────────────────────────────────
  useEffect(() => {
    if (!mapInstance) {
      setMapLoaded(false);
      return;
    }

    const handleReady = () => {
      setMapLoaded(true);
    };

    if (mapInstance.loaded() && mapInstance.isStyleLoaded()) {
      setMapLoaded(true);
    } else {
      mapInstance.on("load", handleReady);
      mapInstance.on("idle", handleReady);
    }

    return () => {
      mapInstance.off("load", handleReady);
      mapInstance.off("idle", handleReady);
    };
  }, [mapInstance]);

  // ── Notify Parent when both Map and Suspect Routes are Fully Loaded ───────
  useEffect(() => {
    if (isFullyLoaded) {
      onMapLoaded?.();
    }
  }, [isFullyLoaded, onMapLoaded]);

  // ── Fit Map Bounds (Exactly once per dataset to allow free roaming) ────────
  const lastFittedKeyRef = useRef<string>("");
  useEffect(() => {
    if (!mapInstance || !isFullyLoaded) return;

    const dataKey = `${movements.map((m) => `${m.lon},${m.lat}`).join(";")}|${cctvDetections.map((d) => d.camera_id).join(";")}`;
    if (lastFittedKeyRef.current === dataKey) return;

    // Call resize to ensure container box is calculated properly
    mapInstance.resize();

    const coords: [number, number][] = [];

    // Collect coordinates from movements
    movements.forEach((m) => {
      coords.push([m.lon, m.lat]);
    });

    // Collect from CCTV detections
    cctvDetections.forEach((det) => {
      if (det.camera_lon && det.camera_lat) {
        coords.push([det.camera_lon, det.camera_lat]);
      }
    });

    // Collect from suspect routes
    Object.values(suspectRoutes).forEach((route) => {
      route.forEach(([lon, lat]) => {
        coords.push([lon, lat]);
      });
    });

    if (coords.length === 0) return;

    // Compute bounding box
    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    coords.forEach(([lon, lat]) => {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });

    // Make sure we have a valid bounding box with some minimum size
    if (minLon === maxLon) {
      minLon -= 0.05;
      maxLon += 0.05;
    }
    if (minLat === maxLat) {
      minLat -= 0.05;
      maxLat += 0.05;
    }

    try {
      mapInstance.fitBounds([minLon, minLat, maxLon, maxLat], {
        padding: { top: 60, bottom: 60, left: 60, right: 60 },
        maxZoom: 13,
        duration: 1500,
      });
      lastFittedKeyRef.current = dataKey;
    } catch (err) {
      console.error("Error fitting bounds:", err);
    }
  }, [mapInstance, isFullyLoaded, movements, suspectRoutes, cctvDetections]);

  // ── Esc key to exit fullscreen ────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    if (isFullscreen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Resize map when fullscreen mode changes
  useEffect(() => {
    if (mapInstance) {
      const timer = setTimeout(() => {
        mapInstance.resize();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mapInstance, isFullscreen]);

  // (definitions moved to top of component)

  // ── Build tower visit data dynamically from movements ──────────────────────
  const dynamicTowersMap: Record<string, any> = {};
  movements.forEach((m) => {
    if (!dynamicTowersMap[m.tower_id]) {
      const refTower = ALL_TOWERS.find((t) => t.id === m.tower_id);
      dynamicTowersMap[m.tower_id] = {
        id: m.tower_id,
        name: refTower?.name || `Cell Tower (${m.tower_id})`,
        lat: m.lat,
        lon: m.lon,
        district: refTower?.district || "Andhra Pradesh",
        hasColocation: false,
        visits: [],
      };
    }
    
    const tObj = dynamicTowersMap[m.tower_id];
    if (m.co_location) {
      tObj.hasColocation = true;
    }

    const day = getDayNumber(m.timestamp);
    const time = new Date(m.timestamp).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const suspLabel = (m as any).suspect_label || suspectLabel || "Active Suspect";
    
    // Add visits
    const exists = tObj.visits.some(
      (v: any) => v.suspect === suspLabel && v.day === day && v.time === time
    );
    if (!exists) {
      tObj.visits.push({
        suspect: suspLabel,
        day,
        time,
        coLocationWith: m.co_location_with || [],
      });
    }
    
    if (m.co_location_with) {
      m.co_location_with.forEach((other) => {
        const otherExists = tObj.visits.some(
          (v: any) => v.suspect === other && v.day === day && v.time === time
        );
        if (!otherExists) {
          tObj.visits.push({ suspect: other, day, time, coLocationWith: [] });
        }
      });
    }
  });

  const towers = Object.values(dynamicTowersMap).map((t: any) => ({
    ...t,
    visits: t.visits.sort((a: any, b: any) => a.day - b.day || a.time.localeCompare(b.time)),
  }));

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
      const tower = closestPt ? {
        id: closestPt.tower_id,
        name: ALL_TOWERS.find((t) => t.id === closestPt.tower_id)?.name || `Cell Tower (${closestPt.tower_id})`,
        lat: closestPt.lat,
        lon: closestPt.lon,
        district: ALL_TOWERS.find((t) => t.id === closestPt.tower_id)?.district || "Andhra Pradesh"
      } : null;
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
    // Fetch OSRM routes progressively in the background for each suspect
    Object.entries(suspectGroups).forEach(async ([label, pts]) => {
      const sorted = [...pts].sort((a, b) => a.timestamp - b.timestamp);
      if (sorted.length < 2) return;

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

      const osrmRoute = await fetchOsrmRoute(unique);
      setSuspectRoutes((prev) => {
        const prevRoute = prev[label];
        if (prevRoute && prevRoute.length === osrmRoute.length) {
          const isSame = prevRoute.every((coord, idx) => coord[0] === osrmRoute[idx][0] && coord[1] === osrmRoute[idx][1]);
          if (isSame) return prev;
        }
        return {
          ...prev,
          [label]: osrmRoute,
        };
      });
    });
  }, [suspectGroups]);

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

  const getGlowClass = (label: string) => {
    if (label.includes("A") || label.includes("Kalyan")) return "glow-blue";
    if (label.includes("B") || label.includes("Venkatesh")) return "glow-violet";
    if (label.includes("C") || label.includes("Subba")) return "glow-emerald";
    if (label.includes("D")) return "glow-amber";
    return "glow-blue";
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
      <style>{`
        @keyframes glow-pulse-blue {
          0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
        @keyframes glow-pulse-violet {
          0% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(139, 92, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
        }
        @keyframes glow-pulse-emerald {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes glow-pulse-amber {
          0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }
        @keyframes glow-pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .glow-blue { animation: glow-pulse-blue 1.8s infinite; }
        .glow-violet { animation: glow-pulse-violet 1.8s infinite; }
        .glow-emerald { animation: glow-pulse-emerald 1.8s infinite; }
        .glow-amber { animation: glow-pulse-amber 1.8s infinite; }
        .glow-red { animation: glow-pulse-red 1.8s infinite; }
      `}</style>

      {/* ── Premium Loading Overlay ── */}
      {!isFullyLoaded && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/90 backdrop-blur-xs font-sans">
          <div className="flex flex-col items-center gap-3 p-6 bg-white border border-slate-100 rounded-xl shadow-lg max-w-sm text-center animate-in fade-in zoom-in-95 duration-200">
            <Loader2 className="size-8 animate-spin text-indigo-600" />
            <div>
              <h3 className="text-xs font-bold text-slate-800">Loading Geospatial Analysis...</h3>
              <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                Initializing digital map layers and plotting suspect movement timelines
              </p>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, position: "relative" }}>
        <Map
          ref={setMapInstance}
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

          {/* ── Suspect movement pings (path dots) ── */}
          {movements.map((m, idx) => {
            const label = (m as any).suspect_label || suspectLabel || "Active Suspect";
            const hex = SUSPECT_HEX_COLORS[label] || "#3b82f6";
            const towerName = ALL_TOWERS.find((t) => t.id === m.tower_id)?.name || m.tower_id;
            const timeStr = new Date(m.timestamp).toLocaleString("en-IN", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <MapMarker
                key={`ping-${idx}-${m.timestamp}`}
                longitude={m.lon}
                latitude={m.lat}
              >
                <MarkerContent>
                  <div
                    className="rounded-full border border-white cursor-pointer shadow-xs transition-transform duration-100 hover:scale-150"
                    style={{
                      width: 7,
                      height: 7,
                      backgroundColor: hex,
                    }}
                  />
                </MarkerContent>
                <MarkerTooltip className="bg-slate-900 border border-slate-700 text-white rounded p-2 text-[10px] shadow-lg font-sans min-w-[150px] z-50">
                  <div className="font-bold" style={{ color: hex }}>{label}</div>
                  <div className="text-[9px] text-slate-300 mt-0.5">📍 CDR Registration</div>
                  <div className="border-t border-slate-700 my-1" />
                  <div className="space-y-0.5 text-slate-200">
                    <div><strong>Tower:</strong> {towerName}</div>
                    <div><strong>Time:</strong> <span className="font-mono">{timeStr}</span></div>
                    <div><strong>Coords:</strong> <span className="font-mono text-slate-400">{m.lat.toFixed(4)}, {m.lon.toFixed(4)}</span></div>
                  </div>
                </MarkerTooltip>
              </MapMarker>
            );
          })}

          {/* ── Cell tower markers ── */}
          {towers.map((tower) => (
            <MapMarker
              key={tower.id}
              longitude={tower.lon}
              latitude={tower.lat}
              onClick={() => { setSelectedTower(tower); setSelectedCctv(null); }}
            >
              <MarkerContent>
                <div
                  className={cn(
                    "rounded-full cursor-pointer transition-all duration-150",
                    tower.hasColocation ? "glow-red" : ""
                  )}
                  style={{
                    width: tower.hasColocation ? 20 : 14,
                    height: tower.hasColocation ? 20 : 14,
                    backgroundColor: tower.hasColocation ? "#ef4444" : "#ffffff",
                    border: tower.hasColocation ? "2.5px solid #b91c1c" : "2px solid #475569",
                    boxShadow: tower.hasColocation ? undefined : "0 1px 4px rgba(0,0,0,0.18)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.25)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                />
              </MarkerContent>
              <MarkerTooltip className="bg-slate-900 border border-slate-700 text-white rounded p-2.5 text-xs shadow-lg font-sans min-w-[200px] z-50">
                <div className="font-bold flex items-center justify-between gap-2">
                  <span>{tower.name}</span>
                  {tower.hasColocation && (
                    <span className="bg-red-600 text-white text-[8px] px-1 rounded font-bold animate-pulse">
                      CO-LOCATION
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{tower.id} · {tower.district} District</div>
                <div className="border-t border-slate-700 my-1.5" />
                <div className="text-[10px] text-slate-300">
                  <strong>Visits:</strong> {tower.visits?.length || 0} logged coordinates
                </div>
                {tower.visits && tower.visits.length > 0 && (
                  <div className="text-[9px] text-slate-400 mt-1 max-h-[80px] overflow-y-auto font-mono">
                    {tower.visits.slice(0, 3).map((v: any, idx: number) => (
                      <div key={idx} className="truncate">
                        • {v.suspect} (Day {v.day} · {v.time})
                      </div>
                    ))}
                    {tower.visits.length > 3 && (
                      <div className="text-[8px] text-slate-500 italic mt-0.5">
                        + {tower.visits.length - 3} more visits...
                      </div>
                    )}
                  </div>
                )}
                <div className="text-[9px] text-slate-500 mt-1.5 italic font-mono">Click site to view full details</div>
              </MarkerTooltip>
            </MapMarker>
          ))}

          {/* ── IMEI swap markers ── */}
          {imeiSwaps.map((swap, i) => (
            <MapMarker
              key={`imei-${i}`}
              longitude={swap.tower.lon}
              latitude={swap.tower.lat}
            >
              <MarkerContent>
                <div
                  className="glow-amber rounded-full flex items-center justify-center text-white font-bold cursor-default shadow-md"
                  style={{
                    background: "#f59e0b",
                    border: "2px solid #fff",
                    width: 18,
                    height: 18,
                    fontSize: 9,
                  }}
                >
                  ⚠
                </div>
              </MarkerContent>
              <MarkerTooltip className="bg-slate-900 border border-slate-700 text-white rounded p-2.5 text-xs shadow-lg font-sans min-w-[220px] z-50">
                <div className="font-bold text-amber-400 flex items-center gap-1.5">
                  <span>⚠ IMEI Swap Detected</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Tower: {swap.tower.name}</div>
                <div className="border-t border-slate-700 my-1.5" />
                <div className="space-y-0.5 text-[10px]">
                  <div><strong>Suspects:</strong> {swap.involved_suspects?.join(", ")}</div>
                  <div><strong>Old Handset (IMEI):</strong> <span className="font-mono text-slate-300">...{(swap.detail as any)?.old_imei?.slice(-6)}</span></div>
                  <div><strong>New Handset (IMEI):</strong> <span className="font-mono text-slate-300">...{(swap.detail as any)?.new_imei?.slice(-6)}</span></div>
                  <div><strong>Time:</strong> <span className="text-slate-300 font-mono">{new Date(swap.occurred_at || "").toLocaleString("en-IN")}</span></div>
                </div>
              </MarkerTooltip>
            </MapMarker>
          ))}

          {/* ── Suspect current-position markers ── */}
          {Object.entries(currentPositions).map(([label, pos]) => {
            const hex = SUSPECT_HEX_COLORS[label] || "#3b82f6";
            const glowClass = getGlowClass(label);
            return (
              <MapMarker key={`susp-${label}`} longitude={pos.lon} latitude={pos.lat}>
                <MarkerContent>
                  <div
                    className={cn("rounded-full border-2 border-white cursor-pointer shadow-md", glowClass)}
                    style={{
                      width: 16,
                      height: 16,
                      backgroundColor: hex,
                    }}
                  />
                </MarkerContent>
                <MarkerTooltip className="bg-slate-900 border border-slate-700 text-white rounded p-2 text-xs shadow-lg font-sans z-50">
                  <div className="font-bold">{label}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">Current Position</div>
                  <div className="text-[10px] text-slate-400 font-mono">Coords: {pos.lat.toFixed(4)}°N, {pos.lon.toFixed(4)}°E</div>
                </MarkerTooltip>
              </MapMarker>
            );
          })}

          {/* ── CCTV camera markers ── */}
          {cctvDetections.map((det) => {
            const isConfirmed = det.correlation_status === "CONFIRMED";
            return (
              <MapMarker
                key={det.camera_id}
                longitude={det.camera_lon}
                latitude={det.camera_lat}
                onClick={() => { setSelectedCctv(det); setSelectedTower(null); }}
              >
                <MarkerContent>
                  <div
                    className={cn(
                      "rounded flex items-center justify-center cursor-pointer shadow-md text-[10px] transition-transform",
                      isConfirmed ? "glow-emerald" : "glow-amber"
                    )}
                    style={{
                      width: 20,
                      height: 20,
                      backgroundColor: isConfirmed ? "#16a34a" : "#f59e0b",
                      border: "2px solid #fff",
                    }}
                  >
                    📷
                  </div>
                </MarkerContent>
                <MarkerTooltip className="bg-slate-900 border border-slate-700 text-white rounded p-2.5 text-xs shadow-lg font-sans min-w-[220px] z-50">
                  <div className="font-bold flex items-center justify-between gap-2">
                    <span>📷 {det.camera_name}</span>
                    <span className={cn("text-[8px] px-1 rounded font-bold text-white", isConfirmed ? "bg-emerald-600" : "bg-amber-600")}>
                      {det.correlation_status}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{det.camera_id}</div>
                  <div className="border-t border-slate-700 my-1.5" />
                  <div className="space-y-0.5 text-[10px]">
                    <div className="text-emerald-400 font-bold">
                      Match: {det.suspect_label} ({Math.round(det.confidence_score * 100)}% Conf)
                    </div>
                    <div><strong>Time:</strong> <span className="font-mono text-slate-300">{new Date(det.detection_timestamp).toLocaleString("en-IN")}</span></div>
                    <div className="text-slate-300 italic text-[9px] mt-1 leading-tight">"{det.notes}"</div>
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1.5 italic font-mono">Click camera to view live feed frame</div>
                </MarkerTooltip>
              </MapMarker>
            );
          })}
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
