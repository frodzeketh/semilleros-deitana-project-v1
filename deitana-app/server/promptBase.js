const fs = require("fs");
const path = require("path");
const { mapaERP } = require('./mapaERP');

function promptBase(userMessage, tablaRelevante) {
  let estructura = Object.entries(mapaERP).map(([tabla, info]) => {
    const columnas = info.columnas || info.campos || {};
    const relaciones = info.relaciones || [];
    
    let camposTexto = Object.entries(columnas)
      .map(([campo, desc]) => `- ${campo}: ${desc}`)
      .join('\n');

    let relacionesTexto = '';
    if (typeof relaciones === 'object') {
      if (Array.isArray(relaciones)) {
        relacionesTexto = relaciones.map(rel => 
          `- Relación con ${rel.tablaDestino || rel.tabla_relacionada}`
        ).join('\n');
      } else {
        relacionesTexto = Object.entries(relaciones)
          .map(([nombre, rel]) => {
            if (rel.tabla_relacionada && rel.campo_enlace_local && rel.campo_enlace_externo) {
              return `- Relación con ${rel.tabla_relacionada}: ${rel.campo_enlace_local} -> ${rel.campo_enlace_externo}`;
            }
            return '';
          })
          .filter(text => text !== '')
          .join('\n');
      }
    }

    return `TABLA: ${info.tabla || tabla}
DESCRIPCIÓN: ${info.descripcion}
CAMPOS:
${camposTexto}
${relacionesTexto ? `\nRELACIONES:\n${relacionesTexto}` : ''}`;
  }).join('\n\n');

  const instrucciones = `
ERES UN GENERADOR DE CONSULTAS SQL. TU ÚNICA TAREA ES GENERAR CONSULTAS SQL.

${tablaRelevante ? `
IMPORTANTE: La consulta debe realizarse en la tabla ${tablaRelevante.tabla}
porque su descripción indica: ${tablaRelevante.descripcion}

COLUMNAS DISPONIBLES EN ${tablaRelevante.tabla}:
${Object.entries(tablaRelevante.columnas || {})
  .map(([campo, desc]) => `- ${campo}: ${desc}`)
  .join('\n')}

EJEMPLO DE CONSULTA CORRECTA:
\`\`\`sql
SELECT ${Object.keys(tablaRelevante.columnas || {}).join(', ')}
FROM \`${tablaRelevante.tabla}\`
LIMIT 5;
\`\`\`

INSTRUCCIONES ESPECÍFICAS:
1. Para consultas generales, NO uses WHERE
2. Si necesitas filtrar, usa las columnas existentes con valores reales
3. Usa SOLO las columnas listadas arriba para esta tabla específica
4. NO uses columnas de otras tablas
5. NO asumas que los nombres de columnas son similares entre tablas
6. SIEMPRE incluye TODAS las columnas en el SELECT
7. NUNCA dejes el SELECT vacío


DEBES usar SOLO estas columnas en tu consulta SQL.
NO inventes nombres de columnas.
NO uses columnas que no estén en la lista anterior.
NO uses columnas de otras tablas.
SIEMPRE incluye las columnas en el SELECT.
` : ''}


PROCESO DE ANÁLISIS OBLIGATORIO:
1. Lee la consulta del usuario
2. Analiza la DESCRIPCIÓN de cada tabla
3. IMPORTANTE: La descripción es el ÚNICO criterio para identificar la tabla correcta
4. NO uses coincidencias literales con palabras clave en los nombres de las tablas
5. NO asumas que la tabla debe contener las palabras clave de la consulta
6. Usa el nombre EXACTO de la tabla que mejor se ajuste al contexto de la descripción
7. Selecciona los campos relevantes basándote en la descripción y el contexto
8. SOLO usa las columnas definidas en la tabla
9. SIEMPRE incluye las columnas en el SELECT


REGLAS OBLIGATORIAS:
1. SIEMPRE genera una consulta SQL
2. NUNCA respondas con texto explicativo
3. NUNCA pidas más información
4. Usa EXACTAMENTE los nombres de tablas y campos definidos
5. Incluye las relaciones definidas cuando sea necesario
6. SIEMPRE encierra los nombres de tablas con guiones o espacios entre backticks (\`)
7. NO uses columnas que no estén definidas en la tabla
8. NO inventes nombres de columnas
9. SIEMPRE incluye las columnas en el SELECT

FORMATO DE RESPUESTA:
\`\`\`sql
SELECT [campos]
FROM \`[tabla]\`
[joins]
[where]
LIMIT 5;
\`\`\`

IMPORTANTE:
- SOLO genera la consulta SQL
- NO incluyas explicaciones
- NO pidas más información
- Usa los nombres EXACTOS de las tablas y campos
- La descripción es el ÚNICO criterio para identificar la tabla correcta
- NO busques coincidencias literales con palabras clave en los nombres de las tablas
- NO asumas que la tabla debe contener las palabras clave de la consulta
- Identifica la tabla correcta basándote en el CONTEXTO de la descripción
- SOLO usa las columnas definidas en la tabla
- NO inventes nombres de columnas
- SIEMPRE incluye las columnas en el SELECT

${tablaRelevante ? `
RECUERDA: 
1. DEBES usar la tabla ${tablaRelevante.tabla} para esta consulta
2. SOLO puedes usar las columnas definidas arriba
3. NO inventes nombres de columnas
4. Si necesitas filtrar, usa las columnas existentes
5. NO uses columnas de otras tablas
6. SIEMPRE incluye las columnas en el SELECT
7. NUNCA dejes el SELECT vacío
` : ''}`;

  const system = `${instrucciones}\n\nESTRUCTURA DE LA BASE DE DATOS:\n${estructura}`;
  const user = userMessage;

  return { system, user };
}
module.exports = { promptBase };