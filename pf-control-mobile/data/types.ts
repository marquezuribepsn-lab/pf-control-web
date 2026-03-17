export type Categoria = {
  nombre: string;
  habilitada: boolean;
};

export type Jugadora = {
  nombre: string;
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

export type Deporte = {
  nombre: string;
  habilitado: boolean;
  posiciones: string[];
};

// Initial data - in a real app, this would come from an API
export const categoriasIniciales: Categoria[] = [
  { nombre: "Primera", habilitada: true },
  { nombre: "Sub 18", habilitada: true },
  { nombre: "Sub 16", habilitada: true },
];

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