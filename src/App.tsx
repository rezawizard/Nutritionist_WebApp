import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Archive,
  Calculator,
  CheckCircle2,
  Database,
  Download,
  FileUp,
  Home,
  KeyRound,
  Leaf,
  LogOut,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  activityLabels,
  bmiCategory,
  calculateNutrition,
  cn,
  emptyClient,
  formatNumber,
  genderLabels,
  goalLabels,
} from "./lib";
import type { ActivityLevel, Client, DashboardStats, Gender, Goal, Screen, Settings } from "./types";

const defaultSettings: Settings = {
  dietitian_name: "",
  clinic_name: "",
  primary_color: "#0f5b46",
  username: "admin",
};

type Toast = { id: number; text: string; kind?: "success" | "error" };
type ToastFn = (text: string, kind?: Toast["kind"]) => void;

function isDesktopRuntime() {
  return Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
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
        setSettings(next);
        document.documentElement.style.setProperty("--primary", next.primary_color || defaultSettings.primary_color);
      })
      .catch(() => push("تنظیمات خوانده نشد.", "error"));
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
    return <LoginScreen onLogin={() => setUnlocked(true)} toast={push} toasts={toasts} />;
  }

  return (
    <div className="app-shell min-h-screen bg-ivory text-charcoal" dir="rtl">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-72 border-l border-warm-100 bg-paper/90 px-5 py-6 lg:block">
          <Brand settings={settings} />
          <nav className="mt-9 grid gap-2">
            <NavItem active={screen === "dashboard"} icon={Home} label="داشبورد" onClick={() => setScreen("dashboard")} />
            <NavItem active={screen === "clients" || screen === "client-form"} icon={Users} label="مراجعین" onClick={() => setScreen("clients")} />
            <NavItem active={screen === "calculator"} icon={Calculator} label="ماشین حساب" onClick={() => openCalculator()} />
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
            <ClientForm
              client={editing}
              onBack={() => setScreen("clients")}
              onSaved={(client) => {
                setEditing(client);
                setVersion((value) => value + 1);
              }}
              toast={push}
            />
          )}
          {screen === "calculator" && <CalculatorScreen initialClient={calculatorClient} toast={push} />}
          {screen === "settings" && (
            <SettingsScreen
              settings={settings}
              setSettings={(next) => {
                setSettings(next);
                document.documentElement.style.setProperty("--primary", next.primary_color || defaultSettings.primary_color);
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

function Brand({ settings }: { settings: Settings }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-12 w-12 place-items-center rounded-control bg-[var(--primary)] text-white shadow-lift">
        <Leaf size={23} />
      </div>
      <div>
        <p className="text-lg font-bold">{settings.clinic_name || "مطب تغذیه"}</p>
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
      <button className={cn(item, screen === "calculator" && "bg-[var(--primary)] text-white")} onClick={openCalculator} aria-label="ماشین حساب"><Calculator size={20} /></button>
      <button className={cn(item, screen === "settings" && "bg-[var(--primary)] text-white")} onClick={() => setScreen("settings")} aria-label="تنظیمات"><SettingsIcon size={20} /></button>
    </div>
  );
}

function LoginScreen({ onLogin, toast, toasts }: { onLogin: () => void; toast: ToastFn; toasts: Toast[] }) {
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
    } catch {
      toast("ورود انجام نشد.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell min-h-screen bg-ivory text-charcoal" dir="rtl">
      <main className="grid min-h-screen place-items-center px-5 py-8">
        <section className="login-card w-full max-w-[980px] overflow-hidden rounded-[28px] border border-warm-100 bg-paper shadow-soft md:grid md:grid-cols-[1fr_420px]">
          <div className="relative hidden min-h-[560px] overflow-hidden bg-[var(--primary)] p-9 text-white md:block">
            <div className="luxury-panel-line absolute left-0 top-14 h-px w-64" />
            <div className="luxury-panel-line absolute bottom-20 right-0 h-px w-72 opacity-60" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <div className="grid h-14 w-14 place-items-center rounded-card bg-white/12"><Leaf size={27} /></div>
                <h1 className="mt-8 text-4xl font-bold leading-[1.45]">مطب تغذیه</h1>
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
            <p className="text-sm font-semibold text-olive">ورود امن</p>
            <h2 className="mt-3 text-3xl font-bold">خوش آمدید</h2>
            <p className="mt-3 text-sm leading-7 text-warm-500">برای دسترسی به اطلاعات مراجعین وارد شوید.</p>
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
      setStats({ total_clients: 0, active_clients: 0, recent_clients: [] });
      return;
    }
    setStats(null);
    invoke<DashboardStats>("dashboard_stats").then(setStats).catch(() => setStats({ total_clients: 0, active_clients: 0, recent_clients: [] }));
  }, [version]);

  return (
    <>
      <PageHeader title={settings.dietitian_name ? `سلام، ${settings.dietitian_name}` : "روز آرامی برای مراقبت بهتر"} subtitle="پرونده مراجعین و محاسبات تغذیه‌ای شما روی همین دستگاه ذخیره می‌شود." action={<PrimaryButton icon={Plus} onClick={onNew}>مراجع جدید</PrimaryButton>} />
      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-olive">اقدام سریع</p>
              <h2 className="mt-3 text-2xl font-bold">شروع ویزیت بدون شلوغی</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-warm-500">برای ثبت پرونده تازه یا محاسبه سریع نیاز انرژی و ماکروها، همین‌جا شروع کنید.</p>
            </div>
            <Sparkles className="text-sage" size={28} />
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <PrimaryButton icon={Plus} onClick={onNew}>ثبت مراجع</PrimaryButton>
            <SecondaryButton icon={Calculator} onClick={onCalculator}>ماشین حساب</SecondaryButton>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="همه مراجعین" value={stats?.total_clients} icon={Users} />
          <Stat label="فعال" value={stats?.active_clients} icon={Leaf} />
        </div>
      </section>
      <section className="card mt-5 p-6">
        <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">مراجعین اخیر</h2><Users className="text-sage" size={22} /></div>
        {!stats ? <SkeletonRows /> : stats.recent_clients.length === 0 ? <EmptyState icon={Users} title="هنوز مراجعی ثبت نشده" text="اولین پرونده را بسازید تا این بخش زنده شود." /> : <div className="grid gap-3">{stats.recent_clients.map((client) => <ClientRow key={client.id} client={client} onEdit={() => onEdit(client)} />)}</div>}
      </section>
    </>
  );
}

function Clients({ version, onNew, onEdit, onCalculate, onChanged, toast }: { version: number; onNew: () => void; onEdit: (client: Client) => void; onCalculate: (client: Client) => void; onChanged: () => void; toast: ToastFn }) {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);

  useEffect(() => {
    if (!isDesktopRuntime()) {
      setClients([]);
      return;
    }
    setClients(null);
    invoke<Client[]>("list_clients", { includeArchived }).then(setClients).catch(() => setClients([]));
  }, [version, includeArchived]);

  const filtered = useMemo(() => (clients ?? []).filter((client) => client.full_name.includes(query.trim())), [clients, query]);
  const archive = async (client: Client) => {
    await invoke("archive_client", { id: client.id, archived: !client.archived });
    toast(client.archived ? "مراجع فعال شد." : "مراجع بایگانی شد.");
    onChanged();
  };

  return (
    <>
      <PageHeader title="مراجعین" subtitle="جست‌وجو، ویرایش و مدیریت پرونده‌ها با تمرکز روی اطلاعات لازم در ویزیت." action={<PrimaryButton icon={Plus} onClick={onNew}>مراجع جدید</PrimaryButton>} />
      <section className="card p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-warm-500" size={20} />
            <input className="control w-full pr-12" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی نام مراجع" />
          </div>
          <label className="flex h-12 items-center gap-2 rounded-control border border-warm-100 bg-warm-50 px-4 text-sm text-warm-500">
            <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
            نمایش بایگانی
          </label>
        </div>
        <div className="mt-5 grid gap-3">
          {!clients ? <SkeletonRows /> : filtered.length === 0 ? <EmptyState icon={Search} title="موردی پیدا نشد" text="نام را تغییر دهید یا مراجع جدید ثبت کنید." /> : filtered.map((client) => (
            <ClientRow key={client.id} client={client} onEdit={() => onEdit(client)} onCalculate={() => onCalculate(client)} onArchive={() => archive(client)} />
          ))}
        </div>
      </section>
    </>
  );
}

function ClientForm({ client, onBack, onSaved, toast }: { client: Client | null; onBack: () => void; onSaved: (client: Client) => void; toast: ToastFn }) {
  const [form, setForm] = useState<Client>(client ?? emptyClient);
  useEffect(() => setForm(client ?? emptyClient), [client]);

  const setField = <K extends keyof Client>(key: K, value: Client[K]) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (!form.full_name.trim()) {
      toast("نام مراجع را وارد کنید.", "error");
      return;
    }
    try {
      const saved = await invoke<Client>("save_client", { client: form });
      onSaved(saved);
      toast(client ? "پرونده ذخیره شد." : "مراجع جدید ثبت شد.");
    } catch {
      toast("ذخیره انجام نشد.", "error");
    }
  };

  return (
    <>
      <PageHeader title={client ? "ویرایش مراجع" : "مراجع جدید"} subtitle="اطلاعات پایه برای محاسبه انرژی و پیگیری ویزیت را وارد کنید." action={<PrimaryButton icon={Save} onClick={save}>ذخیره</PrimaryButton>} />
      <section className="card p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <TextField label="نام کامل" value={form.full_name} onChange={(value) => setField("full_name", value)} />
          <SelectField label="جنسیت" value={form.gender} onChange={(value) => setField("gender", value as Gender)} options={genderLabels} />
          <NumberField label="سن" value={form.age} onChange={(value) => setField("age", value)} suffix="سال" />
          <NumberField label="قد" value={form.height_cm} onChange={(value) => setField("height_cm", value)} suffix="سانتی‌متر" />
          <NumberField label="وزن" value={form.weight_kg} onChange={(value) => setField("weight_kg", value)} suffix="کیلوگرم" />
          <SelectField label="سطح فعالیت" value={form.activity_level} onChange={(value) => setField("activity_level", value as ActivityLevel)} options={activityLabels} />
          <SelectField label="هدف" value={form.goal} onChange={(value) => setField("goal", value as Goal)} options={goalLabels} />
          <div className="md:col-span-2">
            <label className="label">یادداشت</label>
            <textarea className="control mt-2 min-h-32 w-full py-3" value={form.notes} onChange={(event) => setField("notes", event.target.value)} />
          </div>
        </div>
        <div className="mt-6"><SecondaryButton onClick={onBack}>بازگشت به فهرست</SecondaryButton></div>
      </section>
    </>
  );
}

function CalculatorScreen({ initialClient, toast }: { initialClient: Client | null; toast: ToastFn }) {
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

  const calc = calculateNutrition(input);
  const calories = Number(overrides.calories) || calc.targetCalories;
  const protein = Number(overrides.protein) || (calories * 0.25) / 4;
  const carbs = Number(overrides.carbs) || (calories * 0.45) / 4;
  const fat = Number(overrides.fat) || (calories * 0.3) / 9;
  const setField = <K extends keyof Client>(key: K, value: Client[K]) => setInput((current) => ({ ...current, [key]: value }));
  const choose = (client: Client) => {
    setSelected(client);
    setInput(client);
    setQuery("");
    setResults([]);
    toast("اطلاعات مراجع در ماشین حساب قرار گرفت.");
  };
  const clear = () => {
    setSelected(null);
    setInput(emptyClient);
    setQuery("");
    setOverrides({ calories: "", protein: "", carbs: "", fat: "" });
  };

  return (
    <>
      <PageHeader title="ماشین حساب تغذیه" subtitle="انتخاب مراجع ذخیره‌شده یا ورود دستی؛ همه نتایج در لحظه به‌روزرسانی می‌شوند." />
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
          <ResultCard title="BMR" value={formatNumber(calc.bmr)} unit="کیلوکالری" text="انرژی پایه بدن با فرمول Mifflin-St Jeor." />
          <ResultCard title="TDEE" value={formatNumber(calc.tdee)} unit="کیلوکالری" text="نیاز روزانه با سطح فعالیت." />
          <ResultCard title="کالری هدف" value={formatNumber(calories)} unit="کیلوکالری" text="بر اساس هدف وزن و قابل اصلاح دستی." featured />
          <ResultCard title="پروتئین" value={formatNumber(protein)} unit="گرم" text="پیش‌فرض ۲۵٪ از کالری هدف." />
          <ResultCard title="کربوهیدرات" value={formatNumber(carbs)} unit="گرم" text="پیش‌فرض ۴۵٪ از کالری هدف." />
          <ResultCard title="چربی" value={formatNumber(fat)} unit="گرم" text="پیش‌فرض ۳۰٪ از کالری هدف." />
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
    } catch {
      toast("ذخیره تنظیمات انجام نشد.", "error");
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
    } catch {
      toast("رمز فعلی درست نیست یا تغییر انجام نشد.", "error");
    }
  };
  const exportData = async () => {
    try {
      const path = await invoke<string>("export_data_backup");
      toast(`فایل سبک ذخیره شد: ${path}`);
    } catch {
      toast("ساخت فایل پشتیبان انجام نشد.", "error");
    }
  };
  const restoreData = async () => {
    try {
      const selected = await open({ multiple: false, filters: [{ name: "Matab Taghzieh backup", extensions: ["json"] }] });
      if (!selected || Array.isArray(selected)) return;
      await invoke("restore_data_backup", { path: selected });
      const restored = await invoke<Settings>("get_settings");
      setSettings(restored);
      toast("اطلاعات قبلی بازیابی شد.");
    } catch {
      toast("بازیابی انجام نشد.", "error");
    }
  };
  const exportSqlite = async () => {
    try {
      const path = await invoke<string>("export_database");
      toast(`کپی SQLite ذخیره شد: ${path}`);
    } catch {
      toast("خروجی SQLite انجام نشد.", "error");
    }
  };

  return (
    <>
      <PageHeader title="تنظیمات" subtitle="شخصی‌سازی مطب، تغییر ورود و پشتیبان‌گیری برای آپدیت‌های آینده." action={<PrimaryButton icon={Save} onClick={save}>ذخیره</PrimaryButton>} />
      <section className="grid gap-5 xl:grid-cols-[1fr_0.75fr]">
        <div className="card p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="نام متخصص تغذیه" value={form.dietitian_name} onChange={(value) => setForm({ ...form, dietitian_name: value })} />
            <TextField label="نام کلینیک" value={form.clinic_name} onChange={(value) => setForm({ ...form, clinic_name: value })} />
            <div>
              <label className="label">رنگ اصلی</label>
              <div className="mt-2 flex h-12 items-center gap-3 rounded-control border border-warm-200 bg-white px-3">
                <Palette size={19} className="text-warm-500" />
                <input type="color" value={form.primary_color} onChange={(event) => setForm({ ...form, primary_color: event.target.value })} className="h-8 w-12 cursor-pointer border-0 bg-transparent p-0" />
                <input value={form.primary_color} onChange={(event) => setForm({ ...form, primary_color: event.target.value })} className="numbers min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" />
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

function PrimaryButton({ children, onClick, icon: Icon, type = "button" }: { children: React.ReactNode; onClick?: () => void; icon?: typeof Plus; type?: "button" | "submit" }) {
  return <button type={type} onClick={onClick} className="soft-transition inline-flex h-12 items-center justify-center gap-2 rounded-control bg-[var(--primary)] px-5 text-sm font-semibold text-white shadow-lift hover:-translate-y-0.5">{Icon && <Icon size={19} />}{children}</button>;
}

function SecondaryButton({ children, onClick, icon: Icon }: { children: React.ReactNode; onClick?: () => void; icon?: typeof Plus }) {
  return <button onClick={onClick} className="soft-transition inline-flex h-12 items-center justify-center gap-2 rounded-control border border-warm-100 bg-paper px-5 text-sm font-semibold text-charcoal hover:bg-warm-50">{Icon && <Icon size={19} />}{children}</button>;
}

function Stat({ label, value, icon: Icon }: { label: string; value?: number; icon: typeof Users }) {
  return <div className="card p-5"><div className="mb-7 flex items-center justify-between text-warm-500"><span className="text-sm">{label}</span><Icon size={21} /></div>{value === undefined ? <div className="h-10 w-20 animate-pulse rounded-control bg-warm-100" /> : <p className="numbers text-4xl font-bold text-charcoal">{formatNumber(value)}</p>}</div>;
}

function ClientRow({ client, onEdit, onCalculate, onArchive }: { client: Client; onEdit: () => void; onCalculate?: () => void; onArchive?: () => void }) {
  return (
    <div className={cn("rounded-card border border-warm-100 bg-white p-4", client.archived && "opacity-60")}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-bold">{client.full_name}</h3>
          <p className="mt-2 text-xs text-warm-500">{genderLabels[client.gender]}، {formatNumber(client.age)} سال، {formatNumber(client.height_cm)} سانتی‌متر، {formatNumber(client.weight_kg)} کیلوگرم، {goalLabels[client.goal]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onCalculate && <SecondaryButton icon={Calculator} onClick={onCalculate}>محاسبه</SecondaryButton>}
          <SecondaryButton icon={Pencil} onClick={onEdit}>ویرایش</SecondaryButton>
          {onArchive && <SecondaryButton icon={Archive} onClick={onArchive}>{client.archived ? "فعال" : "بایگانی"}</SecondaryButton>}
        </div>
      </div>
    </div>
  );
}

function ResultCard({ title, value, unit, text, featured = false }: { title: string; value: string; unit: string; text: string; featured?: boolean }) {
  return <div className={cn("card p-5", featured && "border-[var(--primary)] bg-[#fffef9]")}><p className="text-sm font-semibold text-warm-500">{title}</p><div className="mt-5 flex items-end gap-2"><p className="numbers text-4xl font-bold text-charcoal">{value}</p><p className="pb-1 text-sm text-olive">{unit}</p></div><p className="mt-4 text-xs leading-6 text-warm-500">{text}</p></div>;
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <div><label className="label">{label}</label><input className="control mt-2 w-full" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></div>;
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div><label className="label">{label}</label><input className="control mt-2 w-full" type="password" value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" /></div>;
}

function IconInput({ icon: Icon, label, value, onChange, type = "text", autoComplete }: { icon: typeof UserRound; label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string }) {
  return <div><label className="label">{label}</label><div className="mt-2 flex h-12 items-center gap-3 rounded-control border border-warm-200 bg-white px-4 focus-within:border-[var(--primary)] focus-within:ring-4 focus-within:ring-emerald/10"><Icon size={19} className="text-warm-500" /><input className="min-w-0 flex-1 border-0 bg-transparent outline-none" type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} /></div></div>;
}

function NumberField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (value: number) => void; suffix: string }) {
  return <div><label className="label">{label}</label><div className="mt-2 flex h-12 items-center rounded-control border border-warm-200 bg-white px-4 focus-within:border-[var(--primary)] focus-within:ring-4 focus-within:ring-emerald/10"><input className="numbers min-w-0 flex-1 border-0 bg-transparent text-left outline-none" type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value))} /><span className="text-xs text-warm-500">{suffix}</span></div></div>;
}

function OverrideField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-xs font-medium text-warm-500">{label}</span><input className="control numbers mt-1 h-11 w-full text-left" type="number" min="0" value={value} onChange={(event) => onChange(event.target.value)} placeholder="خودکار" /></label>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Record<string, string> }) {
  return <div><label className="label">{label}</label><select className="control mt-2 w-full" value={value} onChange={(event) => onChange(event.target.value)}>{Object.entries(options).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></div>;
}

function EmptyState({ icon: Icon, title, text }: { icon: typeof Search; title: string; text: string }) {
  return <div className="grid place-items-center py-8 text-center"><div className="grid h-14 w-14 place-items-center rounded-card bg-warm-50 text-sage"><Icon size={25} /></div><h3 className="mt-4 text-lg font-bold">{title}</h3><p className="mt-2 text-sm text-warm-500">{text}</p></div>;
}

function SkeletonRows() {
  return <div className="grid gap-3">{[0, 1, 2].map((item) => <div key={item} className="card flex animate-pulse items-center justify-between p-5"><div><div className="h-5 w-40 rounded bg-warm-100" /><div className="mt-3 h-4 w-64 rounded bg-warm-100" /></div><div className="h-10 w-28 rounded-control bg-warm-100" /></div>)}</div>;
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  return <div className="fixed bottom-5 left-5 z-50 grid gap-2">{toasts.map((toast) => <div key={toast.id} className={cn("flex min-h-12 items-center gap-3 rounded-control border bg-paper px-4 text-sm shadow-soft", toast.kind === "error" ? "border-red-200 text-red-700" : "border-warm-100 text-charcoal")}><CheckCircle2 size={18} className={toast.kind === "error" ? "text-red-500" : "text-[var(--primary)]"} /><span>{toast.text}</span></div>)}</div>;
}
