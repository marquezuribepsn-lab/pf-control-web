"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { markManualSaveIntent, useSharedState } from "@/components/useSharedState";
import { argentineFoodsBase, type ArgentineFood } from "@/data/argentineFoods";

type TabKey = "descripcion" | "nuevo" | "registros";
type StudentSectionKey = "inicio" | "rutina" | "nutricion" | "medidas" | "progreso";

type PlannedSet = {
  serie: number;
  repeticiones: string;
  descanso: string;
  rir: string;
  carga: string;
  observaciones: string;
};

type ExerciseRecord = {
  id: string;
  fecha: string;
  serie: number;
  repeticiones: number;
  carga: number;
  rir: number;
  molestia: number;
  comentario: string;
  videoUrl: string;
  thumbnailUrl: string;
  isPR: boolean;
  createdAt: string;
};

type DraftRecord = {
  editId: string | null;
  fecha: string;
  serie: number;
  repeticiones: string;
  carga: string;
  rir: string;
  molestia: number;
  comentario: string;
  videoUrl: string;
  thumbnailUrl: string;
};

type BodyMetricRecord = {
  id: string;
  fecha: string;
  peso: number;
  grasaCorporal: number;
  cintura: number;
  cadera: number;
  pecho: number;
  brazo: number;
  muslo: number;
  comentario: string;
};

type SharedBodyMetricRecord = BodyMetricRecord & {
  alumnoNombre: string;
  updatedAt: string;
};

type AlumnoProfileLite = {
  nombre: string;
  altura?: string;
};

type SessionUserRole = {
  role?: string;
};

type ClienteMetaLite = {
  sexo?: "masculino" | "femenino";
};

type DateRangeFilter = "7d" | "30d" | "all";

type SessionExercise = {
  ejercicioId: string;
  series: number;
  repeticiones: string;
  descanso?: string;
  carga?: string;
  observaciones?: string;
};

type SessionBlock = {
  id: string;
  titulo: string;
  objetivo: string;
  ejercicios: SessionExercise[];
};

type SessionPrescription = {
  personaNombre: string;
  personaTipo: "jugadoras" | "alumnos";
  createdAt: string;
  bloques: SessionBlock[];
};

type StudentSession = {
  id: string;
  titulo: string;
  objetivo: string;
  duracion: string;
  alumnoAsignado?: string;
  bloques: SessionBlock[];
  prescripciones?: SessionPrescription[];
};

type NutritionPlanFoodItem = {
  id: string;
  foodId: string;
  gramos: number;
};

type NutritionPlanMeal = {
  id: string;
  nombre: string;
  items: NutritionPlanFoodItem[];
};

type NutritionPlan = {
  id: string;
  nombre: string;
  alumnoAsignado: string | null;
  objetivo: string;
  targets: {
    calorias: number;
    proteinas: number;
    carbohidratos: number;
    grasas: number;
  };
  comidas: NutritionPlanMeal[];
};

type NutritionAssignment = {
  alumnoNombre: string;
  planId: string;
  assignedAt: string;
};

type RoutineRow = {
  ejercicio: string;
  series: string;
  reps: string;
  rir: string;
  descanso: string;
};

type AlumnoPlaylistAssignment = {
  id?: string;
  alumnoNombre: string;
  spotifyUrl: string;
  playlistTitle: string;
  isActive?: boolean;
  objetivo?: string;
  diaSemana?: string;
  recommendedSongTitle?: string;
  recommendedSongArtist?: string;
  updatedAt: string;
};

const STORAGE_KEY = "pf-control-alumno-ejercicio-registros-v1";
const BODY_METRICS_STORAGE_KEY = "pf-control-alumno-medidas-v1";
const EXERCISE_KEY = "press-plano-c-barra";
const SESSIONS_KEY = "pf-control-sesiones";
const NUTRITION_PLANS_KEY = "pf-control-nutricion-planes-v1";
const NUTRITION_ASSIGNMENTS_KEY = "pf-control-nutricion-asignaciones-v1";
const NUTRITION_CUSTOM_FOODS_KEY = "pf-control-nutricion-alimentos-v1";
const ALUMNO_PLAYLISTS_KEY = "pf-control-alumno-playlists-v1";
const ALUMNO_ANTROPOMETRIA_KEY = "pf-control-alumno-antropometria-v1";
const ALUMNOS_KEY = "pf-control-alumnos";
const CLIENTE_META_KEY = "pf-control-clientes-meta-v1";
const ALL_ALUMNOS_KEY = "__ALL_ALUMNOS__";

const plannedSets: PlannedSet[] = [
  {
    serie: 1,
    repeticiones: "8",
    descanso: "2 min",
    rir: "2",
    carga: "S/D",
    observaciones: "S/D",
  },
  {
    serie: 2,
    repeticiones: "8",
    descanso: "2 min",
    rir: "2",
    carga: "S/D",
    observaciones: "S/D",
  },
  {
    serie: 3,
    repeticiones: "6 - 8",
    descanso: "2 min",
    rir: "2",
    carga: "S/D",
    observaciones: "S/D",
  },
  {
    serie: 4,
    repeticiones: "6 - 8",
    descanso: "2 min",
    rir: "2",
    carga: "S/D",
    observaciones: "S/D",
  },
];

function normalizePersonKey(value: string): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesLikelyMatch(a: string, b: string): boolean {
  const left = normalizePersonKey(a);
  const right = normalizePersonKey(b);

  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;

  const leftTokens = left.split(" ").filter(Boolean);
  const rightTokens = right.split(" ").filter(Boolean);
  const shared = leftTokens.filter((token) => rightTokens.includes(token));

  return shared.length >= 2 || shared.some((token) => token.length >= 5);
}

function parseHeightMeters(value?: string): number | null {
  if (!value) return null;
  const normalized = value.replace(/,/g, ".").replace(/[^0-9.]/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  if (parsed > 10) return parsed / 100;
  return parsed;
}

function estimateBodyFatRfm(
  heightMeters: number | null,
  waistCm: number,
  sexo: "masculino" | "femenino" | null
): number | null {
  if (!heightMeters || heightMeters <= 0 || !Number.isFinite(waistCm) || waistCm <= 0 || !sexo) {
    return null;
  }

  const heightCm = heightMeters * 100;
  const raw = sexo === "masculino"
    ? 64 - 20 * (heightCm / waistCm)
    : 76 - 20 * (heightCm / waistCm);

  if (!Number.isFinite(raw)) return null;
  const clamped = Math.max(2, Math.min(70, raw));
  return Math.round(clamped * 10) / 10;
}

function extractSpotifyPlaylistId(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;

  const uriMatch = raw.match(/^spotify:playlist:([a-zA-Z0-9]+)$/i);
  if (uriMatch?.[1]) {
    return uriMatch[1];
  }

  const webMatch = raw.match(/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)(?:\?|$)/i);
  if (webMatch?.[1]) {
    return webMatch[1];
  }

  return null;
}

function getTodayWeekdayLabel() {
  const days = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
  return days[new Date().getDay()] || "";
}

function automaticSongByObjectiveAndDay(objective: string, day: string) {
  const normalizedObjective = (objective || "").toLowerCase();
  const normalizedDay = (day || "").toLowerCase();

  const map: Record<string, Record<string, { title: string; artist: string }>> = {
    fuerza: {
      lunes: { title: "Till I Collapse", artist: "Eminem" },
      martes: { title: "Can\'t Hold Us", artist: "Macklemore & Ryan Lewis" },
      miercoles: { title: "Power", artist: "Kanye West" },
      jueves: { title: "Remember the Name", artist: "Fort Minor" },
      viernes: { title: "Stronger", artist: "Kanye West" },
      sabado: { title: "Believer", artist: "Imagine Dragons" },
      domingo: { title: "Eye of the Tiger", artist: "Survivor" },
    },
    cardio: {
      lunes: { title: "Titanium", artist: "David Guetta ft. Sia" },
      martes: { title: "Don\'t Stop Me Now", artist: "Queen" },
      miercoles: { title: "Wake Me Up", artist: "Avicii" },
      jueves: { title: "Blinding Lights", artist: "The Weeknd" },
      viernes: { title: "Levels", artist: "Avicii" },
      sabado: { title: "Levitating", artist: "Dua Lipa" },
      domingo: { title: "On Top of the World", artist: "Imagine Dragons" },
    },
    movilidad: {
      lunes: { title: "Sunset Lover", artist: "Petit Biscuit" },
      martes: { title: "A Moment Apart", artist: "ODESZA" },
      miercoles: { title: "Innerbloom", artist: "RUFUS DU SOL" },
      jueves: { title: "Midnight City", artist: "M83" },
      viernes: { title: "Outro", artist: "M83" },
      sabado: { title: "Weightless", artist: "Marconi Union" },
      domingo: { title: "Holocene", artist: "Bon Iver" },
    },
    "pre-entreno": {
      lunes: { title: "DNA.", artist: "Kendrick Lamar" },
      martes: { title: "SICKO MODE", artist: "Travis Scott" },
      miercoles: { title: "X Gon\' Give It To Ya", artist: "DMX" },
      jueves: { title: "POWER", artist: "Kanye West" },
      viernes: { title: "HUMBLE.", artist: "Kendrick Lamar" },
      sabado: { title: "Lose Yourself", artist: "Eminem" },
      domingo: { title: "Numb/Encore", artist: "Jay-Z & Linkin Park" },
    },
    "post-entreno": {
      lunes: { title: "The Nights", artist: "Avicii" },
      martes: { title: "Good Life", artist: "OneRepublic" },
      miercoles: { title: "Paradise", artist: "Coldplay" },
      jueves: { title: "Adventure of a Lifetime", artist: "Coldplay" },
      viernes: { title: "Hall of Fame", artist: "The Script" },
      sabado: { title: "Best Day of My Life", artist: "American Authors" },
      domingo: { title: "Firework", artist: "Katy Perry" },
    },
    recuperacion: {
      lunes: { title: "Night Owl", artist: "Galimatias" },
      martes: { title: "River Flows In You", artist: "Yiruma" },
      miercoles: { title: "Experience", artist: "Ludovico Einaudi" },
      jueves: { title: "Nuvole Bianche", artist: "Ludovico Einaudi" },
      viernes: { title: "Comptine d\'un autre ete", artist: "Yann Tiersen" },
      sabado: { title: "Bloom", artist: "The Paper Kites" },
      domingo: { title: "Anchor", artist: "Novo Amor" },
    },
    libre: {
      lunes: { title: "Believer", artist: "Imagine Dragons" },
      martes: { title: "Counting Stars", artist: "OneRepublic" },
      miercoles: { title: "Run Boy Run", artist: "Woodkid" },
      jueves: { title: "Feel It Still", artist: "Portugal. The Man" },
      viernes: { title: "Higher Love", artist: "Kygo & Whitney Houston" },
      sabado: { title: "Shut Up and Dance", artist: "WALK THE MOON" },
      domingo: { title: "Viva La Vida", artist: "Coldplay" },
    },
  };

  const objectiveMap = map[normalizedObjective] || map.libre;
  return objectiveMap[normalizedDay] || objectiveMap.lunes || map.libre.lunes;
}

const getToday = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const defaultDraft = (): DraftRecord => ({
  editId: null,
  fecha: getToday(),
  serie: 1,
  repeticiones: "",
  carga: "",
  rir: "",
  molestia: 0,
  comentario: "",
  videoUrl: "",
  thumbnailUrl: "",
});

const formatDateLabel = (isoDate: string) => {
  try {
    return new Date(`${isoDate}T00:00:00`).toLocaleDateString("es-AR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return isoDate;
  }
};

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("No se pudo leer el archivo"));
      }
    };
    reader.onerror = () => reject(new Error("Error al leer archivo"));
    reader.readAsDataURL(file);
  });

const extractVideoThumbnail = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    video.preload = "metadata";
    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };

    video.onloadeddata = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          reject(new Error("No se pudo crear thumbnail"));
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = canvas.toDataURL("image/jpeg", 0.75);
        cleanup();
        resolve(image);
      } catch (error) {
        cleanup();
        reject(error instanceof Error ? error : new Error("No se pudo generar thumbnail"));
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("No se pudo leer video para thumbnail"));
    };
  });

const optimizeVideoForUpload = async (file: File): Promise<File> => {
  const maxSourceBytesForOptimization = 8 * 1024 * 1024;
  if (file.size < 4 * 1024 * 1024 || file.size > maxSourceBytesForOptimization) {
    return file;
  }

  if (
    typeof window === "undefined" ||
    typeof MediaRecorder === "undefined" ||
    typeof HTMLCanvasElement === "undefined"
  ) {
    return file;
  }

  const preferredMime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(
    (mime) => {
      try {
        return MediaRecorder.isTypeSupported(mime);
      } catch {
        return false;
      }
    }
  );

  if (!preferredMime) {
    return file;
  }

  const originalUrl = URL.createObjectURL(file);

  try {
    const video = document.createElement("video");
    video.src = originalUrl;
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("No se pudo cargar metadata del video"));
    });

    const duration = Number(video.duration || 0);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 45) {
      return file;
    }

    const maxWidth = 960;
    const sourceWidth = video.videoWidth || 640;
    const sourceHeight = video.videoHeight || 360;
    const ratio = Math.min(1, maxWidth / sourceWidth);
    const targetWidth = Math.max(320, Math.round(sourceWidth * ratio));
    const targetHeight = Math.max(180, Math.round(sourceHeight * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    const stream = canvas.captureStream(24);
    const recorder = new MediaRecorder(stream, {
      mimeType: preferredMime,
      videoBitsPerSecond: 950_000,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    const stopPromise = new Promise<Blob>((resolve, reject) => {
      recorder.onerror = () => reject(new Error("Error al optimizar video"));
      recorder.onstop = () => resolve(new Blob(chunks, { type: preferredMime }));
    });

    const drawFrame = () => {
      if (video.paused || video.ended) {
        return;
      }
      context.drawImage(video, 0, 0, targetWidth, targetHeight);
      requestAnimationFrame(drawFrame);
    };

    recorder.start(250);
    await video.play();
    drawFrame();

    await new Promise<void>((resolve) => {
      video.onended = () => resolve();
    });

    if (recorder.state !== "inactive") {
      recorder.stop();
    }

    const optimizedBlob = await stopPromise;
    if (!optimizedBlob || optimizedBlob.size === 0) {
      return file;
    }

    if (optimizedBlob.size >= file.size * 0.9) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "video";
    return new File([optimizedBlob], `${baseName}.webm`, { type: preferredMime });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(originalUrl);
  }
};

export default function AlumnoExerciseDetailPage({
  initialSection,
}: {
  initialSection?: StudentSectionKey;
}) {
  const { data: session } = useSession();
  const [section, setSection] = useState<StudentSectionKey>(initialSection || "inicio");
  const [tab, setTab] = useState<TabKey>("descripcion");
  const [draft, setDraft] = useState<DraftRecord>(defaultDraft());
  const [records, setRecords] = useState<ExerciseRecord[]>([]);
  const [savePulse, setSavePulse] = useState(false);
  const [formError, setFormError] = useState<string>("");
  const [syncStatus, setSyncStatus] = useState<"idle" | "cloud" | "local">("idle");
  const [syncLoading, setSyncLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<"none" | "save" | "delete">("none");
  const [dateRange, setDateRange] = useState<DateRangeFilter>("30d");
  const [searchText, setSearchText] = useState("");
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState("");
  const [uploadedVideoSizeLabel, setUploadedVideoSizeLabel] = useState("");
  const [onlyPR, setOnlyPR] = useState(false);
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
  const [page, setPage] = useState(1);
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetricRecord[]>([]);
  const [metricDraft, setMetricDraft] = useState({
    fecha: getToday(),
    peso: "",
    cintura: "",
    cadera: "",
    pecho: "",
    brazo: "",
    muslo: "",
    comentario: "",
  });
  const pageSize = 6;
  const studentName = String(session?.user?.name || "").trim();
  const isClienteRole = ((session?.user as SessionUserRole | undefined)?.role || "") === "CLIENTE";

  const now = new Date();
  const currentHour = now.getHours();
  const greeting = currentHour < 12 ? "Buenos dias" : currentHour < 20 ? "Buenas tardes" : "Buenas noches";
  const todayWeekday = getTodayWeekdayLabel();

  useEffect(() => {
    setSection(initialSection || "inicio");
  }, [initialSection]);

  const [sesiones] = useSharedState<StudentSession[]>([], {
    key: SESSIONS_KEY,
    legacyLocalStorageKey: SESSIONS_KEY,
  });

  const [nutritionPlans] = useSharedState<NutritionPlan[]>([], {
    key: NUTRITION_PLANS_KEY,
    legacyLocalStorageKey: NUTRITION_PLANS_KEY,
  });

  const [nutritionAssignments] = useSharedState<NutritionAssignment[]>([], {
    key: NUTRITION_ASSIGNMENTS_KEY,
    legacyLocalStorageKey: NUTRITION_ASSIGNMENTS_KEY,
  });

  const [nutritionCustomFoods] = useSharedState<ArgentineFood[]>([], {
    key: NUTRITION_CUSTOM_FOODS_KEY,
    legacyLocalStorageKey: NUTRITION_CUSTOM_FOODS_KEY,
  });

  const [alumnoPlaylists] = useSharedState<AlumnoPlaylistAssignment[]>([], {
    key: ALUMNO_PLAYLISTS_KEY,
    legacyLocalStorageKey: ALUMNO_PLAYLISTS_KEY,
  });

  const [alumnos] = useSharedState<AlumnoProfileLite[]>([], {
    key: ALUMNOS_KEY,
    legacyLocalStorageKey: ALUMNOS_KEY,
  });

  const [clientesMeta] = useSharedState<Record<string, ClienteMetaLite>>({}, {
    key: CLIENTE_META_KEY,
    legacyLocalStorageKey: CLIENTE_META_KEY,
  });

  const [sharedBodyMetrics, setSharedBodyMetrics, sharedBodyMetricsLoaded] = useSharedState<SharedBodyMetricRecord[]>([], {
    key: ALUMNO_ANTROPOMETRIA_KEY,
    legacyLocalStorageKey: ALUMNO_ANTROPOMETRIA_KEY,
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        if (!response.ok || cancelled) {
          return;
        }

        const data = (await response.json()) as { sidebarImage?: string | null };
        if (!cancelled) {
          setProfileImage(typeof data.sidebarImage === "string" && data.sidebarImage ? data.sidebarImage : null);
        }
      } catch {
        if (!cancelled) {
          setProfileImage(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveLocalFallback = (nextRecords: ExerciseRecord[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
    } catch {
      // ignore persistence errors
    }
  };

  const loadLocalFallback = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as ExerciseRecord[];
      if (!Array.isArray(parsed)) return [];
      return parsed.sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)));
    } catch {
      return [];
    }
  };

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setSyncLoading(true);
      try {
        const response = await fetch(`/api/alumno/ejercicio-registros?exercise=${EXERCISE_KEY}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("cloud unavailable");
        }

        const data = (await response.json()) as { records?: ExerciseRecord[] };
        const fetched = Array.isArray(data.records)
          ? data.records.sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)))
          : [];

        if (!cancelled) {
          setRecords(fetched);
          setSyncStatus("cloud");
          saveLocalFallback(fetched);
        }
      } catch {
        const fallback = loadLocalFallback();
        if (!cancelled) {
          setRecords(fallback);
          setSyncStatus("local");
        }
      } finally {
        if (!cancelled) {
          setSyncLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!videoModalUrl) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setVideoModalUrl(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [videoModalUrl]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      // ignore persistence errors
    }
  }, [records]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BODY_METRICS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as BodyMetricRecord[];
      if (!Array.isArray(parsed)) return;
      setBodyMetrics(
        parsed.sort((a, b) => Number(new Date(b.fecha)) - Number(new Date(a.fecha)))
      );
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(BODY_METRICS_STORAGE_KEY, JSON.stringify(bodyMetrics));
    } catch {
      // ignore persistence errors
    }
  }, [bodyMetrics]);

  useEffect(() => {
    if (!sharedBodyMetricsLoaded || !studentName || bodyMetrics.length === 0) {
      return;
    }

    const existingKeys = new Set(
      sharedBodyMetrics
        .filter((item) => namesLikelyMatch(item.alumnoNombre, studentName))
        .map((item) => `${item.fecha}-${item.peso}-${item.cintura}-${item.cadera}-${item.pecho}-${item.brazo}-${item.muslo}`)
    );

    const missing = bodyMetrics.filter((item) => {
      const key = `${item.fecha}-${item.peso}-${item.cintura}-${item.cadera}-${item.pecho}-${item.brazo}-${item.muslo}`;
      return !existingKeys.has(key);
    });

    if (missing.length === 0) {
      return;
    }

    markManualSaveIntent(ALUMNO_ANTROPOMETRIA_KEY);
    setSharedBodyMetrics((prev) => {
      const mapped: SharedBodyMetricRecord[] = missing.map((item) => ({
        ...item,
        alumnoNombre: studentName,
        updatedAt: new Date().toISOString(),
      }));
      return [...mapped, ...prev];
    });
  }, [bodyMetrics, setSharedBodyMetrics, sharedBodyMetrics, sharedBodyMetricsLoaded, studentName]);

  useEffect(() => {
    const onClick = () => setOpenActionMenuId(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenActionMenuId(null);
      }
    };

    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const weeklyCount = useMemo(() => {
    const now = new Date();
    return records.filter((item) => {
      const diff = now.getTime() - new Date(item.createdAt).getTime();
      return diff <= 7 * 24 * 60 * 60 * 1000;
    }).length;
  }, [records]);

  const bestLoad = useMemo(() => {
    if (records.length === 0) return 0;
    return Math.max(...records.map((item) => item.carga));
  }, [records]);

  const latestRecord = records[0] || null;

  const studentProfile = useMemo(() => {
    if (!studentName) return null;
    return alumnos.find((item) => namesLikelyMatch(item.nombre, studentName)) || null;
  }, [alumnos, studentName]);

  const studentSexo = useMemo(() => {
    if (!studentName) return null;

    const exact = clientesMeta[`alumno:${studentName}`]?.sexo;
    if (exact) return exact;

    const similar = Object.entries(clientesMeta).find(([key]) => {
      if (!key.startsWith("alumno:")) return false;
      return namesLikelyMatch(key.slice(7), studentName);
    });

    return similar?.[1]?.sexo || null;
  }, [clientesMeta, studentName]);

  const studentHeightMeters = useMemo(
    () => parseHeightMeters(studentProfile?.altura),
    [studentProfile?.altura]
  );

  const filteredRecords = useMemo(() => {
    const now = new Date();
    const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : null;
    const normalizedSearch = searchText.trim().toLowerCase();

    return records.filter((item) => {
      if (onlyPR && !item.isPR) {
        return false;
      }

      if (days) {
        const diff = now.getTime() - new Date(item.createdAt).getTime();
        if (diff > days * 24 * 60 * 60 * 1000) {
          return false;
        }
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        String(item.fecha).toLowerCase().includes(normalizedSearch) ||
        String(item.comentario || "").toLowerCase().includes(normalizedSearch) ||
        String(item.carga).includes(normalizedSearch) ||
        String(item.repeticiones).includes(normalizedSearch)
      );
    });
  }, [records, dateRange, searchText, onlyPR]);

  useEffect(() => {
    setPage(1);
  }, [dateRange, searchText, records.length]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const chartData = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const entry of filteredRecords) {
      const prev = grouped.get(entry.fecha) || 0;
      grouped.set(entry.fecha, Math.max(prev, entry.carga));
    }

    const points = Array.from(grouped.entries())
      .map(([fecha, carga]) => ({ fecha, carga }))
      .sort((a, b) => Number(new Date(a.fecha)) - Number(new Date(b.fecha)))
      .slice(-8);

    return points;
  }, [filteredRecords]);

  const assignedSessions = useMemo(() => {
    if (!studentName) {
      return [] as StudentSession[];
    }

    return sesiones.filter((sesion) => {
      const byAssignedName = namesLikelyMatch(String(sesion.alumnoAsignado || ""), studentName);
      const byPrescription = (sesion.prescripciones || []).some(
        (item) => item.personaTipo === "alumnos" && namesLikelyMatch(item.personaNombre, studentName)
      );
      return byAssignedName || byPrescription;
    });
  }, [sesiones, studentName]);

  const latestSession = assignedSessions[0] || null;

  const latestPrescription = useMemo(() => {
    const all = assignedSessions
      .flatMap((sesion) => sesion.prescripciones || [])
      .filter(
        (item) => item.personaTipo === "alumnos" && namesLikelyMatch(item.personaNombre, studentName)
      )
      .sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)));

    return all[0] || null;
  }, [assignedSessions, studentName]);

  const routineRows = useMemo(() => {
    const sourceBlocks = latestPrescription?.bloques || latestSession?.bloques || [];
    const rows: RoutineRow[] = [];

    for (const bloque of sourceBlocks) {
      for (const ejercicio of bloque.ejercicios || []) {
        rows.push({
          ejercicio: ejercicio.ejercicioId || bloque.titulo || "Ejercicio",
          series: String(ejercicio.series || "-"),
          reps: ejercicio.repeticiones || "-",
          rir: "2",
          descanso: ejercicio.descanso || "S/D",
        });
      }
    }

    return rows;
  }, [latestPrescription, latestSession]);

  const routineGoal = latestSession?.objetivo || "Sin objetivo cargado";
  const routineDuration = latestSession?.duracion || "S/D";
  const plannedWeeklyItems = routineRows.length;

  const studentNutritionAssignment = useMemo(() => {
    if (!studentName) return null;

    const options = nutritionAssignments
      .filter((item) => namesLikelyMatch(item.alumnoNombre, studentName))
      .sort((a, b) => Number(new Date(b.assignedAt)) - Number(new Date(a.assignedAt)));

    return options[0] || null;
  }, [nutritionAssignments, studentName]);

  const studentNutritionPlan = useMemo(() => {
    if (studentNutritionAssignment) {
      return nutritionPlans.find((plan) => plan.id === studentNutritionAssignment.planId) || null;
    }

    return (
      nutritionPlans.find((plan) => namesLikelyMatch(String(plan.alumnoAsignado || ""), studentName)) ||
      null
    );
  }, [nutritionPlans, studentNutritionAssignment, studentName]);

  const plannedMeals = studentNutritionPlan?.comidas?.length || 0;

  const studentPlaylists = useMemo(() => {
    if (!studentName) return [] as Array<AlumnoPlaylistAssignment & { id: string }>;

    return alumnoPlaylists
      .filter(
        (item) =>
          (item.isActive ?? true) &&
          (item.alumnoNombre === ALL_ALUMNOS_KEY || namesLikelyMatch(item.alumnoNombre, studentName))
      )
      .map((item, index) => ({
        ...item,
        id: item.id || `${item.alumnoNombre}-${item.updatedAt}-${index}`,
      }))
      .sort((a, b) => {
        const aToday = (a.diaSemana || "") === todayWeekday ? 1 : 0;
        const bToday = (b.diaSemana || "") === todayWeekday ? 1 : 0;

        if (aToday !== bToday) {
          return bToday - aToday;
        }

        return Number(new Date(b.updatedAt)) - Number(new Date(a.updatedAt));
      });
  }, [alumnoPlaylists, studentName, todayWeekday]);

  useEffect(() => {
    if (studentPlaylists.length === 0) {
      setSelectedPlaylistId("");
      return;
    }

    if (studentPlaylists.some((item) => item.id === selectedPlaylistId)) {
      return;
    }

    setSelectedPlaylistId(studentPlaylists[0].id);
  }, [selectedPlaylistId, studentPlaylists]);

  const selectedPlaylist = useMemo(() => {
    if (!selectedPlaylistId) {
      return studentPlaylists[0] || null;
    }
    return studentPlaylists.find((item) => item.id === selectedPlaylistId) || studentPlaylists[0] || null;
  }, [selectedPlaylistId, studentPlaylists]);

  const studentPlaylistEmbedUrl = useMemo(() => {
    if (!selectedPlaylist?.spotifyUrl) return null;
    const playlistId = extractSpotifyPlaylistId(selectedPlaylist.spotifyUrl);
    if (!playlistId) return null;
    return `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator`;
  }, [selectedPlaylist]);

  const recommendedForToday = useMemo(() => {
    if (!selectedPlaylist) {
      return null;
    }

    if (!selectedPlaylist.recommendedSongTitle) {
      return automaticSongByObjectiveAndDay(selectedPlaylist.objetivo || "Libre", todayWeekday);
    }

    return {
      title: selectedPlaylist.recommendedSongTitle,
      artist: selectedPlaylist.recommendedSongArtist || "",
    };
  }, [selectedPlaylist, todayWeekday]);

  const openSelectedPlaylistInSpotifyApp = () => {
    if (!selectedPlaylist?.spotifyUrl) {
      return;
    }

    const playlistId = extractSpotifyPlaylistId(selectedPlaylist.spotifyUrl);
    if (!playlistId) {
      window.open(selectedPlaylist.spotifyUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const appUri = `spotify:playlist:${playlistId}`;
    window.location.href = appUri;

    window.setTimeout(() => {
      window.open(selectedPlaylist.spotifyUrl, "_blank", "noopener,noreferrer");
    }, 650);
  };

  const foodsById = useMemo(() => {
    const allFoods = [...argentineFoodsBase, ...(Array.isArray(nutritionCustomFoods) ? nutritionCustomFoods : [])];
    return new Map(allFoods.map((food) => [food.id, food.nombre]));
  }, [nutritionCustomFoods]);

  const resolveFoodName = (foodId: string) => foodsById.get(foodId) || foodId || "Alimento";

  const saveRecord = async () => {
    if (busyAction !== "none") {
      return;
    }

    setFormError("");

    const repeticiones = Number(draft.repeticiones);
    const carga = Number(draft.carga);
    const rir = Number(draft.rir);

    if (!draft.fecha) {
      setFormError("Selecciona la fecha del registro.");
      return;
    }

    if (!Number.isFinite(repeticiones) || repeticiones <= 0) {
      setFormError("Ingresa una cantidad de repeticiones valida.");
      return;
    }

    if (!Number.isFinite(carga) || carga < 0) {
      setFormError("Ingresa una carga valida en kg.");
      return;
    }

    if (!Number.isFinite(rir) || rir < 0 || rir > 10) {
      setFormError("Ingresa un RIR entre 0 y 10.");
      return;
    }

    const newRecord: ExerciseRecord = {
      id: draft.editId || `${Date.now()}`,
      fecha: draft.fecha,
      serie: draft.serie,
      repeticiones,
      carga,
      rir,
      molestia: draft.molestia,
      comentario: draft.comentario.trim(),
      videoUrl: draft.videoUrl.trim(),
      thumbnailUrl: draft.thumbnailUrl.trim(),
      isPR: false,
      createdAt: new Date().toISOString(),
    };

    let nextRecords: ExerciseRecord[] = [];
    let savedInCloud = false;

    try {
      setBusyAction("save");
      const response = await fetch("/api/alumno/ejercicio-registros", {
        method: draft.editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise: EXERCISE_KEY,
          recordId: draft.editId,
          record: newRecord,
        }),
      });

      if (!response.ok) {
        throw new Error("cloud save failed");
      }

      const data = (await response.json()) as { records?: ExerciseRecord[] };
      nextRecords = Array.isArray(data.records)
        ? data.records.sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)))
        : [newRecord, ...records];
      savedInCloud = true;
      setSyncStatus("cloud");
    } catch {
      nextRecords = [newRecord, ...records].sort(
        (a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt))
      );
      setSyncStatus("local");
    } finally {
      setBusyAction("none");
    }

    setRecords(nextRecords);
    saveLocalFallback(nextRecords);
    setDraft(defaultDraft());
    setSavePulse(true);
    window.setTimeout(() => setSavePulse(false), 1600);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("pf-inline-toast", {
          detail: {
            type: "success",
            title: "Guardado exitoso",
            message: savedInCloud
              ? draft.editId
                ? "Tu registro se actualizo en la nube correctamente."
                : "Tu registro se guardo en la nube correctamente."
              : "Registro guardado en este dispositivo (modo local).",
          },
        })
      );
    }

    setTab("registros");
  };

  const deleteRecord = async (recordId: string) => {
    const confirmed = window.confirm("Quieres eliminar este registro?");
    if (!confirmed) return;

    try {
      setBusyAction("delete");
      const response = await fetch("/api/alumno/ejercicio-registros", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise: EXERCISE_KEY,
          recordId,
        }),
      });

      if (!response.ok) {
        throw new Error("delete failed");
      }

      const data = (await response.json()) as { records?: ExerciseRecord[] };
      const nextRecords = Array.isArray(data.records)
        ? data.records.sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)))
        : records.filter((item) => item.id !== recordId);
      setRecords(nextRecords);
      saveLocalFallback(nextRecords);
      setSyncStatus("cloud");
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("pf-inline-toast", {
            detail: {
              type: "success",
              title: "Registro eliminado",
              message: "El registro se elimino correctamente.",
            },
          })
        );
      }
    } catch {
      const localNext = records.filter((item) => item.id !== recordId);
      setRecords(localNext);
      saveLocalFallback(localNext);
      setSyncStatus("local");
    } finally {
      setBusyAction("none");
    }
  };

  const startEditRecord = (record: ExerciseRecord) => {
    setDraft({
      editId: record.id,
      fecha: record.fecha,
      serie: record.serie,
      repeticiones: String(record.repeticiones),
      carga: String(record.carga),
      rir: String(record.rir),
      molestia: record.molestia,
      comentario: record.comentario,
      videoUrl: record.videoUrl || "",
      thumbnailUrl: record.thumbnailUrl || "",
    });
    setTab("nuevo");
  };

  const handleVideoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadInfo("");
    setUploadedVideoSizeLabel("");

    if (!file.type.startsWith("video/")) {
      setFormError("El archivo seleccionado no es un video valido.");
      event.target.value = "";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setFormError("El video supera el limite de 8MB.");
      event.target.value = "";
      return;
    }

    try {
      setVideoUploading(true);
      setFormError("");
      if (file.size > 4 * 1024 * 1024) {
        setUploadInfo("Optimizando video para mejorar velocidad de carga...");
      }

      const optimizedFile = await optimizeVideoForUpload(file);
      const reductionPct = Math.max(
        0,
        Math.round((1 - optimizedFile.size / Math.max(file.size, 1)) * 100)
      );
      if (optimizedFile.size < file.size) {
        setUploadInfo(`Video optimizado (${reductionPct}% menos peso).`);
      } else if (file.size > 4 * 1024 * 1024) {
        setUploadInfo("No se pudo optimizar automaticamente. Se usa version original.");
      }

      const [dataUrl, thumbnailUrl] = await Promise.all([
        fileToDataUrl(optimizedFile),
        extractVideoThumbnail(optimizedFile).catch(() => ""),
      ]);
      setDraft((prev) => ({ ...prev, videoUrl: dataUrl, thumbnailUrl }));

      const originalMb = (file.size / (1024 * 1024)).toFixed(2);
      const optimizedMb = (optimizedFile.size / (1024 * 1024)).toFixed(2);
      setUploadedVideoSizeLabel(`${optimizedMb}MB (original ${originalMb}MB)`);
    } catch {
      setFormError("No se pudo procesar el video.");
    } finally {
      setVideoUploading(false);
      event.target.value = "";
    }
  };

  const chartPath = useMemo(() => {
    if (chartData.length === 0) return "";

    const maxY = Math.max(...chartData.map((item) => item.carga), 1);
    return chartData
      .map((item, idx) => {
        const x = (idx / Math.max(chartData.length - 1, 1)) * 300 + 24;
        const y = 160 - (item.carga / maxY) * 120;
        return `${idx === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }, [chartData]);

  const latestMetric = bodyMetrics[0] || null;
  const previousMetric = bodyMetrics[1] || null;
  const pesoDiff = latestMetric && previousMetric ? latestMetric.peso - previousMetric.peso : 0;

  const addBodyMetric = () => {
    const peso = Number(metricDraft.peso);
    const cintura = Number(metricDraft.cintura);
    const cadera = Number(metricDraft.cadera);
    const pecho = Number(metricDraft.pecho);
    const brazo = Number(metricDraft.brazo);
    const muslo = Number(metricDraft.muslo);

    if (!metricDraft.fecha) {
      return;
    }

    if (![peso, cintura, cadera, pecho, brazo, muslo].every((value) => Number.isFinite(value) && value >= 0)) {
      return;
    }

    const grasaCorporal = estimateBodyFatRfm(studentHeightMeters, cintura, studentSexo) ?? 0;

    const record: BodyMetricRecord = {
      id: `${Date.now()}`,
      fecha: metricDraft.fecha,
      peso,
      grasaCorporal,
      cintura,
      cadera,
      pecho,
      brazo,
      muslo,
      comentario: metricDraft.comentario.trim(),
    };

    if (studentName) {
      markManualSaveIntent(ALUMNO_ANTROPOMETRIA_KEY);
      setSharedBodyMetrics((prev) => {
        const signature = `${record.fecha}-${record.peso}-${record.cintura}-${record.cadera}-${record.pecho}-${record.brazo}-${record.muslo}`;
        const alreadyExists = prev.some(
          (item) =>
            namesLikelyMatch(item.alumnoNombre, studentName) &&
            `${item.fecha}-${item.peso}-${item.cintura}-${item.cadera}-${item.pecho}-${item.brazo}-${item.muslo}` === signature
        );

        if (alreadyExists) {
          return prev;
        }

        const nextRecord: SharedBodyMetricRecord = {
          ...record,
          alumnoNombre: studentName,
          updatedAt: new Date().toISOString(),
        };

        return [nextRecord, ...prev];
      });
    }

    setBodyMetrics((prev) =>
      [record, ...prev].sort((a, b) => Number(new Date(b.fecha)) - Number(new Date(a.fecha)))
    );
    setMetricDraft({
      fecha: getToday(),
      peso: "",
      cintura: "",
      cadera: "",
      pecho: "",
      brazo: "",
      muslo: "",
      comentario: "",
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("pf-inline-toast", {
          detail: {
            type: "success",
            title: "Medidas guardadas",
            message: "Tu registro corporal se guardo correctamente.",
          },
        })
      );
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-3 py-4 text-slate-100 sm:px-6 sm:py-6">
      <section className="mb-4 rounded-3xl border border-white/10 bg-slate-950/80 p-4 shadow-2xl shadow-black/30 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-3">
          <div className="relative">
            {profileImage ? (
              <img
                src={profileImage}
                alt="Foto del alumno"
                className="h-14 w-14 rounded-full border border-white/20 object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-slate-900/70 text-xs text-slate-300">
                Sin foto
              </div>
            )}
            {isClienteRole ? (
              <span
                className="absolute -bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-950 bg-emerald-400 shadow-[0_0_0_2px_rgba(16,185,129,0.3)]"
                title="En linea"
                aria-label="En linea"
              />
            ) : null}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Perfil alumno</p>
            <p className="text-sm font-black text-white">{studentName || "Alumno"}</p>
          </div>
        </div>

        {studentPlaylistEmbedUrl && (
          <div className="mb-4 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Tu playlist</p>
            <p className="mt-1 text-sm font-bold text-white">
              {selectedPlaylist?.playlistTitle || "Playlist de entrenamiento"}
            </p>
            {recommendedForToday && (
              <div className="mt-2 rounded-xl border border-emerald-200/30 bg-emerald-600/10 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                  Cancion recomendada para hoy
                </p>
                <p className="mt-1 text-sm font-bold text-white">
                  {recommendedForToday.title}
                  {recommendedForToday.artist ? ` · ${recommendedForToday.artist}` : ""}
                </p>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {studentPlaylists.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedPlaylistId(item.id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                    selectedPlaylist?.id === item.id
                      ? "border-emerald-200/70 bg-emerald-400/25 text-emerald-50"
                      : "border-white/20 bg-slate-900/65 text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  {item.playlistTitle}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full border border-cyan-300/35 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                {selectedPlaylist?.objetivo || "Libre"}
              </span>
              {selectedPlaylist?.diaSemana ? (
                <span className="rounded-full border border-violet-300/35 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-100">
                  {selectedPlaylist.diaSemana}
                </span>
              ) : null}
            </div>
            <iframe
              title="Spotify playlist alumno"
              src={studentPlaylistEmbedUrl}
              width="100%"
              height="152"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="mt-3 w-full rounded-xl border border-white/10"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openSelectedPlaylistInSpotifyApp}
                className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-emerald-300"
              >
                Abrir en Spotify app
              </button>
              <a
                href={selectedPlaylist?.spotifyUrl || "#"}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-white/20 bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-800"
              >
                Abrir en navegador
              </a>
            </div>
          </div>
        )}

        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Portal del Alumno</p>
        <h1 className="mt-2 text-2xl font-black leading-tight text-white sm:text-3xl">Tu panel de rendimiento</h1>
        <p className="mt-1 text-sm text-slate-300">
          Todo tu seguimiento en un solo lugar: rutina, nutricion, medidas corporales y progreso.
        </p>

        <div className="mt-4 flex flex-wrap gap-2 rounded-2xl bg-slate-900/80 p-2">
          <SectionButton active={section === "inicio"} onClick={() => setSection("inicio")}>Inicio</SectionButton>
          <SectionButton active={section === "rutina"} onClick={() => setSection("rutina")}>Rutina</SectionButton>
          <SectionButton active={section === "nutricion"} onClick={() => setSection("nutricion")}>Nutricion</SectionButton>
          <SectionButton active={section === "medidas"} onClick={() => setSection("medidas")}>Medidas corporales</SectionButton>
          <SectionButton active={section === "progreso"} onClick={() => setSection("progreso")}>Mi progreso</SectionButton>
        </div>
      </section>

      {section === "inicio" && (
        <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 shadow-2xl shadow-black/30 sm:p-6">
          <h2 className="text-xl font-black text-white">
            {greeting}{studentName ? `, ${studentName}` : ""}
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Este es tu paneo general de la semana: entrenamiento, nutricion y seguimiento corporal.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <KpiCard
              label="Sesiones asignadas"
              value={String(assignedSessions.length)}
              tone="from-cyan-500/25 to-blue-500/20"
            />
            <KpiCard
              label="Ejercicios planificados"
              value={String(plannedWeeklyItems)}
              tone="from-violet-500/25 to-fuchsia-500/20"
            />
            <KpiCard
              label="Comidas en tu plan"
              value={String(plannedMeals)}
              tone="from-emerald-500/25 to-teal-500/20"
            />
            <KpiCard
              label="Registros de progreso"
              value={String(records.length)}
              tone="from-amber-500/25 to-orange-500/20"
            />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-sm font-black uppercase tracking-wide text-cyan-200">Lo que vas a ver en Rutina</p>
              <p className="mt-2 text-sm text-slate-200">
                {latestSession
                  ? `Objetivo: ${routineGoal}. Duracion estimada: ${routineDuration}.`
                  : "Cuando te asignen una sesion, aca vas a ver bloques, series y descansos."}
              </p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-sm font-black uppercase tracking-wide text-emerald-200">Lo que vas a ver en Nutricion</p>
              <p className="mt-2 text-sm text-slate-200">
                {studentNutritionPlan
                  ? `Plan: ${studentNutritionPlan.nombre} con objetivo ${studentNutritionPlan.objetivo}.`
                  : "Cuando te asignen plan nutricional, veras calorias, macros y comidas por bloque."}
              </p>
            </article>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-sm font-black uppercase tracking-wide text-violet-200">Resumen rapido de la semana</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-200">
              <li>
                {assignedSessions.length > 0
                  ? `Tenes ${assignedSessions.length} sesion(es) asociada(s) en tu plan actual.`
                  : "Todavia no hay sesiones asociadas a tu usuario."}
              </li>
              <li>
                {studentNutritionPlan
                  ? `Tu nutricion esta asignada en ${plannedMeals} bloque(s) de comida.`
                  : "Todavia no hay plan nutricional asignado."}
              </li>
              <li>
                {bodyMetrics.length > 0
                  ? `Ya cargaste ${bodyMetrics.length} registro(s) corporal(es).`
                  : "Aun no cargaste medidas corporales esta semana."}
              </li>
            </ul>
          </div>
        </section>
      )}

      {section === "rutina" && (
        <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 shadow-2xl shadow-black/30 sm:p-6">
          <h2 className="text-xl font-black text-white">Rutina de hoy</h2>
          <p className="mt-1 text-sm text-slate-300">
            {latestSession
              ? "Tomado de tus sesiones y prescripciones asignadas por el equipo."
              : "Todavia no tenes una sesion asignada. Pedi al staff que te cargue la rutina."}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <KpiCard label="Bloques" value={String((latestPrescription?.bloques || latestSession?.bloques || []).length)} tone="from-cyan-500/25 to-blue-500/20" />
            <KpiCard label="Duracion estimada" value={routineDuration} tone="from-violet-500/25 to-fuchsia-500/20" />
            <KpiCard label="Objetivo" value={routineGoal} tone="from-emerald-500/25 to-teal-500/20" />
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[660px] text-left">
              <thead className="bg-slate-800/70 text-xs uppercase tracking-wide text-slate-300">
                <tr>
                  <th className="px-3 py-2">Ejercicio</th>
                  <th className="px-3 py-2">Series</th>
                  <th className="px-3 py-2">Reps</th>
                  <th className="px-3 py-2">RIR</th>
                  <th className="px-3 py-2">Descanso</th>
                </tr>
              </thead>
              <tbody>
                {routineRows.length === 0 ? (
                  <tr className="border-t border-white/10 text-sm text-slate-300">
                    <td className="px-3 py-3" colSpan={5}>Sin ejercicios asignados todavia.</td>
                  </tr>
                ) : (
                  routineRows.map((row, idx) => (
                    <tr key={`${row.ejercicio}-${idx}`} className="border-t border-white/10 text-sm text-slate-100">
                      <td className="px-3 py-2 font-semibold">{row.ejercicio}</td>
                      <td className="px-3 py-2">{row.series}</td>
                      <td className="px-3 py-2">{row.reps}</td>
                      <td className="px-3 py-2">{row.rir}</td>
                      <td className="px-3 py-2">{row.descanso}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {section === "nutricion" && (
        <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 shadow-2xl shadow-black/30 sm:p-6">
          <h2 className="text-xl font-black text-white">Plan nutricional</h2>
          <p className="mt-1 text-sm text-slate-300">
            {studentNutritionPlan
              ? `Plan actual: ${studentNutritionPlan.nombre}`
              : "Todavia no tenes un plan nutricional asignado."}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <KpiCard
              label="Calorias"
              value={studentNutritionPlan ? `${studentNutritionPlan.targets.calorias} kcal` : "Sin plan"}
              tone="from-emerald-500/25 to-teal-500/20"
            />
            <KpiCard
              label="Proteinas"
              value={studentNutritionPlan ? `${studentNutritionPlan.targets.proteinas} g` : "Sin plan"}
              tone="from-cyan-500/25 to-blue-500/20"
            />
            <KpiCard
              label="Carbohidratos"
              value={studentNutritionPlan ? `${studentNutritionPlan.targets.carbohidratos} g` : "Sin plan"}
              tone="from-amber-500/25 to-orange-500/20"
            />
            <KpiCard
              label="Grasas"
              value={studentNutritionPlan ? `${studentNutritionPlan.targets.grasas} g` : "Sin plan"}
              tone="from-violet-500/25 to-fuchsia-500/20"
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {!studentNutritionPlan && (
              <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300 md:col-span-2">
                En cuanto el staff te asigne un plan, lo vas a ver automaticamente aca.
              </article>
            )}
            {(studentNutritionPlan?.comidas || []).map((meal) => (
              <article key={meal.id} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-sm font-black uppercase tracking-wide text-emerald-200">{meal.nombre}</p>
                {meal.items.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-300">Sin alimentos cargados.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm text-slate-200">
                    {meal.items.map((item) => (
                      <li key={item.id}>
                        {resolveFoodName(item.foodId)} · {item.gramos}g
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {section === "medidas" && (
        <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 shadow-2xl shadow-black/30 sm:p-6">
          <h2 className="text-xl font-black text-white">Medidas corporales</h2>
          <p className="mt-1 text-sm text-slate-300">Carga tus mediciones semanales y seguí tu evolucion fisica.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <KpiCard
              label="Peso actual"
              value={latestMetric ? `${latestMetric.peso} kg` : "Sin datos"}
              tone="from-cyan-500/25 to-blue-500/20"
            />
            <KpiCard
              label="% grasa estimada"
              value={latestMetric ? (latestMetric.grasaCorporal > 0 ? `${latestMetric.grasaCorporal}%` : "Sin calcular") : "Sin datos"}
              tone="from-violet-500/25 to-fuchsia-500/20"
            />
            <KpiCard
              label="Cambio peso"
              value={latestMetric && previousMetric ? `${pesoDiff >= 0 ? "+" : ""}${pesoDiff.toFixed(1)} kg` : "Sin comparativa"}
              tone="from-emerald-500/25 to-teal-500/20"
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Fecha">
              <input type="date" value={metricDraft.fecha} onChange={(e) => setMetricDraft((prev) => ({ ...prev, fecha: e.target.value }))} className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm" />
            </Field>
            <Field label="Peso (kg)">
              <input type="number" min={0} step="0.1" value={metricDraft.peso} onChange={(e) => setMetricDraft((prev) => ({ ...prev, peso: e.target.value }))} className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm" />
            </Field>
            <Field label="Cintura (cm)">
              <input type="number" min={0} step="0.1" value={metricDraft.cintura} onChange={(e) => setMetricDraft((prev) => ({ ...prev, cintura: e.target.value }))} className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm" />
            </Field>
                      <p className="mt-2 text-xs text-slate-400">
                        La grasa corporal se calcula automaticamente en base a altura, cintura y sexo del perfil.
                      </p>

            <Field label="Cadera (cm)">
              <input type="number" min={0} step="0.1" value={metricDraft.cadera} onChange={(e) => setMetricDraft((prev) => ({ ...prev, cadera: e.target.value }))} className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm" />
            </Field>
            <Field label="Pecho (cm)">
              <input type="number" min={0} step="0.1" value={metricDraft.pecho} onChange={(e) => setMetricDraft((prev) => ({ ...prev, pecho: e.target.value }))} className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm" />
            </Field>
            <Field label="Brazo (cm)">
              <input type="number" min={0} step="0.1" value={metricDraft.brazo} onChange={(e) => setMetricDraft((prev) => ({ ...prev, brazo: e.target.value }))} className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm" />
            </Field>
            <Field label="Muslo (cm)">
              <input type="number" min={0} step="0.1" value={metricDraft.muslo} onChange={(e) => setMetricDraft((prev) => ({ ...prev, muslo: e.target.value }))} className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm" />
            </Field>
          </div>

          <Field label="Comentario">
            <textarea rows={2} value={metricDraft.comentario} onChange={(e) => setMetricDraft((prev) => ({ ...prev, comentario: e.target.value }))} className="w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm" />
          </Field>

          <button type="button" onClick={addBodyMetric} className="mt-2 w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300">
            Guardar medidas
          </button>

          <div className="mt-4 space-y-2">
            {bodyMetrics.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-4 text-sm text-slate-300">
                Aun no hay mediciones cargadas.
              </div>
            )}
            {bodyMetrics.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-sm">
                <p className="font-bold text-white">
                  {formatDateLabel(item.fecha)} · {item.peso}kg · {item.grasaCorporal > 0 ? `${item.grasaCorporal}% grasa est.` : "grasa est. pendiente"}
                </p>
                <p className="mt-1 text-slate-300">Cintura {item.cintura}cm · Cadera {item.cadera}cm · Brazo {item.brazo}cm · Muslo {item.muslo}cm</p>
                {item.comentario && <p className="mt-1 text-slate-400">{item.comentario}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {section === "progreso" && (
      <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 shadow-2xl shadow-black/30 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Exercise Command Center</p>
        <h1 className="mt-2 text-2xl font-black leading-tight text-white sm:text-3xl">Press Plano C/ Barra</h1>
        <p className="mt-1 text-sm text-slate-300">Todo en una sola vista: tecnica, carga diaria e historial con fechas.</p>
        <p className="mt-2 text-xs font-semibold text-slate-400">
          {syncLoading
            ? "Sincronizando registros..."
            : syncStatus === "cloud"
            ? "Sincronizacion activa con nube"
            : "Modo local activo (sin nube)"}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <KpiCard label="Registros 7 dias" value={String(weeklyCount)} tone="from-cyan-500/25 to-blue-500/20" />
          <KpiCard label="Mejor carga" value={bestLoad > 0 ? `${bestLoad} kg` : "S/D"} tone="from-violet-500/25 to-fuchsia-500/20" />
          <KpiCard
            label="Ultimo registro"
            value={latestRecord ? `${latestRecord.serie}x${latestRecord.repeticiones} · ${latestRecord.carga}kg` : "Sin datos"}
            tone="from-emerald-500/25 to-teal-500/20"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2 rounded-2xl bg-slate-900/80 p-2">
          <TabButton active={tab === "descripcion"} onClick={() => setTab("descripcion")}>
            Descripcion
          </TabButton>
          <TabButton active={tab === "nuevo"} onClick={() => setTab("nuevo")}>
            Nuevo registro
          </TabButton>
          <TabButton active={tab === "registros"} onClick={() => setTab("registros")}>
            Registros
          </TabButton>
        </div>

        {tab === "descripcion" && (
          <section className="mt-5 rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-5">
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <div className="h-40 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900" />
              <div className="min-w-0">
                <h2 className="text-xl font-black text-white">Video tecnico</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  Mantene escapulas estables, controla la bajada en 2 segundos y empuja con fuerza sin perder tecnica.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    "Pectoral",
                    "Triceps",
                    "Deltoides anterior",
                    "Core",
                  ].map((musculo) => (
                    <span
                      key={musculo}
                      className="rounded-full border border-violet-300/40 bg-violet-500/20 px-3 py-1 text-xs font-semibold text-violet-100"
                    >
                      {musculo}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[660px] text-left">
                <thead className="bg-slate-800/70 text-xs uppercase tracking-wide text-slate-300">
                  <tr>
                    <th className="px-3 py-2">Serie</th>
                    <th className="px-3 py-2">Reps</th>
                    <th className="px-3 py-2">Descanso</th>
                    <th className="px-3 py-2">RIR</th>
                    <th className="px-3 py-2">Carga</th>
                    <th className="px-3 py-2">Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {plannedSets.map((set) => (
                    <tr key={set.serie} className="border-t border-white/10 text-sm text-slate-100">
                      <td className="px-3 py-2">{set.serie}</td>
                      <td className="px-3 py-2">{set.repeticiones}</td>
                      <td className="px-3 py-2">{set.descanso}</td>
                      <td className="px-3 py-2">{set.rir}</td>
                      <td className="px-3 py-2">{set.carga}</td>
                      <td className="px-3 py-2">{set.observaciones}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "nuevo" && (
          <section className="mt-5 rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-5">
            <div className="mb-4 rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-3 text-sm text-cyan-100">
              Sugerencia de hoy: 22.5kg x 8 reps (segun tus ultimos entrenos).
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Fecha">
                <input
                  type="date"
                  value={draft.fecha}
                  onChange={(event) => setDraft((prev) => ({ ...prev, fecha: event.target.value }))}
                  className="w-full min-w-0 rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/70"
                />
              </Field>

              <Field label="Serie">
                <input
                  type="number"
                  min={1}
                  value={draft.serie}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      serie: Math.max(1, Number(event.target.value || 1)),
                    }))
                  }
                  className="w-full min-w-0 rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/70"
                />
              </Field>

              <Field label="Repeticiones">
                <input
                  type="number"
                  min={1}
                  value={draft.repeticiones}
                  onChange={(event) => setDraft((prev) => ({ ...prev, repeticiones: event.target.value }))}
                  placeholder="Ej: 8"
                  className="w-full min-w-0 rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/70"
                />
              </Field>

              <Field label="Carga (kg)">
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={draft.carga}
                  onChange={(event) => setDraft((prev) => ({ ...prev, carga: event.target.value }))}
                  placeholder="Ej: 22.5"
                  className="w-full min-w-0 rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/70"
                />
              </Field>

              <Field label="RIR (0 a 10)">
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={1}
                  value={draft.rir}
                  onChange={(event) => setDraft((prev) => ({ ...prev, rir: event.target.value }))}
                  placeholder="Ej: 2"
                  className="w-full min-w-0 rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/70"
                />
              </Field>

              <Field label={`Molestia (${draft.molestia}/10)`}>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={draft.molestia}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, molestia: Number(event.target.value || 0) }))
                  }
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-emerald-400"
                />
              </Field>
            </div>

            <Field label="Comentario">
              <textarea
                rows={3}
                value={draft.comentario}
                onChange={(event) => setDraft((prev) => ({ ...prev, comentario: event.target.value }))}
                placeholder="Como te sentiste en esta serie"
                className="w-full min-w-0 resize-y rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/70"
              />
            </Field>

            <Field label="Video (URL opcional)">
              <div className="grid gap-2">
                <input
                  type="url"
                  value={draft.videoUrl.startsWith("data:video") ? "" : draft.videoUrl}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      videoUrl: event.target.value,
                      thumbnailUrl: "",
                    }))
                  }
                  placeholder="https://..."
                  className="w-full min-w-0 rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/70"
                />
                <label className="inline-flex w-fit cursor-pointer rounded-lg border border-cyan-300/40 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/25">
                  {videoUploading ? "Procesando video..." : "Subir video (max 8MB)"}
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoFileChange}
                    className="hidden"
                    disabled={videoUploading}
                  />
                </label>
                {uploadInfo && <p className="text-xs font-semibold text-cyan-200">{uploadInfo}</p>}
                {uploadedVideoSizeLabel && (
                  <p className="text-xs font-semibold text-emerald-200">Tamano final: {uploadedVideoSizeLabel}</p>
                )}
              </div>
            </Field>

            {draft.videoUrl && (
              <div className="mt-2 rounded-xl border border-white/10 bg-slate-950/55 p-3">
                {draft.thumbnailUrl && (
                  <img
                    src={draft.thumbnailUrl}
                    alt="Miniatura del video"
                    className="mb-2 h-28 w-full rounded-lg border border-white/10 object-cover"
                  />
                )}
                {draft.videoUrl.startsWith("data:video") ? (
                  <video src={draft.videoUrl} controls className="max-h-44 w-full rounded-lg border border-white/10" />
                ) : (
                  <a
                    href={draft.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-cyan-300 underline-offset-2 hover:underline"
                  >
                    Abrir video cargado
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDraft((prev) => ({ ...prev, videoUrl: "", thumbnailUrl: "" }));
                    setUploadInfo("");
                    setUploadedVideoSizeLabel("");
                  }}
                  className="mt-2 rounded-lg border border-rose-300/30 bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/25"
                >
                  Quitar video
                </button>
              </div>
            )}

            {formError && (
              <div className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
                {formError}
              </div>
            )}

            <button
              type="button"
              onClick={saveRecord}
              disabled={busyAction !== "none"}
              className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-black text-slate-950 transition ${
                savePulse ? "bg-emerald-400" : "bg-cyan-400 hover:bg-cyan-300"
              }`}
            >
              {busyAction === "save"
                ? "Guardando..."
                : draft.editId
                ? "Actualizar registro"
                : "Guardar registro"}
            </button>

            {draft.editId && (
              <button
                type="button"
                onClick={() => setDraft(defaultDraft())}
                className="mt-2 w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-sm font-bold text-slate-100 transition hover:bg-slate-700"
              >
                Cancelar edicion
              </button>
            )}
          </section>
        )}

        {tab === "registros" && (
          <section className="mt-5 rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-5">
            <div className="mb-4 grid gap-3 sm:grid-cols-[auto_1fr]">
              <div className="inline-flex w-fit rounded-xl border border-white/10 bg-slate-950/70 p-1">
                {([
                  { key: "7d", label: "7 dias" },
                  { key: "30d", label: "30 dias" },
                  { key: "all", label: "Todo" },
                ] as Array<{ key: DateRangeFilter; label: string }>).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setDateRange(option.key)}
                    className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                      dateRange === option.key
                        ? "bg-violet-500 text-white"
                        : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Buscar por fecha, comentario, reps o carga"
                className="w-full min-w-0 rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/70"
              />

              <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">
                <input
                  type="checkbox"
                  checked={onlyPR}
                  onChange={(event) => setOnlyPR(event.target.checked)}
                  className="h-4 w-4 accent-amber-400"
                />
                Solo PR
              </label>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
              <svg viewBox="0 0 348 180" className="h-44 w-full">
                {[40, 70, 100, 130, 160].map((y) => (
                  <line key={y} x1="24" y1={y} x2="324" y2={y} stroke="rgba(148,163,184,0.25)" strokeWidth="1" />
                ))}
                {chartPath ? (
                  <>
                    <path d={chartPath} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
                    {chartData.map((item, idx) => {
                      const maxY = Math.max(...chartData.map((pt) => pt.carga), 1);
                      const x = (idx / Math.max(chartData.length - 1, 1)) * 300 + 24;
                      const y = 160 - (item.carga / maxY) * 120;
                      return <circle key={`${item.fecha}-${idx}`} cx={x} cy={y} r="3.5" fill="#22d3ee" />;
                    })}
                  </>
                ) : (
                  <text x="24" y="100" fill="#94a3b8" fontSize="14">
                    Aun no hay datos para la tendencia.
                  </text>
                )}
              </svg>
            </div>

            <div className="mt-4 space-y-3">
              {filteredRecords.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-4 text-sm text-slate-300">
                  No hay registros para los filtros seleccionados.
                </div>
              )}

              {paginatedRecords.map((item) => (
                <article key={item.id} className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-white">{formatDateLabel(item.fecha)}</p>
                    <div className="relative flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-violet-300/40 bg-violet-500/20 px-2 py-1 text-xs font-semibold text-violet-100">
                        Serie {item.serie}
                      </span>
                      {item.isPR && (
                        <span className="rounded-full border border-amber-300/50 bg-amber-500/20 px-2 py-1 text-xs font-black text-amber-100">
                          PR
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenActionMenuId((prev) => (prev === item.id ? null : item.id));
                        }}
                        className="rounded-lg border border-violet-300/40 bg-violet-500/15 px-2 py-1 text-xs font-black text-violet-100 transition hover:bg-violet-500/25"
                        aria-label="Abrir acciones"
                      >
                        ⋮
                      </button>

                      {openActionMenuId === item.id && (
                        <div
                          onClick={(event) => event.stopPropagation()}
                          className="absolute right-0 top-8 z-20 min-w-36 rounded-xl border border-white/15 bg-slate-900/95 p-1 shadow-xl"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              startEditRecord(item);
                              setOpenActionMenuId(null);
                            }}
                            className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void deleteRecord(item.id);
                              setOpenActionMenuId(null);
                            }}
                            disabled={busyAction === "delete"}
                            className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-200">
                    {item.repeticiones} reps · {item.carga} kg · RIR {item.rir} · Molestia {item.molestia}/10
                  </p>
                  {item.comentario && <p className="mt-1 text-sm text-slate-400">{item.comentario}</p>}
                  {item.thumbnailUrl && (
                    <button
                      type="button"
                      onClick={() => setVideoModalUrl(item.videoUrl || null)}
                      className="mt-2 block w-full rounded-lg border border-white/10 text-left transition hover:border-cyan-300/40"
                    >
                      <img
                        src={item.thumbnailUrl}
                        alt="Miniatura del registro"
                        className="h-24 w-full rounded-lg object-cover"
                      />
                    </button>
                  )}
                  {item.videoUrl && (
                    <a
                      href={item.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex text-xs font-semibold text-cyan-300 underline-offset-2 hover:underline"
                    >
                      Ver video asociado
                    </a>
                  )}

                </article>
              ))}

              {filteredRecords.length > pageSize && (
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-white/15 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <p className="text-xs font-semibold text-slate-300">
                    Pagina {page} de {totalPages}
                  </p>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page === totalPages}
                    className="rounded-lg border border-white/15 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
      </section>
      )}

      {videoModalUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setVideoModalUrl(null)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-white/15 bg-slate-950/95 p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-100">Reproduccion de registro</p>
              <button
                type="button"
                onClick={() => setVideoModalUrl(null)}
                className="rounded-lg border border-white/20 px-2 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>
            <video src={videoModalUrl} controls className="max-h-[70vh] w-full rounded-lg border border-white/10" />
          </div>
        </div>
      )}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
        active
          ? "bg-violet-500 text-white"
          : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function SectionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
        active
          ? "bg-cyan-400 text-slate-950"
          : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-gradient-to-r ${tone} p-3`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">{label}</p>
      <p className="mt-1 truncate text-lg font-black text-white sm:text-xl">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-200">
      {label}
      {children}
    </label>
  );
}
