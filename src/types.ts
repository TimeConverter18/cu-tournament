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

export interface MetaResponse {
  date_min: string;
  date_max: string;
  origins: string[];
  routes: RouteMeta[];
}

export interface ScenarioOut {
  quantile: number;
  base_demand: number;
  wanted: number;
  sold: number;
  revenue: number;
  margin: number;
  optimal_price: number;
}

export interface PredictResponse {
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
  scenarios: ScenarioOut[];
}

export interface CalendarDay {
  date: string;
  seats: number;
  d10: number;
  d50: number;
  d90: number;
  optimal_price: number;
  optimal_sold: number;
  optimal_margin: number;
  base_margin: number;
  margin_gain: number;
  capped_at_base: boolean;
}

export interface CalendarResponse {
  route: RouteMeta;
  days: CalendarDay[];
}
