import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Archive,
  Calculator,
  Camera,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
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
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
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
import type { ActivityLevel, Client, ClientRecord, DashboardStats, Gender, Goal, Screen, Settings, VisitStatus } from "./types";

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

function isDesktopRuntime() {
  return Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

function withDefaults(settings: Partial<Settings>): Settings {
  return { ...defaultSettings, ...settings };
}

function assetUrl(path?: string) {
  if (!path) return "";
  if (path.startsWith("/") || path.startsWith("data:") || path.startsWith("http")) return path;
  return isDesktopRuntime() ? convertFileSrc(path) : path;
}\n
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

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push: ToastFn = (text, kind = "success") => {
    const id = Date.now();
    setToasts((items) => [...items, { id, text, kind }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3000);
  };
  return { toasts, push };
}

function addDaysIso(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function normalizeClient(client: Client): Client {
  return {
    ...client,
    next_visit_date: client.next_visit_date ?? "",
    next_visit_status: client.next_visit_status ?? "tentative",
  };
}

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [editing, setEditing] = useState<Client | null>(null);
  const [calculationClient, setCalculationClient] = useState<Client | null>(null);
  const [version, setVersion] = useState(0);
  const { toasts, push } = useToasts();

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    invoke<Settings>("get_settings")
      .then((next) => {
        const merged = withDefaults(next);
        setSettings(merged);
        applyVisualSettings(merged);
      })
      .catch(() => push("تنظیمات خوانده نشد.", "error"));
  }, []);

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
          {screen === "dashboard" && <Dashboard version={version} settings={settings} onNew={() => openClientForm()} onCalculations={() => openCalculations()} onEdit={openClientForm} />}
          {screen === "clients" && <Clients version={version} onNew={() => openClientForm()} onEdit={openClientForm} onCalculate={openCalculations} onChanged={() => setVersion((value) => value + 1)} toast={push} />}
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
          {screen === "settings" && (
            <SettingsScreen
              settings={settings}
              setSettings={(next) => {
                const merged = withDefaults(next);
                setSettings(merged);
                applyVisualSettings(merged);
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
    return <div className={cn("grid place-items-center rounded-control bg-[var(--primary)] text-white shadow-lift", className)}><Leaf size={23} /></div>;
  }
  return <div className={cn("grid place-items-center overflow-hidden rounded-control bg-white text-[var(--primary)] shadow-lift", className)}><img src={logo} alt="Dietoy" className="h-full w-full object-contain p-2" onError={() => setFailed(true)} /></div>;
}

function Brand({ settings }: { settings: Settings }) {
  return <div className="flex items-center gap-3"><BrandLogo settings={settings} /><div><p className="text-lg font-bold">{settings.clinic_name || "Dietoy"}</p><p className="mt-1 text-xs text-warm-500">{settings.dietitian_name || "مدیریت حرفه‌ای تغذیه"}</p></div></div>;
}

function NavItem({ active, icon: Icon, label, onClick }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void }) {
  return <button onClick={onClick} className={cn("soft-transition flex h-12 items-center gap-3 rounded-control px-4 text-sm font-semibold", active ? "bg-[var(--primary)] text-white shadow-lift" : "text-warm-500 hover:bg-warm-50 hover:text-charcoal")}><Icon size={20} />{label}</button>;
}

function MobileNav({ screen, setScreen, openCalculations }: { screen: Screen; setScreen: (screen: Screen) => void; openCalculations: () => void }) {
  const item = "grid h-11 place-items-center rounded-control border border-warm-100 bg-paper text-warm-500";
  return <div className="mb-5 grid grid-cols-4 gap-2 lg:hidden"><button className={cn(item, screen === "dashboard" && "bg-[var(--primary)] text-white")} onClick={() => setScreen("dashboard")} aria-label="داشبورد"><Home size={20} /></button><button className={cn(item, (screen === "clients" || screen === "client-form") && "bg-[var(--primary)] text-white")} onClick={() => setScreen("clients")} aria-label="مراجعین"><Users size={20} /></button><button className={cn(item, screen === "calculator" && "bg-[var(--primary)] text-white")} onClick={openCalculations} aria-label="محاسبات"><Calculator size={20} /></button><button className={cn(item, screen === "settings" && "bg-[var(--primary)] text-white")} onClick={() => setScreen("settings")} aria-label="تنظیمات"><SettingsIcon size={20} /></button></div>;
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
  return <div className="login-shell min-h-screen bg-[var(--app-bg)]" dir="rtl" style={backgroundStyle(settings)}><main className="grid min-h-screen place-items-center px-5 py-8"><section className="login-card w-full max-w-[980px] overflow-hidden rounded-[28px] border border-warm-100 bg-paper shadow-soft md:grid md:grid-cols-[1fr_420px]"><div className="relative hidden min-h-[560px] overflow-hidden bg-[var(--primary)] p-9 text-white md:block"><div className="relative z-10 flex h-full flex-col justify-between"><div><BrandLogo settings={settings} className="h-14 w-14 rounded-card" /><h1 className="mt-8 text-4xl font-bold leading-[1.45]">Dietoy</h1><p className="mt-4 max-w-sm text-sm leading-8 text-white/78">پرونده‌ها، محاسبات، وقت‌های بعدی و پشتیبان‌گیری روی همین دستگاه می‌ماند.</p></div><div className="rounded-card border border-white/14 bg-white/10 p-5"><p className="text-sm font-semibold">ورود اولیه</p><p className="numbers mt-3 text-2xl font-bold">admin / admin</p><p className="mt-2 text-xs leading-6 text-white/70">بعد از ورود از تنظیمات رمز را تغییر دهید.</p></div></div></div><form onSubmit={submit} className="p-7 md:p-9"><p className="text-sm font-semibold text-olive">Dietoy</p><h2 className="mt-3 text-3xl font-bold">خوش آمدید</h2><p className="mt-3 text-sm leading-7 text-warm-500">برای دسترسی به اطلاعات مراجعین وارد شوید.</p><div className="mt-8 grid gap-5"><IconInput icon={UserRound} label="نام کاربری" value={username} onChange={setUsername} autoComplete="username" /><IconInput icon={KeyRound} label="رمز عبور" type="password" value={password} onChange={setPassword} autoComplete="current-password" /></div><div className="mt-8"><PrimaryButton icon={KeyRound} type="submit">{loading ? "در حال ورود..." : "ورود به برنامه"}</PrimaryButton></div></form></section></main><ToastStack toasts={toasts} /></div>;
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
    invoke<DashboardStats>("dashboard_stats").then(setStats).catch(() => setStats({ total_clients: 0, active_clients: 0, recent_clients: [] }));
    invoke<Client[]>("list_clients", { includeArchived: false }).then((items) => setClients(items.map(normalizeClient))).catch(() => setClients([]));
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

  return <><PageHeader title={settings.dietitian_name ? `سلام، ${settings.dietitian_name}` : "داشبورد روزانه"} subtitle={`امروز ${formatPersianDate()} است. مراجعات، پرونده‌ها و محاسبات تغذیه‌ای اینجا مدیریت می‌شوند.`} action={<PrimaryButton icon={Plus} onClick={onNew}>مراجع جدید</PrimaryButton>} /><section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]"><div className="card p-6 md:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-olive">اقدام سریع</p><h2 className="mt-3 text-2xl font-bold">شروع ویزیت بدون شلوغی</h2><p className="mt-3 max-w-xl text-sm leading-7 text-warm-500">پرونده جدید بسازید یا مستقیماً وارد محاسبات انرژی، IBW، ABW، BMR، TEE و ماکروها شوید.</p></div><Sparkles className="text-sage" size={28} /></div><div className="mt-8 grid gap-3 sm:grid-cols-2"><PrimaryButton icon={Plus} onClick={onNew}>ثبت مراجع</PrimaryButton><SecondaryButton icon={Calculator} onClick={onCalculations}>محاسبات</SecondaryButton></div></div><div className="grid grid-cols-2 gap-4"><Stat label="همه مراجعین" value={stats?.total_clients} icon={Users} /><Stat label="فعال" value={stats?.active_clients} icon={Leaf} /></div></section><section className="card mt-5 p-6"><div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between"><div><h2 className="text-xl font-bold">تقویم مراجعات</h2><p className="helper mt-1">وقت‌های موقت زرد و وقت‌های قطعی سبز هستند.</p></div><div className="grid gap-2 md:grid-cols-3 xl:w-[620px]"><SelectPlain value={filter} onChange={setFilter} options={{ today: "امروز", week: "این هفته", month: "این ماه", exact: "تاریخ دقیق", range: "بازه دلخواه", all: "همه" }} />{filter === "exact" && <DateField label="تاریخ" value={exactDate} onChange={setExactDate} compact />}{filter === "range" && <><DateField label="از" value={range.from} onChange={(value) => setRange({ ...range, from: value })} compact /><DateField label="تا" value={range.to} onChange={(value) => setRange({ ...range, to: value })} compact /></>}</div></div>{appointmentItems.length === 0 ? <EmptyState icon={CalendarDays} title="مراجعه‌ای در این بازه نیست" text="از پرونده مراجع، تاریخ مراجعه بعدی و وضعیت وقت را ثبت کنید." /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{appointmentItems.map((client) => <AppointmentCard key={client.id} client={client} onClick={() => onEdit(client)} />)}</div>}</section><section className="card mt-5 p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">مراجعین اخیر</h2><Users className="text-sage" size={22} /></div>{!stats ? <SkeletonRows /> : stats.recent_clients.length === 0 ? <EmptyState icon={Users} title="هنوز مراجعی ثبت نشده" text="اولین پرونده را بسازید تا این بخش زنده شود." /> : <div className="grid gap-3">{stats.recent_clients.map((client) => <ClientRow key={client.id} client={normalizeClient(client)} onEdit={() => onEdit(normalizeClient(client))} />)}</div>}</section></>;
}

function AppointmentCard({ client, onClick }: { client: Client; onClick: () => void }) {
  const confirmed = client.next_visit_status === "confirmed";
  return <button onClick={onClick} className={cn("rounded-card border p-4 text-right soft-transition hover:shadow-soft", confirmed ? "border-emerald/30 bg-emerald/10" : "border-amber-200 bg-amber-50")}><div className="flex items-center justify-between gap-2"><span className="font-bold">{client.full_name}</span><span className={cn("rounded-full px-3 py-1 text-xs font-semibold", confirmed ? "bg-emerald/15 text-emerald" : "bg-amber-100 text-amber-700")}>{confirmed ? "قطعی" : "موقت"}</span></div><p className="mt-2 text-xs text-warm-500">{formatPersianDate(client.next_visit_date || todayIsoDate())}</p>{client.phone && <p className="numbers mt-2 text-xs text-warm-500">{client.phone}</p>}</button>;
}

function Clients({ version, onNew, onEdit, onCalculate, onChanged, toast }: { version: number; onNew: () => void; onEdit: (client: Client) => void; onCalculate: (client: Client) => void; onChanged: () => void; toast: ToastFn }) {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  useEffect(() => {
    if (!isDesktopRuntime()) { setClients([]); return; }
    setClients(null);
    invoke<Client[]>("list_clients", { includeArchived }).then((items) => setClients(items.map(normalizeClient))).catch(() => setClients([]));
  }, [version, includeArchived]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (clients ?? []).filter((client) => [client.full_name, client.phone, client.email].some((value) => value.toLowerCase().includes(needle)));
  }, [clients, query]);
  const archive = async (client: Client) => { await invoke("archive_client", { id: client.id, archived: !client.archived }); toast(client.archived ? "مراجع فعال شد." : "مراجع بایگانی شد."); onChanged(); };
  return <><PageHeader title="مراجعین" subtitle="جست‌وجو، ویرایش، محاسبه و مدیریت نوبت بعدی مراجعین." action={<PrimaryButton icon={Plus} onClick={onNew}>مراجع جدید</PrimaryButton>} /><section className="card p-5"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="relative flex-1"><Search className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-warm-500" size={20} /><input className="control w-full pr-12" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی نام، موبایل یا ایمیل" /></div><label className="flex h-12 items-center gap-2 rounded-control border border-warm-100 bg-warm-50 px-4 text-sm text-warm-500"><input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />نمایش بایگانی</label></div><div className="mt-5 grid gap-3">{!clients ? <SkeletonRows /> : filtered.length === 0 ? <EmptyState icon={Search} title="موردی پیدا نشد" text="نام را تغییر دهید یا مراجع جدید ثبت کنید." /> : filtered.map((client) => <ClientRow key={client.id} client={client} onEdit={() => onEdit(client)} onCalculate={() => onCalculate(client)} onArchive={() => archive(client)} />)}</div></section></>;
}

function ClientRow({ client, onEdit, onCalculate, onArchive }: { client: Client; onEdit: () => void; onCalculate?: () => void; onArchive?: () => void }) {
  return <div className="card flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-3"><ProfileAvatar client={client} /><div><p className="font-bold">{client.full_name}</p><p className="mt-1 text-xs text-warm-500">{genderLabels[client.gender]} · {formatNumber(client.age)} سال · {goalLabels[client.goal]}</p>{client.next_visit_date && <p className="mt-1 text-xs text-olive">مراجعه بعدی: {formatPersianDate(client.next_visit_date)} · {client.next_visit_status === "confirmed" ? "قطعی" : "موقت"}</p>}</div></div><div className="flex flex-wrap gap-2"><SecondaryButton icon={ClipboardList} onClick={onEdit}>ویرایش</SecondaryButton>{onCalculate && <SecondaryButton icon={Calculator} onClick={onCalculate}>محاسبات</SecondaryButton>}{onArchive && <SecondaryButton icon={Archive} onClick={onArchive}>{client.archived ? "فعال‌سازی" : "بایگانی"}</SecondaryButton>}</div></div>;
}

function ProfileAvatar({ client, size = "md" }: { client: Client; size?: "md" | "lg" }) {
  const src = assetUrl(client.profile_image_path);
  const className = size === "lg" ? "h-20 w-20" : "h-12 w-12";
  if (src) return <img src={src} className={cn("rounded-control object-cover", className)} alt={client.full_name} />;
  return <div className={cn("grid place-items-center rounded-control bg-warm-50 text-sage", className)}><UserRound size={size === "lg" ? 34 : 22} /></div>;
}

function ClientForm({ client, onBack, onSaved, toast }: { client: Client | null; onBack: () => void; onSaved: (client: Client) => void; toast: ToastFn }) {
  const [form, setForm] = useState<Client>(client ? normalizeClient(client) : emptyClient);
  const [records, setRecords] = useState<ClientRecord[]>([]);
  const [recordForm, setRecordForm] = useState({ record_date: todayIsoDate(), weight_kg: client?.weight_kg ?? emptyClient.weight_kg, height_cm: client?.height_cm ?? emptyClient.height_cm, notes: "" });
  useEffect(() => setForm(client ? normalizeClient(client) : emptyClient), [client]);
  useEffect(() => {
    setRecordForm({ record_date: todayIsoDate(), weight_kg: client?.weight_kg ?? emptyClient.weight_kg, height_cm: client?.height_cm ?? emptyClient.height_cm, notes: "" });
    if (!client?.id || !isDesktopRuntime()) { setRecords([]); return; }
    invoke<ClientRecord[]>("list_client_records", { clientId: client.id }).then(setRecords).catch(() => setRecords([]));
  }, [client]);
  const setField = <K extends keyof Client>(key: K, value: Client[K]) => setForm((current) => ({ ...current, [key]: value }));
  const chooseProfileImage = async () => {
    try {
      const selected = await open({ multiple: false, filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"] }] });
      if (!selected || Array.isArray(selected)) return;
      const imported = isDesktopRuntime() ? await invoke<string>("import_brand_asset", { path: selected, kind: "client-profile" }) : selected;
      setField("profile_image_path", imported);
      toast("عکس پروفایل انتخاب شد.");
    } catch { toast("انتخاب عکس انجام نشد.", "error"); }
  };
  const save = async () => {
    if (!form.full_name.trim()) { toast("نام مراجع را وارد کنید.", "error"); return; }
    try {
      const saved = await invoke<Client>("save_client", { client: normalizeClient(form) });
      if (!client && saved.id) await invoke<ClientRecord>("save_client_record", { record: { client_id: saved.id, record_date: todayIsoDate(), weight_kg: saved.weight_kg, height_cm: saved.height_cm, notes: "ثبت اولیه مراجع" } });
      onSaved(normalizeClient(saved));
      toast(client ? "پرونده ذخیره شد." : "مراجع جدید ثبت شد.");
    } catch { toast("ذخیره انجام نشد.", "error"); }
  };
  const saveRecord = async () => {
    if (!client?.id) { toast("اول پرونده مراجع را ذخیره کنید.", "error"); return; }
    try {
      const record = await invoke<ClientRecord>("save_client_record", { record: { client_id: client.id, record_date: recordForm.record_date, weight_kg: recordForm.weight_kg, height_cm: recordForm.height_cm, notes: recordForm.notes } });
      setRecords((items) => [...items, record].sort((a, b) => a.record_date.localeCompare(b.record_date)));
      const updatedClient = { ...form, weight_kg: record.weight_kg, height_cm: record.height_cm };
      setForm(updatedClient);
      await invoke<Client>("save_client", { client: normalizeClient(updatedClient) });
      setRecordForm({ record_date: todayIsoDate(), weight_kg: record.weight_kg, height_cm: record.height_cm, notes: "" });
      toast("رکورد ویزیت ثبت شد.");
    } catch { toast("ثبت رکورد انجام نشد.", "error"); }
  };
  return <><PageHeader title={client ? "پرونده مراجع" : "مراجع جدید"} subtitle={client ? "اطلاعات، یادداشت‌ها، نوبت بعدی و روند تغییرات مراجع را یکجا ببینید." : "اطلاعات پایه برای محاسبات و پیگیری ویزیت را وارد کنید."} action={<PrimaryButton icon={Save} onClick={save}>ذخیره پرونده</PrimaryButton>} /><section className="card p-6"><div className="grid gap-5 md:grid-cols-2"><div className="flex flex-col gap-4 rounded-card border border-warm-100 bg-warm-50 p-4 sm:flex-row sm:items-center md:col-span-2"><ProfileAvatar client={form} size="lg" /><div className="flex-1"><p className="text-sm font-bold">عکس پروفایل مراجع</p><p className="helper mt-1">برای شناسایی سریع‌تر در پرونده و لیست مراجعین.</p></div><SecondaryButton icon={Camera} onClick={chooseProfileImage}>انتخاب عکس</SecondaryButton></div><TextField label="نام کامل" value={form.full_name} onChange={(value) => setField("full_name", value)} /><TextField label="شماره تماس" value={form.phone} onChange={(value) => setField("phone", value)} placeholder="مثلا 09123456789" /><TextField label="ایمیل" value={form.email} onChange={(value) => setField("email", value)} placeholder="name@example.com" /><SelectField label="جنسیت" value={form.gender} onChange={(value) => setField("gender", value as Gender)} options={genderLabels} /><NumberField label="سن" value={form.age} onChange={(value) => setField("age", value)} suffix="سال" /><NumberField label="قد" value={form.height_cm} onChange={(value) => setField("height_cm", value)} suffix="سانتی‌متر" /><NumberField label="وزن" value={form.weight_kg} onChange={(value) => setField("weight_kg", value)} suffix="کیلوگرم" /><SelectField label="سطح فعالیت" value={form.activity_level} onChange={(value) => setField("activity_level", value as ActivityLevel)} options={activityLabels} /><SelectField label="هدف" value={form.goal} onChange={(value) => setField("goal", value as Goal)} options={goalLabels} /><DateField label="تاریخ مراجعه بعدی" value={form.next_visit_date || ""} onChange={(value) => setField("next_visit_date", value)} /><SelectField label="وضعیت وقت" value={form.next_visit_status || "tentative"} onChange={(value) => setField("next_visit_status", value as VisitStatus)} options={{ tentative: "زرد / موقت", confirmed: "سبز / قطعی" }} /><div className="md:col-span-2"><label className="label">یادداشت پرونده</label><textarea className="control mt-2 min-h-32 w-full py-3" value={form.notes} onChange={(event) => setField("notes", event.target.value)} /></div></div>{client?.id && <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]"><div className="rounded-card border border-warm-100 bg-warm-50 p-5"><div className="flex items-center gap-2"><ClipboardList size={21} className="text-sage" /><h2 className="text-lg font-bold">رکورد ویزیت</h2></div><p className="helper mt-2">هر مراجعه را با تاریخ خودش ثبت کنید تا روند وزن قابل پیگیری شود.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><DateField label="تاریخ" value={recordForm.record_date} onChange={(value) => setRecordForm({ ...recordForm, record_date: value })} /><NumberField label="وزن" value={recordForm.weight_kg} onChange={(value) => setRecordForm({ ...recordForm, weight_kg: value })} suffix="کیلوگرم" /><NumberField label="قد" value={recordForm.height_cm} onChange={(value) => setRecordForm({ ...recordForm, height_cm: value })} suffix="سانتی‌متر" /><div className="sm:col-span-2"><label className="label">یادداشت ویزیت</label><textarea className="control mt-2 min-h-24 w-full py-3" value={recordForm.notes} onChange={(event) => setRecordForm({ ...recordForm, notes: event.target.value })} /></div></div><div className="mt-5"><SecondaryButton icon={Plus} onClick={saveRecord}>ثبت رکورد</SecondaryButton></div></div><div className="rounded-card border border-warm-100 bg-white p-5"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><TrendingUp size={21} className="text-sage" /><h2 className="text-lg font-bold">روند وزن</h2></div><span className="text-xs text-warm-500">{formatNumber(records.length)} رکورد</span></div>{records.length === 0 ? <EmptyState icon={CalendarDays} title="هنوز رکوردی ثبت نشده" text="اولین ویزیت را از فرم کنار صفحه ثبت کنید." /> : <WeightHistory records={records} />}</div></div>}<div className="mt-6"><SecondaryButton onClick={onBack}>بازگشت به فهرست</SecondaryButton></div></section></>;
}

function CalculationsScreen({ initialClient, settings, toast }: { initialClient: Client | null; settings: Settings; toast: ToastFn }) {
  const [selected, setSelected] = useState<Client | null>(initialClient);
  const [input, setInput] = useState<Client>(initialClient ?? emptyClient);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Client[]>([]);
  const [overrides, setOverrides] = useState({ calories: "", proteinPercent: "", carbsPercent: "", fatPercent: "" });
  useEffect(() => { setSelected(initialClient); setInput(initialClient ?? emptyClient); }, [initialClient]);
  useEffect(() => {
    if (!query.trim() || !isDesktopRuntime()) { setResults([]); return; }
    const timer = window.setTimeout(() => invoke<Client[]>("search_clients", { query }).then((items) => setResults(items.map(normalizeClient))).catch(() => setResults([])), 150);
    return () => window.clearTimeout(timer);
  }, [query]);
  const calc = calculateNutrition(input, settings);
  const calories = Number(overrides.calories) || calc.targetCalories;
  const proteinPercent = Number(overrides.proteinPercent) || calc.proteinPercent;
  const carbsPercent = Number(overrides.carbsPercent) || calc.carbsPercent;
  const fatPercent = Number(overrides.fatPercent) || calc.fatPercent;
  const protein = (calories * (proteinPercent / 100)) / 4;
  const carbs = (calories * (carbsPercent / 100)) / 4;
  const fat = (calories * (fatPercent / 100)) / 9;
  const setField = <K extends keyof Client>(key: K, value: Client[K]) => setInput((current) => ({ ...current, [key]: value }));
  const choose = (client: Client) => { setSelected(client); setInput(client); setQuery(""); setResults([]); toast("اطلاعات مراجع در محاسبات قرار گرفت."); };
  const clear = () => { setSelected(null); setInput(emptyClient); setQuery(""); setOverrides({ calories: "", proteinPercent: "", carbsPercent: "", fatPercent: "" }); };
  return <><PageHeader title="محاسبات تغذیه‌ای" subtitle="BMI، IBW، ABW، BMR، TEE، کالری هدف و ماکروها بر اساس تنظیمات متخصص محاسبه می‌شوند." /><div className="grid gap-5 xl:grid-cols-[430px_1fr]"><section className="card p-6"><div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">ورودی‌ها</h2><p className="helper mt-1">{selected ? `مراجع انتخاب‌شده: ${selected.full_name}` : "حالت ورود دستی فعال است."}</p></div>{selected && <SecondaryButton icon={RotateCcw} onClick={clear}>ورود دستی</SecondaryButton>}</div><div className="relative mb-5"><Search className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-warm-500" size={20} /><input className="control w-full pr-12" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی مراجع ذخیره‌شده" />{results.length > 0 && <div className="absolute z-10 mt-2 max-h-72 w-full overflow-auto rounded-card border border-warm-100 bg-paper p-2 shadow-soft">{results.map((client) => <button key={client.id} onClick={() => choose(client)} className="soft-transition flex w-full items-center justify-between rounded-control px-3 py-3 text-right hover:bg-warm-50"><span className="font-semibold">{client.full_name}</span><span className="text-xs text-warm-500">{goalLabels[client.goal]}</span></button>)}</div>}</div><div className="grid gap-4"><SelectField label="جنسیت" value={input.gender} onChange={(value) => setField("gender", value as Gender)} options={genderLabels} /><NumberField label="سن" value={input.age} onChange={(value) => setField("age", value)} suffix="سال" /><NumberField label="قد" value={input.height_cm} onChange={(value) => setField("height_cm", value)} suffix="سانتی‌متر" /><NumberField label="وزن" value={input.weight_kg} onChange={(value) => setField("weight_kg", value)} suffix="کیلوگرم" /><SelectField label="سطح فعالیت" value={input.activity_level} onChange={(value) => setField("activity_level", value as ActivityLevel)} options={activityLabels} /><SelectField label="هدف" value={input.goal} onChange={(value) => setField("goal", value as Goal)} options={goalLabels} /></div><div className="mt-6 rounded-card bg-warm-50 p-4"><p className="text-sm font-bold">اصلاح دستی</p><p className="helper mt-1">به‌جای گرم، درصد کالری ماکروها را وارد کنید؛ گرم‌ها خودکار محاسبه می‌شوند.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><OverrideField label="کالری هدف" value={overrides.calories} onChange={(value) => setOverrides({ ...overrides, calories: value })} /><OverrideField label="پروتئین ٪" value={overrides.proteinPercent} onChange={(value) => setOverrides({ ...overrides, proteinPercent: value })} /><OverrideField label="کربوهیدرات ٪" value={overrides.carbsPercent} onChange={(value) => setOverrides({ ...overrides, carbsPercent: value })} /><OverrideField label="چربی ٪" value={overrides.fatPercent} onChange={(value) => setOverrides({ ...overrides, fatPercent: value })} /></div></div></section><section className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-3"><ResultCard title="BMI" value={formatNumber(calc.bmi, 1)} unit={bmiCategory(calc.bmi)} text="نمای سریع وضعیت وزنی بر اساس قد و وزن." /><ResultCard title="IBW" value={formatNumber(calc.ibw, 1)} unit="کیلوگرم" text="۲۲ × قد به متر²" /><ResultCard title="ABW" value={formatNumber(calc.abw, 1)} unit="کیلوگرم" text="IBW + (وزن واقعی - IBW) / ۴" /><ResultCard title="BMR" value={formatNumber(calc.bmr)} unit="کیلوکالری" text="۲۴ × ضریب جنسیت × ABW × ۱.۱" /><ResultCard title="TEE" value={formatNumber(calc.tee)} unit="کیلوکالری" text={`BMR × ضریب فعالیت: ${formatNumber(calc.activityFactor, 2)}`} /><ResultCard title="کالری هدف" value={formatNumber(calories)} unit="کیلوکالری" text="پیش‌فرض بر اساس TEE و قابل اصلاح دستی." featured /><ResultCard title="پروتئین" value={formatNumber(protein)} unit="گرم" text={`${formatNumber(proteinPercent)}٪ از کالری هدف.`} /><ResultCard title="کربوهیدرات" value={formatNumber(carbs)} unit="گرم" text={`${formatNumber(carbsPercent)}٪ از کالری هدف.`} /><ResultCard title="چربی" value={formatNumber(fat)} unit="گرم" text={`${formatNumber(fatPercent)}٪ از کالری هدف.`} /></section></div></>;
}

function SettingsScreen({ settings, setSettings, toast }: { settings: Settings; setSettings: (settings: Settings) => void; toast: ToastFn }) {
  const [form, setForm] = useState<Settings>(withDefaults(settings));
  const [credentials, setCredentials] = useState({ current_password: "", username: settings.username || "admin", password: "", repeat: "" });
  useEffect(() => setForm(withDefaults(settings)), [settings]);
  const save = async () => { try { const saved = isDesktopRuntime() ? await invoke<Settings>("save_settings", { settings: form }) : form; setSettings(withDefaults(saved)); toast("تنظیمات ذخیره شد."); } catch { toast("ذخیره تنظیمات انجام نشد.", "error"); } };
  const changeCredentials = async () => { if (!credentials.username.trim() || credentials.password.length < 4 || credentials.password !== credentials.repeat) { toast("نام کاربری و رمز جدید را درست وارد کنید.", "error"); return; } try { if (isDesktopRuntime()) await invoke("change_credentials", { input: { current_password: credentials.current_password, username: credentials.username, password: credentials.password } }); setSettings({ ...settings, username: credentials.username }); setCredentials({ current_password: "", username: credentials.username, password: "", repeat: "" }); toast("اطلاعات ورود تغییر کرد."); } catch { toast("رمز فعلی درست نیست یا تغییر انجام نشد.", "error"); } };
  const exportData = async () => { try { const path = await invoke<string>("export_data_backup"); toast(`فایل سبک ذخیره شد: ${path}`); } catch { toast("ساخت فایل پشتیبان انجام نشد.", "error"); } };
  const restoreData = async () => { try { const selected = await open({ multiple: false, filters: [{ name: "Dietoy backup", extensions: ["json"] }] }); if (!selected || Array.isArray(selected)) return; await invoke("restore_data_backup", { path: selected }); const restored = await invoke<Settings>("get_settings"); setSettings(withDefaults(restored)); toast("اطلاعات قبلی بازیابی شد."); } catch { toast("بازیابی انجام نشد.", "error"); } };
  const exportSqlite = async () => { try { const path = await invoke<string>("export_database"); toast(`کپی SQLite ذخیره شد: ${path}`); } catch { toast("خروجی SQLite انجام نشد.", "error"); } };
  const chooseBrandImage = async (kind: "logo" | "background") => { try { const selected = await open({ multiple: false, filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif", "svg"] }] }); if (!selected || Array.isArray(selected)) return; const imported = isDesktopRuntime() ? await invoke<string>("import_brand_asset", { path: selected, kind }) : selected; setForm((current) => kind === "logo" ? { ...current, logo_path: imported } : { ...current, background_image_path: imported }); toast(kind === "logo" ? "لوگو انتخاب شد. ذخیره را بزنید." : "عکس پس‌زمینه انتخاب شد. ذخیره را بزنید."); } catch { toast("انتخاب تصویر انجام نشد.", "error"); } };
  const applyDietoyTheme = () => { setForm((current) => ({ ...current, primary_color: dietoyTheme.primary_color, background_color: dietoyTheme.background_color, text_color: dietoyTheme.text_color })); toast("تم دایتوری اعمال شد. برای ماندن دائمی ذخیره را بزنید."); };
  const setCalc = (key: keyof Settings, value: number) => setForm((current) => ({ ...current, [key]: value }));
  return <><PageHeader title="تنظیمات" subtitle="شخصی‌سازی برند، فرمول‌های محاسباتی، ورود و پشتیبان‌گیری." action={<PrimaryButton icon={Save} onClick={save}>ذخیره</PrimaryButton>} /><section className="grid gap-5 xl:grid-cols-[1fr_0.72fr]"><div className="grid gap-5"><div className="card p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-bold">تنظیمات محاسبات تغذیه‌ای</h2><p className="helper mt-1">این مقادیر پیش‌فرض محاسبات هستند و متخصص می‌تواند تغییرشان دهد.</p></div><Calculator className="text-sage" size={24} /></div><div className="grid gap-4 md:grid-cols-3"><NumberField label="ضریب IBW" value={form.calc_ibw_bmi_factor || 22} onChange={(value) => setCalc("calc_ibw_bmi_factor", value)} suffix="× قد²" /><NumberField label="تقسیم ABW" value={form.calc_abw_divisor || 4} onChange={(value) => setCalc("calc_abw_divisor", value)} suffix="عدد" /><NumberField label="ضریب پایه BMR" value={form.calc_bmr_base || 24} onChange={(value) => setCalc("calc_bmr_base", value)} suffix="عدد" /><NumberField label="ضریب مرد" value={form.calc_male_factor || 1} onChange={(value) => setCalc("calc_male_factor", value)} suffix="×" /><NumberField label="ضریب زن" value={form.calc_female_factor || 0.95} onChange={(value) => setCalc("calc_female_factor", value)} suffix="×" /><NumberField label="ضریب تکمیلی BMR" value={form.calc_bmr_adjustment || 1.1} onChange={(value) => setCalc("calc_bmr_adjustment", value)} suffix="×" /><NumberField label="فعالیت کم" value={form.calc_activity_sedentary || 1.3} onChange={(value) => setCalc("calc_activity_sedentary", value)} suffix="×" /><NumberField label="فعالیت سبک" value={form.calc_activity_light || 1.3} onChange={(value) => setCalc("calc_activity_light", value)} suffix="×" /><NumberField label="فعالیت متوسط" value={form.calc_activity_moderate || 1.3} onChange={(value) => setCalc("calc_activity_moderate", value)} suffix="×" /><NumberField label="فعال" value={form.calc_activity_active || 1.3} onChange={(value) => setCalc("calc_activity_active", value)} suffix="×" /><NumberField label="بسیار فعال" value={form.calc_activity_very_active || 1.3} onChange={(value) => setCalc("calc_activity_very_active", value)} suffix="×" /><NumberField label="کاهش وزن" value={form.calc_goal_loss ?? -500} onChange={(value) => setCalc("calc_goal_loss", value)} suffix="kcal" allowNegative /><NumberField label="ثبات وزن" value={form.calc_goal_maintain ?? 0} onChange={(value) => setCalc("calc_goal_maintain", value)} suffix="kcal" allowNegative /><NumberField label="افزایش وزن" value={form.calc_goal_gain || 300} onChange={(value) => setCalc("calc_goal_gain", value)} suffix="kcal" allowNegative /><NumberField label="پروتئین" value={form.macro_protein_percent || 20} onChange={(value) => setCalc("macro_protein_percent", value)} suffix="٪" /><NumberField label="کربوهیدرات" value={form.macro_carb_percent || 50} onChange={(value) => setCalc("macro_carb_percent", value)} suffix="٪" /><NumberField label="چربی" value={form.macro_fat_percent || 30} onChange={(value) => setCalc("macro_fat_percent", value)} suffix="٪" /></div></div><div className="card p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">برند و ظاهر</h2><Palette className="text-sage" size={23} /></div><div className="grid gap-5 md:grid-cols-2"><TextField label="نام متخصص تغذیه" value={form.dietitian_name} onChange={(value) => setForm({ ...form, dietitian_name: value })} /><TextField label="نام کلینیک" value={form.clinic_name} onChange={(value) => setForm({ ...form, clinic_name: value })} /><ColorField label="رنگ اصلی" value={form.primary_color} fallback={defaultSettings.primary_color} onChange={(value) => setForm({ ...form, primary_color: value })} /><ColorField label="رنگ پس‌زمینه" value={form.background_color} fallback={defaultSettings.background_color} onChange={(value) => setForm({ ...form, background_color: value })} /><ColorField label="رنگ متن" value={form.text_color} fallback={defaultSettings.text_color} onChange={(value) => setForm({ ...form, text_color: value })} /><div className="flex items-end"><SecondaryButton icon={Palette} onClick={applyDietoyTheme}>اعمال تم دایتوری</SecondaryButton></div><BrandAsset title="لوگو" path={form.logo_path} onChoose={() => chooseBrandImage("logo")} onClear={() => setForm({ ...form, logo_path: "" })} /><BrandAsset title="پس‌زمینه" path={form.background_image_path} onChoose={() => chooseBrandImage("background")} onClear={() => setForm({ ...form, background_image_path: "" })} /></div></div></div><div className="grid gap-5"><div className="card p-6"><h2 className="text-xl font-bold">ورود</h2><div className="mt-5 grid gap-4"><PasswordField label="رمز فعلی" value={credentials.current_password} onChange={(value) => setCredentials({ ...credentials, current_password: value })} /><TextField label="نام کاربری جدید" value={credentials.username} onChange={(value) => setCredentials({ ...credentials, username: value })} /><PasswordField label="رمز جدید" value={credentials.password} onChange={(value) => setCredentials({ ...credentials, password: value })} /><PasswordField label="تکرار رمز" value={credentials.repeat} onChange={(value) => setCredentials({ ...credentials, repeat: value })} /><SecondaryButton icon={KeyRound} onClick={changeCredentials}>تغییر ورود</SecondaryButton></div></div><div className="card p-6"><h2 className="text-xl font-bold">پشتیبان‌گیری و آپدیت</h2><p className="helper mt-2">اطلاعات روی همین دستگاه می‌ماند. قبل از آپدیت هم installer پشتیبان ایمنی می‌سازد.</p><div className="mt-5 grid gap-3"><SecondaryButton icon={Download} onClick={exportData}>خروجی سبک JSON</SecondaryButton><SecondaryButton icon={FileUp} onClick={restoreData}>بازیابی JSON</SecondaryButton><SecondaryButton icon={Database} onClick={exportSqlite}>کپی کامل SQLite</SecondaryButton></div></div></div></section></>;
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) { return <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><h1 className="text-3xl font-bold text-charcoal">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-warm-500">{subtitle}</p></div>{action}</header>; }
function PrimaryButton({ children, icon: Icon, type = "button", onClick }: { children: React.ReactNode; icon?: LucideIcon; type?: "button" | "submit"; onClick?: () => void }) { return <button type={type} onClick={onClick} className="soft-transition inline-flex h-12 items-center justify-center gap-2 rounded-control bg-[var(--primary)] px-5 text-sm font-bold text-white shadow-lift hover:opacity-95">{Icon && <Icon size={19} />}{children}</button>; }
function SecondaryButton({ children, icon: Icon, onClick }: { children: React.ReactNode; icon?: LucideIcon; onClick?: () => void }) { return <button type="button" onClick={onClick} className="soft-transition inline-flex h-11 items-center justify-center gap-2 rounded-control border border-warm-100 bg-white px-4 text-sm font-semibold text-charcoal hover:bg-warm-50">{Icon && <Icon size={18} />}{children}</button>; }
function Stat({ label, value, icon: Icon }: { label: string; value?: number; icon: LucideIcon }) { return <div className="card p-5"><Icon size={22} className="text-sage" /><p className="mt-5 text-sm text-warm-500">{label}</p><p className="numbers mt-2 text-4xl font-bold">{value === undefined ? "—" : formatNumber(value)}</p></div>; }
function ResultCard({ title, value, unit, text, featured = false }: { title: string; value: string; unit: string; text: string; featured?: boolean }) { return <div className={cn("card p-5", featured && "border-[var(--primary)] bg-[#fffef9]")}><p className="text-sm font-semibold text-warm-500">{title}</p><div className="mt-5 flex items-end gap-2"><p className="numbers text-4xl font-bold text-charcoal">{value}</p><p className="pb-1 text-sm text-olive">{unit}</p></div><p className="mt-4 text-xs leading-6 text-warm-500">{text}</p></div>; }
function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) { return <div><label className="label">{label}</label><input className="control mt-2 w-full" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></div>; }
function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div><label className="label">{label}</label><input className="control mt-2 w-full" type="password" value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" /></div>; }
function IconInput({ icon: Icon, label, value, onChange, type = "text", autoComplete }: { icon: LucideIcon; label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string }) { return <div><label className="label">{label}</label><div className="mt-2 flex h-12 items-center gap-3 rounded-control border border-warm-200 bg-white px-4 focus-within:border-[var(--primary)] focus-within:ring-4 focus-within:ring-emerald/10"><Icon size={19} className="text-warm-500" /><input className="min-w-0 flex-1 border-0 bg-transparent outline-none" type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} /></div></div>; }
function NumberField({ label, value, onChange, suffix, allowNegative = false }: { label: string; value: number; onChange: (value: number) => void; suffix: string; allowNegative?: boolean }) { return <div><label className="label">{label}</label><div className="mt-2 flex h-12 items-center rounded-control border border-warm-200 bg-white px-4 focus-within:border-[var(--primary)] focus-within:ring-4 focus-within:ring-emerald/10"><input className="numbers min-w-0 flex-1 border-0 bg-transparent text-left outline-none" type="number" min={allowNegative ? undefined : 0} step="any" value={value} onChange={(event) => onChange(Number(event.target.value))} /><span className="text-xs text-warm-500">{suffix}</span></div></div>; }
function DateField({ label, value, onChange, compact = false }: { label: string; value: string; onChange: (value: string) => void; compact?: boolean }) { return <div><label className={compact ? "text-xs font-medium text-warm-500" : "label"}>{label}</label><input className="control numbers mt-2 w-full text-left" type="date" value={value} onChange={(event) => onChange(event.target.value)} />{value && !compact && <p className="helper mt-1">{formatPersianDate(value)}</p>}</div>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Record<string, string> }) { return <div><label className="label">{label}</label><SelectPlain value={value} onChange={onChange} options={options} className="mt-2" /></div>; }
function SelectPlain({ value, onChange, options, className }: { value: string; onChange: (value: string) => void; options: Record<string, string>; className?: string }) { return <select className={cn("control w-full", className)} value={value} onChange={(event) => onChange(event.target.value)}>{Object.entries(options).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select>; }
function ColorField({ label, value, fallback, onChange }: { label: string; value: string; fallback: string; onChange: (value: string) => void }) { return <div><label className="label">{label}</label><div className="mt-2 flex h-12 items-center gap-3 rounded-control border border-warm-200 bg-white px-3"><input type="color" value={colorValue(value, fallback)} onChange={(event) => onChange(event.target.value)} className="h-8 w-12 cursor-pointer border-0 bg-transparent p-0" /><input value={value} onChange={(event) => onChange(event.target.value)} className="numbers min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" /></div></div>; }
function BrandAsset({ title, path, onChoose, onClear }: { title: string; path: string; onChoose: () => void; onClear: () => void }) { return <div className="rounded-card border border-warm-100 bg-warm-50 p-4"><div className="mb-3 flex items-center gap-2"><ImageIcon size={19} className="text-sage" /><p className="font-bold">{title}</p></div>{path ? <img src={assetUrl(path)} className="mb-3 h-24 w-full rounded-control bg-white object-contain p-2" /> : <p className="helper mb-3">تصویری انتخاب نشده است.</p>}<div className="flex gap-2"><SecondaryButton icon={ImageIcon} onClick={onChoose}>انتخاب از سیستم</SecondaryButton>{path && <SecondaryButton onClick={onClear}>حذف</SecondaryButton>}</div></div>; }
function OverrideField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="text-xs font-medium text-warm-500">{label}</span><input className="control numbers mt-1 h-11 w-full text-left" type="number" min="0" step="any" value={value} onChange={(event) => onChange(event.target.value)} placeholder="خودکار" /></label>; }
function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) { return <div className="grid place-items-center py-8 text-center"><div className="grid h-14 w-14 place-items-center rounded-card bg-warm-50 text-sage"><Icon size={25} /></div><h3 className="mt-4 text-lg font-bold">{title}</h3><p className="mt-2 text-sm text-warm-500">{text}</p></div>; }
function SkeletonRows() { return <div className="grid gap-3">{[0, 1, 2].map((item) => <div key={item} className="card flex animate-pulse items-center justify-between p-5"><div><div className="h-5 w-40 rounded bg-warm-100" /><div className="mt-3 h-4 w-64 rounded bg-warm-100" /></div><div className="h-10 w-28 rounded-control bg-warm-100" /></div>)}</div>; }
function ToastStack({ toasts }: { toasts: Toast[] }) { return <div className="fixed bottom-5 left-5 z-50 grid gap-2">{toasts.map((toast) => <div key={toast.id} className={cn("flex min-h-12 items-center gap-3 rounded-control border bg-paper px-4 text-sm shadow-soft", toast.kind === "error" ? "border-red-200 text-red-700" : "border-warm-100 text-charcoal")}><CheckCircle2 size={18} className={toast.kind === "error" ? "text-red-500" : "text-[var(--primary)]"} /><span>{toast.text}</span></div>)}</div>; }
function WeightHistory({ records }: { records: ClientRecord[] }) { const weights = records.map((record) => record.weight_kg); const min = Math.min(...weights); const max = Math.max(...weights); const range = Math.max(max - min, 1); const points = records.map((record, index) => ({ x: records.length === 1 ? 250 : 24 + (index * 452) / (records.length - 1), y: 156 - ((record.weight_kg - min) * 116) / range, record })); const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" "); return <div><svg viewBox="0 0 500 190" className="h-48 w-full overflow-visible" role="img" aria-label="نمودار تغییر وزن"><line x1="24" y1="156" x2="476" y2="156" stroke="#d8cbb9" strokeWidth="1" /><line x1="24" y1="40" x2="24" y2="156" stroke="#d8cbb9" strokeWidth="1" /><path d={path} fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />{points.map((point) => <g key={`${point.record.record_date}-${point.record.id ?? point.x}`}><circle cx={point.x} cy={point.y} r="6" fill="var(--primary)" /><text x={point.x} y={point.y - 12} textAnchor="middle" className="numbers fill-warm-500 text-[11px]">{formatNumber(point.record.weight_kg, 1)}</text></g>)}</svg><div className="mt-4 grid gap-2">{[...records].reverse().map((record) => <div key={record.id ?? `${record.record_date}-${record.weight_kg}`} className="rounded-control border border-warm-100 bg-warm-50 px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{formatPersianDate(record.record_date)}</span><span className="numbers text-sm text-olive">{formatNumber(record.weight_kg, 1)} kg</span></div>{record.notes && <p className="mt-2 text-xs leading-6 text-warm-500">{record.notes}</p>}</div>)}</div></div>; }
