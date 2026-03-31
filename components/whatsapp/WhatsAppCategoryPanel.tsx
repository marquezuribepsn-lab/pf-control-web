"use client";
// Panel de categorías y subcategorías de mensajes
import WhatsAppMessageEditor from './WhatsAppMessageEditor';
import { useState } from 'react';

const CATEGORIES = [
  { key: 'vencimiento', label: 'Vencimiento' },
  { key: 'renovacion', label: 'Renovación' },
  { key: 'encuesta', label: 'Encuesta semanal' },
  { key: 'bienvenida', label: 'Bienvenida' },
  { key: 'personalizado', label: 'Personalizado' },
];

export default function WhatsAppCategoryPanel() {
  const [selected, setSelected] = useState('vencimiento');

  return (
    <div>
      <h2>Tipos de mensajes</h2>
      <div className="flex gap-2 mb-4">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className={`px-3 py-1 rounded-full text-sm font-semibold border transition-all ${selected === cat.key ? 'bg-cyan-700 text-white border-cyan-400' : 'bg-slate-800 text-slate-200 border-slate-600'}`}
            onClick={() => setSelected(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>
      {/* Editor de mensaje para la categoría seleccionada */}
      <WhatsAppMessageEditor category={selected} />
    </div>
  );
}
