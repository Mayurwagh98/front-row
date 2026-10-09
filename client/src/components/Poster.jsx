import { useEffect, useState } from "react";
import { normalizePosterUrl } from "../utils/poster.js";

/**
 * Movie poster with a fallback tile (initial on curtain red) when there's no image or it fails to load.
 * The fallback centres its letter with an absolutely-positioned layer, so it stays centred no matter
 * which `display` utility the caller passes in className (e.g. `hidden sm:block`).
 */
export default function Poster({ url, title = "", className = "" }) {
  const src = normalizePosterUrl(url);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={`${title} poster`}
        onError={() => setFailed(true)}
        referrerPolicy="no-referrer" // many image hosts block hotlinking when a Referer is sent
        loading="lazy"
        className={`object-cover ${className}`}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={`${title} (no poster)`}
      className={`relative overflow-hidden bg-gradient-to-br from-wine to-velvet ${className}`}
    >
      <span className="absolute inset-0 grid place-items-center font-display text-4xl font-black text-brass/80">
        {title.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
