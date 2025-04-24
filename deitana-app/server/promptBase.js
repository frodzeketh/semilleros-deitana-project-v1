const fs = require("fs")
const path = require("path")

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
    if (this.currentTopic) {
      this[this.currentTopic] = {
        lastResults: null,
        lastAnalysis: null,
        lastQueryTime: null,
        relatedTopics: [],
        pendingQuestions: []
      };
    }
  }
};

// Función mejorada para detectar el tema principal
function detectTopic(message) {
  const lowerMessage = message.toLowerCase();
  
  const topics = {
    articulos: {
      priority: 2,
      patterns: [
        /(?:tomate|melon|acelga|producto|artículo|articulo)/i,
        /(?:tipos?|ejemplos?|variedades?) de ([a-zá-úñ\s]+)/i,
        /(?:germinación|germinacion|precio|stock|código|barras)/i,
        /(?:semilla|planta|cultivo|invernadero)/i
      ]
    },
    acciones_comerciales: {
      priority: 1,
      patterns: [
        /accion(?:es)?/i,
        /incidencia/i,
        /visita/i,
        /llamada/i,
        /campaña/i,
        /negociacion/i,
        /seguimiento/i,
        /cliente/i,
        /vendedor/i
      ]
    }
  };

  const matches = [];
  
  for (const [topic, rules] of Object.entries(topics)) {
    let score = 0;
    for (const pattern of rules.patterns) {
      if (pattern.test(lowerMessage)) {
        score += rules.priority || 1;
      }
    }
    if (score > 0) {
      matches.push({ topic, score });
    }
  }

  // Ordenar por puntuación y retornar el tema con mayor prioridad
  if (matches.length > 0) {
    matches.sort((a, b) => b.score - a.score);
    return matches[0].topic;
  }

  return null;
}

function promptBase(userMessage) {
  const lowerMessage = userMessage.toLowerCase();

  // Detectar el tema principal de la consulta
  const topic = detectTopic(lowerMessage);
  
  // Actualizar el contexto si se detecta un nuevo tema
  if (topic) {
    conversationContext.updateCurrentTopic(topic);
  } else if (conversationContext.currentTopic) {
    // Si no se detecta un tema nuevo pero hay uno activo,
    // verificar si el mensaje actual está relacionado
    const currentTopicPatterns = topics[conversationContext.currentTopic]?.patterns;
    if (!currentTopicPatterns?.some(pattern => pattern.test(lowerMessage))) {
      // Si el mensaje no está relacionado con el tema actual, limpiar contexto
      conversationContext.clearContext();
    }
  }

  // Obtener definiciones específicas del tema si existen
  const topicDefinitions = topic && conversationContext[topic]?.definitions 
    ? Object.entries(conversationContext[topic].definitions)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n')
    : '';

  // Construir el prompt base con contexto
  let systemPrompt = `Eres un experto analista de Semilleros Deitana con acceso directo a la base de datos.

SOBRE SEMILLEROS DEITANA:
- Empresa especializada en la producción y comercialización de semillas y plantas
- Maneja información de artículos, clientes, acciones comerciales, y seguimiento de cultivos
- Utiliza un sistema ERP para gestionar todas sus operaciones

${topic ? `TEMA ACTUAL: ${topic}
DEFINICIONES RELEVANTES:
${topicDefinitions}` : ''}

CONTEXTO ACTUAL:
${conversationContext.currentTopic ? `- Tema actual: ${conversationContext.currentTopic}` : ''}
${conversationContext.lastQuery ? `- Última consulta: ${conversationContext.lastQuery}` : ''}

HISTORIAL RECIENTE:
${conversationContext.getRecentHistory(3).map(h => `${h.role}: ${h.content}`).join('\n')}

INSTRUCCIONES:
1. Mantén la continuidad de la conversación
2. Si el usuario cambia de tema, adáptate al nuevo tema
3. Proporciona análisis detallados usando los datos disponibles
4. Sugiere siempre próximos pasos o aspectos a profundizar
5. Mantén un tono profesional pero conversacional
6. Explica los términos técnicos cuando sea necesario
7. Relaciona la información con el contexto del negocio
8. Proporciona ejemplos específicos cuando sea relevante

FORMATO DE RESPUESTA:
1. Primero responde la pregunta directamente
2. Luego proporciona contexto adicional si es relevante
3. Finalmente, sugiere preguntas relacionadas o próximos pasos

IMPORTANTE:
- NO inventes datos
- Si no entiendes la consulta, pide aclaración
- Si la consulta es ambigua, pide más detalles
- Mantén las respuestas concisas y relevantes
- Usa los nombres de campos correctos según el esquema de la base de datos`;

  return {
    system: systemPrompt,
    user: userMessage
  };
}

module.exports = {
  promptBase,
  conversationContext,
  detectTopic
};