import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InspectorProfile, InspectorType } from '../types.js';
import { fetchInspectorProfile, saveInspectorProfile } from '../services/api.js';
import {
  BadgeCheck,
  Building2,
  Camera,
  CheckCircle2,
  FileUp,
  FileCheck2,
  IdCard,
  Landmark,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';

interface ProfileTabProps {
  onProfileSaved?: (profile: InspectorProfile) => void;
}

const MAX_UPLOAD_BYTES = 2_000_000;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      reject(new Error(`"${file.name}" is too large — keep uploads under 2 MB.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

type BankState = {
  bankName: string; employeeName: string; employeeId: string; idCardDetails: string;
  contact: string; email: string; region: string;
  photoDataUrl: string; documentDataUrl: string; documentName: string;
};

type GovState = {
  department: string; inspectorName: string; govId: string; designation: string; cardDetails: string;
  contact: string; email: string; region: string;
  photoDataUrl: string; documentDataUrl: string; documentName: string;
};

const EMPTY_BANK: BankState = {
  bankName: '', employeeName: '', employeeId: '', idCardDetails: '', contact: '',
  email: '', region: '', photoDataUrl: '', documentDataUrl: '', documentName: '',
};

const EMPTY_GOV: GovState = {
  department: '', inspectorName: '', govId: '', designation: '', cardDetails: '', contact: '',
  email: '', region: '', photoDataUrl: '', documentDataUrl: '', documentName: '',
};

const fieldCls =
  'mt-1.5 w-full bg-[var(--sheet)] border border-[var(--hairline)] rounded-[10px] px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold-ring)] transition-all';
const labelCls = 'flex items-center gap-1.5 text-xs font-medium text-[var(--ink-soft)]';

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelCls}>
        <Icon className="w-3.5 h-3.5 text-[var(--gold)]" />
        {label}
      </span>
      {children}
    </label>
  );
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ onProfileSaved }) => {
  const [inspectorType, setInspectorType] = useState<InspectorType>('bank');
  const [displayName, setDisplayName] = useState('');
  const [bank, setBank] = useState<BankState>(EMPTY_BANK);
  const [gov, setGov] = useState<GovState>(EMPTY_GOV);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTarget, setUploadTarget] = useState<'photo' | 'doc'>('photo');

  useEffect(() => {
    let alive = true;
    fetchInspectorProfile()
      .then((p) => {
        if (!alive || !p) return;
        setInspectorType(p.inspectorType === 'government' ? 'government' : 'bank');
        setDisplayName(p.displayName || '');
        if (p.bank) setBank((prev) => ({ ...prev, ...p.bank }));
        if (p.gov) setGov((prev) => ({ ...prev, ...p.gov }));
        if (p.updatedAt) setSavedAt(p.updatedAt);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const setBankField = (k: keyof BankState, v: string) => {
    setBank((prev) => ({ ...prev, [k]: v }));
    setJustSaved(false);
  };
  const setGovField = (k: keyof GovState, v: string) => {
    setGov((prev) => ({ ...prev, [k]: v }));
    setJustSaved(false);
  };

  const handleFile = async (file: File | undefined) => {
    setErrorMsg(null);
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      if (uploadTarget === 'photo') {
        if (inspectorType === 'bank') setBankField('photoDataUrl', dataUrl);
        else setGovField('photoDataUrl', dataUrl);
      } else if (inspectorType === 'bank') {
        setBankField('documentDataUrl', dataUrl);
        setBankField('documentName', file.name);
      } else {
        setGovField('documentDataUrl', dataUrl);
        setGovField('documentName', file.name);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not process that file.');
    }
  };

  const isBank = inspectorType === 'bank';
  const photo = isBank ? bank.photoDataUrl : gov.photoDataUrl;
  const docName = isBank ? bank.documentName : gov.documentName;
  const docUrl = isBank ? bank.documentDataUrl : gov.documentDataUrl;
  const personName = isBank
    ? bank.employeeName.trim() || displayName.trim()
    : gov.inspectorName.trim() || displayName.trim();
  const personId = isBank ? bank.employeeId.trim() : gov.govId.trim();
  const orgLine = isBank
    ? bank.bankName.trim() || 'Bank Inspector'
    : gov.department.trim() || 'Government Inspector';

  const completion = useMemo(() => {
    const fields = isBank
      ? [bank.bankName, bank.employeeName, bank.employeeId, bank.contact, bank.photoDataUrl, bank.documentDataUrl]
      : [gov.department, gov.inspectorName, gov.govId, gov.designation, gov.contact, gov.photoDataUrl, gov.documentDataUrl];
    const filled = fields.filter((f) => f && f.trim().length > 0).length;
    return Math.round((filled / fields.length) * 100);
  }, [isBank, bank, gov]);

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    setJustSaved(false);
    try {
      const payload: InspectorProfile = {
        inspectorType,
        displayName: displayName.trim() || undefined,
        bank: isBank
          ? {
              bankName: bank.bankName.trim() || undefined,
              employeeName: bank.employeeName.trim() || undefined,
              employeeId: bank.employeeId.trim() || undefined,
              idCardDetails: bank.idCardDetails.trim() || undefined,
              contact: bank.contact.trim() || undefined,
              email: bank.email.trim() || undefined,
              region: bank.region.trim() || undefined,
              photoDataUrl: bank.photoDataUrl || undefined,
              documentDataUrl: bank.documentDataUrl || undefined,
              documentName: bank.documentName || undefined,
            }
          : undefined,
        gov: !isBank
          ? {
              department: gov.department.trim() || undefined,
              inspectorName: gov.inspectorName.trim() || undefined,
              govId: gov.govId.trim() || undefined,
              designation: gov.designation.trim() || undefined,
              cardDetails: gov.cardDetails.trim() || undefined,
              contact: gov.contact.trim() || undefined,
              email: gov.email.trim() || undefined,
              region: gov.region.trim() || undefined,
              photoDataUrl: gov.photoDataUrl || undefined,
              documentDataUrl: gov.documentDataUrl || undefined,
              documentName: gov.documentName || undefined,
            }
          : undefined,
      };
      const saved = await saveInspectorProfile(payload);
      setSavedAt(saved.updatedAt || new Date().toISOString());
      setJustSaved(true);
      onProfileSaved?.(saved);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="washi-sheet p-10 text-center max-w-3xl mx-auto">
        <p className="serif-reading text-lg text-[var(--ink)]">Opening your profile…</p>
        <p className="text-sm text-[var(--ink-soft)] mt-1">Fetching saved details.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-24">
      {/* ID-card header */}
      <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--card-ink-bg)] text-[var(--paper)] shadow-[var(--pill-shadow)]">
        <div className="px-5 sm:px-7 pt-6 pb-5 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="relative shrink-0">
            {photo ? (
              <img
                src={photo}
                alt="Inspector"
                className="w-20 h-20 rounded-2xl object-cover border-2 border-[var(--gold-line)] shadow-lg"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-[var(--oncard-wash)] border-2 border-dashed border-[var(--oncard-line)] flex items-center justify-center">
                <UserRound className="w-8 h-8 text-[var(--oncard-faint)]" />
              </div>
            )}
            {savedAt && (
              <span className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-[var(--moss-solid)] border-2 border-[var(--card-ink-bg)] flex items-center justify-center" title="Profile saved">
                <CheckCircle2 className="w-4 h-4 text-[var(--on-moss)]" />
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono tracking-widest uppercase ${
                  isBank ? 'bg-[var(--gold-wash)] text-[var(--gold-pale)] border border-[var(--gold-line)]' : 'bg-[var(--oncard-wash)] text-[var(--paper)] border border-[var(--success-line)]'
                }`}
              >
                {isBank ? <Building2 className="w-3 h-3" /> : <Landmark className="w-3 h-3" />}
                {isBank ? 'Bank Inspector' : 'Government Inspector'}
              </span>
              {savedAt ? (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--oncard)]">
                  <BadgeCheck className="w-3.5 h-3.5 text-[var(--moss)]" />
                  Saved {new Date(savedAt).toLocaleDateString()}
                </span>
              ) : (
                <span className="font-mono text-[11px] text-[var(--oncard-dim)]">Not saved yet</span>
              )}
            </div>
            <h2 className="serif-reading text-2xl sm:text-3xl mt-2 break-words">{personName || 'Your name appears here'}</h2>
            <p className="text-sm text-[var(--oncard)] mt-0.5 break-words">
              {orgLine}
              {personId ? ` · ID ${personId}` : ''}
            </p>
            <div className="mt-3 max-w-xs">
              <div className="flex justify-between font-mono text-[10px] text-[var(--oncard-dim)] mb-1">
                <span>PROFILE COMPLETE</span>
                <span>{completion}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--oncard-wash)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--gold)] transition-all duration-500"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="washi-sheet px-4 py-3 text-sm text-[var(--danger-ink)] border-[var(--danger-line)]" role="alert">
          {errorMsg}
        </div>
      )}
      {justSaved && (
        <div className="rounded-xl border border-[var(--success-line)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success-ink)] flex items-center gap-2 washi-enter">
          <CheckCircle2 className="w-4 h-4 text-[var(--success-ink)] shrink-0" />
          Profile saved — it will now appear on your audits and reports.
        </div>
      )}

      {/* Type selector */}
      <div className="washi-sheet px-5 sm:px-6 py-5">
        <p className="eyebrow-quiet">Step 1 · I am a</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          {(
            [
              { id: 'bank', Icon: Building2, title: 'Bank Inspector', sub: 'Collateral verification for lending' },
              { id: 'government', Icon: Landmark, title: 'Government Inspector', sub: 'Public stock accountability' },
            ] as const
          ).map(({ id, Icon, title, sub }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setInspectorType(id);
                setJustSaved(false);
              }}
              className={`touch-target p-4 rounded-xl border-2 text-left transition-all cursor-pointer flex items-start gap-3 ${
                inspectorType === id
                  ? 'bg-[var(--card-ink-bg)] text-[var(--paper)] border-[var(--ink)] shadow-[var(--pill-shadow)]'
                  : 'bg-[var(--sheet)] border-[var(--hairline)] hover:border-[var(--gold-line)] hover:shadow-sm'
              }`}
            >
              <span
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  inspectorType === id ? 'bg-[var(--gold-wash)]' : 'bg-[var(--gold-wash)]'
                }`}
              >
                <Icon className={`w-5 h-5 ${inspectorType === id ? 'text-[var(--gold-pale)]' : 'text-[var(--gold)]'}`} />
              </span>
              <span>
                <span className={`block text-[15px] font-medium ${inspectorType === id ? '' : 'text-[var(--ink)]'}`}>{title}</span>
                <span className={`block text-xs mt-0.5 ${inspectorType === id ? 'opacity-70' : 'text-[var(--ink-faint)]'}`}>{sub}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Identity details */}
      <div className="washi-sheet px-5 sm:px-6 py-5">
        <div className="flex items-center gap-2">
          <IdCard className="w-4 h-4 text-[var(--gold)]" />
          <p className="eyebrow-quiet">Step 2 · Identity details {isBank ? '· bank' : '· government'}</p>
        </div>
        <div className="mt-4">
          <Field icon={UserRound} label="Display name (shown on reports)">
            <input
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setJustSaved(false);
              }}
              placeholder="Your full name"
              className={fieldCls}
            />
          </Field>
        </div>
        {isBank ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <Field icon={Building2} label="Bank name">
              <input type="text" value={bank.bankName} onChange={(e) => setBankField('bankName', e.target.value)} placeholder="e.g. State Bank of India" className={fieldCls} />
            </Field>
            <Field icon={UserRound} label="Inspector / employee name">
              <input type="text" value={bank.employeeName} onChange={(e) => setBankField('employeeName', e.target.value)} placeholder="Your full name" className={fieldCls} />
            </Field>
            <Field icon={IdCard} label="Employee / Inspector ID">
              <input type="text" value={bank.employeeId} onChange={(e) => setBankField('employeeId', e.target.value)} placeholder="e.g. SBI-INS-0421" className={fieldCls} />
            </Field>
            <Field icon={Phone} label="Contact details">
              <input type="text" value={bank.contact} onChange={(e) => setBankField('contact', e.target.value)} placeholder="Phone number" className={fieldCls} />
            </Field>
            <Field icon={Mail} label="Email (optional)">
              <input type="email" value={bank.email} onChange={(e) => setBankField('email', e.target.value)} placeholder="you@bank.example" className={fieldCls} />
            </Field>
            <Field icon={MapPin} label="Region (optional)">
              <input type="text" value={bank.region} onChange={(e) => setBankField('region', e.target.value)} placeholder="District, State" className={fieldCls} />
            </Field>
            <div className="sm:col-span-2">
              <Field icon={ShieldCheck} label="ID card details">
                <textarea value={bank.idCardDetails} onChange={(e) => setBankField('idCardDetails', e.target.value)} rows={2} placeholder="ID card number, issuing authority…" className={`${fieldCls} resize-none`} />
              </Field>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <Field icon={Landmark} label="Department / organization">
              <input type="text" value={gov.department} onChange={(e) => setGovField('department', e.target.value)} placeholder="e.g. Food & Civil Supplies" className={fieldCls} />
            </Field>
            <Field icon={UserRound} label="Inspector name">
              <input type="text" value={gov.inspectorName} onChange={(e) => setGovField('inspectorName', e.target.value)} placeholder="Your full name" className={fieldCls} />
            </Field>
            <Field icon={IdCard} label="Government-issued ID">
              <input type="text" value={gov.govId} onChange={(e) => setGovField('govId', e.target.value)} placeholder="e.g. GOI-FOOD-1187" className={fieldCls} />
            </Field>
            <Field icon={BadgeCheck} label="Official designation">
              <input type="text" value={gov.designation} onChange={(e) => setGovField('designation', e.target.value)} placeholder="e.g. District Food Inspector" className={fieldCls} />
            </Field>
            <Field icon={Phone} label="Contact details">
              <input type="text" value={gov.contact} onChange={(e) => setGovField('contact', e.target.value)} placeholder="Phone number" className={fieldCls} />
            </Field>
            <Field icon={Mail} label="Email (optional)">
              <input type="email" value={gov.email} onChange={(e) => setGovField('email', e.target.value)} placeholder="you@gov.example" className={fieldCls} />
            </Field>
            <Field icon={MapPin} label="Region (optional)">
              <input type="text" value={gov.region} onChange={(e) => setGovField('region', e.target.value)} placeholder="District, State" className={fieldCls} />
            </Field>
            <div className="sm:col-span-2">
              <Field icon={ShieldCheck} label="Official ID / card details">
                <textarea value={gov.cardDetails} onChange={(e) => setGovField('cardDetails', e.target.value)} rows={2} placeholder="Card number, issuing authority…" className={`${fieldCls} resize-none`} />
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="washi-sheet px-5 sm:px-6 py-5">
        <div className="flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-[var(--gold)]" />
          <p className="eyebrow-quiet">Step 3 · Photo & ID document</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl border border-[var(--hairline)] bg-[var(--sheet)] p-4 flex items-center gap-4">
            {photo ? (
              <img src={photo} alt="Profile" className="w-16 h-16 rounded-xl object-cover border border-[var(--hairline)] shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-[var(--gold-wash)] border border-dashed border-[var(--gold-line)] flex items-center justify-center shrink-0">
                <Camera className="w-6 h-6 text-[var(--gold)]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--ink)]">Profile photo</p>
              <p className="font-mono text-[11px] text-[var(--ink-faint)]">{photo ? 'Attached' : 'A clear headshot works best'}</p>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setUploadTarget('photo');
                    photoInputRef.current?.click();
                  }}
                  className="touch-target px-3.5 py-1.5 text-xs bg-[var(--card-ink-bg)] text-[var(--paper)] rounded-full cursor-pointer"
                >
                  {photo ? 'Replace' : 'Upload'}
                </button>
                {photo && (
                  <button
                    type="button"
                    onClick={() => (isBank ? setBankField('photoDataUrl', '') : setGovField('photoDataUrl', ''))}
                    className="touch-target p-1.5 text-[var(--ink-faint)] hover:text-[var(--danger-ink)] cursor-pointer"
                    aria-label="Remove photo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--hairline)] bg-[var(--sheet)] p-4 flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-[var(--wash)] border border-[var(--hairline)] flex items-center justify-center shrink-0">
              <FileUp className="w-6 h-6 text-[var(--ink-faint)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--ink)]">ID document</p>
              <p className="font-mono text-[11px] text-[var(--ink-faint)] truncate">{docName || 'Image or PDF, under 2 MB'}</p>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setUploadTarget('doc');
                    docInputRef.current?.click();
                  }}
                  className="touch-target px-3.5 py-1.5 text-xs bg-[var(--card-ink-bg)] text-[var(--paper)] rounded-full cursor-pointer"
                >
                  {docName ? 'Replace' : 'Upload'}
                </button>
                {docUrl && !docUrl.startsWith('data:application/pdf') && (
                  <a href={docUrl} target="_blank" rel="noreferrer" className="touch-target px-3.5 py-1.5 text-xs border border-[var(--hairline)] rounded-full cursor-pointer">
                    View
                  </a>
                )}
                {docName && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isBank) {
                        setBankField('documentDataUrl', '');
                        setBankField('documentName', '');
                      } else {
                        setGovField('documentDataUrl', '');
                        setGovField('documentName', '');
                      }
                    }}
                    className="touch-target p-1.5 text-[var(--ink-faint)] hover:text-[var(--danger-ink)] cursor-pointer"
                    aria-label="Remove document"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <input
          ref={docInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--hairline)] bg-[var(--sheet-translucent)] backdrop-blur px-4 py-3">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[11px] text-[var(--ink-faint)]">
            {savedAt ? `Saved ${new Date(savedAt).toLocaleString()}` : 'Not saved yet — your details stay on this device registry'}
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="touch-target px-8 py-3 bg-[var(--ink)] hover:bg-[var(--ink-hover)] text-[var(--paper)] text-sm rounded-full inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-[var(--pill-shadow)]"
          >
            {saving ? 'Saving…' : justSaved ? 'Saved ✓' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};



