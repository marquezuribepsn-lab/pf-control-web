'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
} from 'react';

const BULLET = '•';
const REVEAL_MS = 900;

type PasswordRevealInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> & {
  value: string;
  onChange: (value: string) => void;
};

/**
 * Campo de contraseña estilo iOS: al escribir, la última letra tecleada se ve
 * durante un instante y luego se enmascara con un bullet (•). El valor real se
 * mantiene en el estado del padre; el input solo muestra la máscara.
 */
export default function PasswordRevealInput({
  value,
  onChange,
  ...rest
}: PasswordRevealInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Índice de la letra que se muestra en claro (-1 = ninguna).
  const [revealIndex, setRevealIndex] = useState(-1);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Posición del caret que queremos restaurar tras re-renderizar la máscara.
  const caretRef = useRef<number | null>(null);

  const clearRevealTimer = useCallback(() => {
    if (revealTimer.current) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
  }, []);

  useEffect(() => clearRevealTimer, [clearRevealTimer]);

  // Construye lo que se ve: bullets salvo la letra revelada.
  const buildMasked = useCallback(
    (real: string, reveal: number) =>
      real
        .split('')
        .map((char, i) => (i === reveal ? char : BULLET))
        .join(''),
    []
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const displayed = event.target.value;
      const caret = event.target.selectionStart ?? displayed.length;
      const prevReveal = revealIndex;

      // Reconstruimos el valor real a partir de la máscara anterior y lo tecleado.
      // La máscara comparte longitud con el valor real salvo por la edición actual.
      let nextReal = '';
      let nextReveal = -1;

      if (displayed.length > value.length) {
        // Se insertaron caracteres nuevos entre caret-(delta) y caret.
        const delta = displayed.length - value.length;
        const insertStart = caret - delta;
        const inserted = displayed.slice(insertStart, caret);
        nextReal = value.slice(0, insertStart) + inserted + value.slice(insertStart);
        // Revelamos la última letra insertada.
        nextReveal = caret - 1;
      } else if (displayed.length < value.length) {
        // Se borraron caracteres. Reconstruimos quitando el mismo rango.
        const delta = value.length - displayed.length;
        const removeStart = caret;
        nextReal = value.slice(0, removeStart) + value.slice(removeStart + delta);
        nextReveal = -1;
      } else {
        // Misma longitud: puede ser un reemplazo de selección de 1 char.
        const idx = caret - 1;
        if (idx >= 0 && displayed[idx] !== BULLET) {
          nextReal =
            value.slice(0, idx) + displayed[idx] + value.slice(idx + 1);
          nextReveal = idx;
        } else {
          nextReal = value;
          nextReveal = prevReveal;
        }
      }

      caretRef.current = caret;
      setRevealIndex(nextReveal);
      onChange(nextReal);

      clearRevealTimer();
      if (nextReveal >= 0) {
        revealTimer.current = setTimeout(() => {
          setRevealIndex(-1);
          revealTimer.current = null;
        }, REVEAL_MS);
      }
    },
    [value, revealIndex, onChange, clearRevealTimer]
  );

  // Restauramos la posición del caret luego de re-pintar la máscara.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input && caretRef.current != null) {
      const pos = Math.min(caretRef.current, input.value.length);
      input.setSelectionRange(pos, pos);
      caretRef.current = null;
    }
  });

  return (
    <input
      {...rest}
      ref={inputRef}
      type="text"
      inputMode="text"
      autoComplete="current-password"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      value={buildMasked(value, revealIndex)}
      onChange={handleChange}
    />
  );
}
