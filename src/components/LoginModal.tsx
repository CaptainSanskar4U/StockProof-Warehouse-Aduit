import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export type LoginRole = 'farmer' | 'inspector';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (profile: { firstName: string; lastName: string; email: string; role: LoginRole }) => void;
  dismissable?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess, dismissable = true }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<LoginRole>('inspector');
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose, dismissable]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Demo mode: auto-enter, no backend. Just persist + go.
    const profile = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      role,
    };
    try {
      localStorage.setItem('stockproof_auth', JSON.stringify({ ...profile, ts: Date.now(), demo: true }));
    } catch {
      /* ignore */
    }
    onSuccess(profile);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onClick={dismissable ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <style>{`
        .login-popup-card { display: flex; width: 100%; max-width: 940px; min-height: 560px; background: #1a1a1a; border: 1px solid #262626; border-radius: 22px; overflow: hidden; box-shadow: 0 40px 80px -20px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,0.02) inset; font-family: "Inter","SF Pro Display",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
        .login-popup-left { flex: 1 1 45%; background: #0a1c17 url('/logimg.png') center center / cover no-repeat; padding: 44px 40px; display: flex; flex-direction: column; justify-content: flex-end; position: relative; overflow: hidden; color: #f5f5f5; }
        .login-popup-left::before { content: ""; position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.28) 48%, rgba(0,0,0,0.08) 75%); pointer-events: none; }
        .login-popup-left h1 { font-size: 29px; font-weight: 650; letter-spacing: -0.02em; line-height: 1.28; margin: 0 0 12px 0; position: relative; }
        .login-popup-left p { color: #c9d8d2; font-size: 13.5px; line-height: 1.55; margin: 0 0 26px 0; max-width: 225px; position: relative; }
        .login-popup-steps { display: flex; gap: 10px; position: relative; }
        .login-popup-step { flex: 1; border-radius: 13px; padding: 14px 13px; min-height: 72px; display: flex; flex-direction: column; justify-content: space-between; }
        .login-popup-step.active { background: #ffffff; color: #111; box-shadow: 0 10px 24px -8px rgba(0,0,0,.5); }
        .login-popup-step:not(.active) { background: rgba(255,255,255,0.07); color: #d8ece6; }
        .login-popup-step .num { width: 20px; height: 20px; border-radius: 50%; font-size: 11px; display: flex; align-items: center; justify-content: center; font-weight: 700; }
        .login-popup-step.active .num { background: #111; color: #fff; }
        .login-popup-step:not(.active) .num { background: rgba(255,255,255,0.16); color: #fff; }
        .login-popup-step .label { font-size: 11.5px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.32; margin-top: 10px; }
        .login-popup-right { flex: 1 1 55%; padding: 32px 40px; display: flex; flex-direction: column; justify-content: center; color: #f5f5f5; position: relative; }
        .login-popup-right h2 { margin: 0 0 5px 0; font-size: 21px; font-weight: 700; letter-spacing: -0.02em; text-align: center; }
        .login-popup-right .sub { margin: 0 0 18px 0; text-align: center; color: #96968f; font-size: 12.5px; }
        .login-popup-oauth { display: flex; gap: 12px; margin-bottom: 16px; }
        .login-popup-oauth button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 12px; background: #212121; border: 1px solid #2e2e2e; border-radius: 10px; color: #f5f5f5; font-size: 13px; font-weight: 500; cursor: pointer; }
        .login-popup-oauth button:hover { background: #252525; border-color: #3a3a3a; }
        .login-popup-divider { display: flex; align-items: center; gap: 10px; text-align: center; color: #96968f; font-size: 11.5px; margin: 4px 0 16px 0; }
        .login-popup-divider::before, .login-popup-divider::after { content: ""; flex: 1; height: 1px; background: #2e2e2e; }
        .login-popup-row { display: flex; gap: 14px; }
        .login-popup-field { flex: 1; margin-bottom: 13px; display: flex; flex-direction: column; }
        .login-popup-field label { font-size: 12px; font-weight: 500; color: #96968f; margin-bottom: 7px; }
        .login-popup-field input { background: #212121; border: 1px solid #2e2e2e; border-radius: 9px; padding: 10.5px 13px; color: #f5f5f5; font-size: 13px; font-family: inherit; outline: none; }
        .login-popup-field input::placeholder { color: #6b6b6b; }
        .login-popup-field input:focus { border-color: #3fae8f; background: #1e1e1e; box-shadow: 0 0 0 3px rgba(63,174,143,0.15); }
        .login-popup-pw { position: relative; }
        .login-popup-pw input { width: 100%; padding-right: 38px; }
        .login-popup-eye { position: absolute; right: 11px; top: 50%; transform: translateY(-50%); color: #96968f; cursor: pointer; padding: 2px; display: flex; background: none; border: none; }
        .login-popup-hint { font-size: 11px; color: #96968f; margin: -7px 0 14px 0; }
        .login-popup-submit { width: 100%; padding: 12.5px; background: #ffffff; color: #111; border: none; border-radius: 10px; font-size: 13.5px; font-weight: 700; letter-spacing: -0.01em; cursor: pointer; margin-top: 2px; }
        .login-popup-submit:hover { background: #e9e9e9; }
        .login-popup-login { text-align: center; font-size: 12.5px; color: #96968f; margin-top: 14px; }
        .login-popup-login a { color: #fff; font-weight: 600; text-decoration: none; }
        .login-popup-role { display: flex; gap: 10px; margin-bottom: 13px; }
        .login-popup-role button { flex: 1; padding: 10px 12px; border-radius: 10px; border: 1px solid #2e2e2e; background: #212121; color: #96968f; font-size: 13px; font-weight: 600; cursor: pointer; }
        .login-popup-role button.active { background: #fff; color: #111; border-color: #fff; }
        .login-popup-close { position: absolute; top: 12px; right: 12px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #212121; border: 1px solid #2e2e2e; color: #96968f; cursor: pointer; }
        .login-popup-close:hover { color: #fff; border-color: #3a3a3a; }
        @media (max-width:760px) { .login-popup-card { flex-direction: column; max-height: 92dvh; overflow-y: auto; } .login-popup-left { min-height: 200px; padding: 28px 24px; } .login-popup-right { padding: 28px 22px; } .login-popup-row { flex-direction: column; gap: 0; } }
      `}</style>

      <div className="login-popup-card" onClick={(e) => e.stopPropagation()}>
        <div className="login-popup-left">
          <div className="login-popup-steps">
            <div className="login-popup-step active">
              <span className="num">1</span>
              <span className="label">Sign up your account</span>
            </div>
            <div className="login-popup-step">
              <span className="num">2</span>
              <span className="label">Set up your workspace</span>
            </div>
            <div className="login-popup-step">
              <span className="num">3</span>
              <span className="label">Set up your profile</span>
            </div>
          </div>
        </div>

        <div className="login-popup-right">
          {dismissable && (
          <button className="login-popup-close" onClick={onClose} aria-label="Close login">
            <X className="w-4 h-4" />
          </button>
          )}
          <h2>Sign Up Account</h2>
          <p className="sub">Enter your personal data to create your account.</p>

          <div className="login-popup-oauth">
            <button type="button" onClick={() => onSuccess({ firstName: 'Demo', lastName: 'User', email: 'demo@stockproof.app', role })}>
              <svg viewBox="0 0 24 24" width="16" height="16"><path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.48a5.54 5.54 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z" /><path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24z" /><path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.27a12 12 0 0 0 0 10.74z" /><path fill="#EA4335" d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.63l4 3.1c.94-2.85 3.6-4.96 6.73-4.96z" /></svg>
              Google
            </button>
            <button type="button" onClick={() => onSuccess({ firstName: 'Demo', lastName: 'User', email: 'demo@stockproof.app', role })}>
              <svg viewBox="0 0 24 24" fill="#f5f5f5" width="16" height="16"><path d="M12 .3a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.02 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .3z" /></svg>
              Github
            </button>
          </div>
          <div className="login-popup-divider">Or</div>

          <form onSubmit={handleSubmit}>
            <div className="login-popup-row">
              <div className="login-popup-field">
                <label>First Name</label>
                <input type="text" placeholder="eg. John" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="login-popup-field">
                <label>Last Name</label>
                <input type="text" placeholder="eg. Francisco" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>

            <div className="login-popup-field">
              <label>Email</label>
              <input type="email" placeholder="eg.johnfrans@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="login-popup-field">
              <label>I am a</label>
              <div className="login-popup-role">
                <button type="button" className={role === 'farmer' ? 'active' : ''} onClick={() => setRole('farmer')}>
                  Farmer
                </button>
                <button type="button" className={role === 'inspector' ? 'active' : ''} onClick={() => setRole('inspector')}>
                  Inspector
                </button>
              </div>
            </div>

            <div className="login-popup-field">
              <label>Password</label>
              <div className="login-popup-pw">
                <input type={showPw ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="login-popup-eye" onClick={() => setShowPw((v) => !v)} aria-label="Toggle password visibility">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="login-popup-hint">Must be at least 8 characters. Demo: click Sign Up to enter.</div>

            <button className="login-popup-submit" type="submit">Sign Up</button>
          </form>

          <div className="login-popup-login">Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); handleSubmit(e as unknown as React.FormEvent); }}>Log in</a></div>
        </div>
      </div>
    </div>
  );
};
