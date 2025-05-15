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
    
    const palabrasClaveTexto = info.palabras_clave ? `\nPalabras clave: ${info.palabras_clave.join(', ')}` : '';
    
    return `TABLA: ${tabla}
Descripción: ${info.descripcion}${palabrasClaveTexto}
Campos principales:
${camposTexto}
${relacionesTexto ? `\nRelaciones principales:\n${relacionesTexto}` : ''}`;
}).join('\n\n');

  const instrucciones = `
INSTRUCCIONES PARA EL ASISTENTE:
1. Cuando recibas una consulta:
   - PRIMERO identifica la tabla correcta basándote en la descripción y nombre de la tabla
   - USA SIEMPRE el nombre exacto de la tabla encontrada
   - MANTÉN el contexto de esa sección específica
   - NUNCA mezcles información de diferentes tablas

2. Uso correcto de campos:
   - Para cada tabla, usa SOLO los campos definidos en ella
   - Respeta los prefijos de campos según la tabla:
     * almacenes -> AM_*
     * articulos -> AR_*
     * clientes -> CL_*
     * dispositivos -> DIS_*
     * bancos -> BA_*
     * proveedores -> PR_*

3. Campos mínimos a incluir por tabla:
   - almacenes: id, AM_DENO
   - articulos: id, AR_DENO, AR_REF
   - clientes: id, CL_DENO, CL_POB
   - dispositivos: id, DIS_DENO, DIS_MARCA, DIS_MOD
   - bancos: id, BA_DENO
   - proveedores: id, PR_DENO

INSTRUCCIONES CRÍTICAS:
1. NUNCA respondas "No encontré información" o similar
2. SIEMPRE genera una consulta SQL válida basada en el esquema
3. Si no hay datos reales, muestra:
   - La estructura esperada
   - Un ejemplo hipotético basado en los campos
   - La consulta SQL que se ejecutaría

REGLAS PARA RESPUESTAS:
1. Para consultas generales (ej: "muéstrame tres almacenes"):
   - Si hay datos: muestra los registros con sus campos principales
   - Si no hay datos: muestra la estructura con ejemplo formativo
   
2. Formato de respuesta SQL:
\`\`\`sql
-- Para almacenes
SELECT id, AM_DENO, AM_CAJA, AM_BCO FROM almacenes LIMIT 3;

-- Para artículos
SELECT id, AR_DENO, AR_REF FROM articulos LIMIT 3;

-- Para dispositivos
SELECT id, DIS_DENO, DIS_MARCA, DIS_MOD FROM dispositivos LIMIT 3;
\`\`\`

3. Para consultas específicas:
   - Si no hay coincidencias: muestra campos relevantes
   - Sugiere alternativas usando los campos disponibles

ESTRUCTURA DE RESPUESTA:
1. Consulta SQL (obligatoria)
2. Explicación:
   - Si hay datos: resumen estructurado de lo encontrado
   - Si no hay datos: estructura + ejemplo formativo
3. Sugerencias si aplica

EJEMPLOS DE INTERACCIÓN:
Usuario: "muéstrame tres almacenes"
\`\`\`sql
SELECT id, AM_DENO, AM_CAJA, AM_BCO 
FROM almacenes 
LIMIT 3;
\`\`\`
"Encontrados los siguientes almacenes: [Lista con AM_DENO]"

Usuario: "muéstrame dispositivos"
\`\`\`sql
SELECT id, DIS_DENO, DIS_MARCA, DIS_MOD 
FROM dispositivos 
LIMIT 3;
\`\`\`
"Encontrados los siguientes dispositivos: [Lista con DIS_DENO, DIS_MARCA, DIS_MOD]"
`;

  const system = `${instrucciones}\n\nESTRUCTURA DE LA BASE DE DATOS:\n${estructura}`;
  const user = userMessage;

  return { system, user };
}

module.exports = { promptBase };