const fs = require("fs")
const path = require("path")
const { mapaERP } = require("./mapaERP")

const schemaPath = path.join(__dirname, "schema.json")
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"))

// Sistema de contexto base mejorado
const conversationContext = {
  // Contexto general
  currentTopic: null,
  conversationHistory: [],
  lastQuery: null,
  lastResponse: null,

  // Contexto específico por tema
  articulos: {
    lastResults: null,
    lastAnalysis: null,
    lastQueryTime: null,
    relatedTopics: [],
    pendingQuestions: [],
    definitions: {
      "ACCO_DENO": "Denominación o tipo de acción comercial",
      "ACCO_CDCL": "Código del cliente",
      "ACCO_CDVD": "Código del vendedor",
      "ACCO_FEC": "Fecha de la acción",
      "ACCO_HOR": "Hora de la acción"
    }
  },

  acciones_comerciales: {
    lastResults: null,
    lastAnalysis: null,
    lastQueryTime: null,
    relatedTopics: [],
    pendingQuestions: [],
    definitions: {
      "ACCO_DENO": "Denominación o tipo de acción comercial",
      "ACCO_CDCL": "Código del cliente",
      "ACCO_CDVD": "Código del vendedor",
      "ACCO_FEC": "Fecha de la acción",
      "ACCO_HOR": "Hora de la acción"
    }
  },

  clientes: {
    lastResults: null,
    lastAnalysis: null,
    lastQueryTime: null,
    relatedTopics: [],
    pendingQuestions: [],
    definitions: {
      "CL_DENO": "Denominación o nombre del cliente",
      "CL_DOM": "Domicilio del cliente",
      "CL_POB": "Población",
      "CL_PROV": "Provincia",
      "CL_CDP": "Código postal"
    }
  },

  // ... otros temas específicos

  // Métodos de utilidad
  addToHistory(role, content) {
    this.conversationHistory.push({ role, content, timestamp: new Date() });
    
    // Limpiar historia antigua (mantener últimos 10 mensajes)
    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-10);
    }
  },

  updateCurrentTopic(topic) {
    // Si el tema cambia, limpiar el contexto anterior
    if (this.currentTopic !== topic) {
      this.lastQuery = null;
      this.lastResponse = null;
      
      // Inicializar nuevo contexto si no existe
      if (!this[topic]) {
        this[topic] = {
          lastResults: null,
          lastAnalysis: null,
          lastQueryTime: null,
          relatedTopics: [],
          pendingQuestions: []
        };
      }
    }
    this.currentTopic = topic;
  },

  getTopicContext(topic) {
    return this[topic] || null;
  },

  getRecentHistory(limit = 5) {
    return this.conversationHistory.slice(-limit);
  },

  clearContext() {
    this.lastQuery = null;
    this.lastResponse = null;
    this.currentTopic = null;
  }
};

function promptBase(userMessage) {
  const lowerMessage = userMessage.toLowerCase();

  // Construir el prompt base con contexto
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
  
  return prompt;
}).join('\n')}

CONTEXTO ACTUAL:
${conversationContext.currentTopic ? `- Tema actual: ${conversationContext.currentTopic}` : ''}
${conversationContext.lastQuery ? `- Última consulta: ${conversationContext.lastQuery}` : ''}

HISTORIAL RECIENTE:
${conversationContext.getRecentHistory(3).map(h => `${h.role}: ${h.content}`).join('\n')}

INSTRUCCIONES PARA GENERAR CONSULTAS SQL:
1. Analiza la pregunta del usuario y determina qué tablas y relaciones son necesarias
2. Usa solo los campos y relaciones que existen en el esquema proporcionado
3. Incluye todas las condiciones necesarias para responder la pregunta
4. Usa LIMIT cuando se solicite un número específico de registros
5. Para búsquedas de texto, usa LIKE con comodines (%)
6. Para consultas que involucran múltiples tablas, usa JOINs apropiados
7. Para observaciones en acciones_com_acco_not, recuerda que pueden estar divididas en múltiples registros

FORMATO DE RESPUESTA:
1. Genera una consulta SQL válida que responda a la pregunta
2. La consulta debe ser ejecutable directamente en la base de datos
3. Incluye todos los campos necesarios para responder la pregunta
4. Usa alias de tabla cuando sea necesario para claridad

IMPORTANTE:
- NO inventes datos, campos o relaciones que no existan
- Si no entiendes la consulta, pide aclaración
- Si la consulta es ambigua, pide más detalles
- Verifica que la consulta generada use solo campos y relaciones existentes`;

  return {
    system: systemPrompt,
    user: userMessage
  };
}

const promptConsultaSimple = `
Eres un asistente experto en análisis de datos y consultas SQL sobre un ERP agrícola.

Vas a recibir una pregunta del usuario y, junto con el contexto de una tabla de la base de datos y sus relaciones, deberás generar una consulta SQL válida.

REGLAS ESTRICTAS:
1. NUNCA inventes datos, nombres, emails, teléfonos o cualquier información que no exista en la base de datos.
2. Si no encuentras datos que coincidan con la búsqueda, responde honestamente indicando que no se encontraron resultados.
3. Analiza cuidadosamente la pregunta del usuario y el contexto de la conversación.
4. Si el usuario ha solicitado algo específico (ej: "con email"), asegúrate de que la consulta incluya esa condición.
5. Utiliza LIMIT cuando el usuario solicite un número específico de registros.
6. Utiliza solo las columnas que existen en el contexto.
7. Si es una búsqueda, usa LIKE con comodines si es necesario.
8. Si no entiendes qué hacer, indica que no puedes responder.

ESPECIALMENTE PARA ACCIONES COMERCIALES:
1. Si el usuario pregunta por tipos de acciones comerciales:
   - DEBES usar EXACTAMENTE esta consulta: SELECT DISTINCT ACCO_DENO FROM acciones_com ORDER BY ACCO_DENO
   - NO inventes tipos de acciones
   - NO describas ni expliques los tipos
   - NO añadas emojis ni comentarios adicionales
   - La respuesta debe ser SOLO la lista de tipos que existen en la base de datos
   - NO añadas ningún texto adicional a la respuesta
2. Si el usuario solicita un ejemplo de acción comercial, incluye:
   - ID de la acción
   - Tipo de acción (ACCO_DENO)
   - Fecha y hora
   - Información del cliente (usando la relación con la tabla clientes)
   - Información del vendedor (usando la relación con la tabla vendedores)
   - Observaciones (usando la relación con acciones_com_acco_not)
3. Para consultas que involucran observaciones, recuerda que pueden estar divididas en múltiples registros con el mismo id pero diferente id2

IMPORTANTE:
- Si no hay datos que coincidan con la búsqueda, responde: "No encontré registros que coincidan con tu búsqueda."
- NUNCA inventes información para completar campos vacíos.
- Verifica que los datos mostrados existan realmente en la base de datos.
- NUNCA describas o expliques tipos de acciones comerciales que no existan en la base de datos.
- Si el usuario pregunta por tipos de acciones, muestra EXACTAMENTE los valores que existen en el campo ACCO_DENO.
- NO inventes descripciones ni explicaciones sobre los tipos de acciones.
- NO añadas emojis ni comentarios adicionales.
- La respuesta debe ser SOLO los datos reales de la base de datos.
- NO añadas ningún texto adicional a la respuesta.

Formato de respuesta para tipos de acciones:
{
  "query": "SELECT DISTINCT ACCO_DENO FROM acciones_com ORDER BY ACCO_DENO"
}

Formato de respuesta para ejemplo de acción:
{
  "query": "SELECT a.id, a.ACCO_DENO, a.ACCO_FEC, a.ACCO_HOR, c.CL_DENO as cliente, v.VD_DENO as vendedor, o.C0 as observacion FROM acciones_com a LEFT JOIN clientes c ON a.ACCO_CDCL = c.id LEFT JOIN vendedores v ON a.ACCO_CDVD = v.id LEFT JOIN acciones_com_acco_not o ON a.id = o.id WHERE a.ACCO_DENO = 'NEGOCIACION' LIMIT 1"
}
`;

const promptAnalisis = `
Eres un analista experto. El usuario necesita un resumen, conteo, o clasificación de datos.

REGLAS ESTRICTAS:
1. NUNCA inventes datos, estadísticas o información que no exista en la base de datos.
2. Si no hay datos que coincidan con la búsqueda, responde honestamente.
3. Para consultas de conteo total, usa SELECT COUNT(*) as total FROM tabla.
4. NO uses LIMIT en consultas de conteo total.
5. Para consultas que solicitan un número específico de registros, usa LIMIT.
6. Incluye todas las condiciones mencionadas en la conversación.
7. Si no hay resultados, responde indicando que no se encontraron datos.

ESPECIALMENTE PARA ACCIONES COMERCIALES:
1. Para conteos por tipo de acción, usa GROUP BY ACCO_DENO
2. Para análisis por vendedor, usa la relación con la tabla vendedores
3. Para análisis por cliente, usa la relación con la tabla clientes
4. Para análisis temporales, usa ACCO_FEC y ACCO_HOR

IMPORTANTE:
- Si no hay datos que coincidan con la búsqueda, responde: "No encontré registros que coincidan con tu búsqueda."
- NUNCA inventes estadísticas o datos para completar la respuesta.
- Verifica que los datos mostrados existan realmente en la base de datos.

Formato de respuesta para conteo total:
{
  "query": "SELECT COUNT(*) as total FROM acciones_com WHERE ACCO_DENO = 'NEGOCIACION'"
}

Formato de respuesta para otros análisis:
{
  "query": "SELECT ACCO_DENO, COUNT(*) as total FROM acciones_com GROUP BY ACCO_DENO"
}
`;

// Función para determinar qué tipo de prompt usar
function determinarTipoPrompt(mensaje) {
  const mensajeLower = mensaje.toLowerCase();
  
  // Detectar si es una consulta de análisis o conteo total
  if (mensajeLower.match(/(cuántos|cuantos|cuántas|cuantas|total|suma|promedio|resumen|análisis|analisis|clasificación|clasificacion|frecuente|más|mas)/i)) {
    return promptAnalisis;
  }
  
  // Por defecto, usar promptConsultaSimple
  return promptConsultaSimple;
}

module.exports = {
  promptBase,
  conversationContext,
  promptConsultaSimple,
  promptAnalisis,
  determinarTipoPrompt
};