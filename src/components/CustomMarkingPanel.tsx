import React, { useState } from 'react';
import { MapPin, Eye, EyeOff, Trash2, ChevronDown, ChevronUp, Move, Loader2 } from 'lucide-react';
import type { CustomMarking, MarkingType, PendingMarkingData } from '../types';

interface CustomMarkingPanelProps {
  markings: CustomMarking[];
  onAddMarking?: (marking: Omit<CustomMarking, 'id'>) => void;
  onDeleteMarking: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  /** Requests the DashboardPage to enter placement mode with the given form data */
  onRequestPlacement?: (data: PendingMarkingData) => void;
  /** Requests reposition mode for an existing marking */
  onRequestReposition?: (id: string) => void;
  /** Cancels the current placement / reposition mode */
  onCancelPlacement?: () => void;
  /** True when the viewer is waiting for a placement click */
  placementMode?: boolean;
  /** ID of the marking being repositioned (if any) */
  repositioningId?: string | null;
}

export const CustomMarkingPanel: React.FC<CustomMarkingPanelProps> = ({
  markings,
  onAddMarking: _onAddMarking,
  onDeleteMarking,
  onToggleVisibility,
  onRequestPlacement,
  onRequestReposition,
  onCancelPlacement,
  placementMode = false,
  repositioningId = null,
}) => {
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<MarkingType | ''>('');
  const [color, setColor] = useState<string>('#f59e0b');
  const [description, setDescription] = useState<string>('');
  const [isAddExpanded, setIsAddExpanded] = useState<boolean>(true);

  const colors = [
    { label: 'Yellow', value: '#f59e0b' },
    { label: 'Green', value: '#10b981' },
    { label: 'Cyan', value: '#00d2ff' },
    { label: 'Blue', value: '#2563eb' },
    { label: 'Purple', value: '#a855f7' },
  ];

  const handleRequestPlace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Send form data to DashboardPage — it will enter placement mode
    onRequestPlacement?.({
      name: name.trim(),
      type: (type as MarkingType) || 'Custom',
      color,
      description: description.trim(),
    });

    // Clear form after sending
    setName('');
    setType('');
    setDescription('');
  };

  return (
    <div className="w-72 h-full bg-[#050c1f]/95 backdrop-blur-md border-l border-[#0f244a] p-3.5 flex flex-col justify-between overflow-y-auto">
      <div className="space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#132244]">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span>Add Custom Marking</span>
          </div>
          <button
            type="button"
            onClick={() => setIsAddExpanded(!isAddExpanded)}
            className="text-slate-400 hover:text-white"
          >
            {isAddExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* ── Placement-In-Progress Banner ── */}
        {placementMode && !repositioningId && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-400/40 animate-pulse">
            <div className="flex items-center gap-2 mb-1.5">
              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span className="text-[11px] font-bold text-amber-300">Waiting for map click…</span>
            </div>
            <p className="text-[10px] text-amber-400/70 mb-2">
              Click anywhere on the 3D scene to place your marking. Press ESC to cancel.
            </p>
            <button
              type="button"
              onClick={() => onCancelPlacement?.()}
              className="w-full py-1.5 rounded-md bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 text-[11px] font-semibold transition-colors border border-amber-400/30"
            >
              Cancel Placement
            </button>
          </div>
        )}

        {/* ── Repositioning Banner ── */}
        {placementMode && repositioningId && (
          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-400/40 animate-pulse">
            <div className="flex items-center gap-2 mb-1.5">
              <Move className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[11px] font-bold text-purple-300">Moving marking…</span>
            </div>
            <p className="text-[10px] text-purple-400/70 mb-2">
              Click a new location on the 3D scene. Press ESC to cancel.
            </p>
            <button
              type="button"
              onClick={() => onCancelPlacement?.()}
              className="w-full py-1.5 rounded-md bg-purple-400/15 hover:bg-purple-400/25 text-purple-300 text-[11px] font-semibold transition-colors border border-purple-400/30"
            >
              Cancel Move
            </button>
          </div>
        )}

        {/* Add Marking Form — hidden during placement */}
        {isAddExpanded && !placementMode && (
          <form onSubmit={handleRequestPlace} className="space-y-3">
            {/* Marking Name */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300">
                Marking Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Temporary Shelter"
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0a1326] border border-[#1b2f5b] focus:border-cyan-400 text-xs text-white focus:outline-none"
              />
            </div>

            {/* Marking Type */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300">
                Marking Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as MarkingType)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0a1326] border border-[#1b2f5b] focus:border-cyan-400 text-xs text-slate-200 focus:outline-none"
              >
                <option value="">Select Type</option>
                <option value="Entry Point">Entry Point</option>
                <option value="Damage">Damage</option>
                <option value="Temporary shelter">Temporary shelter</option>
                <option value="Hazard">Hazard</option>
                <option value="Landmark">Landmark</option>
                <option value="Water">Water</option>
                <option value="Custom">Custom</option>
              </select>
            </div>

            {/* Color Swatches */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300">
                Color
              </label>
              <div className="flex items-center gap-2">
                {colors.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`w-5 h-5 rounded-full transition-transform ${
                      color === c.value ? 'scale-125 ring-2 ring-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300">
                Description (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add description..."
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0a1326] border border-[#1b2f5b] focus:border-cyan-400 text-xs text-white focus:outline-none"
              />
            </div>

            {/* Submit — triggers placement mode, NOT instant add */}
            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 disabled:from-amber-800 disabled:to-orange-800 text-white font-semibold text-xs transition-all shadow-[0_0_16px_rgba(245,158,11,0.3)] flex items-center justify-center gap-1.5"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Place on Map →</span>
            </button>
          </form>
        )}

        {/* Saved Markings List — User-Created Only */}
        <div className="pt-2 border-t border-[#132244]">
          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            My Custom Markings
          </h4>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {markings.filter(m => !m.isSystem).length === 0 && (
              <p className="text-[11px] text-slate-600 italic text-center py-3">
                No custom markings yet.
              </p>
            )}
            {markings
              .filter(m => !m.isSystem)
              .map((m) => (
              <div
                key={m.id}
                className={`p-2 rounded-lg bg-[#0a1326] border flex items-center justify-between group transition-colors ${
                  repositioningId === m.id
                    ? 'border-purple-400/60 bg-purple-500/10'
                    : 'border-[#172a54] hover:border-cyan-500/40'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span 
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: m.color }}
                  />
                  <div className="truncate">
                    <p className="text-xs font-semibold text-slate-200 truncate">{m.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{m.type}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleVisibility(m.id)}
                    className="p-1 text-slate-400 hover:text-cyan-400 transition-colors"
                    title={m.visible ? 'Hide marking' : 'Show marking'}
                  >
                    {m.visible ? <Eye className="w-3.5 h-3.5 text-cyan-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-600" />}
                  </button>

                  {/* Move / Reposition button */}
                  <button
                    type="button"
                    onClick={() => onRequestReposition?.(m.id)}
                    disabled={placementMode}
                    className="p-1 text-slate-400 hover:text-purple-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Move to new location"
                  >
                    <Move className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteMarking(m.id)}
                    disabled={placementMode}
                    className="p-1 text-slate-400 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Delete custom marking"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
