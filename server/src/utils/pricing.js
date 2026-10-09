// Single source of truth for pricing rules. Totals are ALWAYS computed here on the server;
// the client only mirrors the maths for display (using the rates the API sends back).
export const PRICING = {
  feePerTicket: 30,  // convenience fee per ticket (₹)
  gstRate: 0.18,     // GST charged on the convenience fee
};

const round2 = (n) => Math.round(n * 100) / 100;

/** seats: Seat docs/objects with a `price`. fallbackPrice covers legacy seats without one. */
export function computeTotals(seats, fallbackPrice = 0) {
  const subtotal = seats.reduce((sum, s) => sum + (s.price ?? fallbackPrice), 0);
  const convenienceFee = seats.length * PRICING.feePerTicket;
  const tax = round2(convenienceFee * PRICING.gstRate);
  return { subtotal, convenienceFee, tax, total: round2(subtotal + convenienceFee + tax) };
}
