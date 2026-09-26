import React, { useRef, useState } from 'react';
import { Camera, LogOut, Pencil, Trash2 } from 'lucide-react';
import {
  loadProfile,
  photoFileToDataUrl,
  saveProfile,
  type FarmerProfile as ProfileData,
} from './farmerStore.js';

interface FarmerProfileProps {
  onSaved: (name: string) => void;
  onLogout: () => void;
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '🌾';

/** Professional farmer profile — pre-filled demo data, photo, edit, logout. */
export const FarmerProfile: React.FC<FarmerProfileProps> = ({ onSaved, onLogout }) => {
  const [saved, setSaved] = useState<ProfileData>(() => loadProfile());
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileData>(() => loadProfile());
  const [done, setDone] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const photoRef = useRef<HTMLInputElement>(null);

  const set = (key: 'name' | 'phone' | 'village' | 'district' | 'storageName' | 'storageLocation') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      setDone(false);
    };

  const handleSave = () => {
    const cleaned: ProfileData = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      village: form.village.trim(),
      district: form.district.trim(),
      storageName: form.storageName.trim(),
      storageLocation: form.storageLocation.trim(),
      photoDataUrl: form.photoDataUrl,
    };
    saveProfile(cleaned);
    setSaved(cleaned);
    setEditing(false);
    setDone(true);
    onSaved(cleaned.name);
  };

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoError('');
    try {
      const url = await photoFileToDataUrl(file, 512);
      const apply = editing ? setForm : setSaved;
      apply((p) => ({ ...p, photoDataUrl: url }));
      if (!editing) {
        const next = { ...saved, photoDataUrl: url };
        saveProfile(next);
        onSaved(next.name);
      }
      setDone(false);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not read that photo.');
    }
  };

  const removePhoto = () => {
    if (editing) {
      setForm((f) => ({ ...f, photoDataUrl: null }));
    } else {
      const next = { ...saved, photoDataUrl: null };
      setSaved(next);
      saveProfile(next);
    }
  };

  const shown = editing ? form : saved;
  const inputCls =
    'w-full bg-white border border-[#3D3226]/15 rounded-xl px-4 py-3 text-base text-[#2A2118] placeholder-[#2B2016]/35 focus:outline-none focus:border-[#B98A2E]';

  const personalRows: [string, string][] = [
    ['Phone', shown.phone || '—'],
    ['Village / Town', shown.village || '—'],
    ['District', shown.district || '—'],
  ];
  const storageRows: [string, string][] = [
    ['Storage', shown.storageName || '—'],
    ['Location', shown.storageLocation || '—'],
  ];

  return (
    <div className="space-y-4">
      {/* Identity card */}
      <div className="bg-white border border-[#3D3226]/10 rounded-2xl overflow-hidden">
        <div className="bg-[#2B2016] px-5 pt-6 pb-14 relative">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#D9A441]">Farmer Profile</p>
          <p className="text-xs text-white/60 mt-1">Saved once — added to every check and report.</p>
        </div>
        <div className="px-5 pb-5">
          <div className="flex items-end gap-4 -mt-10">
            <div className="relative shrink-0">
              {shown.photoDataUrl ? (
                <img
                  src={shown.photoDataUrl}
                  alt="Farmer"
                  className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#EFE7D4] border-4 border-white shadow-md flex items-center justify-center font-instrument-serif text-2xl text-[#3D3226]">
                  {initials(shown.name)}
                </div>
              )}
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                aria-label="Upload profile photo"
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#B98A2E] text-white flex items-center justify-center shadow-md cursor-pointer hover:bg-[#A87F2A]"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhoto(e.target.files?.[0])}
              />
            </div>
            <div className="pb-1 min-w-0">
              {editing ? (
                <input
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Your name"
                  className="w-full bg-[#F5F0E8] border border-[#3D3226]/15 rounded-xl px-3 py-2 font-instrument-serif text-2xl text-[#2A2118] focus:outline-none focus:border-[#B98A2E]"
                />
              ) : (
                <h1 className="font-instrument-serif text-3xl text-[#3D3226] truncate">{shown.name || 'Name not set'}</h1>
              )}
              <p className="text-xs font-mono text-[#2B2016]/55 mt-0.5">
                {shown.village && shown.district ? `${shown.village} · ${shown.district}` : 'StockProof farmer'}
              </p>
            </div>
          </div>
          {photoError && <p className="text-xs text-[#B23A32] mt-3">{photoError}</p>}
          {shown.photoDataUrl && (
            <button
              type="button"
              onClick={removePhoto}
              className="mt-3 text-xs text-[#2B2016]/55 hover:text-[#B23A32] flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove photo</span>
            </button>
          )}
        </div>
      </div>

      {done && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-[#2A2118]">
          ✅ Saved. Your details will now appear on every check.
        </div>
      )}

      {editing ? (
        <div className="bg-white border border-[#3D3226]/10 rounded-2xl p-5 space-y-4">
          <p className="text-xs font-mono uppercase tracking-widest text-[#B98A2E]">Personal</p>
          <label className="block">
            <span className="text-sm font-medium text-[#3D3226]">Phone number</span>
            <input value={form.phone} onChange={set('phone')} placeholder="e.g. +91 98765 43210" inputMode="tel" className={`${inputCls} mt-1.5`} />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-[#3D3226]">Village / Town</span>
              <input value={form.village} onChange={set('village')} placeholder="e.g. Karnal" className={`${inputCls} mt-1.5`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[#3D3226]">District</span>
              <input value={form.district} onChange={set('district')} placeholder="e.g. Karnal" className={`${inputCls} mt-1.5`} />
            </label>
          </div>
          <p className="text-xs font-mono uppercase tracking-widest text-[#B98A2E] pt-1">Storage</p>
          <label className="block">
            <span className="text-sm font-medium text-[#3D3226]">Where is the grain stored?</span>
            <input value={form.storageName} onChange={set('storageName')} placeholder='e.g. Karnal Agro Terminal — or "my own storage at home"' className={`${inputCls} mt-1.5`} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#3D3226]">Storage location</span>
            <input value={form.storageLocation} onChange={set('storageLocation')} placeholder="e.g. Shed 3, G.T. Road" className={`${inputCls} mt-1.5`} />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!form.name.trim()}
              className="touch-target flex-1 px-4 py-3 rounded-full bg-[#2B2016] text-white font-bold text-base cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save My Details
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(saved);
                setEditing(false);
              }}
              className="touch-target px-5 py-3 rounded-full bg-[#F5F0E8] border border-[#3D3226]/15 text-[#3D3226] font-bold text-base cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white border border-[#3D3226]/10 rounded-2xl overflow-hidden">
            <p className="px-5 pt-4 text-xs font-mono uppercase tracking-widest text-[#B98A2E]">Personal</p>
            <div className="divide-y divide-[#3D3226]/10">
              {personalRows.map(([label, value]) => (
                <div key={label} className="px-5 py-3.5 flex items-start justify-between gap-4">
                  <span className="text-xs font-mono uppercase tracking-wider text-[#2B2016]/55 shrink-0 pt-0.5">{label}</span>
                  <span className="text-base text-[#2A2118] text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-[#3D3226]/10 rounded-2xl overflow-hidden">
            <p className="px-5 pt-4 text-xs font-mono uppercase tracking-widest text-[#B98A2E]">Storage</p>
            <div className="divide-y divide-[#3D3226]/10">
              {storageRows.map(([label, value]) => (
                <div key={label} className="px-5 py-3.5 flex items-start justify-between gap-4">
                  <span className="text-xs font-mono uppercase tracking-wider text-[#2B2016]/55 shrink-0 pt-0.5">{label}</span>
                  <span className="text-base text-[#2A2118] text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setForm(saved);
              setEditing(true);
              setDone(false);
            }}
            className="touch-target w-full px-4 py-3 rounded-full bg-[#2B2016] text-white font-bold text-base flex items-center justify-center gap-2 cursor-pointer"
          >
            <Pencil className="w-4 h-4" />
            <span>Edit My Details</span>
          </button>
        </>
      )}

      <button
        type="button"
        onClick={onLogout}
        className="touch-target w-full px-4 py-3.5 rounded-full bg-[#B23A32] hover:bg-[#93302A] text-white font-bold text-base flex items-center justify-center gap-2 cursor-pointer transition-colors"
      >
        <LogOut className="w-5 h-5" />
        <span>Logout</span>
      </button>
    </div>
  );
};
