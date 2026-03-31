const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXTAUTH_URL || 'http://127.0.0.1:3000';

function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  return digits.length >= 8 ? digits : '';
}

async function fetchSyncValue(key) {
  const response = await fetch(`${baseUrl}/api/sync/${encodeURIComponent(key)}`);
  if (!response.ok) {
    throw new Error(`No se pudo leer ${key}: ${response.status}`);
  }

  const data = await response.json().catch(() => ({}));
  return data?.value;
}

async function main() {
  const [metaValue, alumnosValue] = await Promise.all([
    fetchSyncValue('pf-control-clientes-meta-v1'),
    fetchSyncValue('pf-control-alumnos'),
  ]);

  const meta = metaValue && typeof metaValue === 'object' && !Array.isArray(metaValue)
    ? metaValue
    : {};
  const alumnos = Array.isArray(alumnosValue) ? alumnosValue : [];

  const rows = [];

  for (const [id, rawMeta] of Object.entries(meta)) {
    if (!String(id).startsWith('alumno:')) {
      continue;
    }

    const entry = rawMeta && typeof rawMeta === 'object' ? rawMeta : {};
    const nombre = String(id).split(':').slice(1).join(':') || String(entry.nombre || '');
    const telefono = normalizePhone(entry.telefono);

    rows.push({
      id: String(id),
      nombre,
      telefono,
      missing: !telefono,
      source: 'meta',
    });
  }

  const nombresEnMeta = new Set(rows.map((row) => String(row.nombre || '').toLowerCase()));

  for (const alumno of alumnos) {
    const nombre = String(alumno?.nombre || '').trim();
    if (!nombre) {
      continue;
    }

    if (nombresEnMeta.has(nombre.toLowerCase())) {
      continue;
    }

    const telefono = normalizePhone(alumno?.telefono);

    rows.push({
      id: `alumno:${nombre}`,
      nombre,
      telefono,
      missing: !telefono,
      source: 'alumnos',
    });
  }

  const missing = rows
    .filter((row) => row.missing)
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));

  const payload = {
    ok: true,
    baseUrl,
    totalAlumnosDetectados: rows.length,
    conTelefono: rows.length - missing.length,
    sinTelefono: missing.length,
    missing,
  };

  console.log(JSON.stringify(payload, null, 2));

  if (missing.length > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
  process.exit(1);
});
