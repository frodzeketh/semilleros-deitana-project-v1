const fs = require("fs");
const path = require("path");
const { mapaERP } = require('./mapaERP');

function promptBase(userMessage) {
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

REGLAS OBLIGATORIAS:
1. SIEMPRE genera una consulta SQL
2. NUNCA respondas con texto explicativo
3. NUNCA pidas más información
4. Usa EXACTAMENTE los nombres de tablas y campos definidos
5. Incluye las relaciones definidas cuando sea necesario
6. SIEMPRE encierra los nombres de tablas con guiones o espacios entre backticks (\`)

FORMATO DE RESPUESTA:
\`\`\`sql
SELECT [campos]
FROM \`[tabla]\`
[joins]
[where]
LIMIT 5;
\`\`\`

EJEMPLOS DE CONSULTAS CORRECTAS:

Para partes de siembra:
\`\`\`sql
SELECT 
    p.id, p.PSI_FEC, p.PSI_HORA, p.PSI_BAPP, p.PSI_TBAN,
    v.VD_DENO as Operador,
    a.AR_DENO as Semilla,
    am.AM_DENO as Almacen
FROM \`p-siembras\` p
LEFT JOIN vendedores v ON p.PSI_OPE = v.id
LEFT JOIN articulos a ON p.PSI_SEM = a.id
LEFT JOIN almacenes am ON p.PSI_ALM = am.id
LIMIT 5;
\`\`\`

Para créditos caución:
\`\`\`sql
SELECT 
    c.id, c.CAU_CCL, c.CAU_DIAS, c.CAU_TIPO,
    cl.CL_DENO as Nombre_Cliente
FROM creditocau c
LEFT JOIN clientes cl ON c.CAU_CCL = cl.id
LIMIT 5;
\`\`\`

IMPORTANTE:
- SOLO genera la consulta SQL
- NO incluyas explicaciones
- NO pidas más información
- Usa los nombres EXACTOS de las tablas y campos
- SIEMPRE encierra los nombres de tablas con guiones entre backticks (\`)
- Para tablas sin guiones, los backticks son opcionales`;

  const system = `${instrucciones}\n\nESTRUCTURA DE LA BASE DE DATOS:\n${estructura}`;
  const user = userMessage;

  return { system, user };
}

module.exports = { promptBase };