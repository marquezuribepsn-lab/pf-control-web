import React from "react";

export type Etiqueta = {
  id: string;
  texto: string;
  color: string;
};

interface EtiquetasChipsProps {
  etiquetas: Etiqueta[];
  onEdit?: (etiqueta: Etiqueta) => void;
  onDelete?: (id: string) => void;
}

export const EtiquetasChips: React.FC<EtiquetasChipsProps> = ({ etiquetas, onEdit, onDelete }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {etiquetas.map((etiqueta) => (
        <span
          key={etiqueta.id}
          className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: etiqueta.color, color: "#fff" }}
        >
          {etiqueta.texto}
          {onEdit && (
            <button
              className="ml-2 text-xs font-bold"
              style={{ color: "#fff" }}
              onClick={() => onEdit(etiqueta)}
              title="Editar etiqueta"
            >✎</button>
          )}
          {onDelete && (
            <button
              className="ml-1 text-xs font-bold"
              style={{ color: "#fff" }}
              onClick={() => onDelete(etiqueta.id)}
              title="Eliminar etiqueta"
            >×</button>
          )}
        </span>
      ))}
    </div>
  );
};
