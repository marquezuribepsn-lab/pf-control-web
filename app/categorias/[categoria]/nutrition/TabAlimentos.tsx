"use client";

import { useState, useMemo } from "react";
import { markManualSaveIntent } from "../../../../components/useSharedState";
import { allFoodsBase, argentineFoodsBase, supermarketFoods, type ArgentineFood } from "../../../../data/argentineFoods";
import { CUSTOM_FOODS_KEY } from "./constants";
import { uid } from "./utils";
import type { CustomFood, NutritionHubState } from "./types";

type Props = Pick<NutritionHubState, "customFoods" | "setCustomFoods">;

// ─── Categorización automática por nombre ─────────────────────────────────────

const CATEGORIAS: { nombre: string; icon: string; keywords: string[] }[] = [
  {
    nombre: "Carnes rojas", icon: "🥩",
    keywords: ["vaca", "res", "ternera", "ternero", "cordero", "cerdo", "carne", "bife", "asado", "costilla", "lomo", "paleta", "vacuna", "vacuno", "morcilla", "chorizo", "salami", "mortadela", "salchicha", "longaniza", "paté", "hígado", "riñón", "mondongo", "tripa"],
  },
  {
    nombre: "Aves", icon: "🍗",
    keywords: ["pollo", "gallina", "pavo", "pato", "codorniz"],
  },
  {
    nombre: "Pescados y mariscos", icon: "🐟",
    keywords: ["merluza", "salmón", "salmon", "trucha", "atún", "atun", "sardina", "caballa", "anchoa", "pejerrey", "dorado", "surubí", "boga", "langostino", "calamar", "mejillón", "almeja", "cangrejo", "pescado", "mariscos", "corvina", "abadejo", "lenguado"],
  },
  {
    nombre: "Lácteos y huevos", icon: "🥛",
    keywords: ["leche", "yogur", "queso", "crema", "manteca", "ricota", "caseína", "suero", "huevo", "flan", "dulce de leche", "helado"],
  },
  {
    nombre: "Cereales y panificados", icon: "🌾",
    keywords: ["arroz", "trigo", "harina", "pan", "pasta", "fideos", "avena", "maíz", "maiz", "cebada", "centeno", "galleta", "tostada", "bizcocho", "factura", "medialunas", "cereal", "copos", "salvado", "germen", "polenta"],
  },
  {
    nombre: "Legumbres", icon: "🫘",
    keywords: ["poroto", "lenteja", "garbanzo", "soja", "arveja", "haba", "lupín", "lupin"],
  },
  {
    nombre: "Frutas", icon: "🍎",
    keywords: ["manzana", "naranja", "banana", "pera", "uva", "frutilla", "limón", "limon", "mandarina", "durazno", "ciruela", "damasco", "kiwi", "mango", "pomelo", "ananá", "anana", "melón", "melon", "sandía", "sandia", "cereza", "frambuesa", "arándano", "arandano", "fruta", "higo", "caqui", "maracuyá"],
  },
  {
    nombre: "Verduras y hortalizas", icon: "🥦",
    keywords: ["lechuga", "tomate", "zanahoria", "cebolla", "ajo", "espinaca", "brócoli", "brocoli", "acelga", "zapallo", "papa", "batata", "choclo", "morrón", "morron", "berenjena", "zucchini", "zapallito", "remolacha", "apio", "puerro", "repollo", "coliflor", "alcaucil", "rabanito", "radicheta", "endibia", "hinojo", "nabo", "rúcula", "rucula", "berro", "albahaca", "cilantro", "perejil", "verdura"],
  },
  {
    nombre: "Frutas secas y semillas", icon: "🥜",
    keywords: ["nuez", "almendra", "avellana", "pistacho", "castaña", "maní", "mani", "semilla", "lino", "chía", "chia", "sésamo", "sesamo", "girasol", "zapallo semilla", "coco"],
  },
  {
    nombre: "Aceites y grasas", icon: "🫒",
    keywords: ["aceite", "margarina", "grasa", "manteca vegetal", "shortening", "ghee"],
  },
  {
    nombre: "Azúcares y dulces", icon: "🍬",
    keywords: ["azúcar", "azucar", "miel", "mermelada", "dulce", "caramelo", "chocolate", "cacao", "jarabe", "almíbar", "almibar"],
  },
  {
    nombre: "Bebidas", icon: "🥤",
    keywords: ["agua", "jugo", "té", "te", "café", "cafe", "infusión", "infusion", "cerveza", "vino", "sidra", "bebida", "gaseosa", "soda", "yerba", "mate"],
  },
  {
    nombre: "Snacks y comidas rápidas", icon: "🍕",
    keywords: ["papas fritas", "pizza", "hamburguesa", "empanada", "medialunas", "masas", "facturas", "budín", "budin", "alfajor", "galletita"],
  },
  {
    nombre: "Condimentos y salsas", icon: "🧂",
    keywords: ["sal", "pimienta", "vinagre", "mayonesa", "mostaza", "ketchup", "salsa", "condimento", "orégano", "oregano", "laurel", "comino", "pimentón", "paprika", "cúrcuma", "curcuma"],
  },
];

function categorizarAlimento(nombre: string): string {
  const lower = nombre.toLowerCase();
  for (const cat of CATEGORIAS) {
    if (cat.keywords.some((kw) => lower.includes(kw))) {
      return cat.nombre;
    }
  }
  return "Otros";
}

// ─── Food row ─────────────────────────────────────────────────────────────────

function FoodRow({
  food,
  categoria,
  onDelete,
}: {
  food: ArgentineFood | CustomFood;
  categoria: string;
  onDelete?: () => void;
}) {
  const isCustom = "createdAt" in food;
  const isSuper = !isCustom && (food as ArgentineFood).source === "Supermercados ARG";
  const marca = !isCustom ? (food as ArgentineFood).marca : undefined;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-slate-800/40 px-4 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-slate-200">{food.nombre}</p>
        <p className="text-xs text-slate-500">
          {categoria}
          {marca && <span className="ml-1 text-slate-500">· {marca}</span>}
          {isSuper && <span className="ml-1 rounded bg-blue-500/15 px-1 text-[10px] font-medium text-blue-400">Supermercado</span>}
          {isCustom && <span className="ml-1 rounded bg-violet-500/15 px-1 text-[10px] font-medium text-violet-400">personalizado</span>}
        </p>
      </div>
      <div className="hidden shrink-0 grid-cols-4 gap-3 text-center text-xs sm:grid">
        <div>
          <p className="font-semibold text-amber-400">{food.kcalPer100g}</p>
          <p className="text-slate-500">kcal</p>
        </div>
        <div>
          <p className="font-semibold text-emerald-400">{food.proteinPer100g}g</p>
          <p className="text-slate-500">prot</p>
        </div>
        <div>
          <p className="font-semibold text-blue-400">{food.carbsPer100g}g</p>
          <p className="text-slate-500">carbs</p>
        </div>
        <div>
          <p className="font-semibold text-yellow-400">{food.fatPer100g}g</p>
          <p className="text-slate-500">grasas</p>
        </div>
      </div>
      {onDelete && (
        <button
          onClick={onDelete}
          className="ml-2 text-slate-600 hover:text-red-400"
          title="Eliminar"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ─── Add custom food form ─────────────────────────────────────────────────────

function AddFoodForm({ onSave, onCancel }: { onSave: (f: CustomFood) => void; onCancel: () => void }) {
  const [nombre, setNombre] = useState("");
  const [kcal, setKcal] = useState("");
  const [prot, setProt] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const inputCls =
    "w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none";

  function handleSave() {
    if (!nombre.trim()) return;
    const food: CustomFood = {
      id: uid("food"),
      nombre: nombre.trim(),
      grupo: categorizarAlimento(nombre.trim()),
      kcalPer100g: Number(kcal) || 0,
      proteinPer100g: Number(prot) || 0,
      carbsPer100g: Number(carbs) || 0,
      fatPer100g: Number(fat) || 0,
      createdAt: new Date().toISOString(),
    };
    onSave(food);
  }

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <h4 className="mb-3 font-semibold text-slate-200">Agregar alimento personalizado</h4>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-400">Nombre del alimento</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Milanesa casera" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Kcal / 100g</label>
          <input type="number" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="0" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Proteínas / 100g</label>
          <input type="number" value={prot} onChange={(e) => setProt(e.target.value)} placeholder="0" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Carbohidratos / 100g</label>
          <input type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="0" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Grasas / 100g</label>
          <input type="number" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="0" className={inputCls} />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSave}
          disabled={!nombre.trim()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          Agregar
        </button>
        <button onClick={onCancel} className="rounded-lg border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Tab component ────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

type SourceFilter = "todos" | "tca" | "super" | "custom";

export default function TabAlimentos({ customFoods, setCustomFoods }: Props) {
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("Todos");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("todos");
  const [showAddForm, setShowAddForm] = useState(false);
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<"nombre" | "kcal" | "prot">("nombre");

  // Build enriched food list with auto-category
  const allFoodsWithCat = useMemo(() => {
    const base = allFoodsBase.map((f) => ({
      food: f as ArgentineFood | CustomFood,
      categoria: categorizarAlimento(f.nombre),
    }));
    const custom = customFoods.map((f) => ({
      food: f as ArgentineFood | CustomFood,
      categoria: f.grupo || categorizarAlimento(f.nombre),
    }));
    return [...base, ...custom];
  }, [customFoods]);

  // Unique categories present in DB
  const categoriasDisponibles = useMemo(() => {
    const cats = new Set(allFoodsWithCat.map((e) => e.categoria));
    return ["Todos", ...CATEGORIAS.map((c) => c.nombre).filter((c) => cats.has(c)), "Otros"].filter(
      (c) => c === "Todos" || cats.has(c)
    );
  }, [allFoodsWithCat]);

  const filtered = useMemo(() => {
    const needle = search.toLowerCase().trim();
    let list = allFoodsWithCat.filter(({ food, categoria }) => {
      // source filter
      if (sourceFilter === "tca") {
        if ("createdAt" in food) return false;
        if ((food as ArgentineFood).source !== "TCA-AR") return false;
      } else if (sourceFilter === "super") {
        if ("createdAt" in food) return false;
        if ((food as ArgentineFood).source !== "Supermercados ARG") return false;
      } else if (sourceFilter === "custom") {
        if (!("createdAt" in food)) return false;
      }
      if (selectedCat !== "Todos" && categoria !== selectedCat) return false;
      if (!needle) return true;
      return food.nombre.toLowerCase().includes(needle);
    });

    if (sortBy === "kcal") list = [...list].sort((a, b) => b.food.kcalPer100g - a.food.kcalPer100g);
    else if (sortBy === "prot") list = [...list].sort((a, b) => b.food.proteinPer100g - a.food.proteinPer100g);
    else list = [...list].sort((a, b) => a.food.nombre.localeCompare(b.food.nombre, "es"));

    return list;
  }, [allFoodsWithCat, search, selectedCat, sourceFilter, sortBy]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleSearchChange(v: string) {
    setSearch(v);
    setPage(0);
  }

  function handleCatChange(v: string) {
    setSelectedCat(v);
    setPage(0);
  }

  function handleSourceFilter(s: SourceFilter) {
    setSourceFilter(s);
    setPage(0);
  }

  function handleAddFood(food: CustomFood) {
    markManualSaveIntent(CUSTOM_FOODS_KEY);
    setCustomFoods((prev) => [...(Array.isArray(prev) ? prev : []), food]);
    setShowAddForm(false);
  }

  function handleDeleteFood(id: string) {
    if (!confirm("¿Eliminar este alimento personalizado?")) return;
    markManualSaveIntent(CUSTOM_FOODS_KEY);
    setCustomFoods((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-100">🥗 Base de Alimentos</h2>
          <p className="mt-1 text-sm text-slate-400">
            <span className="text-slate-300">{argentineFoodsBase.length}</span> TCA-AR ·{" "}
            <span className="text-blue-400">{supermarketFoods.length}</span> supermercados ·{" "}
            <span className="text-violet-400">{customFoods.length}</span> personalizados ·{" "}
            <span className="text-emerald-400">{filtered.length} coincidencias</span>
          </p>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
        >
          + Alimento personalizado
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <AddFoodForm onSave={handleAddFood} onCancel={() => setShowAddForm(false)} />
      )}

      {/* Source filter tabs */}
      <div className="flex gap-1.5 rounded-xl border border-white/5 bg-slate-900/40 p-1">
        {(
          [
            { id: "todos", label: "Todas las fuentes", icon: "🌐", count: allFoodsWithCat.length },
            { id: "tca", label: "TCA-AR", icon: "📋", count: argentineFoodsBase.length },
            { id: "super", label: "Supermercados", icon: "🛒", count: supermarketFoods.length },
            { id: "custom", label: "Personalizados", icon: "✨", count: customFoods.length },
          ] as { id: SourceFilter; label: string; icon: string; count: number }[]
        ).map(({ id, label, icon, count }) => (
          <button
            key={id}
            onClick={() => handleSourceFilter(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-all ${
              sourceFilter === id
                ? id === "super"
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                  : id === "custom"
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  : "bg-slate-700/70 text-slate-200 border border-white/15"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <span>{icon}</span>
            <span className="hidden sm:inline">{label}</span>
            <span className="text-slate-500">({count})</span>
          </button>
        ))}
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5">
        {categoriasDisponibles.map((cat) => {
          const icon = cat === "Todos" ? "🥗" : (CATEGORIAS.find((c) => c.nombre === cat)?.icon ?? "📦");
          const count = cat === "Todos"
            ? allFoodsWithCat.length
            : allFoodsWithCat.filter((e) => e.categoria === cat).length;
          return (
            <button
              key={cat}
              onClick={() => handleCatChange(cat)}
              className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                selectedCat === cat
                  ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                  : "border-white/10 bg-slate-800/50 text-slate-400 hover:border-white/20 hover:text-slate-200"
              }`}
            >
              <span>{icon}</span>
              <span>{cat}</span>
              <span className="text-slate-500">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Search + sort */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={`Buscar en ${selectedCat === "Todos" ? "todos los alimentos" : selectedCat.toLowerCase()}...`}
          className="flex-1 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none"
        />
        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value as "nombre" | "kcal" | "prot"); setPage(0); }}
          className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none"
        >
          <option value="nombre">A → Z</option>
          <option value="kcal">Mayor kcal</option>
          <option value="prot">Mayor proteína</option>
        </select>
      </div>

      {/* Column headers */}
      <div className="hidden sm:flex items-center gap-3 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span className="flex-1">Alimento</span>
        <div className="grid w-40 grid-cols-4 gap-3 text-center">
          <span>Kcal</span>
          <span>Prot</span>
          <span>Carbs</span>
          <span>Grasas</span>
        </div>
        <span className="w-5" />
      </div>

      {/* List */}
      {paged.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
          <p className="text-slate-500">No hay alimentos que coincidan.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {paged.map(({ food, categoria }) => (
            <FoodRow
              key={food.id}
              food={food}
              categoria={categoria}
              onDelete={"createdAt" in food ? () => handleDeleteFood(food.id) : undefined}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de{" "}
            {filtered.length} alimentos · pág. {page + 1}/{pageCount}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              «
            </button>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              ←
            </button>
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, pageCount) }, (_, i) => {
              const start = Math.max(0, Math.min(page - 2, pageCount - 5));
              const p = start + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-all ${
                    p === page
                      ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                      : "border-white/10 bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {p + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              className="rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              →
            </button>
            <button
              onClick={() => setPage(pageCount - 1)}
              disabled={page >= pageCount - 1}
              className="rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
