import type { ScenarioOut } from "../types";
import { formatInt } from "../utils";

interface QuantileRangeChartProps {
  scenarios: ScenarioOut[];
  seats: number;
}

export default function QuantileRangeChart({ scenarios, seats }: QuantileRangeChartProps) {
  if (!scenarios.length) return null;

  const maxVal = Math.max(seats * 1.15, ...scenarios.map((s) => s.wanted), 50);
  const seatsPct = Math.min(100, (seats / maxVal) * 100);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Желающие купить билет по 9 сценариям при выбранной цене</span>
        <span className="font-mono text-foreground">
          Вместимость борта: {formatInt(seats)} мест
        </span>
      </div>

      <div className="space-y-2 rounded-xl border bg-background/60 p-3">
        {scenarios.map((s) => {
          const wantedPct = Math.min(100, (s.wanted / maxVal) * 100);
          const isMedian = Math.abs(s.quantile - 0.5) < 1e-6;
          const isOver = s.wanted > seats;

          return (
            <div key={s.quantile} className="grid grid-cols-[44px_1fr_76px] items-center gap-3">
              <div
                className={`text-xs font-mono ${
                  isMedian ? "font-semibold text-primary" : "text-muted-foreground"
                }`}
              >
                q {s.quantile.toFixed(1)}
              </div>

              <div className="relative h-6 rounded-md bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-md transition-all duration-150 ${
                    isMedian
                      ? "bg-primary"
                      : isOver
                        ? "bg-amber-500/80"
                        : "bg-muted-foreground/45"
                  }`}
                  style={{ width: `${Math.max(2, wantedPct)}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-destructive/80"
                  style={{ left: `${seatsPct}%` }}
                  title={`Вместимость: ${seats} мест`}
                />
              </div>

              <div className="text-right font-mono text-xs text-foreground">
                {formatInt(s.wanted)} чел.
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
