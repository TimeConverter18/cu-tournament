import { useState } from "react";
import {
  AlertTriangle,
  Cpu,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Plane,
  Sun,
  UserCheck,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ThemeMode } from "../theme";
import { demoLoginRequest, loginRequest, registerRequest } from "../api";

const THEME_OPTIONS: Array<{ id: ThemeMode; label: string; icon: typeof Sun }> = [
  { id: "system", label: "Системная", icon: Monitor },
  { id: "light", label: "Светлая", icon: Sun },
  { id: "dark", label: "Тёмная", icon: Moon },
];

interface ProfileViewProps {
  userEmail: string;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  onLogout: () => void;
}

export function ProfileView({
  userEmail,
  themeMode,
  onThemeModeChange,
  onLogout,
}: ProfileViewProps) {
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3.5">
            <Avatar className="h-12 w-12 rounded-2xl">
              <AvatarFallback className="rounded-2xl bg-foreground text-background font-display font-bold text-base">
                {userEmail.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardDescription className="text-xs">Менеджер / аналитик рейсов</CardDescription>
              <CardTitle className="font-mono text-sm sm:text-base font-semibold truncate">
                {userEmail}
              </CardTitle>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <Separator />

          <div className="w-full min-h-[48px] flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-foreground">
            <span>Оформление интерфейса</span>
            <div
              role="group"
              aria-label="Тема оформления"
              className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5"
            >
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = themeMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onThemeModeChange(option.id)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          <div className="rounded-xl bg-muted/50 p-3.5 space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Cpu className="h-3.5 w-3.5 text-primary" />
              <span>Методика прогноза и стек</span>
            </div>
            <p className="leading-relaxed">
              Спрос прогнозируется помаршрутной структурной декомпозицией с календарными признаками и
              квантильным бустингом: 9 квантилей (0.1-0.9). Стек: TypeScript, React 19, Express,
              Tailwind CSS и shadcn/ui.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={onLogout}
            className="w-full h-11 gap-2 font-semibold"
          >
            <LogOut className="h-4 w-4" />
            <span>Выйти и сменить аккаунт</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

interface AuthScreenProps {
  onSuccess: (token: string, user: { email: string }) => void;
}

export function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res =
        mode === "login"
          ? await loginRequest(email, password)
          : await registerRequest(email, password);
      onSuccess(res.token, res.user);
    } catch (err: unknown) {
      setError((err as Error).message || "Ошибка авторизации");
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await demoLoginRequest();
      onSuccess(res.token, res.user);
    } catch (err: unknown) {
      setError((err as Error).message || "Не удалось войти в демо-режим");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-foreground text-background flex items-center justify-center">
              <Plane className="h-5 w-5 -rotate-12" />
            </div>
            <div>
              <CardTitle className="font-display text-xl font-bold">Решись Авиа</CardTitle>
              <CardDescription className="text-xs">
                Прогноз спроса и продаж по цене билета
              </CardDescription>
            </div>
          </div>

          <Tabs
            value={mode}
            onValueChange={(v) => {
              setMode(v as "login" | "register");
              setError("");
            }}
          >
            <TabsList className="grid grid-cols-2 w-full h-10">
              <TabsTrigger value="login">Вход</TabsTrigger>
              <TabsTrigger value="register">Регистрация</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent className="space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="auth-email" className="text-xs font-medium text-muted-foreground">
                Email
              </Label>
              <Input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@airline.ru"
                className="h-11 bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="auth-password" className="text-xs font-medium text-muted-foreground">
                Пароль (от 8 символов)
              </Label>
              <div className="relative">
                <Input
                  id="auth-password"
                  type={showPass ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 pr-11 bg-background"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label="Показать или скрыть пароль"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 text-muted-foreground"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={loading} className="w-full h-11 font-semibold gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{mode === "login" ? "Войти" : "Создать аккаунт"}</span>
            </Button>
          </form>

          <Separator />

          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={handleDemo}
            className="w-full h-11 font-semibold gap-2"
          >
            <UserCheck className="h-4 w-4" />
            <span>Войти как демо-пользователь</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
