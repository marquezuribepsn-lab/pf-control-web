import foodsFull from "./argentineFoodsFull.json";
import supermarketRaw from "./supermarketFoods.json";

export type ArgentineFood = {
  id: string;
  nombre: string;
  grupo: string;
  marca?: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  source: "TCA-AR" | "Supermercados ARG";
};

export const argentineFoodsBase: ArgentineFood[] = foodsFull as ArgentineFood[];
export const supermarketFoods: ArgentineFood[] = supermarketRaw as ArgentineFood[];
export const allFoodsBase: ArgentineFood[] = [...argentineFoodsBase, ...supermarketFoods];
