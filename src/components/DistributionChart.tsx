import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { ScenarioOut } from "../types";
import { buildDistributionData, formatInt } from "../utils";

interface DistributionChartProps {
  scenarios: ScenarioOut[];
  seats: number;
}

export default function DistributionChart({ scenarios, seats }: DistributionChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { points, domainMin, domainMax, d5, rawD5, sorted } = useMemo(
    () => buildDistributionData(scenarios, seats),
    [scenarios, seats]
  );

  const exceedCount = useMemo(
    () => sorted.filter((s) => s.wanted > seats).length,
    [sorted, seats]
  );

  if (points.length < 2) return null;

  const width = 640;
  const height = 260;
  const padL = 50;
  const padR = 18;
  const padT = 26;
  const padB = 34;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const spanX = Math.max(1, domainMax - domainMin);
  const maxDensity = Math.max(0.05, ...points.map((p) => p.density)) * 1.18;

  const xOf = (x: number) => padL + ((x - domainMin) / spanX) * innerW;
  const yOf = (d: number) => padT + innerH - (d / maxDensity) * innerH;
  const baseY = padT + innerH;

  let linePath = "";
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const px = xOf(p.x);
    const py = yOf(p.density);
    if (i === 0) {
      linePath += `M${px.toFixed(1)},${py.toFixed(1)}`;
    } else {
      const prevY = yOf(points[i - 1].density);
      linePath += ` L${px.toFixed(1)},${prevY.toFixed(1)} L${px.toFixed(1)},${py.toFixed(1)}`;
    }
  }
  const lastX = xOf(points[points.length - 1].x);
  const firstX = xOf(points[0].x);
  const areaPath = `${linePath} L${lastX.toFixed(1)},${baseY.toFixed(1)} L${firstX.toFixed(1)},${baseY.toFixed(1)} Z`;

  const seatsX = xOf(Math.min(Math.max(seats, domainMin), domainMax));
  const medianX = xOf(Math.min(Math.max(d5, domainMin), domainMax));
  const overAreaW = Math.max(0, padL + innerW - seatsX);

  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(domainMin + t * spanX));
  const yTicks = [0, 0.33, 0.67, 1].map((t) => t * maxDensity);

  const stepIntervals = points.filter((p) => !p.isBoundary && p.intervalFrom !== null && p.intervalTo !== null);
  const activeStep = hoverIdx !== null ? stepIntervals[hoverIdx] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs sm:text-sm font-medium text-foreground" data-testid="distribution-summary">
          В {exceedCount} из 9 сценариев спрос превышает число мест
        </p>
        <Badge variant={exceedCount >= 5 ? "default" : "secondary"} className="font-mono">
          Превышение мест: {exceedCount}/9
        </Badge>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-mono">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            Медиана: {formatInt(d5)} чел.
            {rawD5 < 0 ? ` (расч. ${formatInt(rawD5)})` : ""}
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
            Мест: {formatInt(seats)}
          </span>
        </div>

        {activeStep && (
          <div className="font-mono text-foreground">
            {formatInt(activeStep.intervalFrom!)}-{formatInt(activeStep.intervalTo!)} чел. · {activeStep.probMass}% ({activeStep.density.toFixed(2)}%/чел.)
          </div>
        )}
      </div>

      <div className="w-full overflow-hidden rounded-xl border bg-background/60 p-2 sm:p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none touch-pan-y"
          role="img"
          aria-label="Ступенчатое распределение спроса по 9 сценариям и вместимость самолёта"
          onMouseLeave={() => setHoverIdx(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * width;
            const xVal = domainMin + ((relX - padL) / innerW) * spanX;
            const foundIdx = stepIntervals.findIndex(
              (s) => xVal >= (s.intervalFrom ?? 0) && xVal <= (s.intervalTo ?? 0)
            );
            setHoverIdx(foundIdx >= 0 ? foundIdx : null);
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
                  {val.toFixed(2)}%
                </text>
              </g>
            );
          })}

          {overAreaW > 0 && (
            <rect
              x={seatsX}
              y={padT}
              width={overAreaW}
              height={innerH}
              className="fill-destructive/10"
            />
          )}

          <path d={areaPath} className="fill-primary/20" />
          <path
            d={linePath}
            fill="none"
            className="stroke-primary"
            strokeWidth={2}
          />

          {activeStep && activeStep.intervalFrom !== null && activeStep.intervalTo !== null && (
            <rect
              x={xOf(activeStep.intervalFrom)}
              y={yOf(activeStep.density)}
              width={Math.max(2, xOf(activeStep.intervalTo) - xOf(activeStep.intervalFrom))}
              height={Math.max(1, baseY - yOf(activeStep.density))}
              className="fill-primary/30 stroke-primary"
              strokeWidth={1.5}
            />
          )}

          <line
            x1={medianX}
            x2={medianX}
            y1={padT}
            y2={baseY}
            className="stroke-primary"
            strokeWidth={2}
            strokeDasharray="4 4"
          />
          <text
            x={medianX}
            y={padT - 8}
            textAnchor="middle"
            className="fill-primary text-[11px] font-mono font-semibold"
          >
            q0.5: {formatInt(d5)}
          </text>

          <line
            x1={seatsX}
            x2={seatsX}
            y1={padT}
            y2={baseY}
            className="stroke-destructive"
            strokeWidth={2}
          />
          <text
            x={seatsX}
            y={Math.abs(medianX - seatsX) < 70 ? padT + 14 : padT - 8}
            textAnchor={seatsX > width - 85 ? "end" : "middle"}
            className="fill-destructive text-[11px] font-mono font-semibold"
          >
            Мест: {formatInt(seats)}
          </text>

          {xTicks.map((val, i) => (
            <text
              key={i}
              x={xOf(val)}
              y={height - 10}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px] font-mono"
            >
              {formatInt(val)}
            </text>
          ))}
        </svg>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Между соседними квантилями (0.1-0.9) с вероятностью 10 % окажется реальный спрос; красная линия показывает число мест в самолёте (правее неё лишний спрос ограничивается вместимостью).
      </p>
    </div>
  );
}
