type NormalizeOptions = {
  allowedVariables?: string[];
  requiredVariables?: string[];
};

export type TemplateNormalizationResult = {
  message: string;
  changed: boolean;
  detectedVariables: string[];
  unknownVariables: string[];
  missingRequiredVariables: string[];
};

export const DEFAULT_TEMPLATE_VARIABLE_KEYS = [
  "nombre",
  "email",
  "actividad",
  "dias",
  "fecha",
  "vencimiento",
  "total",
  "pago_estado",
  "saldo",
  "plan_estado",
  "plan_items",
  "actualizacion_plan",
] as const;

const DOUBLE_BRACE_TOKEN_REGEX = /\{\{\s*([^{}\n]+?)\s*\}\}/g;
const BRACKET_TOKEN_REGEX = /\[\[\s*([^\[\]\n]+?)\s*\]\]/g;
const SINGLE_BRACE_TOKEN_REGEX = /(^|[^{}])\{([a-zA-Z0-9_\-. \u00C0-\u017F]{2,60})\}(?!\})/g;

const VARIABLE_ALIASES: Record<string, string> = {
  mail: "email",
  correo: "email",
  correoelectronico: "email",
  correoe: "email",
  mailcliente: "email",
  emailcliente: "email",
  emailalumno: "email",
  e_mail: "email",
  nombrealumno: "nombre",
  alumno: "nombre",
  alumnonombre: "nombre",
  nombrecliente: "nombre",
  clientenombre: "nombre",
  nombrecontacto: "nombre",
  nombrejugadora: "nombre",
  jugadora: "nombre",
  contacto: "nombre",
  deporte: "actividad",
  rutina: "actividad",
  disciplina: "actividad",
  tipoasesoria: "actividad",
  asesoria: "actividad",
  diasrestantes: "dias",
  diasfaltantes: "dias",
  diasparavencer: "dias",
  diashastavencer: "dias",
  monto: "total",
  importe: "total",
  precio: "total",
  valor: "total",
  totalapagar: "total",
  montoapagar: "total",
  cuota: "total",
  fechadehoy: "fecha",
  vence: "vencimiento",
  vto: "vencimiento",
  fechavencimiento: "vencimiento",
  vencimientofecha: "vencimiento",
  fechadevencimiento: "vencimiento",
  proximovencimiento: "vencimiento",
  ultimafecha: "fecha",
  estadopago: "pago_estado",
  pagoestado: "pago_estado",
  situacionpago: "pago_estado",
  pagosaldo: "saldo",
  saldoactual: "saldo",
  deuda: "saldo",
  montoadeudado: "saldo",
  plan: "plan_estado",
  estado_plan: "plan_estado",
  estadoplan: "plan_estado",
  estadodelplan: "plan_estado",
  planactual: "plan_estado",
  planitems: "plan_items",
  itemsplan: "plan_items",
  itemsdelplan: "plan_items",
  cantidaditemsplan: "plan_items",
  ejerciciosplan: "plan_items",
  bloquesplan: "plan_items",
  actualizacion: "actualizacion_plan",
  actualizacionplan: "actualizacion_plan",
  actualizaciondeplan: "actualizacion_plan",
  actualizacionpendiente: "actualizacion_plan",
  pendienteactualizacion: "actualizacion_plan",
  planactualizado: "actualizacion_plan",
};

function toAsciiLookupKey(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
}

function dedupeSorted(values: string[]) {
  return Array.from(new Set(values.map((item) => String(item || "").trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

function sanitizeFallbackToken(raw: string) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_.-]/g, "");
}

function buildAllowedMap(allowedVariables: string[]) {
  const allowedSet = new Set<string>();
  const byLookup = new Map<string, string>();

  for (const item of allowedVariables) {
    const clean = String(item || "").trim();
    if (!clean) continue;

    allowedSet.add(clean);
    byLookup.set(toAsciiLookupKey(clean), clean);
  }

  return { allowedSet, byLookup };
}

function resolveByHeuristic(normalized: string, allowedSet: Set<string>) {
  const has = (needle: string) => normalized.includes(needle);

  if (allowedSet.has("nombre") && (has("nombre") || has("alumno") || has("cliente") || has("jugadora"))) {
    return "nombre";
  }

  if (allowedSet.has("email") && (has("mail") || has("correo") || has("email"))) {
    return "email";
  }

  if (allowedSet.has("actividad") && (has("actividad") || has("deporte") || has("rutina") || has("disciplina"))) {
    return "actividad";
  }

  if (allowedSet.has("dias") && (has("dias") || has("dia") || has("day"))) {
    return "dias";
  }

  if (allowedSet.has("vencimiento") && (has("venc") || has("vto") || has("caduc"))) {
    return "vencimiento";
  }

  if (allowedSet.has("pago_estado") && has("pago") && has("estado")) {
    return "pago_estado";
  }

  if (allowedSet.has("total") && (has("total") || has("monto") || has("importe") || has("precio") || has("valor"))) {
    return "total";
  }

  if (allowedSet.has("saldo") && (has("saldo") || has("deuda") || has("adeud"))) {
    return "saldo";
  }

  if (allowedSet.has("plan_estado") && has("plan") && has("estado")) {
    return "plan_estado";
  }

  if (
    allowedSet.has("plan_items") &&
    has("plan") &&
    (has("item") || has("ejercicio") || has("bloque") || has("sesion"))
  ) {
    return "plan_items";
  }

  if (allowedSet.has("actualizacion_plan") && has("plan") && (has("actualiz") || has("pendiente"))) {
    return "actualizacion_plan";
  }

  if (allowedSet.has("fecha") && has("fecha")) {
    return "fecha";
  }

  return null;
}

export function resolveTemplateVariableKey(rawKey: string, allowedVariables?: string[]) {
  const raw = String(rawKey || "").trim();
  if (!raw) return null;

  const normalized = toAsciiLookupKey(raw);
  const allowed =
    Array.isArray(allowedVariables) && allowedVariables.length > 0
      ? allowedVariables
      : Array.from(DEFAULT_TEMPLATE_VARIABLE_KEYS);
  const { allowedSet, byLookup } = buildAllowedMap(allowed);

  if (allowedSet.has(raw)) {
    return raw;
  }

  const byExactNormalized = byLookup.get(normalized);
  if (byExactNormalized) {
    return byExactNormalized;
  }

  const aliasTarget = VARIABLE_ALIASES[normalized];
  if (aliasTarget && allowedSet.has(aliasTarget)) {
    return aliasTarget;
  }

  const heuristicTarget = resolveByHeuristic(normalized, allowedSet);
  if (heuristicTarget) {
    return heuristicTarget;
  }

  return null;
}

export function extractTemplateVariables(message: string) {
  const detected: string[] = [];
  const content = String(message || "");

  content.replace(DOUBLE_BRACE_TOKEN_REGEX, (_full, rawKey: string) => {
    const key = sanitizeFallbackToken(rawKey);
    if (key) {
      detected.push(key);
    }
    return "";
  });

  return dedupeSorted(detected);
}

export function normalizeTemplateMessage(message: string, options?: NormalizeOptions): TemplateNormalizationResult {
  const original = String(message || "");
  const allowedVariables = dedupeSorted(
    Array.isArray(options?.allowedVariables) ? options?.allowedVariables : []
  );
  const requiredVariables = dedupeSorted(
    Array.isArray(options?.requiredVariables) ? options?.requiredVariables : []
  );

  let normalized = original;

  normalized = normalized.replace(BRACKET_TOKEN_REGEX, (_full, rawKey: string) => {
    const token = String(rawKey || "").trim();
    return token ? `{{${token}}}` : "";
  });

  normalized = normalized.replace(SINGLE_BRACE_TOKEN_REGEX, (_full, prefix: string, rawKey: string) => {
    const token = String(rawKey || "").trim();
    return `${prefix || ""}${token ? `{{${token}}}` : ""}`;
  });

  const normalizedTokens: string[] = [];

  normalized = normalized.replace(DOUBLE_BRACE_TOKEN_REGEX, (_full, rawKey: string) => {
    const resolved = resolveTemplateVariableKey(rawKey, allowedVariables);
    const fallback = sanitizeFallbackToken(rawKey);
    const finalKey = resolved || fallback;

    if (!finalKey) {
      return "";
    }

    normalizedTokens.push(finalKey);
    return `{{${finalKey}}}`;
  });

  const detectedVariables = dedupeSorted(normalizedTokens);
  const allowedSet = new Set(allowedVariables);
  const requiredSet = new Set(requiredVariables);

  const unknownVariables =
    allowedSet.size > 0
      ? detectedVariables.filter((item) => !allowedSet.has(item))
      : [];

  const missingRequiredVariables =
    requiredSet.size > 0
      ? Array.from(requiredSet).filter((item) => !detectedVariables.includes(item)).sort((a, b) =>
          a.localeCompare(b)
        )
      : [];

  return {
    message: normalized,
    changed: normalized !== original,
    detectedVariables,
    unknownVariables,
    missingRequiredVariables,
  };
}
