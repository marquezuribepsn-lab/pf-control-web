(async () => {
	const base = "http://127.0.0.1:3000";
	const key = "pf-control-sesiones";

	const getRes = await fetch(`${base}/api/sync/${key}`);
	if (!getRes.ok) {
		throw new Error(`GET failed ${getRes.status}`);
	}
	const getJson = await getRes.json();
	const sessions = Array.isArray(getJson.value) ? getJson.value : [];
	const idx = sessions.findIndex((s) => s && s.id === "demo-sesion-alumno-prueba");
	if (idx < 0) {
		throw new Error("demo session not found");
	}

	const demo = sessions[idx] || {};
	demo.titulo = "Sesion base alumno prueba";
	demo.objetivo = "Sesion completa con calentamiento, bloque efectivo y vuelta a la calma.";
	demo.duracion = "55";
	demo.equipo = "Alumno/a: Alumno Prueba";
	demo.asignacionTipo = "alumnos";
	demo.alumnoAsignado = "Alumno Prueba";

	demo.bloques = [
		{
			id: "demo-bloque-ap-calentamiento",
			titulo: "Bloque de calentamiento",
			objetivo: "Activacion general, movilidad y preparacion de patrones.",
			ejercicios: [
				{
					ejercicioId: "1",
					series: 2,
					repeticiones: "12-15",
					carga: "Liviana",
					observaciones: "Activar sin fatigar y cuidar tecnica.",
				},
				{
					ejercicioId: "2",
					series: 2,
					repeticiones: "10-12",
					carga: "Peso corporal",
					observaciones: "Movimiento fluido y respiracion controlada.",
				},
			],
		},
		{
			id: "demo-bloque-ap-efectivo",
			titulo: "Bloque efectivo",
			objetivo: "Trabajo principal de fuerza y control tecnico.",
			ejercicios: [
				{
					ejercicioId: "1",
					series: 4,
					repeticiones: "8-10",
					carga: "60-70%",
					observaciones: "Mantener rango completo sin llegar al fallo.",
				},
				{
					ejercicioId: "2",
					series: 4,
					repeticiones: "6-8",
					carga: "Moderada-alta",
					observaciones: "Priorizar calidad tecnica y estabilidad.",
				},
			],
		},
		{
			id: "demo-bloque-ap-vuelta-calma",
			titulo: "Bloque de vuelta a la calma",
			objetivo: "Bajar pulsaciones, movilidad final y recuperacion.",
			ejercicios: [
				{
					ejercicioId: "1",
					series: 1,
					repeticiones: "8-10",
					carga: "Muy liviana",
					observaciones: "Respiracion nasal y control postural.",
				},
			],
		},
	];

	const firstPres =
		Array.isArray(demo.prescripciones) && demo.prescripciones[0]
			? demo.prescripciones[0]
			: {
					id: "demo-prescripcion-ap-1",
					personaNombre: "Alumno Prueba",
					personaTipo: "alumnos",
					createdAt: new Date().toISOString(),
					intensidadDelta: 5,
					volumenDelta: 0,
					readinessScore: 8,
				};

	firstPres.resumen =
		"Semana inicial estructurada en 3 bloques: calentamiento, efectivo y vuelta a la calma.";
	firstPres.bloques = [
		{
			id: "demo-presc-bloque-ap-calentamiento",
			titulo: "Calentamiento adaptado",
			objetivo: "Activacion suave y movilidad previa",
			ejercicios: [
				{
					ejercicioId: "1",
					series: 2,
					repeticiones: "12-15",
					carga: "Muy liviana",
					observaciones: "Activar sin fatiga acumulada",
				},
				{
					ejercicioId: "2",
					series: 2,
					repeticiones: "10-12",
					carga: "Peso corporal",
					observaciones: "Enfocar tecnica y control",
				},
			],
		},
		{
			id: "demo-presc-bloque-ap-efectivo",
			titulo: "Bloque efectivo adaptado",
			objetivo: "Trabajo principal con carga progresiva",
			ejercicios: [
				{
					ejercicioId: "1",
					series: 4,
					repeticiones: "8-10",
					carga: "60-70%",
					observaciones: "Ultima serie con reserva de 1-2 reps",
				},
				{
					ejercicioId: "2",
					series: 4,
					repeticiones: "6-8",
					carga: "Moderada",
					observaciones: "Control excentrico y postura",
				},
			],
		},
		{
			id: "demo-presc-bloque-ap-vuelta-calma",
			titulo: "Vuelta a la calma adaptada",
			objetivo: "Recuperacion activa y cierre de sesion",
			ejercicios: [
				{
					ejercicioId: "1",
					series: 1,
					repeticiones: "8-10",
					carga: "Muy liviana",
					observaciones: "Disminuir ritmo cardiaco de forma gradual",
				},
			],
		},
	];

	demo.prescripciones = [firstPres];
	sessions[idx] = demo;

	const putRes = await fetch(`${base}/api/sync/${key}`, {
		method: "PUT",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ value: sessions }),
	});
	const putJson = await putRes.json().catch(() => ({}));
	if (!putRes.ok || !putJson.ok) {
		throw new Error(`PUT failed ${putRes.status} ${JSON.stringify(putJson)}`);
	}

	const verifyRes = await fetch(`${base}/api/sync/${key}`);
	if (!verifyRes.ok) {
		throw new Error(`VERIFY failed ${verifyRes.status}`);
	}
	const verifyJson = await verifyRes.json();
	const saved = (Array.isArray(verifyJson.value) ? verifyJson.value : []).find(
		(s) => s.id === "demo-sesion-alumno-prueba"
	);

	console.log(
		JSON.stringify(
			{
				ok: true,
				sessionId: saved?.id,
				bloques: (saved?.bloques || []).map((b) => b.titulo),
				prescripciones: (saved?.prescripciones || []).map((p) => ({
					id: p.id,
					bloques: (p.bloques || []).map((b) => b.titulo),
				})),
			},
			null,
			2
		)
	);
})().catch((error) => {
	console.error(String(error));
	process.exit(1);
});
