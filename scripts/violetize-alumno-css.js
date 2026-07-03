/**
 * violetize-alumno-css.js
 * Migra los colores "fríos" (azul marino / celeste / gris azulado) que quedaban
 * hardcodeados en las reglas .pf-a3-/.pf-a4-/.pf-a2- del alumno a la paleta
 * violeta sobre negro, SOLO dentro de la región del alumno (líneas 1490–8355 de
 * app/globals.css). Preserva colores semánticos (agua=azul, progreso=teal,
 * pagos=rosa, macros cian/verde/ámbar/naranja/rojo) por hue y por lista blanca.
 *
 * Rota a violeta cualquier literal de color cuyo hue caiga en [196, 250) y no
 * esté en la lista de conservación. Mantiene saturación y luminosidad para no
 * romper contraste (texto claro sigue claro, fondos oscuros siguen oscuros).
 *
 * Uso: node scripts/violetize-alumno-css.js [--dry]
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "app", "globals.css");
const START_LINE = 1490; // 1-indexed, inclusive
const END_LINE = 8355; // 1-indexed, inclusive
const TARGET_HUE = 263; // violeta
const HUE_MIN = 196;
const HUE_MAX = 250; // exclusivo

// Literales semánticos que NO se deben rotar (se comparan normalizados).
const KEEP = new Set([
  "#38bdf8", // agua
  "#2563eb", // agua
  "#94a3b8", // sueño / gris neutro
  "#475569", // sueño
]);

const dry = process.argv.includes("--dry");

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;
  return { h, s, l, delta };
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function shouldRotate(h, delta) {
  if (delta === 0) return false; // neutro puro
  return h >= HUE_MIN && h < HUE_MAX;
}

let converted = 0;
const samples = [];

function convertRgb(r, g, b) {
  const { h, s, l, delta } = rgbToHsl(r, g, b);
  if (!shouldRotate(h, delta)) return null;
  const [nr, ng, nb] = hslToRgb(TARGET_HUE, s, l);
  return [nr, ng, nb];
}

function toHex(n) {
  return n.toString(16).padStart(2, "0");
}

function processLine(line) {
  // hex de 6 dígitos
  line = line.replace(/#([0-9a-fA-F]{6})\b/g, (m) => {
    const norm = m.toLowerCase();
    if (KEEP.has(norm)) return m;
    const r = parseInt(norm.slice(1, 3), 16);
    const g = parseInt(norm.slice(3, 5), 16);
    const b = parseInt(norm.slice(5, 7), 16);
    const res = convertRgb(r, g, b);
    if (!res) return m;
    converted++;
    const out = `#${toHex(res[0])}${toHex(res[1])}${toHex(res[2])}`;
    if (samples.length < 20) samples.push(`${m} -> ${out}`);
    return out;
  });

  // hex de 3 dígitos
  line = line.replace(/#([0-9a-fA-F]{3})\b/g, (m) => {
    const norm = m.toLowerCase();
    const r = parseInt(norm[1] + norm[1], 16);
    const g = parseInt(norm[2] + norm[2], 16);
    const b = parseInt(norm[3] + norm[3], 16);
    const res = convertRgb(r, g, b);
    if (!res) return m;
    converted++;
    const out = `#${toHex(res[0])}${toHex(res[1])}${toHex(res[2])}`;
    if (samples.length < 20) samples.push(`${m} -> ${out}`);
    return out;
  });

  // rgb() / rgba()
  line = line.replace(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)([^)]*)\)/g,
    (m, r, g, b, rest) => {
      const res = convertRgb(Number(r), Number(g), Number(b));
      if (!res) return m;
      converted++;
      const prefix = m.trim().startsWith("rgba") ? "rgba" : "rgb";
      const out = `${prefix}(${res[0]}, ${res[1]}, ${res[2]}${rest})`;
      if (samples.length < 20) samples.push(`${m.trim()} -> ${out}`);
      return out;
    }
  );

  return line;
}

const raw = fs.readFileSync(FILE, "utf8");
const lines = raw.split("\n");

for (let i = START_LINE - 1; i <= END_LINE - 1 && i < lines.length; i++) {
  lines[i] = processLine(lines[i]);
}

const output = lines.join("\n");

console.log(JSON.stringify({ converted, dry, samples }, null, 2));

if (!dry) {
  fs.writeFileSync(FILE, output, "utf8");
  console.log("Escrito.");
}
