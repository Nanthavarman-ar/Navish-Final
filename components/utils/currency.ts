// Every cost estimate in this app is computed in USD (CostEstimator's underlying
// material/labor/overhead database is USD-denominated) - this is a display-only
// conversion to Indian Rupees, not a live FX feed. Shared so the rate/format stays
// consistent across the cost-related panels (Cost Estimator, Budget Tiers, ROI).
export const USD_TO_INR = 83;

export function formatINR(usdAmount: number): string {
  return `₹${(usdAmount * USD_TO_INR).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
