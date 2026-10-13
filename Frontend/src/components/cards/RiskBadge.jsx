import { normalizeRiskLevel } from "../../utils/risk";
import { formatPercent } from "../../utils/format";

const BADGE_STYLES = {
  Low: {
    container: "bg-risk-low/10 text-risk-low ring-1 ring-inset ring-risk-low/30",
    dot: "bg-risk-low",
  },
  Medium: {
    container: "bg-risk-medium/10 text-risk-medium ring-1 ring-inset ring-risk-medium/30",
    dot: "bg-risk-medium",
  },
  High: {
    container: "bg-risk-high/10 text-risk-high ring-1 ring-inset ring-risk-high/30",
    dot: "bg-risk-high",
  },
};

export default function RiskBadge({
  level,
  riskLevel,
  score,
  riskScore,
  showScore = true,
}) {
  const rawScore = score !== undefined ? score : riskScore;
  const resolvedLevel = normalizeRiskLevel(level || riskLevel || rawScore);
  const style = BADGE_STYLES[resolvedLevel] || BADGE_STYLES.Low;

  const hasNumericScore =
    showScore &&
    rawScore !== undefined &&
    rawScore !== null &&
    !Number.isNaN(Number(rawScore));

  const pctValue = hasNumericScore
    ? Number(rawScore) <= 1
      ? Number(rawScore) * 100
      : Number(rawScore)
    : null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap shadow-2xs ${style.container}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      <span>{resolvedLevel}</span>
      {pctValue !== null && (
        <span className="opacity-90 font-medium tabular-nums">
          ({formatPercent(pctValue, 0)})
        </span>
      )}
    </span>
  );
}
