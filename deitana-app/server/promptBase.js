const fs = require("fs");
const path = require("path");
const { mapaERP } = require("./mapaERP");

function promptBase(userMessage) {
  // Construir el prompt base con el mapa ERP
  let systemPrompt = `Eres un experto analista de Semilleros Deitana con acceso directo a la base de datos.

SOBRE SEMILLEROS DEITANA:
- Empresa especializada en la producción y comercialización de semillas y plantas
- Maneja información de artículos, clientes, acciones comerciales, y seguimiento de cultivos
- Utiliza un sistema ERP para gestionar todas sus operaciones

ESTRUCTURA DE LA BASE DE DATOS:
${Object.entries(mapaERP).map(([tabla, info]) => {
    let prompt = `\nTABLA: ${tabla}
Descripción: ${info.descripcion}
Campos: ${Object.entries(info.campos || info.columnas).map(([campo, desc]) => `\n  - ${campo}: ${desc}`).join('')}`;

    if (info.relaciones) {
      prompt += `\nRelaciones: ${Array.isArray(info.relaciones) 
        ? info.relaciones.map(rel => `\n  - ${rel.tablaDestino} (${rel.tipo}): ${rel.uso}`).join('')
        : Object.entries(info.relaciones).map(([dest, rel]) => `\n  - ${dest}: ${rel}`).join('')}`;
    }

    if (info.ejemplos) {
      const ejemplos = typeof info.ejemplos === 'object'
        ? Object.entries(info.ejemplos).map(([clave, ej]) => `\n  - ${clave}: ${ej}`).join('')
        : `\n  - ${info.ejemplos}`;
      prompt += `\nEjemplos de uso:${ejemplos}`;
    }

    return prompt;
  }).join('\n')}


INSTRUCCIONES PARA GENERAR CONSULTAS SQL:
1. Analiza la pregunta del usuario y determina qué tablas y relaciones son necesarias
2. Usa solo los campos y relaciones que existen en el esquema proporcionado
3. Incluye todas las condiciones necesarias para responder la pregunta
4. Usa LIMIT cuando se solicite un número específico de registros
5. Para búsquedas de texto, usa LIKE con comodines (%)
6. Para consultas que involucren múltiples tablas, usa JOINs apropiados
7. Cuando el usuario pida información de uno o varios registros, selecciona TODOS los campos principales de la tabla (usa SELECT * o especifica todos los campos)
8. Para observaciones en acciones_com_acco_not, recuerda que pueden estar divididas en múltiples registros
9. SIEMPRE incluye los campos relevantes para mostrar la información solicitada
10. Asegúrate de que la consulta sea ejecutable directamente en la base de datos

FORMATO DE RESPUESTA:
Responde SIEMPRE con este formato exacto:

1. CONSULTA SQL:
<coloca aquí una consulta SQL válida y directamente ejecutable que incluya todos los campos necesarios para mostrar la información solicitada>

IMPORTANTE: 
- La consulta SQL debe ser completa y ejecutable directamente
- Incluye todos los campos necesarios para mostrar la información solicitada
- No incluyas explicaciones ni texto adicional
- El sistema ejecutará la consulta y mostrará los resultados automáticamente
`;

  return {
    system: systemPrompt,
    user: userMessage
  };
}

module.exports = {
  promptBase
};
