"use client";

import { useState } from "react";
import {
  calcFaoOmsBmr,
  calcHarrisBmr,
  calcIdealWeight,
  calcIdealWeightHamwi,
  calcIdealWeightLorenz,
  calcIdealWeightMiller,
  calcIdealWeightRobinson,
  calcImc,
  calcKatchMcArdleBmr,
  calcMifflinBmr,
  calcNavyBodyFat,
  calcTargets,
  calcWaterNeeds,
  clamp,
  parseNum,
  roundValue,
} from "./utils";
import { ACTIVITY_LABELS, GOAL_LABELS, getImcCategory } from "./constants";
import type { ActivityLevel, BiologicalSex, NutritionGoal } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

type TmbMethod    = "mifflin" | "harris" | "katch" | "fao";
type IdealMethod  = "devine"  | "robinson" | "miller" | "hamwi" | "lorenz";

// ─── UI primitives ────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, min, max, unit, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  min?: number; max?: number; unit?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number" value={value} onChange={(e) => onChange(e.target.value)}
          min={min} max={max} placeholder={placeholder}
          className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
        />
        {unit && <span className="shrink-0 text-xs text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}

function SexToggle({ value, onChange }: { value: BiologicalSex; onChange: (v: BiologicalSex) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">Sexo biológico</label>
      <div className="flex gap-2">
        {(["femenino", "masculino"] as BiologicalSex[]).map((s) => (
          <button key={s} onClick={() => onChange(s)}
            className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
              value === s
                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                : "border-white/10 bg-slate-800/40 text-slate-400 hover:border-white/20"
            }`}
          >
            {s === "femenino" ? "♀ Femenino" : "♂ Masculino"}
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectField<T extends string>({
  label, value, onChange, options,
}: {
  label: string; value: T; onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function MethodPills<T extends string>({
  value, onChange, options,
}: {
  value: T; onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
            value === o.value
              ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
              : "border-white/5 bg-slate-800/60 text-slate-500 hover:border-white/15 hover:text-slate-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ResultRow({
  label, value, accent, sub,
}: {
  label: string; value: string; accent?: boolean; sub?: string;
}) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
      accent ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-slate-800/50"
    }`}>
      <div>
        <p className="text-sm text-slate-300">{label}</p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
      <span className={`font-bold tabular-nums ${accent ? "text-emerald-400" : "text-slate-100"}`}>{value}</span>
    </div>
  );
}

function ResultCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-900/50 p-4 space-y-3">
      <h3 className="flex items-center gap-2 font-semibold text-slate-200">
        <span>{icon}</span><span>{title}</span>
      </h3>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">{children}</p>
  );
}

// ─── IMC Gauge ────────────────────────────────────────────────────────────────

function ImcGauge({ imc }: { imc: number }) {
  const cat = getImcCategory(imc);
  const pct = clamp(((imc - 10) / 35) * 100, 0, 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] text-slate-600">
        <span>10</span><span>18.5</span><span>25</span><span>30</span><span>40+</span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-blue-500 via-emerald-400 via-40% via-yellow-400 via-65% to-red-500">
        <div className="absolute top-0 h-full w-1.5 rounded-full bg-white"
          style={{ left: `${pct}%`, transform: "translateX(-50%)" }} />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-black" style={{ color: cat.color }}>{imc.toFixed(1)}</span>
        <span className="text-sm font-semibold" style={{ color: cat.color }}>{cat.label}</span>
      </div>
    </div>
  );
}

// ─── Macro Pie ────────────────────────────────────────────────────────────────

function MacroPie({ p, c, g }: { p: number; c: number; g: number }) {
  const total = p * 4 + c * 4 + g * 9;
  if (total <= 0) return null;
  const pPct = (p * 4 / total) * 100;
  const cPct = (c * 4 / total) * 100;
  return (
    <div className="flex items-center gap-4">
      <div className="h-16 w-16 shrink-0 rounded-full" style={{
        background: `conic-gradient(#34d399 0% ${pPct}%, #60a5fa ${pPct}% ${pPct + cPct}%, #fbbf24 ${pPct + cPct}% 100%)`,
      }} />
      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /><span className="text-slate-400">Prot {pPct.toFixed(0)}%</span></div>
        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-400" /><span className="text-slate-400">Carbs {cPct.toFixed(0)}%</span></div>
        <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /><span className="text-slate-400">Grasas {(100 - pPct - cPct).toFixed(0)}%</span></div>
      </div>
    </div>
  );
}

// ─── Risk badge ───────────────────────────────────────────────────────────────

function RiskBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: color + "25", color }}>
      {label}
    </span>
  );
}

// ─── ISAK circumference row ───────────────────────────────────────────────────

function GirthRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  const num = parseFloat(value);
  const hasValue = !isNaN(num) && num > 0;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-800/40 px-3 py-2">
      <span className="text-base">{icon}</span>
      <span className="flex-1 text-sm text-slate-400">{label}</span>
      <span className={`font-semibold tabular-nums text-sm ${hasValue ? "text-slate-100" : "text-slate-600"}`}>
        {hasValue ? `${num} cm` : "—"}
      </span>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TMB_METHODS: { value: TmbMethod; label: string }[] = [
  { value: "mifflin", label: "Mifflin St Jeor" },
  { value: "harris",  label: "Harris-Benedict" },
  { value: "katch",   label: "Katch-McArdle"   },
  { value: "fao",     label: "FAO / OMS"       },
];

const IDEAL_METHODS: { value: IdealMethod; label: string }[] = [
  { value: "devine",   label: "Devine"   },
  { value: "robinson", label: "Robinson" },
  { value: "miller",   label: "Miller"   },
  { value: "hamwi",    label: "Hamwi"    },
  { value: "lorenz",   label: "Lorenz"   },
];

// WHR risk by sex
function getWhrRisk(sexo: BiologicalSex, whr: number): { label: string; color: string } {
  if (sexo === "masculino") {
    if (whr < 0.90) return { label: "Bajo riesgo",     color: "#34d399" };
    if (whr < 1.00) return { label: "Riesgo moderado", color: "#fbbf24" };
    return               { label: "Riesgo alto",      color: "#f87171" };
  } else {
    if (whr < 0.80) return { label: "Bajo riesgo",     color: "#34d399" };
    if (whr < 0.85) return { label: "Riesgo moderado", color: "#fbbf24" };
    return               { label: "Riesgo alto",      color: "#f87171" };
  }
}

// WHtR risk
function getWhtrRisk(whtr: number): { label: string; color: string } {
  if (whtr < 0.50) return { label: "Saludable",        color: "#34d399" };
  if (whtr < 0.60) return { label: "Riesgo aumentado", color: "#fbbf24" };
  return               { label: "Riesgo alto",      color: "#f87171" };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TabCalculadoras() {
  // ── Method selectors ──
  const [tmbMethod,   setTmbMethod]   = useState<TmbMethod>("mifflin");
  const [idealMethod, setIdealMethod] = useState<IdealMethod>("devine");

  // ── Basic biometrics ──
  const [sexo,     setSexo]     = useState<BiologicalSex>("femenino");
  const [edad,     setEdad]     = useState("25");
  const [peso,     setPeso]     = useState("65");
  const [altura,   setAltura]   = useState("165");
  const [actividad, setActividad] = useState<ActivityLevel>("moderado");
  const [objetivo,  setObjetivo]  = useState<NutritionGoal>("mantenimiento");
  const [bodyfat,  setBodyfat]  = useState("20");

  // ── ISAK circumferences ──
  const [c_cuello,        setCuello]        = useState("");
  const [c_busto,         setBusto]         = useState("");
  const [c_brazo_relax,   setBrazoRelax]    = useState("");
  const [c_brazo_contra,  setBrazoContra]   = useState("");
  const [c_antebrazo,     setAntebrazo]     = useState("");
  const [c_cintura,       setCintura]       = useState("");
  const [c_cadera,        setCadera]        = useState("");
  const [c_muslo_prox,    setMusloProx]     = useState("");
  const [c_muslo_medio,   setMusloMedio]    = useState("");
  const [c_pantorrilla,   setPantorrilla]   = useState("");
  const [c_tobillo,       setTobillo]       = useState("");

  // ── Parsed values ──
  const pesoN    = parseNum(peso,    65);
  const alturaN  = parseNum(altura,  165);
  const edadN    = parseNum(edad,    25);
  const bfN      = clamp(parseNum(bodyfat, 20), 2, 60);
  const lbm      = roundValue(pesoN * (1 - bfN / 100));

  const cinturaaN    = parseNum(c_cintura,    0);
  const caderaN      = parseNum(c_cadera,     0);
  const cuelloN      = parseNum(c_cuello,     0);

  // ── TMB per method ──
  const tmbValues: Record<TmbMethod, number> = {
    mifflin: roundValue(calcMifflinBmr(sexo, pesoN, alturaN, edadN)),
    harris:  roundValue(calcHarrisBmr(sexo, pesoN, alturaN, edadN)),
    katch:   calcKatchMcArdleBmr(lbm),
    fao:     calcFaoOmsBmr(sexo, pesoN, edadN),
  };
  const activeTmb = tmbValues[tmbMethod];

  // ── TDEE ──
  const tdeeRatio =
    actividad === "sedentario" ? 1.2  :
    actividad === "ligero"     ? 1.375 :
    actividad === "moderado"   ? 1.55  :
    actividad === "alto"       ? 1.725 : 1.9;
  const goalFactor =
    objetivo === "deficit"       ? 0.85 :
    objetivo === "masa"          ? 1.1  :
    objetivo === "recomposicion" ? 0.97 : 1.0;
  const activeTdee = roundValue(activeTmb * tdeeRatio * goalFactor);
  const targets    = calcTargets(sexo, pesoN, alturaN, edadN, actividad, objetivo);

  // ── Body comp ──
  const imc    = calcImc(pesoN, alturaN);
  const waterL = calcWaterNeeds(pesoN, actividad);

  const navyAvailable = cinturaaN > 0 && cuelloN > 0 && (sexo === "masculino" || caderaN > 0);
  const navyBf = navyAvailable
    ? clamp(calcNavyBodyFat(sexo, alturaN, cinturaaN, cuelloN, caderaN), 3, 60)
    : null;

  // ── Derived indices ──
  const whr  = (cinturaaN > 0 && caderaN > 0) ? roundValue(cinturaaN / caderaN) : null;
  const whtr = (cinturaaN > 0 && alturaN > 0) ? roundValue(cinturaaN / alturaN) : null;

  // ── Ideal weight ──
  const idealValues: Record<IdealMethod, number> = {
    devine:   calcIdealWeight(sexo, alturaN),
    robinson: calcIdealWeightRobinson(sexo, alturaN),
    miller:   calcIdealWeightMiller(sexo, alturaN),
    hamwi:    calcIdealWeightHamwi(sexo, alturaN),
    lorenz:   calcIdealWeightLorenz(sexo, alturaN),
  };
  const activeIdeal = idealValues[idealMethod];

  const actividadOptions = (Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][]).map(([v, l]) => ({ value: v, label: l }));
  const objetivoOptions  = (Object.entries(GOAL_LABELS)    as [NutritionGoal, string][]).map(([v, l]) => ({ value: v, label: l }));

  const faoGroup = edadN < 30 ? "18–30 años" : edadN < 60 ? "30–60 años" : "> 60 años";

  const tmbDesc: Record<TmbMethod, string> = {
    mifflin: "Más precisa para la mayoría · recomendada (1990)",
    harris:  "Fórmula clásica revisada · Roza & Shizgal 1984",
    katch:   `Usa masa magra (${lbm} kg) · ideal para deportistas`,
    fao:     `FAO/OMS/ONU 1985 · grupo etario: ${faoGroup}`,
  };
  const idealDesc: Record<IdealMethod, string> = {
    devine:   "Más usada a nivel clínico (1974)",
    robinson: "Revisión de Devine (1983)",
    miller:   "Tiende a valores mayores (1983)",
    hamwi:    "Muy usada en farmacología (1964)",
    lorenz:   "Popular en Europa y América Latina",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-slate-100">🧮 Calculadora Nutricional</h2>
        <p className="mt-1 text-sm text-slate-400">
          Ingresá los datos y alterná entre métodos en cada sección.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">

        {/* ══════════════════════════════ LEFT: inputs ══════════════════════════════ */}
        <div className="space-y-5">

          {/* Datos básicos */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 space-y-4">
            <h3 className="font-semibold text-slate-200">Datos básicos</h3>
            <SexToggle value={sexo} onChange={setSexo} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Edad"   value={edad}   onChange={setEdad}   min={10}  max={95}  unit="años" />
              <Field label="Peso"   value={peso}   onChange={setPeso}   min={30}  max={250} unit="kg"   />
              <Field label="Altura" value={altura} onChange={setAltura} min={130} max={230} unit="cm"   />
              <Field label="% Grasa corporal" value={bodyfat} onChange={setBodyfat} min={2} max={60} unit="%" placeholder="Para Katch" />
            </div>
            <div className="grid grid-cols-1 gap-3 border-t border-white/5 pt-3">
              <SelectField label="Nivel de actividad" value={actividad} onChange={setActividad} options={actividadOptions} />
              <SelectField label="Objetivo"           value={objetivo}  onChange={setObjetivo}  options={objetivoOptions}  />
            </div>
          </div>

          {/* Circunferencias ISAK */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-slate-200">Circunferencias ISAK</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                International Society for the Advancement of Kinanthropometry
              </p>
            </div>

            {/* Tronco superior */}
            <div className="space-y-2.5">
              <SectionLabel>Tronco superior</SectionLabel>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Cuello"  value={c_cuello} onChange={setCuello} min={20} max={80} unit="cm" />
                <Field label={sexo === "femenino" ? "Busto" : "Pecho"} value={c_busto} onChange={setBusto} min={40} max={200} unit="cm" />
              </div>
            </div>

            {/* Brazo */}
            <div className="space-y-2.5">
              <SectionLabel>Brazo</SectionLabel>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Brazo relajado"   value={c_brazo_relax}  onChange={setBrazoRelax}  min={15} max={80} unit="cm" />
                <Field label="Brazo contraído"  value={c_brazo_contra} onChange={setBrazoContra} min={15} max={80} unit="cm" />
                <div className="col-span-2">
                  <Field label="Antebrazo (máximo)" value={c_antebrazo} onChange={setAntebrazo} min={10} max={60} unit="cm" />
                </div>
              </div>
            </div>

            {/* Tronco medio */}
            <div className="space-y-2.5">
              <SectionLabel>Tronco medio</SectionLabel>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Cintura (mínima)" value={c_cintura} onChange={setCintura} min={40} max={200} unit="cm" />
                <Field label="Cadera (máxima)"  value={c_cadera}  onChange={setCadera}  min={50} max={200} unit="cm" />
              </div>
            </div>

            {/* Pierna */}
            <div className="space-y-2.5">
              <SectionLabel>Pierna</SectionLabel>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Muslo proximal"   value={c_muslo_prox}  onChange={setMusloProx}   min={30} max={120} unit="cm" />
                <Field label="Muslo medio"      value={c_muslo_medio} onChange={setMusloMedio}  min={25} max={110} unit="cm" />
                <Field label="Pantorrilla (máx)" value={c_pantorrilla} onChange={setPantorrilla} min={20} max={80}  unit="cm" />
                <Field label="Tobillo (mínimo)" value={c_tobillo}     onChange={setTobillo}     min={10} max={50}  unit="cm" />
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════ RIGHT: results ══════════════════════════════ */}
        <div className="space-y-4">

          {/* TMB */}
          <ResultCard icon="🔥" title="Tasa Metabólica Basal (TMB)">
            <MethodPills value={tmbMethod} onChange={setTmbMethod} options={TMB_METHODS} />
            <ResultRow
              label={TMB_METHODS.find(m => m.value === tmbMethod)!.label}
              value={`${activeTmb} kcal/día`}
              accent
              sub={tmbDesc[tmbMethod]}
            />
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.entries(tmbValues) as [TmbMethod, number][])
                .filter(([k]) => k !== tmbMethod)
                .map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-1.5 text-xs">
                    <span className="text-slate-500">{TMB_METHODS.find(m => m.value === k)!.label}</span>
                    <span className="font-semibold text-slate-300">{v} kcal</span>
                  </div>
                ))}
            </div>
          </ResultCard>

          {/* TDEE + Macros */}
          <ResultCard icon="⚡" title="TDEE + Macros objetivo">
            <ResultRow label="TMB seleccionada" value={`${activeTmb} kcal/día`} />
            <ResultRow label="TDEE con actividad y objetivo" value={`${activeTdee} kcal/día`} accent />
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { label: "Proteínas",     value: targets.proteinas,     color: "text-emerald-400" },
                { label: "Carbohidratos", value: targets.carbohidratos, color: "text-blue-400"    },
                { label: "Grasas",        value: targets.grasas,        color: "text-amber-400"   },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg bg-slate-800/50 p-3 text-center">
                  <p className={`text-xl font-black ${color}`}>{value}g</p>
                  <p className="mt-0.5 text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>
            <MacroPie p={targets.proteinas} c={targets.carbohidratos} g={targets.grasas} />
          </ResultCard>

          {/* Perfil de circunferencias ISAK */}
          <ResultCard icon="📐" title="Perfil Antropométrico ISAK">
            <div className="grid gap-1.5 sm:grid-cols-2">
              <div className="space-y-1">
                <SectionLabel>Tronco superior</SectionLabel>
                <GirthRow icon="🦴" label="Cuello"        value={c_cuello}  />
                <GirthRow icon="🫁" label={sexo === "femenino" ? "Busto" : "Pecho"} value={c_busto} />
              </div>
              <div className="space-y-1">
                <SectionLabel>Brazo</SectionLabel>
                <GirthRow icon="💪" label="Brazo relajado"   value={c_brazo_relax}  />
                <GirthRow icon="🦾" label="Brazo contraído"  value={c_brazo_contra} />
                <GirthRow icon="✊" label="Antebrazo"        value={c_antebrazo}    />
              </div>
              <div className="space-y-1">
                <SectionLabel>Tronco medio</SectionLabel>
                <GirthRow icon="⬜" label="Cintura (mínima)" value={c_cintura} />
                <GirthRow icon="🔵" label="Cadera (máxima)"  value={c_cadera}  />
              </div>
              <div className="space-y-1">
                <SectionLabel>Pierna</SectionLabel>
                <GirthRow icon="🦵" label="Muslo proximal"    value={c_muslo_prox}  />
                <GirthRow icon="🦵" label="Muslo medio"       value={c_muslo_medio} />
                <GirthRow icon="🦶" label="Pantorrilla (máx)" value={c_pantorrilla} />
                <GirthRow icon="🦶" label="Tobillo (mínimo)"  value={c_tobillo}     />
              </div>
            </div>

            {/* Índices derivados */}
            {(whr || whtr || navyBf) && (
              <div className="border-t border-white/5 pt-3 space-y-2">
                <SectionLabel>Índices derivados</SectionLabel>

                {whr !== null && (() => {
                  const risk = getWhrRisk(sexo, whr);
                  return (
                    <div className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2.5">
                      <div>
                        <p className="text-sm text-slate-300">Índice Cintura-Cadera (ICC)</p>
                        <p className="text-xs text-slate-500">
                          {sexo === "masculino" ? "♂ riesgo: ≥ 0.90" : "♀ riesgo: ≥ 0.80"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100">{whr.toFixed(2)}</span>
                        <RiskBadge label={risk.label} color={risk.color} />
                      </div>
                    </div>
                  );
                })()}

                {whtr !== null && (() => {
                  const risk = getWhtrRisk(whtr);
                  return (
                    <div className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2.5">
                      <div>
                        <p className="text-sm text-slate-300">Índice Cintura-Talla (ICT)</p>
                        <p className="text-xs text-slate-500">Riesgo cardiovascular · límite: 0.50</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100">{whtr.toFixed(2)}</span>
                        <RiskBadge label={risk.label} color={risk.color} />
                      </div>
                    </div>
                  );
                })()}

                {navyBf !== null && (
                  <ResultRow
                    label="% Grasa corporal Navy"
                    value={`${navyBf.toFixed(1)}%`}
                    accent
                    sub={`Masa magra: ${roundValue(pesoN * (1 - navyBf / 100))} kg · Masa grasa: ${roundValue(pesoN * navyBf / 100)} kg`}
                  />
                )}

                {!navyBf && (
                  <p className="rounded-lg bg-slate-800/40 px-3 py-2 text-xs text-slate-600">
                    Completá cuello + cintura{sexo === "femenino" ? " + cadera" : ""} para calcular % grasa (Navy).
                  </p>
                )}
              </div>
            )}

            {(!whr && !whtr && !navyBf) && (
              <p className="rounded-xl border border-dashed border-white/5 p-3 text-center text-xs text-slate-600">
                Completá las circunferencias para ver los índices derivados.
              </p>
            )}
          </ResultCard>

          {/* IMC + Peso Ideal */}
          <div className="grid gap-4 sm:grid-cols-2">
            <ResultCard icon="📊" title="IMC">
              <ImcGauge imc={imc} />
              <div className="grid grid-cols-2 gap-1 text-xs">
                {[
                  { r: "< 18.5",    l: "Bajo peso",  c: "#60a5fa" },
                  { r: "18.5–24.9", l: "Normal",     c: "#34d399" },
                  { r: "25–29.9",   l: "Sobrepeso",  c: "#fbbf24" },
                  { r: "≥ 30",      l: "Obesidad",   c: "#f87171" },
                ].map((row) => (
                  <div key={row.r} className="flex items-center gap-1.5 rounded bg-slate-800/40 px-2 py-1">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: row.c }} />
                    <span className="text-slate-500 truncate">{row.r}</span>
                    <span className="ml-auto shrink-0 text-slate-400">{row.l}</span>
                  </div>
                ))}
              </div>
            </ResultCard>

            <ResultCard icon="📏" title="Peso Ideal">
              <MethodPills value={idealMethod} onChange={setIdealMethod} options={IDEAL_METHODS} />
              <ResultRow
                label={IDEAL_METHODS.find(m => m.value === idealMethod)!.label}
                value={`${activeIdeal} kg`}
                accent
                sub={idealDesc[idealMethod]}
              />
              <div className="space-y-1">
                {(Object.entries(idealValues) as [IdealMethod, number][])
                  .filter(([k]) => k !== idealMethod)
                  .map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-1.5 text-xs">
                      <span className="text-slate-500">{IDEAL_METHODS.find(m => m.value === k)!.label}</span>
                      <span className="font-semibold text-slate-300">{v} kg</span>
                    </div>
                  ))}
              </div>
            </ResultCard>
          </div>

          {/* Hidratación */}
          <ResultCard icon="💧" title="Hidratación diaria">
            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-blue-500/25 bg-blue-500/8 px-6 py-4 text-center">
                <p className="text-4xl font-black text-blue-300">{waterL}</p>
                <p className="text-sm font-semibold text-blue-400">litros / día</p>
                <p className="mt-0.5 text-xs text-slate-500">≈ {Math.round(waterL * 1000 / 250)} vasos</p>
              </div>
              <div className="flex-1 space-y-2">
                <ResultRow label="Base (35 ml/kg)"     value={`${roundValue(pesoN * 35 / 1000)} L`} />
                <ResultRow label="Extra por actividad" value={`+ ${roundValue(Math.max(0, waterL - pesoN * 35 / 1000))} L`} />
              </div>
            </div>
          </ResultCard>

        </div>
      </div>
    </div>
  );
}
