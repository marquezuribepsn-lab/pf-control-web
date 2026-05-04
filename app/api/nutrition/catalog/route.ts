import { NextRequest, NextResponse } from "next/server";
import { argentineFoodsBase } from "@/data/argentineFoods";

type NutritionCatalogItem = {
  id: string;
  nombre: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  imageUrl?: string;
  barcode?: string;
  sourceLabel: string;
};

const REQUEST_TIMEOUT_MS = 6500;

function normalizeTextKey(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundToOneDecimal(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 10) / 10;
}

function asNonEmptyString(value: unknown): string | null {
  const text = String(value || "").trim();
  return text ? text : null;
}

async function fetchJsonWithTimeout(url: string): Promise<unknown> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: abortController.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseOpenFoodFactsProduct(product: Record<string, unknown>): NutritionCatalogItem | null {
  const code = asNonEmptyString(product.code) || "";
  const nombre = asNonEmptyString(product.product_name) || asNonEmptyString(product.generic_name) || "";

  if (!nombre) {
    return null;
  }

  const nutriments =
    product.nutriments && typeof product.nutriments === "object"
      ? (product.nutriments as Record<string, unknown>)
      : {};

  const kcalExplicit =
    toNumber(nutriments["energy-kcal_100g"]) ??
    toNumber(nutriments["energy-kcal"]) ??
    toNumber(nutriments["energy-kcal_value"]);
  const energyKj = toNumber(nutriments["energy_100g"]) ?? toNumber(nutriments.energy);

  const kcalPer100g = Math.max(0, roundToOneDecimal(kcalExplicit ?? (energyKj !== null ? energyKj / 4.184 : 0)));
  const proteinPer100g = Math.max(0, roundToOneDecimal(toNumber(nutriments.proteins_100g) || 0));
  const carbsPer100g = Math.max(0, roundToOneDecimal(toNumber(nutriments.carbohydrates_100g) || 0));
  const fatPer100g = Math.max(0, roundToOneDecimal(toNumber(nutriments.fat_100g) || 0));

  if (kcalPer100g <= 0 && proteinPer100g <= 0 && carbsPer100g <= 0 && fatPer100g <= 0) {
    return null;
  }

  const imageUrl =
    asNonEmptyString(product.image_front_small_url) ||
    asNonEmptyString(product.image_front_url) ||
    asNonEmptyString(product.image_url) ||
    undefined;

  const idFromName = normalizeTextKey(nombre).replace(/\s+/g, "-").slice(0, 52) || "producto";
  const id = code ? `off-${code}` : `off-${idFromName}`;

  return {
    id,
    nombre,
    kcalPer100g,
    proteinPer100g,
    carbsPer100g,
    fatPer100g,
    imageUrl,
    barcode: code || undefined,
    sourceLabel: code ? "Open Food Facts (barcode)" : "Open Food Facts",
  };
}

function dedupeById(items: NutritionCatalogItem[], limit: number): NutritionCatalogItem[] {
  const map = new Map<string, NutritionCatalogItem>();

  items.forEach((item) => {
    const key = String(item.id || "").trim();
    if (!key || map.has(key)) {
      return;
    }

    map.set(key, item);
  });

  return Array.from(map.values()).slice(0, limit);
}

function getLocalMatches(query: string, limit: number): NutritionCatalogItem[] {
  const normalizedQuery = normalizeTextKey(query);
  if (!normalizedQuery) {
    return [];
  }

  return argentineFoodsBase
    .filter((food) => {
      const normalizedName = normalizeTextKey(food.nombre);
      const normalizedId = normalizeTextKey(food.id);
      return normalizedName.includes(normalizedQuery) || normalizedId.includes(normalizedQuery);
    })
    .slice(0, limit)
    .map((food) => ({
      id: String(food.id || "").trim(),
      nombre: String(food.nombre || "").trim() || "Alimento",
      kcalPer100g: Math.max(0, roundToOneDecimal(toNumber(food.kcalPer100g) || 0)),
      proteinPer100g: Math.max(0, roundToOneDecimal(toNumber(food.proteinPer100g) || 0)),
      carbsPer100g: Math.max(0, roundToOneDecimal(toNumber(food.carbsPer100g) || 0)),
      fatPer100g: Math.max(0, roundToOneDecimal(toNumber(food.fatPer100g) || 0)),
      sourceLabel: "Base local AR",
    }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = String(searchParams.get("q") || "").trim();
  const barcode = String(searchParams.get("barcode") || "").replace(/\s+/g, "").trim();
  const limit = Math.max(1, Math.min(60, Number(searchParams.get("limit") || 24) || 24));

  if (!query && !barcode) {
    return NextResponse.json({ ok: true, items: [] as NutritionCatalogItem[] });
  }

  if (barcode) {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=code,product_name,generic_name,image_url,image_front_url,image_front_small_url,nutriments`;
    const payload = (await fetchJsonWithTimeout(url)) as
      | {
          status?: number;
          product?: Record<string, unknown>;
        }
      | null;

    const parsed = payload?.product ? parseOpenFoodFactsProduct(payload.product) : null;
    return NextResponse.json({
      ok: true,
      items: parsed ? [parsed] : [],
    });
  }

  const localMatches = getLocalMatches(query, Math.max(12, Math.round(limit / 2)));

  let remoteMatches: NutritionCatalogItem[] = [];
  if (query.length >= 3) {
    const searchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      query
    )}&search_simple=1&action=process&json=1&page_size=${Math.max(12, limit)}&fields=code,product_name,generic_name,image_url,image_front_url,image_front_small_url,nutriments`;

    const payload = (await fetchJsonWithTimeout(searchUrl)) as
      | {
          products?: Array<Record<string, unknown>>;
        }
      | null;

    remoteMatches = Array.isArray(payload?.products)
      ? payload.products
          .map((product) => parseOpenFoodFactsProduct(product))
          .filter((item): item is NutritionCatalogItem => Boolean(item))
      : [];
  }

  const items = dedupeById([...localMatches, ...remoteMatches], limit);
  return NextResponse.json({ ok: true, items });
}
