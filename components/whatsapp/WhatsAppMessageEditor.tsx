"use client";
// Editor de mensaje, variables, prueba y envío manual

import { useState, useEffect } from 'react';
import { useAlumnos } from '../AlumnosProvider';
import { useColaboradores } from '../ColaboradoresProvider';


export default function WhatsAppMessageEditor({ category }: { category: string }) {
  const VARIABLES = [
    { key: 'nombre', label: 'Nombre' },
    { key: 'actividad', label: 'Actividad' },
    { key: 'fecha', label: 'Fecha' },
    { key: 'vencimiento', label: 'Vencimiento' },
    { key: 'link', label: 'Link' },
  ];


  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  // Schedules
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleName, setScheduleName] = useState('');
      // Cargar programaciones al montar
      useEffect(() => {
        async function fetchSchedules() {
          setLoadingSchedules(true);
          try {
            const res = await fetch('/api/whatsapp/schedule');
            const data = await res.json();
            setSchedules(data.schedules || []);
          } catch {
            setSchedules([]);
          } finally {
            setLoadingSchedules(false);
          }
        }
        fetchSchedules();
      }, [category]);
      async function handleSaveSchedule() {
        if (!scheduleName || !mensaje || !scheduleDate) return;
        const destinatarios = [
          ...alumnos.filter((a) => selected[a.nombre]).map((a) => a.nombre),
          ...colaboradores.filter((c: any) => selected[c.id]).map((c: any) => c.nombreCompleto || c.email),
        ];
        const res = await fetch('/api/whatsapp/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: scheduleName, categoria: category, mensaje, destinatarios, fecha: scheduleDate }),
        });
        const data = await res.json();
        if (data.schedule) {
          setSchedules((prev) => [data.schedule, ...prev]);
          setScheduleName('');
          setScheduleDate('');
        }
      }

      async function handleDeleteSchedule(key: string) {
        await fetch('/api/whatsapp/schedule', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        });
        setSchedules((prev) => prev.filter((s) => s.key !== key));
      }
    // Cargar plantillas al montar
    useEffect(() => {
      async function fetchTemplates() {
        setLoadingTemplates(true);
        try {
          const res = await fetch('/api/whatsapp/templates');
          const data = await res.json();
          setTemplates(data.templates || []);
        } catch {
          setTemplates([]);
        } finally {
          setLoadingTemplates(false);
        }
      }
      fetchTemplates();
    }, [category]);
    async function handleSaveTemplate() {
      if (!templateName || !mensaje) return;
      const res = await fetch('/api/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: templateName, categoria: category, mensaje }),
      });
      const data = await res.json();
      if (data.template) {
        setTemplates((prev) => [data.template, ...prev]);
        setTemplateName('');
      }
    }

    async function handleDeleteTemplate(key: string) {
      await fetch('/api/whatsapp/templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      setTemplates((prev) => prev.filter((t) => t.key !== key));
    }
  const { alumnos } = useAlumnos();
  const { colaboradores } = useColaboradores();
  const [selected, setSelected] = useState<{ [key: string]: boolean }>({});

  function handleInsertVariable(variable: string) {
    setMensaje((prev) => prev + `{{${variable}}}`);
  }

  // Simulación de valores para vista previa
  const preview = mensaje
    .replace(/\{\{nombre\}\}/g, 'Juan Pérez')
    .replace(/\{\{actividad\}\}/g, 'Fútbol')
    .replace(/\{\{fecha\}\}/g, '25/03/2026')
    .replace(/\{\{vencimiento\}\}/g, '31/03/2026')
    .replace(/\{\{link\}\}/g, 'https://wa.me/123456789');

  function handleToggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleEnviar() {
    setEnviando(true);
    setResultado(null);
    const destinatarios = [
      ...alumnos.filter((a) => selected[a.nombre]).map((a) => a.nombre),
      ...colaboradores.filter((c: any) => selected[c.id]).map((c: any) => c.nombreCompleto || c.email),
    ];
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinatarios, mensaje, tipo: category }),
      });
      const data = await res.json();
      if (data.ok) {
        setResultado('Mensaje enviado correctamente');
      } else {
        setResultado('Error al enviar: ' + (data.error || '')); 
      }
    } catch (err: any) {
      setResultado('Error al enviar: ' + err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <div className="mb-2">
        <div className="font-semibold text-slate-300 mb-1">Programar envío automático:</div>
        <div className="flex flex-wrap gap-2 mb-2">
          <input
            className="rounded border border-slate-700 bg-slate-900 p-1 text-xs text-slate-100"
            placeholder="Nombre de la programación"
            value={scheduleName}
            onChange={e => setScheduleName(e.target.value)}
          />
          <input
            type="datetime-local"
            className="rounded border border-slate-700 bg-slate-900 p-1 text-xs text-slate-100"
            value={scheduleDate}
            onChange={e => setScheduleDate(e.target.value)}
          />
          <button
            className="px-2 py-1 rounded bg-emerald-700 text-white text-xs font-semibold disabled:opacity-60"
            onClick={handleSaveSchedule}
            disabled={!scheduleName || !mensaje || !scheduleDate}
          >
            Programar envío
          </button>
        </div>
        {loadingSchedules ? (
          <div className="text-slate-400">Cargando programaciones...</div>
        ) : schedules.length === 0 ? (
          <div className="text-slate-500">No hay programaciones.</div>
        ) : (
          <ul className="mb-2 flex flex-wrap gap-2">
            {schedules.filter(s => s.value?.categoria === category).map((s) => (
              <li key={s.key} className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded">
                <span className="text-emerald-400 text-xs">{s.value.nombre} ({new Date(s.value.fecha).toLocaleString()})</span>
                <button className="ml-1 text-xs text-rose-400" title="Eliminar" onClick={() => handleDeleteSchedule(s.key)}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>
        <div className="font-semibold text-slate-300 mb-1">Plantillas guardadas ({category}):</div>
        {loadingTemplates ? (
          <div className="text-slate-400">Cargando plantillas...</div>
        ) : templates.length === 0 ? (
          <div className="text-slate-500">No hay plantillas guardadas.</div>
        ) : (
          <ul className="mb-2 flex flex-wrap gap-2">
            {templates.filter(t => t.value?.categoria === category).map((t) => (
              <li key={t.key} className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded">
                <button className="text-cyan-400 underline text-xs" onClick={() => setMensaje(t.value.mensaje)}>{t.value.nombre}</button>
                <button className="ml-1 text-xs text-rose-400" title="Eliminar" onClick={() => handleDeleteTemplate(t.key)}>✕</button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2 mb-2">
          <input
            className="rounded border border-slate-700 bg-slate-900 p-1 text-xs text-slate-100"
            placeholder="Nombre de la plantilla"
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
          />
          <button
            className="px-2 py-1 rounded bg-cyan-700 text-white text-xs font-semibold disabled:opacity-60"
            onClick={handleSaveTemplate}
            disabled={!templateName || !mensaje}
          >
            Guardar plantilla
          </button>
        </div>
      <h3>Editor de mensaje: <span className="text-cyan-400">{category}</span></h3>
      <div className="mb-2 flex flex-wrap gap-2">
        {VARIABLES.map((v) => (
          <button
            key={v.key}
            type="button"
            className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-600 text-xs hover:bg-cyan-800"
            onClick={() => handleInsertVariable(v.key)}
          >
            {`{{${v.key}}}`} <span className="ml-1 text-slate-400">({v.label})</span>
          </button>
        ))}
      </div>
      <textarea
        className="w-full min-h-[80px] rounded border border-slate-700 bg-slate-900 p-2 text-slate-100 mb-2"
        placeholder="Escribe el mensaje de WhatsApp..."
        value={mensaje}
        onChange={e => setMensaje(e.target.value)}
      />
      <div className="mb-2">
        <div className="font-semibold text-slate-300 mb-1">Seleccionar destinatarios:</div>
        <div className="mb-1 font-semibold">Alumnos</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1 mb-2">
          {alumnos.map((alumno) => (
            <label key={alumno.nombre} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!selected[alumno.nombre]}
                onChange={() => handleToggle(alumno.nombre)}
              />
              <span>{alumno.nombre}</span>
            </label>
          ))}
        </div>
        <div className="mb-1 font-semibold">Colaboradores</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          {colaboradores.map((colab: any) => (
            <label key={colab.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!selected[colab.id]}
                onChange={() => handleToggle(colab.id)}
              />
              <span>{colab.nombreCompleto || colab.email}</span>
            </label>
          ))}
        </div>
      </div>
      <button
        className="mt-2 px-4 py-2 rounded bg-cyan-700 text-white font-semibold disabled:opacity-60"
        onClick={handleEnviar}
        disabled={enviando || !mensaje || Object.values(selected).every((v) => !v)}
      >
        {enviando ? 'Enviando...' : 'Enviar mensaje'}
      </button>
      {resultado && <div className="mt-2 text-sm text-slate-300">{resultado}</div>}
      <div className="mt-2">
        <div className="font-semibold text-slate-300 mb-1">Vista previa:</div>
        <div className="rounded bg-slate-800 p-2 text-slate-100 whitespace-pre-line border border-slate-700">
          {preview || <span className="text-slate-500">(El mensaje aparecerá aquí)</span>}
        </div>
      </div>
      <div className="mt-4 text-xs text-slate-400">Puedes usar variables como <b>{'{{nombre}}'}</b>, <b>{'{{actividad}}'}</b>, etc.</div>
    </div>
  );
}
