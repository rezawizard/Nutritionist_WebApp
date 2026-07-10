import { Activity, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatNumber, formatPersianDate } from "../lib";
import type { VisitDetail } from "../types";

type MetricKey = "weight" | "bmi" | "waist" | "abdomen" | "hip" | "chest" | "neck" | "bodyFat" | "fatMass" | "muscle" | "musclePercent" | "bodyWater" | "visceralFat" | "metabolicAge" | "upperAbdomen" | "lowerAbdomen" | "armLeft" | "armRight" | "forearmLeft" | "forearmRight" | "wristLeft" | "wristRight" | "thighLeft" | "thighRight" | "calfLeft" | "calfRight" | "ankleLeft" | "ankleRight";

interface MetricDefinition {
  label: string;
  unit: string;
  get: (visit: VisitDetail) => number | undefined;
}

function extra(visit: VisitDetail, key: string): number | undefined {
  const raw = visit.measurements?.custom_measurements_json;
  if (!raw) return undefined;
  try {
    const value = Number((JSON.parse(raw) as Record<string, unknown>)[key]);
    return Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

const metrics: Record<MetricKey, MetricDefinition> = {
  weight: { label: "وزن", unit: "کیلوگرم", get: (visit) => visit.measurements?.weight_kg },
  bmi: { label: "BMI", unit: "", get: (visit) => visit.measurements?.bmi_snapshot },
  waist: { label: "دور کمر", unit: "سانتی‌متر", get: (visit) => visit.measurements?.waist_cm },
  abdomen: { label: "دور شکم", unit: "سانتی‌متر", get: (visit) => visit.measurements?.abdomen_cm },
  hip: { label: "دور باسن", unit: "سانتی‌متر", get: (visit) => visit.measurements?.hip_cm },
  chest: { label: "دور سینه", unit: "سانتی‌متر", get: (visit) => visit.measurements?.chest_cm },
  neck: { label: "دور گردن", unit: "سانتی‌متر", get: (visit) => visit.measurements?.neck_cm },
  bodyFat: { label: "درصد چربی", unit: "درصد", get: (visit) => visit.measurements?.body_fat_percent },
  fatMass: { label: "توده چربی", unit: "کیلوگرم", get: (visit) => extra(visit, "fat_mass_kg") },
  muscle: { label: "توده عضله", unit: "کیلوگرم", get: (visit) => visit.measurements?.muscle_mass },
  musclePercent: { label: "درصد عضله", unit: "درصد", get: (visit) => extra(visit, "muscle_percent") },
  bodyWater: { label: "آب بدن", unit: "درصد", get: (visit) => extra(visit, "body_water_percent") },
  visceralFat: { label: "چربی احشایی", unit: "", get: (visit) => visit.measurements?.visceral_fat },
  metabolicAge: { label: "سن متابولیک", unit: "سال", get: (visit) => extra(visit, "metabolic_age") },
  upperAbdomen: { label: "بالای شکم", unit: "سانتی‌متر", get: (visit) => extra(visit, "upper_abdomen_cm") },
  lowerAbdomen: { label: "پایین شکم", unit: "سانتی‌متر", get: (visit) => extra(visit, "lower_abdomen_cm") },
  armLeft: { label: "بازوی چپ", unit: "سانتی‌متر", get: (visit) => extra(visit, "upper_arm_left_cm") },
  armRight: { label: "بازوی راست", unit: "سانتی‌متر", get: (visit) => extra(visit, "upper_arm_right_cm") },
  forearmLeft: { label: "ساعد چپ", unit: "سانتی‌متر", get: (visit) => extra(visit, "forearm_left_cm") },
  forearmRight: { label: "ساعد راست", unit: "سانتی‌متر", get: (visit) => extra(visit, "forearm_right_cm") },
  wristLeft: { label: "مچ دست چپ", unit: "سانتی‌متر", get: (visit) => extra(visit, "wrist_left_cm") },
  wristRight: { label: "مچ دست راست", unit: "سانتی‌متر", get: (visit) => extra(visit, "wrist_right_cm") },
  thighLeft: { label: "ران چپ", unit: "سانتی‌متر", get: (visit) => extra(visit, "thigh_left_cm") },
  thighRight: { label: "ران راست", unit: "سانتی‌متر", get: (visit) => extra(visit, "thigh_right_cm") },
  calfLeft: { label: "ساق چپ", unit: "سانتی‌متر", get: (visit) => extra(visit, "calf_left_cm") },
  calfRight: { label: "ساق راست", unit: "سانتی‌متر", get: (visit) => extra(visit, "calf_right_cm") },
  ankleLeft: { label: "مچ پای چپ", unit: "سانتی‌متر", get: (visit) => extra(visit, "ankle_left_cm") },
  ankleRight: { label: "مچ پای راست", unit: "سانتی‌متر", get: (visit) => extra(visit, "ankle_right_cm") },
};

const primaryMetrics: MetricKey[] = ["weight", "bmi", "waist", "abdomen", "hip", "bodyFat", "muscle"];
const regionalMetrics: MetricKey[] = ["chest", "neck", "fatMass", "musclePercent", "bodyWater", "visceralFat", "metabolicAge", "upperAbdomen", "lowerAbdomen", "armLeft", "armRight", "forearmLeft", "forearmRight", "wristLeft", "wristRight", "thighLeft", "thighRight", "calfLeft", "calfRight", "ankleLeft", "ankleRight"];

export default function ClientTrendChart({ visits, targetWeight }: { visits: VisitDetail[]; targetWeight?: number | null }) {
  const [metricKey, setMetricKey] = useState<MetricKey>("weight");
  const [range, setRange] = useState<"all" | "6" | "12">("all");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);
  const metric = metrics[metricKey];

  useEffect(() => {
    if (!moreOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) setMoreOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMoreOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [moreOpen]);

  const data = useMemo(() => {
    const points = visits
      .map((visit) => ({ visit, value: metric.get(visit) }))
      .filter((item): item is { visit: VisitDetail; value: number } => Number.isFinite(item.value))
      .sort((a, b) => a.visit.visit.visit_date.localeCompare(b.visit.visit.visit_date));
    const limit = range === "all" ? points.length : Number(range);
    return points.slice(Math.max(0, points.length - limit));
  }, [visits, metricKey, range]);

  if (data.length < 2) {
    return <div className="trend-empty"><Activity size={30} /><strong>{data.length === 1 ? "اولین نقطه ثبت شد" : "برای رسم روند حداقل دو ویزیت لازم است"}</strong><span>با ثبت اندازه‌گیری در ویزیت‌های بعدی، نمودار خودکار ساخته می‌شود.</span></div>;
  }

  const width = 760;
  const height = 280;
  const left = 50;
  const right = 24;
  const top = 24;
  const bottom = 48;
  const values = data.map((item) => item.value);
  const goalIncluded = metricKey === "weight" && targetWeight && targetWeight > 0 ? [targetWeight] : [];
  const minRaw = Math.min(...values, ...goalIncluded);
  const maxRaw = Math.max(...values, ...goalIncluded);
  const padding = Math.max((maxRaw - minRaw) * 0.18, 1);
  const min = minRaw - padding;
  const max = maxRaw + padding;
  const x = (index: number) => left + index * ((width - left - right) / Math.max(1, data.length - 1));
  const y = (value: number) => top + (max - value) * ((height - top - bottom) / Math.max(1, max - min));
  const path = data.map((item, index) => `${index ? "L" : "M"} ${x(index)} ${y(item.value)}`).join(" ");
  const first = data[0].value;
  const previous = data[data.length - 2].value;
  const last = data[data.length - 1].value;
  const totalDelta = last - first;
  const recentDelta = last - previous;
  const active = activeIndex === null ? null : data[activeIndex];
  const labelEvery = Math.max(1, Math.ceil(data.length / 7));

  return (
    <div className="client-trend-card">
      <div className="trend-toolbar">
        <div className="trend-metric-pills">
          {primaryMetrics.map((key) => <button type="button" key={key} className={metricKey === key ? "active" : ""} onClick={() => setMetricKey(key)}>{metrics[key].label}</button>)}
          <div ref={moreRef} className={`trend-more ${moreOpen ? "trend-more-open" : ""}`}><button type="button" className="trend-more-trigger" onClick={() => setMoreOpen((value) => !value)} aria-expanded={moreOpen}>شاخص‌های بیشتر <ChevronDown size={15} /></button>{moreOpen && <div>{regionalMetrics.map((key) => <button type="button" key={key} className={metricKey === key ? "active" : ""} onClick={() => { setMetricKey(key); setMoreOpen(false); }}>{metrics[key].label}</button>)}</div>}</div>
        </div>
        <div className="trend-range"><button type="button" className={range === "6" ? "active" : ""} onClick={() => setRange("6")}>۶ ویزیت</button><button type="button" className={range === "12" ? "active" : ""} onClick={() => setRange("12")}>۱۲ ویزیت</button><button type="button" className={range === "all" ? "active" : ""} onClick={() => setRange("all")}>همه</button></div>
      </div>
      <div className="trend-kpis"><div><span>شروع</span><strong>{formatNumber(first, 1)} <small>{metric.unit}</small></strong></div><div><span>ویزیت قبلی</span><strong>{formatNumber(previous, 1)} <small>{metric.unit}</small></strong></div><div><span>فعلی</span><strong>{formatNumber(last, 1)} <small>{metric.unit}</small></strong></div><div><span>تغییر از قبلی</span><strong>{recentDelta > 0 ? "+" : ""}{formatNumber(recentDelta, 1)} <small>{metric.unit}</small></strong><small className="trend-total-change">از شروع: {totalDelta > 0 ? "+" : ""}{formatNumber(totalDelta, 1)}</small></div></div>
      <div className="trend-svg-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`نمودار روند ${metric.label}`}>
          {[0, 1, 2, 3, 4].map((index) => {
            const value = min + (max - min) * (index / 4);
            const lineY = y(value);
            return <g key={index}><line x1={left} x2={width - right} y1={lineY} y2={lineY} className="trend-grid-line" /><text x={left - 10} y={lineY + 4} textAnchor="end" className="trend-axis-label">{formatNumber(value, 1)}</text></g>;
          })}
          {metricKey === "weight" && targetWeight && targetWeight > 0 && <g><line x1={left} x2={width - right} y1={y(targetWeight)} y2={y(targetWeight)} className="trend-target-line" /><text x={width - right} y={y(targetWeight) - 7} textAnchor="end" className="trend-target-label">هدف {formatNumber(targetWeight, 1)}</text></g>}
          <path d={path} className="trend-line-shadow" />
          <path d={path} className="trend-line-path" />
          {data.map((item, index) => <g key={`${item.visit.visit.id}-${index}`} onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)}><circle cx={x(index)} cy={y(item.value)} r="5" className="trend-point" /><circle cx={x(index)} cy={y(item.value)} r="18" className="trend-hit" />{(index % labelEvery === 0 || index === data.length - 1) && <text x={x(index)} y={height - 17} textAnchor="middle" className="trend-date-label">{formatPersianDate(item.visit.visit.visit_date).replace(/\//g, "٫")}</text>}</g>)}
          {active && activeIndex !== null && <g className="trend-tooltip"><rect x={Math.min(width - 174, Math.max(8, x(activeIndex) - 82))} y={Math.max(8, y(active.value) - 74)} width="164" height="55" rx="12" /><text x={Math.min(width - 92, Math.max(90, x(activeIndex)))} y={Math.max(29, y(active.value) - 52)} textAnchor="middle">{formatPersianDate(active.visit.visit.visit_date)}</text><text x={Math.min(width - 92, Math.max(90, x(activeIndex)))} y={Math.max(47, y(active.value) - 34)} textAnchor="middle">{formatNumber(active.value, 1)} {metric.unit}</text></g>}
        </svg>
      </div>
    </div>
  );
}
