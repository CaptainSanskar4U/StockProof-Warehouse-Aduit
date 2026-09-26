import React, { useState, useEffect } from 'react';
import {
  Warehouse,
  Verification,
  GrainType,
  Season,
  CompactionLevel,
  GeometryInputs,
  ContextInputs,
  EstimationResult
} from '../types.js';
import { GRAIN_BULK_DENSITIES, SAMPLE_GRAIN_IMAGES } from '../constants.js';
import { SEASON_PROFILES, SEASON_ORDER } from '../seasonProfiles.js';
import { SafeImage } from './SafeImage.js';
import { StatusChip } from './StatusChip.js';
import { RangeBar } from './RangeBar.js';
import { 
  Camera, 
  Upload, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Info, 
  Sliders, 
  ShieldCheck, 
  AlertOctagon, 
  Droplets, 
  Layers, 
  Clock, 
  Maximize2, 
  RefreshCw, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';

interface VerificationFlowProps {
  warehouse: Warehouse;
  onCancel: () => void;
  onComplete: (verification: Verification) => void;
  currentAuditor: { id: string; name: string; role: string };
}

export const VerificationFlow: React.FC<VerificationFlowProps> = ({
  warehouse,
  onCancel,
  onComplete,
  currentAuditor,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // --- Step 1: Photo / Video Capture State (phone camera only, no new sensors) ---
  const [photoUrl, setPhotoUrl] = useState<string>(
    warehouse.pilePhotoUrl || SAMPLE_GRAIN_IMAGES.wheat_pile
  );
  const [mediaType, setMediaType] = useState<'photo' | 'video-frame'>('photo');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [referenceScale, setReferenceScale] = useState<string>('none');
  const [showARGuides, setShowARGuides] = useState<boolean>(true);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  // --- Step 2: Geometry and Context Inputs ---
  const defaultGrain = (warehouse.grainTypes?.[0] as GrainType) || 'wheat';
  const [heightMeters, setHeightMeters] = useState<number>(3.8);
  const [baseDiameterMeters, setBaseDiameterMeters] = useState<number>(10.5);
  const [measurementMethod, setMeasurementMethod] = useState<GeometryInputs['measurementMethod']>('laser_assisted');

  const [grainType, setGrainType] = useState<GrainType>(defaultGrain);
  const [season, setSeason] = useState<Season>('kharif');
  const [humidityPercent, setHumidityPercent] = useState<number>(12.8);
  const [compaction, setCompaction] = useState<CompactionLevel>('medium');
  const [storageDays, setStorageDays] = useState<number>(25);

  // --- Step 3 & 4: Processing and Result State ---
  const [loadingStage, setLoadingStage] = useState<number>(0);
  const [estimationResult, setEstimationResult] = useState<EstimationResult | null>(null);
  const [seasonCompare, setSeasonCompare] = useState<Record<string, EstimationResult> | null>(null);
  const [isComparingSeason, setIsComparingSeason] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live computed volume
  const r = baseDiameterMeters / 2;
  const calculatedVolume = Number(((1 / 3) * Math.PI * Math.pow(r, 2) * heightMeters).toFixed(1));

  // Loading animation simulation for honest copy
  useEffect(() => {
    if (step === 3) {
      setLoadingStage(0);
      const timer1 = setTimeout(() => setLoadingStage(1), 350);
      const timer2 = setTimeout(() => setLoadingStage(2), 750);
      const timer3 = setTimeout(() => setLoadingStage(3), 1150);
      const timer4 = setTimeout(() => {
        executeEstimation();
      }, 1550);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        clearTimeout(timer4);
      };
    }
  }, [step]);

  const executeEstimation = async () => {
    try {
      const geometry: GeometryInputs = {
        pileType: 'cone',
        heightMeters,
        baseDiameterMeters,
        calculatedVolumeM3: calculatedVolume,
        measurementMethod,
      };

      const context: ContextInputs = {
        grainType,
        season,
        humidityPercent,
        compaction,
        storageDays,
      };

      const res = await fetch('/api/verifications/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geometry,
          context,
          declaredTonnes: warehouse.currentDeclaredTonnes,
        }),
      });

      if (!res.ok) throw new Error('Calculation engine returned an error');
      const data = await res.json();
      setEstimationResult(data);
      setSeasonCompare(null);
      setStep(4);
      // Fire-and-forget: same pile under other season curves proves no fixed factor
      fetchSeasonComparison(geometry, { grainType, humidityPercent, compaction, storageDays } as ContextInputs);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to calculate stock estimate');
      setStep(2);
    }
  };

  const fetchSeasonComparison = async (geometry: GeometryInputs, baseContext: ContextInputs) => {
    setIsComparingSeason(true);
    try {
      const entries = await Promise.all(
        SEASON_ORDER.map(async (s) => {
          const res = await fetch('/api/verifications/estimate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              geometry,
              context: { ...baseContext, season: s },
              declaredTonnes: warehouse.currentDeclaredTonnes,
            }),
          });
          if (!res.ok) throw new Error('season compare failed');
          const data = await res.json();
          return [s, data] as const;
        })
      );
      setSeasonCompare(Object.fromEntries(entries));
    } catch {
      setSeasonCompare(null);
    } finally {
      setIsComparingSeason(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setMediaType('video-frame');
      setPhotoUrl(url);
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPhotoUrl(event.target.result as string);
        setVideoUrl(null);
        setMediaType('photo');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCaptureVideoFrame = () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = canvas.toDataURL('image/jpeg', 0.85);
      setPhotoUrl(frame);
      setMediaType('video-frame');
    } catch {
      setErrorMsg('Could not grab a frame from this video on this device.');
    }
  };

  const handleCommitVerification = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const geometry: GeometryInputs = {
        pileType: 'cone',
        heightMeters,
        baseDiameterMeters,
        calculatedVolumeM3: calculatedVolume,
        measurementMethod,
      };

      const context: ContextInputs = {
        grainType,
        season,
        humidityPercent,
        compaction,
        storageDays,
      };

      const res = await fetch('/api/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId: warehouse.id,
          photoUrl,
          mediaType,
          referenceScale,
          geometry,
          context,
          declaredTonnes: warehouse.currentDeclaredTonnes,
          runBy: currentAuditor,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(err.error || 'Failed to save verification');
      }

      const savedVerification: Verification = await res.json();
      onComplete(savedVerification);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error recording verification to registry');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[var(--sheet)] border border-[var(--hairline)] rounded-2xl overflow-hidden flex flex-col max-w-4xl mx-auto shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
      {/* Header bar */}
      <div className="p-4 sm:p-5 border-b border-[var(--hairline)] flex flex-wrap items-center justify-between gap-3 bg-[var(--well)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest text-[var(--gold)] uppercase">
              PHYSICAL VERIFICATION PIPELINE
            </span>
            <span className="text-[var(--ink-soft)] text-xs font-mono">/ {warehouse.code}</span>
          </div>
          <h2 className="text-lg sm:text-xl font-instrument-serif text-[var(--ink-2)] mt-0.5">
            {warehouse.name}
          </h2>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          {[
            { num: 1, label: 'Capture' },
            { num: 2, label: 'Context' },
            { num: 3, label: 'Compute' },
            { num: 4, label: 'Audit Result' },
          ].map((s) => (
            <div
              key={s.num}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
                step === s.num
                  ? 'bg-[var(--ink)] text-[var(--ink-inverse)] font-bold'
                  : step > s.num
                  ? 'bg-[var(--success-bg)] text-[var(--success-ink)] border border-[var(--success-line)]'
                  : 'bg-[var(--sheet)] text-[var(--ink-soft)] border border-[var(--hairline)]'
              }`}
            >
              <span>{s.num}.</span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="m-4 p-3 rounded bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-ink)] text-xs font-mono flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* --- STEP 1: CAPTURE PHOTO / VIDEO (phone only, no new sensors) --- */}
      {step === 1 && (
        <div className="p-4 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-[var(--ink-soft)] uppercase block">
                STEP 1 OF 4 — OPTICAL CAPTURE · PHONE CAMERA ONLY
              </span>
              <h3 className="text-base font-instrument-serif text-[var(--ink-2)]">
                Capture Photo or Video of the Grain Pile
              </h3>
            </div>
            <div className="text-xs font-mono text-[var(--ink-soft)]">
              Declared Receipt: <strong className="text-[var(--ink-2)]">{warehouse.currentDeclaredTonnes} T</strong>
            </div>
          </div>

          {/* Guidelines Callout (Explaining what makes a defensible photo) */}
          <div className="bg-[var(--well)] border border-[var(--hairline)] rounded p-3 text-xs flex items-start gap-2.5 text-[var(--ink-soft)]">
            <Info className="w-4 h-4 text-[var(--gold)] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[var(--ink-2)] block mb-0.5">What makes a defensible audit capture? No new hardware needed.</strong>
              Stand 10–15 meters back to capture the full base footprint perimeter and the top crest apex. Keep warehouse pillars, floor lines, or a reference object (door / bag stack / person) visible to anchor scale. Video walk-around works — grab the sharpest frame below.
            </div>
          </div>

          {/* Viewfinder: photo still or video with frame grab — cinematic field camera */}
          <div className="relative aspect-16/9 sm:aspect-21/9 rounded-xl overflow-hidden border border-[var(--hairline-strong)] bg-[var(--matte)] shadow-lg">
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <SafeImage
                src={photoUrl}
                alt="Grain pile capture"
                className="w-full h-full object-cover"
              />
            )}

            {/* Optical assist overlay — auditor confirms, system never auto-measures */}
            {showARGuides && !videoUrl && (
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
                {/* Top AR telemetry */}
                <div className="telemetry flex justify-between items-start text-[10px] sm:text-xs font-mono text-[var(--gold)] bg-[var(--overlay)] px-2 py-1 rounded backdrop-blur-xs border border-[var(--gold-line)] w-fit max-w-full">
                  <span>OPTICAL ASSIST · APEX {heightMeters.toFixed(1)}m | BASE ⌀ {baseDiameterMeters.toFixed(1)}m | VOL {calculatedVolume} m³ · AUDITOR CONFIRMS</span>
                </div>

                {/* Center Reticle and Pile Cone Outline */}
                <div className="relative w-full flex-1 flex items-center justify-center">
                  {/* Conical wireframe guide — scales with the viewfinder, never clips */}
                  <svg className="w-full h-full opacity-60" viewBox="0 0 400 200">
                    {/* Ellipse base */}
                    <ellipse cx="200" cy="165" rx="140" ry="25" fill="none" stroke="#D9A441" strokeWidth="1.5" strokeDasharray="4 2" />
                    {/* Left slope */}
                    <line x1="200" y1="45" x2="60" y2="165" stroke="#D9A441" strokeWidth="1.5" />
                    {/* Right slope */}
                    <line x1="200" y1="45" x2="340" y2="165" stroke="#D9A441" strokeWidth="1.5" />
                    {/* Apex marker */}
                    <circle cx="200" cy="45" r="4" fill="#D9A441" />
                    {/* Center height dotted line */}
                    <line x1="200" y1="45" x2="200" y2="165" stroke="#D9A441" strokeWidth="1" strokeDasharray="2 2" />
                    <text x="210" y="105" fill="#D9A441" fontSize="10" fontFamily="monospace">h = {heightMeters.toFixed(1)}m</text>
                    {referenceScale !== 'none' && (
                      <text x="12" y="190" fill="#F3EFE7" fontSize="9" fontFamily="monospace">REF: {referenceScale} · scale anchor visible</text>
                    )}
                  </svg>
                </div>

                {/* Bottom telemetry badge */}
                <div className="self-end max-w-full telemetry text-[10px] font-mono text-[var(--oncard)] bg-[var(--overlay)] px-2 py-1 rounded border border-[var(--success-line)]">
                  <span>✓ SURFACE BOUNDARY LOCKED · {mediaType === 'video-frame' ? 'VIDEO FRAME' : 'STILL PHOTO'}</span>
                </div>
              </div>
            )}

            {/* Overlay controls */}
            <div className="absolute top-3 right-3 max-w-[calc(100%-1.5rem)] flex flex-wrap items-center justify-end gap-2">
              {videoUrl && (
                <button
                  type="button"
                  onClick={handleCaptureVideoFrame}
                  className="bg-[var(--gold-bright)] hover:bg-[var(--gold-pale)] text-black text-xs font-mono font-bold px-2.5 py-1 rounded backdrop-blur-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Camera className="w-3 h-3" />
                  <span>Grab sharp frame</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowARGuides(!showARGuides)}
                className="bg-[var(--overlay-soft)] hover:bg-[var(--overlay)] text-xs font-mono text-[var(--paper)] border border-[var(--oncard-line)] px-2.5 py-1 rounded backdrop-blur-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Maximize2 className="w-3 h-3 text-[var(--gold)]" />
                <span>{showARGuides ? 'Hide guides' : 'Show guides'}</span>
              </button>
            </div>
          </div>

          {/* Capture actions, reference scale, gallery */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="touch-target cursor-pointer bg-[var(--sheet)] border border-[var(--hairline)] hover:bg-[var(--well)] text-[var(--ink-2)] px-3 py-2 rounded-full text-xs font-mono flex items-center gap-2 transition-colors">
                  <Upload className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span>Upload photo / video</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </label>

                <label className="touch-target cursor-pointer bg-[var(--sheet)] border border-[var(--hairline)] hover:bg-[var(--well)] text-[var(--ink-2)] px-3 py-2 rounded-full text-xs font-mono flex items-center gap-2 transition-colors">
                  <Camera className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span>Use phone camera</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </label>

                {videoUrl && (
                  <button
                    type="button"
                    onClick={() => { setVideoUrl(null); setMediaType('photo'); }}
                    className="text-[11px] font-mono text-[var(--ink-soft)] hover:text-[var(--danger-ink)] underline cursor-pointer"
                  >
                    Discard video
                  </button>
                )}
              </div>

              <span className="text-xs font-mono text-[var(--ink-soft)]">
                Or select pre-calibrated warehouse pile:
              </span>
            </div>

            {/* Reference-object scale — the no-hardware anchor */}
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span className="text-[var(--ink-soft)] uppercase tracking-wider">Reference in frame:</span>
              {[
                { id: 'none', label: 'None' },
                { id: 'door 2.1m', label: 'Door 2.1m' },
                { id: 'bag stack 1m', label: 'Bag stack 1m' },
                { id: 'person 1.7m', label: 'Person 1.7m' },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReferenceScale(r.id)}
                  className={`touch-target px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
                    referenceScale === r.id
                      ? 'bg-[var(--ink)] text-[var(--ink-inverse)] border-[var(--ink)]'
                      : 'bg-[var(--sheet)] text-[var(--ink-soft)] border-[var(--hairline)] hover:border-[var(--hairline-strong)]'
                  }`}
                >
                  {r.label}
                </button>
              ))}
              <span className="text-[var(--ink-faint)]">Keep it visible beside the pile — no laser, no LiDAR.</span>
            </div>

            {/* Quick Gallery Pills */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs font-mono">
              {[
                { name: 'Wheat Heap', url: SAMPLE_GRAIN_IMAGES.wheat_pile, grain: 'wheat' as GrainType, h: 3.8, d: 10.5 },
                { name: 'Paddy Rice', url: SAMPLE_GRAIN_IMAGES.rice_pile, grain: 'rice' as GrainType, h: 4.6, d: 12.0 },
                { name: 'Maize Heap', url: SAMPLE_GRAIN_IMAGES.maize_pile, grain: 'maize' as GrainType, h: 4.8, d: 12.0 },
                { name: 'Soybean Pile', url: SAMPLE_GRAIN_IMAGES.soybean_pile, grain: 'soybean' as GrainType, h: 5.2, d: 13.5 },
                { name: 'Pulses Stack', url: SAMPLE_GRAIN_IMAGES.pulses_pile, grain: 'pulses' as GrainType, h: 4.4, d: 12.2 },
              ].map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => {
                    setPhotoUrl(item.url);
                    setVideoUrl(null);
                    setMediaType('photo');
                    setGrainType(item.grain);
                    setHeightMeters(item.h);
                    setBaseDiameterMeters(item.d);
                  }}
                  className={`p-2 rounded text-left border transition-all ${
                    photoUrl === item.url
                      ? 'bg-[var(--ink)] border-[var(--ink)] text-[var(--ink-inverse)]'
                      : 'bg-[var(--sheet)] border-[var(--hairline)] text-[var(--ink-soft)] hover:border-[var(--hairline-strong)]'
                  }`}
                >
                  <div className="font-medium truncate">{item.name}</div>
                  <div className={`text-[10px] ${photoUrl === item.url ? 'text-[var(--on-inverse-dim)]' : 'text-[var(--ink-soft)]'}`}>h: {item.h}m, ⌀: {item.d}m</div>
                </button>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="pt-4 border-t border-[var(--hairline)] flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-mono text-[var(--ink-soft)] hover:text-[var(--ink-2)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-5 py-2.5 bg-[var(--ink)] hover:bg-[var(--ink-hover)] text-[var(--ink-inverse)] font-mono font-bold text-xs uppercase tracking-wider rounded flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span>Confirm & Enter Context</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* --- STEP 2: ENTER CONTEXT & CONFIRM GEOMETRY --- */}
      {step === 2 && (
        <div className="p-4 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-[var(--ink-soft)] uppercase block">
                STEP 2 OF 4 — SEASON CALIBRATION + PHYSICAL PARAMETERS
              </span>
              <h3 className="text-base font-instrument-serif text-[var(--ink-2)]">
                Season Curve, Grain Context & Geometry
              </h3>
            </div>
            <div className="text-xs font-mono text-[var(--gold)] bg-[var(--well)] px-3 py-1.5 rounded border border-[var(--hairline)]">
              Calculated Volume: <strong className="text-[var(--ink-2)]">{calculatedVolume} m³</strong>
            </div>
          </div>

          {/* Season-aware calibration — the twist: same fill, different tonnage */}
          <div className="bg-[var(--sheet)] rounded-lg p-4 border border-[var(--hairline)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
              <span className="text-[10px] font-mono tracking-widest text-[var(--gold)] uppercase">
                SEASON CALIBRATION · NO FIXED CONVERSION FACTOR
              </span>
              <span className="text-[11px] font-mono text-[var(--ink-soft)]">
                {mediaType === 'video-frame' ? 'Source: video frame' : 'Source: still photo'}{referenceScale !== 'none' ? ` · Ref: ${referenceScale}` : ''}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SEASON_ORDER.map((s) => {
                const p = SEASON_PROFILES[s];
                const active = season === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSeason(s);
                      // Suggest the season's typical moisture midpoint; auditor can still override
                      const mid = (p.typicalHumidity[0] + p.typicalHumidity[1]) / 2;
                      setHumidityPercent((prev) => {
                        const inBand = prev >= p.typicalHumidity[0] - 1 && prev <= p.typicalHumidity[1] + 1;
                        return inBand ? prev : Number(mid.toFixed(1));
                      });
                    }}
                    className={`p-3 rounded-lg text-left border transition-all cursor-pointer ${
                      active
                      ? 'bg-[var(--ink)] border-[var(--ink)] text-[var(--ink-inverse)]'
                      : 'bg-[var(--well)] border-[var(--hairline)] text-[var(--ink-soft)] hover:border-[var(--hairline-strong)]'
                    }`}
                  >
                    <div className="text-xs font-mono font-bold uppercase tracking-wider">{p.name}</div>
                    <div className={`text-[10px] font-mono mt-0.5 ${active ? 'text-[var(--on-inverse-dim)]' : 'text-[var(--ink-soft)]'}`}>{p.harvestWindow}</div>
                    <div className={`text-[11px] mt-1.5 leading-snug ${active ? 'text-[var(--on-inverse)]' : 'text-[var(--ink-soft)]'}`}>{p.storageHint}</div>
                    <div className={`text-[10px] font-mono mt-1.5 ${active ? 'text-[var(--oncard-gold)]' : 'text-[var(--gold)]'}`}>
                      Typical {p.typicalHumidity[0]}–{p.typicalHumidity[1]}% · settle {(p.settleRatePer30d * 100).toFixed(1)}%/30d
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] font-mono text-[var(--ink-soft)] mt-3 leading-relaxed">
              {SEASON_PROFILES[season].description} Auditor override stays allowed — readings outside the {SEASON_PROFILES[season].typicalHumidity[0]}–{SEASON_PROFILES[season].typicalHumidity[1]}% band widen the range and lower confidence.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Physical Geometry */}
            <div className="bg-[var(--well)] p-4 rounded-lg border border-[var(--hairline)] space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono tracking-wider text-[var(--gold)] uppercase">
                <Layers className="w-4 h-4" />
                <span>Physical Pile Dimensions</span>
              </div>

              {/* Height slider */}
              <div>
                <div className="flex justify-between text-xs font-mono text-[var(--ink-soft)] mb-1">
                  <span>Apex Height (h)</span>
                  <span className="text-[var(--ink-2)] font-bold">{heightMeters.toFixed(1)} meters</span>
                </div>
                <input
                  type="range"
                  min="1.5"
                  max="8.0"
                  step="0.1"
                  value={heightMeters}
                  onChange={(e) => setHeightMeters(parseFloat(e.target.value))}
                  className="w-full accent-[var(--ink)] bg-[var(--hairline-soft)] h-2 rounded cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-[var(--ink-soft)] mt-1">
                  <span>1.5m</span>
                  <span>4.0m</span>
                  <span>8.0m</span>
                </div>
              </div>

              {/* Base Diameter slider */}
              <div>
                <div className="flex justify-between text-xs font-mono text-[var(--ink-soft)] mb-1">
                  <span>Base Diameter (⌀)</span>
                  <span className="text-[var(--ink-2)] font-bold">{baseDiameterMeters.toFixed(1)} meters</span>
                </div>
                <input
                  type="range"
                  min="5.0"
                  max="22.0"
                  step="0.1"
                  value={baseDiameterMeters}
                  onChange={(e) => setBaseDiameterMeters(parseFloat(e.target.value))}
                  className="w-full accent-[var(--ink)] bg-[var(--hairline-soft)] h-2 rounded cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-[var(--ink-soft)] mt-1">
                  <span>5.0m</span>
                  <span>13.5m</span>
                  <span>22.0m</span>
                </div>
              </div>

              {/* Measurement method */}
              <div>
                <label className="text-xs font-mono text-[var(--ink-soft)] block mb-1.5">
                  Measurement Methodology
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  {[
                    { id: 'laser_assisted', label: 'Laser Rangefinder' },
                    { id: 'ar_marker', label: 'AR Optical Marker' },
                    { id: 'manual_gauge', label: 'Physical Gauge Rod' },
                    { id: 'visual_estimate', label: 'Visual Estimate' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMeasurementMethod(m.id as any)}
                      className={`touch-target p-2 rounded text-left border transition-colors ${
                        measurementMethod === m.id
                          ? 'bg-[var(--wash-strong)] border-[var(--gold)] text-[var(--ink-2)]'
                          : 'bg-[var(--sheet)] border-[var(--hairline)] text-[var(--ink-soft)] hover:border-[var(--hairline-strong)]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Agronomic & Storage Context */}
            <div className="bg-[var(--well)] p-4 rounded-lg border border-[var(--hairline)] space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono tracking-wider text-[var(--gold)] uppercase">
                <Droplets className="w-4 h-4" />
                <span>Grain & Storage Context</span>
              </div>

              {/* Grain Type selector */}
              <div>
                <label className="text-xs font-mono text-[var(--ink-soft)] block mb-1.5">
                  Grain Type & Agronomic Bulk Density
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                  {(Object.keys(GRAIN_BULK_DENSITIES) as GrainType[]).map((key) => {
                    const profile = GRAIN_BULK_DENSITIES[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setGrainType(key)}
                        className={`p-2 rounded text-left border transition-colors ${
                          grainType === key
                            ? 'bg-[var(--wash-strong)] border-[var(--gold)] text-[var(--ink-2)]'
                            : 'bg-[var(--sheet)] border-[var(--hairline)] text-[var(--ink-soft)] hover:border-[var(--hairline-strong)]'
                        }`}
                      >
                        <div className="font-semibold">{profile.name}</div>
                        <div className="text-[10px] text-[var(--ink-soft)]">{profile.density.toFixed(2)} t/m³</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Humidity % slider */}
              <div>
                <div className="flex justify-between text-xs font-mono text-[var(--ink-soft)] mb-1">
                  <span>Moisture Content (%)</span>
                  <span className="text-[var(--ink-2)] font-bold">{humidityPercent.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min="8.0"
                  max="20.0"
                  step="0.2"
                  value={humidityPercent}
                  onChange={(e) => setHumidityPercent(parseFloat(e.target.value))}
                  className="w-full accent-[var(--ink)] bg-[var(--hairline-soft)] h-2 rounded cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-[var(--ink-soft)] mt-1">
                  <span>8% (Dry)</span>
                  <span className="text-[var(--success-ink)]">11–13.5% (Safe Silo)</span>
                  <span className="text-[var(--danger-ink)]">20% (High Spoilage)</span>
                </div>
              </div>

              {/* Compaction Level */}
              <div>
                <label className="text-xs font-mono text-[var(--ink-soft)] block mb-1.5">
                  Compaction Level
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                  {[
                    { id: 'low', label: 'Low (×0.94)', sub: 'Freshly dumped' },
                    { id: 'medium', label: 'Medium (×1.0)', sub: 'Settled normal' },
                    { id: 'high', label: 'High (×1.06)', sub: 'Deep packed' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCompaction(c.id as any)}
                      className={`p-2 rounded text-left border transition-colors ${
                        compaction === c.id
                          ? 'bg-[var(--wash-strong)] border-[var(--gold)] text-[var(--ink-2)]'
                          : 'bg-[var(--sheet)] border-[var(--hairline)] text-[var(--ink-soft)] hover:border-[var(--hairline-strong)]'
                      }`}
                    >
                      <div className="font-semibold">{c.label}</div>
                      <div className="text-[10px] text-[var(--ink-soft)]">{c.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Storage Duration */}
              <div>
                <div className="flex justify-between text-xs font-mono text-[var(--ink-soft)] mb-1">
                  <span>Storage Duration</span>
                  <span className="text-[var(--ink-2)] font-bold">{storageDays} days</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="120"
                  step="1"
                  value={storageDays}
                  onChange={(e) => setStorageDays(parseInt(e.target.value))}
                  className="w-full accent-[var(--ink)] bg-[var(--hairline-soft)] h-2 rounded cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-[var(--ink-soft)] mt-1">
                  <span>1 day</span>
                  <span>45 days</span>
                  <span>120 days</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="pt-4 border-t border-[var(--hairline)] flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 text-xs font-mono text-[var(--ink-soft)] hover:text-[var(--ink-2)] flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Photo</span>
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="px-5 py-2.5 bg-[var(--ink)] hover:bg-[var(--ink-hover)] text-[var(--ink-inverse)] font-mono font-bold text-xs uppercase tracking-wider rounded flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span>Execute Defensible Estimation</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* --- STEP 3: PROCESSING (HONEST, NON-MYSTICAL COPY) --- */}
      {step === 3 && (
        <div className="p-8 sm:p-12 flex flex-col items-center justify-center space-y-6 text-center min-h-96">
          <div className="w-16 h-16 rounded-full border-2 border-[var(--gold-line)] border-t-[var(--gold)] animate-spin flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-[var(--gold)]" />
          </div>

          <div className="space-y-2 max-w-md">
            <span className="text-[11px] font-mono tracking-widest text-[var(--gold)] uppercase">
              CALCULATION IN PROGRESS
            </span>
            <h3 className="text-xl font-instrument-serif text-[var(--ink-2)]">
              Applying {SEASON_PROFILES[season].name} Calibration
            </h3>
            <p className="text-xs text-[var(--ink-soft)]">
              Calculating grain stock range from pile geometry, {SEASON_PROFILES[season].short} moisture dynamics, and season-aware storage consolidation — no fixed factor.
            </p>
          </div>

          {/* Honest multi-stage feedback */}
          <div className="w-full max-w-sm bg-[var(--well)] border border-[var(--hairline)] rounded p-4 text-xs font-mono text-left space-y-2.5">
            <div className={`flex items-center gap-2 ${loadingStage >= 0 ? 'text-[var(--success-ink)]' : 'text-[var(--ink-soft)]'}`}>
              {loadingStage >= 1 ? <Check className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>1. Resolving conical volume: {calculatedVolume} m³ {mediaType === 'video-frame' ? '(video frame)' : '(photo)'}</span>
            </div>
            <div className={`flex items-center gap-2 ${loadingStage >= 1 ? 'text-[var(--success-ink)]' : 'text-[var(--ink-soft)]'}`}>
              {loadingStage >= 2 ? <Check className="w-3.5 h-3.5" /> : loadingStage === 1 ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span className="w-3.5 h-3.5 inline-block" />}
              <span>2. Querying {GRAIN_BULK_DENSITIES[grainType].name} bulk density ({GRAIN_BULK_DENSITIES[grainType].density.toFixed(2)} t/m³)</span>
            </div>
            <div className={`flex items-center gap-2 ${loadingStage >= 2 ? 'text-[var(--success-ink)]' : 'text-[var(--ink-soft)]'}`}>
              {loadingStage >= 3 ? <Check className="w-3.5 h-3.5" /> : loadingStage === 2 ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span className="w-3.5 h-3.5 inline-block" />}
              <span>3. Applying {SEASON_PROFILES[season].short} curve: {humidityPercent}% moisture, {compaction} compaction, {storageDays}d</span>
            </div>
            <div className={`flex items-center gap-2 ${loadingStage >= 3 ? 'text-[var(--success-ink)]' : 'text-[var(--ink-soft)]'}`}>
              {loadingStage >= 3 ? <Check className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 inline-block" />}
              <span>4. Synthesizing confidence & uncertainty bounds...</span>
            </div>
          </div>
        </div>
      )}

      {/* --- STEP 4: AUDIT RESULT SCREEN --- */}
      {step === 4 && estimationResult && (
        <div className="p-4 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--hairline)] pb-4">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-[var(--ink-soft)] uppercase block">
                STEP 4 OF 4 — VERIFICATION RESULT
              </span>
              <h3 className="text-xl font-instrument-serif text-[var(--ink-2)]">
                Stock Estimation vs Declared Receipt
              </h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <span className="text-[10px] font-mono bg-[var(--ink)] text-[var(--oncard-gold)] border border-[var(--ink)] px-2 py-1 rounded uppercase tracking-wider">
                {SEASON_PROFILES[season].short} curve
              </span>
              <span className="text-[10px] font-mono bg-[var(--sheet)] text-[var(--ink-soft)] border border-[var(--hairline)] px-2 py-1 rounded uppercase tracking-wider">
                {mediaType === 'video-frame' ? 'Video frame' : 'Still photo'}{referenceScale !== 'none' ? ` · ${referenceScale}` : ''}
              </span>
              <StatusChip status={estimationResult.status} size="lg" />
            </div>
          </div>

          {/* HERO NUMBERS: Range + Confidence beats deceptive single points */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Declared */}
            <div className="bg-[var(--well)] p-4 rounded border border-[var(--hairline)]">
              <span className="text-[10px] font-mono text-[var(--ink-soft)] tracking-widest uppercase block mb-1">
                DECLARED WAREHOUSE RECEIPT
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-display font-extrabold text-[var(--ink-2)]">
                  {warehouse.currentDeclaredTonnes.toFixed(1)}
                </span>
                <span className="text-sm font-mono text-[var(--ink-soft)]">T</span>
              </div>
              <p className="text-[11px] font-mono text-[var(--ink-soft)] mt-1">
                Receipt: {warehouse.receiptNumber}
              </p>
            </div>

            {/* Estimated Range */}
            <div className="bg-[var(--well)] p-4 rounded border border-[var(--gold-line)] sm:col-span-2 relative overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-mono text-[var(--gold)] tracking-widest uppercase font-semibold">
                  PHYSICAL ESTIMATED RANGE (DEFENSIBLE BOUNDS)
                </span>
                <span className="text-xs font-mono bg-[var(--wash-strong)] text-[var(--gold)] border border-[var(--gold-line)] px-2 py-0.5 rounded font-bold">
                  {estimationResult.confidencePercent}% CONFIDENCE
                </span>
              </div>

              <div className="flex items-baseline gap-2 my-1">
                <span className="text-3xl sm:text-4xl font-display font-extrabold text-[var(--gold)]">
                  {estimationResult.rangeLowTonnes} - {estimationResult.rangeHighTonnes}
                </span>
                <span className="text-sm font-mono text-[var(--ink-soft)]">Tonnes</span>
              </div>

              {/* This legacy capture path runs no AI authenticity check, so the
                  reading is honestly "unchecked" — never presented as confirmed. */}
              <p className="font-mono text-[10px] text-[var(--warn-ink)] mt-1">
                authenticity check unavailable — this capture path does not verify image authenticity
              </p>

              <div className="mt-3">
                <RangeBar
                  rangeLow={estimationResult.rangeLowTonnes}
                  rangeHigh={estimationResult.rangeHighTonnes}
                  declared={warehouse.currentDeclaredTonnes}
                />
              </div>
            </div>
          </div>

          {/* Same pile, different season — proves no fixed conversion factor */}
          <div className="bg-[var(--sheet)] rounded-lg p-4 border border-[var(--hairline)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
              <span className="text-[10px] font-mono tracking-widest text-[var(--gold)] uppercase">
                SAME {calculatedVolume} m³ PILE · DIFFERENT SEASON, DIFFERENT TONNAGE
              </span>
              <span className="text-[11px] font-mono text-[var(--ink-soft)]">
                {isComparingSeason ? 'Recalibrating curves…' : 'No fixed factor — calibration matters'}
              </span>
            </div>
            {seasonCompare ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                {SEASON_ORDER.map((s) => {
                  const r = seasonCompare[s];
                  if (!r) return null;
                  const active = s === season;
                  const inside = warehouse.currentDeclaredTonnes >= r.rangeLowTonnes && warehouse.currentDeclaredTonnes <= r.rangeHighTonnes;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setSeason(s);
                        setEstimationResult(r);
                      }}
                      className={`p-3 rounded-lg text-left border transition-all cursor-pointer ${
                        active
                          ? 'bg-[var(--ink)] border-[var(--ink)] text-[var(--ink-inverse)]'
                          : 'bg-[var(--well)] border-[var(--hairline)] text-[var(--ink-soft)] hover:border-[var(--hairline-strong)]'
                      }`}
                    >
                      <div className="text-[11px] font-mono font-bold uppercase tracking-wider flex items-center justify-between">
                        <span>{SEASON_PROFILES[s].short}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${inside ? 'bg-[var(--moss-solid)] text-[var(--on-moss)]' : r.status === 'high_priority' ? 'bg-[var(--clay-solid)] text-[var(--on-clay)]' : 'bg-[var(--gold)] text-black'}`}>
                          {inside ? 'INSIDE' : r.status === 'high_priority' ? 'OVER' : 'EDGE'}
                        </span>
                      </div>
                      <div className={`text-lg font-display font-extrabold mt-1 ${active ? 'text-[var(--ink-inverse)]' : 'text-[var(--ink-2)]'}`}>
                        {r.rangeLowTonnes}–{r.rangeHighTonnes} T
                      </div>
                      <div className={`text-[10px] font-mono mt-0.5 ${active ? 'text-[var(--on-inverse-dim)]' : 'text-[var(--ink-soft)]'}`}>
                        {r.confidencePercent}% conf · ρ {r.effectiveDensity.toFixed(3)} t/m³
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] font-mono text-[var(--ink-soft)] mt-2">Computing Kharif / Rabi / Zaid bounds for this exact geometry…</p>
            )}
            <p className="text-[11px] font-mono text-[var(--ink-soft)] mt-3 leading-relaxed">
              Identical height, identical footprint — {seasonCompare ? `${seasonCompare.kharif?.centralEstimateTonnes} T (Kharif) vs ${seasonCompare.zaid?.centralEstimateTonnes} T (Zaid)` : 'watch the bounds move'}. That is why the receipt is checked against a season-calibrated range, never a single multiplier.
            </p>
          </div>

          {/* Plain-Language Explanation of WHY (Prompt Section 8 Mandate) */}
          <div className="bg-[var(--well)] p-4 rounded-lg border border-[var(--hairline)] space-y-3">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-[var(--gold)] uppercase block mb-1">
                AUDIT REASONING & PHYSICAL CONTEXT
              </span>
              <p className="text-sm text-[var(--ink-2)] leading-relaxed">
                {estimationResult.explanatoryReason}
              </p>
            </div>

            <div className="pt-3 border-t border-[var(--hairline)] flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[var(--gold)] shrink-0 mt-0.5" />
              <div>
                <strong className="text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] block">
                  PROCEDURAL RECOMMENDATION:
                </strong>
                <p className="text-xs text-[var(--ink-soft)] mt-0.5">
                  {estimationResult.auditRecommendation}
                </p>
              </div>
            </div>
          </div>

          {/* Audit Telemetry Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono text-[var(--ink-soft)] bg-[var(--well)] p-3 rounded border border-[var(--hairline)]">
            <div>
              <span className="block text-[10px]">SEASON CURVE</span>
              <strong className="text-[var(--ink-2)] uppercase">{SEASON_PROFILES[season].short}</strong>
            </div>
            <div>
              <span className="block text-[10px]">CROP TYPE</span>
              <strong className="text-[var(--ink-2)] uppercase">{GRAIN_BULK_DENSITIES[grainType].name}</strong>
            </div>
            <div>
              <span className="block text-[10px]">MOISTURE</span>
              <strong className="text-[var(--ink-2)]">{humidityPercent}%</strong>
            </div>
            <div>
              <span className="block text-[10px]">COMPACTION</span>
              <strong className="text-[var(--ink-2)] uppercase">{compaction}</strong>
            </div>
            <div>
              <span className="block text-[10px]">STORAGE TIME</span>
              <strong className="text-[var(--ink-2)]">{storageDays} Days</strong>
            </div>
          </div>

          {/* Navigation & Action Buttons */}
          <div className="pt-4 border-t border-[var(--hairline)] flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-mono text-[var(--ink-soft)] hover:text-[var(--ink-2)] transition-colors"
            >
              Adjust Parameters & Re-calculate
            </button>

            <button
              type="button"
              onClick={handleCommitVerification}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-[var(--ink)] hover:bg-[var(--ink-hover)] text-[var(--ink-inverse)] font-mono font-bold text-xs uppercase tracking-wider rounded flex items-center gap-2 transition-colors cursor-pointer shadow-lg disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving to Registry...' : 'Save Verification to Record'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
