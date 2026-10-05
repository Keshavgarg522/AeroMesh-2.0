import React, { useState } from 'react';
import {
  Filter, Box, LogIn, Users, Car, Flame, AlertTriangle,
  ChevronDown, ChevronUp, MapPin, Eye, EyeOff,
  Anchor, Mountain as MountainIcon, Droplets, Home,
  ArrowRight, Layers,
} from 'lucide-react';
import type { FilterState, CustomMarking } from '../types';

interface DashboardFiltersProps {
  filters: FilterState;
  onToggleFilter: (key: keyof Omit<FilterState, 'customMarkings' | 'platformMarkingToggles'>, val: boolean) => void;
  customMarkingsMaster: boolean;
  onToggleCustomMarkingsMaster: (val: boolean) => void;
  onToggleCustomMarking: (name: string, val: boolean) => void;
  onTogglePlatformMarking: (id: string, val: boolean) => void;
  onReset: () => void;
  markings: CustomMarking[];
  platformMarkings: CustomMarking[];
}

// ── Toggle Switch Component ────────────────────────────────────────────────
const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: 'sm' | 'xs';
  color?: string;
}> = ({ checked, onChange, size = 'sm', color }) => {
  const trackSm = 'w-9 h-5';
  const trackXs = 'w-7 h-4';
  const thumbSm = 'after:h-4 after:w-4 after:top-[2px] after:left-[2px]';
  const thumbXs = 'after:h-3 after:w-3 after:top-[2px] after:left-[1px]';
  const track = size === 'sm' ? trackSm : trackXs;
  const thumb = size === 'sm' ? thumbSm : thumbXs;
  const activeColor = color
    ? ''
    : 'peer-checked:bg-blue-600';

  return (
    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div
        className={`${track} bg-[#132142] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:bg-white after:border-gray-300 after:border after:rounded-full after:transition-all ${activeColor} shadow-inner ${thumb}`}
        style={color && checked ? { backgroundColor: color } : undefined}
      />
    </label>
  );
};

// ── Category header with icon + toggle + count badge ──────────────────────
const CategoryRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  count: number;
  checked: boolean;
  onToggle: (v: boolean) => void;
  expanded: boolean;
  onExpand: () => void;
  color: string;
  hasEntities: boolean;
}> = ({ icon, label, count, checked, onToggle, expanded, onExpand, color, hasEntities }) => (
  <div
    className="flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-white/[0.03] transition-colors group"
  >
    {/* Expand / collapse sub-entities arrow (only if has sub-entities) */}
    <button
      type="button"
      onClick={onExpand}
      className={`w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0 ${!hasEntities ? 'invisible' : ''}`}
    >
      {expanded
        ? <ChevronUp className="w-3 h-3" />
        : <ChevronDown className="w-3 h-3" />}
    </button>

    {/* Icon */}
    <span className="flex-shrink-0">{icon}</span>

    {/* Label */}
    <span className="flex-1 text-xs text-slate-200 font-medium truncate">{label}</span>

    {/* Count badge */}
    {count > 0 && (
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: `${color}25`, color }}
      >
        {count}
      </span>
    )}

    {/* Toggle */}
    <Toggle checked={checked} onChange={onToggle} size="sm" />
  </div>
);

// ── Individual entity row ──────────────────────────────────────────────────
const EntityRow: React.FC<{
  marking: CustomMarking;
  checked: boolean;
  onToggle: (v: boolean) => void;
  categoryOn: boolean;
}> = ({ marking, checked, onToggle, categoryOn }) => {
  const effectivelyVisible = categoryOn && checked;
  return (
    <div className="flex items-center gap-2 py-1 px-1 ml-6 rounded-md hover:bg-white/[0.02] transition-colors">
      {/* Color dot */}
      <span
        className="w-2 h-2 rounded-full flex-shrink-0 ring-1 ring-black/30"
        style={{ backgroundColor: marking.color }}
      />

      {/* Name */}
      <span
        className={`flex-1 text-[11px] truncate max-w-[110px] transition-colors ${
          effectivelyVisible ? 'text-slate-300' : 'text-slate-600 line-through'
        }`}
        title={marking.name}
      >
        {marking.name}
      </span>

      {/* Eye icon */}
      <span className="flex-shrink-0 text-slate-600">
        {effectivelyVisible
          ? <Eye className="w-3 h-3 text-slate-500" />
          : <EyeOff className="w-3 h-3 text-slate-700" />}
      </span>

      {/* Individual toggle */}
      <Toggle checked={checked} onChange={onToggle} size="xs" color={marking.color} />
    </div>
  );
};

// ── Custom marking icon helper ────────────────────────────────────────────
function getCustomIcon(iconType?: string, name?: string) {
  const t = (iconType || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (t === 'fire' || n.includes('fire')) return <Flame className="w-3.5 h-3.5 text-rose-400" />;
  if (t === 'warning' || n.includes('damage')) return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
  if (t === 'shelter' || n.includes('shelter')) return <Home className="w-3.5 h-3.5 text-purple-400" />;
  if (t === 'mountain' || n.includes('mountain')) return <MountainIcon className="w-3.5 h-3.5 text-green-400" />;
  if (t === 'water' || n.includes('water')) return <Droplets className="w-3.5 h-3.5 text-blue-400" />;
  if (t === 'boat' || n.includes('boat')) return <Anchor className="w-3.5 h-3.5 text-cyan-400" />;
  if (n.includes('entry') || n.includes('exit')) return <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />;
  return <MapPin className="w-3.5 h-3.5 text-cyan-400" />;
}

// ── Main Component ─────────────────────────────────────────────────────────
export const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  filters,
  onToggleFilter,
  customMarkingsMaster,
  onToggleCustomMarkingsMaster,
  onToggleCustomMarking,
  onTogglePlatformMarking,
  onReset,
  markings,
  platformMarkings,
}) => {
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    humans: false,
    vehicles: false,
    fireSmoke: false,
    damage: false,
    entryExit: false,
    custom: true,
  });
  const toggleCat = (cat: string) =>
    setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));

  // Bucket platform markings into categories
  const byCategory = (cat: CustomMarking['category']) =>
    platformMarkings.filter(m => m.category === cat);

  const humanEntities   = byCategory('humans');
  const vehicleEntities = byCategory('vehicles');
  const fireEntities    = byCategory('fireSmoke');
  const damageEntities  = byCategory('damage');
  const entryExitEntities = byCategory('entryExit');

  const userMarkings = markings.filter(m => !m.isSystem);

  // Per-entity visibility helper (defaults to true when not in toggles map)
  const isPlatformEntityOn = (id: string) =>
    filters.platformMarkingToggles[id] !== false;

  return (
    <div className="w-64 h-full bg-[#050c1f]/95 backdrop-blur-md border-r border-[#0f244a] flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#132244] flex-shrink-0">
        <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>Entity Control</span>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
        >
          Reset All
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 custom-scroll">

        {/* ─── 3D Reconstruction ─── */}
        <div className="flex items-center gap-2 py-1.5 px-1">
          <span className="w-4 flex-shrink-0" />
          <Box className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span className="flex-1 text-xs text-slate-200 font-medium">3D Reconstruction</span>
          <Toggle
            checked={filters.reconstruction3D}
            onChange={(v) => onToggleFilter('reconstruction3D', v)}
          />
        </div>

        <div className="h-px bg-[#132244] mx-1 my-1.5" />

        {/* ─── Detection Layer Header ─── */}
        <div className="px-2 py-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            AI Detection Layers
          </span>
        </div>

        {/* ── Entry / Exit ── */}
        <CategoryRow
          icon={<LogIn className="w-4 h-4 text-emerald-400" />}
          label="Entry / Exit Points"
          count={entryExitEntities.length}
          checked={filters.entryExit}
          onToggle={(v) => onToggleFilter('entryExit', v)}
          expanded={expandedCats.entryExit}
          onExpand={() => toggleCat('entryExit')}
          color="#10b981"
          hasEntities={entryExitEntities.length > 0}
        />
        {expandedCats.entryExit && entryExitEntities.map(mk => (
          <EntityRow
            key={mk.id}
            marking={mk}
            checked={isPlatformEntityOn(mk.id)}
            onToggle={(v) => onTogglePlatformMarking(mk.id, v)}
            categoryOn={filters.entryExit}
          />
        ))}

        {/* ── Humans ── */}
        <CategoryRow
          icon={<Users className="w-4 h-4 text-blue-400" />}
          label="Humans"
          count={humanEntities.length}
          checked={filters.humans}
          onToggle={(v) => onToggleFilter('humans', v)}
          expanded={expandedCats.humans}
          onExpand={() => toggleCat('humans')}
          color="#3b82f6"
          hasEntities={humanEntities.length > 0}
        />
        {expandedCats.humans && humanEntities.map(mk => (
          <EntityRow
            key={mk.id}
            marking={mk}
            checked={isPlatformEntityOn(mk.id)}
            onToggle={(v) => onTogglePlatformMarking(mk.id, v)}
            categoryOn={filters.humans}
          />
        ))}

        {/* ── Vehicles ── */}
        <CategoryRow
          icon={<Car className="w-4 h-4 text-violet-400" />}
          label="Vehicles"
          count={vehicleEntities.length}
          checked={filters.vehicles}
          onToggle={(v) => onToggleFilter('vehicles', v)}
          expanded={expandedCats.vehicles}
          onExpand={() => toggleCat('vehicles')}
          color="#8b5cf6"
          hasEntities={vehicleEntities.length > 0}
        />
        {expandedCats.vehicles && vehicleEntities.map(mk => (
          <EntityRow
            key={mk.id}
            marking={mk}
            checked={isPlatformEntityOn(mk.id)}
            onToggle={(v) => onTogglePlatformMarking(mk.id, v)}
            categoryOn={filters.vehicles}
          />
        ))}

        {/* ── Fire & Smoke ── */}
        <CategoryRow
          icon={<Flame className="w-4 h-4 text-rose-500" />}
          label="Fire & Smoke"
          count={fireEntities.length}
          checked={filters.fireSmoke}
          onToggle={(v) => onToggleFilter('fireSmoke', v)}
          expanded={expandedCats.fireSmoke}
          onExpand={() => toggleCat('fireSmoke')}
          color="#ef4444"
          hasEntities={fireEntities.length > 0}
        />
        {expandedCats.fireSmoke && fireEntities.map(mk => (
          <EntityRow
            key={mk.id}
            marking={mk}
            checked={isPlatformEntityOn(mk.id)}
            onToggle={(v) => onTogglePlatformMarking(mk.id, v)}
            categoryOn={filters.fireSmoke}
          />
        ))}

        {/* ── Damage ── */}
        <CategoryRow
          icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
          label="Structural Damage"
          count={damageEntities.length}
          checked={filters.damage}
          onToggle={(v) => onToggleFilter('damage', v)}
          expanded={expandedCats.damage}
          onExpand={() => toggleCat('damage')}
          color="#f59e0b"
          hasEntities={damageEntities.length > 0}
        />
        {expandedCats.damage && damageEntities.map(mk => (
          <EntityRow
            key={mk.id}
            marking={mk}
            checked={isPlatformEntityOn(mk.id)}
            onToggle={(v) => onTogglePlatformMarking(mk.id, v)}
            categoryOn={filters.damage}
          />
        ))}

        <div className="h-px bg-[#132244] mx-1 my-1.5" />

        {/* ─── Custom Markings ─── */}
        <div className="flex items-center gap-1 py-1 px-1">
          <button
            type="button"
            onClick={() => toggleCat('custom')}
            className="flex items-center gap-2 flex-1 text-left"
          >
            <span className={`text-slate-500 transition-transform ${expandedCats.custom ? '' : '-rotate-90'}`}>
              <ChevronDown className="w-3 h-3" />
            </span>
            <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span className="flex-1 text-xs font-bold text-slate-300 uppercase tracking-wider">
              Custom Markings
            </span>
            {userMarkings.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-400/15 text-cyan-400">
                {userMarkings.length}
              </span>
            )}
          </button>

          {/* Master ON/OFF toggle */}
          <label
            className="relative inline-flex items-center cursor-pointer flex-shrink-0"
            title={customMarkingsMaster ? 'Hide all custom markings' : 'Show all custom markings'}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={customMarkingsMaster}
              onChange={(e) => {
                e.stopPropagation();
                onToggleCustomMarkingsMaster(e.target.checked);
              }}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-[#132142] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 shadow-inner" />
          </label>
        </div>

        {expandedCats.custom && (
          <div className="space-y-0.5 pb-1">
            {userMarkings.length === 0 ? (
              <p className="text-[10px] text-slate-600 italic px-8 py-1">No custom markings placed</p>
            ) : (
              userMarkings.map(m => {
                const isChecked = filters.customMarkings[m.name] !== false && m.visible !== false;
                return (
                  <div key={m.id} className="flex items-center gap-2 py-1 px-1 ml-6 rounded-md hover:bg-white/[0.02]">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0 ring-1 ring-black/30"
                      style={{ backgroundColor: m.color }}
                    />
                    <span className={`flex-1 text-[11px] truncate max-w-[110px] ${
                      customMarkingsMaster && isChecked ? 'text-slate-300' : 'text-slate-600 line-through'
                    }`}>
                      {m.name}
                    </span>
                    <span className="flex-shrink-0">
                      {getCustomIcon(m.iconType, m.name)}
                    </span>
                    <Toggle
                      checked={isChecked}
                      onChange={(v) => onToggleCustomMarking(m.name, v)}
                      size="xs"
                      color={m.color}
                    />
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>

      {/* ── Footer: Labels toggle ── */}
      <div className="flex-shrink-0 border-t border-[#132244] px-3.5 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Filter className="w-3.5 h-3.5" />
          <span>Show Labels</span>
        </div>
        <Toggle
          checked={filters.labels}
          onChange={(v) => onToggleFilter('labels', v)}
          size="sm"
        />
      </div>
    </div>
  );
};
