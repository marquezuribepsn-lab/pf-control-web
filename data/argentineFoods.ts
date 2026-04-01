import foodsFull from "./argentineFoodsFull.json";

export type ArgentineFood = {
  id: string;
  nombre: string;
  grupo: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  source: "TCA-AR";
};

export const argentineFoodsBase: ArgentineFood[] = foodsFull as ArgentineFood[];
