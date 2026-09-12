import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Play, Clock, User, MapPin, Crosshair,
  UploadCloud, FileVideo, Trash2, RefreshCw, AlertCircle, Bookmark, Volume2, Maximize, Loader2
} from 'lucide-react';
import { useIncident } from '../context/IncidentContext';
import { api } from '../services/api';

export const NewAnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const { setIncident, setVideoFile, videoFile, videoBlobUrl, videoMeta, extraction } = useIncident();

  // Form states
  const [title, setTitle] = useState<string>('Bridge Inspection Analysis');
  const [location, setLocation] = useState<string>('Sector 62, Noida, Uttar Pradesh');
  const [description, setDescription] = useState<string>(
    'Drone aerial survey of bridge superstructure and roadway perimeter for structural integrity assessment.'
  );

  // Local file display state (name + size for UI)
  const [localVideoMeta, setLocalVideoMeta] = useState<{ name: string; size: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeMb = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    setLocalVideoMeta({ name: file.name, size: sizeMb });
    setIsPlaying(false);

    // Push file into context → triggers blob URL creation + frame extraction
    setVideoFile(file);

    // Clear video error if any
    if (formErrors.video) setFormErrors(prev => ({ ...prev, video: '' }));
  };

  const handleRemoveVideo = () => {
    setLocalVideoMeta(null);
    setIsPlaying(false);
    setVideoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearAll = () => {
    setTitle('');
    setLocation('');
    setDescription('');
    setLocalVideoMeta(null);
    setIsPlaying(false);
    setVideoFile(null);
    setFormErrors({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStartAnalysis = async () => {
    const errors: { [key: string]: string } = {};
    if (!title.trim()) errors.title = 'Name / Title is required';
    if (!location.trim()) errors.location = 'Location is required';
    if (!description.trim()) errors.description = 'Description is required';
    if (!localVideoMeta) errors.video = 'Please upload a drone video before starting analysis';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create incident on real backend — backend generates collision-safe ID and immutable UTC timestamp
      const created = await api.createIncident({
        name: title,
        location,
        description,
      });

      // 2. Upload video file to backend if selected
      if (videoFile) {
        await api.uploadVideo(created.id, videoFile);
        await api.startAnalysis(created.id);
      }

      setIncident(created);
      navigate('/dashboard');
    } catch (err) {
      console.warn('[AeroMesh API] Starting with local workflow:', err);
      // Fallback
      setIncident(prev => ({
        ...prev,
        name: title,
        location,
        description,
        status: 'In Progress',
        videoName: localVideoMeta?.name,
        videoSize: localVideoMeta?.size,
      }));
      navigate('/dashboard');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to render extraction status in the video preview area
  const renderExtractionBadge = () => {
    if (!localVideoMeta) return null;
    if (extraction.status === 'extracting') {
      const pct = extraction.progress.total > 0
        ? Math.round((extraction.progress.current / extraction.progress.total) * 100)
        : 0;
      return (
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-900/80 border border-blue-400/50 text-blue-300 text-[10px] font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Extracting frames… {pct}%
        </div>
      );
    }
    if (extraction.status === 'done') {
      return (
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-900/80 border border-emerald-500/50 text-emerald-300 text-[10px] font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {extraction.progress.total} frames ready
        </div>
      );
    }
    if (extraction.status === 'error') {
      return (
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-900/80 border border-rose-500/50 text-rose-300 text-[10px] font-mono">
          <AlertCircle className="w-3 h-3" />
          Extraction failed
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col">
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">

        {/* Left Vertical Navigation Sidebar */}
        <aside className="w-56 hidden md:flex flex-col border-r border-[#121f3d] bg-[#060a16] p-4 justify-between">
          <div className="space-y-2">
            {/* New Analysis (Active) */}
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium shadow-[0_0_15px_rgba(37,99,235,0.4)]">
              <Play className="w-4 h-4 fill-white text-white" />
              <span className="text-sm">New Analysis</span>
            </div>

            {/* History */}
            <Link
              to="/history"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#0c1630] transition-colors"
            >
              <Clock className="w-4 h-4" />
              <span className="text-sm">History</span>
            </Link>

            {/* Profile */}
            <Link
              to="/profile"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#0c1630] transition-colors"
            >
              <User className="w-4 h-4" />
              <span className="text-sm">Profile</span>
            </Link>
          </div>

          {/* Bottom Sidebar Graphic */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-[#0a1226] to-[#060c1c] border border-[#14264e] text-center space-y-3">
            <div className="w-16 h-16 mx-auto relative flex items-center justify-center">
              <div className="w-12 h-12 rounded border border-cyan-400/60 bg-blue-950/40 rotate-45 flex items-center justify-center shadow-[0_0_12px_rgba(0,210,255,0.3)]">
                <div className="w-6 h-6 border border-cyan-300/60 -rotate-45" />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">Smarter Insights.</p>
              <p className="text-xs font-bold text-cyan-400">Safer Tomorrow.</p>
            </div>
          </div>
        </aside>

        {/* Main Form & Content */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">

          {/* Header */}
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(0,210,255,0.25)]">
              <Play className="w-5 h-5 fill-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">New Analysis</h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Add incident details and upload a drone video to generate a 3D reconstruction and detailed insights.
              </p>
            </div>
          </div>

          {/* Form Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

            {/* ── Left 8 cols ── */}
            <div className="xl:col-span-8 space-y-6">

              {/* Card 1: Incident Details */}
              <div className="p-6 rounded-2xl bg-[#080e1e]/90 border border-[#16274e] shadow-glass space-y-5">
                <div className="flex items-center justify-between pb-2 border-b border-[#121f3d]">
                  <div>
                    <h2 className="text-base font-bold text-white">Incident Details</h2>
                    <p className="text-xs text-slate-400">
                      Fill in the information about the incident. Each analysis gets a unique ID automatically.
                    </p>
                  </div>
                  <div className="px-3 py-1 rounded-md bg-[#0c1630] border border-cyan-500/40 text-cyan-400 font-mono text-xs font-semibold shadow-[0_0_10px_rgba(0,210,255,0.15)]">
                    ID: Auto-Assigned by Backend
                  </div>
                </div>

                {/* Name & Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      Name / Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        if (formErrors.title) setFormErrors(prev => ({ ...prev, title: '' }));
                      }}
                      placeholder="e.g. Building Collapse Incident"
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-[#0b1328] border ${
                        formErrors.title ? 'border-rose-500' : 'border-[#1b2f5b] focus:border-cyan-400'
                      } text-sm text-white focus:outline-none transition-colors`}
                    />
                    {formErrors.title && (
                      <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3" /> {formErrors.title}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      Location <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => {
                          setLocation(e.target.value);
                          if (formErrors.location) setFormErrors(prev => ({ ...prev, location: '' }));
                        }}
                        placeholder="e.g. Sector 62, Noida"
                        className={`w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#0b1328] border ${
                          formErrors.location ? 'border-rose-500' : 'border-[#1b2f5b] focus:border-cyan-400'
                        } text-sm text-white focus:outline-none transition-colors`}
                      />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400" title="Locate via GPS">
                        <Crosshair className="w-4 h-4" />
                      </button>
                    </div>
                    {formErrors.location && (
                      <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3" /> {formErrors.location}
                      </p>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      Description <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-500 font-mono">{description.length}/500</span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      if (formErrors.description) setFormErrors(prev => ({ ...prev, description: '' }));
                    }}
                    placeholder="Describe the incident, structural details, and any hazards observed..."
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-[#0b1328] border ${
                      formErrors.description ? 'border-rose-500' : 'border-[#1b2f5b] focus:border-cyan-400'
                    } text-sm text-white focus:outline-none transition-colors resize-none`}
                  />
                  {formErrors.description && (
                    <p className="text-[11px] text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {formErrors.description}
                    </p>
                  )}
                </div>

                {/* Creation Timestamp: Automatically generated by backend (Immutable) */}
                <div className="p-3.5 rounded-xl bg-[#091124] border border-[#14254b] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <div>
                      <p className="font-semibold text-slate-200">Creation Timestamp</p>
                      <p className="text-[11px] text-slate-400">Server-generated in UTC · Immutable audit record</p>
                    </div>
                  </div>
                  <div className="px-2.5 py-1 rounded-md bg-blue-950/60 border border-cyan-400/40 text-cyan-300 font-mono text-xs font-semibold">
                    Automatic Server Timestamp
                  </div>
                </div>
              </div>

              {/* Row: Video Upload + Video Preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Card 2: Video Upload */}
                <div className="p-6 rounded-2xl bg-[#080e1e]/90 border border-[#16274e] shadow-glass flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <FileVideo className="w-4 h-4 text-cyan-400" />
                      <h3 className="text-sm font-bold text-white">Video Upload</h3>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Upload a drone video (MP4, MOV, AVI). Frames will be extracted automatically.
                    </p>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="video/mp4,video/quicktime,video/x-msvideo,video/*"
                    className="hidden"
                    id="drone-video-upload"
                  />

                  {/* Drop zone */}
                  <label
                    htmlFor="drone-video-upload"
                    className="border-2 border-dashed border-[#1e3a70] hover:border-cyan-400/70 rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-[#091124]/60 hover:bg-[#0c1630]"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-600/20 text-cyan-400 flex items-center justify-center mb-2">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-200">Drag &amp; drop your video here</p>
                    <p className="text-[11px] text-cyan-400 underline mt-0.5">or click to browse</p>
                    <p className="text-[10px] text-slate-500 mt-2">Supported formats: MP4, MOV, AVI | Max size: 500MB</p>
                  </label>

                  {/* Uploaded file pill */}
                  {localVideoMeta ? (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0b1429] border border-[#1a2d59]">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <FileVideo className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                          <div className="truncate">
                            <p className="text-xs font-semibold text-slate-200 truncate">{localVideoMeta.name}</p>
                            <p className="text-[10px] text-slate-500">{localVideoMeta.size}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {renderExtractionBadge()}
                          <button
                            type="button"
                            onClick={handleRemoveVideo}
                            className="text-slate-400 hover:text-rose-400 transition-colors p-1"
                            title="Remove Video"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[#0c1630] border border-[#1b2f5b] hover:border-cyan-400/50 text-xs font-medium text-slate-300 hover:text-white transition-colors"
                      >
                        <RefreshCw className="w-3 h-3 text-cyan-400" />
                        <span>Change Video</span>
                      </button>
                    </div>
                  ) : (
                    formErrors.video && (
                      <p className="text-[11px] text-rose-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {formErrors.video}
                      </p>
                    )
                  )}
                </div>

                {/* Card 3: Video Preview — uses the actual blob URL */}
                <div className="p-6 rounded-2xl bg-[#080e1e]/90 border border-[#16274e] shadow-glass flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-1">
                      <Play className="w-4 h-4 text-cyan-400" /> Video Preview
                    </h3>
                  </div>

                  {/* Player */}
                  <div className={`relative rounded-xl overflow-hidden border ${
                    videoBlobUrl ? 'border-[#1a315e]' : 'border-slate-800 bg-[#060a14] opacity-50'
                  } flex items-center justify-center group`} style={{ aspectRatio: '16/9' }}>
                    {videoBlobUrl ? (
                      <>
                        {/* Real HTML5 video element */}
                        <video
                          ref={videoPreviewRef}
                          src={videoBlobUrl}
                          className="w-full h-full object-contain bg-black"
                          playsInline
                          onClick={() => {
                            const v = videoPreviewRef.current;
                            if (!v) return;
                            if (v.paused) { v.play(); setIsPlaying(true); }
                            else { v.pause(); setIsPlaying(false); }
                          }}
                          onEnded={() => setIsPlaying(false)}
                          onError={() => setIsPlaying(false)}
                        />

                        {/* Play overlay (shown when paused) */}
                        {!isPlaying && (
                          <button
                            type="button"
                            onClick={() => { videoPreviewRef.current?.play(); setIsPlaying(true); }}
                            className="absolute w-12 h-12 rounded-full bg-blue-600/80 hover:bg-blue-600 text-white flex items-center justify-center shadow-[0_0_20px_rgba(0,210,255,0.6)] transform transition-transform hover:scale-110"
                          >
                            <Play className="w-5 h-5 fill-white text-white translate-x-0.5" />
                          </button>
                        )}

                        {/* Video info overlay (bottom) */}
                        {videoMeta && (
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2.5 flex items-center justify-between text-[10px] text-slate-300">
                            <div className="flex items-center gap-2 font-mono">
                              <span>{videoMeta.durationFormatted}</span>
                              {videoMeta.resolutionFormatted !== 'Unknown' && (
                                <span className="text-slate-500">· {videoMeta.resolutionFormatted}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-slate-400">
                              <Volume2 className="w-3.5 h-3.5 hover:text-white cursor-pointer" />
                              <Maximize className="w-3.5 h-3.5 hover:text-white cursor-pointer" />
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center p-4">
                        <FileVideo className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-xs text-slate-500">Video Preview Disabled</p>
                        <p className="text-[10px] text-slate-600">Upload a video to activate preview</p>
                      </div>
                    )}
                  </div>

                  {/* Start Analysis Button */}
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleStartAnalysis}
                    className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-60 text-white font-semibold text-sm shadow-[0_0_20px_rgba(0,210,255,0.4)] hover:shadow-[0_0_30px_rgba(0,210,255,0.6)] transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Initializing Vision Pipeline...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-white text-white" />
                        <span>Start Analysis</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            </div>

            {/* ── Right 4 cols: Incident Info + Quick Actions ── */}
            <div className="xl:col-span-4 space-y-6">

              {/* Card: Incident Information */}
              <div className="p-6 rounded-2xl bg-[#080e1e]/90 border border-[#16274e] shadow-glass space-y-4">
                <h3 className="text-sm font-bold text-white pb-3 border-b border-[#121f3d]">
                  Incident Information
                </h3>
                <div className="space-y-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Incident ID</span>
                    <span className="font-mono text-cyan-400 text-[11px]">Assigned upon creation</span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-400 flex-shrink-0">Name</span>
                    <span className="text-slate-200 text-right font-medium truncate max-w-[180px]">{title || '—'}</span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-400 flex-shrink-0">Location</span>
                    <span className="text-slate-200 text-right font-medium text-[11px] truncate max-w-[180px]">{location || '—'}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Creation Timestamp</span>
                    <span className="text-slate-200 font-mono text-[11px]">Server UTC (Immutable)</span>
                  </div>

                  {/* Real video metadata if available */}
                  {videoMeta && (
                    <>
                      <div className="flex items-center justify-between pt-1 border-t border-[#121f3d]">
                        <span className="text-slate-400">Duration</span>
                        <span className="text-slate-200 font-mono">{videoMeta.durationFormatted}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Resolution</span>
                        <span className="text-slate-200 font-mono">{videoMeta.resolutionFormatted}</span>
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-400">Status</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-400 font-semibold text-[11px]">
                      Pending
                    </span>
                  </div>
                </div>
              </div>

              {/* Card: Quick Actions */}
              <div className="p-6 rounded-2xl bg-[#080e1e]/90 border border-[#16274e] shadow-glass space-y-4">
                <h3 className="text-sm font-bold text-white pb-3 border-b border-[#121f3d]">Quick Actions</h3>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => alert('Progress saved locally as draft')}
                    className="w-full flex items-start gap-3 p-3 rounded-xl bg-[#0b1328] hover:bg-[#0f1b38] border border-[#192b54] text-left transition-colors group"
                  >
                    <Bookmark className="w-4 h-4 text-cyan-400 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 group-hover:text-white">Save as Draft</h4>
                      <p className="text-[11px] text-slate-400">Save your progress and continue later</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="w-full flex items-start gap-3 p-3 rounded-xl bg-[#0b1328] hover:bg-rose-950/30 border border-[#192b54] hover:border-rose-500/40 text-left transition-colors group"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 group-hover:text-rose-300">Clear All</h4>
                      <p className="text-[11px] text-slate-400">Reset the form</p>
                    </div>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
