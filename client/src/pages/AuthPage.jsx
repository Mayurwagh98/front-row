import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import PageShell from '../components/PageShell.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { errMsg, inputCls, primaryBtn } from '../utils/ui.js';

export default function AuthPage({ mode }) {
  const isSignup = mode === 'signup';
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      isSignup ? await signup(form.name, form.email, form.password) : await login(form.email, form.password);
      navigate(location.state?.from?.pathname || '/movies', { replace: true }); // back to where they were headed
    } catch (err) {
      setError(errMsg(err));
    } finally { setBusy(false); }
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-sm">
        <h1 className="font-display text-6xl font-black leading-[.9]">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="mt-3 text-mist">{isSignup ? 'Sign up to hold seats and keep your tickets in one place.' : 'Sign in to pick seats and see your tickets.'}</p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          {isSignup && (
            <Field label="Name"><input className={inputCls} value={form.name} onChange={set('name')} autoComplete="name" required /></Field>
          )}
          <Field label="Email"><input className={inputCls} type="email" value={form.email} onChange={set('email')} autoComplete="email" required /></Field>
          <Field label="Password" hint={isSignup ? 'At least 8 characters' : undefined}>
            <input className={inputCls} type="password" minLength={isSignup ? 8 : undefined} value={form.password} onChange={set('password')} autoComplete={isSignup ? 'new-password' : 'current-password'} required />
          </Field>
          {error && <p role="alert" className="rounded-lg bg-red-950/60 p-3 text-sm text-red-200">{error}</p>}
          <button className={`${primaryBtn} w-full`} disabled={busy}>{busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}</button>
        </form>

        <p className="mt-6 text-sm text-mist">
          {isSignup ? 'Already have an account? ' : 'New here? '}
          <Link className="text-brass hover:underline" to={isSignup ? '/login' : '/signup'} state={location.state}>{isSignup ? 'Sign in' : 'Create an account'}</Link>
        </p>
      </div>
    </PageShell>
  );
}

export const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="mb-1.5 flex justify-between text-sm font-medium"><span>{label}</span>{hint && <span className="font-normal text-mist">{hint}</span>}</span>
    {children}
  </label>
);
