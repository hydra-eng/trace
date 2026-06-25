import { useState, useEffect } from "react";
import { Camera, Plus, Video, Activity, MapPin, CheckCircle, Wifi, ShieldAlert, X } from "lucide-react";
import { api } from "../lib/api";

const initialVideoFeeds: Record<string, string> = {
  "CAM-ONG-MKT-01": "/cctv/traffic-video-1.mp4",
  "CAM-CDD-NH16-01": "/cctv/traffic-video-2.mp4",
  "CAM-ONG-BUS-01": "/cctv/traffic-video-3.mp4",
};

const detectionOverlays: Record<string, { top: string; left: string; width: string; height: string; label: string; color: string; pulse?: boolean }[]> = {
  "CAM-ONG-MKT-01": [
    { top: "28%", left: "38%", width: "22%", height: "32%", label: "MATCH: Kalyan C. (91%)", color: "border-red-500 text-red-500", pulse: true },
    { top: "45%", left: "5%", width: "30%", height: "25%", label: "VEHICLE #1 (94%)", color: "border-indigo-500 text-indigo-500" },
    { top: "38%", left: "65%", width: "28%", height: "30%", label: "VEHICLE #2 (88%)", color: "border-indigo-500 text-indigo-500" }
  ],
  "CAM-CDD-NH16-01": [
    { top: "22%", left: "42%", width: "20%", height: "35%", label: "MATCH: Venkatesh P. (87%)", color: "border-red-500 text-red-500", pulse: true },
    { top: "30%", left: "15%", width: "18%", height: "40%", label: "PERSON (91%)", color: "border-indigo-500 text-indigo-500" }
  ],
  "CAM-ONG-BUS-01": [
    { top: "25%", left: "35%", width: "25%", height: "38%", label: "ALERT: Kalyan C. (79%)", color: "border-amber-500 text-amber-500", pulse: true },
    { top: "28%", left: "70%", width: "15%", height: "32%", label: "PERSON (88%)", color: "border-indigo-500 text-indigo-500" }
  ]
};

export default function CctvPluginPage() {
  const [cameras, setCameras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [newCamUrl, setNewCamUrl] = useState("");
  const [newCamName, setNewCamName] = useState("");
  const [videoFeeds, setVideoFeeds] = useState<Record<string, string>>(initialVideoFeeds);

  useEffect(() => {
    // Fetch mock timeline data to get camera feeds
    api.getCctvTimeline("global").then(data => {
      // Deduplicate by camera_id
      const uniqueCams = Array.from(new Map(data.map(item => [item.camera_id, item])).values());
      setCameras(uniqueCams);
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCamName.trim() || !newCamUrl.trim()) return;
    
    const newId = `CAM-NEW-${Math.floor(Math.random() * 1000)}`;
    
    // Choose a random video feed for the new camera stream
    const videoOptions = [
      "/cctv/traffic-video-1.mp4",
      "/cctv/traffic-video-2.mp4",
      "/cctv/traffic-video-3.mp4"
    ];
    const randomVideo = videoOptions[Math.floor(Math.random() * videoOptions.length)];

    setVideoFeeds(prev => ({
      ...prev,
      [newId]: randomVideo
    }));

    // Create a new synthetic camera
    const newCam = {
      camera_id: newId,
      camera_name: newCamName,
      correlation_status: "LIVE",
      frame_image_path: "",
      detection_timestamp: new Date().toISOString()
    };
    
    setCameras([newCam, ...cameras]);
    setShowConnectModal(false);
    setNewCamName("");
    setNewCamUrl("");
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 mb-1 flex items-center gap-2">
            <Camera className="text-indigo-600" />
            Live Surveillance Grid
          </h1>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">
            RTSP Stream Integration & AI Video Analytics Module
          </p>
        </div>
        <button
          onClick={() => setShowConnectModal(true)}
          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded text-xs font-semibold uppercase tracking-wider hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Plus size={16} /> Connect Stream
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 flex justify-center">
            <Activity className="animate-spin text-zinc-400" />
          </div>
        ) : (
          cameras.map((cam, idx) => (
            <div key={idx} className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="relative h-48 bg-black overflow-hidden select-none">
                {videoFeeds[cam.camera_id] ? (
                  <video 
                    src={videoFeeds[cam.camera_id]} 
                    autoPlay 
                    loop 
                    muted 
                    playsInline 
                    className="w-full h-full object-cover opacity-85" 
                  />
                ) : cam.frame_image_path ? (
                  <img src={cam.frame_image_path} alt={cam.camera_name} className="w-full h-full object-cover opacity-80" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs font-mono uppercase">
                    NO SIGNAL
                  </div>
                )}
                
                {/* AI Bounding Boxes Overlaid on Live Stream */}
                {detectionOverlays[cam.camera_id] && detectionOverlays[cam.camera_id].map((det, dIdx) => (
                  <div 
                    key={dIdx} 
                    className={`absolute border-2 rounded-sm ${det.pulse ? 'animate-pulse' : ''} ${
                      det.color.split(' ')[0]
                    }`}
                    style={{ top: det.top, left: det.left, width: det.width, height: det.height }}
                  >
                    <div className={`absolute -top-4 left-0 text-[8px] font-mono font-bold px-1 py-0.2 select-none text-white whitespace-nowrap shadow ${
                      det.color.includes('border-red-500') ? 'bg-red-500' : det.color.includes('border-amber-500') ? 'bg-amber-500' : det.color.includes('border-emerald-500') ? 'bg-emerald-500' : 'bg-indigo-500'
                    }`}>
                      {det.label}
                    </div>
                  </div>
                ))}

                {/* AI Indexing Overlay for Connected Streams */}
                {!detectionOverlays[cam.camera_id] && videoFeeds[cam.camera_id] && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px] text-white">
                    <div className="border border-indigo-500/40 bg-indigo-950/65 px-3 py-1.5 rounded-lg flex items-center gap-2 animate-pulse text-[10px] font-mono tracking-wider">
                      <Activity size={12} className="text-indigo-400 animate-spin" />
                      <span>AI FEED SCAN ACTIVE...</span>
                    </div>
                  </div>
                )}

                <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-mono px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1.5 border border-white/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> REC
                </div>
                <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-mono px-2 py-1 rounded backdrop-blur-sm border border-white/10 flex items-center gap-1">
                  <Video size={10} /> 1080p 30fps
                </div>
                <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
                  <div className="bg-black/60 text-white text-[10px] font-mono px-2 py-1 rounded backdrop-blur-sm border border-white/10">
                    {cam.camera_id}
                  </div>
                  <div className="bg-green-500/20 text-green-400 border border-green-500/30 text-[10px] font-mono px-2 py-1 rounded backdrop-blur-sm">
                    {cam.correlation_status === "LIVE" ? "STREAMING" : "AI DETECT ACTIVE"}
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-zinc-900 text-sm truncate pr-2">{cam.camera_name}</h3>
                    <p className="text-xs text-zinc-500 font-mono flex items-center gap-1 mt-0.5">
                      <MapPin size={10} /> 
                      {cam.camera_lat ? `${cam.camera_lat.toFixed(4)}, ${cam.camera_lon.toFixed(4)}` : 'Geofence Active'}
                    </p>
                  </div>
                  <Wifi size={14} className="text-green-500 shrink-0 mt-0.5" />
                </div>
                <div className="border-t border-zinc-100 pt-3 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-400">LAST PING: 2ms ago</span>
                  <span className="text-[10px] font-mono font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 flex items-center gap-1">
                    <CheckCircle size={10} /> SYNCHRONIZED
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-zinc-100 flex justify-between items-center">
              <div>
                <h2 className="font-semibold text-zinc-900">Add Camera Stream</h2>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-mono mt-0.5">Integration Plugin (Hikvision/CP Plus/Axis)</p>
              </div>
              <button onClick={() => setShowConnectModal(false)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleConnect} className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded p-3 flex gap-2">
                <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={14} />
                <p className="text-[10px] text-amber-800 font-sans leading-relaxed">
                  Only connect trusted RTSP endpoints. The TRACE AI engine will automatically begin face indexing and plate recognition upon connection.
                </p>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">Camera Name / Location</label>
                <input 
                  type="text" 
                  value={newCamName}
                  onChange={e => setNewCamName(e.target.value)}
                  placeholder="e.g. NH16 Toll Plaza Gate 4"
                  className="w-full border border-zinc-300 rounded px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">RTSP Stream URL</label>
                <input 
                  type="text" 
                  value={newCamUrl}
                  onChange={e => setNewCamUrl(e.target.value)}
                  placeholder="rtsp://admin:pass@192.168.1.100:554/cam/realmonitor"
                  className="w-full border border-zinc-300 rounded px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  required
                />
              </div>

              <div className="pt-2">
                <button type="submit" className="w-full bg-indigo-600 text-white font-semibold py-2 rounded shadow-sm hover:bg-indigo-700 transition-colors uppercase tracking-wider text-xs flex justify-center items-center gap-2 cursor-pointer">
                  <Video size={14} /> Initialize Stream
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
