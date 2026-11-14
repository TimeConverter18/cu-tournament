import {
  CalendarDays,
  Menu,
  Moon,
  Plane,
  SlidersHorizontal,
  Sun,
  User,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export type AppTab = "calculator" | "calendar" | "profile";

interface NavChromeProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  dark: boolean;
  onToggleTheme: () => void;
  userEmail: string;
}

const NAV_ITEMS: Array<{
  id: AppTab;
  label: string;
  mobileLabel: string;
  icon: typeof SlidersHorizontal;
}> = [
  { id: "calculator", label: "Прогноз", mobileLabel: "Прогноз", icon: SlidersHorizontal },
  { id: "calendar", label: "Июнь 2026", mobileLabel: "Июнь", icon: CalendarDays },
  { id: "profile", label: "Профиль", mobileLabel: "Профиль", icon: User },
];

export default function NavChrome({
  activeTab,
  onTabChange,
  dark,
  onToggleTheme,
  userEmail,
}: NavChromeProps) {
  const initials = (userEmail || "RA").slice(0, 2).toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onTabChange("calculator")}
            className="h-10 px-1.5 -ml-1.5 gap-2.5 hover:bg-transparent whitespace-nowrap shrink-0"
          >
            <span className="h-8 w-8 rounded-lg bg-foreground text-background flex items-center justify-center shrink-0">
              <Plane className="h-4 w-4 -rotate-12" />
            </span>
            <span className="font-display font-bold text-base sm:text-lg tracking-tight text-foreground">
              Решись Авиа
            </span>
          </Button>

          <nav
            aria-label="Основная навигация"
            className="hidden md:flex items-center gap-1 rounded-xl bg-muted p-1"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`inline-flex items-center gap-2 h-8 px-3.5 rounded-lg text-sm whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    isActive
                      ? "bg-background text-foreground font-semibold shadow-sm"
                      : "text-muted-foreground hover:text-foreground font-medium"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
              aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"}
              className="h-10 w-10 text-muted-foreground hover:text-foreground"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => onTabChange("profile")}
              className="hidden md:inline-flex h-10 px-2.5 gap-2 text-xs font-mono text-muted-foreground hover:text-foreground"
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-foreground text-background font-display text-[10px] font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-[140px] truncate">{userEmail}</span>
            </Button>

            <Sheet>
              <SheetTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Открыть меню"
                    className="md:hidden h-10 w-10"
                  />
                }
              >
                <Menu className="h-4 w-4" />
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                <SheetHeader>
                  <SheetTitle className="font-display">Решись Авиа</SheetTitle>
                  <SheetDescription className="truncate font-mono text-xs">
                    {userEmail}
                  </SheetDescription>
                </SheetHeader>
                <div className="px-4 space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/60">
                    <Avatar>
                      <AvatarFallback className="bg-foreground text-background font-display font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">Аккаунт</div>
                      <div className="text-xs font-mono font-medium truncate">{userEmail}</div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-1.5">
                    {NAV_ITEMS.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <Button
                          key={item.id}
                          type="button"
                          variant={isActive ? "secondary" : "ghost"}
                          onClick={() => onTabChange(item.id)}
                          className="justify-start h-11 gap-3"
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Button>
                      );
                    })}
                  </div>

                  <Separator />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={onToggleTheme}
                    className="w-full h-11 gap-2"
                  >
                    {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    <span>{dark ? "Светлая тема" : "Тёмная тема"}</span>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <nav
        aria-label="Мобильная навигация"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-card/95 backdrop-blur-md pb-safe"
      >
        <div className="grid grid-cols-3 h-16">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`flex flex-col items-center justify-center gap-1 min-h-[44px] transition-colors ${
                  isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.3 : 1.8} />
                <span className="text-[11px] tracking-tight whitespace-nowrap">
                  {item.mobileLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
