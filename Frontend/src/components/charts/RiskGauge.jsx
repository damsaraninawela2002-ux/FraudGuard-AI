import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { getRiskColor, getRiskLevel, riskColors } from "../../utils/risk";
import { formatPercent } from "../../utils/format";

const ZONES_DATA = [
  { name: "Low (<30%)", value: 30, color: riskColors.Low },
  { name: "Medium (30–70%)", value: 40, color: riskColors.Medium },
  { name: "High (>70%)", value: 30, color: riskColors.High },
];

export default function RiskGauge({ score = 0, riskLevel }) {
  const numericScore = Number(score);
  const clampedScore = Number.isNaN(numericScore)
    ? 0
    : Math.max(0, Math.min(1, numericScore > 1 ? numericScore / 100 : numericScore));

  const pct = clampedScore * 100;
  const resolvedLevel = riskLevel || getRiskLevel(clampedScore);
  const activeColor = getRiskColor(resolvedLevel);

  const scoreArcData = [
    { name: "Score", value: pct },
    { name: "Remaining", value: Math.max(0, 100 - pct) },
  ];

  return (
    <div className="flex flex-col items-center">
      {/* Semicircle Recharts Gauge */}
      <div className="relative h-48 w-full max-w-xs">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {/* Outer Reference Track: 3 Risk Zones */}
            <Pie
              data={ZONES_DATA}
              dataKey="value"
              cx="50%"
              cy="80%"
              startAngle={180}
              endAngle={0}
              innerRadius={86}
              outerRadius={96}
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {ZONES_DATA.map((zone) => (
                <Cell key={zone.name} fill={zone.color} fillOpacity={0.25} />
              ))}
            </Pie>

            {/* Inner Animated Filled Score Arc */}
            <Pie
              data={scoreArcData}
              dataKey="value"
              cx="50%"
              cy="80%"
              startAngle={180}
              endAngle={0}
              innerRadius={62}
              outerRadius={80}
              stroke="none"
              isAnimationActive={true}
              animationDuration={800}
            >
              <Cell fill={activeColor} />
              <Cell fill="#F1F5F9" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Centered Score Display */}
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex flex-col items-center justify-end text-center">
          <span
            className="text-3xl font-bold tracking-tight tabular-nums"
            style={{ color: activeColor }}
          >
            {formatPercent(pct, 1)}
          </span>
          <span className="mt-0.5 text-xs font-semibold text-slate-500 tabular-nums">
            Probability ({clampedScore.toFixed(4)})
          </span>
        </div>
      </div>

      {/* 3 Zone Legend */}
      <div className="mt-3 grid w-full grid-cols-3 gap-2.5 border-t border-slate-100 pt-3 text-center text-xs">
        <div className="rounded-xl bg-surface px-2.5 py-2 border border-slate-100">
          <div className="flex items-center justify-center gap-1.5 font-bold text-navy">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: riskColors.Low }}
            />
            <span>Low</span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">&lt; 30%</p>
        </div>

        <div className="rounded-xl bg-surface px-2.5 py-2 border border-slate-100">
          <div className="flex items-center justify-center gap-1.5 font-bold text-navy">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: riskColors.Medium }}
            />
            <span>Medium</span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">30% – 70%</p>
        </div>

        <div className="rounded-xl bg-surface px-2.5 py-2 border border-slate-100">
          <div className="flex items-center justify-center gap-1.5 font-bold text-navy">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: riskColors.High }}
            />
            <span>High</span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">&gt; 70%</p>
        </div>
      </div>
    </div>
  );
}
