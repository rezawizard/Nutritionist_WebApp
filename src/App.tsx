import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Archive,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  Eye,
  FileText,
  FileUp,
  Home,
  Image as ImageIcon,
  KeyRound,
  Leaf,
  LogOut,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import {
  activityLabels,
  bmiCategory,
  calculateNutrition,
  cn,
  defaultCalculationSettings,
  emptyClient,
  formatNumber,
  formatPersianDate,
  genderLabels,
  goalLabels,
  todayIsoDate,
} from "./lib";
import type {
  ActivityLevel,
  Attachment,
  AttachmentCategory,
  Client,
  ClientRecord,
  DashboardStats,
  Gender,
  Goal,
  Screen,
  ServiceCatalogItem,
  Settings,
  Visit,
  VisitService,
  VisitStatus,
} from "./types";

const defaultSettings: Settings = {
  dietitian_name: "",
  clinic_name: "",
  primary_color: "#0f5b46",
  background_color: "#10517A",
  text_color: "#f7f3ea",
  logo_path: "",
  background_image_path: "",
  username: "admin",
  ...defaultCalculationSettings,
};

const dietoyTheme = {
  primary_color: "#0f5b46",
  background_color: "#10517A",
  text_color: "#f7f3ea",
};

const attachmentCategoryLabels: Record<AttachmentCategory, string> = {
  body_analysis: "بادی‌آنالیز",
  lab: "آزمایش",
  medical_report: "گزارش پزشکی",
  other: "سایر فایل‌ها",
};

const visitStatusOptions: Record<VisitStatus, string> = {
  tentative: "موقت",
  confirmed: "قطعی",
  done: "انجام‌شده",
  cancelled: "لغوشده",
};

type Toast = { id: number; text: string; kind?: "success" | "error" };
type ToastFn = (text: string, kind?: Toast["kind"]) => void;
type GoalFilter = "all" | Goal;

function isDesktopRuntime() {
  return Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

function withDefaults(settings: Partial<Settings>): Settings {
  return { ...defaultSettings, ...settings };
}

function normalizeClient(client: Client): Client {
  return {
    ...client,
    next_visit_date: client.next_visit_date ?? "",
    next_visit_status: client.next_visit_status ?? "tentative",
  };
}

function assetUrl(path?: string) {
  if (!path) return "";
  if (path.startsWith("/") || path.startsWith("data:") || path.startsWith("http")) return path;
  return isDesktopRuntime() ? convertFileSrc(path) : path;
}

function fileExtension(path: string) {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

function applyVisualSettings(settings: Settings) {
  document.documentElement.style.setProperty("--primary", settings.primary_color || defaultSettings.primary_color);
  document.documentElement.style.setProperty("--app-bg", settings.background_color || defaultSettings.background_color);
  document.documentElement.style.setProperty("--app-text", settings.text_color || defaultSettings.text_color);
}

function backgroundStyle(settings: Settings): CSSProperties {
  const image = assetUrl(settings.background_image_path);
  if (!image) return { color: "var(--app-text)", backgroundColor: "var(--app-bg)" };
  return {
    color: "var(--app-text)",
    backgroundColor: "var(--app-bg)",
    backgroundImage: `linear-gradient(rgba(247, 243, 234, 0.80), rgba(247, 243, 234, 0.92)), url("${image}")`,
    backgroundPosition: "center",
    backgroundSize: "cover",
    backgroundAttachment: "fixed",
  };
}

function addDaysIso(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push: ToastFn = (text, kind = "success") => {
    const id = Date.now();
    setToasts((items) => [...items, { id, text, kind }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3000);
  };
  return { toasts, push };
}

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [settings, setSettingsState] = useState<Settings>(defaultSettings);
  const [editing, setEditing] = useState<Client | null>(null);
  const [calculationClient, setCalculationClient] = useState<Client | null>(null);
  const [version, setVersion] = useState(0);
  const { toasts, push } = useToasts();

  useEffect(() => {
    applyVisualSettings(settings);
  }, []);

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    invoke<Settings>("get_settings")
      .then((next) => {
        const merged = withDefaults(next);
        setSettingsState(merged);
        applyVisualSettings(merged);
      })
      .catch(() => push("تنظیمات خوانده نشد.", "error"));
  }, []);

  const setSettings = (next: Settings) => {
    const merged = withDefaults(next);
    setSettingsState(merged);
    applyVisualSettings(merged);
  };

  const openClientForm = (client?: Client) => {
    setEditing(client ? normalizeClient(client) : null);
    setScreen("client-form");
  };

  const openCalculations = (client?: Client) => {
    setCalculationClient(client ? normalizeClient(client) : null);
    setScreen("calculator");
  };

  if (!unlocked) {
    return <LoginScreen settings={settings} onLogin={() => setUnlocked(true)} toast={push} toasts={toasts} />;
  }

  return (
    <div className="app-shell min-h-screen bg-[var(--app-bg)]" dir="rtl" style={backgroundStyle(settings)}>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-72 border-l border-warm-100 bg-paper/90 px-5 py-6 backdrop-blur lg:block">
          <Brand settings={settings} />
          <nav className="mt-9 grid gap-2">
            <NavItem active={screen === "dashboard"} icon={Home} label="داشبورد" onClick={() => setScreen("dashboard")} />
            <NavItem active={screen === "clients" || screen === "client-form"} icon={Users} label="مراجعین" onClick={() => setScreen("clients")} />
            <NavItem active={screen === "calculator"} icon={Calculator} label="محاسبات" onClick={() => openCalculations()} />
            <NavItem active={screen === "settings"} icon={SettingsIcon} label="تنظیمات" onClick={() => setScreen("settings")} />
          </nav>
          <div className="absolute bottom-6 left-5 right-5">
            <NavItem active={false} icon={LogOut} label="خروج" onClick={() => setUnlocked(false)} />
          </div>
        </aside>

        <main className="w-full px-5 py-5 md:px-8 lg:px-10">
          <MobileNav screen={screen} setScreen={setScreen} openCalculations={() => openCalculations()} />
          {screen === "dashboard" && (
            <Dashboard
              version={version}
              settings={settings}
              onNew={() => openClientForm()}
              onCalculations={() => openCalculations()}
              onEdit={openClientForm}
            />
          )}
          {screen === "clients" && (
            <Clients
              version={version}
              onNew={() => openClientForm()}
              onEdit={openClientForm}
              onCalculate={openCalculations}
              onChanged={() => setVersion((value) => value + 1)}
              toast={push}
            />
          )}
          {screen === "client-form" && (
            <ClientForm
              client={editing}
              onBack={() => setScreen("clients")}
              onSaved={(client) => {
                setEditing(normalizeClient(client));
                setVersion((value) => value + 1);
              }}
              toast={push}
            />
          )}
          {screen === "calculator" && <CalculationsScreen initialClient={calculationClient} settings={settings} toast={push} />}
          {screen === "settings" && <SettingsScreen settings={settings} setSettings={setSettings} toast={push} />}
        </main>
      </div>
      <ToastStack toasts={toasts} />
    </div>
  );
}

function BrandLogo({ settings, className = "h-12 w-12" }: { settings: Settings; className?: string }) {
  const [failed, setFailed] = useState(false);
  const logo = settings.logo_path ? assetUrl(settings.logo_path) : "/logo.png";
  useEffect(() => setFailed(false), [logo]);
  if (failed) {
    return (
      <div className={cn("grid place-items-center rounded-control bg-[var(--primary)] text-white shadow-lift", className)}>
        <Leaf size={23} />
      </div>
    );
  }
  return (
    <div className={cn("grid place-items-center overflow-hidden rounded-control bg-white text-[var(--primary)] shadow-lift", className)}>
      <img src={logo} alt="Dietoy" className="h-full w-full object-contain p-2" onError={() => setFailed(true)} />
    </div>
  );
}

function Brand({ settings }: { settings: Settings }) {
  return (
    <div className="flex items-center gap-3">
      <BrandLogo settings={settings} />
      <div>
        <p className="text-lg font-bold">{settings.clinic_name || "Dietoy"}</p>
        <p className="mt-1 text-xs text-warm-500">{settings.dietitian_name || "مدیریت حرفه‌ای تغذیه"}</p>
      </div>
    </div>
  );
}

function NavItem({ active, icon: Icon, label, onClick }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "soft-transition flex h-12 items-center gap-3 rounded-control px-4 text-sm font-semibold",
        active ? "bg-[var(--primary)] text-white shadow-lift" : "text-warm-500 hover:bg-warm-50 hover:text-charcoal",
      )}
    >
      <Icon size={20} />
      {label}
    </button>
  );
}

function MobileNav({ screen, setScreen, openCalculations }: { screen: Screen; setScreen: (screen: Screen) => void; openCalculations: () => void }) {
  const item = "grid h-11 place-items-center rounded-control border border-warm-100 bg-paper text-warm-500";
  return (
    <div className="mb-5 grid grid-cols-4 gap-2 lg:hidden">
      <button className={cn(item, screen === "dashboard" && "bg-[var(--primary)] text-white")} onClick={() => setScreen("dashboard")} aria-label="داشبورد"><Home size={20} /></button>
      <button className={cn(item, (screen === "clients" || screen === "client-form") && "bg-[var(--primary)] text-white")} onClick={() => setScreen("clients")} aria-label="مراجعین"><Users size={20} /></button>
      <button className={cn(item, screen === "calculator" && "bg-[var(--primary)] text-white")} onClick={openCalculations} aria-label="محاسبات"><Calculator size={20} /></button>
      <button className={cn(item, screen === "settings" && "bg-[var(--primary)] text-white")} onClick={() => setScreen("settings")} aria-label="تنظیمات"><SettingsIcon size={20} /></button>
    </div>
  );
}

function LoginScreen({ settings, onLogin, toast, toasts }: { settings: Settings; onLogin: () => void; toast: ToastFn; toasts: Toast[] }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (!isDesktopRuntime()) {
        username === "admin" && password === "admin" ? onLogin() : toast("نام کاربری یا رمز عبور درست نیست.", "error");
        return;
      }
      const ok = await invoke<boolean>("login", { input: { username, password } });
      ok ? onLogin() : toast("نام کاربری یا رمز عبور درست نیست.", "error");
    } catch {
      toast("ورود انجام نشد.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell min-h-screen bg-[var(--app-bg)]" dir="rtl" style={backgroundStyle(settings)}>
      <main className="grid min-h-screen place-items-center px-5 py-8">
        <section className="login-card w-full max-w-[980px] overflow-hidden rounded-[28px] border border-warm-100 bg-paper shadow-soft md:grid md:grid-cols-[1fr_420px]">
          <div className="relative hidden min-h-[560px] overflow-hidden bg-[var(--primary)] p-9 text-white md:block">
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <BrandLogo settings={settings} className="h-14 w-14 rounded-card" />
                <h1 className="mt-8 text-4xl font-bold leading-[1.45]">Dietoy</h1>
                <p className="mt-4 max-w-sm text-sm leading-8 text-white/78">پرونده‌ها، محاسبات، وقت‌های بعدی و پشتیبان‌گیری روی همین دستگاه می‌ماند.</p>
              </div>
              <div className="rounded-card border border-white/14 bg-white/10 p-5">
                <p className="text-sm font-semibold">ورود اولیه</p>
                <p className="numbers mt-3 text-2xl font-bold">admin / admin</p>
                <p className="mt-2 text-xs leading-6 text-white/70">بعد از ورود از تنظیمات رمز را تغییر دهید.</p>
              </div>
            </div>
          </div>
          <form onSubmit={submit} className="p-7 md:p-9">
            <p className="text-sm font-semibold text-olive">Dietoy</p>
            <h2 className="mt-3 text-3xl font-bold">خوش آمدید</h2>
            <p className="mt-3 text-sm leading-7 text-warm-500">برای دسترسی به اطلاعات مراجعین وارد شوید.</p>
            <div className="mt-8 grid gap-5">
              <IconInput icon={UserRound} label="نام کاربری" value={username} onChange={setUsername} autoComplete="username" />
              <IconInput icon={KeyRound} label="رمز عبور" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
            </div>
            <div className="mt-8">
              <PrimaryButton icon={KeyRound} type="submit">{loading ? "در حال ورود..." : "ورود به برنامه"}</PrimaryButton>
            </div>
          </form>
        </section>
      </main>
      <ToastStack toasts={toasts} />
    </div>
  );
}

function Dashboard({ version, settings, onNew, onCalculations, onEdit }: { version: number; settings: Settings; onNew: () => void; onCalculations: () => void; onEdit: (client: Client) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [filter, setFilter] = useState("today");
  const [exactDate, setExactDate] = useState(todayIsoDate());
  const [range, setRange] = useState({ from: todayIsoDate(), to: addDaysIso(7) });

  useEffect(() => {
    if (!isDesktopRuntime()) {
      setStats({ total_clients: 0, active_clients: 0, recent_clients: [] });
      setClients([]);
      return;
    }
    setStats(null);
    invoke<DashboardStats>("dashboard_stats")
      .then(setStats)
      .catch(() => setStats({ total_clients: 0, active_clients: 0, recent_clients: [] }));
    invoke<Client[]>("list_clients", { includeArchived: false })
      .then((items) => setClients(items.map(normalizeClient)))
      .catch(() => setClients([]));
  }, [version]);

  const appointmentItems = useMemo(() => {
    const today = todayIsoDate();
    return clients
      .filter((client) => {
        const date = client.next_visit_date || "";
        if (!date) return false;
        if (filter === "today") return date === today;
        if (filter === "week") return date >= today && date <= addDaysIso(7);
        if (filter === "month") return date.slice(0, 7) === today.slice(0, 7);
        if (filter === "exact") return date === exactDate;
        if (filter === "range") return date >= range.from && date <= range.to;
        return true;
      })
      .sort((a, b) => (a.next_visit_date || "").localeCompare(b.next_visit_date || ""));
  }, [clients, filter, exactDate, range]);

  return (
    <>
      <PageHeader
        title={settings.dietitian_name ? `سلام، ${settings.dietitian_name}` : "داشبورد روزانه"}
        subtitle={`امروز ${formatPersianDate()} است. مراجعات، پرونده‌ها و محاسبات تغذیه‌ای اینجا مدیریت می‌شوند.`}
        action={<PrimaryButton icon={Plus} onClick={onNew}>مراجع جدید</PrimaryButton>}
      />
      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-olive">اقدام سریع</p>
              <h2 className="mt-3 text-2xl font-bold">شروع ویزیت بدون شلوغی</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-warm-500">پرونده جدید بسازید یا مستقیماً وارد محاسبات انرژی، IBW، ABW، BMR، TEE و ماکروها شوید.</p>
            </div>
            <Sparkles className="text-sage" size={28} />
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <PrimaryButton icon={Plus} onClick={onNew}>ثبت مراجع</PrimaryButton>
            <SecondaryButton icon={Calculator} onClick={onCalculations}>محاسبات</SecondaryButton>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="همه مراجعین" value={stats?.total_clients} icon={Users} />
          <Stat label="فعال" value={stats?.active_clients} icon={Leaf} />
        </div>
      </section>
      <section className="card mt-5 p-6">
        <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-xl font-bold">تقویم مراجعات</h2>
            <p className="helper mt-1">وقت‌های موقت زرد و وقت‌های قطعی سبز هستند.</p>
          </div>
          <div className="grid gap-2 md:grid-cols-3 xl:w-[620px]">
            <SelectPlain value={filter} onChange={setFilter} options={{ today: "امروز", week: "این هفته", month: "این ماه", exact: "تاریخ دقیق", range: "بازه دلخواه", all: "همه" }} />
            {filter === "exact" && <DateField label="تاریخ" value={exactDate} onChange={setExactDate} compact />}
            {filter === "range" && (
              <>
                <DateField label="از" value={range.from} onChange={(value) => setRange({ ...range, from: value })} compact />
                <DateField label="تا" value={range.to} onChange={(value) => setRange({ ...range, to: value })} compact />
              </>
            )}
          </div>
        </div>
        {appointmentItems.length === 0 ? (
          <EmptyState icon={CalendarDays} title="مراجعه‌ای در این بازه نیست" text="از پرونده مراجع، تاریخ مراجعه بعدی و وضعیت وقت را ثبت کنید." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {appointmentItems.map((client) => <AppointmentCard key={client.id} client={client} onClick={() => onEdit(client)} />)}
          </div>
        )}
      </section>
      <section className="card mt-5 p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">مراجعین اخیر</h2>
          <Users className="text-sage" size={22} />
        </div>
        {!stats ? <SkeletonRows /> : stats.recent_clients.length === 0 ? (
          <EmptyState icon={Users} title="هنوز مراجعی ثبت نشده" text="اولین پرونده را بسازید تا این بخش زنده شود." />
        ) : (
          <div className="grid gap-3">
            {stats.recent_clients.map((client) => <ClientRow key={client.id} client={normalizeClient(client)} onEdit={() => onEdit(normalizeClient(client))} />)}
          </div>
        )}
      </section>
    </>
  );
}

function AppointmentCard({ client, onClick }: { client: Client; onClick: () => void }) {
  const confirmed = client.next_visit_status === "confirmed";
  return (
    <button onClick={onClick} className={cn("rounded-card border p-4 text-right soft-transition hover:shadow-soft", confirmed ? "border-emerald/30 bg-emerald/10" : "border-amber-200 bg-amber-50")}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold">{client.full_name}</span>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", confirmed ? "bg-emerald/15 text-emerald" : "bg-amber-100 text-amber-700")}>{confirmed ? "قطعی" : "موقت"}</span>
      </div>
      <p className="mt-2 text-xs text-warm-500">{formatPersianDate(client.next_visit_date || todayIsoDate())}</p>
      {client.phone && <p className="numbers mt-2 text-xs text-warm-500">{client.phone}</p>}
    </button>
  );
}

function Clients({ version, onNew, onEdit, onCalculate, onChanged, toast }: { version: number; onNew: () => void; onEdit: (client: Client) => void; onCalculate: (client: Client) => void; onChanged: () => void; toast: ToastFn }) {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [goalFilter, setGoalFilter] = useState<GoalFilter>("all");

  useEffect(() => {
    if (!isDesktopRuntime()) {
      setClients([]);
      return;
    }
    setClients(null);
    invoke<Client[]>("list_clients", { includeArchived })
      .then((items) => setClients(items.map(normalizeClient)))
      .catch(() => setClients([]));
  }, [version, includeArchived]);

  const goalCounts = useMemo(() => {
    const base = { all: 0, lose: 0, maintain: 0, gain: 0 } as Record<GoalFilter, number>;
    for (const client of clients ?? []) {
      if (!client.archived || includeArchived) {
        base.all += 1;
        base[client.goal] += 1;
      }
    }
    return base;
  }, [clients, includeArchived]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (clients ?? []).filter((client) => {
      const matchesGoal = goalFilter === "all" || client.goal === goalFilter;
      const matchesQuery = [client.full_name, client.phone, client.email]
        .some((value) => value.toLowerCase().includes(needle));
      return matchesGoal && matchesQuery;
    });
  }, [clients, query, goalFilter]);

  const archive = async (client: Client) => {
    await invoke("archive_client", { id: client.id, archived: !client.archived });
    toast(client.archived ? "مراجع فعال شد." : "مراجع بایگانی شد.");
    onChanged();
  };

  return (
    <>
      <PageHeader title="مراجعین" subtitle="جست‌وجو، گروه‌بندی بر اساس هدف، ویرایش و محاسبه برای هر مراجع." action={<PrimaryButton icon={Plus} onClick={onNew}>مراجع جدید</PrimaryButton>} />
      <section className="card p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-warm-500" size={20} />
            <input className="control w-full pr-12" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی نام، موبایل یا ایمیل" />
          </div>
          <label className="flex h-12 items-center gap-2 rounded-control border border-warm-100 bg-warm-50 px-4 text-sm text-warm-500">
            <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
            نمایش بایگانی
          </label>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-4">
          <GoalFilterButton label="همه" count={goalCounts.all} active={goalFilter === "all"} onClick={() => setGoalFilter("all")} />
          <GoalFilterButton label={goalLabels.lose} count={goalCounts.lose} active={goalFilter === "lose"} onClick={() => setGoalFilter("lose")} />
          <GoalFilterButton label={goalLabels.maintain} count={goalCounts.maintain} active={goalFilter === "maintain"} onClick={() => setGoalFilter("maintain")} />
          <GoalFilterButton label={goalLabels.gain} count={goalCounts.gain} active={goalFilter === "gain"} onClick={() => setGoalFilter("gain")} />
        </div>

        <div className="mt-5 grid gap-3">
          {!clients ? <SkeletonRows /> : filtered.length === 0 ? (
            <EmptyState icon={Search} title="موردی پیدا نشد" text="فیلتر هدف یا عبارت جست‌وجو را تغییر دهید." />
          ) : (
            filtered.map((client) => (
              <ClientRow key={client.id} client={client} onEdit={() => onEdit(client)} onCalculate={() => onCalculate(client)} onArchive={() => archive(client)} />
            ))
          )}
        </div>
      </section>
    </>
  );
}

function GoalFilterButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "soft-transition rounded-control border px-4 py-3 text-right text-sm",
        active ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-lift" : "border-warm-100 bg-warm-50 text-warm-600 hover:bg-paper",
      )}
    >
      <span className="block font-bold">{label}</span>
      <span className="numbers mt-1 block text-xs opacity-80">{formatNumber(count)} مراجع</span>
    </button>
  );
}

function ClientRow({ client, onEdit, onCalculate, onArchive }: { client: Client; onEdit: () => void; onCalculate?: () => void; onArchive?: () => void }) {
  return (
    <div className="card flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <ProfileAvatar client={client} />
        <div>
          <p className="font-bold">{client.full_name}</p>
          <p className="mt-1 text-xs text-warm-500">{genderLabels[client.gender]} · {formatNumber(client.age)} سال · {goalLabels[client.goal]}</p>
          {client.next_visit_date && <p className="mt-1 text-xs text-olive">مراجعه بعدی: {formatPersianDate(client.next_visit_date)} · {client.next_visit_status === "confirmed" ? "قطعی" : "موقت"}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <SecondaryButton icon={ClipboardList} onClick={onEdit}>ویرایش</SecondaryButton>
        {onCalculate && <SecondaryButton icon={Calculator} onClick={onCalculate}>محاسبات</SecondaryButton>}
        {onArchive && <SecondaryButton icon={Archive} onClick={onArchive}>{client.archived ? "فعال‌سازی" : "بایگانی"}</SecondaryButton>}
      </div>
    </div>
  );
}

function ProfileAvatar({ client, size = "md" }: { client: Client; size?: "md" | "lg" }) {
  const src = assetUrl(client.profile_image_path);
  const className = size === "lg" ? "h-20 w-20" : "h-12 w-12";
  if (src) return <img src={src} className={cn("rounded-control object-cover", className)} alt={client.full_name} />;
  return <div className={cn("grid place-items-center rounded-control bg-warm-50 text-sage", className)}><UserRound size={size === "lg" ? 34 : 22} /></div>;
}

function ClientForm({ client, onBack, onSaved, toast }: { client: Client | null; onBack: () => void; onSaved: (client: Client) => void; toast: ToastFn }) {
  const [form, setForm] = useState<Client>(client ? normalizeClient(client) : { ...emptyClient });
  const [records, setRecords] = useState<ClientRecord[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [attachmentForm, setAttachmentForm] = useState({ category: "body_analysis" as AttachmentCategory, title: "", attachment_date: todayIsoDate(), notes: "" });
  const [visits, setVisits] = useState<Visit[]>([]);
  const [selectedVisitId, setSelectedVisitId] = useState<number | "">("");
  const [visitForm, setVisitForm] = useState({ visit_date: todayIsoDate(), status: "done" as VisitStatus, notes: "" });
  const [serviceCatalog, setServiceCatalog] = useState<ServiceCatalogItem[]>([]);
  const [visitServices, setVisitServices] = useState<VisitService[]>([]);
  const [visitServiceForm, setVisitServiceForm] = useState({ service_id: "", service_name_snapshot: "", price: 0, quantity: 1, notes: "" });
  const [recordForm, setRecordForm] = useState({
    record_date: todayIsoDate(),
    weight_kg: client?.weight_kg ?? emptyClient.weight_kg,
    height_cm: client?.height_cm ?? emptyClient.height_cm,
    notes: "",
  });

  useEffect(() => setForm(client ? normalizeClient(client) : { ...emptyClient }), [client]);

  useEffect(() => {
    setRecordForm({
      record_date: todayIsoDate(),
      weight_kg: client?.weight_kg ?? emptyClient.weight_kg,
      height_cm: client?.height_cm ?? emptyClient.height_cm,
      notes: "",
    });
    setSelectedAttachment(null);
    setSelectedVisitId("");
    setVisitServices([]);
    if (!client?.id || !isDesktopRuntime()) {
      setRecords([]);
      setAttachments([]);
      setVisits([]);
      setServiceCatalog([]);
      return;
    }
    invoke<ClientRecord[]>("list_client_records", { clientId: client.id }).then(setRecords).catch(() => setRecords([]));
    invoke<Attachment[]>("list_attachments", { clientId: client.id, category: null }).then(setAttachments).catch(() => setAttachments([]));
    invoke<Visit[]>("list_visits", { clientId: client.id }).then((items) => { setVisits(items); if (items[0]?.id) setSelectedVisitId(items[0].id); }).catch(() => setVisits([]));
    invoke<ServiceCatalogItem[]>("list_service_catalog", { activeOnly: true }).then(setServiceCatalog).catch(() => setServiceCatalog([]));
  }, [client]);

  useEffect(() => {
    if (!selectedVisitId || !isDesktopRuntime()) {
      setVisitServices([]);
      return;
    }
    invoke<VisitService[]>("list_visit_services", { visitId: selectedVisitId }).then(setVisitServices).catch(() => setVisitServices([]));
  }, [selectedVisitId]);

  const bodyAnalysisFiles = attachments.filter((item) => item.category === "body_analysis");
  const otherAttachments = attachments.filter((item) => item.category !== "body_analysis");
  const selectedVisit = visits.find((visit) => visit.id === selectedVisitId);

  const setField = <K extends keyof Client>(key: K, value: Client[K]) => setForm((current) => ({ ...current, [key]: value }));

  const chooseProfileImage = async () => {
    try {
      const selected = await open({ multiple: false, filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"] }] });
      if (!selected || Array.isArray(selected)) return;
      const imported = isDesktopRuntime() ? await invoke<string>("import_brand_asset", { path: selected, kind: "client-profile" }) : selected;
      setField("profile_image_path", imported);
      toast("عکس پروفایل انتخاب شد.");
    } catch {
      toast("انتخاب عکس انجام نشد.", "error");
    }
  };

  const save = async () => {
    if (!form.full_name.trim()) {
      toast("نام مراجع را وارد کنید.", "error");
      return;
    }
    try {
      const saved = await invoke<Client>("save_client", { client: normalizeClient(form) });
      if (!client && saved.id) {
        await invoke<ClientRecord>("save_client_record", {
          record: {
            client_id: saved.id,
            record_date: todayIsoDate(),
            weight_kg: saved.weight_kg,
            height_cm: saved.height_cm,
            notes: "ثبت اولیه مراجع",
          },
        });
      }
      onSaved(normalizeClient(saved));
      toast(client ? "پرونده ذخیره شد." : "مراجع جدید ثبت شد.");
    } catch {
      toast("ذخیره انجام نشد.", "error");
    }
  };

  const saveRecord = async () => {
    if (!client?.id) {
      toast("اول پرونده مراجع را ذخیره کنید.", "error");
      return;
    }
    try {
      const record = await invoke<ClientRecord>("save_client_record", {
        record: {
          client_id: client.id,
          record_date: recordForm.record_date,
          weight_kg: recordForm.weight_kg,
          height_cm: recordForm.height_cm,
          notes: recordForm.notes,
        },
      });
      setRecords((items) => [...items, record].sort((a, b) => a.record_date.localeCompare(b.record_date)));
      const updatedClient = { ...form, weight_kg: record.weight_kg, height_cm: record.height_cm };
      setForm(updatedClient);
      await invoke<Client>("save_client", { client: normalizeClient(updatedClient) });
      toast("رکورد جدید اضافه شد.");
    } catch {
      toast("ثبت رکورد انجام نشد.", "error");
    }
  };

  const importAttachment = async () => {
    if (!client?.id) {
      toast("اول پرونده مراجع را ذخیره کنید.", "error");
      return;
    }
    try {
      const selected = await open({ multiple: false, filters: [{ name: "Files", extensions: ["pdf", "png", "jpg", "jpeg", "webp", "doc", "docx", "xls", "xlsx"] }] });
      if (!selected || Array.isArray(selected)) return;
      const attachment = await invoke<Attachment>("import_attachment", {
        clientId: client.id,
        visitId: selectedVisitId || null,
        path: selected,
        category: attachmentForm.category,
        title: attachmentForm.title,
        attachmentDate: attachmentForm.attachment_date,
        notes: attachmentForm.notes,
      });
      setAttachments((items) => [attachment, ...items]);
      setSelectedAttachment(attachment);
      setAttachmentForm({ category: "body_analysis", title: "", attachment_date: todayIsoDate(), notes: "" });
      toast("فایل به پرونده اضافه شد.");
    } catch {
      toast("افزودن فایل انجام نشد.", "error");
    }
  };

  const saveVisit = async () => {
    if (!client?.id) {
      toast("اول پرونده مراجع را ذخیره کنید.", "error");
      return;
    }
    try {
      const visit = await invoke<Visit>("save_visit", {
        visit: {
          client_id: client.id,
          visit_date: visitForm.visit_date,
          status: visitForm.status,
          notes: visitForm.notes,
          total_fee: 0,
        },
      });
      setVisits((items) => [visit, ...items]);
      if (visit.id) setSelectedVisitId(visit.id);
      setVisitForm({ visit_date: todayIsoDate(), status: "done", notes: "" });
      toast("ویزیت ثبت شد.");
    } catch {
      toast("ثبت ویزیت انجام نشد.", "error");
    }
  };

  const addVisitService = async () => {
    if (!selectedVisitId) {
      toast("اول یک ویزیت را انتخاب یا ثبت کنید.", "error");
      return;
    }
    const selectedService = serviceCatalog.find((item) => String(item.id) === visitServiceForm.service_id);
    const name = selectedService?.name || visitServiceForm.service_name_snapshot.trim();
    if (!name) {
      toast("نام خدمت را انتخاب یا وارد کنید.", "error");
      return;
    }
    try {
      const item = await invoke<VisitService>("save_visit_service", {
        item: {
          visit_id: selectedVisitId,
          service_id: selectedService?.id ?? null,
          service_name_snapshot: name,
          price: visitServiceForm.price,
          quantity: visitServiceForm.quantity,
          total: visitServiceForm.price * visitServiceForm.quantity,
          notes: visitServiceForm.notes,
        },
      });
      setVisitServices((items) => [...items, item]);
      setVisits((items) => items.map((visit) => visit.id === selectedVisitId ? { ...visit, total_fee: visit.total_fee + item.total } : visit));
      setVisitServiceForm({ service_id: "", service_name_snapshot: "", price: 0, quantity: 1, notes: "" });
      toast("خدمت به ویزیت اضافه شد.");
    } catch {
      toast("ثبت خدمت انجام نشد.", "error");
    }
  };

  const selectService = (value: string) => {
    const item = serviceCatalog.find((service) => String(service.id) === value);
    setVisitServiceForm((current) => ({
      ...current,
      service_id: value,
      service_name_snapshot: item?.name ?? "",
      price: item?.default_price ?? current.price,
    }));
  };

  return (
    <>
      <PageHeader title={client ? "پرونده مراجع" : "ثبت مراجع جدید"} subtitle="اطلاعات پایه، رکوردها، بادی‌آنالیز، پیوست‌ها، و خدمات هر ویزیت را مدیریت کنید." action={<SecondaryButton icon={RotateCcw} onClick={onBack}>بازگشت</SecondaryButton>} />
      <section className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="card p-5">
          <div className="flex items-center gap-4">
            <ProfileAvatar client={form} size="lg" />
            <div>
              <p className="font-bold">{form.full_name || "مراجع جدید"}</p>
              <button className="mt-2 text-xs font-semibold text-olive" onClick={chooseProfileImage}>انتخاب عکس پروفایل</button>
            </div>
          </div>
          <div className="mt-6 grid gap-4">
            <TextField label="نام کامل" value={form.full_name} onChange={(value) => setField("full_name", value)} />
            <TextField label="موبایل" value={form.phone} onChange={(value) => setField("phone", value)} />
            <TextField label="ایمیل" value={form.email} onChange={(value) => setField("email", value)} />
            <SelectField label="جنسیت" value={form.gender} onChange={(value) => setField("gender", value as Gender)} options={genderLabels} />
            <NumberField label="سن" value={form.age} onChange={(value) => setField("age", value)} />
            <NumberField label="قد فعلی" value={form.height_cm} onChange={(value) => setField("height_cm", value)} suffix="cm" />
            <NumberField label="وزن فعلی" value={form.weight_kg} onChange={(value) => setField("weight_kg", value)} suffix="kg" />
            <SelectField label="سطح فعالیت" value={form.activity_level} onChange={(value) => setField("activity_level", value as ActivityLevel)} options={activityLabels} />
            <SelectField label="هدف" value={form.goal} onChange={(value) => setField("goal", value as Goal)} options={goalLabels} />
            <DateField label="تاریخ مراجعه بعدی" value={form.next_visit_date ?? ""} onChange={(value) => setField("next_visit_date", value)} />
            <SelectField label="وضعیت وقت" value={form.next_visit_status ?? "tentative"} onChange={(value) => setField("next_visit_status", value as VisitStatus)} options={{ tentative: "موقت", confirmed: "قطعی" }} />
            <TextArea label="یادداشت" value={form.notes} onChange={(value) => setField("notes", value)} />
            <PrimaryButton icon={Save} onClick={save}>ذخیره پرونده</PrimaryButton>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="card p-5">
            <h2 className="text-xl font-bold">رکوردهای پایش</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <DateField label="تاریخ" value={recordForm.record_date} onChange={(value) => setRecordForm((current) => ({ ...current, record_date: value }))} compact />
              <NumberField label="وزن" value={recordForm.weight_kg} onChange={(value) => setRecordForm((current) => ({ ...current, weight_kg: value }))} suffix="kg" />
              <NumberField label="قد" value={recordForm.height_cm} onChange={(value) => setRecordForm((current) => ({ ...current, height_cm: value }))} suffix="cm" />
              <div className="flex items-end"><SecondaryButton icon={Plus} onClick={saveRecord}>ثبت رکورد</SecondaryButton></div>
            </div>
            <TextArea label="یادداشت رکورد" value={recordForm.notes} onChange={(value) => setRecordForm((current) => ({ ...current, notes: value }))} />
            <div className="mt-5 grid gap-3">
              {records.length === 0 ? <EmptyState icon={TrendingUp} title="رکوردی وجود ندارد" text="بعد از ذخیره پرونده، وزن و قد هر جلسه را ثبت کنید." /> : records.map((record) => (
                <div key={record.id} className="rounded-control border border-warm-100 bg-warm-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold">{formatPersianDate(record.record_date)}</p>
                    <p className="numbers text-sm text-warm-500">{formatNumber(record.weight_kg, 1)} kg · {formatNumber(record.height_cm, 0)} cm</p>
                  </div>
                  {record.notes && <p className="mt-2 text-sm leading-7 text-warm-500">{record.notes}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-xl font-bold">بادی‌آنالیز و پیوست‌ها</h2>
            <p className="helper mt-1">برای هر مراجع چند فایل با تاریخ مستقل ثبت می‌شود. بادی‌آنالیزها جدا نمایش داده می‌شوند.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <SelectField label="نوع فایل" value={attachmentForm.category} onChange={(value) => setAttachmentForm((current) => ({ ...current, category: value as AttachmentCategory }))} options={attachmentCategoryLabels} />
              <DateField label="تاریخ فایل" value={attachmentForm.attachment_date} onChange={(value) => setAttachmentForm((current) => ({ ...current, attachment_date: value }))} />
              <TextField label="عنوان" value={attachmentForm.title} onChange={(value) => setAttachmentForm((current) => ({ ...current, title: value }))} />
              <div className="flex items-end"><SecondaryButton icon={FileUp} onClick={importAttachment}>افزودن فایل</SecondaryButton></div>
            </div>
            <TextArea label="یادداشت فایل" value={attachmentForm.notes} onChange={(value) => setAttachmentForm((current) => ({ ...current, notes: value }))} />
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <AttachmentList title="بادی‌آنالیزها" items={bodyAnalysisFiles} empty="بادی‌آنالیزی ثبت نشده است." onView={setSelectedAttachment} prominent />
              <AttachmentList title="سایر پیوست‌ها" items={otherAttachments} empty="پیوست دیگری ثبت نشده است." onView={setSelectedAttachment} />
            </div>
            {selectedAttachment && <FilePreview attachment={selectedAttachment} />}
          </div>

          <div className="card p-5">
            <h2 className="text-xl font-bold">ویزیت‌ها و خدمات</h2>
            <p className="helper mt-1">خدمات هر جلسه از لیست تنظیمات انتخاب می‌شود و جمع هزینه جلسه خودکار محاسبه می‌شود.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <DateField label="تاریخ ویزیت" value={visitForm.visit_date} onChange={(value) => setVisitForm((current) => ({ ...current, visit_date: value }))} />
              <SelectField label="وضعیت" value={visitForm.status} onChange={(value) => setVisitForm((current) => ({ ...current, status: value as VisitStatus }))} options={visitStatusOptions} />
              <TextField label="یادداشت ویزیت" value={visitForm.notes} onChange={(value) => setVisitForm((current) => ({ ...current, notes: value }))} />
              <div className="flex items-end"><SecondaryButton icon={Plus} onClick={saveVisit}>ثبت ویزیت</SecondaryButton></div>
            </div>
            <div className="mt-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
              <div className="grid gap-3">
                {visits.length === 0 ? <EmptyState icon={CalendarDays} title="ویزیتی ثبت نشده" text="برای ثبت خدمات، ابتدا یک ویزیت بسازید." /> : visits.map((visit) => (
                  <button key={visit.id} onClick={() => visit.id && setSelectedVisitId(visit.id)} className={cn("rounded-control border p-4 text-right soft-transition", selectedVisitId === visit.id ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-warm-100 bg-warm-50 hover:bg-paper")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{formatPersianDate(visit.visit_date)}</span>
                      <span className="numbers text-xs">{formatNumber(visit.total_fee, 0)} تومان</span>
                    </div>
                    <p className="mt-2 text-xs opacity-80">{visitStatusOptions[visit.status]}</p>
                    {visit.notes && <p className="mt-2 text-xs opacity-80">{visit.notes}</p>}
                  </button>
                ))}
              </div>
              <div className="rounded-card border border-warm-100 bg-warm-50 p-4">
                <h3 className="font-bold">خدمات ویزیت انتخاب‌شده</h3>
                {selectedVisit && <p className="numbers mt-1 text-xs text-warm-500">جمع فعلی: {formatNumber(selectedVisit.total_fee, 0)} تومان</p>}
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <SelectField label="انتخاب خدمت" value={visitServiceForm.service_id} onChange={selectService} options={{ "": "انتخاب دستی/آزاد", ...Object.fromEntries(serviceCatalog.map((service) => [String(service.id), `${service.name} · ${formatNumber(service.default_price, 0)}`])) }} />
                  <TextField label="نام خدمت آزاد" value={visitServiceForm.service_name_snapshot} onChange={(value) => setVisitServiceForm((current) => ({ ...current, service_name_snapshot: value }))} />
                  <NumberField label="هزینه" value={visitServiceForm.price} onChange={(value) => setVisitServiceForm((current) => ({ ...current, price: value }))} />
                  <NumberField label="تعداد" value={visitServiceForm.quantity} onChange={(value) => setVisitServiceForm((current) => ({ ...current, quantity: value }))} />
                </div>
                <TextArea label="یادداشت خدمت" value={visitServiceForm.notes} onChange={(value) => setVisitServiceForm((current) => ({ ...current, notes: value }))} />
                <div className="mt-3"><SecondaryButton icon={Plus} onClick={addVisitService}>افزودن خدمت به ویزیت</SecondaryButton></div>
                <div className="mt-4 grid gap-2">
                  {visitServices.length === 0 ? <p className="text-sm text-warm-500">برای این ویزیت خدمتی ثبت نشده است.</p> : visitServices.map((item) => (
                    <div key={item.id} className="rounded-control bg-paper p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{item.service_name_snapshot}</span>
                        <span className="numbers text-sm text-olive">{formatNumber(item.total, 0)} تومان</span>
                      </div>
                      <p className="numbers mt-1 text-xs text-warm-500">{formatNumber(item.price, 0)} × {formatNumber(item.quantity, 1)}</p>
                      {item.notes && <p className="mt-1 text-xs text-warm-500">{item.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function AttachmentList({ title, items, empty, onView, prominent = false }: { title: string; items: Attachment[]; empty: string; onView: (attachment: Attachment) => void; prominent?: boolean }) {
  return (
    <div>
      <h3 className="font-bold">{title}</h3>
      <div className="mt-3 grid gap-2">
        {items.length === 0 ? <p className="rounded-control bg-warm-50 p-4 text-sm text-warm-500">{empty}</p> : items.map((item) => (
          <div key={item.id} className={cn("rounded-control border p-4", prominent ? "border-emerald/20 bg-emerald/5" : "border-warm-100 bg-warm-50")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{item.title || item.file_name}</p>
                <p className="mt-1 text-xs text-warm-500">{attachmentCategoryLabels[item.category]} · {formatPersianDate(item.attachment_date)}</p>
              </div>
              <button className="rounded-full bg-paper p-2 text-olive shadow-sm" onClick={() => onView(item)} aria-label="مشاهده فایل"><Eye size={17} /></button>
            </div>
            {item.notes && <p className="mt-2 text-xs leading-6 text-warm-500">{item.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function FilePreview({ attachment }: { attachment: Attachment }) {
  const src = assetUrl(attachment.local_path);
  const ext = fileExtension(attachment.local_path || attachment.file_name);
  const isImage = ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext);
  return (
    <div className="mt-5 rounded-card border border-warm-100 bg-warm-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-bold">مشاهده فایل: {attachment.title || attachment.file_name}</p>
          <p className="mt-1 text-xs text-warm-500">{formatPersianDate(attachment.attachment_date)} · {attachment.file_name}</p>
        </div>
        <FileText className="text-sage" size={22} />
      </div>
      {ext === "pdf" ? (
        <iframe title={attachment.title || attachment.file_name} src={src} className="h-[520px] w-full rounded-control border border-warm-100 bg-white" />
      ) : isImage ? (
        <img src={src} alt={attachment.title || attachment.file_name} className="max-h-[520px] w-full rounded-control object-contain bg-white" />
      ) : (
        <div className="rounded-control bg-paper p-4 text-sm leading-7 text-warm-500">نمایش داخلی این فرمت محدود است. فایل در پرونده ذخیره شده و مسیر آن: <span className="numbers">{attachment.local_path}</span></div>
      )}
    </div>
  );
}

function CalculationsScreen({ initialClient, settings, toast }: { initialClient: Client | null; settings: Settings; toast: ToastFn }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState<Client>(initialClient ? normalizeClient(initialClient) : { ...emptyClient });

  useEffect(() => {
    setForm(initialClient ? normalizeClient(initialClient) : { ...emptyClient });
  }, [initialClient]);

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    invoke<Client[]>("list_clients", { includeArchived: false }).then((items) => setClients(items.map(normalizeClient))).catch(() => setClients([]));
  }, []);

  const result = calculateNutrition(form, settings);
  const setField = <K extends keyof Client>(key: K, value: Client[K]) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <>
      <PageHeader title="محاسبات" subtitle="BMI، IBW، ABW، BMR، TEE، کالری هدف و ماکروها بر اساس فرمول تنظیمات محاسبه می‌شوند." />
      <section className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="card p-5">
          <div className="grid gap-4">
            <SelectField label="انتخاب از مراجعین" value={String(form.id ?? "manual")} onChange={(value) => { const selected = clients.find((client) => String(client.id) === value); if (selected) setForm(normalizeClient(selected)); }} options={{ manual: "ورود دستی", ...Object.fromEntries(clients.map((client) => [String(client.id), client.full_name])) }} />
            <SelectField label="جنسیت" value={form.gender} onChange={(value) => setField("gender", value as Gender)} options={genderLabels} />
            <NumberField label="سن" value={form.age} onChange={(value) => setField("age", value)} />
            <NumberField label="قد" value={form.height_cm} onChange={(value) => setField("height_cm", value)} suffix="cm" />
            <NumberField label="وزن" value={form.weight_kg} onChange={(value) => setField("weight_kg", value)} suffix="kg" />
            <SelectField label="فعالیت" value={form.activity_level} onChange={(value) => setField("activity_level", value as ActivityLevel)} options={activityLabels} />
            <SelectField label="هدف" value={form.goal} onChange={(value) => setField("goal", value as Goal)} options={goalLabels} />
            <SecondaryButton icon={CheckCircle2} onClick={() => toast("محاسبات به‌روزرسانی شد.")}>به‌روزرسانی</SecondaryButton>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ResultCard label="BMI" value={formatNumber(result.bmi, 1)} helper={bmiCategory(result.bmi)} />
          <ResultCard label="IBW" value={`${formatNumber(result.ibw, 1)} kg`} helper="وزن ایده‌آل" />
          <ResultCard label="ABW" value={`${formatNumber(result.abw, 1)} kg`} helper="وزن تعدیل‌شده" />
          <ResultCard label="BMR" value={`${formatNumber(result.bmr, 0)} kcal`} helper="متابولیسم پایه" />
          <ResultCard label="TEE" value={`${formatNumber(result.tee, 0)} kcal`} helper={`ضریب فعالیت ${formatNumber(result.activityFactor, 2)}`} />
          <ResultCard label="کالری هدف" value={`${formatNumber(result.targetCalories, 0)} kcal`} helper={goalLabels[form.goal]} />
          <ResultCard label="پروتئین" value={`${formatNumber(result.proteinGrams, 0)} g`} helper={`${formatNumber(result.proteinPercent, 0)}٪ کالری`} />
          <ResultCard label="کربوهیدرات" value={`${formatNumber(result.carbsGrams, 0)} g`} helper={`${formatNumber(result.carbsPercent, 0)}٪ کالری`} />
          <ResultCard label="چربی" value={`${formatNumber(result.fatGrams, 0)} g`} helper={`${formatNumber(result.fatPercent, 0)}٪ کالری`} />
        </div>
      </section>
    </>
  );
}

function SettingsScreen({ settings, setSettings, toast }: { settings: Settings; setSettings: (settings: Settings) => void; toast: ToastFn }) {
  const [form, setForm] = useState<Settings>(settings);
  const [credentials, setCredentials] = useState({ current_password: "", username: settings.username || "admin", password: "" });
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [serviceForm, setServiceForm] = useState<ServiceCatalogItem>({ name: "", default_price: 0, active: true });

  useEffect(() => {
    setForm(settings);
    setCredentials((current) => ({ ...current, username: settings.username || "admin" }));
  }, [settings]);

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    invoke<ServiceCatalogItem[]>("list_service_catalog", { activeOnly: false }).then(setServices).catch(() => setServices([]));
  }, []);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm((current) => ({ ...current, [key]: value }));

  const saveSettings = async () => {
    try {
      const saved = isDesktopRuntime() ? await invoke<Settings>("save_settings", { settings: form }) : form;
      setSettings(withDefaults(saved));
      toast("تنظیمات ذخیره شد.");
    } catch {
      toast("ذخیره تنظیمات انجام نشد.", "error");
    }
  };

  const saveService = async () => {
    if (!serviceForm.name.trim()) {
      toast("نام خدمت را وارد کنید.", "error");
      return;
    }
    try {
      const saved = await invoke<ServiceCatalogItem>("save_service_catalog_item", { item: serviceForm });
      setServices((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      setServiceForm({ name: "", default_price: 0, active: true });
      toast("خدمت ذخیره شد.");
    } catch {
      toast("ذخیره خدمت انجام نشد.", "error");
    }
  };

  const chooseAsset = async (kind: "logo" | "background") => {
    try {
      const selected = await open({ multiple: false, filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif", "svg"] }] });
      if (!selected || Array.isArray(selected)) return;
      const imported = isDesktopRuntime() ? await invoke<string>("import_brand_asset", { path: selected, kind }) : selected;
      const key = kind === "logo" ? "logo_path" : "background_image_path";
      update(key, imported);
      toast(kind === "logo" ? "لوگو انتخاب شد." : "پس‌زمینه انتخاب شد.");
    } catch {
      toast("انتخاب فایل انجام نشد.", "error");
    }
  };

  const exportBackup = async (kind: "db" | "json") => {
    try {
      const path = await invoke<string>(kind === "db" ? "export_database" : "export_data_backup");
      toast(`پشتیبان ذخیره شد: ${path}`);
    } catch {
      toast("پشتیبان‌گیری انجام نشد.", "error");
    }
  };

  const restoreBackup = async () => {
    try {
      const selected = await open({ multiple: false, filters: [{ name: "Dietoy Backup", extensions: ["json"] }] });
      if (!selected || Array.isArray(selected)) return;
      await invoke("restore_data_backup", { path: selected });
      toast("بازیابی انجام شد. برنامه را یک بار ببندید و دوباره باز کنید.");
    } catch {
      toast("بازیابی انجام نشد.", "error");
    }
  };

  const changeCredentials = async () => {
    try {
      await invoke("change_credentials", { input: credentials });
      toast("اطلاعات ورود تغییر کرد.");
      setCredentials({ current_password: "", username: credentials.username, password: "" });
    } catch {
      toast("تغییر رمز انجام نشد.", "error");
    }
  };

  const applyDietoyTheme = () => {
    setForm((current) => ({ ...current, ...dietoyTheme }));
    toast("تم دایتوری اعمال شد. برای ذخیره، دکمه ذخیره تنظیمات را بزنید.");
  };

  const numberSetting = (key: keyof typeof defaultCalculationSettings) => (
    <NumberField label={settingLabel(key)} value={Number(form[key] ?? defaultCalculationSettings[key])} onChange={(value) => update(key, value as Settings[typeof key])} />
  );

  return (
    <>
      <PageHeader title="تنظیمات" subtitle="ظاهر، اطلاعات ورود، پشتیبان‌گیری، لیست خدمات و ضرایب محاسبات را مدیریت کنید." action={<PrimaryButton icon={Save} onClick={saveSettings}>ذخیره تنظیمات</PrimaryButton>} />
      <section className="grid gap-5 xl:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-xl font-bold">برندینگ</h2>
          <div className="mt-5 grid gap-4">
            <TextField label="نام متخصص" value={form.dietitian_name} onChange={(value) => update("dietitian_name", value)} />
            <TextField label="نام کلینیک" value={form.clinic_name} onChange={(value) => update("clinic_name", value)} />
            <ColorField label="رنگ اصلی" value={form.primary_color} onChange={(value) => update("primary_color", value)} />
            <ColorField label="رنگ پس‌زمینه" value={form.background_color} onChange={(value) => update("background_color", value)} />
            <ColorField label="رنگ متن" value={form.text_color} onChange={(value) => update("text_color", value)} />
            <div className="grid gap-2 md:grid-cols-3">
              <SecondaryButton icon={ImageIcon} onClick={() => chooseAsset("logo")}>انتخاب لوگو</SecondaryButton>
              <SecondaryButton icon={ImageIcon} onClick={() => chooseAsset("background")}>انتخاب پس‌زمینه</SecondaryButton>
              <SecondaryButton icon={Palette} onClick={applyDietoyTheme}>تم دایتوری</SecondaryButton>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-xl font-bold">ورود و پشتیبان</h2>
          <div className="mt-5 grid gap-4">
            <TextField label="نام کاربری" value={credentials.username} onChange={(value) => setCredentials((current) => ({ ...current, username: value }))} />
            <TextField label="رمز فعلی" type="password" value={credentials.current_password} onChange={(value) => setCredentials((current) => ({ ...current, current_password: value }))} />
            <TextField label="رمز جدید" type="password" value={credentials.password} onChange={(value) => setCredentials((current) => ({ ...current, password: value }))} />
            <SecondaryButton icon={KeyRound} onClick={changeCredentials}>تغییر ورود</SecondaryButton>
            <div className="grid gap-2 md:grid-cols-3">
              <SecondaryButton icon={Database} onClick={() => exportBackup("db")}>خروجی SQLite</SecondaryButton>
              <SecondaryButton icon={Download} onClick={() => exportBackup("json")}>Backup کامل</SecondaryButton>
              <SecondaryButton icon={FileUp} onClick={restoreBackup}>Restore</SecondaryButton>
            </div>
          </div>
        </div>
      </section>

      <section className="card mt-5 p-5">
        <h2 className="text-xl font-bold">لیست خدمات قابل انتخاب در ویزیت</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_160px_160px]">
          <TextField label="نام خدمت" value={serviceForm.name} onChange={(value) => setServiceForm((current) => ({ ...current, name: value }))} />
          <NumberField label="هزینه پیش‌فرض" value={serviceForm.default_price} onChange={(value) => setServiceForm((current) => ({ ...current, default_price: value }))} />
          <SelectField label="وضعیت" value={serviceForm.active ? "active" : "inactive"} onChange={(value) => setServiceForm((current) => ({ ...current, active: value === "active" }))} options={{ active: "فعال", inactive: "غیرفعال" }} />
          <div className="flex items-end"><SecondaryButton icon={Save} onClick={saveService}>ذخیره خدمت</SecondaryButton></div>
        </div>
        <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {services.length === 0 ? <p className="text-sm text-warm-500">هنوز خدمتی تعریف نشده است.</p> : services.map((service) => (
            <button key={service.id} onClick={() => setServiceForm(service)} className="rounded-control border border-warm-100 bg-warm-50 p-4 text-right hover:bg-paper">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{service.name}</span>
                <span className={cn("rounded-full px-2 py-1 text-xs", service.active ? "bg-emerald/10 text-emerald" : "bg-warm-100 text-warm-500")}>{service.active ? "فعال" : "غیرفعال"}</span>
              </div>
              <p className="numbers mt-2 text-sm text-warm-500">{formatNumber(service.default_price, 0)} تومان</p>
            </button>
          ))}
        </div>
      </section>

      <section className="card mt-5 p-5">
        <h2 className="text-xl font-bold">تنظیمات فرمول و ماکرو</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          {numberSetting("calc_ibw_bmi_factor")}
          {numberSetting("calc_abw_divisor")}
          {numberSetting("calc_bmr_base")}
          {numberSetting("calc_male_factor")}
          {numberSetting("calc_female_factor")}
          {numberSetting("calc_bmr_adjustment")}
          {numberSetting("calc_activity_sedentary")}
          {numberSetting("calc_activity_light")}
          {numberSetting("calc_activity_moderate")}
          {numberSetting("calc_activity_active")}
          {numberSetting("calc_activity_very_active")}
          {numberSetting("calc_goal_loss")}
          {numberSetting("calc_goal_maintain")}
          {numberSetting("calc_goal_gain")}
          {numberSetting("macro_protein_percent")}
          {numberSetting("macro_carb_percent")}
          {numberSetting("macro_fat_percent")}
        </div>
      </section>
    </>
  );
}

function settingLabel(key: keyof typeof defaultCalculationSettings) {
  const labels: Record<keyof typeof defaultCalculationSettings, string> = {
    calc_ibw_bmi_factor: "ضریب IBW/BMI",
    calc_abw_divisor: "تقسیم‌کننده ABW",
    calc_bmr_base: "ضریب پایه BMR",
    calc_male_factor: "ضریب مرد",
    calc_female_factor: "ضریب زن",
    calc_bmr_adjustment: "ضریب تعدیل BMR",
    calc_activity_sedentary: "فعالیت کم‌تحرک",
    calc_activity_light: "فعالیت سبک",
    calc_activity_moderate: "فعالیت متوسط",
    calc_activity_active: "فعال",
    calc_activity_very_active: "بسیار فعال",
    calc_goal_loss: "کسری کاهش وزن",
    calc_goal_maintain: "ثبات وزن",
    calc_goal_gain: "مازاد افزایش وزن",
    macro_protein_percent: "پروتئین ٪",
    macro_carb_percent: "کربوهیدرات ٪",
    macro_fat_percent: "چربی ٪",
  };
  return labels[key];
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-3xl font-bold text-charcoal">{title}</h1>
        <p className="mt-2 text-sm leading-7 text-warm-500">{subtitle}</p>
      </div>
      {action}
    </header>
  );
}

function PrimaryButton({ icon: Icon, children, type = "button", onClick }: { icon: LucideIcon; children: ReactNode; type?: "button" | "submit"; onClick?: () => void }) {
  return (
    <button type={type} onClick={onClick} className="soft-transition flex h-12 w-full items-center justify-center gap-2 rounded-control bg-[var(--primary)] px-5 text-sm font-bold text-white shadow-lift hover:brightness-105">
      <Icon size={20} />
      {children}
    </button>
  );
}

function SecondaryButton({ icon: Icon, children, onClick }: { icon: LucideIcon; children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="soft-transition flex h-11 items-center justify-center gap-2 rounded-control border border-warm-100 bg-paper px-4 text-sm font-semibold text-charcoal hover:bg-warm-50">
      <Icon size={18} />
      {children}
    </button>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value?: number; icon: LucideIcon }) {
  return (
    <div className="card p-5">
      <Icon className="text-sage" size={24} />
      <p className="mt-5 text-sm text-warm-500">{label}</p>
      <p className="numbers mt-2 text-3xl font-bold">{value === undefined ? "—" : formatNumber(value)}</p>
    </div>
  );
}

function ResultCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-warm-500">{label}</p>
      <p className="numbers mt-3 text-3xl font-bold text-charcoal">{value}</p>
      <p className="mt-2 text-xs text-olive">{helper}</p>
    </div>
  );
}

function IconInput({ icon: Icon, label, value, onChange, type = "text", autoComplete }: { icon: LucideIcon; label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="relative mt-2">
        <Icon className="absolute right-4 top-1/2 -translate-y-1/2 text-warm-500" size={18} />
        <input className="control w-full pr-11" value={value} onChange={(event) => onChange(event.target.value)} type={type} autoComplete={autoComplete} />
      </div>
    </label>
  );
}

function TextField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="control mt-2 w-full" value={value} onChange={(event) => onChange(event.target.value)} type={type} />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <textarea className="control mt-2 min-h-24 w-full" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (value: number) => void; suffix?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="relative mt-2">
        <input className="control numbers w-full" value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value))} type="number" step="0.1" />
        {suffix && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-warm-500">{suffix}</span>}
      </div>
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="mt-2 flex gap-2">
        <input className="h-12 w-16 rounded-control border border-warm-100 bg-paper" value={value} onChange={(event) => onChange(event.target.value)} type="color" />
        <input className="control numbers flex-1" value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </label>
  );
}

function SelectPlain({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Record<string, string> }) {
  return <select className="control w-full" value={value} onChange={(event) => onChange(event.target.value)}>{Object.entries(options).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Record<string, string> }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="mt-2"><SelectPlain value={value} onChange={onChange} options={options} /></div>
    </label>
  );
}

function DateField({ label, value, onChange, compact = false }: { label: string; value: string; onChange: (value: string) => void; compact?: boolean }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className={cn("control w-full", compact ? "mt-2" : "mt-2")} value={value} onChange={(event) => onChange(event.target.value)} type="date" />
      {value && <span className="mt-1 block text-xs text-warm-500">{formatPersianDate(value)}</span>}
    </label>
  );
}

function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="rounded-card border border-dashed border-warm-200 bg-warm-50 p-6 text-center">
      <Icon className="mx-auto text-sage" size={28} />
      <p className="mt-3 font-bold">{title}</p>
      <p className="mt-2 text-sm leading-7 text-warm-500">{text}</p>
    </div>
  );
}

function SkeletonRows() {
  return <div className="grid gap-3">{[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-card bg-warm-50" />)}</div>;
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-5 left-5 z-50 grid w-[min(420px,calc(100vw-40px))] gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} className={cn("rounded-control px-4 py-3 text-sm font-semibold shadow-soft", toast.kind === "error" ? "bg-red-50 text-red-700" : "bg-emerald/10 text-emerald")}>
          {toast.text}
        </div>
      ))}
    </div>
  );
}
