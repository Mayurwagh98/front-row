// Shared class strings so forms look the same everywhere.
export const inputCls = 'w-full rounded-lg bg-velvet px-3.5 py-2.5 text-sm text-paper ring-1 ring-white/10 placeholder:text-mist/60 focus:outline-none focus:ring-brass';
export const primaryBtn = 'rounded-xl bg-brass px-5 py-3 font-bold text-ink transition hover:bg-[#e2bb6c] disabled:opacity-50';
export const ghostBtn = 'rounded-xl border border-white/15 px-5 py-3 font-semibold transition hover:bg-white/5';
export const errMsg = (e, fallback = 'Something went wrong. Try again.') => e.response?.data?.message || fallback;
