import fs from "node:fs";
import path from "node:path";
import { ForecastRow, QUANTILES, RouteMeta } from "./core.ts";

function parseCsvRows(filePath: string): Record<string, string>[] {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (cols[j] ?? "").trim();
    }
    rows.push(row);
  }
  return rows;
}

export class DataStore {
  private forecastPath: string;
  private routesPath: string;

  routes: RouteMeta[] = [];
  routeMap = new Map<string, RouteMeta>();
  originDestIndex = new Map<string, RouteMeta>();
  origins: string[] = [];
  forecastIndex = new Map<string, ForecastRow>();
  forecastRows: ForecastRow[] = [];
  dateMin = "";
  dateMax = "";

  constructor(dataDir: string) {
    this.forecastPath = path.join(dataDir, "forecast.csv");
    this.routesPath = path.join(dataDir, "routes.csv");
    this.reload();
  }

  reload() {
    const rawRoutes = parseCsvRows(this.routesPath);
    this.routes = rawRoutes.map((r) => {
      const parts = r.name.split("→").map((p) => p.trim());
      return {
        route: r.route,
        name: r.name,
        origin: parts[0] ?? r.route,
        destination: parts[1] ?? r.route,
        base_price: Number(r.base_price),
        cost_per_passenger: Number(r.cost_per_passenger),
        price_sensitivity: Number(r.price_sensitivity),
        price_min: Number(r.price_min),
        price_max: Number(r.price_max),
      };
    });

    this.routeMap.clear();
    this.originDestIndex.clear();
    const originSet = new Set<string>();
    for (const r of this.routes) {
      this.routeMap.set(r.route, r);
      this.originDestIndex.set(`${r.origin}|${r.destination}`, r);
      originSet.add(r.origin);
    }
    this.origins = Array.from(originSet).sort();

    const rawForecast = parseCsvRows(this.forecastPath);
    this.forecastIndex.clear();
    this.forecastRows = [];

    let dMin = "9999-99-99";
    let dMax = "0000-00-00";

    for (const r of rawForecast) {
      const quantiles: Record<
        string,
        { base_demand: number; price: number; price_demand: number }
      > = {};
      for (const q of QUANTILES) {
        const qs = q.toFixed(1);
        quantiles[qs] = {
          base_demand: Number(r[`${qs}_base_demand`]),
          price: Number(r[`${qs}_price`]),
          price_demand: Number(r[`${qs}_price_demand`]),
        };
      }
      const row: ForecastRow = {
        route: r.route,
        date: r.date,
        seats: Number(r.seats),
        quantiles,
      };
      this.forecastIndex.set(`${r.route}|${r.date}`, row);
      this.forecastRows.push(row);
      if (r.date < dMin) dMin = r.date;
      if (r.date > dMax) dMax = r.date;
    }

    this.dateMin = dMin;
    this.dateMax = dMax;
  }

  getRouteByCities(origin: string, destination: string): RouteMeta | null {
    return this.originDestIndex.get(`${origin.trim()}|${destination.trim()}`) ?? null;
  }

  getForecastRow(route: string, date: string): ForecastRow | null {
    return this.forecastIndex.get(`${route}|${date}`) ?? null;
  }
}
