const fs = require("fs");
const path = require("path");
const { mapaERP } = require('./mapaERP');

function promptBase(userMessage) {
  let estructura = Object.entries(mapaERP).map(([tabla, info]) => {
    const columnas = info.columnas || info.campos || {};
    const relaciones = info.relaciones || [];
    
    // Obtener el prefijo de los campos automáticamente
    const camposArray = Object.keys(columnas);
    const prefijo = camposArray.length > 1 ? camposArray[1].split('_')[0] + '_' : '';
    
    let camposTexto = Object.entries(columnas)
      .map(([campo, desc]) => `- ${campo}: ${desc}`)
      .join('\n');

    let relacionesTexto = Array.isArray(relaciones)
      ? relaciones.map(rel => `- Relación con ${rel.tablaDestino || rel.tabla_relacionada}: (${rel.uso || rel.descripcion || ''})`).join('\n')
      : Object.entries(relaciones)
          .map(([nombre, rel]) => `- Relación con ${rel.tabla_relacionada}: (${rel.descripcion || ''})`)
          .join('\n');

    return `TABLA: ${tabla}
PREFIJO_CAMPOS: ${prefijo}
DESCRIPCIÓN: ${info.descripcion}
CAMPOS_DISPONIBLES:
${camposTexto}
${relacionesTexto ? `\nRELACIONES:\n${relacionesTexto}` : ''}
----------------------------------------`;
  }).join('\n\n');

  const instrucciones = `
INSTRUCCIONES PARA EL ASISTENTE:

1. ANÁLISIS DE LA CONSULTA:
   - Lee la consulta del usuario
   - Busca palabras clave en las descripciones de las tablas
   - Identifica la tabla correcta en la ESTRUCTURA DE LA BASE DE DATOS

2. INTERPRETACIÓN DE ESTRUCTURA:
   Para cada tabla encontrarás:
   - DESCRIPCIÓN: Explica el propósito y contenido de la tabla
   - TABLA: Nombre exacto de la tabla en la base de datos
   - COLUMNAS: Lista de campos disponibles con sus descripciones
   - RELACIONES: Conexiones con otras tablas para información complementaria

3. GENERACIÓN DE CONSULTAS SQL:
   Sigue este proceso:
   a) Usa el nombre exacto de la TABLA
   b) Selecciona campos de COLUMNAS según el contexto
   c) Si hay RELACIONES relevantes, úsalas con LEFT JOIN
   
   Ejemplo de estructura:
   \`\`\`sql
   -- Consulta básica
   SELECT id, [CAMPOS_PRINCIPALES]
   FROM [NOMBRE_TABLA]
   LIMIT 3;

   -- Consulta con relaciones
   SELECT t.id, t.[CAMPOS_PRINCIPALES], r.[CAMPOS_RELACIONADOS]
   FROM [NOMBRE_TABLA] t
   LEFT JOIN [TABLA_RELACIONADA] r ON t.[CAMPO_LOCAL] = r.[CAMPO_EXTERNO]
   LIMIT 3;
   \`\`\`

4. REGLAS IMPORTANTES:
   - SIEMPRE usa los campos exactos definidos en COLUMNAS
   - NUNCA inventes campos
   - Si hay RELACIONES, úsalas para enriquecer la información
   - Respeta el prefijo de campos de cada tabla

5. FORMATO DE RESPUESTA:
   - Muestra la consulta SQL generada
   - Explica los resultados encontrados
   - Si hay relaciones relevantes, inclúyelas en la explicación

Ejemplo de análisis:
Si la consulta es "muestra tareas del personal":
1. Buscar en DESCRIPCIONES -> encontrar tabla "tareas_per"
2. Leer COLUMNAS -> usar campos como TARP_DENO, TARP_TIPO
3. Ver RELACIONES -> si hay tabla relacionada como "tareas_seccion"
4. Generar consulta usando esta información`;
  const system = `${instrucciones}\n\nESTRUCTURA DE LA BASE DE DATOS:\n${estructura}`;
  const user = userMessage;

  return { system, user };
}
module.exports = { promptBase };