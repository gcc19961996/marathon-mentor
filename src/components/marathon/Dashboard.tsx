import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChartNoAxesCombined,
  Flag,
  Gauge,
  Lock,
  Settings,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SetupScreen } from "./SetupScreen";
import { WeeklyPlanTab } from "./WeeklyPlanTab";
import { ProgressTab } from "./ProgressTab";
import { RaceDayTab } from "./RaceDayTab";
import { PaceAnalysisTab } from "./PaceAnalysisTab";

import { SettingsPanel } from "./SettingsPanel";
import { useDashboard } from "@/lib/dashboard";
import { relativeTime, useStravaAutoSync, useStravaStatus } from "@/lib/strava";
import { clearDeviceToken } from "@/lib/deviceToken";
import type { LucideIcon } from "lucide-react";

const TAB_KEY = "mtc-active-tab";
const TABS = ["weekly", "progress", "pace", "raceday"];
const NAV_ITEMS: Array<{ value: string; label: string; note?: string; icon: LucideIcon }> = [
  { value: "weekly", label: "Weekly Plan", icon: CalendarDays },
  { value: "progress", label: "Progress", icon: ChartNoAxesCombined },
  { value: "pace", label: "Pace Analysis", note: "(beta)", icon: Gauge },
  { value: "raceday", label: "Race Day", icon: Flag },
];

function stageLabel(phase: string) {
  return phase === "Build (travel week)" ? "Build – travel" : phase;
}

export function Dashboard({ role = "owner" }: { role?: "owner" | "viewer" }) {
  const d = useDashboard();
  const strava = useStravaStatus();
  useStravaAutoSync(strava.data?.connected);
  const [tab, setTab] = useState("weekly");
  const [prefillRun, setPrefillRun] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTarget, setSettingsTarget] = useState<"top" | "profile">("top");
  const headerDate = new Date().toISOString().slice(0, 10);
  const headerWeek =
    [...d.planWeeks]
      .filter((week) => week.start_date <= headerDate)
      .sort((a, b) => b.start_date.localeCompare(a.start_date))[0] ?? d.currentWeek;

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(TAB_KEY) : null;
    if (saved && TABS.includes(saved)) setTab(saved);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function changeTab(value: string) {
    setTab(value);
    if (typeof window !== "undefined") localStorage.setItem(TAB_KEY, value);
  }

  function openSettings(target: "top" | "profile" = "top") {
    setSettingsTarget(target);
    setSettingsOpen(true);
  }

  useEffect(() => {
    if (!settingsOpen || settingsTarget !== "profile") return;
    const timer = window.setTimeout(
      () => document.getElementById("profile-settings")?.scrollIntoView({ block: "start" }),
      80,
    );
    return () => window.clearTimeout(timer);
  }, [settingsOpen, settingsTarget]);

  if (d.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading your training…
      </div>
    );
  }

  if (!d.setupComplete) return <SetupScreen d={d} />;

  return (
    <Tabs
      value={tab}
      onValueChange={changeTab}
      className="min-h-screen bg-background pb-20 md:pb-0"
    >
      <h1 className="sr-only">Marathon training companion</h1>
      <header
        data-app-header
        className={`sticky top-0 z-40 h-16 bg-sidebar text-sidebar-foreground transition-shadow md:h-[109px] ${scrolled ? "border-b border-sidebar-border shadow-card" : "border-b border-transparent shadow-none"}`}
      >
        <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-8">
          <div className="flex h-16 min-w-0 items-center">
            <div className="flex min-w-0 items-center gap-4">
              <p
                className="whitespace-nowrap font-display text-lg font-bold uppercase"
                title="Marathon Training Companion"
              >
                <span className="min-[640px]:hidden">MTC</span>
                <span className="hidden min-[640px]:inline">Marathon Training Companion</span>
              </p>
              <span className="hidden h-5 w-px shrink-0 bg-sidebar-border lg:block" aria-hidden />
              <p className="hidden min-w-0 truncate text-sm font-semibold text-sidebar-foreground/80 lg:block">
                {d.profile?.race_name ?? "Marathon"}
              </p>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-6">
              <div className="text-right leading-tight">
                <p className="text-[9px] font-semibold uppercase text-sidebar-foreground/55">
                  Stage
                </p>
                <p className="mt-0.5 whitespace-nowrap text-[11px] font-semibold text-sidebar-accent-foreground sm:text-xs">
                  {stageLabel(headerWeek?.phase ?? d.phaseLabel)} · week{" "}
                  {headerWeek?.week_number ?? "—"} of {d.planWeeks.length}
                </p>
              </div>
              <span className="h-8 w-px bg-sidebar-border" aria-hidden />
              <p className="whitespace-nowrap text-[10px] uppercase text-sidebar-foreground/70 sm:text-xs">
                <span className="stat-figure mr-1 text-xl font-bold text-sidebar-foreground">
                  {d.days}
                </span>
                <span className="hidden min-[390px]:inline">days to race</span>
                <span className="min-[390px]:hidden">days</span>
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-10 min-w-10 gap-2 px-1.5 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground sm:px-2"
                    aria-label="Open George's profile menu"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary font-sans text-sm font-bold text-primary-foreground">
                      G
                    </span>
                    <span className="hidden text-left leading-tight xl:block">
                      <span className="block text-[9px] font-semibold uppercase italic text-sidebar-foreground/60">
                        {role === "viewer" ? "Viewer" : "Runner"}
                      </span>
                      <span className="block text-sm font-semibold">George</span>
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="space-y-1">
                    <span className="block">George</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {role === "viewer" ? "Viewer" : "Runner"} ·{" "}
                      {strava.data?.connected
                        ? `Strava connected · ${relativeTime(strava.data.lastSyncedAt)}`
                        : "Strava not connected"}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => openSettings("profile")}>
                    <UserRound />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openSettings("top")}>
                    <Settings />
                    Settings
                  </DropdownMenuItem>
                  {role !== "viewer" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => {
                          clearDeviceToken();
                          window.location.reload();
                        }}
                      >
                        <Lock />
                        Lock this device
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                id="open-settings"
                size="icon"
                variant="ghost"
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                aria-label="Settings"
                onClick={() => openSettings("top")}
              >
                <Settings />
              </Button>
            </div>
          </div>
          <TabsList className="hidden h-11 justify-start gap-7 rounded-none bg-transparent p-0 md:flex">
            {NAV_ITEMS.map(({ value, label, note }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-full rounded-none border-b-2 border-transparent px-0 text-sm font-semibold text-sidebar-foreground/70 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-sidebar-accent-foreground data-[state=active]:shadow-none"
              >
                {label}
                {note && <span className="ml-1 text-[10px] font-medium">{note}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </header>
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SettingsSheet d={d} />
      </Sheet>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-sidebar-border bg-sidebar text-sidebar-foreground md:hidden"
        aria-label="Primary navigation"
      >
        <TabsList className="grid h-16 w-full grid-cols-4 rounded-none bg-transparent p-0">
          {NAV_ITEMS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="h-full min-w-0 flex-col gap-1 rounded-none border-t-2 border-transparent px-1 text-[10px] font-semibold text-sidebar-foreground/65 shadow-none data-[state=active]:border-primary data-[state=active]:bg-sidebar-accent data-[state=active]:text-sidebar-accent-foreground data-[state=active]:shadow-none"
            >
              <Icon className="size-4" aria-hidden />
              <span className="max-w-full truncate">
                {value === "weekly" ? "Plan" : value === "pace" ? "Pace" : label}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </nav>
      <main className="min-h-screen">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-8 lg:py-8">
          <TabsContent value="weekly" className="mt-0">
            <WeeklyPlanTab
              d={d}
              onLogRun={() => {
                setPrefillRun((x) => x + 1);
                changeTab("progress");
              }}
              onOpenPlanRules={() => {
                changeTab("raceday");
                setTimeout(
                  () =>
                    document
                      .getElementById("plan-rules")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  120,
                );
              }}
            />
          </TabsContent>
          <TabsContent value="progress" className="mt-0">
            <ProgressTab d={d} prefillRun={prefillRun} />
          </TabsContent>
          <TabsContent value="pace" className="mt-0">
            <PaceAnalysisTab d={d} />
          </TabsContent>

          <TabsContent value="raceday" className="mt-0">
            <RaceDayTab d={d} />
          </TabsContent>
        </div>
      </main>
    </Tabs>
  );
}

function SettingsSheet({ d }: { d: ReturnType<typeof useDashboard> }) {
  return (
    <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
      <SheetHeader>
        <SheetTitle>Settings</SheetTitle>
      </SheetHeader>
      <div className="px-4 pb-10">
        <SettingsPanel d={d} />
      </div>
    </SheetContent>
  );
}
