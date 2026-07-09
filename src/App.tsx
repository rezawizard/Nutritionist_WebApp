import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Archive,
  BadgeDollarSign,
  Calculator,
  Camera,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Database,
  Download,
  FileUp,
  FileText,
  FolderOpen,
  Home,
  Image as ImageIcon,
  KeyRound,
  Leaf,
  LogOut,
  Mail,
  Palette,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  activityLabels,
  bmiCategory,
  calculateNutrition,
  cn,
  defaultCalculationSettings,
  emptyClient,
  formatNumber,
  formatPersianDate,
  getErrorMessage,
  isoToJalaliInput,
  jalaliInputToIso,
  jalaliPartsFromIso,
  daysInJalaliMonth,
  genderLabels,
  goalLabels,
  isValidIsoDate,
  todayIsoDate,
  toPersianDigits,
} from "./lib";
import type { ActivityLevel, Attachment, Client, DashboardStats, Gender, Goal, Screen, ServiceCatalogItem, Settings, VisitDetail, VisitService } from "./types";
import type { ClientRecord } from "./types";

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
  name: "تم دایتوری",
  primary_color: "#0f5b46",
  background_color: "#10517A",
  text_color: "#f7f3ea",
};

type Toast = { id: number; text: string; kind?: "success" | "error" };
type ToastFn = (text: string, kind?: Toast["kind"]) => void;
type FieldErrors = Partial<Record<"full_name" | "age" | "height_cm" | "weight_kg" | "profile_image_path" | "visit_date" | "visit_time" | "next_visit_date" | "next_visit_time", string>>;
type ProfileTab = "summary" | "visits" | "files" | "services" | "base";
type ClientGoalFilter = "all" | Goal;
type CalcSettingKey = keyof typeof defaultCalculationSettings;

const clientGoalFilters: Record<ClientGoalFilter, string> = {
  all: "همه هدف‌ها",
  ...goalLabels,
};

const emptyDashboardStats: DashboardStats = {
  total_clients: 0,
  active_clients: 0,
  archived_clients: 0,
  goal_counts: { lose: 0, maintain: 0, gain: 0 },
  visits_today: 0,
  visits_next_7_days: 0,
  visits_this_month: 0,
  revenue_this_month: 0,
  upcoming_followups: 0,
  recent_clients: [],
  upcoming_visits: [],
  recent_visits: [],
};

const visitStatusLabels: Record<string, string> = {
  tentative: "پیشنهادی",
  confirmed: "تأیید شده",
  scheduled: "زمان‌بندی شده",
  done: "انجام شده",
  completed: "تکمیل شده",
  cancelled: "لغو شده",
  canceled: "لغو شده",
};

const goalKeys: Goal[] = ["lose", "maintain", "gain"];

const calculationSettingsFields: Array<{ key: CalcSettingKey; label: string; step?: number }> = [
  { key: "calc_ibw_bmi_factor", label: "ضریب BMI برای IBW", step: 0.1 },
  { key: "calc_abw_divisor", label: "مقسوم‌علیه ABW", step: 0.1 },
  { key: "calc_bmr_base", label: "ضریب پایه BMR", step: 0.1 },
  { key: "calc_male_factor", label: "ضریب جنسیت آقا", step: 0.01 },
  { key: "calc_female_factor", label: "ضریب جنسیت خانم", step: 0.01 },
  { key: "calc_bmr_adjustment", label: "ضریب اصلاح BMR", step: 0.01 },
  { key: "calc_activity_sedentary", label: "فعالیت کم‌تحرک", step: 0.01 },
  { key: "calc_activity_light", label: "فعالیت سبک", step: 0.01 },
  { key: "calc_activity_moderate", label: "فعالیت متوسط", step: 0.01 },
  { key: "calc_activity_active", label: "فعال", step: 0.01 },
  { key: "calc_activity_very_active", label: "بسیار فعال", step: 0.01 },
  { key: "calc_goal_loss", label: "هدف کاهش وزن", step: 10 },
  { key: "calc_goal_maintain", label: "هدف ثبات وزن", step: 10 },
  { key: "calc_goal_gain", label: "هدف افزایش وزن", step: 10 },
  { key: "macro_protein_percent", label: "درصد پروتئین", step: 1 },
  { key: "macro_carb_percent", label: "درصد کربوهیدرات", step: 1 },
  { key: "macro_fat_percent", label: "درصد چربی", step: 1 },
];

const calculationSettingGroups: Array<{ title: string; description: string; fields: Array<{ key: CalcSettingKey; label: string; step?: number }> }> = [
  {
    title: "وزن مرجع و انرژی پایه",
    description: "هسته محاسبه IBW، ABW و BMR. فقط در صورت تغییر پروتکل کلینیک اصلاح شود.",
    fields: calculationSettingsFields.slice(0, 6),
  },
  {
    title: "ضرایب فعالیت",
    description: "به‌صورت پیش‌فرض همه سطح‌ها روی ۱.۳ هستند تا محاسبات ساده و قابل کنترل بماند.",
    fields: calculationSettingsFields.slice(6, 11),
  },
  {
    title: "هدف کالری و ماکروها",
    description: "کسری/مازاد کالری و درصدهای ماکرو که در نتیجه نهایی دیده می‌شوند.",
    fields: calculationSettingsFields.slice(11),
  },
];

function metricDisplay(value?: number) {
  if (value === undefined) return { text: "", isZero: false };
  return { text: value === 0 ? "صفر" : formatNumber(value), isZero: value === 0 };
}

function currencyDisplay(value?: number) {
  if (value === undefined) return { text: "", isZero: false };
  const rounded = Math.round(value);
  return { text: rounded === 0 ? "بدون درآمد" : formatNumber(rounded), isZero: rounded === 0 };
}

function isDesktopRuntime() {
  return Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

function assetUrl(path?: string) {
  if (!path) return "";
  if (path.startsWith("data:") || path.startsWith("http") || path.startsWith("asset://")) return path;
  if (!isDesktopRuntime()) return path;
  return convertFileSrc(path);
}

function applyVisualSettings(settings: Settings) {
  document.documentElement.style.setProperty("--primary", settings.primary_color || defaultSettings.primary_color);
  document.documentElement.style.setProperty("--app-bg", settings.background_color || defaultSettings.background_color);
  document.documentElement.style.setProperty("--app-text", settings.text_color || defaultSettings.text_color);
}

function colorValue(value: string | undefined, fallback: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value ?? "") ? value! : fallback;
}

function backgroundStyle(settings: Settings): CSSProperties {
  const image = assetUrl(settings.background_image_path);
  if (!image) {
    return { color: "var(--app-text)", backgroundColor: "var(--app-bg)" };
  }
  return {
    color: "var(--app-text)",
    backgroundColor: "var(--app-bg)",
    backgroundImage: `linear-gradient(rgba(247, 243, 234, 0.78), rgba(247, 243, 234, 0.9)), url("${image}")`,
    backgroundPosition: "center",
    backgroundSize: "cover",
    backgroundAttachment: "fixed",
  };
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push: ToastFn = (text, kind = "success") => {
    const id = Date.now();
    setToasts((items) => [...items, { id, text, kind }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 2800);
  };
  return { toasts, push };
}

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [editing, setEditing] = useState<Client | null>(null);
  const [calculatorClient, setCalculatorClient] = useState<Client | null>(null);
  const [version, setVersion] = useState(0);
  const { toasts, push } = useToasts();

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    invoke<Settings>("get_settings")
      .then((next) => {
        const merged = { ...defaultSettings, ...next };
        setSettings(merged);
        applyVisualSettings(merged);
      })
      .catch((error) => push(getErrorMessage(error, "تنظیمات خوانده نشد."), "error"));
  }, []);

  const openClientForm = (client?: Client) => {
    setEditing(client ?? null);
    setScreen("client-form");
  };

  const openCalculator = (client?: Client) => {
    setCalculatorClient(client ?? null);
    setScreen("calculator");
  };

  if (!unlocked) {
    return <LoginScreen settings={settings} onLogin={() => setUnlocked(true)} toast={push} toasts={toasts} />;
  }

  return (
    <div className="app-shell min-h-screen bg-[var(--app-bg)]" dir="rtl" style={backgroundStyle(settings)}>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-72 border-l border-warm-100 bg-paper/90 px-5 py-6 lg:block">
          <Brand settings={settings} />
          <nav className="mt-9 grid gap-2">
            <NavItem active={screen === "dashboard"} icon={Home} label="داشبورد" onClick={() => setScreen("dashboard")} />
            <NavItem active={screen === "clients" || screen === "client-form"} icon={Users} label="مراجعین" onClick={() => setScreen("clients")} />
            <NavItem active={screen === "calculator"} icon={Calculator} label="محاسبات تغذیه" onClick={() => openCalculator()} />
            <NavItem active={screen === "settings"} icon={SettingsIcon} label="تنظیمات" onClick={() => setScreen("settings")} />
          </nav>
          <div className="absolute bottom-6 left-5 right-5">
            <NavItem active={false} icon={LogOut} label="خروج" onClick={() => setUnlocked(false)} />
          </div>
        </aside>

        <main className="w-full px-5 py-5 md:px-8 lg:px-10">
          <MobileNav screen={screen} setScreen={setScreen} openCalculator={() => openCalculator()} />
          {screen === "dashboard" && (
            <Dashboard
              version={version}
              settings={settings}
              onNew={() => openClientForm()}
              onCalculator={() => openCalculator()}
              onEdit={openClientForm}
            />
          )}
          {screen === "clients" && (
            <Clients
              version={version}
              onNew={() => openClientForm()}
              onEdit={openClientForm}
              onCalculate={openCalculator}
              onChanged={() => setVersion((value) => value + 1)}
              toast={push}
            />
          )}
          {screen === "client-form" && (
            <ClientProfileForm
              client={editing}
              onBack={() => setScreen("clients")}
              onSaved={(client) => {
                setEditing(client);
                setVersion((value) => value + 1);
              }}
              toast={push}
            />
          )}
          {screen === "calculator" && <CalculatorScreen initialClient={calculatorClient} settings={settings} toast={push} />}
          {screen === "settings" && (
            <SettingsScreen
              settings={settings}
              setSettings={(next) => {
                setSettings(next);
                applyVisualSettings(next);
              }}
              toast={push}
            />
          )}
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

function NavItem({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Home; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("soft-transition flex h-12 items-center gap-3 rounded-control px-4 text-sm font-semibold", active ? "bg-[var(--primary)] text-white shadow-lift" : "text-warm-500 hover:bg-warm-50 hover:text-charcoal")}>
      <Icon size={20} />
      {label}
    </button>
  );
}

function MobileNav({ screen, setScreen, openCalculator }: { screen: Screen; setScreen: (screen: Screen) => void; openCalculator: () => void }) {
  const item = "grid h-11 place-items-center rounded-control border border-warm-100 bg-paper text-warm-500";
  return (
    <div className="mb-5 grid grid-cols-4 gap-2 lg:hidden">
      <button className={cn(item, screen === "dashboard" && "bg-[var(--primary)] text-white")} onClick={() => setScreen("dashboard")} aria-label="داشبورد"><Home size={20} /></button>
      <button className={cn(item, (screen === "clients" || screen === "client-form") && "bg-[var(--primary)] text-white")} onClick={() => setScreen("clients")} aria-label="مراجعین"><Users size={20} /></button>
      <button className={cn(item, screen === "calculator" && "bg-[var(--primary)] text-white")} onClick={openCalculator} aria-label="محاسبات تغذیه"><Calculator size={20} /></button>
      <button className={cn(item, screen === "settings" && "bg-[var(--primary)] text-white")} onClick={() => setScreen("settings")} aria-label="تنظیمات"><SettingsIcon size={20} /></button>
    </div>
  );
}

function LoginScreen({ settings, onLogin, toast, toasts }: { settings: Settings; onLogin: () => void; toast: ToastFn; toasts: Toast[] }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (!isDesktopRuntime()) {
        if (username === "admin" && password === "admin") onLogin();
        else toast("نام کاربری یا رمز عبور درست نیست.", "error");
        return;
      }
      const ok = await invoke<boolean>("login", { input: { username, password } });
      ok ? onLogin() : toast("نام کاربری یا رمز عبور درست نیست.", "error");
    } catch (error) {
      toast(getErrorMessage(error, "ورود انجام نشد."), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell min-h-screen bg-[var(--app-bg)]" dir="rtl" style={backgroundStyle(settings)}>
      <main className="grid min-h-screen place-items-center px-5 py-8">
        <section className="login-card w-full max-w-[980px] overflow-hidden rounded-[28px] border border-warm-100 bg-paper shadow-soft md:grid md:grid-cols-[1fr_420px]">
          <div className="relative hidden min-h-[560px] overflow-hidden bg-[var(--primary)] p-9 text-white md:block">
            <div className="luxury-panel-line absolute left-0 top-14 h-px w-64" />
            <div className="luxury-panel-line absolute bottom-20 right-0 h-px w-72 opacity-60" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <BrandLogo settings={settings} className="h-14 w-14 rounded-card" />
                <h1 className="mt-8 text-4xl font-bold leading-[1.45]">Dietoy</h1>
                <p className="mt-4 max-w-sm text-sm leading-8 text-white/78">پرونده‌ها، محاسبات و پشتیبان‌گیری روی همین دستگاه می‌ماند؛ سریع، خصوصی و آماده کار روزانه.</p>
              </div>
              <div className="rounded-card border border-white/14 bg-white/10 p-5">
                <p className="text-sm font-semibold">ورود اولیه</p>
                <p className="numbers mt-3 text-2xl font-bold">admin / admin</p>
                <p className="mt-2 text-xs leading-6 text-white/70">بعد از ورود از تنظیمات رمز را تغییر دهید.</p>
              </div>
            </div>
          </div>
          <form onSubmit={submit} className="p-7 md:p-9">
            <p className="text-sm font-semibold text-olive">{settings.dietitian_name ? `${settings.dietitian_name} عزیز` : "ورود امن"}</p>
            <h2 className="mt-3 text-3xl font-extrabold text-charcoal">خوش آمدید</h2>
            <p className="mt-3 text-sm leading-7 text-warm-500">برای دسترسی به اطلاعات مراجعین وارد شوید. اطلاعات روی همین دستگاه ذخیره می‌شود.</p>
            <div className="mt-8 grid gap-5">
              <IconInput icon={UserRound} label="نام کاربری" value={username} onChange={setUsername} autoComplete="username" />
              <IconInput icon={KeyRound} label="رمز عبور" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
            </div>
            <div className="mt-8"><PrimaryButton icon={KeyRound} type="submit">{loading ? "در حال ورود..." : "ورود به برنامه"}</PrimaryButton></div>
          </form>
        </section>
      </main>
      <ToastStack toasts={toasts} />
    </div>
  );
}

function Dashboard({ version, settings, onNew, onCalculator, onEdit }: { version: number; settings: Settings; onNew: () => void; onCalculator: () => void; onEdit: (client: Client) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  useEffect(() => {
    if (!isDesktopRuntime()) {
      setStats(emptyDashboardStats);
      return;
    }
    setStats(null);
    invoke<DashboardStats>("dashboard_stats").then(setStats).catch(() => setStats(emptyDashboardStats));
  }, [version]);

  const goalTotal = goalKeys.reduce((sum, goal) => sum + (stats?.goal_counts[goal] ?? 0), 0);
  const maxGoalCount = Math.max(1, ...goalKeys.map((goal) => stats?.goal_counts[goal] ?? 0));
  const dashboardIsEmpty = Boolean(stats && stats.total_clients === 0 && stats.visits_this_month === 0 && stats.revenue_this_month === 0);

  return (
    <>
      <PageHeader
        title={settings.dietitian_name ? `سلام، ${settings.dietitian_name}` : "روز آرامی برای مراقبت بهتر"}
        subtitle={`امروز ${formatPersianDate()} است. پرونده مراجعین، پیگیری‌ها و گزارش‌های کاری شما روی همین دستگاه ذخیره می‌شود.`}
        action={<PrimaryButton icon={Plus} onClick={onNew}>مراجع جدید</PrimaryButton>}
      />

      {dashboardIsEmpty && (
        <section className="mb-5 rounded-[28px] border border-white/30 bg-white/95 p-5 shadow-soft backdrop-blur md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-card bg-emerald/10 text-[var(--primary)]"><CheckCircle2 size={24} /></div>
              <div>
                <p className="text-sm font-bold text-olive">شروع تمیز</p>
                <h2 className="mt-1 text-xl font-bold">هنوز داده‌ای ثبت نشده؛ اپ آماده ساخت اولین پرونده است.</h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-warm-500">از «ثبت مراجع» شروع کنید. بعد از اولین ویزیت، داشبورد به‌صورت خودکار پیگیری‌ها، درآمد خدمات و روند کار را نشان می‌دهد.</p>
              </div>
            </div>
            <PrimaryButton icon={Plus} onClick={onNew}>اولین مراجع را ثبت کنید</PrimaryButton>
          </div>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card relative overflow-hidden p-6 md:p-8">
          <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-emerald/5" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-olive">اقدام سریع</p>
              <h2 className="mt-3 text-2xl font-bold">شروع ویزیت بدون شلوغی</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-warm-500">سه کار پرتکرار همین‌جاست: ثبت پرونده، محاسبه سریع و بررسی پیگیری‌ها. بدون رفت‌وبرگشت اضافی.</p>
            </div>
            <Sparkles className="text-sage" size={28} />
          </div>
          <div className="relative mt-8 grid gap-3 sm:grid-cols-2">
            <PrimaryButton icon={Plus} onClick={onNew}>ثبت مراجع</PrimaryButton>
            <SecondaryButton icon={Calculator} onClick={onCalculator}>محاسبات تغذیه</SecondaryButton>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Stat label="همه مراجعین" value={stats?.total_clients} icon={Users} hint="پرونده ثبت‌شده" />
          <Stat label="فعال" value={stats?.active_clients} icon={Leaf} hint="مراجع در جریان" />
          <Stat label="ویزیت امروز" value={stats?.visits_today} icon={CalendarCheck} hint="قرار امروز" />
          <Stat label="پیگیری آینده" value={stats?.upcoming_followups} icon={Clock3} hint="نیازمند پیگیری" />
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-4">
        <Stat label="ویزیت ۷ روز آینده" value={stats?.visits_next_7_days} icon={CalendarDays} hint="برنامه نزدیک" />
        <Stat label="ویزیت این ماه" value={stats?.visits_this_month} icon={ClipboardList} hint="فعالیت ماه" />
        <Stat label="مراجع بایگانی" value={stats?.archived_clients} icon={Archive} hint="خارج از جریان" />
        <RevenueStat value={stats?.revenue_this_month} />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="card p-6">
          <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">ترکیب هدف مراجعین فعال</h2><Target className="text-sage" size={22} /></div>
          {!stats ? <SkeletonRows /> : goalTotal === 0 ? <EmptyState icon={Target} title="هنوز داده‌ای برای هدف‌ها نیست" text="بعد از ثبت مراجع، ترکیب کاهش، ثبات و افزایش وزن اینجا دیده می‌شود." /> : (
            <div className="grid gap-4">
              {goalKeys.map((goal) => {
                const count = stats.goal_counts[goal] ?? 0;
                const percent = goalTotal ? Math.round((count / goalTotal) * 100) : 0;
                const width = Math.max(8, Math.round((count / maxGoalCount) * 100));
                return (
                  <div key={goal}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-semibold">{goalLabels[goal]}</span>
                      <span className="numbers text-warm-500">{formatNumber(count)} نفر · {toPersianDigits(percent)}٪</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-warm-100">
                      <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">ویزیت‌های پیش‌رو</h2><CalendarDays className="text-sage" size={22} /></div>
          {!stats ? <SkeletonRows /> : stats.upcoming_visits.length === 0 ? <EmptyState icon={CalendarDays} title="ویزیت آینده‌ای ثبت نشده" text="وقتی برای مراجعین ویزیت یا پیگیری آینده ثبت شود، اینجا نمایش داده می‌شود." /> : (
            <div className="grid gap-3">
              {stats.upcoming_visits.map((visit) => <DashboardVisitRow key={`${visit.id}-${visit.visit_date}`} visit={visit} />)}
            </div>
          )}
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="card p-6">
          <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">مراجعین اخیر</h2><Users className="text-sage" size={22} /></div>
          {!stats ? <SkeletonRows /> : stats.recent_clients.length === 0 ? <EmptyState icon={Users} title="هنوز مراجعی ثبت نشده" text="اولین پرونده را بسازید تا این بخش زنده شود." /> : <div className="grid gap-3">{stats.recent_clients.map((client) => <ClientRow key={client.id} client={client} onEdit={() => onEdit(client)} />)}</div>}
        </div>

        <div className="card p-6">
          <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">آخرین ویزیت‌ها</h2><TrendingUp className="text-sage" size={22} /></div>
          {!stats ? <SkeletonRows /> : stats.recent_visits.length === 0 ? <EmptyState icon={ClipboardList} title="هنوز ویزیتی ثبت نشده" text="بعد از ثبت اولین ویزیت، تاریخچه سریع اینجا دیده می‌شود." /> : (
            <div className="grid gap-3">
              {stats.recent_visits.map((visit) => <DashboardVisitRow key={`${visit.id}-${visit.visit_date}-recent`} visit={visit} />)}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function DashboardVisitRow({ visit }: { visit: DashboardStats["upcoming_visits"][number] }) {
  return (
    <div className="rounded-card border border-warm-100 bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-bold">{visit.client_name}</p>
          <p className="mt-2 text-xs leading-6 text-warm-500">{formatPersianDate(visit.visit_date)}{visit.visit_time ? ` · ${visit.visit_time}` : ""} · {visitStatusLabels[visit.status] ?? visit.status}</p>
        </div>
        <div className="numbers rounded-control bg-warm-50 px-3 py-2 text-sm font-semibold text-charcoal">
          {formatNumber(Math.round(visit.total_fee))} تومان
        </div>
      </div>
    </div>
  );
}


function Clients({ version, onNew, onEdit, onCalculate, onChanged, toast }: { version: number; onNew: () => void; onEdit: (client: Client) => void; onCalculate: (client: Client) => void; onChanged: () => void; toast: ToastFn }) {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [goalFilter, setGoalFilter] = useState<ClientGoalFilter>("all");

  useEffect(() => {
    if (!isDesktopRuntime()) {
      setClients([]);
      return;
    }
    setClients(null);
    invoke<Client[]>("list_clients", { includeArchived })
      .then(setClients)
      .catch((error) => {
        setClients([]);
        toast(getErrorMessage(error, "فهرست مراجعین خوانده نشد."), "error");
      });
  }, [version, includeArchived, toast]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (clients ?? []).filter((client) => {
      const goalMatches = goalFilter === "all" || client.goal === goalFilter;
      const queryMatches = !needle || [client.full_name, client.phone, client.email, goalLabels[client.goal]]
        .some((value) => String(value ?? "").toLowerCase().includes(needle));
      return goalMatches && queryMatches;
    });
  }, [clients, query, goalFilter]);

  const visibleCount = filtered.length;
  const totalCount = clients?.length ?? 0;

  const archive = async (client: Client) => {
    try {
      await invoke("archive_client", { id: client.id, archived: !client.archived });
      toast(client.archived ? "مراجع فعال شد." : "مراجع بایگانی شد.");
      onChanged();
    } catch (error) {
      toast(getErrorMessage(error, "تغییر وضعیت بایگانی انجام نشد."), "error");
    }
  };

  return (
    <>
      <PageHeader title="مراجعین" subtitle="جست‌وجو، فیلتر براساس هدف، و مدیریت پرونده‌ها با کمترین کلیک." action={<PrimaryButton icon={Plus} onClick={onNew}>مراجع جدید</PrimaryButton>} />
      <section className="card p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-warm-500" size={20} />
            <input className="control w-full pr-12" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی نام، موبایل، ایمیل یا هدف" />
          </div>
          <label className="flex h-12 items-center gap-2 rounded-control border border-warm-100 bg-warm-50 px-4 text-sm text-warm-500">
            <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
            نمایش بایگانی
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {Object.entries(clientGoalFilters).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setGoalFilter(key as ClientGoalFilter)}
              className={cn("filter-chip", goalFilter === key && "filter-chip-active")}
            >
              {label}
            </button>
          ))}
          <span className="numbers mr-auto text-xs text-warm-500">{clients ? `${toPersianDigits(visibleCount)} از ${toPersianDigits(totalCount)}` : "در حال خواندن"}</span>
        </div>
        <div className="mt-5 grid gap-3">
          {!clients ? <SkeletonRows /> : filtered.length === 0 ? <EmptyState icon={Search} title="موردی پیدا نشد" text={query || goalFilter !== "all" ? "فیلتر هدف یا عبارت جست‌وجو را تغییر دهید." : "اولین پرونده را ثبت کنید."} /> : filtered.map((client) => (
            <ClientRow key={client.id} client={client} onEdit={() => onEdit(client)} onCalculate={() => onCalculate(client)} onArchive={() => archive(client)} />
          ))}
        </div>
      </section>
    </>
  );
}

function ClientProfileForm({ client, onBack, onSaved, toast }: { client: Client | null; onBack: () => void; onSaved: (client: Client) => void; toast: ToastFn }) {
  const [form, setForm] = useState<Client>(client ?? { ...emptyClient });
  const [records, setRecords] = useState<ClientRecord[]>([]);
  const [visits, setVisits] = useState<VisitDetail[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [serviceCatalog, setServiceCatalog] = useState<ServiceCatalogItem[]>([]);
  const [visitServices, setVisitServices] = useState<Record<number, VisitService[]>>({});
  const [activeTab, setActiveTab] = useState<ProfileTab>(client ? "summary" : "base");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [topError, setTopError] = useState("");
  const [catalogForm, setCatalogForm] = useState({ name: "", default_price: 0, default_duration_minutes: "" });
  const [serviceForm, setServiceForm] = useState({ visitId: "", catalogId: "", quantity: 1, price: 0, body_area: "", notes: "" });
  const [visitForm, setVisitForm] = useState({
    visit_date: todayIsoDate(),
    visit_time: "",
    status: "completed",
    reason: "",
    weight_kg: client?.weight_kg ?? emptyClient.weight_kg,
    height_cm: client?.height_cm ?? emptyClient.height_cm,
    notes: "",
    next_visit_enabled: false,
    next_visit_date: "",
    next_visit_time: "",
    next_visit_status: "scheduled",
  });

  const resetVisitForm = (source?: Client) => {
    setVisitForm({
      visit_date: todayIsoDate(),
      visit_time: "",
      status: "completed",
      reason: "",
      weight_kg: source?.weight_kg ?? emptyClient.weight_kg,
      height_cm: source?.height_cm ?? emptyClient.height_cm,
      notes: "",
      next_visit_enabled: false,
      next_visit_date: "",
      next_visit_time: "",
      next_visit_status: "scheduled",
    });
  };

  useEffect(() => {
    setForm(client ?? { ...emptyClient });
    setActiveTab(client ? "summary" : "base");
    setErrors({});
    setTopError("");
    resetVisitForm(client ?? undefined);
  }, [client]);

  useEffect(() => {
    if (!client?.id || !isDesktopRuntime()) {
      setRecords([]);
      setVisits([]);
      setAttachments([]);
      setServiceCatalog([]);
      setVisitServices({});
      return;
    }
    invoke<VisitDetail[]>("list_client_visits", { clientId: client.id })
      .then((items) => {
        setVisits(items);
        const latestItem = items[items.length - 1];
        setServiceForm((current) => ({ ...current, visitId: current.visitId || String(latestItem?.visit.id ?? "") }));
        setRecords(
          items
            .filter((item) => item.measurements?.weight_kg)
            .map((item) => ({
              id: item.measurements?.id,
              client_id: client.id!,
              record_date: item.visit.visit_date,
              weight_kg: item.measurements?.weight_kg ?? client.weight_kg,
              height_cm: item.measurements?.height_cm ?? client.height_cm,
              notes: item.measurements?.notes || item.visit.clinical_notes,
              created_at: item.visit.created_at,
              updated_at: item.visit.updated_at,
            })),
        );
        return Promise.all(
          items
            .map((item) => item.visit.id)
            .filter((id): id is number => typeof id === "number")
            .map((visitId) => invoke<VisitService[]>("list_visit_services", { visitId }).then((services) => [visitId, services] as const)),
        );
      })
      .then((serviceEntries) => {
        if (!serviceEntries) return;
        setVisitServices(Object.fromEntries(serviceEntries));
      })
      .catch(() => {
        invoke<ClientRecord[]>("list_client_records", { clientId: client.id }).then(setRecords).catch(() => setRecords([]));
      });
    invoke<Attachment[]>("list_client_attachments", { clientId: client.id }).then(setAttachments).catch(() => setAttachments([]));
    invoke<ServiceCatalogItem[]>("list_service_catalog", { activeOnly: true }).then((items) => {
      setServiceCatalog(items);
      setServiceForm((current) => {
        if (current.catalogId || !items[0]) return current;
        return { ...current, catalogId: String(items[0].id ?? ""), price: items[0].default_price ?? 0 };
      });
    }).catch(() => setServiceCatalog([]));
  }, [client]);

  const setField = <K extends keyof Client>(key: K, value: Client[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validateClient = () => {
    const nextErrors: FieldErrors = {};
    if (!form.full_name.trim()) nextErrors.full_name = "نام کامل مراجعه‌کننده الزامی است.";
    if (!Number.isFinite(form.age) || form.age < 1 || form.age > 120) nextErrors.age = "سن باید عددی بین ۱ تا ۱۲۰ باشد.";
    if (!Number.isFinite(form.height_cm) || form.height_cm < 40 || form.height_cm > 250) nextErrors.height_cm = "قد باید عددی بین ۴۰ تا ۲۵۰ سانتی‌متر باشد.";
    if (!Number.isFinite(form.weight_kg) || form.weight_kg < 1 || form.weight_kg > 400) nextErrors.weight_kg = "وزن باید عددی بین ۱ تا ۴۰۰ کیلوگرم باشد.";
    if (/[\r\n]/.test(form.profile_image_path)) nextErrors.profile_image_path = "مسیر عکس پروفایل معتبر نیست.";
    setErrors(nextErrors);
    return nextErrors;
  };

  const validateVisit = () => {
    const nextErrors: FieldErrors = {};
    if (!isValidIsoDate(visitForm.visit_date)) nextErrors.visit_date = "تاریخ ویزیت باید با قالب yyyy/mm/dd وارد شود.";
    if (visitForm.visit_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(visitForm.visit_time)) nextErrors.visit_time = "ساعت ویزیت باید با قالب HH:mm باشد.";
    if (!Number.isFinite(visitForm.weight_kg) || visitForm.weight_kg < 1 || visitForm.weight_kg > 400) nextErrors.weight_kg = "وزن ویزیت باید عددی بین ۱ تا ۴۰۰ کیلوگرم باشد.";
    if (!Number.isFinite(visitForm.height_cm) || visitForm.height_cm < 40 || visitForm.height_cm > 250) nextErrors.height_cm = "قد ویزیت باید عددی بین ۴۰ تا ۲۵۰ سانتی‌متر باشد.";
    if (visitForm.next_visit_enabled && !isValidIsoDate(visitForm.next_visit_date)) nextErrors.next_visit_date = "برای مراجعه بعدی، تاریخ معتبر وارد کنید.";
    if (visitForm.next_visit_enabled && visitForm.next_visit_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(visitForm.next_visit_time)) nextErrors.next_visit_time = "ساعت بعدی باید با قالب HH:mm باشد.";
    setErrors(nextErrors);
    return nextErrors;
  };

  const chooseProfileImage = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"] }],
      });
      if (!selected || Array.isArray(selected)) return;
      const imported = isDesktopRuntime()
        ? await invoke<string>("import_brand_asset", { path: selected, kind: "client-profile" })
        : selected;
      setField("profile_image_path", imported);
      toast("عکس پروفایل انتخاب شد.");
    } catch (error) {
      const message = getErrorMessage(error, "انتخاب عکس انجام نشد.");
      setTopError(message);
      toast(message, "error");
    }
  };

  const save = async () => {
    const nextErrors = validateClient();
    if (Object.keys(nextErrors).length) {
      setTopError("پرونده ذخیره نشد؛ خطاهای مشخص‌شده را اصلاح کنید.");
      toast("پرونده ذخیره نشد؛ خطاهای فرم را بررسی کنید.", "error");
      return;
    }
    try {
      const saved = isDesktopRuntime() ? await invoke<Client>("save_client", { client: form }) : form;
      if (!client && saved.id && isDesktopRuntime()) {
        await invoke<VisitDetail>("save_visit_with_measurements", {
          visit: {
            client_id: saved.id,
            visit_date: todayIsoDate(),
            visit_time: "",
            status: "completed",
            reason: "ثبت اولیه مراجعه",
            clinical_notes: "ثبت اولیه مراجعه",
            private_notes: "",
            next_visit_enabled: false,
            next_visit_date: "",
            next_visit_time: "",
            next_visit_status: "",
            total_fee: 0,
          },
          measurements: {
            weight_kg: saved.weight_kg,
            height_cm: saved.height_cm,
            notes: "ثبت اولیه مراجعه",
          },
        });
      }
      setTopError("");
      onSaved(saved);
      toast(client ? "پرونده ذخیره شد." : "مراجعه‌کننده جدید ثبت شد.");
    } catch (error) {
      const message = getErrorMessage(error, "ذخیره انجام نشد؛ علت نامشخص است.");
      setTopError(message);
      toast(message, "error");
    }
  };

  const saveVisit = async () => {
    if (!client?.id) {
      setTopError("اول پرونده مراجعه‌کننده را ذخیره کنید، سپس ویزیت ثبت کنید.");
      toast("اول پرونده مراجعه‌کننده را ذخیره کنید.", "error");
      return;
    }
    const nextErrors = validateVisit();
    if (Object.keys(nextErrors).length) {
      setTopError("ویزیت ثبت نشد؛ خطاهای مشخص‌شده را اصلاح کنید.");
      toast("ویزیت ثبت نشد؛ خطاهای فرم را بررسی کنید.", "error");
      return;
    }
    try {
      const detail = await invoke<VisitDetail>("save_visit_with_measurements", {
        visit: {
          client_id: client.id,
          visit_date: visitForm.visit_date,
          visit_time: visitForm.visit_time,
          status: visitForm.status,
          reason: visitForm.reason,
          clinical_notes: visitForm.notes,
          private_notes: "",
          next_visit_enabled: visitForm.next_visit_enabled,
          next_visit_date: visitForm.next_visit_enabled ? visitForm.next_visit_date : "",
          next_visit_time: visitForm.next_visit_enabled ? visitForm.next_visit_time : "",
          next_visit_status: visitForm.next_visit_enabled ? visitForm.next_visit_status : "",
          total_fee: 0,
        },
        measurements: {
          weight_kg: visitForm.weight_kg,
          height_cm: visitForm.height_cm,
          notes: visitForm.notes,
        },
      });
      const record = {
        id: detail.measurements?.id,
        client_id: client.id,
        record_date: detail.visit.visit_date,
        weight_kg: detail.measurements?.weight_kg ?? visitForm.weight_kg,
        height_cm: detail.measurements?.height_cm ?? visitForm.height_cm,
        notes: detail.measurements?.notes ?? visitForm.notes,
        created_at: detail.visit.created_at,
        updated_at: detail.visit.updated_at,
      };
      setVisits((items) => [...items, detail].sort((a, b) => a.visit.visit_date.localeCompare(b.visit.visit_date)));
      setRecords((items) => [...items, record].sort((a, b) => a.record_date.localeCompare(b.record_date)));
      if (detail.visit.id) setServiceForm((current) => ({ ...current, visitId: String(detail.visit.id) }));
      const updatedClient = { ...form, weight_kg: record.weight_kg, height_cm: record.height_cm };
      setForm(updatedClient);
      await invoke<Client>("save_client", { client: updatedClient });
      resetVisitForm(updatedClient);
      setTopError("");
      toast("ویزیت ثبت شد.");
    } catch (error) {
      const message = getErrorMessage(error, "ثبت ویزیت انجام نشد؛ علت نامشخص است.");
      setTopError(message);
      toast(message, "error");
    }
  };

  const chooseAttachment = async () => {
    if (!client?.id) return;
    try {
      const selected = await open({ multiple: false });
      if (!selected || Array.isArray(selected)) return;
      const parsedVisitId = Number(serviceForm.visitId);
      const visitId = serviceForm.visitId && Number.isFinite(parsedVisitId) ? parsedVisitId : null;
      const attachment = await invoke<Attachment>("import_attachment", {
        clientId: client.id,
        visitId,
        path: selected,
        category: "other",
        title: "",
        attachmentDate: todayIsoDate(),
        notes: "",
      });
      setAttachments((items) => [attachment, ...items]);
      toast("فایل به پرونده اضافه شد.");
    } catch (error) {
      const message = getErrorMessage(error, "افزودن فایل انجام نشد.");
      setTopError(message);
      toast(message, "error");
    }
  };

  const openClientFolder = async () => {
    if (!client?.id) return;
    try {
      await invoke("open_client_folder", { clientId: client.id });
    } catch (error) {
      toast(getErrorMessage(error, "پوشه پرونده باز نشد."), "error");
    }
  };

  const exportClientReport = async () => {
    if (!client?.id) {
      toast("اول پرونده مراجعه‌کننده را ذخیره کنید.", "error");
      return;
    }
    try {
      const path = await invoke<string>("export_client_report", { clientId: client.id });
      toast(`پرونده چاپی ساخته و باز شد: ${path}`);
    } catch (error) {
      const message = getErrorMessage(error, "ساخت پرونده چاپ/PDF انجام نشد.");
      setTopError(message);
      toast(message, "error");
    }
  };

  const openAttachment = async (attachment: Attachment) => {
    if (!attachment.id) return;
    try {
      await invoke("open_attachment", { attachmentId: attachment.id });
    } catch (error) {
      toast(getErrorMessage(error, "فایل باز نشد."), "error");
    }
  };

  const saveCatalogItem = async () => {
    if (!catalogForm.name.trim()) {
      toast("نام خدمت را وارد کنید.", "error");
      return;
    }
    try {
      const saved = await invoke<ServiceCatalogItem>("save_service_catalog_item", {
        item: {
          name: catalogForm.name.trim(),
          default_price: catalogForm.default_price,
          default_duration_minutes: catalogForm.default_duration_minutes ? Number(catalogForm.default_duration_minutes) : null,
          body_area_required: false,
          active: true,
        },
      });
      setServiceCatalog((items) => [...items, saved]);
      setServiceForm((current) => ({ ...current, catalogId: String(saved.id ?? ""), price: saved.default_price ?? 0 }));
      setCatalogForm({ name: "", default_price: 0, default_duration_minutes: "" });
      toast("خدمت ذخیره شد.");
    } catch (error) {
      toast(getErrorMessage(error, "ذخیره خدمت انجام نشد."), "error");
    }
  };

  const selectCatalogItem = (catalogId: string) => {
    const item = serviceCatalog.find((entry) => String(entry.id ?? "") === catalogId);
    setServiceForm((current) => ({ ...current, catalogId, price: item?.default_price ?? current.price }));
  };

  const saveVisitService = async () => {
    const visitId = Number(serviceForm.visitId);
    const catalogItem = serviceCatalog.find((entry) => String(entry.id ?? "") === serviceForm.catalogId);
    if (!Number.isFinite(visitId) || !catalogItem) {
      toast("ویزیت و خدمت را انتخاب کنید.", "error");
      return;
    }
    try {
      const quantity = Number.isFinite(serviceForm.quantity) && serviceForm.quantity > 0 ? serviceForm.quantity : 1;
      const price = Number.isFinite(serviceForm.price) ? serviceForm.price : 0;
      const saved = await invoke<VisitService>("save_visit_service", {
        service: {
          visit_id: visitId,
          service_id: catalogItem.id ?? null,
          service_name_snapshot: catalogItem.name,
          body_area: serviceForm.body_area,
          device_name: "",
          duration_minutes: catalogItem.default_duration_minutes ?? null,
          price,
          quantity,
          total: price * quantity,
          notes: serviceForm.notes,
        },
      });
      setVisitServices((current) => ({ ...current, [visitId]: [...(current[visitId] ?? []), saved] }));
      setServiceForm((current) => ({ ...current, body_area: "", notes: "" }));
      toast("خدمت برای ویزیت ثبت شد.");
    } catch (error) {
      toast(getErrorMessage(error, "ثبت خدمت انجام نشد."), "error");
    }
  };

  const latestRecord = records.length ? records[records.length - 1] : undefined;
  const previousRecord = records.length > 1 ? records[records.length - 2] : undefined;
  const weightDelta = latestRecord && previousRecord ? latestRecord.weight_kg - previousRecord.weight_kg : null;
  const latestVisit = visits.length ? visits[visits.length - 1] : undefined;
  const latestBmi = latestRecord ? latestRecord.weight_kg / Math.pow(latestRecord.height_cm / 100, 2) : null;

  const baseInfo = (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="md:col-span-2 flex flex-col gap-4 rounded-card border border-warm-100 bg-warm-50 p-4 sm:flex-row sm:items-center">
        <ProfileAvatar client={form} size="lg" />
        <div className="flex-1">
          <p className="text-sm font-bold">عکس پروفایل مراجعه‌کننده</p>
          <p className="helper mt-1">برای شناسایی سریع‌تر در پرونده و لیست مراجعه‌کنندگان.</p>
          {errors.profile_image_path && <FieldError text={errors.profile_image_path} />}
        </div>
        <SecondaryButton icon={Camera} onClick={chooseProfileImage}>انتخاب عکس</SecondaryButton>
      </div>
      <TextField label="نام کامل" value={form.full_name} onChange={(value) => setField("full_name", value)} error={errors.full_name} />
      <TextField label="شماره تماس" value={form.phone} onChange={(value) => setField("phone", value)} placeholder="مثلا 09123456789" />
      <TextField label="ایمیل" value={form.email} onChange={(value) => setField("email", value)} placeholder="name@example.com" />
      <SelectField label="جنسیت" value={form.gender} onChange={(value) => setField("gender", value as Gender)} options={genderLabels} />
      <NumberField label="سن" value={form.age} onChange={(value) => setField("age", value)} suffix="سال" error={errors.age} />
      <NumberField label="قد" value={form.height_cm} onChange={(value) => setField("height_cm", value)} suffix="سانتی‌متر" error={errors.height_cm} />
      <NumberField label="وزن" value={form.weight_kg} onChange={(value) => setField("weight_kg", value)} suffix="کیلوگرم" error={errors.weight_kg} />
      <SelectField label="سطح فعالیت" value={form.activity_level} onChange={(value) => setField("activity_level", value as ActivityLevel)} options={activityLabels} />
      <SelectField label="هدف" value={form.goal} onChange={(value) => setField("goal", value as Goal)} options={goalLabels} />
      <div className="md:col-span-2">
        <label className="label">یادداشت پرونده</label>
        <textarea className="control mt-2 min-h-32 w-full py-3" value={form.notes} onChange={(event) => setField("notes", event.target.value)} />
      </div>
    </div>
  );

  const visitsPanel = client?.id ? (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-card border border-warm-100 bg-warm-50 p-5">
        <div className="flex items-center gap-2">
          <ClipboardList size={21} className="text-sage" />
          <h2 className="text-lg font-bold">ثبت ویزیت</h2>
        </div>
        <p className="helper mt-2">هر ویزیت می‌تواند اندازه‌گیری، یادداشت و مراجعه بعدی اختیاری داشته باشد.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <DateField label="تاریخ ویزیت" value={visitForm.visit_date} onChange={(value) => { setVisitForm({ ...visitForm, visit_date: value }); setErrors((current) => ({ ...current, visit_date: undefined })); }} error={errors.visit_date} />
          <TimeField label="ساعت" value={visitForm.visit_time} onChange={(value) => { setVisitForm({ ...visitForm, visit_time: value }); setErrors((current) => ({ ...current, visit_time: undefined })); }} error={errors.visit_time} />
          <SelectField label="وضعیت" value={visitForm.status} onChange={(value) => setVisitForm({ ...visitForm, status: value })} options={{ completed: "انجام شد", scheduled: "برنامه‌ریزی شده", canceled: "لغو شد" }} />
          <TextField label="دلیل مراجعه" value={visitForm.reason} onChange={(value) => setVisitForm({ ...visitForm, reason: value })} />
          <NumberField label="وزن" value={visitForm.weight_kg} onChange={(value) => setVisitForm({ ...visitForm, weight_kg: value })} suffix="کیلوگرم" error={errors.weight_kg} />
          <NumberField label="قد" value={visitForm.height_cm} onChange={(value) => setVisitForm({ ...visitForm, height_cm: value })} suffix="سانتی‌متر" error={errors.height_cm} />
          <div className="sm:col-span-2 rounded-control border border-warm-100 bg-white p-4">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={visitForm.next_visit_enabled} onChange={(event) => setVisitForm({ ...visitForm, next_visit_enabled: event.target.checked, next_visit_date: event.target.checked ? visitForm.next_visit_date || todayIsoDate() : "" })} />
              مراجعه بعدی دارد؟
            </label>
            {visitForm.next_visit_enabled && (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <DateField label="تاریخ بعدی" value={visitForm.next_visit_date || todayIsoDate()} onChange={(value) => { setVisitForm({ ...visitForm, next_visit_date: value }); setErrors((current) => ({ ...current, next_visit_date: undefined })); }} error={errors.next_visit_date} />
                <TimeField label="ساعت" value={visitForm.next_visit_time} onChange={(value) => { setVisitForm({ ...visitForm, next_visit_time: value }); setErrors((current) => ({ ...current, next_visit_time: undefined })); }} error={errors.next_visit_time} />
                <SelectField label="وضعیت" value={visitForm.next_visit_status} onChange={(value) => setVisitForm({ ...visitForm, next_visit_status: value })} options={{ scheduled: "برنامه‌ریزی شده", pending: "در انتظار", done: "انجام شد" }} />
              </div>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="label">یادداشت ویزیت</label>
            <textarea className="control mt-2 min-h-24 w-full py-3" value={visitForm.notes} onChange={(event) => setVisitForm({ ...visitForm, notes: event.target.value })} />
          </div>
        </div>
        <div className="mt-5"><SecondaryButton icon={Plus} onClick={saveVisit}>ثبت ویزیت</SecondaryButton></div>
      </div>
      <div className="rounded-card border border-warm-100 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><CalendarDays size={21} className="text-sage" /><h2 className="text-lg font-bold">ویزیت‌ها</h2></div>
          <span className="text-xs text-warm-500">{formatNumber(visits.length || records.length)} ویزیت</span>
        </div>
        {records.length === 0 ? <EmptyState icon={CalendarDays} title="هنوز ویزیتی ثبت نشده" text="اولین ویزیت را از فرم کنار صفحه ثبت کنید." /> : (
          <>
            <WeightHistory records={records} />
            <div className="mt-5 grid gap-3">
              {visits.slice().reverse().map((item) => {
                const services = item.visit.id ? visitServices[item.visit.id] ?? [] : [];
                return (
                  <div key={item.visit.id ?? item.visit.visit_date} className="rounded-control border border-warm-100 bg-warm-50 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{formatPersianDate(item.visit.visit_date)}</span>
                      <span className="numbers text-xs text-olive">{formatNumber(services.length)} خدمت</span>
                    </div>
                    {services.length > 0 && (
                      <div className="mt-3 grid gap-2">
                        {services.map((service) => (
                          <div key={service.id ?? `${service.service_name_snapshot}-${service.total}`} className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-white px-3 py-2 text-xs">
                            <span className="font-semibold">{service.service_name_snapshot}{service.body_area ? ` - ${service.body_area}` : ""}</span>
                            <span className="numbers text-warm-500">{formatNumber(service.total)} تومان</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  ) : null;

  const filesPanel = client?.id ? (
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <div className="rounded-card border border-warm-100 bg-warm-50 p-5">
        <div className="flex items-center gap-2">
          <FileUp size={21} className="text-sage" />
          <h2 className="text-lg font-bold">فایل‌ها</h2>
        </div>
        <p className="helper mt-2">فایل‌های آزمایش، آنالیز بدن یا گزارش‌ها را به پرونده مراجع وصل کنید.</p>
        <div className="mt-5 grid gap-3">
          <SelectField
            label="اتصال به ویزیت"
            value={serviceForm.visitId}
            onChange={(value) => setServiceForm({ ...serviceForm, visitId: value })}
            options={{ "": "بدون ویزیت", ...Object.fromEntries(visits.map((item) => [String(item.visit.id ?? ""), formatPersianDate(item.visit.visit_date)])) }}
          />
          <SecondaryButton icon={FileUp} onClick={chooseAttachment}>افزودن فایل</SecondaryButton>
          <SecondaryButton icon={FolderOpen} onClick={openClientFolder}>باز کردن پوشه پرونده</SecondaryButton>
          <SecondaryButton icon={FileText} onClick={exportClientReport}>ساخت پرونده چاپ/PDF</SecondaryButton>
        </div>
      </div>
      <div className="rounded-card border border-warm-100 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">فایل‌های پرونده</h2>
          <span className="numbers text-xs text-warm-500">{formatNumber(attachments.length)} فایل</span>
        </div>
        {attachments.length === 0 ? <EmptyState icon={FileUp} title="فایلی ثبت نشده" text="از دکمه افزودن فایل استفاده کنید." /> : (
          <div className="grid gap-3">
            {attachments.map((attachment) => (
              <button key={attachment.id ?? attachment.local_path} type="button" onClick={() => openAttachment(attachment)} className="soft-transition rounded-control border border-warm-100 bg-warm-50 px-4 py-3 text-right hover:bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{attachment.title || attachment.file_name}</span>
                  <span className="text-xs text-olive">{attachment.attachment_date ? formatPersianDate(attachment.attachment_date) : ""}</span>
                </div>
                <p className="mt-2 truncate text-xs text-warm-500">{attachment.local_path}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : null;

  const servicesPanel = client?.id ? (
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <div className="rounded-card border border-warm-100 bg-warm-50 p-5">
        <div className="flex items-center gap-2">
          <ClipboardList size={21} className="text-sage" />
          <h2 className="text-lg font-bold">خدمات</h2>
        </div>
        <div className="mt-5 grid gap-4">
          <TextField label="نام خدمت جدید" value={catalogForm.name} onChange={(value) => setCatalogForm({ ...catalogForm, name: value })} />
          <NumberField label="قیمت پیش‌فرض" value={catalogForm.default_price} onChange={(value) => setCatalogForm({ ...catalogForm, default_price: value })} suffix="تومان" />
          <TextField label="مدت زمان پیش‌فرض" value={catalogForm.default_duration_minutes} onChange={(value) => setCatalogForm({ ...catalogForm, default_duration_minutes: value })} placeholder="دقیقه" />
          <SecondaryButton icon={Plus} onClick={saveCatalogItem}>افزودن به کاتالوگ</SecondaryButton>
        </div>
      </div>
      <div className="rounded-card border border-warm-100 bg-white p-5">
        <h2 className="text-lg font-bold">ثبت خدمت برای ویزیت</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <SelectField label="ویزیت" value={serviceForm.visitId} onChange={(value) => setServiceForm({ ...serviceForm, visitId: value })} options={Object.fromEntries(visits.map((item) => [String(item.visit.id ?? ""), formatPersianDate(item.visit.visit_date)]))} />
          <SelectField label="خدمت" value={serviceForm.catalogId} onChange={selectCatalogItem} options={Object.fromEntries(serviceCatalog.map((item) => [String(item.id ?? ""), item.name]))} />
          <NumberField label="تعداد" value={serviceForm.quantity} onChange={(value) => setServiceForm({ ...serviceForm, quantity: value })} suffix="عدد" />
          <NumberField label="قیمت" value={serviceForm.price} onChange={(value) => setServiceForm({ ...serviceForm, price: value })} suffix="تومان" />
          <TextField label="ناحیه بدن" value={serviceForm.body_area} onChange={(value) => setServiceForm({ ...serviceForm, body_area: value })} />
          <TextField label="یادداشت" value={serviceForm.notes} onChange={(value) => setServiceForm({ ...serviceForm, notes: value })} />
        </div>
        <div className="mt-5"><SecondaryButton icon={Plus} onClick={saveVisitService}>ثبت خدمت</SecondaryButton></div>
        <div className="mt-6 grid gap-3">
          {serviceCatalog.map((item) => (
            <div key={item.id ?? item.name} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-warm-100 bg-warm-50 px-4 py-3 text-sm">
              <span className="font-semibold">{item.name}</span>
              <span className="numbers text-warm-500">{formatNumber(item.default_price)} تومان</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <PageHeader
        title={client ? "پرونده مراجعه‌کننده" : "مراجعه‌کننده جدید"}
        subtitle={client ? "اطلاعات، ویزیت‌ها و روند تغییرات مراجعه‌کننده را یکجا ببینید." : "اطلاعات پایه برای محاسبه انرژی و پیگیری ویزیت را وارد کنید."}
        action={
          <div className="flex flex-wrap gap-2">
            {client?.id && <SecondaryButton icon={FileText} onClick={exportClientReport}>پرونده چاپ/PDF</SecondaryButton>}
            <PrimaryButton icon={Save} onClick={save}>ذخیره پرونده</PrimaryButton>
          </div>
        }
      />
      <section className="card p-6">
        {topError && <ErrorSummary message={topError} />}
        {client?.id && (
          <div className="mb-6 flex flex-wrap gap-2 border-b border-warm-100 pb-4">
            <TabButton active={activeTab === "summary"} onClick={() => setActiveTab("summary")}>خلاصه</TabButton>
            <TabButton active={activeTab === "visits"} onClick={() => setActiveTab("visits")}>ویزیت‌ها</TabButton>
            <TabButton active={activeTab === "files"} onClick={() => setActiveTab("files")}>فایل‌ها</TabButton>
            <TabButton active={activeTab === "services"} onClick={() => setActiveTab("services")}>خدمات</TabButton>
            <TabButton active={activeTab === "base"} onClick={() => setActiveTab("base")}>اطلاعات پایه</TabButton>
          </div>
        )}
        {!client?.id || activeTab === "base" ? baseInfo : null}
        {client?.id && activeTab === "summary" && (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <ResultCard title="آخرین وزن" value={latestRecord ? formatNumber(latestRecord.weight_kg, 1) : "—"} unit="کیلوگرم" text={latestRecord ? formatPersianDate(latestRecord.record_date) : "هنوز ویزیتی ثبت نشده است."} />
            <ResultCard title="تغییر وزن" value={weightDelta === null ? "—" : formatNumber(weightDelta, 1)} unit="کیلوگرم" text="نسبت به ویزیت قبلی." />
            <ResultCard title="BMI" value={latestBmi ? formatNumber(latestBmi, 1) : "—"} unit={latestBmi ? bmiCategory(latestBmi) : "بدون داده"} text="بر اساس آخرین اندازه‌گیری." featured />
            <ResultCard title="مراجعه بعدی" value={latestVisit?.visit.next_visit_enabled && latestVisit.visit.next_visit_date ? isoToJalaliInput(latestVisit.visit.next_visit_date) : "—"} unit={latestVisit?.visit.next_visit_time || ""} text={latestVisit?.visit.next_visit_enabled ? "از آخرین ویزیت ثبت شده." : "برای این مراجعه زمان بعدی ثبت نشده است."} />
          </div>
        )}
        {client?.id && activeTab === "visits" ? visitsPanel : null}
        {client?.id && activeTab === "files" ? filesPanel : null}
        {client?.id && activeTab === "services" ? servicesPanel : null}
        <div className="mt-6"><SecondaryButton onClick={onBack}>بازگشت به فهرست</SecondaryButton></div>
      </section>
    </>
  );
}

function ClientForm({ client, onBack, onSaved, toast }: { client: Client | null; onBack: () => void; onSaved: (client: Client) => void; toast: ToastFn }) {
  const [form, setForm] = useState<Client>(client ?? emptyClient);
  const [records, setRecords] = useState<ClientRecord[]>([]);
  const [recordForm, setRecordForm] = useState({
    record_date: todayIsoDate(),
    weight_kg: client?.weight_kg ?? emptyClient.weight_kg,
    height_cm: client?.height_cm ?? emptyClient.height_cm,
    notes: "",
  });
  useEffect(() => setForm(client ?? emptyClient), [client]);
  useEffect(() => {
    setRecordForm({
      record_date: todayIsoDate(),
      weight_kg: client?.weight_kg ?? emptyClient.weight_kg,
      height_cm: client?.height_cm ?? emptyClient.height_cm,
      notes: "",
    });
    if (!client?.id || !isDesktopRuntime()) {
      setRecords([]);
      return;
    }
    invoke<ClientRecord[]>("list_client_records", { clientId: client.id })
      .then(setRecords)
      .catch(() => setRecords([]));
  }, [client]);

  const setField = <K extends keyof Client>(key: K, value: Client[K]) => setForm((current) => ({ ...current, [key]: value }));
  const chooseProfileImage = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"] }],
      });
      if (!selected || Array.isArray(selected)) return;
      const imported = isDesktopRuntime()
        ? await invoke<string>("import_brand_asset", { path: selected, kind: "client-profile" })
        : selected;
      setField("profile_image_path", imported);
      toast("عکس پروفایل انتخاب شد.");
    } catch (error) {
      toast(getErrorMessage(error, "انتخاب عکس انجام نشد."), "error");
    }
  };
  const save = async () => {
    if (!form.full_name.trim()) {
      toast("نام مراجع را وارد کنید.", "error");
      return;
    }
    try {
      const saved = await invoke<Client>("save_client", { client: form });
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
      onSaved(saved);
      toast(client ? "پرونده ذخیره شد." : "مراجع جدید ثبت شد.");
    } catch (error) {
      toast(getErrorMessage(error, "ذخیره انجام نشد."), "error");
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
      await invoke<Client>("save_client", { client: updatedClient });
      setRecordForm({ record_date: todayIsoDate(), weight_kg: record.weight_kg, height_cm: record.height_cm, notes: "" });
      toast("رکورد ویزیت ثبت شد.");
    } catch (error) {
      toast(getErrorMessage(error, "ثبت رکورد انجام نشد."), "error");
    }
  };

  return (
    <>
      <PageHeader title={client ? "پرونده مراجع" : "مراجع جدید"} subtitle={client ? "اطلاعات، یادداشت‌ها و روند تغییرات مراجع را یکجا ببینید." : "اطلاعات پایه برای محاسبه انرژی و پیگیری ویزیت را وارد کنید."} action={<PrimaryButton icon={Save} onClick={save}>ذخیره پرونده</PrimaryButton>} />
      <section className="card p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2 flex flex-col gap-4 rounded-card border border-warm-100 bg-warm-50 p-4 sm:flex-row sm:items-center">
            <ProfileAvatar client={form} size="lg" />
            <div className="flex-1">
              <p className="text-sm font-bold">عکس پروفایل مراجع</p>
              <p className="helper mt-1">برای شناسایی سریع‌تر در پرونده و لیست مراجعین.</p>
            </div>
            <SecondaryButton icon={Camera} onClick={chooseProfileImage}>انتخاب عکس</SecondaryButton>
          </div>
          <TextField label="نام کامل" value={form.full_name} onChange={(value) => setField("full_name", value)} />
          <TextField label="شماره تماس" value={form.phone} onChange={(value) => setField("phone", value)} placeholder="مثلا 09123456789" />
          <TextField label="ایمیل" value={form.email} onChange={(value) => setField("email", value)} placeholder="name@example.com" />
          <SelectField label="جنسیت" value={form.gender} onChange={(value) => setField("gender", value as Gender)} options={genderLabels} />
          <NumberField label="سن" value={form.age} onChange={(value) => setField("age", value)} suffix="سال" />
          <NumberField label="قد" value={form.height_cm} onChange={(value) => setField("height_cm", value)} suffix="سانتی‌متر" />
          <NumberField label="وزن" value={form.weight_kg} onChange={(value) => setField("weight_kg", value)} suffix="کیلوگرم" />
          <SelectField label="سطح فعالیت" value={form.activity_level} onChange={(value) => setField("activity_level", value as ActivityLevel)} options={activityLabels} />
          <SelectField label="هدف" value={form.goal} onChange={(value) => setField("goal", value as Goal)} options={goalLabels} />
          <div className="md:col-span-2">
            <label className="label">یادداشت پرونده</label>
            <textarea className="control mt-2 min-h-32 w-full py-3" value={form.notes} onChange={(event) => setField("notes", event.target.value)} />
          </div>
        </div>
        {client?.id && (
          <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-card border border-warm-100 bg-warm-50 p-5">
              <div className="flex items-center gap-2">
                <ClipboardList size={21} className="text-sage" />
                <h2 className="text-lg font-bold">رکورد ویزیت امروز</h2>
              </div>
              <p className="helper mt-2">هر مراجعه جدید را با تاریخ خودش ثبت کنید تا روند وزن قابل پیگیری شود.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <DateField label="تاریخ" value={recordForm.record_date} onChange={(value) => setRecordForm({ ...recordForm, record_date: value })} />
                <NumberField label="وزن" value={recordForm.weight_kg} onChange={(value) => setRecordForm({ ...recordForm, weight_kg: value })} suffix="کیلوگرم" />
                <NumberField label="قد" value={recordForm.height_cm} onChange={(value) => setRecordForm({ ...recordForm, height_cm: value })} suffix="سانتی‌متر" />
                <div className="sm:col-span-2">
                  <label className="label">یادداشت ویزیت</label>
                  <textarea className="control mt-2 min-h-24 w-full py-3" value={recordForm.notes} onChange={(event) => setRecordForm({ ...recordForm, notes: event.target.value })} />
                </div>
              </div>
              <div className="mt-5"><SecondaryButton icon={Plus} onClick={saveRecord}>ثبت رکورد</SecondaryButton></div>
            </div>
            <div className="rounded-card border border-warm-100 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2"><TrendingUp size={21} className="text-sage" /><h2 className="text-lg font-bold">روند وزن</h2></div>
                <span className="text-xs text-warm-500">{formatNumber(records.length)} رکورد</span>
              </div>
              {records.length === 0 ? <EmptyState icon={CalendarDays} title="هنوز رکوردی ثبت نشده" text="اولین ویزیت را از فرم کنار صفحه ثبت کنید." /> : <WeightHistory records={records} />}
            </div>
          </div>
        )}
        <div className="mt-6"><SecondaryButton onClick={onBack}>بازگشت به فهرست</SecondaryButton></div>
      </section>
    </>
  );
}

function CalculatorScreen({ initialClient, settings, toast }: { initialClient: Client | null; settings: Settings; toast: ToastFn }) {
  const [selected, setSelected] = useState<Client | null>(initialClient);
  const [input, setInput] = useState<Client>(initialClient ?? emptyClient);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Client[]>([]);
  const [overrides, setOverrides] = useState({ calories: "", protein: "", carbs: "", fat: "" });

  useEffect(() => {
    setSelected(initialClient);
    setInput(initialClient ?? emptyClient);
  }, [initialClient]);

  useEffect(() => {
    if (!query.trim() || !isDesktopRuntime()) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(() => invoke<Client[]>("search_clients", { query }).then(setResults).catch(() => setResults([])), 150);
    return () => window.clearTimeout(timer);
  }, [query]);

  const calc = calculateNutrition(input, settings);
  const calories = Number(overrides.calories) || calc.targetCalories;
  const protein = Number(overrides.protein) || (calories * (calc.proteinPercent / 100)) / 4;
  const carbs = Number(overrides.carbs) || (calories * (calc.carbsPercent / 100)) / 4;
  const fat = Number(overrides.fat) || (calories * (calc.fatPercent / 100)) / 9;
  const setField = <K extends keyof Client>(key: K, value: Client[K]) => setInput((current) => ({ ...current, [key]: value }));
  const choose = (client: Client) => {
    setSelected(client);
    setInput(client);
    setQuery("");
    setResults([]);
    toast("اطلاعات مراجع در محاسبات تغذیه قرار گرفت.");
  };
  const clear = () => {
    setSelected(null);
    setInput(emptyClient);
    setQuery("");
    setOverrides({ calories: "", protein: "", carbs: "", fat: "" });
  };

  return (
    <>
      <PageHeader title="محاسبات تغذیه" subtitle="انتخاب مراجع ذخیره‌شده یا ورود دستی؛ همه نتایج در لحظه به‌روزرسانی می‌شوند." />
      <div className="grid gap-5 xl:grid-cols-[430px_1fr]">
        <section className="card p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold">ورودی‌ها</h2><p className="helper mt-1">{selected ? `مراجع انتخاب‌شده: ${selected.full_name}` : "حالت ورود دستی فعال است."}</p></div>
            {selected && <SecondaryButton icon={RotateCcw} onClick={clear}>ورود دستی</SecondaryButton>}
          </div>
          <div className="relative mb-5">
            <Search className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-warm-500" size={20} />
            <input className="control w-full pr-12" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی مراجع ذخیره‌شده" />
            {results.length > 0 && (
              <div className="absolute z-10 mt-2 max-h-72 w-full overflow-auto rounded-card border border-warm-100 bg-paper p-2 shadow-soft">
                {results.map((client) => <button key={client.id} onClick={() => choose(client)} className="soft-transition flex w-full items-center justify-between rounded-control px-3 py-3 text-right hover:bg-warm-50"><span className="font-semibold">{client.full_name}</span><span className="text-xs text-warm-500">{goalLabels[client.goal]}</span></button>)}
              </div>
            )}
          </div>
          <div className="grid gap-4">
            <SelectField label="جنسیت" value={input.gender} onChange={(value) => setField("gender", value as Gender)} options={genderLabels} />
            <NumberField label="سن" value={input.age} onChange={(value) => setField("age", value)} suffix="سال" />
            <NumberField label="قد" value={input.height_cm} onChange={(value) => setField("height_cm", value)} suffix="سانتی‌متر" />
            <NumberField label="وزن" value={input.weight_kg} onChange={(value) => setField("weight_kg", value)} suffix="کیلوگرم" />
            <SelectField label="سطح فعالیت" value={input.activity_level} onChange={(value) => setField("activity_level", value as ActivityLevel)} options={activityLabels} />
            <SelectField label="هدف" value={input.goal} onChange={(value) => setField("goal", value as Goal)} options={goalLabels} />
          </div>
          <div className="mt-6 rounded-card bg-warm-50 p-4">
            <p className="text-sm font-bold">اصلاح دستی</p>
            <p className="helper mt-1">کالری یا گرم هر ماکرو را آزادانه تغییر دهید.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <OverrideField label="کالری هدف" value={overrides.calories} onChange={(value) => setOverrides({ ...overrides, calories: value })} />
              <OverrideField label="پروتئین" value={overrides.protein} onChange={(value) => setOverrides({ ...overrides, protein: value })} />
              <OverrideField label="کربوهیدرات" value={overrides.carbs} onChange={(value) => setOverrides({ ...overrides, carbs: value })} />
              <OverrideField label="چربی" value={overrides.fat} onChange={(value) => setOverrides({ ...overrides, fat: value })} />
            </div>
          </div>
        </section>
        <section className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <ResultCard title="BMI" value={formatNumber(calc.bmi, 1)} unit={bmiCategory(calc.bmi)} text="نمای سریع وضعیت وزنی بر اساس قد و وزن." />
          <ResultCard title="IBW" value={formatNumber(calc.ibw, 1)} unit="کیلوگرم" text="وزن ایده‌آل بر اساس ضریب BMI تنظیمات." />
          <ResultCard title="ABW" value={formatNumber(calc.abw, 1)} unit="کیلوگرم" text="وزن تعدیل‌شده برای محاسبه انرژی پایه." />
          <ResultCard title="BMR" value={formatNumber(calc.bmr)} unit="کیلوکالری" text="انرژی پایه بر اساس ABW و ضرایب تنظیمات." />
          <ResultCard title="TEE" value={formatNumber(calc.tee)} unit="کیلوکالری" text="نیاز انرژی روزانه با سطح فعالیت." />
          <ResultCard title="کالری هدف" value={formatNumber(calories)} unit="کیلوکالری" text="بر اساس هدف وزن و قابل اصلاح دستی." featured />
          <ResultCard title="پروتئین" value={formatNumber(protein)} unit="گرم" text={`${formatNumber(calc.proteinPercent)}٪ از کالری هدف.`} />
          <ResultCard title="کربوهیدرات" value={formatNumber(carbs)} unit="گرم" text={`${formatNumber(calc.carbsPercent)}٪ از کالری هدف.`} />
          <ResultCard title="چربی" value={formatNumber(fat)} unit="گرم" text={`${formatNumber(calc.fatPercent)}٪ از کالری هدف.`} />
        </section>
      </div>
    </>
  );
}

function SettingsScreen({ settings, setSettings, toast }: { settings: Settings; setSettings: (settings: Settings) => void; toast: ToastFn }) {
  const [form, setForm] = useState(settings);
  const [credentials, setCredentials] = useState({ current_password: "", username: settings.username || "admin", password: "", repeat: "" });
  useEffect(() => setForm(settings), [settings]);

  const save = async () => {
    try {
      const saved = isDesktopRuntime() ? await invoke<Settings>("save_settings", { settings: form }) : form;
      setSettings(saved);
      toast("تنظیمات ذخیره شد.");
    } catch (error) {
      toast(getErrorMessage(error, "ذخیره تنظیمات انجام نشد."), "error");
    }
  };
  const changeCredentials = async () => {
    if (!credentials.username.trim() || credentials.password.length < 4 || credentials.password !== credentials.repeat) {
      toast("نام کاربری و رمز جدید را درست وارد کنید.", "error");
      return;
    }
    try {
      if (isDesktopRuntime()) await invoke("change_credentials", { input: { current_password: credentials.current_password, username: credentials.username, password: credentials.password } });
      setSettings({ ...settings, username: credentials.username });
      setCredentials({ current_password: "", username: credentials.username, password: "", repeat: "" });
      toast("اطلاعات ورود تغییر کرد.");
    } catch (error) {
      toast(getErrorMessage(error, "رمز فعلی درست نیست یا تغییر انجام نشد."), "error");
    }
  };
  const exportData = async () => {
    try {
      const path = await invoke<string>("export_data_backup");
      toast(`فایل سبک ذخیره شد: ${path}`);
    } catch (error) {
      toast(getErrorMessage(error, "ساخت فایل پشتیبان انجام نشد."), "error");
    }
  };
  const restoreData = async () => {
    try {
      const selected = await open({ multiple: false, filters: [{ name: "Dietoy backup", extensions: ["json"] }] });
      if (!selected || Array.isArray(selected)) return;
      await invoke("restore_data_backup", { path: selected });
      const restored = await invoke<Settings>("get_settings");
      setSettings(restored);
      toast("اطلاعات قبلی بازیابی شد.");
    } catch (error) {
      toast(getErrorMessage(error, "بازیابی انجام نشد."), "error");
    }
  };
  const exportSqlite = async () => {
    try {
      const path = await invoke<string>("export_database");
      toast(`کپی SQLite ذخیره شد: ${path}`);
    } catch (error) {
      toast(getErrorMessage(error, "خروجی SQLite انجام نشد."), "error");
    }
  };
  const chooseBrandImage = async (kind: "logo" | "background") => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif", "svg"] }],
      });
      if (!selected || Array.isArray(selected)) return;
      const imported = isDesktopRuntime()
        ? await invoke<string>("import_brand_asset", { path: selected, kind })
        : selected;
      setForm((current) =>
        kind === "logo"
          ? { ...current, logo_path: imported }
          : { ...current, background_image_path: imported },
      );
      toast(kind === "logo" ? "لوگو انتخاب شد. ذخیره را بزنید." : "عکس پس‌زمینه انتخاب شد. ذخیره را بزنید.");
    } catch (error) {
      toast(getErrorMessage(error, "انتخاب تصویر انجام نشد."), "error");
    }
  };
  const applyDietoyTheme = () => {
    setForm((current) => ({
      ...current,
      primary_color: dietoyTheme.primary_color,
      background_color: dietoyTheme.background_color,
      text_color: dietoyTheme.text_color,
    }));
    toast("تم دایتوری اعمال شد. برای ماندن دائمی ذخیره را بزنید.");
  };
  const setCalcSetting = (key: CalcSettingKey, value: number) => {
    setForm((current) => ({ ...current, [key]: Number.isFinite(value) ? value : defaultCalculationSettings[key] }));
  };

  return (
    <>
      <PageHeader title="تنظیمات" subtitle="شخصی‌سازی مطب، تغییر ورود و پشتیبان‌گیری برای آپدیت‌های آینده." action={<PrimaryButton icon={Save} onClick={save}>ذخیره</PrimaryButton>} />
      <section className="grid gap-5 xl:grid-cols-[1fr_0.75fr]">
        <div className="card p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2 rounded-control border border-warm-100 bg-warm-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold">{dietoyTheme.name}</p>
                  <p className="helper mt-1">پس‌زمینه برند با HEX #10517A و نوشته روشن برای صفحه‌های اصلی.</p>
                </div>
                <SecondaryButton icon={Palette} onClick={applyDietoyTheme}>اعمال تم</SecondaryButton>
              </div>
            </div>
            <TextField label="نام متخصص تغذیه" value={form.dietitian_name} onChange={(value) => setForm({ ...form, dietitian_name: value })} />
            <TextField label="نام کلینیک" value={form.clinic_name} onChange={(value) => setForm({ ...form, clinic_name: value })} />
            <div>
              <label className="label">رنگ اصلی</label>
              <div className="mt-2 flex h-12 items-center gap-3 rounded-control border border-warm-200 bg-white px-3">
                <Palette size={19} className="text-warm-500" />
                <input type="color" value={colorValue(form.primary_color, defaultSettings.primary_color)} onChange={(event) => setForm({ ...form, primary_color: event.target.value })} className="h-8 w-12 cursor-pointer border-0 bg-transparent p-0" />
                <input value={form.primary_color} onChange={(event) => setForm({ ...form, primary_color: event.target.value })} className="numbers min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" />
              </div>
            </div>
            <div>
              <label className="label">رنگ پس‌زمینه</label>
              <div className="mt-2 flex h-12 items-center gap-3 rounded-control border border-warm-200 bg-white px-3">
                <Palette size={19} className="text-warm-500" />
                <input type="color" value={colorValue(form.background_color, defaultSettings.background_color)} onChange={(event) => setForm({ ...form, background_color: event.target.value })} className="h-8 w-12 cursor-pointer border-0 bg-transparent p-0" />
                <input value={form.background_color || defaultSettings.background_color} onChange={(event) => setForm({ ...form, background_color: event.target.value })} className="numbers min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" />
              </div>
            </div>
            <div>
              <label className="label">رنگ نوشته‌ها</label>
              <div className="mt-2 flex h-12 items-center gap-3 rounded-control border border-warm-200 bg-white px-3">
                <Palette size={19} className="text-warm-500" />
                <input type="color" value={colorValue(form.text_color, defaultSettings.text_color)} onChange={(event) => setForm({ ...form, text_color: event.target.value })} className="h-8 w-12 cursor-pointer border-0 bg-transparent p-0" />
                <input value={form.text_color || defaultSettings.text_color} onChange={(event) => setForm({ ...form, text_color: event.target.value })} className="numbers min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="label">لوگو و عکس پس‌زمینه</label>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => chooseBrandImage("logo")} className="soft-transition flex h-16 items-center justify-between rounded-control border border-warm-200 bg-white px-4 text-sm font-semibold hover:bg-warm-50">
                  <span className="flex items-center gap-2"><ImageIcon size={19} /> انتخاب لوگو</span>
                  {form.logo_path && <span className="text-xs text-olive">انتخاب شده</span>}
                </button>
                <button type="button" onClick={() => chooseBrandImage("background")} className="soft-transition flex h-16 items-center justify-between rounded-control border border-warm-200 bg-white px-4 text-sm font-semibold hover:bg-warm-50">
                  <span className="flex items-center gap-2"><ImageIcon size={19} /> انتخاب بک‌گراند</span>
                  {form.background_image_path && <span className="text-xs text-olive">انتخاب شده</span>}
                </button>
              </div>
              <p className="helper mt-3">برای لوگوی پیش‌فرض نسخه نصبی، فایل لوگو را با نام logo.png داخل پوشه public پروژه بگذارید.</p>
            </div>
            <div className="md:col-span-2 rounded-card border border-warm-100 bg-warm-50 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Calculator size={21} className="text-sage" />
                    <h2 className="text-lg font-bold">تنظیمات محاسبات</h2>
                  </div>
                  <p className="helper mt-2">این بخش روی محاسبات بعدی اثر دارد. برای نسخه مشتری، مقدارهای پیش‌فرض فعلی مناسب و ساده‌اند.</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-olive">پروتکل تغذیه</span>
              </div>
              <div className="mt-5 grid gap-4">
                {calculationSettingGroups.map((group) => (
                  <div key={group.title} className="rounded-card border border-warm-100 bg-white p-4">
                    <div className="mb-4">
                      <p className="text-sm font-bold text-charcoal">{group.title}</p>
                      <p className="helper mt-1">{group.description}</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {group.fields.map((field) => (
                        <SettingNumberField
                          key={field.key}
                          label={field.label}
                          value={Number(form[field.key] ?? defaultCalculationSettings[field.key])}
                          step={field.step}
                          onChange={(value) => setCalcSetting(field.key, value)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-5">
          <div className="card p-6">
            <KeyRound className="text-sage" size={28} />
            <h2 className="mt-5 text-xl font-bold">ورود به برنامه</h2>
            <p className="mt-3 text-sm leading-7 text-warm-500">نام کاربری و رمز اولیه admin است. قبل از تحویل به مشتری تغییر دهید.</p>
            <div className="mt-5 grid gap-4">
              <TextField label="نام کاربری جدید" value={credentials.username} onChange={(value) => setCredentials({ ...credentials, username: value })} />
              <PasswordField label="رمز فعلی" value={credentials.current_password} onChange={(value) => setCredentials({ ...credentials, current_password: value })} />
              <PasswordField label="رمز جدید" value={credentials.password} onChange={(value) => setCredentials({ ...credentials, password: value })} />
              <PasswordField label="تکرار رمز جدید" value={credentials.repeat} onChange={(value) => setCredentials({ ...credentials, repeat: value })} />
            </div>
            <div className="mt-6"><SecondaryButton icon={KeyRound} onClick={changeCredentials}>تغییر اطلاعات ورود</SecondaryButton></div>
          </div>
          <div className="card p-6">
            <Database className="text-sage" size={28} />
            <h2 className="mt-5 text-xl font-bold">پشتیبان و آپدیت</h2>
            <p className="mt-3 text-sm leading-7 text-warm-500">برای آپدیت فقط فایل JSON سبک را از مشتری بگیرید و بعد از نصب نسخه جدید بازیابی کنید.</p>
            <div className="mt-6 grid gap-3">
              <SecondaryButton icon={Download} onClick={exportData}>خروجی سبک برای آپدیت</SecondaryButton>
              <SecondaryButton icon={FileUp} onClick={restoreData}>بازیابی اطلاعات قبلی</SecondaryButton>
              <SecondaryButton icon={Database} onClick={exportSqlite}>خروجی کامل SQLite</SecondaryButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><h1 className="text-3xl font-bold tracking-normal md:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-warm-500">{subtitle}</p></div>{action}</header>;
}

function FieldError({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="mt-2 text-xs font-medium leading-6 text-red-600">{text}</p>;
}

function ErrorSummary({ message }: { message: string }) {
  return (
    <div className="mb-5 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-7 text-red-700">
      {message}
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "soft-transition h-11 rounded-control px-4 text-sm font-semibold",
        active ? "bg-[var(--primary)] text-white shadow-lift" : "bg-warm-50 text-warm-500 hover:bg-white hover:text-charcoal",
      )}
    >
      {children}
    </button>
  );
}

function PrimaryButton({ children, onClick, icon: Icon, type = "button" }: { children: React.ReactNode; onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void; icon?: typeof Plus; type?: "button" | "submit" }) {
  return <button type={type} onClick={onClick} className="soft-transition inline-flex h-12 items-center justify-center gap-2 rounded-control bg-[var(--primary)] px-5 text-sm font-semibold text-white shadow-lift hover:-translate-y-0.5">{Icon && <Icon size={19} />}{children}</button>;
}

function SecondaryButton({ children, onClick, icon: Icon }: { children: React.ReactNode; onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void; icon?: typeof Plus }) {
  return <button onClick={onClick} className="soft-transition inline-flex h-12 items-center justify-center gap-2 rounded-control border border-warm-100 bg-paper px-5 text-sm font-semibold text-charcoal hover:bg-warm-50">{Icon && <Icon size={19} />}{children}</button>;
}

function Stat({ label, value, icon: Icon, hint }: { label: string; value?: number; icon: typeof Users; hint?: string }) {
  const display = metricDisplay(value);
  return (
    <div className={cn("metric-card card p-5", display.isZero && "metric-card-empty")}>
      <div className="mb-5 flex items-center justify-between gap-3 text-warm-500">
        <span className="text-sm font-semibold">{label}</span>
        <span className="grid h-9 w-9 place-items-center rounded-control bg-warm-50 text-olive"><Icon size={20} /></span>
      </div>
      {value === undefined ? (
        <div className="h-11 w-24 animate-pulse rounded-control bg-warm-100" />
      ) : (
        <p className={cn("metric-value text-charcoal", display.isZero && "metric-value-empty")}>{display.text}</p>
      )}
      <p className="mt-3 text-xs leading-6 text-warm-500">{display.isZero ? "هنوز موردی ثبت نشده" : hint}</p>
    </div>
  );
}

function RevenueStat({ value }: { value?: number }) {
  const display = currencyDisplay(value);
  return (
    <div className={cn("metric-card card p-5", display.isZero && "metric-card-empty")}>
      <div className="mb-5 flex items-center justify-between gap-3 text-warm-500">
        <span className="text-sm font-semibold">درآمد خدمات این ماه</span>
        <span className="grid h-9 w-9 place-items-center rounded-control bg-warm-50 text-olive"><BadgeDollarSign size={20} /></span>
      </div>
      {value === undefined ? (
        <div className="h-11 w-28 animate-pulse rounded-control bg-warm-100" />
      ) : (
        <p className={cn("metric-value text-charcoal", display.isZero && "metric-value-empty")}>{display.text}</p>
      )}
      <p className="mt-3 text-xs leading-6 text-warm-500">{display.isZero ? "بعد از ثبت خدمات ویزیت نمایش داده می‌شود" : "تومان"}</p>
    </div>
  );
}

function ProfileAvatar({ client, size = "md" }: { client: Client; size?: "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const photo = client.profile_image_path ? assetUrl(client.profile_image_path) : "";
  const initials = client.full_name.trim().slice(0, 2) || "DT";
  const sizeClass = size === "lg" ? "h-24 w-24 text-xl" : "h-14 w-14 text-sm";
  useEffect(() => setFailed(false), [photo]);

  return (
    <div className={cn("shrink-0 overflow-hidden rounded-card bg-[var(--primary)] text-white shadow-lift", sizeClass)}>
      {photo && !failed ? (
        <img src={photo} alt={client.full_name || "profile"} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <div className="grid h-full w-full place-items-center font-bold">{initials}</div>
      )}
    </div>
  );
}

function ClientRow({ client, onEdit, onCalculate, onArchive }: { client: Client; onEdit: () => void; onCalculate?: () => void; onArchive?: () => void }) {
  return (
    <div
      className={cn("soft-transition cursor-pointer rounded-card border border-warm-100 bg-white p-4 hover:border-[var(--primary)] hover:shadow-lift", client.archived && "opacity-60")}
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onEdit();
      }}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <ProfileAvatar client={client} />
          <div className="min-w-0">
            <h3 className="text-lg font-bold">{client.full_name}</h3>
            <p className="mt-2 text-xs text-warm-500">{genderLabels[client.gender]}، {formatNumber(client.age)} سال، {formatNumber(client.height_cm)} سانتی‌متر، {formatNumber(client.weight_kg)} کیلوگرم، {goalLabels[client.goal]}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-warm-500">
              {client.phone && <span className="flex items-center gap-1"><Phone size={14} />{client.phone}</span>}
              {client.email && <span className="flex items-center gap-1"><Mail size={14} />{client.email}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {onCalculate && <SecondaryButton icon={Calculator} onClick={(event) => { event.stopPropagation(); onCalculate(); }}>محاسبه</SecondaryButton>}
          <SecondaryButton icon={Pencil} onClick={(event) => { event.stopPropagation(); onEdit(); }}>ویرایش</SecondaryButton>
          {onArchive && <SecondaryButton icon={Archive} onClick={(event) => { event.stopPropagation(); onArchive(); }}>{client.archived ? "فعال" : "بایگانی"}</SecondaryButton>}
        </div>
      </div>
    </div>
  );
}

function ResultCard({ title, value, unit, text, featured = false }: { title: string; value: string; unit: string; text: string; featured?: boolean }) {
  return (
    <div className={cn("result-card card p-5", featured && "result-card-featured border-[var(--primary)] bg-[#fffef9]")}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-warm-500">{title}</p>
        {featured && <span className="rounded-full bg-emerald/10 px-3 py-1 text-[11px] font-bold text-[var(--primary)]">اصلی</span>}
      </div>
      <div className="mt-5 flex flex-wrap items-end gap-x-3 gap-y-1">
        <p className="numbers max-w-full break-words text-4xl font-extrabold leading-none text-charcoal">{value}</p>
        <p className="pb-1 text-sm font-semibold text-olive">{unit}</p>
      </div>
      <p className="mt-4 min-h-10 text-xs leading-6 text-warm-500">{text}</p>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, error }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; error?: string }) {
  return <div><label className="label">{label}</label><input className={cn("control mt-2 w-full", error && "border-red-300 focus:border-red-400 focus:ring-red-100")} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /><FieldError text={error} /></div>;
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div><label className="label">{label}</label><input className="control mt-2 w-full" type="password" value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" /></div>;
}

function IconInput({ icon: Icon, label, value, onChange, type = "text", autoComplete }: { icon: typeof UserRound; label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string }) {
  return <div><label className="label">{label}</label><div className="mt-2 flex h-12 items-center gap-3 rounded-control border border-warm-200 bg-white/95 px-4 shadow-sm focus-within:border-[var(--primary)] focus-within:ring-4 focus-within:ring-emerald/10"><Icon size={19} className="text-olive" /><input className="min-w-0 flex-1 border-0 bg-transparent text-charcoal outline-none placeholder:text-warm-400" type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} /></div></div>;
}

function NumberField({ label, value, onChange, suffix, error }: { label: string; value: number; onChange: (value: number) => void; suffix: string; error?: string }) {
  return <div><label className="label">{label}</label><div className={cn("input-with-unit mt-2 flex h-12 items-center gap-3 rounded-control border border-warm-200 bg-white px-4 focus-within:border-[var(--primary)] focus-within:ring-4 focus-within:ring-emerald/10", error && "border-red-300 focus-within:border-red-400 focus-within:ring-red-100")}><input className="numbers min-w-0 flex-1 border-0 bg-transparent text-left text-charcoal outline-none" type="number" min="0" dir="ltr" value={value} onChange={(event) => onChange(Number(event.target.value))} /><span className="shrink-0 whitespace-nowrap text-xs font-semibold text-warm-500">{suffix}</span></div><FieldError text={error} /></div>;
}

function SettingNumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (value: number) => void; step?: number }) {
  return <div><label className="label">{label}</label><input className="control numbers mt-2 w-full text-left" type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></div>;
}

function TimeField({ label, value, onChange, error }: { label: string; value: string; onChange: (value: string) => void; error?: string }) {
  return <div><label className="label">{label}</label><input className={cn("control numbers mt-2 w-full text-left", error && "border-red-300 focus:border-red-400 focus:ring-red-100")} type="time" step="300" dir="ltr" value={value} onChange={(event) => onChange(event.target.value)} /><FieldError text={error} /></div>;
}

function DateField({ label, value, onChange, error }: { label: string; value: string; onChange: (value: string) => void; error?: string }) {
  const currentParts = jalaliPartsFromIso(value || todayIsoDate());
  const [text, setText] = useState(isoToJalaliInput(value || todayIsoDate()));
  const [openPicker, setOpenPicker] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState({ year: currentParts.jy, month: currentParts.jm });

  useEffect(() => {
    setText(isoToJalaliInput(value || todayIsoDate()));
    const next = jalaliPartsFromIso(value || todayIsoDate());
    setVisibleMonth({ year: next.jy, month: next.jm });
  }, [value]);

  const commitText = (nextText: string) => {
    setText(nextText);
    const iso = jalaliInputToIso(nextText);
    if (iso) onChange(iso);
  };
  const chooseDay = (day: number) => {
    const iso = jalaliInputToIso(`${visibleMonth.year}/${String(visibleMonth.month).padStart(2, "0")}/${String(day).padStart(2, "0")}`);
    if (!iso) return;
    onChange(iso);
    setText(isoToJalaliInput(iso));
    setOpenPicker(false);
  };
  const moveMonth = (amount: number) => {
    setVisibleMonth((current) => {
      const nextMonth = current.month + amount;
      if (nextMonth < 1) return { year: current.year - 1, month: 12 };
      if (nextMonth > 12) return { year: current.year + 1, month: 1 };
      return { year: current.year, month: nextMonth };
    });
  };
  const selected = jalaliPartsFromIso(value || todayIsoDate());
  const days = Array.from({ length: daysInJalaliMonth(visibleMonth.year, visibleMonth.month) }, (_, index) => index + 1);

  return (
    <div className="relative">
      <label className="label">{label}</label>
      <input
        className={cn("control numbers mt-2 w-full text-left", error && "border-red-300 focus:border-red-400 focus:ring-red-100")}
        value={text}
        onFocus={() => setOpenPicker(true)}
        onChange={(event) => commitText(event.target.value)}
        placeholder="1405/04/17"
      />
      <FieldError text={error} />
      {openPicker && (
        <div className="absolute z-20 mt-2 w-72 rounded-card border border-warm-100 bg-paper p-3 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" className="h-9 w-9 rounded-control bg-warm-50" onClick={() => moveMonth(1)}>‹</button>
            <span className="numbers text-sm font-bold">{toPersianDigits(`${visibleMonth.year}/${String(visibleMonth.month).padStart(2, "0")}`)}</span>
            <button type="button" className="h-9 w-9 rounded-control bg-warm-50" onClick={() => moveMonth(-1)}>›</button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const active = selected.jy === visibleMonth.year && selected.jm === visibleMonth.month && selected.jd === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => chooseDay(day)}
                  className={cn("numbers h-9 rounded-control text-sm hover:bg-warm-50", active && "bg-[var(--primary)] text-white hover:bg-[var(--primary)]")}
                >
                  {toPersianDigits(day)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function WeightHistory({ records }: { records: ClientRecord[] }) {
  const weights = records.map((record) => record.weight_kg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = Math.max(max - min, 1);
  const points = records.map((record, index) => {
    const x = records.length === 1 ? 250 : 24 + (index * 452) / (records.length - 1);
    const y = 156 - ((record.weight_kg - min) * 116) / range;
    return { x, y, record };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <div>
      <svg viewBox="0 0 500 190" className="h-48 w-full overflow-visible" role="img" aria-label="نمودار تغییر وزن">
        <line x1="24" y1="156" x2="476" y2="156" stroke="#d8cbb9" strokeWidth="1" />
        <line x1="24" y1="40" x2="24" y2="156" stroke="#d8cbb9" strokeWidth="1" />
        <path d={path} fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={`${point.record.record_date}-${point.record.id ?? point.x}`}>
            <circle cx={point.x} cy={point.y} r="6" fill="var(--primary)" />
            <text x={point.x} y={point.y - 12} textAnchor="middle" className="numbers fill-warm-500 text-[11px]">{formatNumber(point.record.weight_kg, 1)}</text>
          </g>
        ))}
      </svg>
      <div className="mt-4 grid gap-2">
        {[...records].reverse().map((record) => (
          <div key={record.id ?? `${record.record_date}-${record.weight_kg}`} className="rounded-control border border-warm-100 bg-warm-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">{formatPersianDate(record.record_date)}</span>
              <span className="numbers text-sm text-olive">{formatNumber(record.weight_kg, 1)} kg</span>
            </div>
            {record.notes && <p className="mt-2 text-xs leading-6 text-warm-500">{record.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function OverrideField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-xs font-medium text-warm-500">{label}</span><input className="control numbers mt-1 h-11 w-full text-left" type="number" min="0" value={value} onChange={(event) => onChange(event.target.value)} placeholder="خودکار" /></label>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Record<string, string> }) {
  return <div><label className="label">{label}</label><select className="control mt-2 w-full" value={value} onChange={(event) => onChange(event.target.value)}>{Object.entries(options).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></div>;
}

function EmptyState({ icon: Icon, title, text }: { icon: typeof Search; title: string; text: string }) {
  return (
    <div className="empty-state grid place-items-center rounded-card border border-dashed border-warm-200 bg-warm-50/80 p-8 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-card bg-white text-sage shadow-sm"><Icon size={28} /></div>
      <h3 className="mt-4 text-lg font-bold text-charcoal">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-7 text-warm-500">{text}</p>
    </div>
  );
}

function SkeletonRows() {
  return <div className="grid gap-3">{[0, 1, 2].map((item) => <div key={item} className="card flex animate-pulse items-center justify-between p-5"><div><div className="h-5 w-40 rounded bg-warm-100" /><div className="mt-3 h-4 w-64 rounded bg-warm-100" /></div><div className="h-10 w-28 rounded-control bg-warm-100" /></div>)}</div>;
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  return <div className="fixed bottom-5 left-5 z-50 grid gap-2">{toasts.map((toast) => <div key={toast.id} className={cn("flex min-h-12 items-center gap-3 rounded-control border bg-paper px-4 text-sm shadow-soft", toast.kind === "error" ? "border-red-200 text-red-700" : "border-warm-100 text-charcoal")}><CheckCircle2 size={18} className={toast.kind === "error" ? "text-red-500" : "text-[var(--primary)]"} /><span>{toast.text}</span></div>)}</div>;
}
