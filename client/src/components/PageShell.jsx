import Header from "./Header.jsx";

export default function PageShell({ children, width = "max-w-3xl" }) {
  return (
    <div className={`mx-auto px-5 py-8 pb-16 sm:px-8 ${width}`}>
      <Header />
      <main className="mt-12">{children}</main>
    </div>
  );
}
