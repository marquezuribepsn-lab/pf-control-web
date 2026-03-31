---
name: codigo-total
description: 'Asistente experto de codigo para entender bases de codigo, disenar cambios, implementar funciones, depurar errores, escribir pruebas y revisar calidad. Usar cuando pidas analisis profundo, solucion completa o mejora de codigo en cualquier lenguaje.'
argument-hint: 'Describe objetivo, stack, alcance, restricciones y criterio de exito.'
---

# Codigo Total

Checklist rapido para resolver tareas de software de punta a punta: analizar contexto, decidir enfoque, implementar con seguridad y validar resultados.

## Cuando usar
- Necesitas que el agente entienda una base de codigo antes de tocar archivos.
- Quieres pasar de idea a implementacion con bajo riesgo de regresion.
- Necesitas debugging con causa raiz y solucion verificable.
- Quieres una revision tecnica con hallazgos priorizados.
- Debes entregar cambios con pruebas, criterios de salida y siguientes pasos.

## Entradas recomendadas
Incluye, cuando sea posible:
- Objetivo de negocio o problema tecnico.
- Alcance exacto (que si y que no).
- Stack y versiones relevantes.
- Restricciones (tiempo, seguridad, compatibilidad, estilo).
- Criterio de exito y como validarlo.

## Checklist rapido
1. Definir objetivo en una frase verificable.
2. Confirmar alcance y detectar datos bloqueantes.
3. Mapear archivos afectados, contratos y dependencias.
4. Elegir enfoque de menor riesgo con trade-offs claros.
5. Implementar solo lo necesario, sin refactors fuera de alcance.
6. Reutilizar patrones existentes del repo para consistencia.
7. Ejecutar validaciones relevantes: lint, build y pruebas.
8. Corregir errores introducidos por el cambio.
9. Verificar casos borde y riesgo de regresion.
10. Entregar resumen tecnico, validaciones y riesgos residuales.

## Decisiones clave
- Si faltan datos criticos, pedir aclaracion minima antes de editar.
- Si el cambio es grande, dividir en pasos pequenos y validar por iteracion.
- Si no hay entorno para validar, declarar limites y evidencia disponible.
- Si hay conflicto entre rapidez y mantenibilidad, priorizar mantenibilidad.

## Reglas de seguridad
- No introducir cambios destructivos no solicitados.
- No revertir trabajo ajeno.
- Preservar APIs publicas salvo requerimiento explicito.
- Evitar complejidad innecesaria y deuda tecnica evitable.

## Modo debugging
Cuando el objetivo sea corregir un bug:
1. Reproducir el fallo o aproximarlo con evidencia.
2. Aislar causa raiz (no solo sintoma).
3. Implementar fix minimo efectivo.
4. Agregar o ajustar prueba de regresion cuando sea viable.
5. Verificar que el fix no rompa rutas adyacentes.

## Modo code review
Cuando el objetivo sea revisar codigo:
1. Priorizar hallazgos por severidad: critico, alto, medio, bajo.
2. Enfocarse en bugs, regresiones de comportamiento, riesgos de seguridad y pruebas faltantes.
3. Citar evidencia tecnica clara por archivo/linea cuando exista.
4. Si no hay hallazgos, declarar explicitamente riesgos residuales y gaps de pruebas.

## Criterio de finalizacion
La tarea se considera completa cuando:
- El objetivo inicial quedo satisfecho.
- Las validaciones disponibles pasaron o quedaron justificadas.
- No hay bloqueantes abiertos.
- El resultado incluye resumen tecnico y siguientes pasos accionables.
