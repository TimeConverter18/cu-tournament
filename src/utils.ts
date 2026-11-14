import type { PredictResponse, ScenarioOut } from "./types";

const intFmt = new Intl.NumberFormat("ru-RU");
const decFmt = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatInt(val: number): string {
  if (!Number.isFinite(val)) return "0";
  return intFmt.format(Math.round(val));
}

export function formatPrice(val: number): string {
  return `${formatInt(val)} ₽`;
}

export function formatCompactRub(val: number): string {
  if (!Number.isFinite(val)) return "0 ₽";
  if (Math.abs(val) >= 1_000_000) {
    return `${decFmt.format(val / 1_000_000)} млн ₽`;
  }
  if (Math.abs(val) >= 100_000) {
    return `${intFmt.format(Math.round(val / 1_000))} тыс. ₽`;
  }
  return `${formatInt(val)} ₽`;
}

export function formatRussianDate(isoDate: string): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "short",
  })
    .format(dt)
    .replace(/\s*г\.?$/, "");
}

export function formatShortDay(isoDate: string): {
  dayNum: string;
  weekday: string;
  monthShort: string;
  isWeekend: boolean;
} {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const jsDay = dt.getDay();
  const isWeekend = jsDay === 0 || jsDay === 6;
  const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(dt);
  const monthShort = new Intl.DateTimeFormat("ru-RU", { month: "short" })
    .format(dt)
    .replace(".", "");
  return {
    dayNum: String(d),
    weekday,
    monthShort,
    isWeekend,
  };
}

export function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

export interface ProfitCurvePoint {
  price: number;
  margin01: number;
  margin05: number;
  margin09: number;
}

export function buildProfitCurvePoints(result: PredictResponse): ProfitCurvePoint[] {
  const pMin = Math.round(result.price_min);
  const pMax = Math.round(result.price_max);
  const b = result.price_sensitivity;
  const p0 = result.base_price;
  const cost = result.cost_per_passenger;
  const seats = result.seats;

  const q01 = result.scenarios.find((s) => Math.abs(s.quantile - 0.1) < 1e-6)?.base_demand ?? 0;
  const q05 = result.scenarios.find((s) => Math.abs(s.quantile - 0.5) < 1e-6)?.base_demand ?? 0;
  const q09 = result.scenarios.find((s) => Math.abs(s.quantile - 0.9) < 1e-6)?.base_demand ?? 0;

  const count = 48;
  const priceSet = new Set<number>();
  for (let i = 0; i <= count; i++) {
    priceSet.add(Math.round(pMin + ((pMax - pMin) * i) / count));
  }
  if (result.price >= pMin && result.price <= pMax) priceSet.add(Math.round(result.price));
  if (result.optimal_price >= pMin && result.optimal_price <= pMax) {
    priceSet.add(Math.round(result.optimal_price));
  }

  const prices = Array.from(priceSet).sort((a, c) => a - c);
  const calc = (baseDemand: number, price: number) => {
    const wanted = baseDemand - b * (price - p0);
    const sold = Math.min(seats, Math.max(0, wanted));
    return (price - cost) * sold;
  };

  return prices.map((price) => ({
    price,
    margin01: calc(q01, price),
    margin05: calc(q05, price),
    margin09: calc(q09, price),
  }));
}

export interface DistributionStepPoint {
  x: number;
  density: number;
  intervalFrom: number | null;
  intervalTo: number | null;
  probMass: number;
  qFrom?: number;
  qTo?: number;
  isBoundary: boolean;
}

export interface DistributionData {
  points: DistributionStepPoint[];
  domainMin: number;
  domainMax: number;
  d1: number;
  d5: number;
  rawD5: number;
  d9: number;
  sorted: Array<ScenarioOut & { effectiveWanted: number }>;
}

export function buildDistributionData(scenarios: ScenarioOut[], seats: number): DistributionData {
  const sortedRaw = [...scenarios].sort((a, b) => a.wanted - b.wanted);
  if (sortedRaw.length === 0) {
    return {
      points: [],
      domainMin: 0,
      domainMax: seats || 100,
      d1: 0,
      d5: 0,
      rawD5: 0,
      d9: 0,
      sorted: [],
    };
  }

  const clamped = sortedRaw.map((s) => ({
    ...s,
    effectiveWanted: Math.max(0, s.wanted),
  }));

  const d1 = clamped[0].effectiveWanted;
  const d9 = clamped[clamped.length - 1].effectiveWanted;
  const rawMedian =
    sortedRaw.find((s) => Math.abs(s.quantile - 0.5) < 1e-6) ||
    sortedRaw[Math.floor(sortedRaw.length / 2)];
  const rawD5 = rawMedian.wanted;
  const medianRow =
    clamped.find((s) => Math.abs(s.quantile - 0.5) < 1e-6) ||
    clamped[Math.floor(clamped.length / 2)];
  const d5 = medianRow.effectiveWanted;

  const rawSpan = Math.max(
    d9 - d1,
    seats - Math.min(d1, seats),
    Math.max(d9, seats) - d1,
    24
  );
  const pad = Math.max(12, Math.round(rawSpan * 0.08));
  const domainMin = Math.max(0, Math.floor(Math.min(d1, seats) - pad));
  const domainMax = Math.ceil(Math.max(d9, seats) + pad);

  const points: DistributionStepPoint[] = [
    {
      x: domainMin,
      density: 0,
      intervalFrom: null,
      intervalTo: d1,
      probMass: 0,
      isBoundary: true,
    },
  ];

  let i = 0;
  while (i < clamped.length - 1) {
    const startX = clamped[i].effectiveWanted;
    const qFrom = clamped[i].quantile;
    let j = i + 1;
    while (j < clamped.length - 1 && Math.abs(clamped[j].effectiveWanted - startX) < 1e-6) {
      j += 1;
    }
    let endX = clamped[j].effectiveWanted;
    const qTo = clamped[j].quantile;
    const probMass = (j - i) * 10;
    if (endX - startX < 1) {
      endX = startX + 1;
    }
    const density = probMass / (endX - startX);
    points.push({
      x: startX,
      density,
      intervalFrom: startX,
      intervalTo: endX,
      probMass,
      qFrom,
      qTo,
      isBoundary: false,
    });

    if (j === clamped.length - 1 && Math.abs(clamped[j].effectiveWanted - startX) < 1e-6) {
      const nextMax = Math.max(domainMax, endX + pad);
      points.push({
        x: endX,
        density: 0,
        intervalFrom: endX,
        intervalTo: null,
        probMass: 0,
        isBoundary: true,
      });
      points.push({
        x: nextMax,
        density: 0,
        intervalFrom: endX,
        intervalTo: null,
        probMass: 0,
        isBoundary: true,
      });
      return {
        points,
        domainMin,
        domainMax: nextMax,
        d1,
        d5,
        rawD5,
        d9: endX,
        sorted: clamped,
      };
    }
    i = j;
  }

  points.push({
    x: d9,
    density: 0,
    intervalFrom: d9,
    intervalTo: null,
    probMass: 0,
    isBoundary: true,
  });
  points.push({
    x: domainMax,
    density: 0,
    intervalFrom: d9,
    intervalTo: null,
    probMass: 0,
    isBoundary: true,
  });

  return { points, domainMin, domainMax, d1, d5, rawD5, d9, sorted: clamped };
}
