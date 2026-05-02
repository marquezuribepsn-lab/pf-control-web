export type Categoria = {
  nombre: string;
  habilitada: boolean;
};

export type Ejercicio = {
  id: string;
  nombre: string;
  categoria: string;
  descripcion?: string;
  objetivo?: string;
  videoUrl?: string;
  gruposMusculares?: string[];
};

export type Jugadora = {
  nombre: string;
  estado?: "activo" | "finalizado";
  posicion: string;
  wellness: number;
  carga: number;
  fechaNacimiento?: string;
  altura?: string;
  peso?: string;
  deporte?: string;
  categoria?: string;
  club?: string;
  objetivo?: string;
  observaciones?: string;
};

export type Alumno = {
  nombre: string;
  estado?: "activo" | "finalizado";
  fechaNacimiento?: string;
  altura?: string;
  peso?: string;
  club?: string;
  objetivo?: string;
  observaciones?: string;
  practicaDeporte: boolean;
};

export type BloqueEntrenamiento = {
  id: string;
  titulo: string;
  objetivo: string;
  ejercicios: {
    ejercicioId: string;
    series: number;
    repeticiones: string;
    descanso?: string;
    carga?: string;
    observaciones?: string;
    metricas?: {
      nombre: string;
      valor: string;
    }[];
    superSerie?: {
      id?: string;
      ejercicioId?: string;
      series?: string | number;
      repeticiones?: string | number;
      descanso?: string;
      carga?: string;
    }[];
  }[];
};

export type PrescripcionSesionPersona = {
  id: string;
  personaNombre: string;
  personaTipo: "jugadoras" | "alumnos";
  createdAt: string;
  intensidadDelta: number;
  volumenDelta: number;
  readinessScore: number;
  resumen: string;
  bloques: BloqueEntrenamiento[];
};

export type Sesion = {
  id: string;
  titulo: string;
  objetivo: string;
  duracion: string;
  equipo: string;
  asignacionTipo?: "jugadoras" | "alumnos";
  categoriaAsignada?: string;
  jugadoraAsignada?: string;
  alumnoAsignado?: string;
  bloques: BloqueEntrenamiento[];
  prescripciones?: PrescripcionSesionPersona[];
};

export type WellnessItem = {
  nombre: string;
  bienestar: number;
  fatiga: number;
  dolor: number;
  disponibilidad: string;
  comentario: string;
};

export const categoriasIniciales: Categoria[] = [
  { nombre: "Primera", habilitada: true },
  { nombre: "Sub 18", habilitada: true },
  { nombre: "Sub 16", habilitada: true },
  { nombre: "Nutricion", habilitada: true },
];

export type Deporte = {
  nombre: string;
  habilitado: boolean;
  posiciones: string[];
};

export const deportesIniciales: Deporte[] = [
  { 
    nombre: "Fútbol", 
    habilitado: true,
    posiciones: [
      "Portero",
      "Defensa central",
      "Lateral derecho",
      "Lateral izquierdo",
      "Pivote defensivo",
      "Mediocampista central",
      "Mediocampista derecho",
      "Mediocampista izquierdo",
      "Extremo derecho",
      "Extremo izquierdo",
      "Delantero centro",
      "Segundo delantero"
    ]
  },
  {
    nombre: "Hockey",
    habilitado: true,
    posiciones: [
      "Portero",
      "Defensa derecho",
      "Defensa izquierdo",
      "Defensa central",
      "Volante derecho",
      "Volante izquierdo",
      "Volante central",
      "Delantero derecho",
      "Delantero izquierdo",
      "Delantero centro"
    ]
  },
  {
    nombre: "Baloncesto",
    habilitado: true,
    posiciones: [
      "Base",
      "Escolta",
      "Alero",
      "Ala-Pívot",
      "Pívot"
    ]
  },
  {
    nombre: "Voleibol",
    habilitado: true,
    posiciones: [
      "Libero",
      "Central",
      "Opuesto",
      "Receptor",
      "Armador"
    ]
  },
  {
    nombre: "Tenis",
    habilitado: true,
    posiciones: [
      "Jugador individual",
      "Dobles"
    ]
  },
  {
    nombre: "Rugby",
    habilitado: true,
    posiciones: [
      "Prop",
      "Hooker",
      "Lock",
      "Flanker",
      "Number 8",
      "Scrum-half",
      "Fly-half",
      "Centre",
      "Wing",
      "Full-back"
    ]
  },
  {
    nombre: "Handball",
    habilitado: true,
    posiciones: [
      "Goalkeeper",
      "Left back",
      "Centre back",
      "Right back",
      "Left wing",
      "Right wing",
      "Pivot"
    ]
  },
  {
    nombre: "Baseball",
    habilitado: true,
    posiciones: [
      "Pitcher",
      "Catcher",
      "First baseman",
      "Second baseman",
      "Third baseman",
      "Shortstop",
      "Left fielder",
      "Center fielder",
      "Right fielder"
    ]
  }
];

export const dashboardStats = [
  { title: "Categoría activa", value: "Primera" },
  { title: "Jugadoras", value: "24" },
  { title: "Carga semanal", value: "4.820" },
  { title: "Wellness promedio", value: "7.4" },
];

export const jugadorasIniciales: Jugadora[] = [
  {
    nombre: "Sofía Gómez",
    posicion: "Volante",
    wellness: 8,
    carga: 540,
    fechaNacimiento: "2002-05-10",
    altura: "168",
    peso: "60",
    deporte: "Fútbol",
    categoria: "Primera",
    club: "Club Atlético Ejemplo",
    objetivo: "Potencia y prevención",
    observaciones: "Sin novedades",
  },
  {
    nombre: "Valentina Ruiz",
    posicion: "Delantera",
    wellness: 4,
    carga: 760,
    fechaNacimiento: "2001-11-02",
    altura: "164",
    peso: "57",
    deporte: "Fútbol",
    categoria: "Primera",
    club: "Club Atlético Ejemplo",
    objetivo: "Fuerza y aceleración",
    observaciones: "Fatiga alta",
  },
  {
    nombre: "Camila Torres",
    posicion: "Defensora",
    wellness: 7,
    carga: 490,
    fechaNacimiento: "2003-03-21",
    altura: "170",
    peso: "62",
    deporte: "Fútbol",
    categoria: "Primera",
    club: "Club Atlético Ejemplo",
    objetivo: "Fuerza general",
    observaciones: "Normal",
  },
  {
    nombre: "Ana López",
    posicion: "Portera",
    wellness: 9,
    carga: 520,
    fechaNacimiento: "2006-07-15",
    altura: "172",
    peso: "65",
    deporte: "Fútbol",
    categoria: "Sub 18",
    club: "Club Atlético Ejemplo",
    objetivo: "Técnica y agilidad",
    observaciones: "Buen estado",
  },
  {
    nombre: "María Fernández",
    posicion: "Mediocampista",
    wellness: 6,
    carga: 480,
    fechaNacimiento: "2007-09-12",
    altura: "160",
    peso: "55",
    deporte: "Fútbol",
    categoria: "Sub 18",
    club: "Club Atlético Ejemplo",
    objetivo: "Condición física",
    observaciones: "Recuperándose",
  },
  {
    nombre: "Lucía Martínez",
    posicion: "Defensora",
    wellness: 8,
    carga: 450,
    fechaNacimiento: "2008-01-08",
    altura: "165",
    peso: "58",
    deporte: "Fútbol",
    categoria: "Sub 16",
    club: "Club Atlético Ejemplo",
    objetivo: "Fuerza básica",
    observaciones: "Normal",
  },
];

export const sesionesIniciales: Sesion[] = [
  {
    id: "1",
    titulo: "Fuerza tren inferior + aceleración",
    objetivo: "Desarrollar fuerza, prevención y aceleración inicial.",
    duracion: "70",
    equipo: "Primera Femenina",
    bloques: [
      {
        id: "1",
        titulo: "Bloque principal - Fuerza",
        objetivo: "Desarrollo de fuerza unilateral",
        ejercicios: [
          {
            ejercicioId: "1", // Sentadilla búlgara
            series: 3,
            repeticiones: "8-10",
            carga: "70-80% 1RM",
            observaciones: "Mantener equilibrio, no tocar el suelo con la rodilla trasera",
          },
          {
            ejercicioId: "2", // Nordic curl asistido
            series: 3,
            repeticiones: "6-8",
            carga: "Asistido con banda",
            observaciones: "Controlar la bajada, evitar rebote",
          },
        ],
      },
      {
        id: "2",
        titulo: "Bloque velocidad",
        objetivo: "Desarrollo de aceleración",
        ejercicios: [
          {
            ejercicioId: "3", // Sprint 10m
            series: 6,
            repeticiones: "1",
            carga: "Máxima intensidad",
            observaciones: "Recuperación completa entre series, técnica perfecta",
          },
        ],
      },
    ],
  },
];

export const wellnessInicial: WellnessItem[] = [
  {
    nombre: "Sofía Gómez",
    bienestar: 8,
    fatiga: 3,
    dolor: 1,
    disponibilidad: "Disponible",
    comentario: "Buena recuperación.",
  },
  {
    nombre: "Valentina Ruiz",
    bienestar: 4,
    fatiga: 8,
    dolor: 3,
    disponibilidad: "Limitada",
    comentario: "Cansancio alto post sesión.",
  },
  {
    nombre: "Camila Torres",
    bienestar: 7,
    fatiga: 4,
    dolor: 1,
    disponibilidad: "Disponible",
    comentario: "Normal.",
  },
];

export const semana = [
  { dia: "Lunes", sesion: "Fuerza tren inferior + aceleración" },
  { dia: "Martes", sesion: "Preventivo + movilidad" },
  { dia: "Miércoles", sesion: "Velocidad + cambios de dirección" },
  { dia: "Jueves", sesion: "Sin sesión" },
  { dia: "Viernes", sesion: "Fuerza general + core" },
  { dia: "Sábado", sesion: "Activación pre partido" },
  { dia: "Domingo", sesion: "Descanso" },
];

export const bloquesSesion = [
  {
    titulo: "Bloque principal",
    objetivo: "Fuerza unilateral",
    ejercicios: ["Sentadilla búlgara", "Nordic curl asistido"],
  },
  {
    titulo: "Velocidad",
    objetivo: "Aceleración corta",
    ejercicios: ["Sprint 10m", "Salidas reactivas"],
  },
];

export const registrosEntreno = [
  {
    nombre: "Sofía Gómez",
    sesion: "Fuerza tren inferior + aceleración",
    rpe: 7,
    carga: 490,
    volumen: 960,
    estadoFinal: "Bien",
  },
  {
    nombre: "Valentina Ruiz",
    sesion: "Fuerza tren inferior + aceleración",
    rpe: 9,
    carga: 630,
    volumen: 840,
    estadoFinal: "Muy cansada",
  },
  {
    nombre: "Camila Torres",
    sesion: "Fuerza tren inferior + aceleración",
    rpe: 6,
    carga: 420,
    volumen: 900,
    estadoFinal: "Normal",
  },
];

export const alumnosIniciales: Alumno[] = [];