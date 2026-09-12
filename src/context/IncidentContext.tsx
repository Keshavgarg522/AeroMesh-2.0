import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { Incident, CustomMarking, FilterState, IncidentStats, VideoFrame, VideoMeta } from '../types';
import { initialIncident, historyIncidents as defaultHistory, defaultMarkings, defaultFilterState, defaultIncidentStats } from '../data/mockData';
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

  // Filters
  filters: FilterState;
  setFilter: (key: keyof Omit<FilterState, 'customMarkings'>, val: boolean) => void;
  setCustomMarkingFilter: (name: string, val: boolean) => void;
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

// Initial demo frames so frames load immediately on first visit
const initialDemoFrames = getDemoFrames(initialIncident.id);

// ─── Provider ────────────────────────────────────────────────────────────────
export const IncidentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [incident, setIncident] = useState<Incident>(initialIncident);
  const [historyList, setHistoryList] = useState<Incident[]>(defaultHistory);
  const [markings, setMarkings] = useState<CustomMarking[]>(defaultMarkings);
  const [filters, setFilters] = useState<FilterState>(defaultFilterState);
  const [stats, setStats] = useState<IncidentStats>(initialIncident.stats || defaultIncidentStats);

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
  const [frames, setFrames] = useState<VideoFrame[]>(initialDemoFrames);
  const [selectedFrame, setSelectedFrame] = useState<VideoFrame | null>(initialDemoFrames[0] ?? null);
  const [extraction, setExtraction] = useState<ExtractionState>({
    status: 'done',
    progress: { current: initialDemoFrames.length, total: initialDemoFrames.length },
    error: null,
  });

  // Report Modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [reportTarget, setReportTarget] = useState<Incident>(initialIncident);

  // Track active extraction aborts
  const extractionAbortRef = useRef<boolean>(false);

  // Fetch real incidents from backend on mount
  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const backendIncidents = await api.listIncidents();
        if (backendIncidents && backendIncidents.length > 0) {
          setHistoryList(backendIncidents);
          setIncident(backendIncidents[0]);
          if (backendIncidents[0].stats) setStats(backendIncidents[0].stats);
        }
      } catch (err) {
        // Graceful fallback to initial mock data if backend not yet running
        console.log('[AeroMesh API] Initializing with local data:', err);
      }
    };
    fetchIncidents();
  }, []);

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

  /** Refresh incident from backend API */
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
        return fresh;
      }
    } catch (err) {
      console.warn('[AeroMesh API] Failed to refresh incident:', err);
    }
    return null;
  }, []);

  /** Select an incident from history */
  const selectIncident = useCallback(async (id: string) => {
    const found = historyList.find(item => item.id === id);
    if (found) {
      setIncident(found);
      if (found.stats) setStats(found.stats);
    }

    try {
      const fresh = await api.getIncident(id);
      if (fresh) {
        setIncident(fresh);
        if (fresh.stats) setStats(fresh.stats);
      }
    } catch {
      // offline fallback
    }

    // Load corresponding frames & video
    const newDemoFrames = getDemoFrames(found?.id || id);
    setFrames(newDemoFrames);
    setSelectedFrame(newDemoFrames[0] ?? null);
    setVideoBlobUrl(found?.videoObjectUrl || '/assets/drone_sample.mp4');
    setVideoMeta({
      duration: 53.9,
      durationFormatted: found?.videoDuration || '00:53',
      width: 1920,
      height: 1080,
      resolutionFormatted: found?.videoResolution || '1920 × 1080',
      fps: found?.videoFps || 12,
    });
    setExtraction({
      status: 'done',
      progress: { current: newDemoFrames.length, total: newDemoFrames.length },
      error: null,
    });
  }, [historyList]);


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
        24,
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
    const created: CustomMarking = { ...newMarking, id, isSystem: false };
    setMarkings(prev => [...prev, created]);
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
    setMarkings(prev => prev.filter(m => m.id !== id));
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
    setMarkings(prev =>
      prev.map(m => {
        if (m.id === id) {
          const updated = { ...m, visible: !m.visible };
          setFilters(f => ({
            ...f,
            customMarkings: { ...f.customMarkings, [m.name]: updated.visible },
          }));
          return updated;
        }
        return m;
      })
    );
  };

  /**
   * Move a user-created marking to a new 3D position.
   * System-generated markings are completely protected and cannot be moved.
   */
  const updateMarkingPosition = (id: string, position: [number, number, number]) => {
    setMarkings(prev =>
      prev.map(m => {
        if (m.id === id && !m.isSystem) {
          return { ...m, position };
        }
        return m;
      })
    );

    // Synchronize position to backend database
    api.updateMarkingPosition(id, position).catch(() => {});
  };

  // ─── Filters ──────────────────────────────────────────────────────────────
  const setFilter = (key: keyof Omit<FilterState, 'customMarkings'>, val: boolean) => {
    setFilters(prev => ({ ...prev, [key]: val }));
  };

  const setCustomMarkingFilter = (name: string, val: boolean) => {
    setFilters(prev => ({ ...prev, customMarkings: { ...prev.customMarkings, [name]: val } }));
    setMarkings(prev => prev.map(m => (m.name === name ? { ...m, visible: val } : m)));
  };

  const resetFilters = () => {
    setFilters(defaultFilterState);
    setMarkings(prev => {
      const userCustom = prev.filter(m => !m.isSystem);
      return [...defaultMarkings, ...userCustom];
    });
  };

  // ─── Incident helper ──────────────────────────────────────────────────────
  const createNewIncident = (data: Partial<Incident>): string => {
    // Generate fallback or optimistic ID
    const today = new Date();
    const yyyy = today.getFullYear();
    const randomSeq = String(Math.floor(Math.random() * 900000) + 100000);
    const newId = `AM-${yyyy}-${randomSeq}`;

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
        filters,
        setFilter,
        setCustomMarkingFilter,
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
