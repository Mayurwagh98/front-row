// Display-only mirror of server/src/utils/pricing.js. The server is authoritative at booking time.
const round2 = (n) => Math.round(n * 100) / 100;

export function calcTotals(seats, pricing, fallbackPrice = 0) {
  const subtotal = seats.reduce((s, x) => s + (x.price ?? fallbackPrice), 0);
  const convenienceFee = seats.length * (pricing?.feePerTicket ?? 0);
  const tax = round2(convenienceFee * (pricing?.gstRate ?? 0));
  return {
    subtotal,
    convenienceFee,
    tax,
    total: round2(subtotal + convenienceFee + tax),
  };
}

export const inr = (n) =>
  `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
