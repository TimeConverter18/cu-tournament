export const QUANTILES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] as const;

export interface RouteMeta {
  route: string;
  name: string;
  origin: string;
  destination: string;
  base_price: number;
  cost_per_passenger: number;
  price_sensitivity: number;
  price_min: number;
  price_max: number;
}

export interface ForecastRow {
  route: string;
  date: string;
  seats: number;
  quantiles: Record<string, { base_demand: number; price: number; price_demand: number }>;
}

export interface ScenarioResult {
  quantile: number;
  base_demand: number;
  wanted: number;
  sold: number;
  revenue: number;
  margin: number;
  optimal_price: number;
}

export interface PredictionResult {
  route: string;
  route_name: string;
  origin: string;
  destination: string;
  date: string;
  seats: number;
  price: number;
  base_price: number;
  cost_per_passenger: number;
  price_min: number;
  price_max: number;
  price_sensitivity: number;
  wanted: number;
  sold: number;
  load_factor: number;
  revenue: number;
  margin: number;
  optimal_price: number;
  optimal_sold: number;
  optimal_margin: number;
  capped: boolean;
  price_out_of_range: boolean;
  scenarios: ScenarioResult[];
}

export function calcWanted(
  baseDemand: number,
  sensitivity: number,
  price: number,
  basePrice: number
): number {
  const raw = baseDemand - sensitivity * (price - basePrice);
  return raw > 0 ? raw : 0;
}

export function calcSold(wanted: number, seats: number): number {
  const clampedWanted = wanted > 0 ? wanted : 0;
  const clampedSeats = seats > 0 ? seats : 0;
  return clampedWanted < clampedSeats ? clampedWanted : clampedSeats;
}

export function calcOptimalPrice(
  baseDemand: number,
  basePrice: number,
  costPerPassenger: number,
  sensitivity: number,
  seats: number,
  priceMin: number,
  priceMax: number
): number {
  const topOfParabola = (costPerPassenger + basePrice + baseDemand / sensitivity) / 2;
  const fullPlane = basePrice + (baseDemand - seats) / sensitivity;
  const raw = Math.max(topOfParabola, fullPlane);
  return Math.min(Math.max(raw, priceMin), priceMax);
}

export function buildPrediction(
  row: ForecastRow,
  routeInfo: RouteMeta,
  price: number
): PredictionResult {
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Цена не может быть отрицательной");
  }

  const basePrice = routeInfo.base_price;
  const costPerPax = routeInfo.cost_per_passenger;
  const priceMin = routeInfo.price_min;
  const priceMax = routeInfo.price_max;
  const sensitivity = routeInfo.price_sensitivity;
  const seats = row.seats;

  const scenarios: ScenarioResult[] = [];
  let wantedMedian = 0;
  let soldMedian = 0;
  let optimalPriceMedian = basePrice;
  let baseDemandMedian = 0;

  for (const q of QUANTILES) {
    const qKey = q.toFixed(1);
    const qData = row.quantiles[qKey];
    const baseDemand = qData.base_demand;
    const wantedQ = calcWanted(baseDemand, sensitivity, price, basePrice);
    const soldQ = calcSold(wantedQ, seats);
    const optPriceQ =
      Number.isFinite(qData.price) && qData.price > 0
        ? qData.price
        : calcOptimalPrice(
            baseDemand,
            basePrice,
            costPerPax,
            sensitivity,
            seats,
            priceMin,
            priceMax
          );
    const revenueQ = price * soldQ;
    const marginQ = (price - costPerPax) * soldQ;

    scenarios.push({
      quantile: q,
      base_demand: baseDemand,
      wanted: wantedQ,
      sold: soldQ,
      revenue: revenueQ,
      margin: marginQ,
      optimal_price: optPriceQ,
    });

    if (Math.abs(q - 0.5) < 1e-6) {
      wantedMedian = wantedQ;
      soldMedian = soldQ;
      optimalPriceMedian = optPriceQ;
      baseDemandMedian = baseDemand;
    }
  }

  const optWanted = calcWanted(baseDemandMedian, sensitivity, optimalPriceMedian, basePrice);
  const optSold = calcSold(optWanted, seats);
  const optMargin = (optimalPriceMedian - costPerPax) * optSold;
  const loadFactor = seats > 0 ? (soldMedian / seats) * 100 : 0;
  const revenue = price * soldMedian;
  const margin = (price - costPerPax) * soldMedian;

  return {
    route: routeInfo.route,
    route_name: routeInfo.name,
    origin: routeInfo.origin,
    destination: routeInfo.destination,
    date: row.date,
    seats,
    price,
    base_price: basePrice,
    cost_per_passenger: costPerPax,
    price_min: priceMin,
    price_max: priceMax,
    price_sensitivity: sensitivity,
    wanted: wantedMedian,
    sold: soldMedian,
    load_factor: loadFactor,
    revenue,
    margin,
    optimal_price: optimalPriceMedian,
    optimal_sold: optSold,
    optimal_margin: optMargin,
    capped: wantedMedian > seats,
    price_out_of_range: price < priceMin || price > priceMax,
    scenarios,
  };
}
