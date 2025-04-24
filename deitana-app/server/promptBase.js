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
  acciones_comerciales: {
    lastResults: null,
    lastAnalysis: null,
    lastQueryTime: null,
    relatedTopics: [],
    pendingQuestions: []
  },

  clientes: {
    lastResults: null,
    lastAnalysis: null,
    lastQueryTime: null,
    relatedTopics: [],
    pendingQuestions: []
  },

  // ... otros temas específicos

  // Métodos de utilidad
  addToHistory(role, content) {
    this.conversationHistory.push({ role, content, timestamp: new Date() });
  },

  updateCurrentTopic(topic) {
    this.currentTopic = topic;
    if (!this[topic]) {
      this[topic] = {
        lastResults: null,
        lastAnalysis: null,
        lastQueryTime: null,
        relatedTopics: [],
        pendingQuestions: []
      };
    }
  },

  getTopicContext(topic) {
    return this[topic] || null;
  },

  getRecentHistory(limit = 5) {
    return this.conversationHistory.slice(-limit);
  }
};

function promptBase(userMessage) {
  const lowerMessage = userMessage.toLowerCase();

  // Detectar el tema principal de la consulta
  const topic = detectTopic(lowerMessage);
  if (topic) {
    conversationContext.updateCurrentTopic(topic);
  }

  // Construir el prompt base con contexto
  let systemPrompt = `Eres un experto analista de Semilleros Deitana con acceso directo a la base de datos.
  
  CONTEXTO ACTUAL:
  ${conversationContext.currentTopic ? `- Tema actual: ${conversationContext.currentTopic}` : ''}
  ${conversationContext.currentTopic ? `- Último análisis: ${JSON.stringify(conversationContext.getTopicContext(conversationContext.currentTopic)?.lastAnalysis || 'Ninguno')}` : ''}
  
  HISTORIAL RECIENTE:
  ${conversationContext.getRecentHistory(3).map(h => `${h.role}: ${h.content}`).join('\n')}
  
  INSTRUCCIONES:
  1. Mantén la continuidad de la conversación
  2. Usa el contexto histórico para enriquecer tus respuestas
  3. Si el usuario cambia de tema, adáptate pero mantén la referencia al contexto anterior si es relevante
  4. Proporciona respuestas detalladas y analíticas
  5. Sugiere siempre próximos pasos o aspectos a profundizar
  
  IMPORTANTE:
  - Mantén un tono profesional pero conversacional
  - Si no tienes datos específicos, indícalo claramente
  - Sugiere consultas relacionadas basadas en el contexto
  - Si el usuario hace preguntas de seguimiento cortas, usa el contexto para entenderlas`;

  return {
    system: systemPrompt,
    user: userMessage
  };
}

// Función para detectar el tema principal de la consulta
function detectTopic(message) {
  const topics = {
    acciones_comerciales: [
      /accion(?:es)?/i,
      /incidencia/i,
      /visita/i,
      /llamada/i,
      /campaña/i,
      /negociacion/i
    ],
    clientes: [
      /cliente/i,
      /comprador/i,
      /empresa/i,
      /negocio/i
    ],
    // ... otros temas
  };

  for (const [topic, patterns] of Object.entries(topics)) {
    if (patterns.some(pattern => pattern.test(message))) {
      return topic;
    }
  }

  return null;
}

module.exports = {
  promptBase,
  conversationContext,
  detectTopic
};