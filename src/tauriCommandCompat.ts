type TauriInternals = {
  invoke?: (command: string, args?: Record<string, unknown>, options?: unknown) => Promise<unknown>;
};

type ServiceCatalogItem = {
  id?: number;
  name: string;
  default_price: number;
  default_duration_minutes?: number | null;
  body_area_required: boolean;
  active: boolean;
};

const STORAGE_KEY = "dietoy.serviceCatalog.compat.v1";

const defaultServices: ServiceCatalogItem[] = [
  { id: 1, name: "ویزیت تغذیه", default_price: 0, default_duration_minutes: 30, body_area_required: false, active: true },
  { id: 2, name: "آنالیز بدن", default_price: 0, default_duration_minutes: 20, body_area_required: false, active: true },
  { id: 3, name: "تنظیم برنامه غذایی", default_price: 0, default_duration_minutes: 45, body_area_required: false, active: true },
];

function readCatalog() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultServices;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed as ServiceCatalogItem[] : defaultServices;
  } catch {
    return defaultServices;
  }
}

function writeCatalog(items: ServiceCatalogItem[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage may be unavailable; the current runtime session still continues.
  }
}

function normalizeCatalogItem(input: unknown): ServiceCatalogItem {
  const item = (input ?? {}) as Partial<ServiceCatalogItem>;
  return {
    id: typeof item.id === "number" ? item.id : Date.now(),
    name: String(item.name ?? "خدمت جدید").trim() || "خدمت جدید",
    default_price: Number(item.default_price ?? 0) || 0,
    default_duration_minutes: item.default_duration_minutes == null ? null : Number(item.default_duration_minutes),
    body_area_required: Boolean(item.body_area_required),
    active: item.active !== false,
  };
}

function installCompat() {
  const internals = (window as unknown as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__;
  if (!internals?.invoke || (internals.invoke as unknown as { __dietoyCompat?: boolean }).__dietoyCompat) return;

  const originalInvoke = internals.invoke.bind(internals);
  const wrapped = async (command: string, args: Record<string, unknown> = {}, options?: unknown) => {
    if (command === "import_attachment") {
      const attachment = {
        client_id: args.clientId,
        visit_id: args.visitId ?? null,
        category: args.category ?? "other",
        title: args.title ?? "",
        file_name: "",
        local_path: "",
        attachment_date: args.attachmentDate ?? "",
        notes: args.notes ?? "",
      };
      return originalInvoke("import_visit_attachment", { sourcePath: args.path, attachment }, options);
    }

    if (command === "list_service_catalog") {
      const activeOnly = Boolean(args.activeOnly);
      const items = readCatalog();
      return activeOnly ? items.filter((item) => item.active !== false) : items;
    }

    if (command === "save_service_catalog_item") {
      const next = normalizeCatalogItem(args.item);
      const items = readCatalog();
      const index = items.findIndex((item) => item.id === next.id);
      const updated = index >= 0
        ? items.map((item) => item.id === next.id ? next : item)
        : [...items, next];
      writeCatalog(updated);
      return next;
    }

    return originalInvoke(command, args, options);
  };
  (wrapped as unknown as { __dietoyCompat?: boolean }).__dietoyCompat = true;
  internals.invoke = wrapped;
}

installCompat();
