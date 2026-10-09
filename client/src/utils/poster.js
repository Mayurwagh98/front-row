/**
 * People often paste a Google Images result link, which is a web page, not an image.
 * Those links carry the real image address in the `imgurl` query parameter, so unwrap it.
 */
export function normalizePosterUrl(raw) {
  if (!raw) return "";
  try {
    const u = new URL(raw.trim());
    if (
      /(^|\.)google\.[a-z.]+$/i.test(u.hostname) &&
      u.pathname === "/imgres"
    ) {
      const inner = u.searchParams.get("imgurl");
      if (inner) return inner;
    }
    return u.href;
  } catch {
    return raw;
  }
}
