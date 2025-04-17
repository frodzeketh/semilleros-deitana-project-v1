// server/routes/chat-sql.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { getQueryFromIA, getAnalyticalResponse } = require('../utils/deepseek.js');

// Variable para mantener el contexto de la conversación
let conversationContext = {
  lastTopic: null,
  lastResults: null,
  lastQuery: null
};

router.post('/', async (req, res) => {
  const { userMessage } = req.body;

  try {
    // Primero intentar con la respuesta analítica que maneja el contexto
    const analyticalResponse = await getAnalyticalResponse(userMessage);
    if (analyticalResponse) {
      return res.json({ 
        data: analyticalResponse,
        context: conversationContext
      });
    }

    // Si no hay respuesta analítica, proceder con la consulta SQL
    const sqlQuery = await getQueryFromIA(userMessage);
    
    // Si la respuesta es conversacional, la devolvemos directamente
    if (sqlQuery.includes("'CONVERSACIONAL'")) {
      const match = sqlQuery.match(/SELECT 'CONVERSACIONAL' as response_type, "(.*)" as message/);
      if (match && match[1]) {
        return res.json({ 
          data: match[1].replace(/\\n/g, "\n"),
          context: conversationContext
        });
      }
    }

    // Si es una consulta SQL válida, la ejecutamos
    if (!sqlQuery.includes("'TEXT'") && !sqlQuery.includes("'No se pudo generar'")) {
      try {
        const [results] = await db.query(sqlQuery);
        
        // Si tenemos resultados, formateamos una respuesta amigable
        if (results.length > 0) {
          // Generar un prompt para que la IA interprete los resultados
          const interpretPrompt = {
            system: `Eres un asistente experto de Semilleros Deitana. Te proporcionaré los resultados de una consulta SQL basada en la pregunta del usuario. 
            Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
            Incluye todos los datos relevantes de los resultados, pero preséntalo de forma natural y fácil de entender.`,
            user: `Pregunta original: "${userMessage}"\n\nResultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
          }

          const interpretedResponse = await sendToDeepSeek(interpretPrompt);
          return res.json({ 
            data: interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, ""),
            context: conversationContext
          });
        } else {
          return res.json({ 
            data: "No encontré información que coincida con tu consulta en nuestra base de datos. ¿Podrías reformular tu pregunta?",
            context: conversationContext
          });
        }
      } catch (error) {
        console.error("Error ejecutando consulta SQL:", error);
        return res.status(500).json({ 
          error: "No se pudo procesar la consulta",
          context: conversationContext
        });
      }
    }

    // Si llegamos aquí, es porque la IA generó una respuesta textual
    const match = sqlQuery.match(/SELECT 'TEXT' as response_type, "(.*)" as message/);
    if (match && match[1]) {
      return res.json({ 
        data: match[1].replace(/\\n/g, "\n"),
        context: conversationContext
      });
    }

    return res.status(500).json({ 
      error: "No se pudo procesar la consulta",
      context: conversationContext
    });
  } catch (error) {
    console.error('Error en /chat-sql:', error);
    return res.status(500).json({ 
      error: 'No se pudo procesar la consulta',
      context: conversationContext
    });
  }
});

module.exports = router;