import { useMemo, useState } from "react";
import type { PredictResponse } from "../types";
import { buildProfitCurvePoints, formatCompactRub, formatPrice } from "../utils";

interface ProfitChartProps {
  result: PredictResponse;
}

export default function ProfitChart({ result }: ProfitChartProps) {
  const points = useMemo(() => buildProfitCurvePoints(result), [result]);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (points.length < 2) return null;

  const width = 640;
  const height = 250;
  const padL = 56;
  const padR = 20;
  const padT = 22;
  const padB = 34;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const minP = points[0].price;
  const maxP = points[points.length - 1].price;
  const pSpan = Math.max(1, maxP - minP);

  const allMargins = points.flatMap((p) => [p.margin01, p.margin05, p.margin09, 0]);
  const minM = Math.min(0, ...allMargins);
  const maxM = Math.max(100_000, ...allMargins) * 1.08;
  const mSpan = Math.max(1, maxM - minM);

  const xOf = (price: number) => padL + ((price - minP) / pSpan) * innerW;
  const yOf = (margin: number) => padT + innerH - ((margin - minM) / mSpan) * innerH;

  const line05 = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.price).toFixed(1)},${yOf(p.margin05).toFixed(1)}`)
    .join(" ");

  const bandPath =
    points
      .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.price).toFixed(1)},${yOf(p.margin09).toFixed(1)}`)
      .join(" ") +
    " " +
    points
      .slice()
      .reverse()
      .map((p) => `L${xOf(p.price).toFixed(1)},${yOf(p.margin01).toFixed(1)}`)
      .join(" ") +
    " Z";

  const clampedUserPrice = Math.min(Math.max(result.price, minP), maxP);
  const userX = xOf(clampedUserPrice);
  const userY = yOf(result.margin);

  const optX = xOf(Math.min(Math.max(result.optimal_price, minP), maxP));
  const optY = yOf(result.optimal_margin);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => minM + t * (maxM - minM));
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(minP + t * pSpan));

  const activePoint = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            Медиана (0.5)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm bg-primary/20 border border-primary/40" />
            Коридор 0.1-0.9
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            Оптимум ({formatPrice(result.optimal_price)})
          </span>
        </div>
        {activePoint && (
          <div className="font-mono text-foreground">
            {formatPrice(activePoint.price)} · маржа {formatCompactRub(activePoint.margin05)}
          </div>
        )}
      </div>

      <div className="w-full overflow-hidden rounded-xl border bg-background/60 p-2 sm:p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none touch-pan-y"
          role="img"
          aria-label="График зависимости маржинальной прибыли от цены билета"
          onMouseLeave={() => setHoverIdx(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * width;
            let nearest = 0;
            let bestDist = Infinity;
            points.forEach((p, idx) => {
              const d = Math.abs(xOf(p.price) - relX);
              if (d < bestDist) {
                bestDist = d;
                nearest = idx;
              }
            });
            setHoverIdx(nearest);
          }}
        >
          {yTicks.map((val, i) => {
            const y = yOf(val);
            return (
              <g key={i}>
                <line
                  x1={padL}
                  x2={width - padR}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  className="text-border"
                  strokeDasharray={i === 0 ? undefined : "3 3"}
                />
                <text
                  x={padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px] font-mono"
                >
                  {(val / 1_000_000).toFixed(1)}M
                </text>
              </g>
            );
          })}

          {xTicks.map((val, i) => (
            <text
              key={i}
              x={xOf(val)}
              y={height - 10}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px] font-mono"
            >
              {Math.round(val / 1000)}k
            </text>
          ))}

          <path d={bandPath} className="fill-primary/14" />

          <path
            d={line05}
            fill="none"
            className="stroke-primary"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <line
            x1={optX}
            x2={optX}
            y1={padT}
            y2={padT + innerH}
            className="stroke-emerald-600 dark:stroke-emerald-400"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          <circle
            cx={optX}
            cy={optY}
            r={5.5}
            className="fill-emerald-600 dark:fill-emerald-400 stroke-background"
            strokeWidth={2}
          />

          {!result.price_out_of_range && (
            <>
              <line
                x1={userX}
                x2={userX}
                y1={padT}
                y2={padT + innerH}
                className="stroke-foreground/50"
                strokeWidth={1.5}
              />
              <circle
                cx={userX}
                cy={userY}
                r={5.5}
                className="fill-foreground stroke-background"
                strokeWidth={2}
              />
            </>
          )}

          {activePoint && (
            <g>
              <line
                x1={xOf(activePoint.price)}
                x2={xOf(activePoint.price)}
                y1={padT}
                y2={padT + innerH}
                className="stroke-muted-foreground/60"
                strokeWidth={1}
              />
              <circle
                cx={xOf(activePoint.price)}
                cy={yOf(activePoint.margin05)}
                r={4}
                className="fill-primary"
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
