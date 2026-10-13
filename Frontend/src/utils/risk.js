/**
 * Risk level palette colors and helper utilities for FraudGuard AI.
 * Strictly uses the configured Tailwind theme palette:
 * - Low:    #22C55E (risk-low)    [< 0.30]
 * - Medium: #F59E0B (risk-medium) [0.30 to 0.70]
 * - High:   #EF4444 (risk-high)   [> 0.70]
 */

export const riskColors = {
  Low: "#22C55E",
  Medium: "#F59E0B",
  High: "#EF4444",
  low: "#22C55E",
  medium: "#F59E0B",
  high: "#EF4444",
};

/**
 * Determine the risk level ("Low" | "Medium" | "High") from a numeric score (0-1 or 0-100)
 * or normalize an existing risk level string.
 *
 * Thresholds match Backend/app/services/ml_service.py:
 * - Low:    score < 0.30
 * - Medium: 0.30 <= score <= 0.70
 * - High:   score > 0.70
 *
 * @param {string|number} levelOrScore - Risk tier label or numeric probability score.
 * @returns {"Low"|"Medium"|"High"} Normalized risk level.
 */
export function getRiskLevel(levelOrScore) {
  if (typeof levelOrScore === "string") {
    const cleaned = levelOrScore.trim().toLowerCase();
    if (cleaned === "high") return "High";
    if (cleaned === "medium") return "Medium";
    if (cleaned === "low") return "Low";
  }

  if (typeof levelOrScore === "number" && !Number.isNaN(levelOrScore)) {
    const normalizedScore =
      levelOrScore > 1 ? levelOrScore / 100 : levelOrScore;
    if (normalizedScore > 0.7) return "High";
    if (normalizedScore >= 0.3) return "Medium";
    return "Low";
  }

  return "Low";
}

export const normalizeRiskLevel = getRiskLevel;

/**
 * Return hex color for a given risk level or numeric score.
 *
 * @param {string|number} levelOrScore - Risk level or score.
 * @returns {string} Hex color string.
 */
export function getRiskColor(levelOrScore) {
  const level = getRiskLevel(levelOrScore);
  return riskColors[level] || riskColors.Low;
}

export const RISK_RECOMMENDATIONS = {
  High: "Review immediately and consider holding the transaction.",
  Medium: "Manual review required.",
  Low: "No action required.",
};

/**
 * Return the consistent analyst recommendation for a given risk level or score:
 * - High   -> "Review immediately and consider holding the transaction."
 * - Medium -> "Manual review required."
 * - Low    -> "No action required."
 *
 * @param {string|number} levelOrScore - Risk level or numeric probability score.
 * @returns {string} Analyst recommendation string.
 */
export function getRiskRecommendation(levelOrScore) {
  const level = getRiskLevel(levelOrScore);
  return RISK_RECOMMENDATIONS[level] || RISK_RECOMMENDATIONS.Low;
}

