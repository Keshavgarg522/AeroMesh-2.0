import React, { useState, useCallback } from 'react';
import { Box, Film } from 'lucide-react';
import { useIncident } from '../context/IncidentContext';
import { BridgeViewer } from '../components/BridgeViewer';
import { DashboardFilters } from '../components/DashboardFilters';
import { CustomMarkingPanel } from '../components/CustomMarkingPanel';
import { DashboardStats } from '../components/DashboardStats';
import { VideoFramesTab } from '../components/VideoFramesTab';
import type { PendingMarkingData, MarkingType } from '../types';

type DashboardTab = '3d' | 'frames';

export const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('3d');
  const {
    incident,
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
  } = useIncident();



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
                onToggleCustomMarking={setCustomMarkingFilter}
                onReset={resetFilters}
                markings={markings}
              />

              <div className="flex-1 min-w-0 h-full relative p-2 bg-[#050811]">
                <BridgeViewer
                  filters={filters}
                  markings={markings}
                  placementMode={placementMode}
                  pendingColor={pendingColor}
                  onPlacementConfirm={handlePlacementConfirm}
                  onCancelPlacement={handleCancelPlacement}
                  incidentId={incident.id}
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
