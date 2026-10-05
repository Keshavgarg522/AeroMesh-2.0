import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { Incident, CustomMarking, FilterState, IncidentStats, VideoFrame, VideoMeta, ReconstructionAnnotation } from '../types';
import { initialIncident, historyIncidents as defaultHistory, defaultMarkings, defaultFilterState, defaultIncidentStats, DEFAULT_PLATFORM_MARKINGS } from '../data/mockData';
import { extractFramesFromFile, getDemoFrames, type ExtractionProgress } from '../utils/frameExtractor';
import { downloadIncidentReport } from '../utils/reportGenerator';
import { api } from '../services/api';

// ─── Extraction State ────────────────────────────────────────────────────────
export type ExtractionStatus = 'idle' | 'extracting' | 'done' | 'error';

export interface ExtractionState {
  status: ExtractionStatus;
  progress: ExtractionProgress;
  error: string | null;
}

// ─── Context Shape ───────────────────────────────────────────────────────────
interface IncidentContextType {
  // Incident data
  incident: Incident;
  setIncident: React.Dispatch<React.SetStateAction<Incident>>;
  historyIncidents: Incident[];
  selectIncident: (id: string) => void;

  // Markings
  markings: CustomMarking[];
  addMarking: (marking: Omit<CustomMarking, 'id'>) => void;
  deleteMarking: (id: string) => void;
  toggleMarkingVisibility: (id: string) => void;
  updateMarkingPosition: (id: string, position: [number, number, number]) => void;

  // Custom Markings Master Visibility (Completely independent from platform layer toggles)
  customMarkingsMaster: boolean;
  setCustomMarkingsMaster: (val: boolean) => void;

  // Platform (AI-detected) markings — populated from backend annotations after analysis
  platformMarkings: CustomMarking[];

  // Filters (Platform Layers)
  filters: FilterState;
  setFilter: (key: keyof Omit<FilterState, 'customMarkings' | 'platformMarkingToggles'>, val: boolean) => void;
  setCustomMarkingFilter: (name: string, val: boolean) => void;
  setPlatformMarkingFilter: (id: string, val: boolean) => void;
  resetFilters: () => void;

  // Stats
  stats: IncidentStats;

  // ── Real Video File & Extraction ──────────────────────────────────────────
  /** The raw File object from the user's upload */
  videoFile: File | null;
  /** blob: or asset URL for the current video — usable as <video src={...}> */
  videoBlobUrl: string | null;
  /** Real video metadata read from the video element and container */
  videoMeta: VideoMeta | null;
  /** Set the uploaded file; triggers metadata read + real frame extraction */
  setVideoFile: (file: File | null) => Promise<void>;

  // ── Extracted Frames ──────────────────────────────────────────────────────
  frames: VideoFrame[];
  setFrames: React.Dispatch<React.SetStateAction<VideoFrame[]>>;
  selectedFrame: VideoFrame | null;
  setSelectedFrame: (frame: VideoFrame | null) => void;
  reloadFrames: () => void;

  /** Extraction lifecycle state */
  extraction: ExtractionState;

  // ── Report Modal & Actions ────────────────────────────────────────────────
  isReportModalOpen: boolean;
  reportIncident: Incident;
  openReport: (incident?: Incident) => void;
  closeReport: () => void;
  downloadReport: (incident?: Incident) => void;

  // ── Incident helper ───────────────────────────────────────────────────────
  createNewIncident: (data: Partial<Incident>) => string;
  refreshIncident: (id: string) => Promise<Incident | null>;
}

// ─── Context ─────────────────────────────────────────────────────────────────
const IncidentContext = createContext<IncidentContextType | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────
type IncidentProviderProps = { children: React.ReactNode; userId?: string | null };
export const IncidentProvider: React.FC<IncidentProviderProps> = ({ children, userId }) => {
  const [incident, setIncident] = useState<Incident>(initialIncident);
  const [historyList, setHistoryList] = useState<Incident[]>(defaultHistory);
  const [markings, setMarkings] = useState<CustomMarking[]>(defaultMarkings);
  const [customMarkingsMaster, setCustomMarkingsMaster] = useState<boolean>(true);
  const [filters, setFilters] = useState<FilterState>(defaultFilterState);
  const [stats, setStats] = useState<IncidentStats>(initialIncident.stats || defaultIncidentStats);
  const [platformMarkings, setPlatformMarkings] = useState<CustomMarking[]>(DEFAULT_PLATFORM_MARKINGS);

  // Category → color mapping for the 7 allowed AeroMesh platform categories
  const CATEGORY_COLORS: Record<string, string> = {
    'Peoples':           '#3b82f6', // blue
    'Vehicles':          '#8b5cf6', // purple
    'Fire':              '#ef4444', // red
    'Smoke':             '#6b7280', // gray
    'Damage':            '#f59e0b', // amber
    'Entry/Exit Points': '#10b981', // green
    '3D Reconstruction': '#06b6d4', // cyan
  };
  const CATEGORY_ICONS: Record<string, CustomMarking['iconType']> = {
    'Peoples':           'pin',
    'Vehicles':          'pin',
    'Fire':              'fire',
    'Smoke':             'warning',
    'Damage':            'warning',
    'Entry/Exit Points': 'pin',
    '3D Reconstruction': 'pin',
  };

  // Video & frames ─────────────────────────────────────────────────────────
  const [videoFile, _setVideoFile] = useState<File | null>(null);
  // Default to the sample drone footage so video and frames load right away
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(initialIncident.videoObjectUrl || '/assets/drone_sample.mp4');
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>({
    duration: 53.9,
    durationFormatted: '00:53',
    width: 1920,
    height: 1080,
    resolutionFormatted: '1920 × 1080',
    fps: 12,
  });
  const [frames, setFrames] = useState<VideoFrame[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<VideoFrame | null>(null);
  const [extraction, setExtraction] = useState<ExtractionState>({
    status: 'idle',
    progress: { current: 0, total: 0 },
    error: null,
  });

  // Report Modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [reportTarget, setReportTarget] = useState<Incident>(initialIncident);

  // Track active extraction aborts
  const extractionAbortRef = useRef<boolean>(false);
  // Active incident ID reference to protect against async race conditions when switching incidents
  const activeIncidentIdRef = useRef<string>(initialIncident.id);

  // Fetch real incidents from backend when userId changes (login/logout)
  useEffect(() => {
    const fetchIncidents = async () => {
      if (!userId) {
        // No user logged in — reset to empty history (no shared data)
        setHistoryList([]);
        setIncident(initialIncident);
        setStats(defaultIncidentStats);
        return;
      }
      try {
        const backendIncidents = await api.listIncidents();
        if (backendIncidents && backendIncidents.length > 0) {
          setHistoryList(backendIncidents);
          setIncident(backendIncidents[0]);
          if (backendIncidents[0].stats) setStats(backendIncidents[0].stats);
        } else {
          // User has no incidents yet — start fresh
          setHistoryList([]);
          setIncident(initialIncident);
        }
      } catch (err) {
        // Graceful fallback if backend not running
        console.log('[AeroMesh API] Initializing with local data:', err);
        if (!userId) setHistoryList([]);
      }
    };
    fetchIncidents();
  }, [userId]);

  /**
   * Load custom markings for a specific incident.
   * Completely isolates each analysis: markings from one analysis never leak to another.
   * When reopening an existing analysis, its saved custom markings and individual visibility states are restored.
   */
  const loadMarkingsForIncident = useCallback(async (incidentId: string) => {
    // Immediately clear current markings so previous analysis markings NEVER leak!
    setMarkings([]);
    setCustomMarkingsMaster(true);
    setFilters(prev => ({ ...prev, customMarkings: {} }));

    let loaded: CustomMarking[] = [];

    // 1. Fetch from backend database
    try {
      const backendMarks = await api.getMarkings(incidentId);
      if (backendMarks && backendMarks.length > 0) {
        loaded = backendMarks.map(m => ({ ...m, isSystem: m.isSystem ?? false }));
      }
    } catch {
      // offline or not found
    }

    // 2. Check per-incident localStorage cache if backend returned none
    if (loaded.length === 0) {
      try {
        const cached = localStorage.getItem(`aeromesh_markings_${incidentId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            loaded = parsed.map(m => ({ ...m, isSystem: m.isSystem ?? false }));
          }
        }
      } catch {
        // ignore parse error
      }
    }

    // 3. Fall back to demo custom markings ONLY for the initial demo incident
    if (loaded.length === 0 && incidentId === initialIncident.id) {
      loaded = defaultMarkings;
    }

    // Ensure we do not set markings if the user switched away while loading
    if (activeIncidentIdRef.current !== incidentId) return;

    // 4. Set loaded markings and restore their individual visibility states
    setMarkings(loaded);
    const customFilterMap: Record<string, boolean> = {};
    loaded.forEach(m => {
      customFilterMap[m.name] = m.visible !== false;
    });
    setFilters(prev => ({
      ...prev,
      customMarkings: customFilterMap,
    }));
  }, []);

  // Synchronize custom markings whenever incident changes
  useEffect(() => {
    if (incident?.id) {
      loadMarkingsForIncident(incident.id);
    } else {
      setMarkings([]);
      setFilters(prev => ({ ...prev, customMarkings: {} }));
    }
  }, [incident?.id, loadMarkingsForIncident]);

  /**
   * Load platform (AI-detected) markings from backend annotations.
   * These are STRICTLY READ-ONLY system markings generated by the analysis pipeline.
   * They appear as default marking overlays controlled by the platform layer toggles.
   * Clears previous analysis markings so they never leak between incidents.
   */
  const loadPlatformMarkingsForIncident = useCallback(async (incidentId: string) => {
    if (incidentId === initialIncident.id) {
      setPlatformMarkings(DEFAULT_PLATFORM_MARKINGS);
    } else {
      setPlatformMarkings([]);
    }

    try {
      const annotations: ReconstructionAnnotation[] = await api.getAnnotations(incidentId);
      if (activeIncidentIdRef.current !== incidentId) return;
      if (annotations && annotations.length > 0) {
        const converted: CustomMarking[] = annotations.map(ann => {
          let cat: CustomMarking['category'];
          let mkType: CustomMarking['type'] = 'Custom';

          if (ann.annotation_type === 'Peoples') {
            cat = 'humans';
            mkType = 'Custom';
          } else if (ann.annotation_type === 'Vehicles') {
            cat = 'vehicles';
            mkType = 'Custom';
          } else if (ann.annotation_type === 'Fire') {
            cat = 'fireSmoke';
            mkType = 'Hazard';
          } else if (ann.annotation_type === 'Smoke') {
            cat = 'fireSmoke';
            mkType = 'Hazard';
          } else if (ann.annotation_type === 'Damage') {
            cat = 'damage';
            mkType = 'Damage';
          } else if (ann.annotation_type === 'Entry/Exit Points') {
            cat = 'entryExit';
            mkType = 'Entry Point';
          }

          return {
            id: `platform-ann-${ann.id}`,
            name: ann.label,
            type: mkType,
            color: CATEGORY_COLORS[ann.annotation_type] || '#64748b',
            description: `${ann.annotation_type} detected`,
            visible: true,
            position: ann.position,
            iconType: CATEGORY_ICONS[ann.annotation_type] || 'pin',
            isSystem: true,
            category: cat,
            annotationType: ann.annotation_type,
          };
        });
        setPlatformMarkings(converted);
      }
    } catch {
      // Backend offline or no annotations yet
      if (activeIncidentIdRef.current === incidentId) {
        if (incidentId === initialIncident.id) {
          setPlatformMarkings(DEFAULT_PLATFORM_MARKINGS);
        } else {
          setPlatformMarkings([]);
        }
      }
    }
  }, []);

  // Load platform markings whenever the incident changes
  useEffect(() => {
    if (incident?.id) {
      loadPlatformMarkingsForIncident(incident.id);
    } else {
      setPlatformMarkings([]);
    }
  }, [incident?.id, loadPlatformMarkingsForIncident]);

  /** Open the Analysis Report modal */
  const openReport = useCallback((inc?: Incident) => {
    setReportTarget(inc || incident);
    setIsReportModalOpen(true);
  }, [incident]);

  /** Close the Analysis Report modal */
  const closeReport = useCallback(() => {
    setIsReportModalOpen(false);
  }, []);

  /** Download report directly — uses official backend PDF when available */
  const downloadReport = useCallback((inc?: Incident) => {
    const target = inc || incident;
    try {
      const downloadUrl = api.getDownloadReportUrl(target.id);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `AeroMesh_${target.id}_Report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // Fallback to client-side jsPDF
      downloadIncidentReport(target);
    }
  }, [incident]);

  /** Refresh incident from backend API — also reloads AI markings and platform annotations */
  const refreshIncident = useCallback(async (id: string): Promise<Incident | null> => {
    try {
      const fresh = await api.getIncident(id);
      if (fresh) {
        setIncident(fresh);
        setHistoryList(prev => {
          const idx = prev.findIndex(item => item.id === id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = fresh;
            return next;
          }
          return [fresh, ...prev];
        });
        if (fresh.stats) setStats(fresh.stats);
        // ── Reload AI-detected markings and platform annotations ───────────
        // This is critical: ensures that newly-generated default markings from
        // the pipeline (is_system=true in custom_markings table) appear on the
        // 3D model immediately after analysis completes without requiring a
        // full page reload.
        await loadMarkingsForIncident(id);
        await loadPlatformMarkingsForIncident(id);
        return fresh;
      }
    } catch (err) {
      console.warn('[AeroMesh API] Failed to refresh incident:', err);
    }
    return null;
  }, [loadMarkingsForIncident, loadPlatformMarkingsForIncident]);

  /** Select an incident from history with full state isolation */
  const selectIncident = useCallback(async (id: string) => {
    activeIncidentIdRef.current = id;

    // Immediately clear all previous incident state to prevent any data leaks!
    setMarkings([]);
    setPlatformMarkings([]);
    setFrames([]);
    setSelectedFrame(null);
    setVideoBlobUrl(null);
    setVideoMeta(null);
    setCustomMarkingsMaster(true);
    setFilters(defaultFilterState);

    const found = historyList.find(item => item.id === id);
    if (found) {
      setIncident(found);
      if (found.stats) setStats(found.stats);
      if (found.videoObjectUrl) setVideoBlobUrl(found.videoObjectUrl);
    }

    let currentInc = found;

    try {
      const fresh = await api.getIncident(id);
      if (activeIncidentIdRef.current !== id) return;
      if (fresh) {
        currentInc = fresh;
        setIncident(fresh);
        if (fresh.stats) setStats(fresh.stats);
        if (fresh.video_path) {
          setVideoBlobUrl(`http://localhost:8000/storage/${fresh.video_path}`);
        } else if (fresh.videoObjectUrl) {
          setVideoBlobUrl(fresh.videoObjectUrl);
        }
      }
    } catch {
      // offline fallback
    }

    if (activeIncidentIdRef.current !== id) return;

    // Load corresponding real frames from backend
    try {
      const backendFrames = await api.getFrames(id);
      if (activeIncidentIdRef.current !== id) return;
      if (backendFrames && backendFrames.length > 0) {
        setFrames(backendFrames);
        setSelectedFrame(backendFrames[0] ?? null);
        setExtraction({
          status: 'done',
          progress: { current: backendFrames.length, total: backendFrames.length },
          error: null,
        });
      } else if (id === 'AM-20250908-001') {
        const demoFrames = getDemoFrames(id);
        setFrames(demoFrames);
        setSelectedFrame(demoFrames[0] ?? null);
        setVideoBlobUrl(currentInc?.videoObjectUrl || '/assets/drone_sample.mp4');
        setExtraction({
          status: 'done',
          progress: { current: demoFrames.length, total: demoFrames.length },
          error: null,
        });
      } else {
        // Honest empty state when no frames exist yet
        setFrames([]);
        setSelectedFrame(null);
        setExtraction({
          status: 'idle',
          progress: { current: 0, total: 0 },
          error: null,
        });
      }
    } catch {
      if (activeIncidentIdRef.current !== id) return;
      if (id === 'AM-20250908-001') {
        const demoFrames = getDemoFrames(id);
        setFrames(demoFrames);
        setSelectedFrame(demoFrames[0] ?? null);
      }
    }

    // Reopen custom markings and platform markings strictly for this specific analysis
    loadMarkingsForIncident(id);
    loadPlatformMarkingsForIncident(id);
  }, [historyList, loadMarkingsForIncident, loadPlatformMarkingsForIncident]);


  /**
   * Main setter: when the user picks a new video file (or clears it),
   * this cleans up the old blob URL, clears old frames, creates a new one,
   * and runs real frame extraction.
   */
  const setVideoFile = useCallback(async (file: File | null) => {
    extractionAbortRef.current = true;

    // Revoke old blob URL to free memory if it was a blob:
    setVideoBlobUrl(prev => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });

    setFrames([]);
    setSelectedFrame(null);
    setVideoMeta(null);
    _setVideoFile(null);

    if (!file) {
      // Revert to demo frames if cleared
      const demo = getDemoFrames(incident.id);
      setFrames(demo);
      setSelectedFrame(demo[0] ?? null);
      setVideoBlobUrl('/assets/drone_sample.mp4');
      setVideoMeta({
        duration: 15,
        durationFormatted: '00:15',
        width: 1920,
        height: 1080,
        resolutionFormatted: '1920 × 1080',
        fps: 12,
      });
      setExtraction({ status: 'done', progress: { current: demo.length, total: demo.length }, error: null });
      return;
    }

    if (file.size === 0) {
      setExtraction({
        status: 'error',
        progress: { current: 0, total: 0 },
        error: 'The selected video file is empty (0 bytes).',
      });
      return;
    }

    // Create fresh blob URL for the new file
    const blobUrl = URL.createObjectURL(file);
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    setVideoBlobUrl(blobUrl);
    _setVideoFile(file);

    setIncident(prev => ({
      ...prev,
      videoName: file.name,
      videoSize: sizeMb,
      videoObjectUrl: blobUrl,
      videoDuration: undefined,
      videoResolution: undefined,
      videoFps: undefined,
    }));

    // Start extraction
    extractionAbortRef.current = false;
    setExtraction({ status: 'extracting', progress: { current: 0, total: 0 }, error: null });

    try {
      const result = await extractFramesFromFile(
        file,
        undefined, // Uses adaptive sampling spanning 100% of video duration
        (progress) => {
          if (!extractionAbortRef.current) {
            setExtraction(prev => ({ ...prev, progress }));
          }
        }
      );

      if (extractionAbortRef.current) return;

      setVideoMeta(result.meta);
      setFrames(result.frames);
      setSelectedFrame(result.frames[0] ?? null);
      setExtraction({
        status: 'done',
        progress: { current: result.frames.length, total: result.frames.length },
        error: null,
      });

      setIncident(prev => ({
        ...prev,
        videoObjectUrl: blobUrl,
        videoDuration: result.meta.durationFormatted,
        videoResolution: result.meta.resolutionFormatted,
        videoFps: result.meta.fps ?? undefined,
      }));
    } catch (err) {
      if (extractionAbortRef.current) return;
      const msg = err instanceof Error ? err.message : 'Frame extraction failed';
      console.error('[AeroMesh] Frame extraction error:', err);
      // Fallback to demo frames so UI never remains blank on error
      const demo = getDemoFrames(incident.id);
      setFrames(demo);
      setSelectedFrame(demo[0] ?? null);
      setExtraction({ status: 'error', progress: { current: 0, total: 0 }, error: msg });
    }
  }, [incident.id]);

  /** Re-extract or reload frames for current incident */
  const reloadFrames = useCallback(() => {
    if (videoFile) {
      setVideoFile(videoFile);
    } else {
      const demo = getDemoFrames(incident.id);
      setFrames(demo);
      setSelectedFrame(demo[0] ?? null);
      setExtraction({
        status: 'done',
        progress: { current: demo.length, total: demo.length },
        error: null,
      });
    }
  }, [videoFile, incident.id, setVideoFile]);

  // ─── Markings ─────────────────────────────────────────────────────────────
  const addMarking = (newMarking: Omit<CustomMarking, 'id'>) => {
    const id = 'user-mark-' + Date.now();
    const created: CustomMarking = { ...newMarking, id, isSystem: false, visible: true };
    setMarkings(prev => {
      const updated = [...prev, created];
      if (incident?.id) {
        localStorage.setItem(`aeromesh_markings_${incident.id}`, JSON.stringify(updated));
      }
      return updated;
    });
    setFilters(prev => ({
      ...prev,
      customMarkings: { ...prev.customMarkings, [created.name]: true },
    }));

    // Synchronize to backend database
    if (incident?.id) {
      api.addMarking(incident.id, {
        name: created.name,
        type: created.type,
        color: created.color,
        description: created.description,
        position: created.position,
      }).catch(err => console.log('[AeroMesh API] Marking stored locally:', err));
    }
  };

  const deleteMarking = (id: string) => {
    const target = markings.find(m => m.id === id);
    // CRITICAL FIX: Never delete system-generated markings (Entry/Exit, Fire, Damage, etc.)
    // Only user-created custom markings can be deleted.
    if (target?.isSystem) {
      return;
    }
    setMarkings(prev => {
      const updated = prev.filter(m => m.id !== id);
      if (incident?.id) {
        localStorage.setItem(`aeromesh_markings_${incident.id}`, JSON.stringify(updated));
      }
      return updated;
    });
    if (target) {
      setFilters(prev => {
        const next = { ...prev.customMarkings };
        delete next[target.name];
        return { ...prev, customMarkings: next };
      });
    }

    // Synchronize deletion to backend database
    api.deleteMarking(id).catch(() => {});
  };

  const toggleMarkingVisibility = (id: string) => {
    const target = markings.find(m => m.id === id);
    if (!target) return;
    const nextVis = !target.visible;

    setMarkings(prev => {
      const updated = prev.map(m => (m.id === id ? { ...m, visible: nextVis } : m));
      if (incident?.id) {
        localStorage.setItem(`aeromesh_markings_${incident.id}`, JSON.stringify(updated));
      }
      return updated;
    });
    setFilters(f => ({
      ...f,
      customMarkings: { ...f.customMarkings, [target.name]: nextVis },
    }));

    api.updateMarkingVisibility(id, nextVis).catch(() => {});
  };

  /**
   * Move a user-created marking to a new 3D position.
   * System-generated markings are completely protected and cannot be moved.
   */
  const updateMarkingPosition = (id: string, position: [number, number, number]) => {
    setMarkings(prev => {
      const updated = prev.map(m => {
        if (m.id === id && !m.isSystem) {
          return { ...m, position };
        }
        return m;
      });
      if (incident?.id) {
        localStorage.setItem(`aeromesh_markings_${incident.id}`, JSON.stringify(updated));
      }
      return updated;
    });

    // Synchronize position to backend database
    api.updateMarkingPosition(id, position).catch(() => {});
  };

  // ─── Filters (Platform Layers) ────────────────────────────────────────────
  const setFilter = (key: keyof Omit<FilterState, 'customMarkings' | 'platformMarkingToggles'>, val: boolean) => {
    setFilters(prev => ({ ...prev, [key]: val }));
  };

  /** Toggle a single platform/system entity on or off by its id */
  const setPlatformMarkingFilter = useCallback((id: string, val: boolean) => {
    setFilters(prev => ({
      ...prev,
      platformMarkingToggles: { ...prev.platformMarkingToggles, [id]: val },
    }));
  }, []);

  /**
   * Independent Custom Markings Master Toggle.
   * Modifies ONLY custom markings master visibility.
   * NEVER alters or touches platform layer filters or platform detection markings.
   */
  const handleSetCustomMarkingsMaster = useCallback((val: boolean) => {
    setCustomMarkingsMaster(val);
  }, []);

  const setCustomMarkingFilter = (name: string, val: boolean) => {
    setFilters(prev => ({ ...prev, customMarkings: { ...prev.customMarkings, [name]: val } }));
    setMarkings(prev => {
      const updated = prev.map(m => (m.name === name ? { ...m, visible: val } : m));
      if (incident?.id) {
        localStorage.setItem(`aeromesh_markings_${incident.id}`, JSON.stringify(updated));
      }
      return updated;
    });
    const target = markings.find(m => m.name === name);
    if (target) {
      api.updateMarkingVisibility(target.id, val).catch(() => {});
    }
  };

  const resetFilters = () => {
    setFilters(defaultFilterState);
    setCustomMarkingsMaster(true);
    setMarkings(prev => prev.map(m => ({ ...m, visible: true })));
  };

  // ─── Incident helper ──────────────────────────────────────────────────────
  const createNewIncident = (data: Partial<Incident>): string => {
    // Generate fallback or optimistic ID
    const today = new Date();
    const yyyy = today.getFullYear();
    const randomSeq = String(Math.floor(Math.random() * 900000) + 100000);
    const newId = `AM-${yyyy}-${randomSeq}`;

    // A brand new analysis must ALWAYS start with zero custom markings
    setMarkings([]);
    setCustomMarkingsMaster(true);
    setFilters(prev => ({ ...prev, customMarkings: {} }));

    const newInc: Incident = {
      id: newId,
      name: data.name || 'Untitled Incident',
      location: data.location || 'Unknown Location',
      description: data.description || '',
      date: data.date || today.toISOString().split('T')[0],
      time: data.time || '10:00 AM',
      status: 'Pending',
      thumbnailUrl: '/assets/drone_bridge_aerial.jpg',
      videoName: data.videoName,
      videoSize: data.videoSize,
      videoObjectUrl: data.videoObjectUrl,
      stats: defaultIncidentStats,
      detectedConditions: {
        structuralDamage: false,
        fire: false,
        smoke: false,
        humanPresence: false,
        vehiclePresence: false,
        entryExit: false,
      },
      overallCondition: {
        level: 'UNKNOWN',
        title: 'Pending Assessment',
        description: 'Awaiting video analysis and photogrammetry reconstruction.',
      },
      keyObservations: [],
    };

    // Save to local context state immediately for responsive UI
    setIncident(newInc);
    setHistoryList(prev => [newInc, ...prev]);

    // Asynchronously register in backend database so unique ID & immutable timestamp are created
    api.createIncident({
      name: newInc.name,
      location: newInc.location,
      description: newInc.description,
    }).then(backendInc => {
      setIncident(backendInc);
      setHistoryList(prev => prev.map(item => item.id === newId ? backendInc : item));
    }).catch(err => {
      console.log('[AeroMesh API] Operating in offline mode:', err);
    });

    return newId;
  };

  return (
    <IncidentContext.Provider
      value={{
        incident,
        setIncident,
        historyIncidents: historyList,
        selectIncident,
        markings,
        addMarking,
        deleteMarking,
        toggleMarkingVisibility,
        updateMarkingPosition,
        customMarkingsMaster,
        setCustomMarkingsMaster: handleSetCustomMarkingsMaster,
        filters,
        setFilter,
        setCustomMarkingFilter,
        setPlatformMarkingFilter,
        resetFilters,
        stats,
        videoFile,
        videoBlobUrl,
        videoMeta,
        setVideoFile,
        frames,
        setFrames,
        selectedFrame,
        setSelectedFrame,
        reloadFrames,
        extraction,
        isReportModalOpen,
        reportIncident: reportTarget,
        openReport,
        closeReport,
        downloadReport,
        createNewIncident,
        refreshIncident,
        platformMarkings,
      }}
    >
      {children}
    </IncidentContext.Provider>
  );
};

export const useIncident = () => {
  const context = useContext(IncidentContext);
  if (!context) throw new Error('useIncident must be used within an IncidentProvider');
  return context;
};
