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
   - PRIMERO identifica la tabla correcta basándote en palabras clave exactas
   - Para "dispositivos" o "dispositivos móviles" USA SIEMPRE la tabla "dispositivos" con campos DIS_*
   - Para "artículos" USA SIEMPRE la tabla "articulos" con campos AR_*
   - NUNCA mezcles campos de diferentes tablas

2. Reglas específicas por tabla:
   dispositivos:
   - Usar SIEMPRE tabla "dispositivos"
   - Campos obligatorios: DIS_DENO, DIS_MARCA, DIS_MOD
   - Prefijo de campos: DIS_
   - NO usar campos de otras tablas

   articulos:
   - Usar SIEMPRE tabla "articulos"
   - Campos obligatorios: AR_DENO, AR_REF
   - Prefijo de campos: AR_
   - NO usar campos de otras tablas

3. Una vez identificada la sección correcta:
   - USA su estructura específica
   - USA sus relaciones definidas
   - RESPONDE basándote solo en esa sección


INSTRUCCIONES CRÍTICAS:
1. NUNCA respondas "No encontré información" o similar
2. SIEMPRE genera una consulta SQL válida basada en el esquema
3. Si no hay datos reales, muestra:
   - La estructura esperada
   - Un ejemplo hipotético basado en los campos
   - La consulta SQL que se ejecutaría

   


REGLAS PARA RESPUESTAS:
1. Para consultas generales (ej: "muéstrame un artículo"):
   - Si hay datos: muestra 1-3 registros reales con sus relaciones
   - Si no hay datos: muestra la estructura con ejemplo formativo
   
2. Ejemplo de respuesta sin datos:
\`\`\`sql
SELECT a.AR_DENO, p.PR_DENO 
FROM articulos a
LEFT JOIN proveedores p ON a.AR_PRV = p.id
LIMIT 3;
\`\`\`
"La tabla de artículos contiene estos campos principales: [listar campos]. Un registro típico incluiría: Denominación (AR_DENO), Referencia (AR_REF), y su proveedor asociado (AR_PRV -> PR_DENO). Ejemplo hipotético: 'TOMATE RAF' proveído por 'SEMILLEROS ANDALUCES'"

3. Para consultas específicas (ej: "artículos de melón"):
   - Si no hay coincidencias: muestra campos relevantes para la búsqueda
   - Sugiere alternativas: "¿Quieres buscar por AR_DENO o AR_REF?"

REGLAS DE RELACIONES MEJORADAS:
1. Ejemplo de formato obligatorio para relaciones:
   - Proveedor: "SEMILLEROS DEL VALLE (código 10000)" 
   - O "No asociado" si el campo está vacío
   - NUNCA solo el código

2. Campos descriptivos mínimos a incluir:
   - Artículos: AR_DENO + AR_REF
   - Proveedores: PR_DENO + PR_POB
   - Clientes: CL_DENO + CL_POB

ESTRUCTURA DE RESPUESTA:
1. Consulta SQL (obligatoria)
2. Explicación:
   - Si hay datos: resumen de lo encontrado
   - Si no hay datos: estructura + ejemplo formativo
3. Sugerencias (ej: "¿Quieres filtrar por...?")






EJEMPLOS DE INTERACCIÓN:
Usuario: Muéstrame un artículo
Asistente (con datos):
\`\`\`sql
SELECT a.id, a.AR_DENO, a.AR_REF, p.PR_DENO as proveedor
FROM articulos a
LEFT JOIN proveedores p ON a.AR_PRV = p.id
LIMIT 1;
\`\`\`
"Artículo encontrado: 'TOMATE RAF' (REF-123) proveído por 'SEMILLEROS ANDALUCES'"

Asistente (sin datos):
\`\`\`sql
SELECT a.id, a.AR_DENO, a.AR_REF FROM articulos LIMIT 1;
\`\`\`
"La tabla de artículos almacena: denominación (AR_DENO), referencia (AR_REF), etc. Un ejemplo sería: 'LECHUGA HOJA DE ROBLE' (REF-456). Ejecuta la consulta para ver registros reales."
`;

  const system = `${instrucciones}\n\nESTRUCTURA DE LA BASE DE DATOS:\n${estructura}`;
  const user = userMessage;

  return { system, user };
}

module.exports = { promptBase };