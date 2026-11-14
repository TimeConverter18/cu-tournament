import { useMemo, useState } from "react";
import { ru } from "react-day-picker/locale";
import {
  AlertTriangle,
  ArrowRight,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Info,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MetaResponse, PredictResponse, RouteMeta } from "../types";
import {
  formatCompactRub,
  formatInt,
  formatPrice,
  formatRussianDate,
  shiftIsoDate,
} from "../utils";
import DistributionChart from "./DistributionChart";
import ProfitChart from "./ProfitChart";
import QuantileRangeChart from "./QuantileRangeChart";

interface CalculatorViewProps {
  meta: MetaResponse;
  selectedRouteCode: string;
  onSelectRoute: (route: RouteMeta) => void;
  date: string;
  onChangeDate: (date: string) => void;
  price: number;
  onChangePrice: (price: number) => void;
  result: PredictResponse | null;
  loading: boolean;
  error: string;
}

type DetailTab = "profit" | "distribution" | "quantiles" | "table";

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CalculatorView({
  meta,
  selectedRouteCode,
  onSelectRoute,
  date,
  onChangeDate,
  price,
  onChangePrice,
  result,
  loading,
  error,
}: CalculatorViewProps) {
  const [detailTab, setDetailTab] = useState<DetailTab>("distribution");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const activeRoute = useMemo(
    () => meta.routes.find((r) => r.route === selectedRouteCode) || meta.routes[0],
    [meta.routes, selectedRouteCode]
  );

  const selectedDateObj = useMemo(() => parseLocalDate(date), [date]);
  const minMonth = useMemo(() => parseLocalDate(meta.date_min), [meta.date_min]);
  const maxMonth = useMemo(() => parseLocalDate(meta.date_max), [meta.date_max]);

  const canPrevDate = date > meta.date_min;
  const canNextDate = date < meta.date_max;

  const optPriceRounded = result ? Math.round(result.optimal_price) : 0;
  const marginDiff = result ? result.optimal_margin - result.margin : 0;
  const showOptimalCta =
    result && optPriceRounded > 0 && Math.abs(optPriceRounded - Math.round(price)) >= 25;

  const loadFactor = result ? Math.min(100, Math.max(0, result.load_factor)) : 0;
  const freeSeats = result ? Math.max(0, result.seats - Math.round(result.sold)) : 0;

  const sliderVal = activeRoute
    ? Math.min(Math.max(price, activeRoute.price_min), activeRoute.price_max)
    : price;

  return (
    <div className="space-y-5">
      <section aria-label="Выбор маршрута" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-lg sm:text-xl font-bold tracking-tight text-foreground">
              Направление вылета · июнь 2026
            </h1>
          </div>

          <div className="w-full sm:w-64">
            <Select
              value={activeRoute?.route}
              onValueChange={(val) => {
                if (typeof val !== "string") return;
                const found = meta.routes.find((r) => r.route === val);
                if (found) onSelectRoute(found);
              }}
            >
              <SelectTrigger aria-label="Выбрать маршрут из списка" className="w-full h-10 bg-card">
                <SelectValue>
                  {activeRoute ? `${activeRoute.name} (${activeRoute.route})` : "Выберите маршрут"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {meta.routes.map((r) => (
                  <SelectItem key={r.route} value={r.route}>
                    <span>{r.name}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {r.route}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex overflow-x-auto rounded-2xl border bg-card divide-x -mx-4 sm:mx-0 sm:grid sm:grid-cols-5">
          {meta.routes.map((r) => {
            const isSelected = r.route === activeRoute?.route;
            const iata = r.route.split("-")[1];
            return (
              <button
                key={r.route}
                type="button"
                onClick={() => onSelectRoute(r)}
                className={`relative min-w-[144px] sm:min-w-0 min-h-[64px] px-4 py-3 flex flex-col justify-between text-left transition-colors shrink-0 cursor-pointer ${
                  isSelected
                    ? "bg-primary/8 text-foreground"
                    : "hover:bg-muted/50 text-foreground"
                }`}
              >
                {isSelected && (
                  <span className="absolute inset-x-0 top-0 h-[3px] bg-primary" />
                )}
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="font-display font-bold text-sm truncate">{r.destination}</span>
                  <span
                    className={`font-mono text-[11px] font-semibold ${
                      isSelected ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {iata}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs font-mono text-muted-foreground">
                  <span>База</span>
                  <span className={isSelected ? "text-foreground font-semibold" : undefined}>
                    {formatPrice(r.base_price)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <Card className="lg:col-span-5">
          <CardContent className="pt-5 space-y-5">
            {activeRoute && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Откуда
                  </Label>
                  <div className="h-10 px-3 rounded-md border bg-muted/40 flex items-center text-sm font-medium text-foreground">
                    {activeRoute.origin}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Куда
                  </Label>
                  <Select
                    value={activeRoute.route}
                    onValueChange={(val) => {
                      if (typeof val !== "string") return;
                      const found = meta.routes.find((r) => r.route === val);
                      if (found) onSelectRoute(found);
                    }}
                  >
                    <SelectTrigger aria-label="Пункт назначения" className="w-full h-10 bg-background">
                      <SelectValue>{activeRoute.destination}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {meta.routes.map((r) => (
                        <SelectItem key={r.route} value={r.route}>
                          <span>{r.destination}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="flight-date-picker" className="text-xs font-semibold text-muted-foreground">
                  Дата вылета
                </Label>
                <Button
                  type="button"
                  variant={date === "2026-06-12" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => onChangeDate("2026-06-12")}
                  className="h-7 px-2.5 text-xs"
                >
                  12 июня · праздник
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!canPrevDate}
                  onClick={() => canPrevDate && onChangeDate(shiftIsoDate(date, -1))}
                  aria-label="Предыдущий день"
                  className="h-11 w-11 shrink-0"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>

                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        id="flight-date-picker"
                        type="button"
                        variant="outline"
                        className="flex-1 h-11 justify-start gap-2.5 px-3.5 font-normal bg-background hover:bg-muted/50"
                      />
                    }
                  >
                    <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-mono text-sm font-medium truncate">
                      {formatRussianDate(date)}
                    </span>
                  </PopoverTrigger>
                  <PopoverContent align="center" className="w-auto p-2">
                    <Calendar
                      mode="single"
                      locale={ru}
                      selected={selectedDateObj}
                      defaultMonth={selectedDateObj}
                      startMonth={minMonth}
                      endMonth={maxMonth}
                      disabled={(d) => {
                        const iso = toIsoLocal(d);
                        return iso < meta.date_min || iso > meta.date_max;
                      }}
                      onSelect={(picked) => {
                        if (!picked) return;
                        const iso = toIsoLocal(picked);
                        if (iso >= meta.date_min && iso <= meta.date_max) {
                          onChangeDate(iso);
                          setCalendarOpen(false);
                        }
                      }}
                      className="w-full [--cell-size:--spacing(9)]"
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!canNextDate}
                  onClick={() => canNextDate && onChangeDate(shiftIsoDate(date, 1))}
                  aria-label="Следующий день"
                  className="h-11 w-11 shrink-0"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <Separator />

            {activeRoute && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="ticket-price-input" className="text-xs font-semibold text-muted-foreground">
                    Цена билета
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onChangePrice(Math.round(activeRoute.base_price))}
                    className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Базовая ({formatPrice(activeRoute.base_price)})</span>
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => onChangePrice(Math.max(0, Math.round(price) - 250))}
                    aria-label="Уменьшить цену на 250 рублей"
                    className="h-12 w-12 shrink-0"
                  >
                    <Minus className="h-5 w-5" />
                  </Button>

                  <div className="relative flex-1">
                    <Input
                      id="ticket-price-input"
                      type="number"
                      inputMode="numeric"
                      value={price}
                      min={0}
                      step={50}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (Number.isFinite(val) && val >= 0) {
                          onChangePrice(val);
                        }
                      }}
                      aria-label="Цена билета в рублях"
                      className="h-12 pr-8 font-mono font-bold text-xl text-center bg-background"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
                      ₽
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => onChangePrice(Math.round(price) + 250)}
                    aria-label="Увеличить цену на 250 рублей"
                    className="h-12 w-12 shrink-0"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>

                <div className="space-y-2.5 pt-1">
                  <Slider
                    min={activeRoute.price_min}
                    max={activeRoute.price_max}
                    step={50}
                    value={[sliderVal]}
                    onValueChange={(vals) => {
                      const next = Array.isArray(vals) ? vals[0] : vals;
                      if (typeof next === "number" && Number.isFinite(next)) {
                        onChangePrice(next);
                      }
                    }}
                    aria-label="Ползунок цены билета"
                  />
                  <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                    <span>{formatPrice(activeRoute.price_min)}</span>
                    <span>Расходы {formatPrice(activeRoute.cost_per_passenger)}/чел</span>
                    <span>{formatPrice(activeRoute.price_max)}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-7 space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardDescription className="font-mono text-xs">
                      {result.route} · {formatRussianDate(result.date)} ·{" "}
                      {result.capped
                        ? "Аншлаг (ограничено вместимостью)"
                        : `Свободно ${freeSeats} мест`}
                    </CardDescription>
                    <CardTitle className="mt-1 font-display text-xl sm:text-2xl font-bold tracking-tight">
                      {result.route_name}
                    </CardTitle>
                  </div>
                  {loading && (
                    <span className="text-xs text-muted-foreground font-mono">Расчёт...</span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                {result.price_out_of_range && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-xs">
                      Цена вне рекомендуемого коридора: от {formatInt(result.price_min)} до{" "}
                      {formatInt(result.price_max)} ₽
                    </AlertDescription>
                  </Alert>
                )}

                <div className="rounded-xl bg-foreground text-background dark:bg-accent dark:text-accent-foreground p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium opacity-75">
                      <span>Рекомендуемый тариф</span>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              aria-label="Как рассчитывается оптимальная цена"
                              className="inline-flex opacity-80 hover:opacity-100"
                            />
                          }
                        >
                          <Info className="h-3.5 w-3.5" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Максимизирует маржу (цена − расходы) × продажи с учётом вместимости борта.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-baseline gap-2.5 flex-wrap">
                      <span className="font-mono text-2xl font-bold">
                        {formatPrice(optPriceRounded)}
                      </span>
                      <span className="text-xs font-mono opacity-85">
                        {marginDiff > 500
                          ? `+${formatCompactRub(marginDiff)} к марже`
                          : "Цена уже в оптимуме"}
                      </span>
                    </div>
                  </div>

                  {showOptimalCta && (
                    <Button
                      type="button"
                      onClick={() => onChangePrice(optPriceRounded)}
                      className="h-11 px-4 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2 whitespace-nowrap shrink-0"
                    >
                      <span>Поставить {formatPrice(optPriceRounded)}</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 border rounded-xl divide-y sm:divide-y-0 sm:divide-x bg-background/60">
                  <div className="p-3.5">
                    <div className="text-xs text-muted-foreground">Прогноз продаж</div>
                    <div className="mt-1 font-mono text-xl font-bold text-foreground">
                      {formatInt(result.sold)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        / {formatInt(result.seats)} мест
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] font-mono text-muted-foreground">
                      Желают: {formatInt(result.wanted)} чел.
                    </div>
                  </div>

                  <div className="p-3.5">
                    <div className="text-xs text-muted-foreground">Загрузка борта</div>
                    <div className="mt-1 font-mono text-xl font-bold text-foreground">
                      {loadFactor.toFixed(1)}%
                    </div>
                    <Progress value={loadFactor} className="mt-2.5 h-1.5" />
                  </div>

                  <div className="p-3.5">
                    <div className="text-xs text-muted-foreground">Выручка</div>
                    <div className="mt-1 font-mono text-xl font-bold text-foreground">
                      {formatCompactRub(result.revenue)}
                    </div>
                    <div className="mt-0.5 text-[11px] font-mono text-muted-foreground">
                      {formatInt(result.revenue)} ₽
                    </div>
                  </div>

                  <div className="p-3.5">
                    <div className="text-xs text-muted-foreground">Маржа рейса</div>
                    <div
                      className={`mt-1 font-mono text-xl font-bold ${
                        result.margin >= 0
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-destructive"
                      }`}
                    >
                      {formatCompactRub(result.margin)}
                    </div>
                    <div className="mt-0.5 text-[11px] font-mono text-muted-foreground">
                      Макс: {formatCompactRub(result.optimal_margin)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {result && (
        <Card>
          <CardContent className="pt-5">
            <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as DetailTab)}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
                <div>
                  <h3 className="font-display text-base font-bold text-foreground">
                    {detailTab === "profit" && "Зависимость маржинальной прибыли от цены"}
                    {detailTab === "distribution" && "Распределение спроса и вместимость"}
                    {detailTab === "quantiles" && "Спрос по квантилям (0.1-0.9)"}
                    {detailTab === "table" && "Все 9 сценариев прогноза"}
                  </h3>
                </div>

                <TabsList className="grid grid-cols-4 w-full sm:w-auto h-10">
                  <TabsTrigger value="distribution" className="text-xs">
                    Распред.
                  </TabsTrigger>
                  <TabsTrigger value="quantiles" className="text-xs">
                    Квантили
                  </TabsTrigger>
                  <TabsTrigger value="profit" className="text-xs">
                    Прибыль
                  </TabsTrigger>
                  <TabsTrigger value="table" className="text-xs">
                    Таблица
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="profit">
                <ProfitChart result={result} />
              </TabsContent>

              <TabsContent value="distribution">
                <DistributionChart scenarios={result.scenarios} seats={result.seats} />
              </TabsContent>

              <TabsContent value="quantiles">
                <QuantileRangeChart scenarios={result.scenarios} seats={result.seats} />
              </TabsContent>

              <TabsContent value="table">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Квантиль</TableHead>
                      <TableHead className="text-right">Баз. спрос</TableHead>
                      <TableHead className="text-right">Спрос</TableHead>
                      <TableHead className="text-right">Продажи</TableHead>
                      <TableHead className="text-right">Маржа</TableHead>
                      <TableHead className="text-right">Лучшая цена</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.scenarios.map((s) => {
                      const isMed = Math.abs(s.quantile - 0.5) < 1e-6;
                      return (
                        <TableRow
                          key={s.quantile}
                          className={isMed ? "bg-accent/60 font-semibold" : undefined}
                        >
                          <TableCell className="font-mono">
                            {s.quantile.toFixed(1)} {isMed ? "(медиана)" : ""}
                          </TableCell>
                          <TableCell className="font-mono text-right">
                            {formatInt(s.base_demand)}
                          </TableCell>
                          <TableCell className="font-mono text-right">
                            {formatInt(s.wanted)}
                          </TableCell>
                          <TableCell className="font-mono text-right">
                            {formatInt(s.sold)}
                          </TableCell>
                          <TableCell className="font-mono text-right">
                            {formatCompactRub(s.margin)}
                          </TableCell>
                          <TableCell className="font-mono text-right">
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              onClick={() => onChangePrice(Math.round(s.optimal_price))}
                              className="h-auto p-0 font-mono font-semibold"
                            >
                              {formatPrice(s.optimal_price)}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
