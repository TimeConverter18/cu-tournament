import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  clearToken,
  demoLoginRequest,
  fetchMe,
  fetchMeta,
  getToken,
  predictRequest,
  setToken,
  wasExplicitlyLoggedOut,
} from "./api";
import CalculatorView from "./components/CalculatorView";
import CalendarView from "./components/CalendarView";
import NavChrome, { type AppTab } from "./components/NavChrome";
import { AuthScreen, ProfileView } from "./components/ProfileView";
import {
  applyTheme,
  readThemeMode,
  saveThemeMode,
  systemPrefersDark,
  type ThemeMode,
} from "./theme";
import type { MetaResponse, PredictResponse, RouteMeta } from "./types";

export default function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(readThemeMode);
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);
  const dark = themeMode === "system" ? systemDark : themeMode === "dark";

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    applyTheme(dark);
  }, [dark]);

  const handleThemeModeChange = useCallback((mode: ThemeMode) => {
    saveThemeMode(mode);
    setThemeMode(mode);
  }, []);

  const handleToggleTheme = useCallback(() => {
    handleThemeModeChange(dark ? "light" : "dark");
  }, [dark, handleThemeModeChange]);

  const [tokenState, setTokenState] = useState<string>(() => getToken());
  const [userEmail, setUserEmail] = useState<string>("");
  const [authBooting, setAuthBooting] = useState<boolean>(
    () => !getToken() && !wasExplicitlyLoggedOut()
  );

  const [activeTab, setActiveTab] = useState<AppTab>("calculator");
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [bootError, setBootError] = useState<string>("");

  const [selectedRouteCode, setSelectedRouteCode] = useState<string>("MOW-AER");
  const [date, setDate] = useState<string>("2026-06-12");
  const [price, setPrice] = useState<number>(9000);

  const [result, setResult] = useState<PredictResponse | null>(null);
  const [predictLoading, setPredictLoading] = useState<boolean>(false);
  const [predictError, setPredictError] = useState<string>("");

  const handleUnauthorized = useCallback(() => {
    clearToken();
    setTokenState("");
    setUserEmail("");
    setMeta(null);
    setResult(null);
  }, []);

  useEffect(() => {
    if (tokenState || wasExplicitlyLoggedOut()) {
      setAuthBooting(false);
      return;
    }
    let cancelled = false;
    demoLoginRequest()
      .then((res) => {
        if (cancelled) return;
        setToken(res.token);
        setTokenState(res.token);
        setUserEmail(res.user.email);
      })
      .catch(() => {
        if (!cancelled) setAuthBooting(false);
      })
      .finally(() => {
        if (!cancelled) setAuthBooting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tokenState]);

  useEffect(() => {
    if (!tokenState) return;
    let cancelled = false;
    setBootError("");

    Promise.all([fetchMe(handleUnauthorized), fetchMeta(handleUnauthorized)])
      .then(([meRes, metaRes]) => {
        if (cancelled) return;
        setUserEmail(meRes.email);
        setMeta(metaRes);

        const defRoute =
          metaRes.routes.find((r) => r.route === "MOW-AER") || metaRes.routes[0];
        if (defRoute) {
          setSelectedRouteCode(defRoute.route);
          setPrice(Math.round(defRoute.base_price));
        }
        const defDate =
          "2026-06-12" >= metaRes.date_min && "2026-06-12" <= metaRes.date_max
            ? "2026-06-12"
            : metaRes.date_min;
        setDate(defDate);
      })
      .catch((err: Error & { status?: number }) => {
        if (!cancelled && err.status !== 401) {
          setBootError(err.message || "Не удалось загрузить данные сервиса");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tokenState, handleUnauthorized]);

  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!meta || !tokenState || !date) return;
    const routeObj = meta.routes.find((r) => r.route === selectedRouteCode);
    if (!routeObj) return;

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setPredictLoading(true);
      setPredictError("");
      predictRequest(
        {
          origin: routeObj.origin,
          destination: routeObj.destination,
          date,
          price,
        },
        handleUnauthorized
      )
        .then((res) => {
          setResult(res);
        })
        .catch((err: Error & { status?: number }) => {
          if (err.status !== 401) {
            setPredictError(err.message || "Ошибка расчёта");
          }
        })
        .finally(() => {
          setPredictLoading(false);
        });
    }, 80);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [meta, tokenState, selectedRouteCode, date, price, handleUnauthorized]);

  const handleSelectRoute = (route: RouteMeta) => {
    setSelectedRouteCode(route.route);
    setPrice(Math.round(route.base_price));
  };

  const handlePickDayFromCalendar = (
    routeCode: string,
    pickedDate: string,
    optimalPrice: number
  ) => {
    setSelectedRouteCode(routeCode);
    setDate(pickedDate);
    setPrice(Math.round(optimalPrice));
    setActiveTab("calculator");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAuthSuccess = (newToken: string, user: { email: string }) => {
    setToken(newToken);
    setTokenState(newToken);
    setUserEmail(user.email);
    setActiveTab("calculator");
  };

  const handleLogout = () => {
    clearToken();
    setTokenState("");
    setUserEmail("");
    setMeta(null);
    setResult(null);
  };

  if (authBooting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">
        Загрузка «Решись Авиа»...
      </div>
    );
  }

  if (!tokenState) {
    return (
      <TooltipProvider>
        <AuthScreen onSuccess={handleAuthSuccess} />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col bg-background text-foreground pb-20 md:pb-8">
        <NavChrome
          activeTab={activeTab}
          onTabChange={setActiveTab}
          dark={dark}
          onToggleTheme={handleToggleTheme}
          userEmail={userEmail || "demo@reshis.avia"}
        />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 pt-5 sm:pt-7">
          {bootError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{bootError}</AlertDescription>
            </Alert>
          )}

          {!meta && !bootError && (
            <div className="space-y-4">
              <div className="h-20 rounded-2xl bg-muted animate-pulse" />
              <div className="h-72 rounded-2xl bg-muted animate-pulse" />
            </div>
          )}

          {meta && activeTab === "calculator" && (
            <CalculatorView
              meta={meta}
              selectedRouteCode={selectedRouteCode}
              onSelectRoute={handleSelectRoute}
              date={date}
              onChangeDate={setDate}
              price={price}
              onChangePrice={setPrice}
              result={result}
              loading={predictLoading}
              error={predictError}
            />
          )}

          {meta && activeTab === "calendar" && (
            <CalendarView
              meta={meta}
              selectedRouteCode={selectedRouteCode}
              onSelectRoute={handleSelectRoute}
              onPickDayForCalc={handlePickDayFromCalendar}
              onUnauthorized={handleUnauthorized}
            />
          )}

          {activeTab === "profile" && (
            <ProfileView
              userEmail={userEmail || "demo@reshis.avia"}
              themeMode={themeMode}
              onThemeModeChange={handleThemeModeChange}
              onLogout={handleLogout}
            />
          )}
        </main>

        <footer className="mx-auto w-full max-w-6xl px-4 sm:px-6 pt-6 pb-4 text-center sm:text-left">
          <p className="text-[11px] text-muted-foreground">
            Квантильный прогноз спроса (0.1-0.9) · TypeScript, React 19, Express, shadcn/ui
          </p>
        </footer>
      </div>
    </TooltipProvider>
  );
}
