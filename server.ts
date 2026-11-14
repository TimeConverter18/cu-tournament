import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { AuthStore } from "./server/auth.ts";
import { buildPrediction, calcOptimalPrice, calcSold, calcWanted } from "./server/core.ts";
import { DataStore } from "./server/dataStore.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "data");
const DIST_DIR = path.resolve(__dirname, "dist");

function parsePrice(raw: unknown): number {
  if (typeof raw === "boolean" || raw === null || raw === undefined) {
    throw new Error("Укажите корректную цену билета");
  }
  let val = raw;
  if (typeof val === "string") {
    const cleaned = val.trim().replace(/\s+/g, "").replace(",", ".");
    if (!cleaned) throw new Error("Укажите цену билета");
    val = Number(cleaned);
  }
  const num = Number(val);
  if (!Number.isFinite(num)) throw new Error("Цена должна быть конечным числом");
  if (num < 0) throw new Error("Цена не может быть отрицательной");
  return num;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateIso(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new Error("Неверный формат даты, ожидается YYYY-MM-DD");
  }
  const text = raw.trim();
  if (!DATE_RE.test(text)) {
    throw new Error("Неверный формат даты, ожидается YYYY-MM-DD");
  }
  const d = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== text) {
    throw new Error("Указана несуществующая дата");
  }
  return text;
}

async function startServer() {
  const store = new DataStore(DATA_DIR);
  const auth = new AuthStore(DATA_DIR);

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "1mb" }));

  interface AuthedRequest extends Request {
    userEmail?: string;
  }

  const requireAuth = (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      res.status(401).json({ error: "Требуется авторизация" });
      return;
    }
    const verified = auth.verifyToken(match[1].trim());
    if (!verified) {
      res.status(401).json({ error: "Сессия истекла или недействительна" });
      return;
    }
    req.userEmail = verified.email;
    next();
  };

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/register", (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      const out = auth.register(email, password);
      res.status(201).json(out);
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      res.status(e.status || 400).json({ error: e.message || "Ошибка регистрации" });
    }
  });

  app.post("/api/login", (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      const out = auth.login(email, password);
      res.json(out);
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      res.status(e.status || 401).json({ error: e.message || "Ошибка входа" });
    }
  });

  app.post("/api/demo-login", (_req, res) => {
    const out = auth.login("demo@reshis.avia", "Demo12345");
    res.json(out);
  });

  app.get("/api/me", requireAuth, (req: AuthedRequest, res) => {
    res.json({ email: req.userEmail });
  });

  app.get("/api/meta", requireAuth, (_req, res) => {
    res.json({
      date_min: store.dateMin,
      date_max: store.dateMax,
      origins: store.origins,
      routes: store.routes,
    });
  });

  app.post("/api/predict", requireAuth, (req, res) => {
    try {
      const { origin, destination, date, price } = req.body ?? {};
      if (typeof origin !== "string" || !origin.trim()) {
        res.status(400).json({ error: "Укажите город вылета" });
        return;
      }
      if (typeof destination !== "string" || !destination.trim()) {
        res.status(400).json({ error: "Укажите город прилёта" });
        return;
      }
      const routeInfo = store.getRouteByCities(origin, destination);
      if (!routeInfo) {
        res.status(400).json({
          error: `Маршрут «${origin} - ${destination}» не найден`,
        });
        return;
      }
      const dateStr = parseDateIso(date);
      const row = store.getForecastRow(routeInfo.route, dateStr);
      if (!row) {
        res.status(400).json({
          error: `Нет прогноза на дату ${dateStr} (доступно: ${store.dateMin}..${store.dateMax})`,
        });
        return;
      }
      const priceVal = parsePrice(price);
      const result = buildPrediction(row, routeInfo, priceVal);
      res.json(result);
    } catch (err: unknown) {
      const e = err as Error;
      res.status(400).json({ error: e.message || "Ошибка расчёта" });
    }
  });

  app.get("/api/calendar", requireAuth, (req, res) => {
    const routeCode = String(req.query.route || "MOW-AER");
    const routeInfo = store.routeMap.get(routeCode);
    if (!routeInfo) {
      res.status(400).json({ error: `Неизвестный маршрут: ${routeCode}` });
      return;
    }

    const days = store.forecastRows
      .filter((r) => r.route === routeCode)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => {
        const d10 = r.quantiles["0.1"].base_demand;
        const d50 = r.quantiles["0.5"].base_demand;
        const d90 = r.quantiles["0.9"].base_demand;
        const optPrice = calcOptimalPrice(
          d50,
          routeInfo.base_price,
          routeInfo.cost_per_passenger,
          routeInfo.price_sensitivity,
          r.seats,
          routeInfo.price_min,
          routeInfo.price_max
        );
        const optWanted = calcWanted(
          d50,
          routeInfo.price_sensitivity,
          optPrice,
          routeInfo.base_price
        );
        const optSold = calcSold(optWanted, r.seats);
        const optMargin = (optPrice - routeInfo.cost_per_passenger) * optSold;

        const baseSold = calcSold(d50, r.seats);
        const baseMargin = (routeInfo.base_price - routeInfo.cost_per_passenger) * baseSold;

        return {
          date: r.date,
          seats: r.seats,
          d10,
          d50,
          d90,
          optimal_price: Math.round(optPrice),
          optimal_sold: Math.round(optSold),
          optimal_margin: Math.round(optMargin),
          base_margin: Math.round(baseMargin),
          margin_gain: Math.round(optMargin - baseMargin),
          capped_at_base: d50 > r.seats,
        };
      });

    res.json({
      route: routeInfo,
      days,
    });
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API route not found" });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(DIST_DIR, "index.html"));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Reshis Avia server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
