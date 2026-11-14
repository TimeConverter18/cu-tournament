import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { fetchCalendar } from "../api";
import type { CalendarResponse, MetaResponse, RouteMeta } from "../types";
import { formatCompactRub, formatInt, formatPrice, formatShortDay } from "../utils";

interface CalendarViewProps {
  meta: MetaResponse;
  selectedRouteCode: string;
  onSelectRoute: (route: RouteMeta) => void;
  onPickDayForCalc: (routeCode: string, date: string, optimalPrice: number) => void;
  onUnauthorized: () => void;
}

export default function CalendarView({
  meta,
  selectedRouteCode,
  onSelectRoute,
  onPickDayForCalc,
  onUnauthorized,
}: CalendarViewProps) {
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchCalendar(selectedRouteCode, onUnauthorized)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Не удалось загрузить календарь");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRouteCode, onUnauthorized]);

  const summary = useMemo(() => {
    if (!data?.days?.length) return null;
    const days = data.days;
    const avgOptPrice = days.reduce((a, b) => a + b.optimal_price, 0) / days.length;
    const totalOptMargin = days.reduce((a, b) => a + b.optimal_margin, 0);
    const totalGain = days.reduce((a, b) => a + b.margin_gain, 0);
    const cappedDays = days.filter((d) => d.capped_at_base).length;
    const peakDay = days.reduce((best, cur) => (cur.d50 > best.d50 ? cur : best), days[0]);
    return { avgOptPrice, totalOptMargin, totalGain, cappedDays, peakDay };
  }, [data]);

  return (
    <div className="space-y-5">
      <div className="flex overflow-x-auto rounded-2xl border bg-card divide-x -mx-4 sm:mx-0 sm:grid sm:grid-cols-5">
        {meta.routes.map((r) => {
          const active = r.route === selectedRouteCode;
          const iata = r.route.split("-")[1];
          return (
            <button
              key={r.route}
              type="button"
              onClick={() => onSelectRoute(r)}
              className={`relative min-w-[136px] sm:min-w-0 min-h-[48px] px-4 py-3 flex items-center justify-between gap-2 text-sm font-medium shrink-0 transition-colors cursor-pointer ${
                active ? "bg-primary/8 text-foreground font-semibold" : "hover:bg-muted/50 text-muted-foreground"
              }`}
            >
              {active && <span className="absolute inset-x-0 top-0 h-[3px] bg-primary" />}
              <span className="truncate">{r.destination}</span>
              <span className={`font-mono text-xs ${active ? "text-primary" : ""}`}>{iata}</span>
            </button>
          );
        })}
      </div>

      {summary && (
        <Card>
          <CardContent className="p-0 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x">
            <div className="p-4">
              <div className="text-xs text-muted-foreground">Средняя цена</div>
              <div className="mt-1 font-mono text-lg sm:text-xl font-bold text-foreground">
                {formatPrice(summary.avgOptPrice)}
              </div>
            </div>

            <div className="p-4">
              <div className="text-xs text-muted-foreground">Маржа за месяц</div>
              <div className="mt-1 font-mono text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-400">
                {formatCompactRub(summary.totalOptMargin)}
              </div>
              <div className="mt-0.5 text-[11px] font-mono text-muted-foreground">
                +{formatCompactRub(summary.totalGain)} к базовой
              </div>
            </div>

            <div className="p-4">
              <div className="text-xs text-muted-foreground">Пиковый спрос</div>
              <div className="mt-1 font-mono text-lg sm:text-xl font-bold text-foreground">
                {formatInt(summary.peakDay.d50)} чел.
              </div>
              <div className="mt-0.5 text-[11px] font-mono text-muted-foreground">
                {summary.peakDay.date}
              </div>
            </div>

            <div className="p-4">
              <div className="text-xs text-muted-foreground">Дней с аншлагом</div>
              <div className="mt-1 font-mono text-lg sm:text-xl font-bold text-foreground">
                {summary.cappedDays}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  / {data?.days.length ?? 31}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="border-b flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="font-display text-base font-bold">
              Расписание прогноза · {data?.route.name || selectedRouteCode}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Нажмите на любой день для перехода в калькулятор
            </CardDescription>
          </div>
          {loading && <span className="text-xs font-mono text-muted-foreground">Загрузка...</span>}
        </CardHeader>

        <div className="divide-y">
          {data?.days.map((d) => {
            const { dayNum, weekday, monthShort, isWeekend } = formatShortDay(d.date);
            const isHoliday = d.date === "2026-06-12";
            const fillPct = Math.min(100, (d.d50 / Math.max(1, d.seats)) * 100);

            return (
              <button
                key={d.date}
                type="button"
                onClick={() => onPickDayForCalc(selectedRouteCode, d.date, d.optimal_price)}
                className="w-full px-4 sm:px-6 py-3.5 min-h-[60px] flex items-center justify-between gap-3 text-left hover:bg-muted/50 active:bg-muted transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 font-mono ${
                      isHoliday
                        ? "bg-primary text-primary-foreground"
                        : isWeekend
                          ? "bg-secondary text-secondary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className="text-sm font-bold leading-none">{dayNum}</span>
                    <span className="text-[10px] uppercase mt-0.5 opacity-80">{weekday}</span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <span>
                        {dayNum} {monthShort}
                      </span>
                      {isHoliday && (
                        <span className="text-xs font-medium text-primary">· День России</span>
                      )}
                      {d.capped_at_base && (
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                          · Аншлаг
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs font-mono text-muted-foreground">
                      <span>
                        Спрос {formatInt(d.d50)} (от {formatInt(d.d10)} до {formatInt(d.d90)})
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Мест {formatInt(d.seats)}</span>
                    </div>
                    <Progress value={fillPct} className="mt-1.5 h-1 w-32 sm:w-44" />
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-right">
                  <div>
                    <div className="font-mono text-sm sm:text-base font-bold text-foreground">
                      {formatPrice(d.optimal_price)}
                    </div>
                    <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                      {formatCompactRub(d.optimal_margin)}
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
