const fs = require("fs");
const path = require("path");
const { mapaERP } = require('./mapaERP');

function promptBase(userMessage) {
  // Construir la descripción de la estructura de la base de datos
  let estructura = Object.entries(mapaERP).map(([tabla, info]) => {
    const columnas = info.columnas || info.campos || {};
    const relaciones = info.relaciones || [];
    let camposTexto = Object.entries(columnas)
      .map(([campo, desc]) => `- ${campo}: ${desc}`)
      .join('\n');
    let relacionesTexto = Array.isArray(relaciones)
      ? relaciones.map(rel => `- Relación con ${rel.tablaDestino || rel.tabla_relacionada}: (${rel.uso || rel.descripcion || ''})`).join('\n')
      : Object.entries(relaciones)
          .map(([nombre, rel]) => `- Relación con ${rel.tabla_relacionada}: (${rel.descripcion || ''})`)
          .join('\n');
    return `TABLA: ${tabla}
Descripción: ${info.descripcion}
Campos principales:
${camposTexto}
${relacionesTexto ? `\nRelaciones principales:\n${relacionesTexto}` : ''}`;
  }).join('\n\n');

  const instrucciones = `
INSTRUCCIONES PARA EL ASISTENTE:
Eres un asistente especializado en consultas de base de datos para Semilleros Deitana S.L.

REGLAS PRINCIPALES:
1. SIEMPRE genera una consulta SQL para obtener datos reales
2. NUNCA inventes datos o respuestas
3. Usa LIMIT para controlar el número de resultados
4. Si la tabla tiene guiones (-), usa backticks (\`tabla-nombre\`)
5. Responde en español, de manera profesional y amigable


PARA CONSULTAS DE DATOS:
1. Identifica la tabla correcta usando su descripción
2. Usa los campos exactamente como están definidos
3. Si necesitas unir tablas, usa las relaciones definidas
4. Limita resultados si son muchos (LIMIT)
5. Analiza y explica los resultados

PARA BÚSQUEDAS:
- Usa LIKE para búsquedas parciales
- Usa = para coincidencias exactas
- Usa ORDER BY RAND() para resultados aleatorios
- Usa LIMIT para controlar cantidad de resultados

EJEMPLOS DE CONSULTAS COMUNES:
1. Cliente aleatorio:
\`\`\`sql
SELECT id, CL_DENO, CL_POB, CL_PROV, CL_TEL FROM clientes ORDER BY RAND() LIMIT 1;
\`\`\`

2. Artículo aleatorio:
\`\`\`sql
SELECT id, AR_DENO, AR_REF FROM articulos ORDER BY RAND() LIMIT 1;
\`\`\`

3. Búsqueda por ubicación:
\`\`\`sql
SELECT id, CL_DENO, CL_POB, CL_PROV FROM clientes WHERE CL_POB LIKE '%MURCIA%' LIMIT 5;
\`\`\`

FORMATO DE RESPUESTA:
1. Genera la consulta SQL
2. Espera los resultados reales
3. Analiza y explica los datos obtenidos
4. Sugiere consultas relacionadas si es apropiado

IMPORTANTE:
- Usa la descripción de las tablas para entender su propósito
- Verifica las relaciones antes de hacer JOINs
- Si una consulta no funciona, sugiere alternativas
- Mantén un tono profesional pero amigable
`;

  const system = `${instrucciones}\n\nESTRUCTURA DE LA BASE DE DATOS:\n${estructura}`;
  const user = userMessage;

  return { system, user };
}

module.exports = { promptBase };