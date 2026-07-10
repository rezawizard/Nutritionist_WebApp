import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Archive,
  Activity,
  Calculator,
  Camera,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
  Ruler,
  Save,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Target,
  TrendingUp,
  Trash2,
  Utensils,
  Video,
  MapPin,
  Trophy,
  Eye,
  WandSparkles,
  ShieldCheck,
  X,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import {
  activityLabels,
  bmiCategory,
  calculateNutrition,
  cn,
  coerceDateToIso,
  defaultCalculationSettings,
  emptyClient,
  formatNumber,
  formatPersianDate,
  getErrorMessage,
  isoToJalaliInput,
  jalaliInputToIso,
  jalaliPartsFromIso,
  daysInJalaliMonth,
  persianMonthNames,
  persianWeekdayShortLabels,
  genderLabels,
  goalLabels,
  careTrackLabels,
  visitTypeLabels,
  serviceGroupLabels,
  attachmentCategoryLabels,
  addDaysToIso,
  startOfMonthIso,
  endOfMonthIso,
  isValidIsoDate,
  todayIsoDate,
  toPersianDigits,
  defaultDietMeals,
  parseDietMeals,
  dietMealTotals,
  visitModeDefaultLabels,
} from "./lib";
import type { ActivityLevel, Attachment, AttachmentCategory, CareTrack, CareTrackType, Client, ClientProfileBundle, DashboardStats, DietMeal, DietPlan, ExtendedMeasurements, Gender, Goal, NutritionCalculation, Screen, ServiceCatalogItem, ServiceGroup, Settings, VisitDetail, VisitMeasurements, VisitModeOption, VisitService, VisitType } from "./types";
import type { ClientRecord } from "./types";
import BodyAnalysisViewer from "./components/BodyAnalysisViewer";
import ClientTrendChart from "./components/ClientTrendChart";

const defaultSettings: Settings = {
  dietitian_name: "",
  clinic_name: "",
  primary_color: "#31A69D",
  background_color: "#0F5079",
  text_color: "#F5FBF9",
  logo_path: "",
  background_image_path: "",
  username: "admin",
  diet_plan_header_title: "برنامه غذایی اختصاصی",
  diet_plan_footer_text: "این برنامه بر اساس شرایط فردی مراجع تنظیم شده است.",
  diet_plan_margin_mm: 14,
  diet_plan_show_logo: true,
  diet_plan_show_macros: true,
  diet_plan_show_calories: true,
  report_show_contact: true,
  ...defaultCalculationSettings,
};

const dietoyTheme = {
  name: "تم دایتوری",
  primary_color: "#31A69D",
  background_color: "#0F5079",
  text_color: "#F5FBF9",
};

type Toast = { id: number; text: string; kind?: "success" | "error" };
type ToastFn = (text: string, kind?: Toast["kind"]) => void;
type FieldErrors = Partial<Record<"full_name" | "age" | "height_cm" | "weight_kg" | "profile_image_path" | "visit_date" | "visit_time" | "next_visit_date" | "next_visit_time", string>>;
type ProfileTab = "summary" | "tracks" | "visits" | "measurements" | "nutrition" | "files" | "services" | "base";
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
const serviceGroupKeys: ServiceGroup[] = ["diet", "consultation", "body_analysis", "device", "followup", "package", "report", "other"];
const attachmentCategoryKeys: AttachmentCategory[] = ["body_analysis", "lab", "medical_report", "diet_plan", "device", "before_after", "report", "other"];
const visitTypeKeys: VisitType[] = ["initial", "diet_followup", "body_analysis", "device", "consultation", "combined"];
const emptyServiceEditor: ServiceCatalogItem = {
  group_key: "diet",
  name: "",
  description: "",
  default_price: 0,
  default_duration_minutes: null,
  body_area_required: false,
  active: true,
};

const emptyVisitModeEditor: VisitModeOption = {
  key: "",
  name: "",
  active: true,
  description: "",
};

const newClientStartOptions: Array<{ key: VisitType; title: string; description: string }> = [
  { key: "initial", title: "شروع پرونده", description: "اطلاعات پایه، هدف و اولین اندازه‌گیری" },
  { key: "diet_followup", title: "رژیم غذایی", description: "محاسبه انرژی، هدف کالری و پایش وزن" },
  { key: "body_analysis", title: "بادی آنالیز", description: "ثبت ترکیب بدن، دورها و فایل دستگاه" },
  { key: "device", title: "دستگاه", description: "جلسه دستگاه، ناحیه هدف و عکس‌های مرتبط" },
  { key: "combined", title: "ترکیبی", description: "رژیم + بادی آنالیز + خدمات دیگر" },
];

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

const careTrackKeys: CareTrackType[] = ["diet", "body_analysis", "device", "consultation", "combined"];

const careTrackDescriptions: Record<CareTrackType, string> = {
  diet: "رژیم، محاسبات انرژی، برنامه غذایی و پیگیری پایبندی",
  body_analysis: "ترکیب بدن، پرینت دستگاه و روند شاخص‌های بادی آنالیز",
  device: "جلسات لاغری موضعی، ناحیه هدف، اندازه‌های دو سمت بدن و عکس‌های قبل/بعد",
  consultation: "مشاوره تغذیه و سبک زندگی، اهداف رفتاری و پیگیری",
  combined: "نمای یکپارچه از رژیم، بادی آنالیز، دستگاه و خدمات ترکیبی",
};

const trackVisitTypes: Record<CareTrackType, VisitType[]> = {
  diet: ["initial", "diet_followup"],
  body_analysis: ["body_analysis"],
  device: ["device"],
  consultation: ["consultation"],
  combined: ["combined"],
};

const trackServiceGroups: Record<CareTrackType, ServiceGroup[]> = {
  diet: ["diet", "followup"],
  body_analysis: ["body_analysis"],
  device: ["device", "package"],
  consultation: ["consultation", "followup"],
  combined: serviceGroupKeys,
};

const trackAttachmentCategories: Record<CareTrackType, AttachmentCategory[]> = {
  diet: ["diet_plan", "lab", "medical_report"],
  body_analysis: ["body_analysis", "lab"],
  device: ["device", "before_after"],
  consultation: ["medical_report", "report", "other"],
  combined: attachmentCategoryKeys,
};

type MeasurementForm = Record<keyof ExtendedMeasurements, string> & {
  body_fat_percent: string;
  muscle_mass: string;
  visceral_fat: string;
  waist_cm: string;
  abdomen_cm: string;
  hip_cm: string;
  chest_cm: string;
  neck_cm: string;
};

const emptyMeasurementForm: MeasurementForm = {
  body_fat_percent: "",
  muscle_mass: "",
  visceral_fat: "",
  waist_cm: "",
  abdomen_cm: "",
  hip_cm: "",
  chest_cm: "",
  neck_cm: "",
  body_water_percent: "",
  fat_mass_kg: "",
  muscle_percent: "",
  metabolic_age: "",
  device_score: "",
  upper_abdomen_cm: "",
  lower_abdomen_cm: "",
  upper_arm_left_cm: "",
  upper_arm_right_cm: "",
  forearm_left_cm: "",
  forearm_right_cm: "",
  wrist_left_cm: "",
  wrist_right_cm: "",
  thigh_left_cm: "",
  thigh_right_cm: "",
  calf_left_cm: "",
  calf_right_cm: "",
  ankle_left_cm: "",
  ankle_right_cm: "",
};

const extendedMeasurementLabels: Array<{ key: keyof ExtendedMeasurements; label: string; suffix: string }> = [
  { key: "body_water_percent", label: "آب بدن", suffix: "درصد" },
  { key: "fat_mass_kg", label: "توده چربی", suffix: "کیلوگرم" },
  { key: "muscle_percent", label: "درصد عضله", suffix: "درصد" },
  { key: "metabolic_age", label: "سن متابولیک", suffix: "سال" },
  { key: "device_score", label: "امتیاز دستگاه", suffix: "" },
  { key: "upper_abdomen_cm", label: "بالای شکم", suffix: "سانتی‌متر" },
  { key: "lower_abdomen_cm", label: "پایین شکم", suffix: "سانتی‌متر" },
  { key: "upper_arm_left_cm", label: "بازوی چپ", suffix: "سانتی‌متر" },
  { key: "upper_arm_right_cm", label: "بازوی راست", suffix: "سانتی‌متر" },
  { key: "forearm_left_cm", label: "ساعد چپ", suffix: "سانتی‌متر" },
  { key: "forearm_right_cm", label: "ساعد راست", suffix: "سانتی‌متر" },
  { key: "wrist_left_cm", label: "مچ دست چپ", suffix: "سانتی‌متر" },
  { key: "wrist_right_cm", label: "مچ دست راست", suffix: "سانتی‌متر" },
  { key: "thigh_left_cm", label: "ران چپ", suffix: "سانتی‌متر" },
  { key: "thigh_right_cm", label: "ران راست", suffix: "سانتی‌متر" },
  { key: "calf_left_cm", label: "ساق چپ", suffix: "سانتی‌متر" },
  { key: "calf_right_cm", label: "ساق راست", suffix: "سانتی‌متر" },
  { key: "ankle_left_cm", label: "مچ پای چپ", suffix: "سانتی‌متر" },
  { key: "ankle_right_cm", label: "مچ پای راست", suffix: "سانتی‌متر" },
];

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseExtendedMeasurements(value?: string | null): ExtendedMeasurements {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, item]) => [key, Number(item)] as const)
        .filter(([, item]) => Number.isFinite(item)),
    ) as ExtendedMeasurements;
  } catch {
    return {};
  }
}

function serializeExtendedMeasurements(form: MeasurementForm) {
  const entries = extendedMeasurementLabels
    .map(({ key }) => [key, optionalNumber(form[key])] as const)
    .filter(([, value]) => value !== undefined);
  return entries.length ? JSON.stringify(Object.fromEntries(entries)) : undefined;
}

function useOutsideDismiss<T extends HTMLElement>(ref: RefObject<T | null>, open: boolean, onDismiss: () => void) {
  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onDismiss, ref]);
}

function metricDisplay(value?: number) {
  if (value === undefined) return { text: "", isZero: false };
  return { text: value === 0 ? "صفر" : formatNumber(value), isZero: value === 0 };
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

function BrandLogo({ settings, className = "h-12 w-12", full = false }: { settings: Settings; className?: string; full?: boolean }) {
  const [failed, setFailed] = useState(false);
  const custom = settings.logo_path ? assetUrl(settings.logo_path) : "";
  const logo = full ? (custom || "/logo.png") : "/logo-symbol.png";
  useEffect(() => setFailed(false), [logo]);

  if (failed) {
    return <div className={cn("grid place-items-center rounded-control bg-[var(--primary)] text-white shadow-lift", className)}><Leaf size={23} /></div>;
  }
  return (
    <div className={cn("brand-logo-frame grid place-items-center overflow-hidden rounded-control", full && "brand-logo-full", className)}>
      <img src={logo} alt="Dietory" className="h-full w-full object-contain" onError={() => setFailed(true)} />
    </div>
  );
}

function Brand({ settings }: { settings: Settings }) {
  return (
    <div className="flex items-center gap-3">
      <BrandLogo settings={settings} className="h-14 w-14" />
      <div>
        <p className="text-lg font-bold">{settings.clinic_name || "Dietory"}</p>
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
                <BrandLogo settings={settings} className="h-64 w-72 max-w-full" full />
                <p className="mt-5 max-w-sm text-sm leading-8 text-white/85">پرونده‌ها، محاسبات، بادی آنالیز و برنامه‌های غذایی در یک فضای آرام، سریع و خصوصی مدیریت می‌شوند.</p>
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
  const [calendarMode, setCalendarMode] = useState<"today" | "week" | "month" | "exact" | "range" | "all">("today");
  const [exactDate, setExactDate] = useState(todayIsoDate());
  const [rangeStart, setRangeStart] = useState(todayIsoDate());
  const [rangeEnd, setRangeEnd] = useState(addDaysToIso(todayIsoDate(), 7));
  const [dashboardError, setDashboardError] = useState("");

  useEffect(() => {
    if (!isDesktopRuntime()) {
      setStats(emptyDashboardStats);
      return;
    }
    setStats(null);
    setDashboardError("");
    invoke<DashboardStats>("dashboard_stats")
      .then(setStats)
      .catch((error) => {
        setStats(emptyDashboardStats);
        setDashboardError(getErrorMessage(error, "خواندن اطلاعات داشبورد انجام نشد."));
      });
  }, [version]);

  const calendarVisits = useMemo(() => {
    const visits = [...(stats?.upcoming_visits ?? []), ...(stats?.recent_visits ?? [])];
    const unique = new Map<string, DashboardStats["upcoming_visits"][number]>();
    visits.forEach((visit) => unique.set(`${visit.id ?? visit.client_id}-${visit.visit_date}-${visit.visit_time}`, visit));
    const items = Array.from(unique.values());
    const today = todayIsoDate();
    const inRange = (visit: DashboardStats["upcoming_visits"][number]) => {
      if (calendarMode === "all") return true;
      if (calendarMode === "today") return visit.visit_date === today;
      if (calendarMode === "week") return visit.visit_date >= today && visit.visit_date <= addDaysToIso(today, 7);
      if (calendarMode === "month") return visit.visit_date >= startOfMonthIso(today) && visit.visit_date <= endOfMonthIso(today);
      if (calendarMode === "exact") return visit.visit_date === exactDate;
      return visit.visit_date >= rangeStart && visit.visit_date <= rangeEnd;
    };
    return items.filter(inRange).sort((a, b) => `${a.visit_date} ${a.visit_time}`.localeCompare(`${b.visit_date} ${b.visit_time}`)).slice(0, 8);
  }, [stats, calendarMode, exactDate, rangeStart, rangeEnd]);

  const dashboardIsEmpty = Boolean(stats && stats.total_clients === 0 && stats.visits_today === 0 && stats.upcoming_followups === 0);

  return (
    <>
      <PageHeader
        title="داشبورد روزانه"
        subtitle={`امروز ${formatPersianDate()} است. این صفحه فقط کارهای عملیاتی روز را نشان می‌دهد و برای شروع سریع ویزیت طراحی شده است.`}
      />
      {dashboardError && <div className="mb-5"><ErrorSummary message={dashboardError} /></div>}

      <section className="daily-dashboard-grid motion-enter">
        <div className="card daily-hero p-6 md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span className="pill-soft">اقدام سریع</span>
              <h2 className="mt-4 text-2xl font-extrabold">شروع ویزیت بدون شلوغی</h2>
              <p className="mt-3 max-w-xl text-sm leading-8 text-warm-500">دو مسیر اصلی کار کلینیک همین‌جاست: مراجعه‌کننده جدید یا ویزیت برای مراجعه‌کننده قبلی. بقیه اطلاعات در پرونده تو‌در‌تو باز می‌شود.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[420px]">
              <PrimaryButton icon={Plus} onClick={onNew}>ثبت مراجع جدید</PrimaryButton>
              <SecondaryButton icon={Search} onClick={() => document.getElementById("client-search-shortcut")?.focus()}>مراجع قبلی / ویزیت</SecondaryButton>
              <SecondaryButton icon={Calculator} onClick={onCalculator}>محاسبات</SecondaryButton>
              <SecondaryButton icon={CalendarDays} onClick={() => setCalendarMode("today")}>تقویم امروز</SecondaryButton>
            </div>
          </div>
          {dashboardIsEmpty && (
            <div className="mt-6 rounded-card border border-dashed border-warm-200 bg-white/70 p-4">
              <p className="font-bold text-charcoal">هنوز اولین پرونده ساخته نشده است.</p>
              <p className="mt-2 text-sm leading-7 text-warm-500">از «ثبت مراجع جدید» شروع کنید؛ بعد از اولین ویزیت، تقویم و پیگیری‌ها خودکار زنده می‌شوند.</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Stat label="فعال" value={stats?.active_clients} icon={Leaf} hint="پرونده‌های در جریان" />
          <Stat label="همه مراجعین" value={stats?.total_clients} icon={Users} hint="کل پرونده‌ها" />
        </div>
      </section>

      <section className="motion-enter motion-delay-1 mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-extrabold">تقویم مراجعین</h2>
              <p className="mt-2 text-sm leading-7 text-warm-500">وقت‌های موفق، زرد و خالی در اینجا مدیریت می‌شوند. انتخاب تاریخ شمسی، ذخیره داخلی را تغییر نمی‌دهد.</p>
            </div>
            <CalendarDays className="text-sage" size={24} />
          </div>
          <div className="calendar-toolbar">
            {[{ key: "today", label: "امروز" }, { key: "week", label: "این هفته" }, { key: "month", label: "این ماه" }, { key: "exact", label: "تاریخ دقیق" }, { key: "range", label: "بازه دلخواه" }, { key: "all", label: "همه" }].map((item) => (
              <button key={item.key} type="button" onClick={() => setCalendarMode(item.key as typeof calendarMode)} className={cn("filter-chip", calendarMode === item.key && "filter-chip-active")}>{item.label}</button>
            ))}
          </div>
          {calendarMode === "exact" && <div className="mt-4 max-w-xs"><DateField label="تاریخ شمسی" value={exactDate} onChange={setExactDate} /></div>}
          {calendarMode === "range" && <div className="mt-4 grid gap-4 md:grid-cols-2"><DateField label="از تاریخ" value={rangeStart} onChange={setRangeStart} /><DateField label="تا تاریخ" value={rangeEnd} onChange={setRangeEnd} /></div>}
          <div className="mt-5">
            {!stats ? <SkeletonRows /> : calendarVisits.length === 0 ? <EmptyState icon={CalendarDays} title="وقتی در این بازه ثبت نشده" text="برای مراجع جدید یا مراجع قبلی ویزیت ثبت کنید تا اینجا دیده شود." /> : <div className="grid gap-3">{calendarVisits.map((visit) => <DashboardVisitRow key={`${visit.id}-${visit.visit_date}-${visit.visit_time}`} visit={visit} />)}</div>}
          </div>
        </div>

        <div className="grid gap-4">
          <Stat label="ویزیت امروز" value={stats?.visits_today} icon={CalendarCheck} hint="قرارهای امروز" />
          <Stat label="پیگیری آینده" value={stats?.upcoming_followups} icon={Clock3} hint="مراجع نیازمند پیگیری" />
          <Stat label="ویزیت ۷ روز آینده" value={stats?.visits_next_7_days} icon={CalendarDays} hint="برنامه نزدیک" />
        </div>
      </section>

      <section className="motion-enter motion-delay-2 mt-5 grid gap-5 xl:grid-cols-2">
        <div className="card p-6">
          <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-extrabold">مراجعین اخیر</h2><Users className="text-sage" size={22} /></div>
          {!stats ? <SkeletonRows /> : stats.recent_clients.length === 0 ? <EmptyState icon={Users} title="هنوز مراجعی ثبت نشده" text="اولین پرونده را بسازید؛ این بخش آخرین پرونده‌ها را نشان می‌دهد." /> : <div className="grid gap-3">{stats.recent_clients.slice(0, 4).map((client) => <ClientRow key={client.id} client={client} onEdit={() => onEdit(client)} />)}</div>}
        </div>
        <div className="card p-6">
          <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-extrabold">نقشه کار مراجع</h2><Target className="text-sage" size={22} /></div>
          <div className="workflow-map">
            <div><strong>۱. شخص</strong><span>اطلاعات پایه و تماس</span></div>
            <div><strong>۲. مسیر مراقبت</strong><span>رژیم، بادی آنالیز، دستگاه یا ترکیبی</span></div>
            <div><strong>۳. ویزیت</strong><span>اندازه‌گیری، خدمات، فایل و یادداشت</span></div>
            <div><strong>۴. پیگیری</strong><span>روند، گزارش و ویزیت بعدی</span></div>
          </div>
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
        <div className="rounded-control bg-warm-50 px-3 py-2 text-xs font-bold text-olive">
          {visitTypeLabels[(visit.visit_type ?? "initial") as VisitType] ?? "ویزیت"}
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
  const [mode, setMode] = useState<"new" | "returning">("returning");

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
      <PageHeader title="مراجعین" subtitle="دو مسیر کاری استاندارد: مراجع جدید یا ویزیت برای مراجع قبلی. پرونده‌ها مرحله‌ای و تو‌در‌تو مدیریت می‌شوند." action={<PrimaryButton icon={Plus} onClick={onNew}>مراجع جدید</PrimaryButton>} />

      <section className="client-workspace-grid">
        <button type="button" onClick={() => { setMode("new"); onNew(); }} className={cn("workspace-choice", mode === "new" && "workspace-choice-active")}>
          <span className="choice-icon"><Plus size={22} /></span>
          <strong>مراجع جدید</strong>
          <small>ثبت اطلاعات پایه، انتخاب نوع شروع، ساخت پرونده و فولدر مراجع</small>
        </button>
        <button type="button" onClick={() => setMode("returning")} className={cn("workspace-choice", mode === "returning" && "workspace-choice-active")}>
          <span className="choice-icon"><Users size={22} /></span>
          <strong>مراجع قبلی</strong>
          <small>جست‌وجو، مشاهده خلاصه پرونده، شروع ویزیت جدید یا محاسبات</small>
        </button>
      </section>

      <section className="card mt-5 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-warm-500" size={20} />
            <input id="client-search-shortcut" className="control w-full pr-12" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی مراجع قبلی: نام، موبایل، ایمیل یا هدف" />
          </div>
          <label className="flex h-12 items-center gap-2 rounded-control border border-warm-100 bg-warm-50 px-4 text-sm text-warm-500">
            <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
            نمایش بایگانی
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {Object.entries(clientGoalFilters).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setGoalFilter(key as ClientGoalFilter)} className={cn("filter-chip", goalFilter === key && "filter-chip-active")}>{label}</button>
          ))}
          <span className="numbers mr-auto rounded-full bg-warm-50 px-3 py-2 text-xs font-bold text-warm-500">{clients ? `${toPersianDigits(visibleCount)} از ${toPersianDigits(totalCount)} مراجع` : "در حال خواندن"}</span>
        </div>
        <div className="mt-5 grid gap-3">
          {!clients ? <SkeletonRows /> : filtered.length === 0 ? <EmptyState icon={Search} title="موردی پیدا نشد" text={query || goalFilter !== "all" ? "فیلتر هدف یا عبارت جست‌وجو را تغییر دهید." : "برای شروع، اولین پرونده را ثبت کنید."} /> : filtered.map((client) => (
            <ClientRow key={client.id} client={client} onEdit={() => onEdit(client)} onCalculate={() => onCalculate(client)} onArchive={() => archive(client)} />
          ))}
        </div>
      </section>
    </>
  );
}

function createDietPlanDraft(clientId: number, calculation?: NutritionCalculation | null): DietPlan {
  return {
    client_id: clientId,
    visit_id: null,
    calculation_id: calculation?.id ?? null,
    title: "برنامه غذایی اختصاصی",
    plan_date: todayIsoDate(),
    status: "draft",
    calories_target: calculation?.target_calories ?? 0,
    protein_target_g: calculation?.protein_g ?? 0,
    carb_target_g: calculation?.carb_g ?? 0,
    fat_target_g: calculation?.fat_g ?? 0,
    meals_json: JSON.stringify(defaultDietMeals.map((meal) => ({ ...meal, items: [] }))),
    hydration_text: "روزانه آب کافی در فاصله وعده‌ها مصرف شود.",
    activity_text: "فعالیت بدنی مطابق شرایط و توصیه متخصص انجام شود.",
    guidance_text: "وعده‌ها در زمان منظم مصرف شوند و مقادیر نوشته‌شده رعایت شود.",
    notes: "",
  };
}

function makeDietItem() {
  return { id: `food-${Date.now()}-${Math.random().toString(16).slice(2)}`, title: "", amount: "", calories: 0, protein_g: 0, carb_g: 0, fat_g: 0, notes: "" };
}

function ClientProfileForm({ client, onBack, onSaved, toast }: { client: Client | null; onBack: () => void; onSaved: (client: Client) => void; toast: ToastFn }) {
  const [form, setForm] = useState<Client>(client ?? { ...emptyClient });
  const [records, setRecords] = useState<ClientRecord[]>([]);
  const [visits, setVisits] = useState<VisitDetail[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [serviceCatalog, setServiceCatalog] = useState<ServiceCatalogItem[]>([]);
  const [visitModes, setVisitModes] = useState<VisitModeOption[]>([]);
  const [nutritionCalculations, setNutritionCalculations] = useState<NutritionCalculation[]>([]);
  const [dietPlans, setDietPlans] = useState<DietPlan[]>([]);
  const [careTracks, setCareTracks] = useState<CareTrack[]>([]);
  const [targetWeightDraft, setTargetWeightDraft] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState("");
  const [profileReloadVersion, setProfileReloadVersion] = useState(0);
  const [profileCalcOverrides, setProfileCalcOverrides] = useState({ calorieAdjustmentPercent: "", proteinPercent: "", carbsPercent: "", fatPercent: "" });
  const [dietPlanDraft, setDietPlanDraft] = useState<DietPlan | null>(null);
  const [dietMealOpen, setDietMealOpen] = useState<string>("breakfast");
  const [visitServices, setVisitServices] = useState<Record<number, VisitService[]>>({});
  const [activeTab, setActiveTab] = useState<ProfileTab>(client ? "summary" : "base");
  const [activeTrack, setActiveTrack] = useState<CareTrackType>("diet");
  const [measurementTab, setMeasurementTab] = useState<"general" | "composition" | "regional">("general");
  const [measurementForm, setMeasurementForm] = useState<MeasurementForm>({ ...emptyMeasurementForm });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [topError, setTopError] = useState("");
  const [serviceForm, setServiceForm] = useState({ groupKey: "diet" as ServiceGroup, visitId: "", catalogId: "", quantity: 1, price: 0, body_area: "", device_name: "", notes: "" });
  const [attachmentForm, setAttachmentForm] = useState({ category: "other" as AttachmentCategory, title: "", notes: "" });
  const [visitForm, setVisitForm] = useState({
    visit_date: todayIsoDate(),
    visit_time: "",
    track_id: null as number | null,
    status: "completed",
    visit_type: "initial" as VisitType,
    visit_mode_key: "in_person",
    visit_mode_name_snapshot: "حضوری",
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
      track_id: null as number | null,
      status: "completed",
      visit_type: "initial" as VisitType,
      visit_mode_key: visitModes.find((item) => item.active)?.key ?? "in_person",
      visit_mode_name_snapshot: visitModes.find((item) => item.active)?.name ?? "حضوری",
      reason: "",
      weight_kg: source?.weight_kg ?? emptyClient.weight_kg,
      height_cm: source?.height_cm ?? emptyClient.height_cm,
      notes: "",
      next_visit_enabled: false,
      next_visit_date: "",
      next_visit_time: "",
      next_visit_status: "scheduled",
    });
    setMeasurementForm({ ...emptyMeasurementForm });
    setMeasurementTab("general");
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
      setVisitModes([]);
      setNutritionCalculations([]);
      setDietPlans([]);
      setCareTracks([]);
      setProfileLoadError("");
      setDietPlanDraft(null);
      setVisitServices({});
      return;
    }

    let cancelled = false;
    setProfileLoading(true);
    setProfileLoadError("");

    const loadProfile = async () => {
      try {
        const [bundle, catalog, modes] = await Promise.all([
          invoke<ClientProfileBundle>("get_client_profile_bundle", { clientId: client.id }),
          invoke<ServiceCatalogItem[]>("list_service_catalog", { activeOnly: true }),
          invoke<VisitModeOption[]>("list_visit_modes", { activeOnly: true }),
        ]);
        if (cancelled) return;

        const visitDetails: VisitDetail[] = bundle.visits.map((item) => ({ visit: item.visit, measurements: item.measurements }));
        setVisits(visitDetails);
        setAttachments(bundle.attachments);
        setNutritionCalculations(bundle.nutrition_calculations);
        setDietPlans(bundle.diet_plans);
        setDietPlanDraft(bundle.diet_plans[0] ?? null);
        setCareTracks(bundle.care_tracks);
        const dietTrack = bundle.care_tracks.find((track) => track.track_type === "diet" && track.status !== "completed") ?? bundle.care_tracks.find((track) => track.track_type === "diet");
        setTargetWeightDraft(dietTrack?.target_weight ? String(dietTrack.target_weight) : "");
        setVisitServices(Object.fromEntries(bundle.visits.filter((item) => item.visit.id).map((item) => [item.visit.id!, item.services])));
        setServiceCatalog(catalog);
        setVisitModes(modes.length ? modes : [{ key: "in_person", name: "حضوری", active: true }, { key: "online", name: "آنلاین", active: true }]);

        const latestItem = visitDetails[visitDetails.length - 1];
        setServiceForm((current) => {
          const preferred = catalog.find((item) => (item.group_key ?? "other") === current.groupKey) ?? catalog[0];
          return {
            ...current,
            visitId: current.visitId || String(latestItem?.visit.id ?? ""),
            groupKey: (preferred?.group_key ?? current.groupKey) as ServiceGroup,
            catalogId: preferred?.id ? String(preferred.id) : "",
            price: preferred?.default_price ?? current.price,
          };
        });

        setRecords(visitDetails.filter((item) => item.measurements?.weight_kg).map((item) => ({
          id: item.measurements?.id,
          client_id: client.id!,
          record_date: item.visit.visit_date,
          weight_kg: item.measurements?.weight_kg ?? client.weight_kg,
          height_cm: item.measurements?.height_cm ?? client.height_cm,
          notes: item.measurements?.notes || item.visit.clinical_notes,
          created_at: item.visit.created_at,
          updated_at: item.visit.updated_at,
        })));

        const latestCalculation = bundle.nutrition_calculations[0];
        setProfileCalcOverrides(latestCalculation ? {
          calorieAdjustmentPercent: String(latestCalculation.calorie_adjustment_percent || ""),
          proteinPercent: String(latestCalculation.protein_percent),
          carbsPercent: String(latestCalculation.carb_percent),
          fatPercent: String(latestCalculation.fat_percent),
        } : { calorieAdjustmentPercent: "", proteinPercent: "", carbsPercent: "", fatPercent: "" });
      } catch (error) {
        if (!cancelled) setProfileLoadError(getErrorMessage(error, "خواندن کامل پرونده انجام نشد."));
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    };

    loadProfile();
    return () => { cancelled = true; };
  }, [client?.id, profileReloadVersion]);

  useEffect(() => {
    if (visitForm.visit_type === "body_analysis") setMeasurementTab("composition");
    else if (visitForm.visit_type === "device") setMeasurementTab("regional");
    else if (["initial", "diet_followup", "consultation"].includes(visitForm.visit_type)) setMeasurementTab("general");
  }, [visitForm.visit_type]);

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
    const normalizedVisitDate = coerceDateToIso(visitForm.visit_date);
    const normalizedNextDate = coerceDateToIso(visitForm.next_visit_date);
    if (!normalizedVisitDate) nextErrors.visit_date = "یک تاریخ شمسی معتبر را از تقویم انتخاب کنید.";
    if (visitForm.visit_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(visitForm.visit_time)) nextErrors.visit_time = "ساعت ویزیت باید با قالب HH:mm باشد.";
    if (!Number.isFinite(visitForm.weight_kg) || visitForm.weight_kg < 1 || visitForm.weight_kg > 400) nextErrors.weight_kg = "وزن ویزیت باید عددی بین ۱ تا ۴۰۰ کیلوگرم باشد.";
    if (!Number.isFinite(visitForm.height_cm) || visitForm.height_cm < 40 || visitForm.height_cm > 250) nextErrors.height_cm = "قد ویزیت باید عددی بین ۴۰ تا ۲۵۰ سانتی‌متر باشد.";
    if (visitForm.next_visit_enabled && !normalizedNextDate) nextErrors.next_visit_date = "برای مراجعه بعدی یک تاریخ شمسی معتبر انتخاب کنید.";
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
            track_id: visitForm.track_id,
            visit_date: todayIsoDate(),
            visit_time: "",
            status: "completed",
            visit_type: visitForm.visit_type,
            visit_mode_key: visitForm.visit_mode_key,
            visit_mode_name_snapshot: visitForm.visit_mode_name_snapshot,
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
          track_id: visitForm.track_id,
          visit_date: coerceDateToIso(visitForm.visit_date),
          visit_time: visitForm.visit_time,
          status: visitForm.status,
          visit_type: visitForm.visit_type,
          visit_mode_key: visitForm.visit_mode_key,
          visit_mode_name_snapshot: visitForm.visit_mode_name_snapshot,
          reason: visitForm.reason,
          clinical_notes: visitForm.notes,
          private_notes: "",
          next_visit_enabled: visitForm.next_visit_enabled,
          next_visit_date: visitForm.next_visit_enabled ? coerceDateToIso(visitForm.next_visit_date) : "",
          next_visit_time: visitForm.next_visit_enabled ? visitForm.next_visit_time : "",
          next_visit_status: visitForm.next_visit_enabled ? visitForm.next_visit_status : "",
          total_fee: 0,
        },
        measurements: {
          weight_kg: visitForm.weight_kg,
          height_cm: visitForm.height_cm,
          body_fat_percent: optionalNumber(measurementForm.body_fat_percent),
          muscle_mass: optionalNumber(measurementForm.muscle_mass),
          visceral_fat: optionalNumber(measurementForm.visceral_fat),
          waist_cm: optionalNumber(measurementForm.waist_cm),
          abdomen_cm: optionalNumber(measurementForm.abdomen_cm),
          hip_cm: optionalNumber(measurementForm.hip_cm),
          chest_cm: optionalNumber(measurementForm.chest_cm),
          neck_cm: optionalNumber(measurementForm.neck_cm),
          custom_measurements_json: serializeExtendedMeasurements(measurementForm),
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
      setActiveTab("services");
      setProfileReloadVersion((value) => value + 1);
      toast("ویزیت ثبت شد؛ اکنون می‌توانید یک یا چند خدمت به آن اضافه کنید.");
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
        category: attachmentForm.category,
        title: attachmentForm.title,
        attachmentDate: todayIsoDate(),
        notes: attachmentForm.notes,
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


  const filteredServiceCatalog = serviceCatalog.filter((item) => (item.group_key ?? "other") === serviceForm.groupKey && item.active !== false);
  const selectedCatalogItem = serviceCatalog.find((entry) => String(entry.id ?? "") === serviceForm.catalogId);

  const selectServiceGroup = (groupKey: ServiceGroup) => {
    const first = serviceCatalog.find((item) => (item.group_key ?? "other") === groupKey && item.active !== false);
    setServiceForm((current) => ({
      ...current,
      groupKey,
      catalogId: first?.id ? String(first.id) : "",
      price: first?.default_price ?? 0,
      body_area: "",
      device_name: "",
    }));
  };

  const selectCatalogItem = (catalogId: string) => {
    const item = serviceCatalog.find((entry) => String(entry.id ?? "") === catalogId);
    setServiceForm((current) => ({
      ...current,
      catalogId,
      groupKey: (item?.group_key ?? current.groupKey) as ServiceGroup,
      price: item?.default_price ?? current.price,
      body_area: item?.body_area_required ? current.body_area : "",
    }));
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
          service_group_snapshot: catalogItem.group_key ?? "other",
          body_area: serviceForm.body_area,
          device_name: serviceForm.device_name,
          duration_minutes: catalogItem.default_duration_minutes ?? null,
          price,
          quantity,
          total: price * quantity,
          notes: serviceForm.notes,
        },
      });
      setVisitServices((current) => ({ ...current, [visitId]: [...(current[visitId] ?? []), saved] }));
      setServiceForm((current) => ({ ...current, body_area: "", device_name: "", notes: "" }));
      toast("خدمت برای ویزیت ثبت شد.");
    } catch (error) {
      toast(getErrorMessage(error, "ثبت خدمت انجام نشد."), "error");
    }
  };

  const baseProfileCalculation = calculateNutrition(form);
  const profileCalorieAdjustmentPercent = Number(profileCalcOverrides.calorieAdjustmentPercent) || 0;
  const profileCalories = Math.max(0, baseProfileCalculation.targetCalories * (1 + profileCalorieAdjustmentPercent / 100));
  const profileProteinPercent = profileCalcOverrides.proteinPercent === "" ? baseProfileCalculation.proteinPercent : Number(profileCalcOverrides.proteinPercent);
  const profileCarbPercent = profileCalcOverrides.carbsPercent === "" ? baseProfileCalculation.carbsPercent : Number(profileCalcOverrides.carbsPercent);
  const profileFatPercent = profileCalcOverrides.fatPercent === "" ? baseProfileCalculation.fatPercent : Number(profileCalcOverrides.fatPercent);
  const profileMacroTotal = profileProteinPercent + profileCarbPercent + profileFatPercent;
  const profileProteinG = profileCalories * profileProteinPercent / 100 / 4;
  const profileCarbG = profileCalories * profileCarbPercent / 100 / 4;
  const profileFatG = profileCalories * profileFatPercent / 100 / 9;
  const latestNutritionCalculation = nutritionCalculations[0] ?? null;
  const effectiveDietPlan = dietPlanDraft ?? (client?.id ? createDietPlanDraft(client.id, latestNutritionCalculation) : null);
  const dietMeals = parseDietMeals(effectiveDietPlan?.meals_json);
  const dietTotals = dietMealTotals(dietMeals);
  const latestBodyAnalysisFile = attachments.find((item) => item.category === "body_analysis") ?? null;
  const latestBodyAnalysisVisit = [...visits].reverse().find((item) => item.measurements?.body_fat_percent || item.measurements?.muscle_mass || item.measurements?.visceral_fat) ?? null;

  const ensureCareTrack = async (trackType: CareTrackType): Promise<CareTrack | null> => {
    if (!client?.id) return null;
    const existing = careTracks.find((item) => item.track_type === trackType && item.status !== "completed");
    if (existing) return existing;
    try {
      const saved = await invoke<CareTrack>("save_care_track", {
        item: {
          client_id: client.id,
          track_type: trackType,
          goal: form.goal,
          title: careTrackLabels[trackType],
          start_date: todayIsoDate(),
          status: "active",
          target_weight: null,
          notes: "",
        },
      });
      setCareTracks((items) => [...items, saved]);
      return saved;
    } catch (error) {
      toast(getErrorMessage(error, "ساخت مسیر مراقبت انجام نشد."), "error");
      return null;
    }
  };

  const saveDietTargetWeight = async () => {
    const track = await ensureCareTrack("diet");
    if (!track) return;
    const parsed = targetWeightDraft.trim() ? Number(targetWeightDraft) : null;
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 20 || parsed > 400)) {
      toast("وزن هدف باید بین ۲۰ تا ۴۰۰ کیلوگرم باشد.", "error");
      return;
    }
    try {
      const saved = await invoke<CareTrack>("save_care_track", { item: { ...track, target_weight: parsed } });
      setCareTracks((items) => items.map((item) => item.id === saved.id ? saved : item));
      toast(parsed ? "وزن هدف مسیر رژیم ذخیره شد." : "وزن هدف حذف شد.");
    } catch (error) {
      toast(getErrorMessage(error, "ذخیره وزن هدف انجام نشد."), "error");
    }
  };

  const saveProfileCalculation = async () => {
    if (!client?.id) return;
    if (Math.abs(profileMacroTotal - 100) > 0.2) { toast("جمع درصد ماکروها باید ۱۰۰٪ باشد.", "error"); return; }
    try {
      const item: NutritionCalculation = {
        id: latestNutritionCalculation?.id,
        client_id: client.id,
        visit_id: latestNutritionCalculation?.visit_id ?? null,
        track_id: careTracks.find((track) => track.track_type === "diet")?.id ?? null,
        calculated_at: todayIsoDate(),
        gender: form.gender, age: form.age, height_cm: form.height_cm, weight_kg: form.weight_kg,
        activity_level: form.activity_level, goal: form.goal,
        bmi: baseProfileCalculation.bmi, ibw: baseProfileCalculation.ibw, abw: baseProfileCalculation.abw,
        bmr: baseProfileCalculation.bmr, tee: baseProfileCalculation.tee, target_calories: profileCalories,
        calorie_adjustment_percent: profileCalorieAdjustmentPercent,
        protein_percent: profileProteinPercent, carb_percent: profileCarbPercent, fat_percent: profileFatPercent,
        protein_g: profileProteinG, carb_g: profileCarbG, fat_g: profileFatG,
        notes: latestNutritionCalculation?.notes ?? "",
      };
      const saved = await invoke<NutritionCalculation>("save_nutrition_calculation", { item });
      setNutritionCalculations((items) => [saved, ...items.filter((entry) => entry.id !== saved.id)]);
      if (!dietPlanDraft && client.id) setDietPlanDraft(createDietPlanDraft(client.id, saved));
      else if (dietPlanDraft) setDietPlanDraft({ ...dietPlanDraft, calculation_id: saved.id, calories_target: saved.target_calories, protein_target_g: saved.protein_g, carb_target_g: saved.carb_g, fat_target_g: saved.fat_g });
      toast("محاسبات در خلاصه پرونده و مسیر رژیم ذخیره شد.");
    } catch (error) { toast(getErrorMessage(error, "ذخیره محاسبات انجام نشد."), "error"); }
  };

  const setDietMeals = (next: DietMeal[]) => {
    if (!client?.id) return;
    const base = effectiveDietPlan ?? createDietPlanDraft(client.id, latestNutritionCalculation);
    setDietPlanDraft({ ...base, meals_json: JSON.stringify(next) });
  };
  const updateMeal = (mealId: string, patch: Partial<DietMeal>) => setDietMeals(dietMeals.map((meal) => meal.id === mealId ? { ...meal, ...patch } : meal));
  const addDietItem = (mealId: string) => setDietMeals(dietMeals.map((meal) => meal.id === mealId ? { ...meal, items: [...meal.items, makeDietItem()] } : meal));
  const updateDietItem = (mealId: string, itemId: string, patch: Record<string, string | number>) => setDietMeals(dietMeals.map((meal) => meal.id === mealId ? {
    ...meal,
    items: meal.items.map((item) => {
      if (item.id !== itemId) return item;
      const next = { ...item, ...patch };
      if ("protein_g" in patch || "carb_g" in patch || "fat_g" in patch) {
        next.calories = Math.round((Number(next.protein_g) || 0) * 4 + (Number(next.carb_g) || 0) * 4 + (Number(next.fat_g) || 0) * 9);
      }
      return next;
    }),
  } : meal));
  const removeDietItem = (mealId: string, itemId: string) => setDietMeals(dietMeals.map((meal) => meal.id === mealId ? { ...meal, items: meal.items.filter((item) => item.id !== itemId) } : meal));
  const syncDietTargets = () => {
    if (!client?.id) return;
    const calculation = latestNutritionCalculation;
    if (!calculation) { toast("ابتدا محاسبات تغذیه را ذخیره کنید.", "error"); return; }
    const base = effectiveDietPlan ?? createDietPlanDraft(client.id, calculation);
    setDietPlanDraft({ ...base, calculation_id: calculation.id, calories_target: calculation.target_calories, protein_target_g: calculation.protein_g, carb_target_g: calculation.carb_g, fat_target_g: calculation.fat_g });
    toast("اهداف برنامه غذایی از آخرین محاسبات بازیابی شد.");
  };
  const saveDietPlan = async (): Promise<DietPlan | null> => {
    if (!client?.id || !effectiveDietPlan) return null;
    try {
      const saved = await invoke<DietPlan>("save_diet_plan", { plan: { ...effectiveDietPlan, client_id: client.id, track_id: careTracks.find((track) => track.track_type === "diet")?.id ?? null, meals_json: JSON.stringify(dietMeals) } });
      setDietPlanDraft(saved);
      setDietPlans((items) => [saved, ...items.filter((entry) => entry.id !== saved.id)]);
      toast("برنامه غذایی ذخیره شد.");
      return saved;
    } catch (error) {
      toast(getErrorMessage(error, "ذخیره برنامه غذایی انجام نشد."), "error");
      return null;
    }
  };
  const exportDietPlan = async () => {
    let plan = effectiveDietPlan;
    if (!plan?.id) plan = await saveDietPlan();
    if (!plan?.id) return;
    try { await invoke<string>("export_diet_plan", { planId: plan.id }); toast("نسخه چاپی برنامه غذایی ساخته و باز شد."); }
    catch (error) { toast(getErrorMessage(error, "خروجی برنامه غذایی ساخته نشد."), "error"); }
  };
  const deleteVisitService = async (service: VisitService) => {
    if (!service.id) return;
    try {
      await invoke("delete_visit_service", { id: service.id });
      setVisitServices((current) => ({ ...current, [service.visit_id]: (current[service.visit_id] ?? []).filter((item) => item.id !== service.id) }));
      toast("خدمت از این ویزیت حذف شد.");
    } catch (error) { toast(getErrorMessage(error, "حذف خدمت انجام نشد."), "error"); }
  };

  const latestRecord = records.length ? records[records.length - 1] : undefined;
  const previousRecord = records.length > 1 ? records[records.length - 2] : undefined;
  const weightDelta = latestRecord && previousRecord ? latestRecord.weight_kg - previousRecord.weight_kg : null;
  const latestVisit = visits.length ? visits[visits.length - 1] : undefined;
  const latestBmi = latestRecord ? latestRecord.weight_kg / Math.pow(latestRecord.height_cm / 100, 2) : null;
  const setMeasurementValue = (key: keyof MeasurementForm, value: string) => setMeasurementForm((current) => ({ ...current, [key]: value }));

  const baseInfo = (
    <div className="grid gap-5 md:grid-cols-2">
      {!client?.id && (
        <div className="md:col-span-2 rounded-card border border-warm-100 bg-white p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold text-olive">نوع شروع پرونده</p>
              <p className="helper mt-1">اول مشخص کنید مراجع برای چه مسیری آمده؛ فرم‌ها و ویزیت‌های بعدی بر همین اساس ساده‌تر مدیریت می‌شوند.</p>
            </div>
            <span className="pill-soft">progressive</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {newClientStartOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setVisitForm((current) => ({ ...current, visit_type: option.key, reason: option.title }))}
                className={cn("start-option-card", visitForm.visit_type === option.key && "start-option-card-active")}
              >
                <strong>{option.title}</strong>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        </div>
      )}
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
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-card border border-warm-100 bg-warm-50 p-5 motion-enter">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={21} className="text-sage" />
            <h2 className="text-lg font-bold">ثبت ویزیت</h2>
          </div>
          <span className="pill-soft">{visitTypeLabels[visitForm.visit_type]}</span>
        </div>
        <p className="helper mt-2">ابتدا اطلاعات ضروری را ثبت کنید؛ اندازه‌گیری‌های تخصصی فقط در زیربخش مرتبط باز می‌شوند.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <DateField label="تاریخ ویزیت" value={visitForm.visit_date} onChange={(value) => { setVisitForm({ ...visitForm, visit_date: value }); setErrors((current) => ({ ...current, visit_date: undefined })); }} error={errors.visit_date} />
          <TimeField label="ساعت" value={visitForm.visit_time} onChange={(value) => { setVisitForm({ ...visitForm, visit_time: value }); setErrors((current) => ({ ...current, visit_time: undefined })); }} error={errors.visit_time} />
          <SelectField label="نوع ویزیت" value={visitForm.visit_type} onChange={(value) => setVisitForm({ ...visitForm, visit_type: value as VisitType })} options={visitTypeLabels} />
          <SelectField label="شیوه ویزیت" value={visitForm.visit_mode_key} onChange={(value) => { const selectedMode = visitModes.find((item) => item.key === value); setVisitForm({ ...visitForm, visit_mode_key: value, visit_mode_name_snapshot: selectedMode?.name ?? visitModeDefaultLabels[value] ?? value }); }} options={Object.fromEntries((visitModes.length ? visitModes : [{ key: "in_person", name: "حضوری" }, { key: "online", name: "آنلاین" }]).map((item) => [item.key, item.name]))} />
          <SelectField label="وضعیت" value={visitForm.status} onChange={(value) => setVisitForm({ ...visitForm, status: value })} options={{ completed: "انجام شد", scheduled: "برنامه‌ریزی شده", canceled: "لغو شد" }} />
          <TextField label="دلیل مراجعه" value={visitForm.reason} onChange={(value) => setVisitForm({ ...visitForm, reason: value })} />
          <div />
          <NumberField label="وزن" value={visitForm.weight_kg} onChange={(value) => setVisitForm({ ...visitForm, weight_kg: value })} suffix="کیلوگرم" error={errors.weight_kg} />
          <NumberField label="قد" value={visitForm.height_cm} onChange={(value) => setVisitForm({ ...visitForm, height_cm: value })} suffix="سانتی‌متر" error={errors.height_cm} />
        </div>

        <div className="mt-5 rounded-card border border-warm-100 bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">اندازه‌گیری‌های همین ویزیت</p>
              <p className="helper mt-1">فقط داده‌های لازم را وارد کنید؛ فیلدهای خالی در گزارش نمایش داده نمی‌شوند.</p>
            </div>
            <Ruler size={22} className="text-sage" />
          </div>
          <div className="nested-tab-rail">
            <button type="button" onClick={() => setMeasurementTab("general")} className={cn("nested-tab", measurementTab === "general" && "nested-tab-active")}>عمومی</button>
            <button type="button" onClick={() => setMeasurementTab("composition")} className={cn("nested-tab", measurementTab === "composition" && "nested-tab-active")}>ترکیب بدن</button>
            <button type="button" onClick={() => setMeasurementTab("regional")} className={cn("nested-tab", measurementTab === "regional" && "nested-tab-active")}>اندام و موضعی</button>
          </div>
          {measurementTab === "general" && (
            <div className="measurement-grid mt-4">
              <OptionalNumberField label="دور کمر" value={measurementForm.waist_cm} onChange={(value) => setMeasurementValue("waist_cm", value)} suffix="سانتی‌متر" />
              <OptionalNumberField label="دور شکم" value={measurementForm.abdomen_cm} onChange={(value) => setMeasurementValue("abdomen_cm", value)} suffix="سانتی‌متر" />
              <OptionalNumberField label="دور باسن" value={measurementForm.hip_cm} onChange={(value) => setMeasurementValue("hip_cm", value)} suffix="سانتی‌متر" />
              <OptionalNumberField label="دور سینه" value={measurementForm.chest_cm} onChange={(value) => setMeasurementValue("chest_cm", value)} suffix="سانتی‌متر" />
              <OptionalNumberField label="دور گردن" value={measurementForm.neck_cm} onChange={(value) => setMeasurementValue("neck_cm", value)} suffix="سانتی‌متر" />
            </div>
          )}
          {measurementTab === "composition" && (
            <div className="measurement-grid mt-4">
              <OptionalNumberField label="درصد چربی" value={measurementForm.body_fat_percent} onChange={(value) => setMeasurementValue("body_fat_percent", value)} suffix="درصد" max={100} />
              <OptionalNumberField label="توده عضله" value={measurementForm.muscle_mass} onChange={(value) => setMeasurementValue("muscle_mass", value)} suffix="کیلوگرم" />
              <OptionalNumberField label="چربی احشایی" value={measurementForm.visceral_fat} onChange={(value) => setMeasurementValue("visceral_fat", value)} suffix="سطح" />
              <OptionalNumberField label="آب بدن" value={measurementForm.body_water_percent} onChange={(value) => setMeasurementValue("body_water_percent", value)} suffix="درصد" max={100} />
              <OptionalNumberField label="توده چربی" value={measurementForm.fat_mass_kg} onChange={(value) => setMeasurementValue("fat_mass_kg", value)} suffix="کیلوگرم" />
              <OptionalNumberField label="درصد عضله" value={measurementForm.muscle_percent} onChange={(value) => setMeasurementValue("muscle_percent", value)} suffix="درصد" max={100} />
              <OptionalNumberField label="سن متابولیک" value={measurementForm.metabolic_age} onChange={(value) => setMeasurementValue("metabolic_age", value)} suffix="سال" max={150} />
              <OptionalNumberField label="امتیاز دستگاه" value={measurementForm.device_score} onChange={(value) => setMeasurementValue("device_score", value)} suffix="" />
            </div>
          )}
          {measurementTab === "regional" && (
            <div className="measurement-grid mt-4">
              {extendedMeasurementLabels.filter(({ key }) => !["body_water_percent", "fat_mass_kg", "muscle_percent", "metabolic_age", "device_score"].includes(key)).map(({ key, label, suffix }) => (
                <OptionalNumberField key={key} label={label} value={measurementForm[key]} onChange={(value) => setMeasurementValue(key, value)} suffix={suffix} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 rounded-control border border-warm-100 bg-white p-4">
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
        <div className="mt-4">
          <label className="label">یادداشت ویزیت</label>
          <textarea className="control mt-2 min-h-24 w-full py-3" value={visitForm.notes} onChange={(event) => setVisitForm({ ...visitForm, notes: event.target.value })} />
        </div>
        <div className="mt-5"><PrimaryButton icon={Plus} onClick={saveVisit}>ثبت ویزیت</PrimaryButton></div>
      </div>

      <div className="rounded-card border border-warm-100 bg-white p-5 motion-enter motion-delay-1">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><CalendarDays size={21} className="text-sage" /><h2 className="text-lg font-bold">تاریخچه ویزیت‌ها</h2></div>
          <span className="text-xs text-warm-500">{formatNumber(visits.length || records.length)} ویزیت</span>
        </div>
        {records.length === 0 ? <EmptyState icon={CalendarDays} title="هنوز ویزیتی ثبت نشده" text="اولین ویزیت را از فرم کنار صفحه ثبت کنید." /> : (
          <>
            <WeightHistory records={records} />
            <div className="mt-5 grid gap-3">
              {visits.slice().reverse().map((item) => {
                const services = item.visit.id ? visitServices[item.visit.id] ?? [] : [];
                const extended = parseExtendedMeasurements(item.measurements?.custom_measurements_json);
                const enteredMeasurements = [item.measurements?.body_fat_percent, item.measurements?.waist_cm, ...Object.values(extended)].filter((value) => value !== undefined && value !== null).length;
                return (
                  <div key={item.visit.id ?? item.visit.visit_date} className="visit-timeline-card">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-sm font-bold">{formatPersianDate(item.visit.visit_date)}</span>
                        <span className="mr-2 text-xs text-warm-500">{visitTypeLabels[(item.visit.visit_type ?? "initial") as VisitType] ?? "ویزیت"}</span>
                      </div>
                      <span className="pill-soft">{visitStatusLabels[item.visit.status] ?? item.visit.status}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-warm-500">
                      <span>{formatNumber(services.length)} خدمت</span>
                      <span>·</span>
                      <span>{formatNumber(enteredMeasurements)} شاخص تکمیلی</span>
                      {item.measurements?.weight_kg ? <><span>·</span><span>{formatNumber(item.measurements.weight_kg, 1)} کیلوگرم</span></> : null}
                    </div>
                    {item.visit.clinical_notes && <p className="mt-3 text-xs leading-6 text-warm-500">{item.visit.clinical_notes}</p>}
                    {services.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{services.map((service) => <span key={service.id ?? service.service_name_snapshot} className="service-mini-pill">{service.service_name_snapshot}</span>)}</div>}
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
          <SelectField label="دسته فایل" value={attachmentForm.category} onChange={(value) => setAttachmentForm({ ...attachmentForm, category: value as AttachmentCategory })} options={attachmentCategoryLabels} />
          <TextField label="عنوان فایل" value={attachmentForm.title} onChange={(value) => setAttachmentForm({ ...attachmentForm, title: value })} placeholder="مثلاً آزمایش تیرماه یا پرینت بادی آنالیز" />
          <TextField label="یادداشت فایل" value={attachmentForm.notes} onChange={(value) => setAttachmentForm({ ...attachmentForm, notes: value })} />
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
                  <span className="text-xs text-olive">{attachmentCategoryLabels[attachment.category as AttachmentCategory] ?? attachment.category} · {attachment.attachment_date ? formatPersianDate(attachment.attachment_date) : ""}</span>
                </div>
                <p className="mt-2 truncate text-xs text-warm-500">{attachment.file_name}{attachment.notes ? ` · ${attachment.notes}` : ""}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : null;

  const servicesPanel = client?.id ? (
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-card border border-warm-100 bg-warm-50 p-5 motion-enter">
        <div className="flex items-center gap-2"><ClipboardList size={21} className="text-sage" /><h2 className="text-lg font-bold">ثبت خدمت برای ویزیت</h2></div>
        <p className="helper mt-2">خدمات از بخش تنظیمات تعریف می‌شوند. اینجا ابتدا گروه و بعد آیتم همان گروه را انتخاب کنید.</p>
        <div className="mt-5 grid gap-4">
          <SelectField label="ویزیت" value={serviceForm.visitId} onChange={(value) => setServiceForm({ ...serviceForm, visitId: value })} options={Object.fromEntries(visits.map((item) => [String(item.visit.id ?? ""), `${formatPersianDate(item.visit.visit_date)} · ${visitTypeLabels[(item.visit.visit_type ?? "initial") as VisitType] ?? "ویزیت"}`]))} />
          <div>
            <label className="label">گروه خدمت</label>
            <div className="service-picker-grid mt-2">
              {serviceGroupKeys.map((group) => (
                <button key={group} type="button" onClick={() => selectServiceGroup(group)} className={cn("service-choice-card", serviceForm.groupKey === group && "service-choice-active")}>{serviceGroupLabels[group]}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">آیتم خدمت</label>
            {filteredServiceCatalog.length === 0 ? (
              <div className="mt-2 rounded-control border border-dashed border-warm-200 bg-white p-4 text-sm leading-7 text-warm-500">برای این گروه هنوز خدمتی تعریف نشده است. از «تنظیمات ← تعریف خدمات» آیتم اضافه کنید.</div>
            ) : (
              <div className="mt-2 grid gap-2">
                {filteredServiceCatalog.map((item) => (
                  <button key={item.id ?? item.name} type="button" onClick={() => selectCatalogItem(String(item.id ?? ""))} className={cn("service-item-select", serviceForm.catalogId === String(item.id ?? "") && "service-item-select-active")}>
                    <span><strong>{item.name}</strong>{item.description && <small>{item.description}</small>}</span>
                    <span className="numbers">{formatNumber(item.default_price)} تومان</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="تعداد" value={serviceForm.quantity} onChange={(value) => setServiceForm({ ...serviceForm, quantity: value })} suffix="عدد" />
            <NumberField label="قیمت هر واحد" value={serviceForm.price} onChange={(value) => setServiceForm({ ...serviceForm, price: value })} suffix="تومان" />
            {(selectedCatalogItem?.body_area_required || serviceForm.groupKey === "device") && <TextField label="ناحیه بدن" value={serviceForm.body_area} onChange={(value) => setServiceForm({ ...serviceForm, body_area: value })} placeholder="مثلاً شکم، پهلو، ران" />}
            {serviceForm.groupKey === "device" && <TextField label="نام دستگاه" value={serviceForm.device_name} onChange={(value) => setServiceForm({ ...serviceForm, device_name: value })} placeholder="اختیاری" />}
            <div className="sm:col-span-2"><TextField label="یادداشت خدمت" value={serviceForm.notes} onChange={(value) => setServiceForm({ ...serviceForm, notes: value })} /></div>
          </div>
          {serviceForm.visitId && (visitServices[Number(serviceForm.visitId)] ?? []).length > 0 && (
            <div className="visit-service-cart">
              <div className="flex items-center justify-between"><strong>خدمات همین ویزیت</strong><span className="pill-soft">{formatNumber((visitServices[Number(serviceForm.visitId)] ?? []).reduce((sum, item) => sum + item.total, 0))} تومان</span></div>
              <div className="mt-3 grid gap-2">{(visitServices[Number(serviceForm.visitId)] ?? []).map((item) => <div key={item.id ?? item.service_name_snapshot} className="service-cart-row"><span><strong>{item.service_name_snapshot}</strong><small>{item.body_area || serviceGroupLabels[(item.service_group_snapshot ?? "other") as ServiceGroup]}</small></span><button type="button" onClick={() => deleteVisitService(item)} aria-label="حذف خدمت"><Trash2 size={16} /></button></div>)}</div>
            </div>
          )}
          <PrimaryButton icon={Plus} onClick={saveVisitService}>افزودن به ویزیت</PrimaryButton>
          <p className="helper">برای یک ویزیت می‌توانید بدون محدودیت چند خدمت از گروه‌های مختلف اضافه کنید.</p>
        </div>
      </div>
      <div className="rounded-card border border-warm-100 bg-white p-5 motion-enter motion-delay-1">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">خدمات ثبت‌شده</h2><span className="pill-soft">{formatNumber(Object.values(visitServices).flat().length)} مورد</span></div>
        <div className="mt-5 grid gap-4">
          {visits.slice().reverse().map((visit) => {
            const items = visit.visit.id ? visitServices[visit.visit.id] ?? [] : [];
            if (!items.length) return null;
            return <div key={visit.visit.id} className="service-group-card"><div className="mb-3 flex items-center justify-between"><strong>{formatPersianDate(visit.visit.visit_date)}</strong><span className="text-xs text-warm-500">{visitTypeLabels[(visit.visit.visit_type ?? "initial") as VisitType]}</span></div><div className="grid gap-2">{items.map((item) => <div key={item.id ?? item.service_name_snapshot} className="service-history-row"><span><strong>{item.service_name_snapshot}</strong><small>{serviceGroupLabels[(item.service_group_snapshot ?? "other") as ServiceGroup] ?? "سایر"}{item.body_area ? ` · ${item.body_area}` : ""}</small></span><span className="flex items-center gap-2"><b className="numbers">{formatNumber(item.total)} تومان</b><button type="button" className="icon-close-button" onClick={() => deleteVisitService(item)} aria-label="حذف خدمت"><Trash2 size={15} /></button></span></div>)}</div></div>;
          })}
          {Object.values(visitServices).flat().length === 0 && <EmptyState icon={ClipboardList} title="خدمتی ثبت نشده" text="بعد از ثبت ویزیت، گروه و آیتم خدمت را از فرم کنار صفحه انتخاب کنید." />}
        </div>
      </div>
    </div>
  ) : null;

  const tracksPanel = client?.id ? (() => {
    const selectedTrack = careTracks.find((item) => item.track_type === activeTrack && item.status !== "completed") ?? careTracks.find((item) => item.track_type === activeTrack);
    const allowedVisits = selectedTrack?.id
      ? visits.filter((item) => item.visit.track_id === selectedTrack.id)
      : visits.filter((item) => trackVisitTypes[activeTrack].includes((item.visit.visit_type ?? "initial") as VisitType));
    const allowedVisitIds = new Set(allowedVisits.map((item) => item.visit.id).filter((id): id is number => typeof id === "number"));
    const allowedServices = Object.values(visitServices).flat().filter((item) => allowedVisitIds.has(item.visit_id) || trackServiceGroups[activeTrack].includes((item.service_group_snapshot ?? "other") as ServiceGroup));
    const allowedFiles = attachments.filter((item) => item.track_id === selectedTrack?.id || trackAttachmentCategories[activeTrack].includes(item.category as AttachmentCategory));
    const startVisit = async () => {
      const track = await ensureCareTrack(activeTrack);
      if (!track) return;
      const nextType: Record<CareTrackType, VisitType> = { diet: "diet_followup", body_analysis: "body_analysis", device: "device", consultation: "consultation", combined: "combined" };
      setVisitForm((current) => ({ ...current, track_id: track.id ?? null, visit_type: nextType[activeTrack], reason: careTrackLabels[activeTrack] }));
      setActiveTab("visits");
    };
    return (
      <div className="rounded-card border border-warm-100 bg-white p-5 motion-enter">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-bold">مسیرهای مراقبت</h2><p className="helper mt-2">هر مسیر نمای مستقل و سبک خودش را دارد؛ فقط ویزیت‌ها، خدمات و فایل‌های مرتبط نمایش داده می‌شوند.</p></div><Target className="text-sage" size={24} /></div>
        <div className="care-track-tabs mt-5">
          {careTrackKeys.map((track) => <button key={track} type="button" onClick={() => setActiveTrack(track)} className={cn("care-track-tab", activeTrack === track && "care-track-tab-active")}><strong>{careTrackLabels[track]}</strong><small>{careTrackDescriptions[track]}</small></button>)}
        </div>
        <div className="mt-5 rounded-card border border-warm-100 bg-warm-50 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><span className="pill-soft">مسیر فعال</span><h3 className="mt-3 text-2xl font-extrabold">{careTrackLabels[activeTrack]}</h3><p className="helper mt-2">{careTrackDescriptions[activeTrack]}</p></div><PrimaryButton icon={Plus} onClick={startVisit}>شروع ویزیت این مسیر</PrimaryButton></div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <ResultCard title="ویزیت مرتبط" value={formatNumber(allowedVisits.length)} unit="جلسه" text={allowedVisits.length ? formatPersianDate(allowedVisits[allowedVisits.length - 1].visit.visit_date) : "هنوز ثبت نشده"} featured />
            <ResultCard title="خدمات" value={formatNumber(allowedServices.length)} unit="خدمت" text="آیتم‌های مرتبط با همین مسیر" />
            <ResultCard title="فایل‌ها" value={formatNumber(allowedFiles.length)} unit="فایل" text="اسناد و تصاویر مرتبط" />
          </div>
          {activeTrack === "diet" && <div className="track-target-editor mt-5"><div><strong>وزن هدف مسیر رژیم</strong><p className="helper mt-1">خط هدف در نمودار وزن نمایش داده می‌شود و در خلاصه پرونده قابل پیگیری است.</p></div><div className="track-target-controls"><OptionalNumberField label="وزن هدف" value={targetWeightDraft} onChange={setTargetWeightDraft} suffix="کیلوگرم" /><SecondaryButton icon={Target} onClick={saveDietTargetWeight}>ذخیره هدف</SecondaryButton></div></div>}
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="nested-summary-box"><h4>آخرین فعالیت‌ها</h4>{allowedVisits.length ? allowedVisits.slice(-3).reverse().map((item) => <div key={item.visit.id ?? item.visit.visit_date} className="nested-summary-row"><span>{formatPersianDate(item.visit.visit_date)}</span><strong>{visitTypeLabels[(item.visit.visit_type ?? "initial") as VisitType]}</strong></div>) : <p className="helper mt-3">هنوز ویزیتی در این مسیر ثبت نشده است.</p>}</div>
            <div className="nested-summary-box"><h4>فایل‌های مرتبط</h4>{allowedFiles.length ? allowedFiles.slice(0, 3).map((item) => <button type="button" key={item.id ?? item.file_name} onClick={() => openAttachment(item)} className="nested-summary-row w-full"><span>{attachmentCategoryLabels[item.category as AttachmentCategory] ?? "سایر"}</span><strong>{item.title || item.file_name}</strong></button>) : <p className="helper mt-3">فایلی در این مسیر ثبت نشده است.</p>}</div>
          </div>
          {activeTrack === "body_analysis" && <div className="body-analysis-embed mt-5"><div className="flex items-center justify-between gap-3"><div><h4>آخرین بادی آنالیز</h4><p className="helper mt-1">تصویر یا PDF دستگاه داخل پرونده و بدون خروج از اپ دیده می‌شود.</p></div></div><BodyAnalysisViewer attachment={latestBodyAnalysisFile} onOpen={() => latestBodyAnalysisFile && openAttachment(latestBodyAnalysisFile)} /></div>}

        </div>
      </div>
    );
  })() : null;

  const measurementsPanel = client?.id ? (() => {
    const latestWithMeasurements = [...visits].reverse().find((item) => item.measurements);
    const m = latestWithMeasurements?.measurements;
    const ext = parseExtendedMeasurements(m?.custom_measurements_json);
    const displayRows: Array<{ label: string; value?: number; suffix: string }> = [
      { label: "وزن", value: m?.weight_kg, suffix: "کیلوگرم" }, { label: "درصد چربی", value: m?.body_fat_percent, suffix: "درصد" }, { label: "توده عضله", value: m?.muscle_mass, suffix: "کیلوگرم" }, { label: "چربی احشایی", value: m?.visceral_fat, suffix: "" },
      { label: "دور کمر", value: m?.waist_cm, suffix: "سانتی‌متر" }, { label: "دور شکم", value: m?.abdomen_cm, suffix: "سانتی‌متر" }, { label: "دور باسن", value: m?.hip_cm, suffix: "سانتی‌متر" }, { label: "دور سینه", value: m?.chest_cm, suffix: "سانتی‌متر" }, { label: "دور گردن", value: m?.neck_cm, suffix: "سانتی‌متر" },
      ...extendedMeasurementLabels.map(({ key, label, suffix }) => ({ label, value: ext[key], suffix })),
    ].filter((row) => row.value !== undefined && row.value !== null);
    return (
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-card border border-warm-100 bg-white p-5 motion-enter"><h2 className="text-lg font-bold">روند پیشرفت</h2><p className="helper mt-2">وزن، سایزها و ترکیب بدن را بین ویزیت‌ها مقایسه کنید.</p><div className="mt-5"><ClientTrendChart visits={visits} targetWeight={careTracks.find((track) => track.track_type === "diet")?.target_weight} /></div></div>
        <div className="rounded-card border border-warm-100 bg-warm-50 p-5 motion-enter motion-delay-1"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">آخرین اندازه‌گیری کامل</h2><p className="helper mt-2">مقادیر عمومی، ترکیب بدن و اندام‌های چپ/راست.</p></div><Activity className="text-sage" size={24} /></div>{displayRows.length ? <div className="measurement-overview mt-5">{displayRows.map((row) => <div key={row.label}><span>{row.label}</span><strong className="numbers">{formatNumber(row.value!, 1)} <small>{row.suffix}</small></strong></div>)}</div> : <div className="mt-5"><EmptyState icon={Ruler} title="داده تکمیلی ثبت نشده" text="در تب ویزیت‌ها، زیربخش اندازه‌گیری عمومی، ترکیب بدن یا اندام و موضعی را تکمیل کنید." /></div>}</div>
      </div>
    );
  })() : null;

  const nutritionPanel = client?.id ? (
    <div className="grid gap-5">
      <section className="rounded-card border border-warm-100 bg-white p-5 motion-enter">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div><div className="flex items-center gap-2"><Calculator className="text-sage" size={23} /><h2 className="text-xl font-bold">محاسبات متصل به پرونده</h2></div><p className="helper mt-2">آخرین محاسبه در خلاصه پرونده، مسیر رژیم، گزارش و فرم برنامه غذایی استفاده می‌شود.</p></div>
          <PrimaryButton icon={Save} onClick={saveProfileCalculation}>{latestNutritionCalculation ? "به‌روزرسانی محاسبات" : "ذخیره محاسبات"}</PrimaryButton>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <ResultCard title="BMI" value={formatNumber(baseProfileCalculation.bmi, 1)} unit={bmiCategory(baseProfileCalculation.bmi)} text="شاخص فعلی" />
          <ResultCard title="IBW" value={formatNumber(baseProfileCalculation.ibw, 1)} unit="kg" text="وزن مرجع" />
          <ResultCard title="BMR" value={formatNumber(baseProfileCalculation.bmr)} unit="kcal" text="انرژی پایه" />
          <ResultCard title="TEE" value={formatNumber(baseProfileCalculation.tee)} unit="kcal" text="نیاز روزانه" />
          <ResultCard title="کالری هدف" value={formatNumber(profileCalories)} unit="kcal" text={latestNutritionCalculation ? `ذخیره‌شده ${formatPersianDate(latestNutritionCalculation.calculated_at)}` : "هنوز ذخیره نشده"} featured />
          <ResultCard title="ماکروها" value={`${formatNumber(profileProteinPercent)}/${formatNumber(profileCarbPercent)}/${formatNumber(profileFatPercent)}`} unit="٪" text="پروتئین / کربوهیدرات / چربی" />
        </div>
        <div className="mt-5 rounded-card bg-warm-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><strong>اصلاح درصدی</strong><p className="helper mt-1">تغییرات بعد از ذخیره در کل پرونده قابل بازیابی است.</p></div><span className={cn("macro-total", Math.abs(profileMacroTotal - 100) < 0.01 ? "macro-total-ok" : "macro-total-warning")}>جمع {formatNumber(profileMacroTotal)}٪</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><OverrideField label="تغییر کالری" value={profileCalcOverrides.calorieAdjustmentPercent} onChange={(value) => setProfileCalcOverrides({ ...profileCalcOverrides, calorieAdjustmentPercent: value })} suffix="درصد" allowNegative /><OverrideField label="پروتئین" value={profileCalcOverrides.proteinPercent} onChange={(value) => setProfileCalcOverrides({ ...profileCalcOverrides, proteinPercent: value })} suffix="درصد" /><OverrideField label="کربوهیدرات" value={profileCalcOverrides.carbsPercent} onChange={(value) => setProfileCalcOverrides({ ...profileCalcOverrides, carbsPercent: value })} suffix="درصد" /><OverrideField label="چربی" value={profileCalcOverrides.fatPercent} onChange={(value) => setProfileCalcOverrides({ ...profileCalcOverrides, fatPercent: value })} suffix="درصد" /></div>
        </div>
      </section>

      <section className="rounded-card border border-warm-100 bg-white p-5 motion-enter motion-delay-1">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div><div className="flex items-center gap-2"><Utensils className="text-sage" size={23} /><h2 className="text-xl font-bold">فرم برنامه غذایی</h2></div><p className="helper mt-2">قالب استاندارد وعده‌ای؛ جمع کالری و ماکروهای آیتم‌ها به‌صورت خودکار با هدف مراجع مقایسه می‌شود.</p></div>
          <div className="flex flex-wrap gap-2"><SecondaryButton icon={WandSparkles} onClick={syncDietTargets}>بازیابی اهداف محاسبات</SecondaryButton><SecondaryButton icon={FileText} onClick={exportDietPlan}>چاپ / PDF</SecondaryButton><PrimaryButton icon={Save} onClick={saveDietPlan}>ذخیره برنامه</PrimaryButton></div>
        </div>
        {effectiveDietPlan && <>
          <div className="mt-5 grid gap-4 md:grid-cols-3"><TextField label="عنوان برنامه" value={effectiveDietPlan.title} onChange={(value) => setDietPlanDraft({ ...effectiveDietPlan, title: value })} /><DateField label="تاریخ برنامه" value={effectiveDietPlan.plan_date} onChange={(value) => setDietPlanDraft({ ...effectiveDietPlan, plan_date: coerceDateToIso(value) || value })} /><SelectField label="وضعیت" value={effectiveDietPlan.status} onChange={(value) => setDietPlanDraft({ ...effectiveDietPlan, status: value })} options={{ draft: "پیش‌نویس", active: "فعال", archived: "بایگانی" }} /></div>
          <div className="diet-target-strip mt-5"><div><span>هدف روزانه</span><strong>{formatNumber(effectiveDietPlan.calories_target)} kcal</strong></div><div><span>ثبت‌شده</span><strong>{formatNumber(dietTotals.calories)} kcal</strong></div><div><span>پروتئین</span><strong>{formatNumber(dietTotals.protein_g, 1)} / {formatNumber(effectiveDietPlan.protein_target_g)} g</strong></div><div><span>کربوهیدرات</span><strong>{formatNumber(dietTotals.carb_g, 1)} / {formatNumber(effectiveDietPlan.carb_target_g)} g</strong></div><div><span>چربی</span><strong>{formatNumber(dietTotals.fat_g, 1)} / {formatNumber(effectiveDietPlan.fat_target_g)} g</strong></div></div>
          <div className="macro-progress mt-3"><span style={{ width: `${Math.min(100, effectiveDietPlan.calories_target ? dietTotals.calories / effectiveDietPlan.calories_target * 100 : 0)}%` }} /></div>
          <div className="mt-5 grid gap-3">{dietMeals.map((meal) => {
            const mealTotals = dietMealTotals([meal]);
            const openMeal = dietMealOpen === meal.id;
            return <div key={meal.id} className="diet-meal-card"><button type="button" className="diet-meal-head" onClick={() => setDietMealOpen(openMeal ? "" : meal.id)}><span><strong>{meal.title}</strong><small>سهم هدف {formatNumber(meal.target_percent)}٪ · {formatNumber(mealTotals.calories)} kcal · {formatNumber(meal.items.length)} آیتم</small></span><ChevronLeft className={cn("soft-transition", openMeal && "-rotate-90")} size={20} /></button>{openMeal && <div className="diet-meal-body"><div className="grid gap-3 md:grid-cols-[1fr_160px]"><TextField label="عنوان وعده" value={meal.title} onChange={(value) => updateMeal(meal.id, { title: value })} /><NumberField label="سهم کالری" value={meal.target_percent} onChange={(value) => updateMeal(meal.id, { target_percent: value })} suffix="درصد" /></div><div className="mt-4 grid gap-3">{meal.items.map((item) => <div key={item.id} className="diet-food-row"><TextField label="غذا / آیتم" value={item.title} onChange={(value) => updateDietItem(meal.id, item.id, { title: value })} placeholder="مثلاً نان سنگک" /><TextField label="مقدار" value={item.amount} onChange={(value) => updateDietItem(meal.id, item.id, { amount: value })} placeholder="مثلاً یک کف دست" /><OptionalNumberField label="کالری" value={String(item.calories || "")} onChange={(value) => updateDietItem(meal.id, item.id, { calories: Number(value) || 0 })} suffix="kcal" /><OptionalNumberField label="پروتئین" value={String(item.protein_g || "")} onChange={(value) => updateDietItem(meal.id, item.id, { protein_g: Number(value) || 0 })} suffix="g" /><OptionalNumberField label="کربوهیدرات" value={String(item.carb_g || "")} onChange={(value) => updateDietItem(meal.id, item.id, { carb_g: Number(value) || 0 })} suffix="g" /><OptionalNumberField label="چربی" value={String(item.fat_g || "")} onChange={(value) => updateDietItem(meal.id, item.id, { fat_g: Number(value) || 0 })} suffix="g" /><button type="button" className="diet-remove" onClick={() => removeDietItem(meal.id, item.id)}><Trash2 size={17} /> حذف</button></div>)}{meal.items.length === 0 && <div className="mini-empty">هنوز آیتمی اضافه نشده؛ فقط اطلاعاتی را وارد کنید که واقعاً در نسخه مراجع لازم است.</div>}</div><div className="mt-4"><SecondaryButton icon={Plus} onClick={() => addDietItem(meal.id)}>افزودن آیتم غذا</SecondaryButton></div></div>}</div>;
          })}</div>
          <div className="mt-5 grid gap-4 md:grid-cols-2"><div><label className="label">آب و مایعات</label><textarea className="control mt-2 min-h-24 w-full py-3" value={effectiveDietPlan.hydration_text} onChange={(e) => setDietPlanDraft({ ...effectiveDietPlan, hydration_text: e.target.value })} /></div><div><label className="label">فعالیت بدنی</label><textarea className="control mt-2 min-h-24 w-full py-3" value={effectiveDietPlan.activity_text} onChange={(e) => setDietPlanDraft({ ...effectiveDietPlan, activity_text: e.target.value })} /></div><div><label className="label">راهنمای اجرا</label><textarea className="control mt-2 min-h-24 w-full py-3" value={effectiveDietPlan.guidance_text} onChange={(e) => setDietPlanDraft({ ...effectiveDietPlan, guidance_text: e.target.value })} /></div><div><label className="label">یادداشت متخصص</label><textarea className="control mt-2 min-h-24 w-full py-3" value={effectiveDietPlan.notes} onChange={(e) => setDietPlanDraft({ ...effectiveDietPlan, notes: e.target.value })} /></div></div>
        </>}
      </section>
      {dietPlans.length > 0 && <section className="rounded-card border border-warm-100 bg-warm-50 p-5"><h3 className="font-bold">نسخه‌های قبلی برنامه غذایی</h3><div className="mt-4 grid gap-2">{dietPlans.map((plan) => <button key={plan.id} type="button" onClick={() => setDietPlanDraft(plan)} className="nested-summary-row w-full"><span>{formatPersianDate(plan.plan_date)}</span><strong>{plan.title}</strong></button>)}</div></section>}
    </div>
  ) : null;

  const profileCompletionItems = [Boolean(form.full_name), Boolean(form.phone), form.height_cm > 0, form.weight_kg > 0, visits.length > 0, Boolean(latestNutritionCalculation), Boolean(latestBodyAnalysisFile), Boolean(dietPlans.length)];
  const profileCompletion = Math.round(profileCompletionItems.filter(Boolean).length / profileCompletionItems.length * 100);
  const allServices = Object.values(visitServices).flat();
  const latestServices = allServices.slice(-4).reverse();
  const activeTrackSet = new Set<CareTrackType>(careTracks.filter((track) => track.status === "active").map((track) => track.track_type));
  if (activeTrackSet.size === 0) {
    visits.forEach((item) => {
      const type = (item.visit.visit_type ?? "initial") as VisitType;
      if (["initial", "diet_followup"].includes(type)) activeTrackSet.add("diet");
      if (type === "body_analysis") activeTrackSet.add("body_analysis");
      if (type === "device") activeTrackSet.add("device");
      if (type === "consultation") activeTrackSet.add("consultation");
      if (type === "combined") activeTrackSet.add("combined");
    });
  }
  const summaryPanel = client?.id ? (
    <div className="grid gap-5">
      <section className="profile-hero-summary">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center"><ProfileAvatar client={form} size="lg" /><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-extrabold">{form.full_name}</h2><span className="pill-soft">{goalLabels[form.goal]}</span>{form.archived && <span className="pill-soft">بایگانی</span>}</div><p className="helper mt-2">{form.phone || "شماره تماس ثبت نشده"} · {genderLabels[form.gender]} · {formatNumber(form.age)} سال</p><div className="mt-4 flex flex-wrap gap-2">{Array.from(activeTrackSet).length ? Array.from(activeTrackSet).map((track) => <button type="button" key={track} className="track-chip" onClick={() => { setActiveTrack(track); setActiveTab("tracks"); }}>{careTrackLabels[track]}</button>) : <span className="text-xs text-warm-500">مسیر فعال بعد از اولین ویزیت ساخته می‌شود.</span>}</div></div><div className="completion-orb"><strong>{formatNumber(profileCompletion)}٪</strong><span>تکمیل پرونده</span></div></div>
        <div className="macro-progress mt-5"><span style={{ width: `${profileCompletion}%` }} /></div>
      </section>
      <section className="summary-command-grid">
        <button onClick={() => setActiveTab("visits")}><CalendarCheck /><span><strong>ویزیت بعدی</strong><small>{latestVisit?.visit.next_visit_enabled && latestVisit.visit.next_visit_date ? `${formatPersianDate(latestVisit.visit.next_visit_date)} ${latestVisit.visit.next_visit_time || ""}` : "زمانی ثبت نشده"}</small></span></button>
        <button onClick={() => setActiveTab("nutrition")}><Calculator /><span><strong>هدف تغذیه</strong><small>{latestNutritionCalculation ? `${formatNumber(latestNutritionCalculation.target_calories)} کیلوکالری` : "محاسبات ذخیره نشده"}</small></span></button>
        <button onClick={() => { setActiveTrack("body_analysis"); setActiveTab("tracks"); }}><Activity /><span><strong>آخرین بادی آنالیز</strong><small>{latestBodyAnalysisVisit?.measurements?.body_fat_percent ? `چربی ${formatNumber(latestBodyAnalysisVisit.measurements.body_fat_percent, 1)}٪` : latestBodyAnalysisFile ? "فایل موجود است" : "ثبت نشده"}</small></span></button>
        <button onClick={() => setActiveTab("services")}><ClipboardList /><span><strong>خدمات اخیر</strong><small>{latestServices.length ? latestServices.map((item) => item.service_name_snapshot).join("، ") : "خدمتی ثبت نشده"}</small></span></button>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ResultCard title="وزن فعلی" value={latestRecord ? formatNumber(latestRecord.weight_kg, 1) : formatNumber(form.weight_kg, 1)} unit="کیلوگرم" text={latestRecord ? formatPersianDate(latestRecord.record_date) : "اطلاعات پایه"} />
        <ResultCard title="تغییر از ویزیت قبل" value={weightDelta === null ? "—" : formatNumber(weightDelta, 1)} unit="کیلوگرم" text={weightDelta === null ? "حداقل دو اندازه‌گیری لازم است" : weightDelta < 0 ? "کاهش ثبت شده" : "افزایش ثبت شده"} />
        <ResultCard title="BMI" value={latestBmi ? formatNumber(latestBmi, 1) : formatNumber(baseProfileCalculation.bmi, 1)} unit={bmiCategory(latestBmi ?? baseProfileCalculation.bmi)} text="بر اساس آخرین وزن و قد" featured />
        <ResultCard title="ویزیت‌های پرونده" value={formatNumber(visits.length)} unit="جلسه" text={latestVisit ? `آخرین: ${formatPersianDate(latestVisit.visit.visit_date)}` : "هنوز ویزیتی ثبت نشده"} />
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-card border border-warm-100 bg-white p-5 motion-enter"><div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">روند تغییرات مراجع</h3><p className="helper mt-1">شاخص موردنظر را انتخاب کنید؛ نمودار از ویزیت‌ها به‌صورت خودکار ساخته می‌شود.</p></div><TrendingUp className="text-sage" /></div><div className="mt-5"><ClientTrendChart visits={visits} targetWeight={careTracks.find((track) => track.track_type === "diet")?.target_weight} /></div></div>
        <div className="rounded-card border border-warm-100 bg-warm-50 p-5 motion-enter motion-delay-1"><div className="flex items-center justify-between"><div><h3 className="font-bold">آخرین بادی آنالیز</h3><p className="helper mt-1">نمایش سریع آخرین فایل و شاخص‌ها.</p></div><Activity className="text-sage" /></div><div className="mt-4"><BodyAnalysisViewer attachment={latestBodyAnalysisFile} onOpen={() => latestBodyAnalysisFile && openAttachment(latestBodyAnalysisFile)} /></div>{latestBodyAnalysisVisit?.measurements && <div className="body-summary-metrics mt-4"><div><span>چربی بدن</span><strong>{latestBodyAnalysisVisit.measurements.body_fat_percent ? `${formatNumber(latestBodyAnalysisVisit.measurements.body_fat_percent, 1)}٪` : "—"}</strong></div><div><span>توده عضله</span><strong>{latestBodyAnalysisVisit.measurements.muscle_mass ? `${formatNumber(latestBodyAnalysisVisit.measurements.muscle_mass, 1)} kg` : "—"}</strong></div><div><span>چربی احشایی</span><strong>{latestBodyAnalysisVisit.measurements.visceral_fat ? formatNumber(latestBodyAnalysisVisit.measurements.visceral_fat, 1) : "—"}</strong></div></div>}</div>
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-card border border-warm-100 bg-white p-5"><div className="flex items-center justify-between"><div><h3 className="font-bold">تصویر کامل وضعیت فعلی</h3><p className="helper mt-1">شاخص‌های اصلی برای تصمیم‌گیری سریع متخصص.</p></div><Target className="text-sage" /></div><div className="measurement-overview mt-5"><div><span>هدف اصلی</span><strong>{goalLabels[form.goal]}</strong></div><div><span>سطح فعالیت</span><strong>{activityLabels[form.activity_level]}</strong></div><div><span>کالری هدف</span><strong>{latestNutritionCalculation ? `${formatNumber(latestNutritionCalculation.target_calories)} kcal` : "—"}</strong></div><div><span>برنامه غذایی</span><strong>{dietPlans[0]?.title || "ثبت نشده"}</strong></div><div><span>فایل‌ها</span><strong>{formatNumber(attachments.length)} فایل</strong></div><div><span>خدمات</span><strong>{formatNumber(allServices.length)} مورد</strong></div></div></div>
        <div className="rounded-card border border-warm-100 bg-warm-50 p-5"><div className="flex items-center gap-2"><Trophy className="text-sage" /><h3 className="font-bold">پیشرفت پرونده</h3></div><div className="mt-4 grid gap-2"><div className={cn("achievement-row", visits.length && "done")}><CheckCircle2 /> اولین ویزیت</div><div className={cn("achievement-row", latestNutritionCalculation && "done")}><CheckCircle2 /> محاسبات ذخیره‌شده</div><div className={cn("achievement-row", latestBodyAnalysisFile && "done")}><CheckCircle2 /> بادی آنالیز</div><div className={cn("achievement-row", dietPlans.length && "done")}><CheckCircle2 /> برنامه غذایی</div></div></div>
      </section>
      {form.notes && <section className="rounded-card border border-warm-100 bg-white p-5"><h3 className="font-bold">یادداشت مهم پرونده</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-8 text-warm-500">{form.notes}</p></section>}
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
        {profileLoadError && <div className="mb-5"><ErrorSummary message={profileLoadError} /><button type="button" className="mini-action mt-3" onClick={() => setProfileReloadVersion((value) => value + 1)}><RotateCcw size={16} /> تلاش دوباره</button></div>}
        {profileLoading && client?.id && <div className="mb-5"><SkeletonRows /></div>}
        {client?.id && (
          <div className="mb-6 flex flex-wrap gap-2 border-b border-warm-100 pb-4">
            <TabButton active={activeTab === "summary"} onClick={() => setActiveTab("summary")}>خلاصه</TabButton>
            <TabButton active={activeTab === "tracks"} onClick={() => setActiveTab("tracks")}>مسیرها</TabButton>
            <TabButton active={activeTab === "visits"} onClick={() => setActiveTab("visits")}>ویزیت‌ها</TabButton>
            <TabButton active={activeTab === "measurements"} onClick={() => setActiveTab("measurements")}>اندازه‌گیری‌ها</TabButton>
            <TabButton active={activeTab === "nutrition"} onClick={() => setActiveTab("nutrition")}>رژیم و محاسبات</TabButton>
            <TabButton active={activeTab === "files"} onClick={() => setActiveTab("files")}>فایل‌ها</TabButton>
            <TabButton active={activeTab === "services"} onClick={() => setActiveTab("services")}>خدمات</TabButton>
            <TabButton active={activeTab === "base"} onClick={() => setActiveTab("base")}>اطلاعات پایه</TabButton>
          </div>
        )}
        {!client?.id || activeTab === "base" ? baseInfo : null}
        {client?.id && activeTab === "summary" ? summaryPanel : null}
        {client?.id && activeTab === "tracks" ? tracksPanel : null}
        {client?.id && activeTab === "visits" ? visitsPanel : null}
        {client?.id && activeTab === "measurements" ? measurementsPanel : null}
        {client?.id && activeTab === "nutrition" ? nutritionPanel : null}
        {client?.id && activeTab === "files" ? filesPanel : null}
        {client?.id && activeTab === "services" ? servicesPanel : null}
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedCalculation, setSavedCalculation] = useState<NutritionCalculation | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [overrides, setOverrides] = useState({ calorieAdjustmentPercent: "", proteinPercent: "", carbsPercent: "", fatPercent: "" });
  useOutsideDismiss(searchRef, searchOpen, () => setSearchOpen(false));

  const hydrateSaved = (items: NutritionCalculation[]) => {
    const latest = items[0] ?? null;
    setSavedCalculation(latest);
    if (latest) {
      setOverrides({
        calorieAdjustmentPercent: String(latest.calorie_adjustment_percent || ""),
        proteinPercent: String(latest.protein_percent),
        carbsPercent: String(latest.carb_percent),
        fatPercent: String(latest.fat_percent),
      });
    } else {
      setOverrides({ calorieAdjustmentPercent: "", proteinPercent: "", carbsPercent: "", fatPercent: "" });
    }
  };

  useEffect(() => {
    setSelected(initialClient);
    setInput(initialClient ?? emptyClient);
  }, [initialClient]);

  useEffect(() => {
    if (!selected?.id || !isDesktopRuntime()) { setSavedCalculation(null); return; }
    invoke<NutritionCalculation[]>("list_client_nutrition_calculations", { clientId: selected.id })
      .then(hydrateSaved)
      .catch((error) => {
        setSavedCalculation(null);
        toast(getErrorMessage(error, "بازیابی محاسبات قبلی انجام نشد."), "error");
      });
  }, [selected?.id]);

  useEffect(() => {
    if (!query.trim() || !isDesktopRuntime()) { setResults([]); return; }
    const timer = window.setTimeout(() => invoke<Client[]>("search_clients", { query }).then((items) => { setResults(items); setSearchOpen(true); }).catch(() => setResults([])), 150);
    return () => window.clearTimeout(timer);
  }, [query]);

  const calc = calculateNutrition(input, settings);
  const calorieAdjustmentPercent = Number(overrides.calorieAdjustmentPercent) || 0;
  const calories = Math.max(0, calc.targetCalories * (1 + calorieAdjustmentPercent / 100));
  const proteinPercent = overrides.proteinPercent === "" ? calc.proteinPercent : Number(overrides.proteinPercent);
  const carbsPercent = overrides.carbsPercent === "" ? calc.carbsPercent : Number(overrides.carbsPercent);
  const fatPercent = overrides.fatPercent === "" ? calc.fatPercent : Number(overrides.fatPercent);
  const macroTotal = proteinPercent + carbsPercent + fatPercent;
  const protein = (calories * (proteinPercent / 100)) / 4;
  const carbs = (calories * (carbsPercent / 100)) / 4;
  const fat = (calories * (fatPercent / 100)) / 9;
  const setField = <K extends keyof Client>(key: K, value: Client[K]) => setInput((current) => ({ ...current, [key]: value }));

  const choose = (client: Client) => {
    setSelected(client); setInput(client); setQuery(""); setResults([]); setSearchOpen(false);
    toast("اطلاعات مراجع در محاسبات تغذیه قرار گرفت.");
  };
  const clear = () => {
    setSelected(null); setInput({ ...emptyClient }); setQuery(""); setSearchOpen(false); setSavedCalculation(null);
    setOverrides({ calorieAdjustmentPercent: "", proteinPercent: "", carbsPercent: "", fatPercent: "" });
  };

  const saveCalculation = async () => {
    if (!selected?.id) { toast("برای ذخیره محاسبات، ابتدا یک مراجع ذخیره‌شده را انتخاب کنید.", "error"); return; }
    if (Math.abs(macroTotal - 100) > 0.2) { toast("جمع درصد ماکروها باید ۱۰۰٪ باشد.", "error"); return; }
    setSaving(true);
    try {
      const item: NutritionCalculation = {
        id: savedCalculation?.id,
        client_id: selected.id,
        visit_id: savedCalculation?.visit_id ?? null,
        calculated_at: todayIsoDate(),
        gender: input.gender, age: input.age, height_cm: input.height_cm, weight_kg: input.weight_kg,
        activity_level: input.activity_level, goal: input.goal,
        bmi: calc.bmi, ibw: calc.ibw, abw: calc.abw, bmr: calc.bmr, tee: calc.tee,
        target_calories: calories, calorie_adjustment_percent: calorieAdjustmentPercent,
        protein_percent: proteinPercent, carb_percent: carbsPercent, fat_percent: fatPercent,
        protein_g: protein, carb_g: carbs, fat_g: fat, notes: savedCalculation?.notes ?? "",
      };
      const saved = isDesktopRuntime() ? await invoke<NutritionCalculation>("save_nutrition_calculation", { item }) : item;
      setSavedCalculation(saved);
      toast("محاسبات در پرونده و مسیر رژیم ذخیره شد.");
    } catch (error) { toast(getErrorMessage(error, "ذخیره محاسبات انجام نشد."), "error"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="محاسبات تغذیه" subtitle="محاسبه را به مراجع متصل کنید تا در خلاصه پرونده، مسیر رژیم و برنامه غذایی همیشه بازیابی شود." action={selected ? <PrimaryButton icon={Save} onClick={saveCalculation}>{saving ? "در حال ذخیره" : savedCalculation ? "به‌روزرسانی در پرونده" : "ذخیره در پرونده"}</PrimaryButton> : undefined} />
      <div className="grid gap-5 xl:grid-cols-[430px_1fr]">
        <section className="card p-6 motion-enter">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold">ورودی‌ها</h2><p className="helper mt-1">{selected ? `مراجع انتخاب‌شده: ${selected.full_name}` : "حالت ورود دستی فعال است؛ برای ذخیره، مراجع را انتخاب کنید."}</p></div>
            {selected && <SecondaryButton icon={RotateCcw} onClick={clear}>ورود دستی</SecondaryButton>}
          </div>
          {savedCalculation && <div className="mb-4 rounded-control border border-mint/50 bg-mint/10 px-4 py-3 text-xs font-semibold text-[var(--primary)]"><CheckCircle2 className="ml-2 inline" size={17} /> آخرین محاسبه پرونده بارگذاری شد؛ ویرایش‌ها روی همان رکورد ذخیره می‌شوند.</div>}
          <div ref={searchRef} className="relative mb-5">
            <Search className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-warm-500" size={20} />
            <input className="control w-full pr-12" value={query} onFocus={() => results.length > 0 && setSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(Boolean(event.target.value)); }} placeholder="جست‌وجوی مراجع ذخیره‌شده" />
            {searchOpen && results.length > 0 && <div className="popover-panel absolute z-30 mt-2 max-h-72 w-full overflow-auto p-2">{results.map((client) => <button type="button" key={client.id} onClick={() => choose(client)} className="soft-transition flex w-full items-center justify-between rounded-control px-3 py-3 text-right hover:bg-warm-50"><span className="font-semibold">{client.full_name}</span><span className="text-xs text-warm-500">{goalLabels[client.goal]}</span></button>)}</div>}
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
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold">اصلاح دستی درصدی</p><p className="helper mt-1">کالری را درصدی کم/زیاد کنید و سهم ماکروها را با درصد تنظیم کنید.</p></div><span className={cn("macro-total", Math.abs(macroTotal - 100) < 0.01 ? "macro-total-ok" : "macro-total-warning")}>جمع: {formatNumber(macroTotal)}٪</span></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <OverrideField label="تغییر کالری هدف" value={overrides.calorieAdjustmentPercent} onChange={(value) => setOverrides({ ...overrides, calorieAdjustmentPercent: value })} suffix="درصد" allowNegative />
              <OverrideField label="پروتئین" value={overrides.proteinPercent} onChange={(value) => setOverrides({ ...overrides, proteinPercent: value })} suffix="درصد" />
              <OverrideField label="کربوهیدرات" value={overrides.carbsPercent} onChange={(value) => setOverrides({ ...overrides, carbsPercent: value })} suffix="درصد" />
              <OverrideField label="چربی" value={overrides.fatPercent} onChange={(value) => setOverrides({ ...overrides, fatPercent: value })} suffix="درصد" />
            </div>
            {Math.abs(macroTotal - 100) >= 0.01 && <p className="mt-3 text-xs font-semibold text-amber-700">جمع درصد ماکروها باید ۱۰۰٪ باشد.</p>}
          </div>
        </section>
        <section className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-3 motion-enter motion-delay-1">
          <ResultCard title="BMI" value={formatNumber(calc.bmi, 1)} unit={bmiCategory(calc.bmi)} text="نمای سریع وضعیت وزنی بر اساس قد و وزن." />
          <ResultCard title="IBW" value={formatNumber(calc.ibw, 1)} unit="کیلوگرم" text="وزن ایده‌آل بر اساس ضریب BMI تنظیمات." />
          <ResultCard title="ABW" value={formatNumber(calc.abw, 1)} unit="کیلوگرم" text="وزن تعدیل‌شده برای محاسبه انرژی پایه." />
          <ResultCard title="BMR" value={formatNumber(calc.bmr)} unit="کیلوکالری" text="انرژی پایه بر اساس ABW و ضرایب تنظیمات." />
          <ResultCard title="TEE" value={formatNumber(calc.tee)} unit="کیلوکالری" text="نیاز انرژی روزانه با سطح فعالیت." />
          <ResultCard title="کالری هدف" value={formatNumber(calories)} unit="کیلوکالری" text={calorieAdjustmentPercent ? `${formatNumber(calorieAdjustmentPercent)}٪ اصلاح دستی اعمال شده.` : "بر اساس هدف وزن."} featured />
          <ResultCard title="پروتئین" value={formatNumber(protein)} unit="گرم" text={`${formatNumber(proteinPercent)}٪ از کالری هدف.`} />
          <ResultCard title="کربوهیدرات" value={formatNumber(carbs)} unit="گرم" text={`${formatNumber(carbsPercent)}٪ از کالری هدف.`} />
          <ResultCard title="چربی" value={formatNumber(fat)} unit="گرم" text={`${formatNumber(fatPercent)}٪ از کالری هدف.`} />
        </section>
      </div>
    </>
  );
}

function SettingsScreen({ settings, setSettings, toast }: { settings: Settings; setSettings: (settings: Settings) => void; toast: ToastFn }) {
  const [form, setForm] = useState(settings);
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [credentials, setCredentials] = useState({ current_password: "", username: settings.username || "admin", password: "", repeat: "" });
  const [serviceCatalog, setServiceCatalog] = useState<ServiceCatalogItem[]>([]);
  const [serviceEditor, setServiceEditor] = useState<ServiceCatalogItem>({ ...emptyServiceEditor });
  const [visitModes, setVisitModes] = useState<VisitModeOption[]>([]);
  const [visitModeEditor, setVisitModeEditor] = useState<VisitModeOption>({ ...emptyVisitModeEditor });
  const [loading, setLoading] = useState(false);
  useEffect(() => setForm(settings), [settings]);
  useEffect(() => {
    if (!isDesktopRuntime()) return;
    setLoading(true);
    Promise.all([
      invoke<ServiceCatalogItem[]>("list_service_catalog", { activeOnly: false }),
      invoke<VisitModeOption[]>("list_visit_modes", { activeOnly: false }),
    ]).then(([services, modes]) => { setServiceCatalog(services); setVisitModes(modes); })
      .catch((error) => toast(getErrorMessage(error, "تنظیمات خدمات خوانده نشد."), "error"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    try {
      const saved = isDesktopRuntime() ? await invoke<Settings>("save_settings", { settings: form }) : form;
      setSettings(saved); toast("تنظیمات ذخیره شد.");
    } catch (error) { toast(getErrorMessage(error, "ذخیره تنظیمات انجام نشد."), "error"); }
  };
  const chooseBrandImage = async (kind: "logo" | "background") => {
    try {
      const selected = await open({ multiple: false, filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif", "svg"] }] });
      if (!selected || Array.isArray(selected)) return;
      const imported = isDesktopRuntime() ? await invoke<string>("import_brand_asset", { path: selected, kind }) : selected;
      setForm((current) => kind === "logo" ? { ...current, logo_path: imported } : { ...current, background_image_path: imported });
      toast(kind === "logo" ? "لوگو کامل انتخاب شد؛ بعد از ذخیره بدون برش نمایش داده می‌شود." : "پس‌زمینه انتخاب شد؛ ذخیره را بزنید.");
    } catch (error) { toast(getErrorMessage(error, "انتخاب تصویر انجام نشد."), "error"); }
  };
  const applyDietoyTheme = () => {
    setForm((current) => ({ ...current, primary_color: dietoyTheme.primary_color, background_color: dietoyTheme.background_color, text_color: dietoyTheme.text_color }));
    toast("پالت اصلی لوگوی دایتوری اعمال شد.");
  };
  const setCalcSetting = (key: CalcSettingKey, value: number) => setForm((current) => ({ ...current, [key]: Number.isFinite(value) ? value : defaultCalculationSettings[key] }));
  const changeCredentials = async () => {
    if (!credentials.username.trim() || credentials.password.length < 4 || credentials.password !== credentials.repeat) { toast("نام کاربری و رمز جدید را درست وارد کنید.", "error"); return; }
    try {
      if (isDesktopRuntime()) await invoke("change_credentials", { input: { current_password: credentials.current_password, username: credentials.username, password: credentials.password } });
      setSettings({ ...settings, username: credentials.username });
      setCredentials({ current_password: "", username: credentials.username, password: "", repeat: "" });
      toast("اطلاعات ورود تغییر کرد.");
    } catch (error) { toast(getErrorMessage(error, "رمز فعلی درست نیست یا تغییر انجام نشد."), "error"); }
  };
  const exportCompleteBackup = async () => {
    try {
      const path = await invoke<string>("export_complete_backup");
      toast(`پشتیبان کامل ساخته شد: ${path}`);
    } catch (error) {
      toast(getErrorMessage(error, "ساخت پشتیبان کامل انجام نشد."), "error");
    }
  };
  const restoreCompleteBackup = async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: "پوشه پشتیبان کامل Dietory را انتخاب کنید" });
      if (!selected || Array.isArray(selected)) return;
      const safetyPath = await invoke<string>("restore_complete_backup", { path: selected });
      const restored = await invoke<Settings>("get_settings");
      setSettings(restored);
      setForm(restored);
      toast(`بازیابی کامل شد. یک پشتیبان ایمنی هم ساخته شد: ${safetyPath}`);
    } catch (error) {
      toast(getErrorMessage(error, "بازیابی کامل انجام نشد."), "error");
    }
  };
  const exportData = async () => { try { toast(`فایل پشتیبان سبک ساخته شد: ${await invoke<string>("export_data_backup")}`); } catch (error) { toast(getErrorMessage(error, "ساخت فایل پشتیبان سبک انجام نشد."), "error"); } };
  const restoreData = async () => { try { const selected = await open({ multiple: false, filters: [{ name: "Dietory backup", extensions: ["json"] }] }); if (!selected || Array.isArray(selected)) return; await invoke("restore_data_backup", { path: selected }); const restored = await invoke<Settings>("get_settings"); setSettings(restored); setForm(restored); toast("پشتیبان سبک بازیابی شد."); } catch (error) { toast(getErrorMessage(error, "بازیابی پشتیبان سبک انجام نشد."), "error"); } };
  const exportSqlite = async () => { try { toast(`کپی SQLite ساخته شد: ${await invoke<string>("export_database")}`); } catch (error) { toast(getErrorMessage(error, "خروجی SQLite انجام نشد."), "error"); } };

  const resetServiceEditor = (group: ServiceGroup = (serviceEditor.group_key ?? "diet") as ServiceGroup) => setServiceEditor({ ...emptyServiceEditor, group_key: group });
  const saveServiceDefinition = async () => {
    if (!serviceEditor.name.trim()) { toast("نام خدمت را وارد کنید.", "error"); return; }
    try {
      const saved = await invoke<ServiceCatalogItem>("save_service_catalog_item", { item: { ...serviceEditor, group_key: serviceEditor.group_key ?? "other", name: serviceEditor.name.trim(), description: serviceEditor.description?.trim() ?? "", default_price: Number(serviceEditor.default_price) || 0, default_duration_minutes: serviceEditor.default_duration_minutes ? Number(serviceEditor.default_duration_minutes) : null, body_area_required: Boolean(serviceEditor.body_area_required), active: serviceEditor.active !== false } });
      setServiceCatalog((items) => { const index = items.findIndex((item) => item.id === saved.id); if (index < 0) return [...items, saved]; const next = [...items]; next[index] = saved; return next; });
      resetServiceEditor((saved.group_key ?? "diet") as ServiceGroup); toast(serviceEditor.id ? "خدمت ویرایش شد." : "خدمت جدید اضافه شد.");
    } catch (error) { toast(getErrorMessage(error, "ذخیره خدمت انجام نشد."), "error"); }
  };
  const toggleServiceDefinition = async (item: ServiceCatalogItem) => { try { const saved = await invoke<ServiceCatalogItem>("save_service_catalog_item", { item: { ...item, active: item.active === false } }); setServiceCatalog((items) => items.map((entry) => entry.id === saved.id ? saved : entry)); toast(saved.active ? "خدمت فعال شد." : "خدمت غیرفعال شد."); } catch (error) { toast(getErrorMessage(error, "تغییر وضعیت خدمت انجام نشد."), "error"); } };

  const saveVisitModeDefinition = async () => {
    if (!visitModeEditor.name.trim()) { toast("نام شیوه ویزیت را وارد کنید.", "error"); return; }
    try {
      const saved = await invoke<VisitModeOption>("save_visit_mode", { item: { ...visitModeEditor, name: visitModeEditor.name.trim() } });
      setVisitModes((items) => { const index = items.findIndex((item) => item.id === saved.id); if (index < 0) return [...items, saved]; const next = [...items]; next[index] = saved; return next; });
      setVisitModeEditor({ ...emptyVisitModeEditor }); toast(visitModeEditor.id ? "شیوه ویزیت ویرایش شد." : "شیوه ویزیت اضافه شد.");
    } catch (error) { toast(getErrorMessage(error, "ذخیره شیوه ویزیت انجام نشد."), "error"); }
  };
  const toggleVisitMode = async (item: VisitModeOption) => { try { const saved = await invoke<VisitModeOption>("save_visit_mode", { item: { ...item, active: !item.active } }); setVisitModes((items) => items.map((entry) => entry.id === saved.id ? saved : entry)); } catch (error) { toast(getErrorMessage(error, "تغییر شیوه ویزیت انجام نشد."), "error"); } };

  return (
    <>
      <PageHeader title="تنظیمات" subtitle="تنظیمات ساده برای کارهای روزمره؛ گزینه‌های تخصصی فقط در حالت پیشرفته نمایش داده می‌شوند." action={<PrimaryButton icon={Save} onClick={save}>ذخیره همه تغییرات</PrimaryButton>} />
      <div className="settings-mode-switch mb-5"><button className={cn(mode === "simple" && "active")} onClick={() => setMode("simple")}><Sparkles size={19} /> ساده و روزمره</button><button className={cn(mode === "advanced" && "active")} onClick={() => setMode("advanced")}><SettingsIcon size={19} /> پیشرفته</button></div>

      {mode === "simple" && <div className="grid gap-5">
        <section className="card p-6 motion-enter">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2"><Palette className="text-sage" /><h2 className="text-xl font-bold">هویت دایتوری</h2></div><p className="helper mt-2">لوگو با نسبت اصلی و بدون برش در ورود، منو و گزارش‌ها استفاده می‌شود.</p></div><BrandLogo settings={{ ...form }} className="h-36 w-64" full /></div>
          <div className="mt-6 grid gap-4 md:grid-cols-2"><TextField label="نام متخصص تغذیه" value={form.dietitian_name} onChange={(value) => setForm({ ...form, dietitian_name: value })} /><TextField label="نام کلینیک" value={form.clinic_name} onChange={(value) => setForm({ ...form, clinic_name: value })} /></div>
          <div className="mt-5 flex flex-wrap gap-3"><SecondaryButton icon={ImageIcon} onClick={() => chooseBrandImage("logo")}>انتخاب لوگوی کامل</SecondaryButton><SecondaryButton icon={Palette} onClick={applyDietoyTheme}>اعمال رنگ‌های لوگو</SecondaryButton></div>
        </section>

        <section className="card p-6 motion-enter motion-delay-1"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><ClipboardList className="text-sage" /><h2 className="text-xl font-bold">خدمات کلینیک</h2></div><p className="helper mt-2">هر تعداد خدمت تعریف کنید؛ در هر ویزیت هم می‌توان چند خدمت را با هم انتخاب کرد.</p></div><span className="pill-soft">{formatNumber(serviceCatalog.filter((x) => x.active).length)} فعال</span></div>
          <div className="settings-service-grid mt-6"><div className="service-editor-card"><h3 className="font-bold">{serviceEditor.id ? "ویرایش خدمت" : "خدمت جدید"}</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><SelectField label="گروه" value={(serviceEditor.group_key ?? "other") as string} onChange={(value) => setServiceEditor({ ...serviceEditor, group_key: value as ServiceGroup })} options={serviceGroupLabels} /><TextField label="نام خدمت" value={serviceEditor.name} onChange={(value) => setServiceEditor({ ...serviceEditor, name: value })} /><NumberField label="قیمت پیش‌فرض" value={serviceEditor.default_price} onChange={(value) => setServiceEditor({ ...serviceEditor, default_price: value })} suffix="تومان" /><OptionalNumberField label="مدت" value={serviceEditor.default_duration_minutes ? String(serviceEditor.default_duration_minutes) : ""} onChange={(value) => setServiceEditor({ ...serviceEditor, default_duration_minutes: value ? Number(value) : null })} suffix="دقیقه" /><div className="sm:col-span-2"><TextField label="توضیح" value={serviceEditor.description ?? ""} onChange={(value) => setServiceEditor({ ...serviceEditor, description: value })} /></div></div><div className="mt-4 flex gap-4"><label className="toggle-row"><input type="checkbox" checked={serviceEditor.body_area_required} onChange={(e) => setServiceEditor({ ...serviceEditor, body_area_required: e.target.checked })} /> ناحیه بدن لازم است</label><label className="toggle-row"><input type="checkbox" checked={serviceEditor.active !== false} onChange={(e) => setServiceEditor({ ...serviceEditor, active: e.target.checked })} /> فعال</label></div><div className="mt-4 flex gap-2"><PrimaryButton icon={Save} onClick={saveServiceDefinition}>{serviceEditor.id ? "ذخیره" : "افزودن"}</PrimaryButton>{serviceEditor.id && <SecondaryButton onClick={() => resetServiceEditor()}>انصراف</SecondaryButton>}</div></div>
            <div className="grid gap-3">{loading ? <SkeletonRows /> : serviceGroupKeys.map((group) => { const items = serviceCatalog.filter((x) => (x.group_key ?? "other") === group); if (!items.length) return null; return <div key={group} className="service-settings-group"><strong>{serviceGroupLabels[group]}</strong><div className="mt-3 grid gap-2">{items.map((item) => <div key={item.id ?? item.name} className={cn("service-settings-row", !item.active && "service-settings-row-inactive")}><div><strong>{item.name}</strong><small>{formatNumber(item.default_price)} تومان</small></div><div className="flex gap-2"><button className="mini-action" onClick={() => setServiceEditor({ ...emptyServiceEditor, ...item })}><Pencil size={15} /> ویرایش</button><button className="mini-action" onClick={() => toggleServiceDefinition(item)}>{item.active ? "غیرفعال" : "فعال"}</button></div></div>)}</div></div>; })}</div></div>
        </section>

        <section className="card p-6"><div className="flex items-center gap-2"><Video className="text-sage" /><h2 className="text-xl font-bold">شیوه‌های ویزیت</h2></div><p className="helper mt-2">حضوری و آنلاین پیش‌فرض هستند؛ عنوان‌های دیگر مثل تلفنی یا منزل را هم اضافه کنید.</p><div className="settings-service-grid mt-5"><div className="service-editor-card"><div className="grid gap-3"><TextField label="نام شیوه" value={visitModeEditor.name} onChange={(value) => setVisitModeEditor({ ...visitModeEditor, name: value })} placeholder="مثلاً تلفنی" /><TextField label="توضیح" value={visitModeEditor.description ?? ""} onChange={(value) => setVisitModeEditor({ ...visitModeEditor, description: value })} /></div><div className="mt-4 flex gap-2"><PrimaryButton icon={Plus} onClick={saveVisitModeDefinition}>{visitModeEditor.id ? "ذخیره" : "افزودن"}</PrimaryButton>{visitModeEditor.id && <SecondaryButton onClick={() => setVisitModeEditor({ ...emptyVisitModeEditor })}>انصراف</SecondaryButton>}</div></div><div className="grid gap-2">{visitModes.map((item) => <div key={item.id ?? item.key} className={cn("service-settings-row", !item.active && "service-settings-row-inactive")}><div><strong>{item.name}</strong><small>{item.description || visitModeDefaultLabels[item.key] || "شیوه مراجعه"}</small></div><div className="flex gap-2"><button className="mini-action" onClick={() => setVisitModeEditor(item)}><Pencil size={15} /> ویرایش</button><button className="mini-action" onClick={() => toggleVisitMode(item)}>{item.active ? "غیرفعال" : "فعال"}</button></div></div>)}</div></div></section>

        <section className="card p-6 motion-enter">
          <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Database className="text-sage" /><h2 className="text-xl font-bold">پشتیبان‌گیری امن</h2></div><p className="helper mt-2">پشتیبان کامل، دیتابیس و تمام فایل‌های مراجعین را باهم نگه می‌دارد و گزینه پیشنهادی قبل از هر آپدیت است.</p></div><span className="pill-soft">پیشنهادی</span></div>
          <div className="mt-5 grid gap-3 md:grid-cols-2"><button type="button" className="backup-action backup-action-primary" onClick={exportCompleteBackup}><Download size={22} /><span><strong>ساخت پشتیبان کامل</strong><small>دیتابیس، پرونده‌ها، تصاویر، PDFها و دارایی‌های برند</small></span></button><button type="button" className="backup-action" onClick={restoreCompleteBackup}><FileUp size={22} /><span><strong>بازیابی پشتیبان کامل</strong><small>انتخاب پوشه‌ای که فایل manifest.json دارد</small></span></button></div>
          <details className="advanced-backup mt-4"><summary>گزینه‌های فنی و سبک</summary><div className="mt-4 flex flex-wrap gap-3"><SecondaryButton icon={Download} onClick={exportData}>خروجی JSON سبک</SecondaryButton><SecondaryButton icon={Database} onClick={exportSqlite}>فقط SQLite</SecondaryButton><SecondaryButton icon={FileUp} onClick={restoreData}>بازیابی JSON قدیمی</SecondaryButton></div></details>
        </section>
      </div>}

      {mode === "advanced" && <div className="grid gap-5">
        <section className="card p-6"><div className="flex items-center gap-2"><Palette className="text-sage" /><h2 className="text-xl font-bold">رنگ و پس‌زمینه</h2></div><div className="mt-5 grid gap-4 md:grid-cols-3"><ColorField label="رنگ اصلی" value={colorValue(form.primary_color, defaultSettings.primary_color)} onChange={(value) => setForm({ ...form, primary_color: value })} /><ColorField label="پس‌زمینه" value={colorValue(form.background_color, defaultSettings.background_color)} onChange={(value) => setForm({ ...form, background_color: value })} /><ColorField label="رنگ نوشته" value={colorValue(form.text_color, defaultSettings.text_color)} onChange={(value) => setForm({ ...form, text_color: value })} /></div><div className="mt-5"><SecondaryButton icon={ImageIcon} onClick={() => chooseBrandImage("background")}>انتخاب تصویر پس‌زمینه</SecondaryButton></div></section>
        <section className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">تنظیمات محاسبات</h2>
              <p className="helper mt-2">فقط در صورت تغییر پروتکل کلینیک ویرایش شود.</p>
            </div>
            <span className="pill-soft">پیشرفته</span>
          </div>
          <div className="mt-5 grid gap-5">
            {calculationSettingGroups.map((group) => (
              <div key={group.title} className="rounded-card border border-warm-100 p-5">
                <h3 className="font-bold">{group.title}</h3>
                <p className="helper mt-1">{group.description}</p>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {group.fields.map((field) => (
                    <NumberField
                      key={field.key}
                      label={field.label}
                      value={Number(form[field.key] ?? defaultCalculationSettings[field.key])}
                      onChange={(value) => setCalcSetting(field.key, value)}
                      suffix=""
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="card p-6"><div className="flex items-center gap-2"><FileText className="text-sage" /><h2 className="text-xl font-bold">قالب چاپ برنامه غذایی</h2></div><p className="helper mt-2">برای چاپ روی سربرگ، حاشیه را بیشتر کنید و نمایش لوگو را خاموش کنید.</p><div className="mt-5 grid gap-4 md:grid-cols-2"><TextField label="عنوان اصلی" value={form.diet_plan_header_title ?? ""} onChange={(value) => setForm({ ...form, diet_plan_header_title: value })} /><NumberField label="حاشیه چاپ" value={Number(form.diet_plan_margin_mm ?? 14)} onChange={(value) => setForm({ ...form, diet_plan_margin_mm: value })} suffix="میلی‌متر" /><div className="md:col-span-2"><TextField label="متن پایین صفحه" value={form.diet_plan_footer_text ?? ""} onChange={(value) => setForm({ ...form, diet_plan_footer_text: value })} /></div></div><div className="mt-4 flex flex-wrap gap-4"><label className="toggle-row"><input type="checkbox" checked={form.diet_plan_show_logo !== false} onChange={(e) => setForm({ ...form, diet_plan_show_logo: e.target.checked })} /> نمایش لوگو</label><label className="toggle-row"><input type="checkbox" checked={form.diet_plan_show_calories !== false} onChange={(e) => setForm({ ...form, diet_plan_show_calories: e.target.checked })} /> نمایش کالری</label><label className="toggle-row"><input type="checkbox" checked={form.diet_plan_show_macros !== false} onChange={(e) => setForm({ ...form, diet_plan_show_macros: e.target.checked })} /> نمایش ماکروها</label></div></section>
        <section className="card p-6"><div className="flex items-center gap-2"><KeyRound className="text-sage" /><h2 className="text-xl font-bold">ورود و امنیت</h2></div><div className="mt-5 grid gap-4 md:grid-cols-2"><TextField label="نام کاربری جدید" value={credentials.username} onChange={(value) => setCredentials({ ...credentials, username: value })} /><PasswordField label="رمز فعلی" value={credentials.current_password} onChange={(value) => setCredentials({ ...credentials, current_password: value })} /><PasswordField label="رمز جدید" value={credentials.password} onChange={(value) => setCredentials({ ...credentials, password: value })} /><PasswordField label="تکرار رمز" value={credentials.repeat} onChange={(value) => setCredentials({ ...credentials, repeat: value })} /></div><div className="mt-5"><SecondaryButton icon={KeyRound} onClick={changeCredentials}>تغییر اطلاعات ورود</SecondaryButton></div></section>
      </div>}
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

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="control mt-2 flex items-center gap-3 px-3">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-12 cursor-pointer rounded-lg border-0 bg-transparent p-0"
          aria-label={label}
        />
        <input
          className="numbers min-w-0 flex-1 border-0 bg-transparent text-left outline-none"
          dir="ltr"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => onChange(colorValue(event.target.value, value))}
        />
      </div>
    </div>
  );
}

function IconInput({ icon: Icon, label, value, onChange, type = "text", autoComplete }: { icon: typeof UserRound; label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string }) {
  return <div><label className="label">{label}</label><div className="mt-2 flex h-12 items-center gap-3 rounded-control border border-warm-200 bg-white/95 px-4 shadow-sm focus-within:border-[var(--primary)] focus-within:ring-4 focus-within:ring-emerald/10"><Icon size={19} className="text-olive" /><input className="min-w-0 flex-1 border-0 bg-transparent text-charcoal outline-none placeholder:text-warm-400" type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} /></div></div>;
}

function NumberField({ label, value, onChange, suffix, error }: { label: string; value: number; onChange: (value: number) => void; suffix: string; error?: string }) {
  return <div><label className="label">{label}</label><div className={cn("input-with-unit mt-2 flex h-12 items-center gap-3 rounded-control border border-warm-200 bg-white px-4 focus-within:border-[var(--primary)] focus-within:ring-4 focus-within:ring-emerald/10", error && "border-red-300 focus-within:border-red-400 focus-within:ring-red-100")}><input className="numbers min-w-0 flex-1 border-0 bg-transparent text-left text-charcoal outline-none" type="number" min="0" dir="ltr" value={value} onChange={(event) => onChange(Number(event.target.value))} /><span className="shrink-0 whitespace-nowrap text-xs font-semibold text-warm-500">{suffix}</span></div><FieldError text={error} /></div>;
}

function OptionalNumberField({ label, value, onChange, suffix, min = 0, max = 400 }: { label: string; value: string; onChange: (value: string) => void; suffix: string; min?: number; max?: number }) {
  return <div><label className="label">{label}</label><div className="input-with-unit mt-2 flex h-12 items-center gap-3 rounded-control border border-warm-200 bg-white px-4 focus-within:border-[var(--primary)] focus-within:ring-4 focus-within:ring-emerald/10"><input className="numbers min-w-0 flex-1 border-0 bg-transparent text-left text-charcoal outline-none" type="number" min={min} max={max} step="0.1" dir="ltr" value={value} onChange={(event) => onChange(event.target.value)} placeholder="اختیاری" /><span className="shrink-0 whitespace-nowrap text-xs font-semibold text-warm-500">{suffix}</span></div></div>;
}

function SettingNumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (value: number) => void; step?: number }) {
  return <div><label className="label">{label}</label><input className="control numbers mt-2 w-full text-left" type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></div>;
}

function TimeField({ label, value, onChange, error }: { label: string; value: string; onChange: (value: string) => void; error?: string }) {
  return <div><label className="label">{label}</label><input className={cn("control numbers mt-2 w-full text-left", error && "border-red-300 focus:border-red-400 focus:ring-red-100")} type="time" step="300" dir="ltr" value={value} onChange={(event) => onChange(event.target.value)} /><FieldError text={error} /></div>;
}

function DateField({ label, value, onChange, error }: { label: string; value: string; onChange: (value: string) => void; error?: string }) {
  const normalizedValue = coerceDateToIso(value) || todayIsoDate();
  const currentParts = jalaliPartsFromIso(normalizedValue);
  const [text, setText] = useState(isoToJalaliInput(normalizedValue));
  const [openPicker, setOpenPicker] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState({ year: currentParts.jy, month: currentParts.jm });
  const rootRef = useRef<HTMLDivElement>(null);
  useOutsideDismiss(rootRef, openPicker, () => setOpenPicker(false));

  useEffect(() => {
    const nextIso = coerceDateToIso(value) || todayIsoDate();
    setText(isoToJalaliInput(nextIso));
    const next = jalaliPartsFromIso(nextIso);
    setVisibleMonth({ year: next.jy, month: next.jm });
  }, [value]);

  const commitText = (nextText: string, force = false) => {
    setText(nextText);
    const iso = jalaliInputToIso(nextText);
    if (iso) {
      onChange(iso);
      if (force) setText(isoToJalaliInput(iso));
    }
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
  const selected = jalaliPartsFromIso(normalizedValue);
  const days = Array.from({ length: daysInJalaliMonth(visibleMonth.year, visibleMonth.month) }, (_, index) => index + 1);
  const firstDayIso = jalaliInputToIso(`${visibleMonth.year}/${String(visibleMonth.month).padStart(2, "0")}/01`);
  const firstDayOffset = firstDayIso ? (new Date(`${firstDayIso}T00:00:00`).getDay() + 1) % 7 : 0;

  return (
    <div ref={rootRef} className="relative">
      <label className="label">{label}</label>
      <div className={cn("mt-2 flex h-12 items-center rounded-control border bg-white px-3 focus-within:ring-4", error ? "border-red-300 focus-within:border-red-400 focus-within:ring-red-100" : "border-warm-200 focus-within:border-[var(--primary)] focus-within:ring-emerald/10")}>
        <input className="numbers min-w-0 flex-1 border-0 bg-transparent text-left outline-none" dir="ltr" value={text} onFocus={() => setOpenPicker(true)} onChange={(event) => commitText(event.target.value)} onBlur={() => commitText(text, true)} placeholder="۱۴۰۵/۰۴/۱۹" />
        <button type="button" className="grid h-9 w-9 place-items-center rounded-control text-olive hover:bg-warm-50" onClick={() => setOpenPicker((current) => !current)} aria-label="باز کردن تقویم"><CalendarDays size={19} /></button>
      </div>
      <FieldError text={error} />
      {openPicker && (
        <div className="popover-panel calendar-popover absolute z-40 mt-2 w-80 p-4">
          <div className="mb-4 flex items-center justify-between">
            <button type="button" className="calendar-nav" onClick={() => moveMonth(-1)} aria-label="ماه قبل"><ChevronRight size={18} /></button>
            <div className="text-center"><strong>{persianMonthNames[visibleMonth.month - 1]}</strong><span className="numbers mr-2 text-sm text-warm-500">{toPersianDigits(visibleMonth.year)}</span></div>
            <button type="button" className="calendar-nav" onClick={() => moveMonth(1)} aria-label="ماه بعد"><ChevronLeft size={18} /></button>
          </div>
          <div className="calendar-weekdays">{persianWeekdayShortLabels.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-days">
            {Array.from({ length: firstDayOffset }, (_, index) => <span key={`blank-${index}`} />)}
            {days.map((day) => {
              const active = selected.jy === visibleMonth.year && selected.jm === visibleMonth.month && selected.jd === day;
              return <button key={day} type="button" onClick={() => chooseDay(day)} className={cn("calendar-day", active && "calendar-day-active")}>{toPersianDigits(day)}</button>;
            })}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-warm-100 pt-3"><button type="button" className="text-xs font-bold text-olive" onClick={() => { const today = todayIsoDate(); onChange(today); setText(isoToJalaliInput(today)); setOpenPicker(false); }}>امروز</button><button type="button" className="text-xs text-warm-500" onClick={() => setOpenPicker(false)}>بستن</button></div>
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

function OverrideField({ label, value, onChange, suffix, allowNegative = false }: { label: string; value: string; onChange: (value: string) => void; suffix: string; allowNegative?: boolean }) {
  return <label className="block"><span className="text-xs font-medium text-warm-500">{label}</span><div className="input-with-unit mt-1 flex h-11 items-center gap-2 rounded-control border border-warm-200 bg-white px-3 focus-within:border-[var(--primary)]"><input className="numbers min-w-0 flex-1 border-0 bg-transparent text-left outline-none" type="number" min={allowNegative ? -100 : 0} max="100" value={value} onChange={(event) => onChange(event.target.value)} placeholder="پیش‌فرض" /><span className="text-xs font-semibold text-warm-500">{suffix}</span></div></label>;
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
