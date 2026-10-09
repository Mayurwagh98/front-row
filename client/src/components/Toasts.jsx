const TONE = {
  info: "border-brass/40 bg-velvet text-paper",
  error: "border-red-400/50 bg-[#3a1620] text-red-100",
  success: "border-emerald-400/50 bg-[#12301f] text-emerald-100",
};

export default function Toasts({ toasts, onDismiss }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className={`pointer-events-auto max-w-sm animate-toast-in rounded-xl border px-4 py-3 text-left text-sm shadow-xl ${TONE[t.kind]}`}
        >
          {t.msg}
        </button>
      ))}
    </div>
  );
}
