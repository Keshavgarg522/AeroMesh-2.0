import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Box, Film } from 'lucide-react';
import { useIncident } from '../context/IncidentContext';
import { BridgeViewer } from '../components/BridgeViewer';
import { DashboardFilters } from '../components/DashboardFilters';
import { CustomMarkingPanel } from '../components/CustomMarkingPanel';
import { DashboardStats } from '../components/DashboardStats';
import { VideoFramesTab } from '../components/VideoFramesTab';
import { api } from '../services/api';
import type { PendingMarkingData, MarkingType } from '../types';

type DashboardTab = '3d' | 'frames';

// Analysis statuses that indicate the pipeline is still running
const ACTIVE_ANALYSIS_STATUSES = new Set([
  'EXTRACTING_FRAMES', 'DETECTING_ENTITIES', 'TRACKING',
  'RECONSTRUCTING_3D', 'MAPPING_3D_ANNOTATIONS', 'GENERATING_REPORT',
  'In Progress', 'Processing', 'QUEUED',
]);

export const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('3d');
  const {
    incident,
    markings,
    addMarking,
    deleteMarking,
    toggleMarkingVisibility,
    updateMarkingPosition,
    customMarkingsMaster,
    setCustomMarkingsMaster,
    filters,
    setFilter,
    setCustomMarkingFilter,
    setPlatformMarkingFilter,
    resetFilters,
    stats,
    platformMarkings,
    refreshIncident,
  } = useIncident();

  // ── Analysis Status Polling ────────────────────────────────────────────────
  // When an analysis is running in the background, poll every 3s.
  // On completion, refresh the incident to get real stats and annotations.
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const isActive = ACTIVE_ANALYSIS_STATUSES.has(incident.status);

    const stopPolling = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    if (!isActive) {
      stopPolling();
      return;
    }

    // Start polling
    if (pollTimerRef.current) return; // already polling

    pollTimerRef.current = setInterval(async () => {
      try {
        const jobStatus = await api.getJobStatus(incident.id);
        if (jobStatus.completed || !ACTIVE_ANALYSIS_STATUSES.has(jobStatus.status)) {
          // Analysis finished — refresh to get real stats + annotations
          stopPolling();
          await refreshIncident(incident.id);
        }
      } catch {
        // Backend offline — stop polling to avoid repeated errors
        stopPolling();
      }
    }, 3000);

    return stopPolling;
  }, [incident.id, incident.status, refreshIncident]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // ── Placement workflow state ──────────────────────────────────────────────
  /** Form data collected from the panel, waiting for a location click */
  const [pendingMarking, setPendingMarking] = useState<PendingMarkingData | null>(null);
  /** ID of a marking being repositioned (Move button) */
  const [repositioningId, setRepositioningId] = useState<string | null>(null);

  /** Derived: are we in placement mode? */
  const placementMode = pendingMarking !== null || repositioningId !== null;

  /** Color to show on the ghost marker — comes from pending form data or the marking being moved */
  const pendingColor = pendingMarking
    ? pendingMarking.color
    : repositioningId
      ? markings.find(m => m.id === repositioningId)?.color ?? '#f59e0b'
      : '#f59e0b';

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** Step 1: User filled out the form and clicked "Place on Map →" */
  const handleRequestPlacement = useCallback((data: PendingMarkingData) => {
    setRepositioningId(null); // clear any previous reposition
    setPendingMarking(data);
  }, []);

  /** Step 1b: User clicked "Move" on an existing marking */
  const handleRequestReposition = useCallback((id: string) => {
    setPendingMarking(null); // clear any pending new marking
    setRepositioningId(id);
  }, []);

  /** Step 2: User clicked on the 3D scene — place or move the marking */
  const handlePlacementConfirm = useCallback((position: [number, number, number]) => {
    if (pendingMarking) {
      // Creating a NEW custom marking at the clicked position
      addMarking({
        name: pendingMarking.name,
        type: (pendingMarking.type as MarkingType) || 'Custom',
        color: pendingMarking.color,
        description: pendingMarking.description,
        visible: true,
        position,
        iconType: pendingMarking.type === 'Hazard' ? 'fire' : pendingMarking.type === 'Damage' ? 'warning' : 'pin',
      });
      setPendingMarking(null);
    } else if (repositioningId) {
      // Moving an EXISTING marking to the new position
      updateMarkingPosition(repositioningId, position);
      setRepositioningId(null);
    }
  }, [pendingMarking, repositioningId, addMarking, updateMarkingPosition]);

  /** Cancel button or ESC key */
  const handleCancelPlacement = useCallback(() => {
    setPendingMarking(null);
    setRepositioningId(null);
  }, []);

  const modelUrl = useMemo(() => {
    return api.getModelUrl(incident.reconstruction_glb_url) || (incident.id ? `http://localhost:8000/storage/models/${incident.id}.glb` : null);
  }, [incident.reconstruction_glb_url, incident.id]);

  return (
    <div className="h-[calc(100vh-64px)] w-full bg-[#050811] text-slate-100 flex flex-col overflow-hidden">
      <div className="h-11 bg-[#060a16] border-b border-[#121f3d] px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('3d')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === '3d'
                ? 'bg-[#0f1d3c] border border-cyan-400/60 text-cyan-300 shadow-[0_0_12px_rgba(0,210,255,0.25)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#0a1226]'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D Model View</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('frames')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'frames'
                ? 'bg-[#0f1d3c] border border-cyan-400/60 text-cyan-300 shadow-[0_0_12px_rgba(0,210,255,0.25)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#0a1226]'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Video Frames</span>
          </button>
        </div>

        {/* Incident Info */}
          <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
            {incident.id} · AeroMesh Engine v2.4
          </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {activeTab === '3d' ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 flex min-h-0">
              <DashboardFilters
                filters={filters}
                onToggleFilter={setFilter}
                customMarkingsMaster={customMarkingsMaster}
                onToggleCustomMarkingsMaster={setCustomMarkingsMaster}
                onToggleCustomMarking={setCustomMarkingFilter}
                onTogglePlatformMarking={setPlatformMarkingFilter}
                onReset={resetFilters}
                markings={markings}
                platformMarkings={platformMarkings}
              />

              <div className="flex-1 min-w-0 h-full relative p-2 bg-[#050811]">
                <BridgeViewer
                  filters={filters}
                  customMarkingsMaster={customMarkingsMaster}
                  markings={markings}
                  platformMarkings={platformMarkings}
                  placementMode={placementMode}
                  pendingColor={pendingColor}
                  onPlacementConfirm={handlePlacementConfirm}
                  onCancelPlacement={handleCancelPlacement}
                  incidentId={incident.id}
                  modelUrl={modelUrl}
                />
              </div>

              <CustomMarkingPanel
                markings={markings}
                onAddMarking={addMarking}
                onDeleteMarking={deleteMarking}
                onToggleVisibility={toggleMarkingVisibility}
                onRequestPlacement={handleRequestPlacement}
                onRequestReposition={handleRequestReposition}
                onCancelPlacement={handleCancelPlacement}
                placementMode={placementMode}
                repositioningId={repositioningId}
              />
            </div>
            <div className="flex-shrink-0">
              <DashboardStats stats={stats} />
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden">
            <VideoFramesTab />
          </div>
        )}
      </div>
    </div>
  );
};
