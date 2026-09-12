import React from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  ArrowRight,
  Clock,
  Box,
  Crosshair,
  BarChart3,
  Sparkles,
  Cpu,
  Layers,
  CheckCircle2,
  Video,
  FileCode2
} from 'lucide-react';
import { BuildingViewer } from '../components/BuildingViewer';

export const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#020712] text-slate-100 flex flex-col relative overflow-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Background Cybernetic Grid & Atmospheric Lighting */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.14]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(0, 210, 255, 0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 210, 255, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 85% 70% at 50% 30%, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 85% 70% at 50% 30%, black 30%, transparent 80%)',
        }}
      />

      {/* Atmospheric Aerial Night Backdrop with Seamless Radial Dissolve */}
      <div 
        className="absolute top-0 right-0 w-full lg:w-[68%] h-[720px] pointer-events-none overflow-hidden opacity-25 mix-blend-screen"
        style={{
          maskImage: 'radial-gradient(ellipse 80% 65% at 75% 35%, black 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 65% at 75% 35%, black 20%, transparent 75%)',
        }}
      >
        <img
          src="/assets/night_aerial_city.jpg"
          alt="Aerial Night City Backdrop"
          className="w-full h-full object-cover object-center filter blur-[1.5px] scale-105"
        />
      </div>

      {/* Deep Volumetric Ambient Glows */}
      <div className="absolute top-[8%] right-[18%] w-[640px] h-[640px] bg-blue-600/18 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute top-[14%] right-[32%] w-[480px] h-[480px] bg-cyan-500/15 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute top-32 left-4 w-[420px] h-[420px] bg-indigo-600/12 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[25%] left-[20%] w-[380px] h-[380px] bg-sky-500/10 blur-[130px] rounded-full pointer-events-none" />

      {/* ========================================================================= */}
      {/* HERO SECTION */}
      {/* ========================================================================= */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16 lg:pt-14 lg:pb-24 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Left Hero Column */}
          <div className="lg:col-span-6 z-10 flex flex-col justify-center space-y-7">
            
            {/* Live Platform Badge */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#081736]/80 border border-cyan-500/30 text-cyan-300 text-xs font-semibold backdrop-blur-md shadow-[0_0_20px_rgba(0,210,255,0.15)] w-fit">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
              </span>
              <span className="tracking-wide font-mono text-[11px] uppercase">
                AI Drone Photogrammetry Engine
              </span>
              <span className="text-cyan-500/50">|</span>
              <span className="text-slate-400 text-[11px]">v2.4 Ready</span>
            </div>

            {/* Brand Title & Hero Headline */}
            <div className="space-y-3">
              <div className="text-xs font-bold tracking-[0.3em] uppercase text-slate-400 flex items-center gap-2 font-mono">
                <span className="w-6 h-[1.5px] bg-cyan-400" />
                <span>FROM SKY TO STRUCTURE</span>
              </div>

              <h1 className="text-4xl sm:text-5xl xl:text-6xl font-black tracking-tight leading-[1.08] text-white">
                Turn Drone Video into{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-cyan-400 drop-shadow-[0_0_30px_rgba(0,210,255,0.4)]">
                  Interactive 3D Digital Twins
                </span>
              </h1>
            </div>

            {/* Paragraph Description */}
            <p className="text-slate-300/90 text-sm sm:text-base leading-relaxed max-w-xl font-normal">
              AeroMesh automatically extracts frames from raw aerial drone footage, reconstructs millimeter-precise 3D point clouds, and generates high-fidelity architectural meshes with actionable spatial intelligence.
            </p>

            {/* Hero CTA Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              {/* Primary: New Analysis */}
              <Link
                to="/new-analysis"
                className="group relative inline-flex items-center gap-3 px-7 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold text-sm shadow-[0_0_35px_rgba(0,160,255,0.45)] hover:shadow-[0_0_50px_rgba(0,210,255,0.7)] transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                  <Play className="w-2.5 h-2.5 fill-white text-white translate-x-0.5" />
                </div>
                <span>Start New Analysis</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>

              {/* Secondary: History */}
              <Link
                to="/history"
                className="group flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#07132a]/80 hover:bg-[#0c1d3f] border border-[#182f5b] hover:border-cyan-500/50 text-slate-200 hover:text-white font-semibold text-sm backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all duration-300"
              >
                <Clock className="w-4 h-4 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
                <span>Project History</span>
              </Link>

              {/* Sample Dashboard Demo Link */}
              <Link
                to="/dashboard"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 transition-colors pl-2 font-medium"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Sample Report Preview</span>
              </Link>
            </div>

            {/* Quick Metrics Strip — Grounding the Left Column */}
            <div className="pt-4 border-t border-[#0e2145]/70 grid grid-cols-3 gap-4 max-w-lg">
              <div>
                <div className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                  99.4<span className="text-cyan-400 font-sans">%</span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium">
                  Reconstruction Precision
                </div>
              </div>

              <div>
                <div className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                  &lt; 3<span className="text-cyan-400 font-sans">min</span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium">
                  AI Turnaround Time
                </div>
              </div>

              <div>
                <div className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                  4K <span className="text-cyan-400 font-sans">&amp; Thermal</span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium">
                  Multi-Sensor Drone Ingestion
                </div>
              </div>
            </div>

          </div>

          {/* Right Hero Column — Seamless 3D Digital Twin Viewport */}
          <div className="lg:col-span-6 relative w-full flex items-center justify-center">
            <BuildingViewer />
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* HOW IT WORKS / PIPELINE STRIP */}
      {/* ========================================================================= */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        
        {/* Section Divider Header */}
        <div className="relative flex items-center justify-center mb-12">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#0e2249]" />
          </div>
          <div className="relative px-5 py-1.5 rounded-full bg-[#050f24] border border-cyan-500/30 text-[11px] font-mono tracking-widest text-cyan-400 uppercase shadow-[0_0_20px_rgba(0,210,255,0.15)] flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>Autonomous SfM Reconstruction Pipeline</span>
          </div>
        </div>

        {/* 3-Step Flow Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Step 1 */}
          <div className="relative p-6 rounded-2xl bg-gradient-to-b from-[#08142c]/90 to-[#040b1a]/90 border border-[#142852] hover:border-cyan-500/40 transition-all duration-300 group shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(0,210,255,0.3)] transition-all">
                <Video className="w-6 h-6" />
              </div>
              <span className="text-2xl font-black font-mono text-slate-600 group-hover:text-cyan-400/50 transition-colors">
                01
              </span>
            </div>
            <h3 className="text-base font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
              Raw Aerial Video Capture
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Fly any commercial drone (DJI, Skydio, Autel) in a simple orbit. Upload standard MP4/MOV footage without specialized ground control markers.
            </p>
          </div>

          {/* Step 2 */}
          <div className="relative p-6 rounded-2xl bg-gradient-to-b from-[#08142c]/90 to-[#040b1a]/90 border border-[#142852] hover:border-cyan-500/40 transition-all duration-300 group shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(0,210,255,0.3)] transition-all">
                <Layers className="w-6 h-6" />
              </div>
              <span className="text-2xl font-black font-mono text-slate-600 group-hover:text-cyan-400/50 transition-colors">
                02
              </span>
            </div>
            <h3 className="text-base font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
              AI Structure-from-Motion
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Our neural vision engine extracts optimal overlapping frames, matches millions of sparse keypoints, and densifies a millimeter-accurate point cloud.
            </p>
          </div>

          {/* Step 3 */}
          <div className="relative p-6 rounded-2xl bg-gradient-to-b from-[#08142c]/90 to-[#040b1a]/90 border border-[#142852] hover:border-cyan-500/40 transition-all duration-300 group shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(0,210,255,0.3)] transition-all">
                <Box className="w-6 h-6" />
              </div>
              <span className="text-2xl font-black font-mono text-slate-600 group-hover:text-cyan-400/50 transition-colors">
                03
              </span>
            </div>
            <h3 className="text-base font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
              Interactive 3D Digital Twin
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Explore the full structure in real-time 3D, inspect elevation coordinates, detect thermal leaks, and export CAD/BIM formats instantly.
            </p>
          </div>

        </div>

      </section>

      {/* ========================================================================= */}
      {/* ABOUT & CORE CAPABILITIES */}
      {/* ========================================================================= */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* Left Text */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold tracking-[0.25em] text-cyan-400 uppercase font-mono">
                ENTERPRISE CAPABILITIES
              </span>
              <span className="w-12 h-[1.5px] bg-cyan-500/40" />
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-snug">
              More Than Just a Model <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400">
                It's a Complete Spatial View
              </span>
            </h2>

            <p className="text-slate-300/80 text-xs sm:text-sm leading-relaxed pt-2">
              <strong className="text-white font-semibold">AeroMesh</strong> bridges the gap between raw aerial sensor data and actionable engineering intelligence. Whether inspecting high-rise building facades, monitoring bridge structural health, or planning urban infrastructure, our cloud platform delivers crisp, interactive representations.
            </p>

            {/* Checklist of Enterprise Features */}
            <div className="pt-3 space-y-2.5">
              {[
                'Automated camera trajectory & orientation estimation',
                'Multi-spectrum thermal & RGB layer superposition',
                'Interactive measurement tools (area, volume, height)',
                'Direct export to OBJ, PLY, IFC, and LAS formats',
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Feature Cards (2x2 Grid) */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Card 1: 3D Reconstruction */}
            <div className="p-5 rounded-2xl bg-[#061126]/85 border border-[#14264d] hover:border-cyan-500/40 hover:bg-[#091733] transition-all duration-300 group flex items-start gap-4 shadow-glass backdrop-blur-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600/25 to-cyan-500/15 border border-blue-500/25 flex items-center justify-center text-cyan-400 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(0,180,255,0.35)] transition-all flex-shrink-0">
                <Box className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                  Sub-Centimeter 3D Mesh
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Generate watertight polygon meshes with realistic surface texturing and clean topological geometry.
                </p>
              </div>
            </div>

            {/* Card 2: Explore in 360° */}
            <div className="p-5 rounded-2xl bg-[#061126]/85 border border-[#14264d] hover:border-cyan-500/40 hover:bg-[#091733] transition-all duration-300 group flex items-start gap-4 shadow-glass backdrop-blur-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600/25 to-cyan-500/15 border border-blue-500/25 flex items-center justify-center text-cyan-400 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(0,180,255,0.35)] transition-all flex-shrink-0">
                <Crosshair className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                  360° Real-time Orbit
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Smoothly rotate, pan, and zoom into structural details with hardware-accelerated WebGL rendering.
                </p>
              </div>
            </div>

            {/* Card 3: Detailed Analysis */}
            <div className="p-5 rounded-2xl bg-[#061126]/85 border border-[#14264d] hover:border-cyan-500/40 hover:bg-[#091733] transition-all duration-300 group flex items-start gap-4 shadow-glass backdrop-blur-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600/25 to-cyan-500/15 border border-blue-500/25 flex items-center justify-center text-cyan-400 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(0,180,255,0.35)] transition-all flex-shrink-0">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                  Structural &amp; Defect Insights
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Detect cracks, corrosion, and thermal leakage automatically with neural defect segmentation.
                </p>
              </div>
            </div>

            {/* Card 4: Future Ready */}
            <div className="p-5 rounded-2xl bg-[#061126]/85 border border-[#14264d] hover:border-cyan-500/40 hover:bg-[#091733] transition-all duration-300 group flex items-start gap-4 shadow-glass backdrop-blur-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600/25 to-cyan-500/15 border border-blue-500/25 flex items-center justify-center text-cyan-400 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(0,180,255,0.35)] transition-all flex-shrink-0">
                <FileCode2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                  Enterprise BIM Integration
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Export ready-to-use spatial assets directly into Revit, AutoCAD, Blender, or GIS mapping software.
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* BOTTOM CTA BANNER */}
      {/* ========================================================================= */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <div className="relative rounded-3xl p-8 sm:p-12 overflow-hidden border border-cyan-500/30 bg-gradient-to-r from-[#06122b]/90 via-[#0a193d]/90 to-[#06122b]/90 backdrop-blur-xl shadow-[0_0_50px_rgba(0,180,255,0.15)] flex flex-col md:flex-row items-center justify-between gap-8">
          
          {/* Background Highlight */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-cyan-500/20 blur-[100px] rounded-full pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-600/20 blur-[100px] rounded-full pointer-events-none" />

          <div className="space-y-3 z-10 max-w-xl text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Experience AeroMesh in Action</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Ready to Reconstruct Your First Site?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Upload a test drone video or inspect our pre-rendered incident report to see how AeroMesh transforms aerial video into high-accuracy 3D spatial models.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 z-10">
            <Link
              to="/new-analysis"
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold text-sm shadow-[0_0_25px_rgba(0,210,255,0.4)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
            >
              <span>Launch New Analysis</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/history"
              className="px-6 py-3.5 rounded-xl bg-[#081530] hover:bg-[#0d2047] border border-[#1a3363] text-slate-200 hover:text-white font-semibold text-sm transition-all"
            >
              Browse Incidents
            </Link>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* FOOTER */}
      {/* ========================================================================= */}
      <footer className="mt-auto py-8 border-t border-[#0d1f42]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-200">AeroMesh</span>
            <span>—</span>
            <span>Next-Generation Aerial Digital Twin Platform</span>
          </div>

          <div className="flex items-center gap-4 font-mono text-[11px] text-slate-400">
            <span>REALTIME 3D</span>
            <span>•</span>
            <span>LOD-400</span>
            <span>•</span>
            <span className="text-cyan-400">SYSTEM OPERATIONAL</span>
          </div>
        </div>
      </footer>

    </div>
  );
};
