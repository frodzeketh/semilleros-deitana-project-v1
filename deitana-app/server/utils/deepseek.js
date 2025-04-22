const axios = require("axios")
const db = require("../db")
const { conversationContext } = require("../promptBase")





// =====================================================
// SECCIÓN: CONFIGURACIÓN Y CONEXIÓN CON DEEPSEEK
// Esta sección maneja la conexión y comunicación con la API de DeepSeek
// =====================================================
const sendToDeepSeek = async (prompt) => {
  const apiKey = process.env.DEEPSEEK_API_KEY

  const body = {
    model: "deepseek-chat",
    messages: [
      {
        role: "system",
        content: prompt.system,
      },
      {
        role: "user",
        content: prompt.user,
      },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  }

  try {
    const response = await axios.post("https://api.deepseek.com/chat/completions", body, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    })

    const content = response.data.choices[0].message.content
    return content
  } catch (error) {
    console.error("Error calling DeepSeek API:", error.message)
    if (error.response) {
      console.error("Response data:", error.response.data)
      console.error("Response status:", error.response.status)
    }
    return "Lo siento, hubo un error al procesar tu consulta. Por favor, intenta de nuevo más tarde."
  }
}


// =====================================================
// SECCIÓN: GENERACIÓN DE CONSULTAS SQL
// Esta sección se encarga de generar consultas SQL a partir de preguntas en lenguaje natural
// =====================================================
// Function to get SQL query from AI
const getQueryFromIA = async (userMessage) => {
  const { promptBase } = require("../promptBase")
  const prompt = promptBase(userMessage)

  const aiResponse = await sendToDeepSeek(prompt)

  // Check if it's a conversational response
  if (aiResponse.startsWith("CONVERSACIONAL:")) {
    return `SELECT 'CONVERSACIONAL' as response_type, ${JSON.stringify(aiResponse.substring(15).trim())} as message`
  }

  // Extract SQL query from the response
  const sqlMatch = aiResponse.match(/```sql\s*([\s\S]*?)\s*```/)
  if (sqlMatch && sqlMatch[1]) {
    return sqlMatch[1].trim()
  }

  // If no SQL found but response exists, return it as a message
  if (aiResponse) {
    return `SELECT 'TEXT' as response_type, ${JSON.stringify(aiResponse)} as message`
  }

  return "SELECT 'No se pudo generar una consulta SQL válida' as error"
}














// =====================================================
// SECCIÓN: MANEJO DE CONSULTAS SOBRE BANDEJAS
// Esta sección maneja todas las consultas relacionadas con la tabla "bandejas"
// que contiene información sobre bandejas, macetas y sus características
// =====================================================

// Función para manejar consultas sobre bandejas con contexto
const handleBandejasQuery = async (userMessage) => {
  const lowerMessage = userMessage.toLowerCase();
  // =====================================================
// SUBSECCIÓN: CONSULTAS DE TAMAÑO EN CM
// Maneja consultas sobre el tamaño de bandejas en centímetros
// Ejemplo: "¿Cuál es la bandeja más grande en CM?"
// =====================================================
  // Si hay contexto previo de bandejas y se pregunta por tamaños
  if (conversationContext.lastTopic === 'bandejas' && 
      (lowerMessage.includes('más grande') || 
       lowerMessage.includes('mas grande') || 
       lowerMessage.includes('mayor') ||
       lowerMessage.includes('más pequeño') ||
       lowerMessage.includes('mas pequeño') ||
       lowerMessage.includes('menor'))) {
    
    // Determinar si la consulta es sobre CM
    const isCmQuery = lowerMessage.includes('cm') || 
                     (conversationContext.lastQuery && conversationContext.lastQuery.toLowerCase().includes('cm'));
    




// =====================================================
// SUBSECCIÓN: CONSULTAS DE NÚMERO DE ALVÉOLOS
// Maneja consultas sobre el número de alvéolos de bandejas específicas
// Ejemplo: "¿Cuántos alvéolos tiene la maceta de 12 cm?"
// =====================================================
    if (isCmQuery) {
      // Buscar la bandeja con mayor o menor tamaño en CM según la consulta
      const orderDirection = (lowerMessage.includes('más grande') || 
                            lowerMessage.includes('mas grande') || 
                            lowerMessage.includes('mayor')) ? 'DESC' : 'ASC';
      
      const [results] = await db.query(`
        SELECT * FROM bandejas 
        WHERE BN_DENO LIKE '%CM%' 
        ORDER BY CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(BN_DENO, 'CM', 1), ' ', -1) AS DECIMAL(10,2)) ${orderDirection}
        LIMIT 1
      `);

      if (results.length > 0) {
        // Generar un prompt para que la IA interprete los resultados
        const interpretPrompt = {
          system: `Eres un asistente experto de Semilleros Deitana. El usuario está en una conversación sobre tamaños de bandejas en centímetros.
          Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
          
          IMPORTANTE: 
          1. Mantén el contexto de la conversación anterior sobre tamaños de bandejas
          2. No saludes de nuevo si ya estabas en una conversación
          3. Responde de manera natural y continua a la conversación
          4. Si el usuario pregunta por "la más grande" o "la más pequeña" sin especificar CM, asume que se refiere a CM por el contexto anterior
          5. Incluye todos los datos relevantes de los resultados, pero preséntalo de forma natural y fácil de entender
          
          Por ejemplo, si en la conversación anterior se habló de tamaños en CM y ahora preguntan por "la más pequeña", debes entender que se refiere a la más pequeña en CM.`,
          user: `Contexto anterior: ${conversationContext.lastQuery}
Resultados anteriores: ${JSON.stringify(conversationContext.lastResults, null, 2)}
Pregunta actual: ${userMessage}
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
        }
        const interpretedResponse = await sendToDeepSeek(interpretPrompt);
        
        // Actualizar el contexto después de la consulta
        conversationContext.lastQuery = userMessage;
        conversationContext.lastResults = results;
        
        return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
      }
    }
  }

  // Si es una consulta sobre número de alvéolos
  if (lowerMessage.includes("cuantos alveolos") || lowerMessage.includes("cuántos alvéolos")) {
    // Primero intentar con tamaño en CM
    const sizeMatch = userMessage.match(/(\d+(?:\.\d+)?)\s*cm/i);
    if (sizeMatch && sizeMatch[1]) {
      const size = sizeMatch[1];
      const [results] = await db.query(`
        SELECT * FROM bandejas 
        WHERE BN_DENO LIKE ? AND BN_ALV IS NOT NULL
        ORDER BY id
      `, [`%${size} CM%`]);

      if (results.length > 0) {
        const interpretPrompt = {
          system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre el número de alvéolos de una bandeja específica.
          Tu tarea es interpretar estos resultados y responder de manera clara y concisa.
          
          IMPORTANTE:
          1. Menciona el número exacto de alvéolos según los datos de la base de datos
          2. Incluye la denominación exacta de la bandeja
          3. No agregues información adicional que no esté en los datos
          4. Mantén un tono profesional y directo`,
          user: `Pregunta original: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
        }
        const interpretedResponse = await sendToDeepSeek(interpretPrompt);
        
        // Actualizar el contexto
        conversationContext.lastTopic = 'bandejas';
        conversationContext.lastQuery = userMessage;
        conversationContext.lastResults = results;
        
        return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
      }
    }

    // Si no se encontró por tamaño, intentar por denominación
    const bandejaMatch = userMessage.match(/(?:tiene|tienen)\s+([A-Za-z0-9\s\.\(\)]+)/i);
    if (bandejaMatch && bandejaMatch[1]) {
      const nombreBandeja = bandejaMatch[1].trim();
      const [results] = await db.query(`
        SELECT * FROM bandejas 
        WHERE BN_DENO LIKE ? AND BN_ALV IS NOT NULL
        ORDER BY id
      `, [`%${nombreBandeja}%`]);

      if (results.length > 0) {
        const interpretPrompt = {
          system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre el número de alvéolos de una bandeja específica.
          Tu tarea es interpretar estos resultados y responder de manera clara y concisa.
          
          IMPORTANTE:
          1. Menciona el número exacto de alvéolos según los datos de la base de datos
          2. Incluye la denominación exacta de la bandeja
          3. No agregues información adicional que no esté en los datos
          4. Mantén un tono profesional y directo`,
          user: `Pregunta original: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
        }
        const interpretedResponse = await sendToDeepSeek(interpretPrompt);
        
        // Actualizar el contexto
        conversationContext.lastTopic = 'bandejas';
        conversationContext.lastQuery = userMessage;
        conversationContext.lastResults = results;
        
        return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
      }
    }

    // Si no se encontró ni por tamaño ni por denominación, intentar buscar directamente el nombre
    const directNameMatch = userMessage.match(/(\d+\s*ALV\.?\s*[A-Za-z0-9\s\.\(\)]+)/i);
    if (directNameMatch && directNameMatch[1]) {
      const nombreBandeja = directNameMatch[1].trim();
      const [results] = await db.query(`
        SELECT * FROM bandejas 
        WHERE BN_DENO LIKE ? AND BN_ALV IS NOT NULL
        ORDER BY id
      `, [`%${nombreBandeja}%`]);

      if (results.length > 0) {
        const interpretPrompt = {
          system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre el número de alvéolos de una bandeja específica.
          Tu tarea es interpretar estos resultados y responder de manera clara y concisa.
          
          IMPORTANTE:
          1. Menciona el número exacto de alvéolos según los datos de la base de datos
          2. Incluye la denominación exacta de la bandeja
          3. No agregues información adicional que no esté en los datos
          4. Mantén un tono profesional y directo`,
          user: `Pregunta original: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
        }
        const interpretedResponse = await sendToDeepSeek(interpretPrompt);
        
        // Actualizar el contexto
        conversationContext.lastTopic = 'bandejas';
        conversationContext.lastQuery = userMessage;
        conversationContext.lastResults = results;
        
        return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
      }
    }

    // Si no se encontró ni por tamaño ni por denominación
    return "No encontré información sobre la bandeja solicitada en nuestra base de datos. ¿Te gustaría ver qué bandejas tenemos disponibles?";
  }

  // Si es una consulta sobre número de alvéolos
  if (lowerMessage.includes("alvéolo") || lowerMessage.includes("alveolo")) {
    // Si pregunta por la bandeja con más alvéolos
    if (lowerMessage.includes("más") || lowerMessage.includes("mayor")) {
      const [results] = await db.query(`
        SELECT * FROM bandejas 
        WHERE BN_ALV IS NOT NULL AND BN_ALV != ''
        ORDER BY CAST(BN_ALV AS UNSIGNED) DESC 
        LIMIT 1
      `);

      if (results.length > 0) {
        const interpretPrompt = {
          system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre la bandeja con más alvéolos.
          Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable.
          
          IMPORTANTE:
          1. Menciona el número exacto de alvéolos según los datos de la base de datos
          2. Incluye la denominación de la bandeja y su código
          3. Si la bandeja es retornable, menciónalo
          4. No inventes información que no esté en los datos
          5. Mantén un tono profesional y amigable
          6. No agregues información adicional sobre usos o tamaños que no estén en los datos
          7. Si el usuario quiere más información, invítalo a preguntar`,
          user: `Pregunta original: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
        }
        const interpretedResponse = await sendToDeepSeek(interpretPrompt);
        
        // Actualizar el contexto
        conversationContext.lastTopic = 'bandejas';
        conversationContext.lastQuery = userMessage;
        conversationContext.lastResults = results;
        
        return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
      }
    }
    
    // Si pregunta por bandejas con un número específico de alvéolos
    const alveolosMatch = userMessage.match(/(\d+)\s*(?:alvéolo|alveolo|alveolos|alvéolos)/i);
    if (alveolosMatch && alveolosMatch[1]) {
      const numAlveolos = Number.parseInt(alveolosMatch[1]);
      const [results] = await db.query(`
        SELECT * FROM bandejas 
        WHERE BN_ALV = ? 
        ORDER BY id
      `, [numAlveolos]);

      if (results.length > 0) {
        const interpretPrompt = {
          system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre bandejas con ${numAlveolos} alvéolos.
          Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable.
          
          IMPORTANTE:
          1. Menciona todas las bandejas encontradas con ese número de alvéolos
          2. Incluye la denominación y código de cada bandeja
          3. Si alguna bandeja es retornable, menciónalo
          4. No inventes información que no esté en los datos
          5. Mantén un tono profesional y amigable
          6. No agregues información adicional sobre usos o tamaños que no estén en los datos
          7. Si el usuario quiere más información, invítalo a preguntar`,
          user: `Pregunta original: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
        }
        const interpretedResponse = await sendToDeepSeek(interpretPrompt);
        
        // Actualizar el contexto
        conversationContext.lastTopic = 'bandejas';
        conversationContext.lastQuery = userMessage;
        conversationContext.lastResults = results;
        
        return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
      } else {
        return `No encontré bandejas con ${numAlveolos} alvéolos en nuestra base de datos. ¿Te gustaría ver qué bandejas tenemos disponibles?`;
      }
    }
  }

  // Si es una consulta sobre bandejas con tamaño en CM
  if (lowerMessage.includes("bandeja") && lowerMessage.includes("cm")) {
    const [results] = await db.query(`
      SELECT * FROM bandejas 
      WHERE BN_DENO LIKE '%CM%' 
      ORDER BY CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(BN_DENO, 'CM', 1), ' ', -1) AS DECIMAL(10,2))
    `);

    if (results.length > 0) {
      // Generar un prompt para que la IA interprete los resultados
      const interpretPrompt = {
        system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre bandejas que contienen su tamaño en CM.
        Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
        Incluye todos los datos relevantes de los resultados, pero preséntalo de forma natural y fácil de entender.
        Mantén el contexto de la conversación para poder responder preguntas de seguimiento.`,
        user: `Pregunta original: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
      }
      const interpretedResponse = await sendToDeepSeek(interpretPrompt);
      
      // Actualizar el contexto después de la consulta
      conversationContext.lastTopic = 'bandejas';
      conversationContext.lastQuery = userMessage;
      conversationContext.lastResults = results;
      
      return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
    }
  }

  // Si es una consulta sobre ejemplos de bandejas
  if ((lowerMessage.includes("bandeja") && 
      (lowerMessage.includes("ejemplo") || 
       lowerMessage.includes("ejemplos") || 
       lowerMessage.includes("mostrar") || 
       lowerMessage.includes("listar") ||
       lowerMessage.includes("tipos") ||
       lowerMessage.includes("tenemos") ||
       lowerMessage.includes("tengamos") ||
       lowerMessage.includes("tienes"))) ||
      (conversationContext.lastTopic === 'bandejas' && 
       (lowerMessage.includes("más") || 
        lowerMessage.includes("mas") || 
        lowerMessage.includes("otro") || 
        lowerMessage.includes("otra")))) {
    
    // Extraer el número de ejemplos solicitados
    const cantidadMatch = userMessage.match(/(\d+)\s*(?:ejemplos|ejemplo|mas|más|otro|otra|bandejas|bandeja)/i);
    const limit = cantidadMatch ? Number.parseInt(cantidadMatch[1]) : 3;
    
    // Obtener las bandejas que ya se mostraron anteriormente
    const bandejasMostradas = conversationContext.lastResults ? 
      conversationContext.lastResults.map(b => b.BN_DENO) : [];
    
    // Construir la consulta SQL excluyendo las bandejas ya mostradas
    let query = `
      SELECT * FROM bandejas 
      WHERE BN_DENO IS NOT NULL 
      AND BN_DENO != ''
    `;
    
    if (bandejasMostradas.length > 0) {
      const placeholders = bandejasMostradas.map(() => '?').join(',');
      query += ` AND BN_DENO NOT IN (${placeholders})`;
    }
    
    query += ` ORDER BY BN_ALV DESC LIMIT ${limit}`;
    
    const [results] = await db.query(query, bandejasMostradas);

    if (results.length > 0) {
      // Generar un prompt para que la IA interprete los resultados
      const interpretPrompt = {
        system: `Eres un experto en horticultura y producción de semilleros. El usuario ha solicitado ver ejemplos de bandejas.
        Tu tarea es presentar las bandejas disponibles de manera informativa y profesional, considerando:
        1. Las características técnicas de cada bandeja
        2. La capacidad productiva según el número de alvéolos
        3. Las ventajas de cada modelo
        4. Las aplicaciones generales según el tipo de bandeja
        
        IMPORTANTE:
        1. Presenta cada bandeja con sus especificaciones completas
        2. Explica brevemente las ventajas del número de alvéolos
        3. Si la bandeja es retornable, destaca esta característica
        4. Menciona posibles aplicaciones generales
        5. Mantén un tono profesional pero accesible
        6. Organiza la información de manera clara y estructurada
        7. Invita a preguntas específicas sobre cada bandeja
        8. Sugiere consultar sobre usos específicos
        
        Tu respuesta debe ser informativa y orientada a ayudar en la toma de decisiones.`,
        user: `Contexto anterior: ${conversationContext.lastQuery}
Resultados anteriores: ${JSON.stringify(conversationContext.lastResults, null, 2)}
Pregunta actual: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
      }
      const interpretedResponse = await sendToDeepSeek(interpretPrompt);
      
      // Actualizar el contexto después de la consulta
      conversationContext.lastTopic = 'bandejas';
      conversationContext.lastQuery = userMessage;
      conversationContext.lastResults = [...(conversationContext.lastResults || []), ...results];
      
      return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
    } else {
      // Si no hay más bandejas para mostrar, verificar si ya se mostraron todas
      const [totalBandejas] = await db.query('SELECT COUNT(*) as total FROM bandejas WHERE BN_DENO IS NOT NULL AND BN_DENO != ""');
      const totalMostradas = conversationContext.lastResults ? conversationContext.lastResults.length : 0;
      
      if (totalMostradas >= totalBandejas[0].total) {
        const interpretPrompt = {
          system: `Eres un experto en horticultura y producción de semilleros. El usuario ha solicitado ver más bandejas, pero ya se han mostrado todas las disponibles.
          Tu tarea es:
          1. Informar amablemente que ya se han mostrado todas las bandejas
          2. Hacer un breve resumen de las categorías principales de bandejas mostradas
          3. Sugerir próximos pasos útiles
          4. Mantener un tono profesional y servicial
          
          IMPORTANTE:
          1. No menciones bandejas específicas nuevamente
          2. Enfócate en categorías generales (por rango de alvéolos)
          3. Sugiere preguntas específicas que el usuario podría hacer
          4. Ofrece ayuda para encontrar la bandeja más adecuada
          
          Tu respuesta debe ser útil y orientada a continuar la conversación de manera productiva.`,
          user: `Contexto anterior: ${conversationContext.lastQuery}
Bandejas ya mostradas: ${JSON.stringify(conversationContext.lastResults, null, 2)}
Pregunta actual: "${userMessage}"`,
        }
        const interpretedResponse = await sendToDeepSeek(interpretPrompt);
        return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
      } else {
        // Si hay un problema técnico, intentar mostrar todas las bandejas disponibles
        const [allResults] = await db.query(`
          SELECT * FROM bandejas 
          WHERE BN_DENO IS NOT NULL 
          AND BN_DENO != ''
          ORDER BY BN_ALV DESC
        `);
        
        if (allResults.length > 0) {
          conversationContext.lastResults = allResults;
          const interpretPrompt = {
            system: `Eres un experto en horticultura y producción de semilleros. Debido a un problema técnico, mostraremos todas las bandejas disponibles.
            Tu tarea es presentar un catálogo completo de manera organizada y profesional, considerando:
            1. Agrupar las bandejas por categorías según número de alvéolos
            2. Destacar las características principales de cada grupo
            3. Mencionar aplicaciones típicas para cada categoría
            4. Proporcionar una visión general de las opciones disponibles
            
            IMPORTANTE:
            1. Organiza la información de manera clara y estructurada
            2. Destaca las características más relevantes
            3. Menciona ventajas específicas de cada grupo
            4. Sugiere aplicaciones típicas
            5. Mantén un tono profesional y accesible
            6. Invita a preguntas específicas
            
            Tu respuesta debe ser completa y facilitar la toma de decisiones.`,
            user: `Pregunta actual: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(allResults, null, 2)}`,
          }
          const interpretedResponse = await sendToDeepSeek(interpretPrompt);
          return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
        }
      }
    }
  }

  // Si es una pregunta sobre el uso o recomendación de bandejas
  if (conversationContext.lastTopic === 'bandejas' && 
      (lowerMessage.includes("conveniente") || 
       lowerMessage.includes("recomend") || 
       lowerMessage.includes("ideal") || 
       lowerMessage.includes("mejor") ||
       lowerMessage.includes("para") ||
       lowerMessage.includes("cultivo") ||
       lowerMessage.includes("plantines") ||
       lowerMessage.includes("lechuga") ||
       lowerMessage.includes("tomate") ||
       lowerMessage.includes("pimiento") ||
       lowerMessage.includes("aromaticas") ||
       lowerMessage.includes("aromáticas"))) {
    
    // Obtener todas las bandejas disponibles para hacer recomendaciones
    const [allBandejas] = await db.query(`
      SELECT * FROM bandejas 
      WHERE BN_DENO IS NOT NULL 
      AND BN_DENO != ''
      ORDER BY BN_ALV DESC
    `);
    
    if (allBandejas.length > 0) {
      const interpretPrompt = {
        system: `Eres un experto en horticultura y producción de semilleros. El usuario está preguntando sobre qué bandeja es más adecuada para un cultivo específico.
        Tu tarea es analizar las bandejas disponibles y hacer una recomendación experta basada en:
        1. Las características del cultivo mencionado
        2. El desarrollo radicular esperado
        3. El ciclo de cultivo
        4. Las mejores prácticas de producción
        5. La eficiencia en el uso del espacio
        
        IMPORTANTE:
        1. Analiza el número de alvéolos y su relación con el cultivo
        2. Proporciona una explicación técnica detallada
        3. Menciona ventajas y desventajas de cada opción
        4. Considera el desarrollo radicular y aéreo
        5. Incluye recomendaciones de manejo
        6. Si la bandeja es retornable, menciona las ventajas
        7. Proporciona información sobre el ciclo de cultivo
        8. Mantén un tono profesional pero accesible
        
        Tu respuesta debe ser completa y basada en conocimiento experto en horticultura.`,
        user: `Pregunta del usuario: "${userMessage}"
Bandejas disponibles:\n${JSON.stringify(allBandejas, null, 2)}`,
      }
      const interpretedResponse = await sendToDeepSeek(interpretPrompt);
      
      // Actualizar el contexto
      conversationContext.lastQuery = userMessage;
      
      return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
    }
  }

  // Si es una consulta sobre número de alvéolos
  if (lowerMessage.includes("cuantos alveolos") || lowerMessage.includes("cuántos alvéolos")) {
    // Primero intentar con tamaño en CM
    const sizeMatch = userMessage.match(/(\d+(?:\.\d+)?)\s*cm/i);
    if (sizeMatch && sizeMatch[1]) {
      const size = sizeMatch[1];
      const [results] = await db.query(`
        SELECT * FROM bandejas 
        WHERE BN_DENO LIKE ? AND BN_ALV IS NOT NULL
        ORDER BY id
      `, [`%${size} CM%`]);

      if (results.length > 0) {
        const interpretPrompt = {
          system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre el número de alvéolos de una bandeja específica.
          Tu tarea es interpretar estos resultados y responder de manera clara y concisa.
          
          IMPORTANTE:
          1. Menciona el número exacto de alvéolos según los datos de la base de datos
          2. Incluye la denominación exacta de la bandeja
          3. No agregues información adicional que no esté en los datos
          4. Mantén un tono profesional y directo`,
          user: `Pregunta original: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
        }
        const interpretedResponse = await sendToDeepSeek(interpretPrompt);
        
        // Actualizar el contexto
        conversationContext.lastTopic = 'bandejas';
        conversationContext.lastQuery = userMessage;
        conversationContext.lastResults = results;
        
        return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
      }
    }

    // Si no se encontró por tamaño, intentar por denominación
    const bandejaMatch = userMessage.match(/(?:tiene|tienen)\s+([A-Za-z0-9\s\.\(\)]+)/i);
    if (bandejaMatch && bandejaMatch[1]) {
      const nombreBandeja = bandejaMatch[1].trim();
      const [results] = await db.query(`
        SELECT * FROM bandejas 
        WHERE BN_DENO LIKE ? AND BN_ALV IS NOT NULL
        ORDER BY id
      `, [`%${nombreBandeja}%`]);

      if (results.length > 0) {
        const interpretPrompt = {
          system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre el número de alvéolos de una bandeja específica.
          Tu tarea es interpretar estos resultados y responder de manera clara y concisa.
          
          IMPORTANTE:
          1. Menciona el número exacto de alvéolos según los datos de la base de datos
          2. Incluye la denominación exacta de la bandeja
          3. No agregues información adicional que no esté en los datos
          4. Mantén un tono profesional y directo`,
          user: `Pregunta original: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
        }
        const interpretedResponse = await sendToDeepSeek(interpretPrompt);
        
        // Actualizar el contexto
        conversationContext.lastTopic = 'bandejas';
        conversationContext.lastQuery = userMessage;
        conversationContext.lastResults = results;
        
        return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
      }
    }

    // Si no se encontró ni por tamaño ni por denominación, intentar buscar directamente el nombre
    const directNameMatch = userMessage.match(/(\d+\s*ALV\.?\s*[A-Za-z0-9\s\.\(\)]+)/i);
    if (directNameMatch && directNameMatch[1]) {
      const nombreBandeja = directNameMatch[1].trim();
      const [results] = await db.query(`
        SELECT * FROM bandejas 
        WHERE BN_DENO LIKE ? AND BN_ALV IS NOT NULL
        ORDER BY id
      `, [`%${nombreBandeja}%`]);

      if (results.length > 0) {
        const interpretPrompt = {
          system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre el número de alvéolos de una bandeja específica.
          Tu tarea es interpretar estos resultados y responder de manera clara y concisa.
          
          IMPORTANTE:
          1. Menciona el número exacto de alvéolos según los datos de la base de datos
          2. Incluye la denominación exacta de la bandeja
          3. No agregues información adicional que no esté en los datos
          4. Mantén un tono profesional y directo`,
          user: `Pregunta original: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
        }
        const interpretedResponse = await sendToDeepSeek(interpretPrompt);
        
        // Actualizar el contexto
        conversationContext.lastTopic = 'bandejas';
        conversationContext.lastQuery = userMessage;
        conversationContext.lastResults = results;
        
        return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
      }
    }

    // Si no se encontró ni por tamaño ni por denominación
    return "No encontré información sobre la bandeja solicitada en nuestra base de datos. ¿Te gustaría ver qué bandejas tenemos disponibles?";
  }

  // Si es una consulta sobre número de alvéolos
  if (lowerMessage.includes("alvéolo") || lowerMessage.includes("alveolo")) {
    // Si pregunta por la bandeja con más alvéolos
    if (lowerMessage.includes("más") || lowerMessage.includes("mayor")) {
      const [results] = await db.query(`
        SELECT * FROM bandejas 
        WHERE BN_ALV IS NOT NULL AND BN_ALV != ''
        ORDER BY CAST(BN_ALV AS UNSIGNED) DESC 
        LIMIT 1
      `);

      if (results.length > 0) {
        const interpretPrompt = {
          system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre la bandeja con más alvéolos.
          Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable.
          
          IMPORTANTE:
          1. Menciona el número exacto de alvéolos según los datos de la base de datos
          2. Incluye la denominación de la bandeja y su código
          3. Si la bandeja es retornable, menciónalo
          4. No inventes información que no esté en los datos
          5. Mantén un tono profesional y amigable
          6. No agregues información adicional sobre usos o tamaños que no estén en los datos
          7. Si el usuario quiere más información, invítalo a preguntar`,
          user: `Pregunta original: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
        }
        const interpretedResponse = await sendToDeepSeek(interpretPrompt);
        
        // Actualizar el contexto
        conversationContext.lastTopic = 'bandejas';
        conversationContext.lastQuery = userMessage;
        conversationContext.lastResults = results;
        
        return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
      }
    }
    
    // Si pregunta por bandejas con un número específico de alvéolos
    const alveolosMatch = userMessage.match(/(\d+)\s*(?:alvéolo|alveolo|alveolos|alvéolos)/i);
    if (alveolosMatch && alveolosMatch[1]) {
      const numAlveolos = Number.parseInt(alveolosMatch[1]);
      const [results] = await db.query(`
        SELECT * FROM bandejas 
        WHERE BN_ALV = ? 
        ORDER BY id
      `, [numAlveolos]);

      if (results.length > 0) {
        const interpretPrompt = {
          system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre bandejas con ${numAlveolos} alvéolos.
          Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable.
          
          IMPORTANTE:
          1. Menciona todas las bandejas encontradas con ese número de alvéolos
          2. Incluye la denominación y código de cada bandeja
          3. Si alguna bandeja es retornable, menciónalo
          4. No inventes información que no esté en los datos
          5. Mantén un tono profesional y amigable
          6. No agregues información adicional sobre usos o tamaños que no estén en los datos
          7. Si el usuario quiere más información, invítalo a preguntar`,
          user: `Pregunta original: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
        }
        const interpretedResponse = await sendToDeepSeek(interpretPrompt);
        
        // Actualizar el contexto
        conversationContext.lastTopic = 'bandejas';
        conversationContext.lastQuery = userMessage;
        conversationContext.lastResults = results;
        
        return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
      } else {
        return `No encontré bandejas con ${numAlveolos} alvéolos en nuestra base de datos. ¿Te gustaría ver qué bandejas tenemos disponibles?`;
      }
    }
  }

  // Si es una consulta sobre bandejas con tamaño en CM
  if (lowerMessage.includes("bandeja") && lowerMessage.includes("cm")) {
    const [results] = await db.query(`
      SELECT * FROM bandejas 
      WHERE BN_DENO LIKE '%CM%' 
      ORDER BY CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(BN_DENO, 'CM', 1), ' ', -1) AS DECIMAL(10,2))
    `);

    if (results.length > 0) {
      // Generar un prompt para que la IA interprete los resultados
      const interpretPrompt = {
        system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre bandejas que contienen su tamaño en CM.
        Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
        Incluye todos los datos relevantes de los resultados, pero preséntalo de forma natural y fácil de entender.
        Mantén el contexto de la conversación para poder responder preguntas de seguimiento.`,
        user: `Pregunta original: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
      }
      const interpretedResponse = await sendToDeepSeek(interpretPrompt);
      
      // Actualizar el contexto después de la consulta
      conversationContext.lastTopic = 'bandejas';
      conversationContext.lastQuery = userMessage;
      conversationContext.lastResults = results;
      
      return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
    }
  }

  // Si es una consulta sobre ejemplos de bandejas
  if ((lowerMessage.includes("bandeja") && 
      (lowerMessage.includes("ejemplo") || 
       lowerMessage.includes("ejemplos") || 
       lowerMessage.includes("mostrar") || 
       lowerMessage.includes("listar") ||
       lowerMessage.includes("tipos") ||
       lowerMessage.includes("tenemos") ||
       lowerMessage.includes("tengamos") ||
       lowerMessage.includes("tienes"))) ||
      (conversationContext.lastTopic === 'bandejas' && 
       (lowerMessage.includes("más") || 
        lowerMessage.includes("mas") || 
        lowerMessage.includes("otro") || 
        lowerMessage.includes("otra")))) {
    
    // Extraer el número de ejemplos solicitados
    const cantidadMatch = userMessage.match(/(\d+)\s*(?:ejemplos|ejemplo|mas|más|otro|otra|bandejas|bandeja)/i);
    const limit = cantidadMatch ? Number.parseInt(cantidadMatch[1]) : 3;
    
    // Obtener las bandejas que ya se mostraron anteriormente
    const bandejasMostradas = conversationContext.lastResults ? 
      conversationContext.lastResults.map(b => b.BN_DENO) : [];
    
    // Construir la consulta SQL excluyendo las bandejas ya mostradas
    let query = `
      SELECT * FROM bandejas 
      WHERE BN_DENO IS NOT NULL 
      AND BN_DENO != ''
    `;
    
    if (bandejasMostradas.length > 0) {
      const placeholders = bandejasMostradas.map(() => '?').join(',');
      query += ` AND BN_DENO NOT IN (${placeholders})`;
    }
    
    query += ` ORDER BY BN_ALV DESC LIMIT ${limit}`;
    
    const [results] = await db.query(query, bandejasMostradas);

    if (results.length > 0) {
      // Generar un prompt para que la IA interprete los resultados
      const interpretPrompt = {
        system: `Eres un experto en horticultura y producción de semilleros. El usuario ha solicitado ver ejemplos de bandejas.
        Tu tarea es presentar las bandejas disponibles de manera informativa y profesional, considerando:
        1. Las características técnicas de cada bandeja
        2. La capacidad productiva según el número de alvéolos
        3. Las ventajas de cada modelo
        4. Las aplicaciones generales según el tipo de bandeja
        
        IMPORTANTE:
        1. Presenta cada bandeja con sus especificaciones completas
        2. Explica brevemente las ventajas del número de alvéolos
        3. Si la bandeja es retornable, destaca esta característica
        4. Menciona posibles aplicaciones generales
        5. Mantén un tono profesional pero accesible
        6. Organiza la información de manera clara y estructurada
        7. Invita a preguntas específicas sobre cada bandeja
        8. Sugiere consultar sobre usos específicos
        
        Tu respuesta debe ser informativa y orientada a ayudar en la toma de decisiones.`,
        user: `Contexto anterior: ${conversationContext.lastQuery}
Resultados anteriores: ${JSON.stringify(conversationContext.lastResults, null, 2)}
Pregunta actual: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
      }
      const interpretedResponse = await sendToDeepSeek(interpretPrompt);
      
      // Actualizar el contexto después de la consulta
      conversationContext.lastTopic = 'bandejas';
      conversationContext.lastQuery = userMessage;
      conversationContext.lastResults = [...(conversationContext.lastResults || []), ...results];
      
      return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
    } else {
      // Si no hay más bandejas para mostrar, verificar si ya se mostraron todas
      const [totalBandejas] = await db.query('SELECT COUNT(*) as total FROM bandejas WHERE BN_DENO IS NOT NULL AND BN_DENO != ""');
      const totalMostradas = conversationContext.lastResults ? conversationContext.lastResults.length : 0;
      
      if (totalMostradas >= totalBandejas[0].total) {
        const interpretPrompt = {
          system: `Eres un experto en horticultura y producción de semilleros. El usuario ha solicitado ver más bandejas, pero ya se han mostrado todas las disponibles.
          Tu tarea es:
          1. Informar amablemente que ya se han mostrado todas las bandejas
          2. Hacer un breve resumen de las categorías principales de bandejas mostradas
          3. Sugerir próximos pasos útiles
          4. Mantener un tono profesional y servicial
          
          IMPORTANTE:
          1. No menciones bandejas específicas nuevamente
          2. Enfócate en categorías generales (por rango de alvéolos)
          3. Sugiere preguntas específicas que el usuario podría hacer
          4. Ofrece ayuda para encontrar la bandeja más adecuada
          
          Tu respuesta debe ser útil y orientada a continuar la conversación de manera productiva.`,
          user: `Contexto anterior: ${conversationContext.lastQuery}
Bandejas ya mostradas: ${JSON.stringify(conversationContext.lastResults, null, 2)}
Pregunta actual: "${userMessage}"`,
        }
        const interpretedResponse = await sendToDeepSeek(interpretPrompt);
        return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
      } else {
        // Si hay un problema técnico, intentar mostrar todas las bandejas disponibles
        const [allResults] = await db.query(`
          SELECT * FROM bandejas 
          WHERE BN_DENO IS NOT NULL 
          AND BN_DENO != ''
          ORDER BY BN_ALV DESC
        `);
        
        if (allResults.length > 0) {
          conversationContext.lastResults = allResults;
          const interpretPrompt = {
            system: `Eres un experto en horticultura y producción de semilleros. Debido a un problema técnico, mostraremos todas las bandejas disponibles.
            Tu tarea es presentar un catálogo completo de manera organizada y profesional, considerando:
            1. Agrupar las bandejas por categorías según número de alvéolos
            2. Destacar las características principales de cada grupo
            3. Mencionar aplicaciones típicas para cada categoría
            4. Proporcionar una visión general de las opciones disponibles
            
            IMPORTANTE:
            1. Organiza la información de manera clara y estructurada
            2. Destaca las características más relevantes
            3. Menciona ventajas específicas de cada grupo
            4. Sugiere aplicaciones típicas
            5. Mantén un tono profesional y accesible
            6. Invita a preguntas específicas
            
            Tu respuesta debe ser completa y facilitar la toma de decisiones.`,
            user: `Pregunta actual: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(allResults, null, 2)}`,
          }
          const interpretedResponse = await sendToDeepSeek(interpretPrompt);
          return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
        }
      }
    }
  }

  // Si es una pregunta sobre el uso o características de una bandeja específica
  if (conversationContext.lastTopic === 'bandejas' && 
      (lowerMessage.includes("para que") || 
       lowerMessage.includes("para qué") || 
       lowerMessage.includes("uso") || 
       lowerMessage.includes("utilizar") ||
       lowerMessage.includes("funciona") ||
       lowerMessage.includes("informacion") ||
       lowerMessage.includes("información"))) {
    
    // Buscar la bandeja específica mencionada en la pregunta
    let bandejaObjetivo = null;
    const numeroAlveolosMatch = userMessage.match(/(\d+)\s*(?:alvéolos|alveolos|alvéolo|alveolo)/i);
    
    if (numeroAlveolosMatch) {
      const numAlveolos = numeroAlveolosMatch[1];
      bandejaObjetivo = conversationContext.lastResults.find(b => b.BN_ALV === numAlveolos);
    } else {
      // Si no se menciona el número de alvéolos, usar la última bandeja mencionada
      bandejaObjetivo = conversationContext.lastResults ? 
        conversationContext.lastResults[conversationContext.lastResults.length - 1] : null;
    }
    
    if (bandejaObjetivo) {
      const interpretPrompt = {
        system: `Eres un experto en horticultura y producción de semilleros. El usuario está preguntando sobre el uso de una bandeja específica.
        Tu tarea es proporcionar información detallada y experta sobre el uso de la bandeja, considerando:
        1. El número de alvéolos y su impacto en el desarrollo de las plantas
        2. El tipo de cultivo mencionado (si aplica)
        3. Las mejores prácticas de uso
        4. Ventajas y consideraciones específicas
        
        IMPORTANTE:
        1. Proporciona información técnica y práctica
        2. Incluye recomendaciones basadas en el número de alvéolos
        3. Menciona cultivos específicos que se beneficien de esta configuración
        4. Explica el impacto en el desarrollo radicular
        5. Considera el ciclo de cultivo
        6. Mantén un tono profesional pero accesible
        7. Si la bandeja es retornable, menciona las ventajas de reutilización
        8. Proporciona consejos prácticos de uso
        
        Tu respuesta debe ser completa y basada en conocimiento experto en horticultura.`,
        user: `Bandeja consultada: ${JSON.stringify(bandejaObjetivo, null, 2)}
Pregunta del usuario: "${userMessage}"
Contexto anterior: ${conversationContext.lastQuery}
Historial de bandejas mencionadas: ${JSON.stringify(conversationContext.lastResults, null, 2)}`,
      }
      const interpretedResponse = await sendToDeepSeek(interpretPrompt);
      
      // Actualizar el contexto
      conversationContext.lastQuery = userMessage;
      
      return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
    } else {
      return "No encuentro la bandeja que mencionas en nuestra conversación. ¿Podrías especificar de cuál bandeja te gustaría saber más?";
    }
  }

  return null;


};











// Función para manejar consultas sobre casas comerciales
const handleCasasComercialesQuery = async (userMessage) => {
  const lowerMessage = userMessage.toLowerCase();
  console.log("Mensaje recibido:", userMessage);

  // Verificar si es una consulta específica sobre una casa comercial del contexto anterior
  if (casasComercialesContext.lastResults.length > 0) {
    const specificQuery = lowerMessage.match(/(?:cif|telefono|teléfono|fax|email|correo|web|dirección|direccion)\s+(?:de\s+)?(.+)/i);
    if (specificQuery) {
      const nombreBuscado = specificQuery[1].toLowerCase();
      const casaEncontrada = casasComercialesContext.lastResults.find(casa => 
        casa.CC_DENO.toLowerCase().includes(nombreBuscado) || 
        (casa.CC_NOM && casa.CC_NOM.toLowerCase().includes(nombreBuscado))
      );

      if (casaEncontrada) {
        let respuesta = '';
        if (lowerMessage.includes('cif')) {
          respuesta = casaEncontrada.CC_CIF ? 
            `El CIF de ${casaEncontrada.CC_DENO} es: ${casaEncontrada.CC_CIF}` :
            `Lo siento, no tengo registrado el CIF de ${casaEncontrada.CC_DENO}.`;
        } else if (lowerMessage.includes('telefono') || lowerMessage.includes('teléfono')) {
          respuesta = casaEncontrada.CC_TEL ?
            `El teléfono de ${casaEncontrada.CC_DENO} es: ${casaEncontrada.CC_TEL}` :
            `Lo siento, no tengo registrado el teléfono de ${casaEncontrada.CC_DENO}.`;
        } else if (lowerMessage.includes('fax')) {
          respuesta = casaEncontrada.CC_FAX ?
            `El fax de ${casaEncontrada.CC_DENO} es: ${casaEncontrada.CC_FAX}` :
            `Lo siento, no tengo registrado el fax de ${casaEncontrada.CC_DENO}.`;
        } else if (lowerMessage.includes('email') || lowerMessage.includes('correo')) {
          respuesta = casaEncontrada.CC_EMA ?
            `El email de ${casaEncontrada.CC_DENO} es: ${casaEncontrada.CC_EMA}` :
            `Lo siento, no tengo registrado el email de ${casaEncontrada.CC_DENO}.`;
        } else if (lowerMessage.includes('web')) {
          respuesta = casaEncontrada.CC_WEB ?
            `La página web de ${casaEncontrada.CC_DENO} es: ${casaEncontrada.CC_WEB}` :
            `Lo siento, no tengo registrada la página web de ${casaEncontrada.CC_DENO}.`;
        } else if (lowerMessage.includes('direccion') || lowerMessage.includes('dirección')) {
          respuesta = casaEncontrada.CC_DOM ?
            `La dirección de ${casaEncontrada.CC_DENO} es: ${casaEncontrada.CC_DOM}` :
            `Lo siento, no tengo registrada la dirección de ${casaEncontrada.CC_DENO}.`;
        }
        return respuesta;
      }
    }
  }

  // Detectar si es una consulta sobre casas comerciales
  const isCasasComQuery = 
    lowerMessage.includes("casa comercial") ||
    lowerMessage.includes("casas comerciales") ||
    lowerMessage.includes("casas_com") ||
    lowerMessage.includes("proveedor principal") ||
    lowerMessage.includes("proveedores principales");

  if (!isCasasComQuery) {
    return null;
  }

  // Detectar si es una consulta por ID específico
  const idMatch = userMessage.match(/(?:id|código|codigo)\s*[:\s-]?\s*(\d{3})/i);
  if (idMatch) {
    const id = idMatch[1].padStart(3, '0'); // Asegurar que el ID tenga 3 dígitos
    const [results] = await db.query("SELECT * FROM casas_com WHERE id = ?", [id]);
    
    if (results.length > 0) {
      const casa = results[0];
      let respuesta = `Información de la casa comercial con ID ${id}:\n\n`;
      respuesta += `Denominación: ${casa.CC_DENO || "No disponible"}\n`;
      if (casa.CC_NOM && casa.CC_NOM.trim() !== "") {
        respuesta += `Nombre comercial: ${casa.CC_NOM}\n`;
      }
      respuesta += `Dirección: ${casa.CC_DOM || "No disponible"}\n`;
      respuesta += `Población: ${casa.CC_POB || "No disponible"}\n`;
      respuesta += `Provincia: ${casa.CC_PROV || "No disponible"}\n`;
      if (casa.CC_CDP && casa.CC_CDP.trim() !== "") {
        respuesta += `Código postal: ${casa.CC_CDP}\n`;
      }
      if (casa.CC_TEL && casa.CC_TEL.trim() !== "") {
        respuesta += `Teléfono: ${casa.CC_TEL}\n`;
      }
      if (casa.CC_FAX && casa.CC_FAX.trim() !== "") {
        respuesta += `Fax: ${casa.CC_FAX}\n`;
      }
      if (casa.CC_CIF && casa.CC_CIF.trim() !== "") {
        respuesta += `CIF: ${casa.CC_CIF}\n`;
      }
      if (casa.CC_EMA && casa.CC_EMA.trim() !== "") {
        respuesta += `Email: ${casa.CC_EMA}\n`;
      }
      if (casa.CC_WEB && casa.CC_WEB.trim() !== "") {
        respuesta += `Web: ${casa.CC_WEB}\n`;
      }
      if (casa.CC_PAIS && casa.CC_PAIS.trim() !== "") {
        respuesta += `País: ${casa.CC_PAIS}\n`;
      }
      return respuesta;
    } else {
      return `No encontré una casa comercial con el ID ${id}. ¿Te gustaría ver las casas comerciales disponibles?`;
    }
  }

  // Extraer el número de ejemplos si se solicita
  const cantidadMatch = userMessage.match(/(\d+)\s*(?:ejemplos|ejemplo|casas|muestra|dame|dime|listar|mostrar)/i);
  const cantidad = cantidadMatch ? Number.parseInt(cantidadMatch[1]) : 10;

  // Construir la consulta SQL base
  let query = "SELECT * FROM casas_com";
  let params = [];
  let whereConditions = [];

  // Detectar filtros específicos
  if (lowerMessage.includes("valencia") || lowerMessage.includes("barcelona") || 
      lowerMessage.includes("murcia") || lowerMessage.includes("almeria") || 
      lowerMessage.includes("alicante") || lowerMessage.includes("sevilla")) {
    const provincia = lowerMessage.match(/(?:valencia|barcelona|murcia|almeria|alicante|sevilla)/i)[0];
    whereConditions.push("UPPER(CC_PROV) LIKE ?");
    params.push(`%${provincia.toUpperCase()}%`);
  }

  if (lowerMessage.includes("email") || lowerMessage.includes("correo")) {
    whereConditions.push("CC_EMA IS NOT NULL AND CC_EMA != ''");
  }

  if (lowerMessage.includes("teléfono") || lowerMessage.includes("telefono")) {
    whereConditions.push("CC_TEL IS NOT NULL AND CC_TEL != ''");
  }

  if (lowerMessage.includes("web") || lowerMessage.includes("sitio web")) {
    whereConditions.push("CC_WEB IS NOT NULL AND CC_WEB != ''");
  }

  if (lowerMessage.includes("fax")) {
    whereConditions.push("CC_FAX IS NOT NULL AND CC_FAX != ''");
  }

  if (lowerMessage.includes("cif")) {
    whereConditions.push("CC_CIF IS NOT NULL AND CC_CIF != ''");
  }

  if (lowerMessage.includes("tarifas activas") || lowerMessage.includes("validez")) {
    whereConditions.push("(CC_DFEC IS NOT NULL OR CC_HFEC IS NOT NULL)");
  }

  if (lowerMessage.includes("código postal") || lowerMessage.includes("codigo postal")) {
    const cpMatch = userMessage.match(/(\d{5})/);
    if (cpMatch) {
      whereConditions.push("CC_CDP = ?");
      params.push(cpMatch[1]);
    }
  }

  // Agregar condiciones WHERE si existen
  if (whereConditions.length > 0) {
    query += " WHERE " + whereConditions.join(" AND ");
  }

  query += " ORDER BY CC_DENO LIMIT ?";
  params.push(cantidad);

  // Ejecutar la consulta
  const [results] = await db.query(query, params);

  if (results.length > 0) {
    // Generar un prompt para que la IA interprete los resultados
    const interpretPrompt = {
      system: `Eres un asistente experto de Semilleros Deitana. El usuario ha solicitado información sobre casas comerciales.
      Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
      
      IMPORTANTE:
      1. NO saludes si ya estás en medio de una conversación
      2. Si el usuario pidió un número específico de ejemplos, muestra EXACTAMENTE ese número
      3. Si el usuario preguntó por una provincia específica, muestra SOLO las casas comerciales de esa provincia
      4. Si no hay suficientes casas comerciales en la provincia solicitada, indica cuántas encontraste
      5. Incluye TODOS los datos disponibles de cada casa comercial (nombre, ubicación, contacto, CIF)
      6. Si hay información faltante (como email o web), no la menciones
      7. Mantén un tono profesional pero amigable
      8. Si el usuario quiere más información, invítalo a preguntar
      9. Verifica cuidadosamente la ubicación de cada casa comercial antes de responder
      10. Si una casa comercial está en el extranjero, indícalo claramente
      
      Por ejemplo, si el usuario pide casas comerciales en Valencia, asegúrate de que realmente estén en Valencia y no en otra provincia o país.`,
      user: `Pregunta original: "${userMessage}"
Cantidad solicitada: ${cantidad}
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`
    };

    const interpretedResponse = await sendToDeepSeek(interpretPrompt);
    return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
  } else {
    return `No encontré casas comerciales que coincidan con tu búsqueda. ¿Te gustaría ver las casas comerciales disponibles?`;
  }
};

// =====================================================
// SECCIÓN: RESPUESTAS ANALÍTICAS
// Esta sección maneja respuestas analíticas para diferentes tipos de consultas
// incluyendo clientes, casas comerciales, categorías, dispositivos, etc.
// =====================================================
// Modificar la función getAnalyticalResponse para mejorar el manejo de bandejas y macetas
const getAnalyticalResponse = async (userMessage, conversationContext) => {
  try {
    // Primero intentar con acciones comerciales
    const accionesResponse = await handleAccionesComQuery(userMessage);
    if (accionesResponse) {
      return accionesResponse;
    }

    // Luego intentar con proveedores
    const proveedoresResponse = await handleProveedoresQuery(userMessage);
    if (proveedoresResponse) {
      return proveedoresResponse;
    }

    // Luego intentar con bandejas
    const bandejasResponse = await handleBandejasQuery(userMessage);
    if (bandejasResponse) {
      return bandejasResponse;
    }

    // Si no es ninguna de las anteriores, intentar con la consulta SQL
    const sqlQuery = await getQueryFromIA(userMessage);
    
    // Si la respuesta es conversacional, la devolvemos directamente
    if (sqlQuery.includes("'CONVERSACIONAL'")) {
      const match = sqlQuery.match(/SELECT 'CONVERSACIONAL' as response_type, "(.*)" as message/);
      if (match && match[1]) {
        return match[1].replace(/\\n/g, "\n");
      }
    }

    // Si es una consulta SQL válida, la ejecutamos
    if (!sqlQuery.includes("'TEXT'") && !sqlQuery.includes("'No se pudo generar'")) {
      try {
        const [results] = await db.query(sqlQuery);
        
        if (results.length > 0) {
          const interpretPrompt = {
            system: `Eres un asistente experto de Semilleros Deitana. Te proporcionaré los resultados de una consulta SQL basada en la pregunta del usuario. 
            Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
            Incluye todos los datos relevantes de los resultados, pero preséntalo de forma natural y fácil de entender.`,
            user: `Pregunta original: "${userMessage}"\n\nResultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
          };

          const interpretedResponse = await sendToDeepSeek(interpretPrompt);
          return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
        } else {
          return "No encontré información que coincida con tu consulta en nuestra base de datos. ¿Podrías reformular tu pregunta?";
        }
      } catch (error) {
        console.error("Error ejecutando consulta SQL:", error);
        return "Lo siento, hubo un error al procesar tu solicitud. Por favor, intenta de nuevo.";
      }
    }

    // Si llegamos aquí, es porque la IA generó una respuesta textual
    const match = sqlQuery.match(/SELECT 'TEXT' as response_type, "(.*)" as message/);
    if (match && match[1]) {
      return match[1].replace(/\\n/g, "\n");
    }

    return "Lo siento, no pude procesar tu consulta. ¿Podrías reformularla?";
  } catch (error) {
    console.error('Error en getAnalyticalResponse:', error);
    return "Lo siento, hubo un error al procesar tu solicitud. Por favor, intenta de nuevo.";
  }
};

// Función auxiliar para obtener el nombre del mes
function obtenerNombreMes(numeroMes) {
  const meses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ]
  return meses[numeroMes - 1] || `Mes ${numeroMes}`
}

// Función para manejar consultas sobre categorías laborales
const handleCategoriasQuery = async (userMessage) => {
  const lowerMessage = userMessage.toLowerCase();
  console.log("Mensaje recibido:", userMessage);

  // Detectar si es una consulta sobre categorías
  const isCategoriasQuery = 
    lowerMessage.includes("categoría") ||
    lowerMessage.includes("categoria") ||
    lowerMessage.includes("categorías") ||
    lowerMessage.includes("categorias") ||
    lowerMessage.includes("categoría laboral") ||
    lowerMessage.includes("categoria laboral") ||
    lowerMessage.includes("salario") ||
    lowerMessage.includes("coste laboral") ||
    lowerMessage.includes("horas laborales");

  if (!isCategoriasQuery) {
    return null;
  }

  // Detectar si es una consulta por ID específico
  const idMatch = userMessage.match(/(?:id|código|codigo)\s*[:\s-]?\s*(\d{2})/i);
  if (idMatch) {
    const id = idMatch[1].padStart(2, '0');
    return await getCategoriaDetallada(id);
  }

  // Detectar si es una consulta por nombre de categoría
  const nombreMatch = userMessage.match(/(?:categoría|categoria)\s+"([^"]+)"/i);
  if (nombreMatch) {
    const nombre = nombreMatch[1];
    const [categoria] = await db.query("SELECT * FROM categorias WHERE CG_DENO LIKE ?", [`%${nombre}%`]);
    if (categoria.length > 0) {
      return await getCategoriaDetallada(categoria[0].id);
    }
  }

  // Construir la consulta SQL base
  let query = "SELECT * FROM categorias";
  let params = [];
  let whereConditions = [];

  // Detectar filtros específicos
  if (lowerMessage.includes("salario") || lowerMessage.includes("sueldo")) {
    if (lowerMessage.includes("mayor") || lowerMessage.includes("más alto")) {
      query = "SELECT * FROM categorias WHERE CG_SALDIA IS NOT NULL ORDER BY CG_SALDIA DESC LIMIT 1";
    } else if (lowerMessage.includes("mayor a") || lowerMessage.includes("más de")) {
      const valorMatch = userMessage.match(/(\d+)\s*€/);
      if (valorMatch) {
        whereConditions.push("CG_SALDIA > ?");
        params.push(valorMatch[1]);
      }
    }
  }

  if (lowerMessage.includes("dieta")) {
    if (lowerMessage.includes("mayor a") || lowerMessage.includes("más de")) {
      const valorMatch = userMessage.match(/(\d+)\s*€/);
      if (valorMatch) {
        whereConditions.push("CG_DIETA > ?");
        params.push(valorMatch[1]);
      }
    }
  }

  if (lowerMessage.includes("coste por hora")) {
    if (lowerMessage.includes("mayor") || lowerMessage.includes("más alto")) {
      query = "SELECT * FROM categorias WHERE CG_COSHOR IS NOT NULL ORDER BY CG_COSHOR DESC LIMIT 1";
    }
  }

  if (lowerMessage.includes("horas extra")) {
    if (lowerMessage.includes("sábado") || lowerMessage.includes("sabado")) {
      whereConditions.push("CG_HES IS NOT NULL");
    }
    if (lowerMessage.includes("domingo")) {
      whereConditions.push("CG_HED IS NOT NULL");
    }
  }

  if (lowerMessage.includes("horas festivas")) {
    if (lowerMessage.includes("mayor") || lowerMessage.includes("más")) {
      query = "SELECT * FROM categorias WHERE CG_HORF IS NOT NULL ORDER BY CG_HORF DESC LIMIT 1";
    }
  }

  if (lowerMessage.includes("horas por día") || lowerMessage.includes("horas diarias")) {
    if (lowerMessage.includes("más de")) {
      const valorMatch = userMessage.match(/(\d+)\s*horas/);
      if (valorMatch) {
        whereConditions.push("CG_HORL > ?");
        params.push(valorMatch[1]);
      }
    }
  }

  // Agregar condiciones WHERE si existen
  if (whereConditions.length > 0) {
    query = "SELECT * FROM categorias WHERE " + whereConditions.join(" AND ");
  }

  // Ejecutar la consulta
  const [results] = await db.query(query, params);

  if (results.length > 0) {
    // Generar un prompt para que la IA interprete los resultados
    const interpretPrompt = {
      system: `Eres un asistente experto de Semilleros Deitana. El usuario ha solicitado información sobre categorías laborales.
      Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
      
      IMPORTANTE:
      1. NO saludes si ya estás en medio de una conversación
      2. Si el usuario pidió información específica (salarios, dietas, horas), enfócate en esos datos
      3. Incluye todos los datos relevantes de cada categoría
      4. Si hay información faltante, no la menciones
      5. Mantén un tono profesional pero amigable
      6. Si el usuario quiere más información, invítalo a preguntar
      7. Si mencionas salarios o costes, incluye siempre la unidad monetaria (€)
      8. Si mencionas horas, especifica si son diarias, semanales o mensuales
      9. Si se pregunta por el mayor o menor valor, destaca ese dato específicamente
      10. Si se pregunta por comparaciones, muestra los valores relevantes para la comparación
      
      Por ejemplo, si el usuario pregunta por categorías con dieta superior a 10€, menciona el valor exacto de la dieta para cada categoría que cumpla ese criterio.`,
      user: `Pregunta original: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`
    };

    const interpretedResponse = await sendToDeepSeek(interpretPrompt);
    return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
  } else {
    return `No encontré categorías que coincidan con tu búsqueda. ¿Te gustaría ver las categorías disponibles?`;
  }
};

// Función auxiliar para obtener información detallada de una categoría
async function getCategoriaDetallada(id) {
  // Consulta principal de la categoría
  const [categoria] = await db.query("SELECT * FROM categorias WHERE id = ?", [id]);
  
  if (categoria.length > 0) {
    const cat = categoria[0];
    
    // Consultar horas mensuales
    const [horasMensuales] = await db.query(
      "SELECT * FROM categorias_cg_hormes WHERE id_categoria = ? ORDER BY anio, mes",
      [id]
    );
    
    // Consultar costes mensuales
    const [costesMensuales] = await db.query(
      "SELECT * FROM categorias_cg_cosmes WHERE id_categoria = ? ORDER BY anio, mes",
      [id]
    );
    
    // Consultar horas por día
    const [horasDia] = await db.query(
      "SELECT * FROM categorias_cg_horas WHERE id_categoria = ? ORDER BY id2",
      [id]
    );

    let respuesta = `Información de la categoría ${id}:\n\n`;
    respuesta += `Denominación: ${cat.CG_DENO || "No disponible"}\n`;
    
    if (cat.CG_SALDIA) {
      respuesta += `Salario diario: ${cat.CG_SALDIA}€\n`;
    }
    
    if (cat.CG_COSHOR) {
      respuesta += `Coste por hora: ${cat.CG_COSHOR}€\n`;
    }
    
    if (cat.CG_DIETA) {
      respuesta += `Dieta diaria: ${cat.CG_DIETA}€\n`;
    }
    
    if (cat.CG_HORL) {
      respuesta += `Horas laborales totales: ${cat.CG_HORL}\n`;
    }
    
    if (cat.CG_HORF) {
      respuesta += `Horas festivas: ${cat.CG_HORF}\n`;
    }
    
    if (cat.CG_HOREXT) {
      respuesta += `Horas extra previstas: ${cat.CG_HOREXT}\n`;
    }
    
    // Horas por día de la semana
    const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const horasDiaMap = {};
    horasDia.forEach(h => {
      horasDiaMap[h.id2] = h.valor;
    });
    
    respuesta += "\nHorario semanal:\n";
    dias.forEach((dia, index) => {
      const horas = horasDiaMap[index + 1] || 0;
      respuesta += `${dia}: ${horas}h\n`;
    });
    
    // Información mensual
    if (horasMensuales.length > 0) {
      respuesta += "\nHoras mensuales por año:\n";
      const horasPorAnio = {};
      horasMensuales.forEach(h => {
        if (!horasPorAnio[h.anio]) {
          horasPorAnio[h.anio] = [];
        }
        horasPorAnio[h.anio].push(`${h.mes}: ${h.valor}h`);
      });
      
      Object.entries(horasPorAnio).forEach(([anio, meses]) => {
        respuesta += `${anio}: ${meses.join(", ")}\n`;
      });
    }
    
    if (costesMensuales.length > 0) {
      respuesta += "\nCostes mensuales por año:\n";
      const costesPorAnio = {};
      costesMensuales.forEach(c => {
        if (!costesPorAnio[c.anio]) {
          costesPorAnio[c.anio] = [];
        }
        costesPorAnio[c.anio].push(`${c.mes}: ${c.valor}€`);
      });
      
      Object.entries(costesPorAnio).forEach(([anio, meses]) => {
        respuesta += `${anio}: ${meses.join(", ")}\n`;
      });
    }
    
    return respuesta;
  } else {
    return `No encontré una categoría con el ID ${id}. ¿Te gustaría ver las categorías disponibles?`;
  }
}

// Función para manejar consultas sobre dispositivos móviles
const handleDispositivosQuery = async (userMessage) => {
  const lowerMessage = userMessage.toLowerCase();
  console.log("Mensaje recibido:", userMessage);

  // Detectar si es una consulta sobre dispositivos
  const isDispositivosQuery = 
    lowerMessage.includes("dispositivo") ||
    lowerMessage.includes("dispositivos") ||
    lowerMessage.includes("pda") ||
    lowerMessage.includes("terminal") ||
    lowerMessage.includes("móvil") ||
    lowerMessage.includes("movil");

  if (!isDispositivosQuery) {
    return null;
  }

  // Construir la consulta SQL base con JOIN para observaciones
  let query = `
    SELECT d.*, o.C0 as UltimaObservacion
    FROM dispositivos d
    LEFT JOIN (
      SELECT id, MAX(id2) as max_id2
      FROM dispositivos_dis_obs
      GROUP BY id
    ) latest ON d.id = latest.id
    LEFT JOIN dispositivos_dis_obs o ON latest.id = o.id AND latest.max_id2 = o.id2
  `;
  let params = [];
  let whereConditions = [];

  // Detectar si es una consulta de conteo total
  const isConteoTotal = 
    lowerMessage.includes("cuantos") || 
    lowerMessage.includes("cuántos") || 
    lowerMessage.includes("total") ||
    lowerMessage.includes("cantidad");

  if (isConteoTotal) {
    // Detectar si se pregunta por dispositivos activos de una marca específica
    const marcaMatch = userMessage.match(/(?:marca)\s+"([^"]+)"/i);
    if (marcaMatch) {
      const marca = marcaMatch[1];
      const [total] = await db.query(`
        SELECT COUNT(*) as total 
        FROM dispositivos 
        WHERE DIS_BAJA = 0 AND UPPER(DIS_MARCA) = UPPER(?)
      `, [marca]);
      
      // Generar un prompt para que la IA interprete el resultado
      const interpretPrompt = {
        system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre el número de dispositivos activos de la marca ${marca}.
        Tu tarea es interpretar este resultado y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
        
        IMPORTANTE:
        1. NO saludes si ya estás en medio de una conversación
        2. Menciona el número exacto de dispositivos activos de la marca ${marca}
        3. Mantén un tono profesional pero amigable
        4. Si el usuario quiere más información, invítalo a preguntar
        5. Usa un formato natural y conversacional
        6. NO hagas referencia a datos personales del usuario
        7. NO menciones información de perfil o contacto
        8. Enfócate ÚNICAMENTE en la información de dispositivos
        
        Por ejemplo: "Actualmente tenemos X dispositivos activos de la marca ${marca} en nuestro inventario. ¿Te gustaría saber más detalles sobre alguno en particular?"`,
        user: `Pregunta original: "${userMessage}"
Resultado de la consulta SQL:\n${JSON.stringify(total[0], null, 2)}`
      };

      const interpretedResponse = await sendToDeepSeek(interpretPrompt);
      return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
    } else {
      // Consulta para obtener el conteo total
      const [total] = await db.query("SELECT COUNT(*) as total FROM dispositivos");
      const [activos] = await db.query("SELECT COUNT(*) as activos FROM dispositivos WHERE DIS_BAJA = 0");
      const [inactivos] = await db.query("SELECT COUNT(*) as inactivos FROM dispositivos WHERE DIS_BAJA = 1");
      
      // Generar un prompt para que la IA interprete el resultado
      const interpretPrompt = {
        system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre el número total de dispositivos.
        Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
        
        IMPORTANTE:
        1. NO saludes si ya estás en medio de una conversación
        2. Menciona el número exacto de dispositivos totales, activos e inactivos
        3. Mantén un tono profesional pero amigable
        4. Si el usuario quiere más información, invítalo a preguntar
        5. Usa un formato natural y conversacional
        6. NO hagas referencia a datos personales del usuario
        7. NO menciones información de perfil o contacto
        8. Enfócate ÚNICAMENTE en la información de dispositivos
        
        Por ejemplo: "Actualmente tenemos X dispositivos en el inventario, de los cuales Y están activos y Z están inactivos. ¿Te gustaría saber más detalles sobre alguno en particular?"`,
        user: `Pregunta original: "${userMessage}"
Resultados de la consulta SQL:\nTotal: ${total[0].total}\nActivos: ${activos[0].activos}\nInactivos: ${inactivos[0].inactivos}`
      };

      const interpretedResponse = await sendToDeepSeek(interpretPrompt);
      return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
    }
  }

  // Detectar filtros específicos
  if (lowerMessage.includes("activo") || lowerMessage.includes("activos")) {
    whereConditions.push("d.DIS_BAJA = 0");
  }

  if (lowerMessage.includes("inactivo") || lowerMessage.includes("inactivos") || lowerMessage.includes("baja")) {
    whereConditions.push("d.DIS_BAJA = 1");
  }

  // Filtros por marca y modelo
  if (lowerMessage.includes("marca")) {
    const marcaMatch = userMessage.match(/(?:marca)\s+"([^"]+)"/i);
    if (marcaMatch) {
      whereConditions.push("UPPER(d.DIS_MARCA) = UPPER(?)");
      params.push(marcaMatch[1]);
    }
  }

  if (lowerMessage.includes("modelo")) {
    const modeloMatch = userMessage.match(/(?:modelo)\s+"([^"]+)"/i);
    if (modeloMatch) {
      whereConditions.push("UPPER(d.DIS_MOD) = UPPER(?)");
      params.push(modeloMatch[1]);
    }
  }

  // Filtros por características técnicas
  if (lowerMessage.includes("ip") || lowerMessage.includes("dirección ip")) {
    whereConditions.push("d.DIS_IP IS NOT NULL AND d.DIS_IP != ''");
  }

  if (lowerMessage.includes("mac") || lowerMessage.includes("dirección mac")) {
    whereConditions.push("d.DIS_MAC IS NOT NULL AND d.DIS_MAC != ''");
  }

  if (lowerMessage.includes("clave") || lowerMessage.includes("dis_key")) {
    whereConditions.push("d.DIS_KEY IS NOT NULL AND d.DIS_KEY != ''");
  }

  // Filtros por observaciones
  if (lowerMessage.includes("observacion") || lowerMessage.includes("observación")) {
    if (lowerMessage.includes("sin") || lowerMessage.includes("ninguna")) {
      whereConditions.push("o.C0 IS NULL");
    } else {
      whereConditions.push("o.C0 IS NOT NULL");
    }
  }

  if (lowerMessage.includes("quemada") || lowerMessage.includes("quemado")) {
    whereConditions.push("o.C0 LIKE ?");
    params.push("%QUEMADA%");
  }

  if (lowerMessage.includes("aplicación") || lowerMessage.includes("aplicacion")) {
    whereConditions.push("o.C0 LIKE ?");
    params.push("%APLICACIÓN%");
  }

  // Filtros por denominación
  if (lowerMessage.includes("pda")) {
    whereConditions.push("d.DIS_DENO LIKE ?");
    params.push("PDA%");
  }

  // Filtros por fecha de compra
  if (lowerMessage.includes("2018")) {
    whereConditions.push("YEAR(d.DIS_FCOM) = 2018");
  }

  // Agregar condiciones WHERE si existen
  if (whereConditions.length > 0) {
    query += " WHERE " + whereConditions.join(" AND ");
  }

  // Ordenar por ID y ajustar el límite según el tipo de consulta
  let limit = 50; // Aumentamos el límite por defecto
  query += ` ORDER BY d.id LIMIT ${limit}`;

  // Ejecutar la consulta
  const [results] = await db.query(query, params);

  if (results.length > 0) {
    // Generar un prompt para que la IA interprete los resultados
    const interpretPrompt = {
      system: `Eres un asistente experto de Semilleros Deitana. El usuario ha solicitado información sobre dispositivos móviles.
      Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
      
      IMPORTANTE:
      1. NO saludes si ya estás en medio de una conversación
      2. Si el usuario pidió información específica (marca, modelo, estado, observaciones), enfócate en esos datos
      3. Incluye todos los datos relevantes de cada dispositivo
      4. Si hay información faltante, no la menciones
      5. Mantén un tono profesional pero amigable
      6. Si el usuario quiere más información, invítalo a preguntar
      7. Si un dispositivo está inactivo (DIS_BAJA = 1), indícalo claramente
      8. Si hay observaciones, inclúyelas en la descripción del dispositivo
      9. Usa el formato: "Nombre (Marca Modelo) - Estado: [observación]"
      10. Si se pregunta por una marca específica, muestra TODOS los dispositivos de esa marca
      11. Si hay muchos resultados, agrupa los dispositivos por modelo cuando sea posible
      12. Si se pregunta por características técnicas (IP, MAC, clave), destaca esa información
      13. Si se pregunta por observaciones específicas, incluye el texto exacto de la observación
      
      Por ejemplo, si se pregunta por dispositivos con IP, muestra la dirección IP de cada dispositivo.
      Si se pregunta por observaciones, incluye el texto exacto de la observación.`,
      user: `Pregunta original: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`
    };

    const interpretedResponse = await sendToDeepSeek(interpretPrompt);
    return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
  } else {
    return `No encontré dispositivos que coincidan con tu búsqueda. ¿Te gustaría ver los dispositivos disponibles?`;
  }
};

// Función auxiliar para obtener información detallada de un dispositivo
async function getDispositivoDetallado(id) {
  // Consulta principal del dispositivo
  const [dispositivo] = await db.query("SELECT * FROM dispositivos WHERE id = ?", [id]);
  
  if (dispositivo.length > 0) {
    const disp = dispositivo[0];
    
    // Consultar observaciones
    const [observaciones] = await db.query(
      "SELECT * FROM dispositivos_dis_obs WHERE id = ? ORDER BY id2",
      [id]
    );

    let respuesta = `Información del dispositivo ${id}:\n\n`;
    respuesta += `Denominación: ${disp.DIS_DENO || "No disponible"}\n`;
    respuesta += `Marca: ${disp.DIS_MARCA || "No disponible"}\n`;
    respuesta += `Modelo: ${disp.DIS_MOD || "No disponible"}\n`;
    
    if (disp.DIS_FCOM) {
      const fecha = new Date(disp.DIS_FCOM);
      respuesta += `Fecha de compra: ${fecha.toLocaleDateString()}\n`;
    }
    
    if (disp.DIS_MAC) {
      respuesta += `MAC Address: ${disp.DIS_MAC}\n`;
    }
    
    if (disp.DIS_IP) {
      respuesta += `Dirección IP: ${disp.DIS_IP}\n`;
    }
    
    if (disp.DIS_KEY) {
      respuesta += `Clave: ${disp.DIS_KEY}\n`;
    }
    
    if (disp.DIS_OBS) {
      respuesta += `Observaciones principales: ${disp.DIS_OBS}\n`;
    }
    
    respuesta += `Estado: ${disp.DIS_BAJA === 0 ? "Activo" : "Inactivo"}\n`;
    
    if (observaciones.length > 0) {
      respuesta += "\nObservaciones adicionales:\n";
      observaciones.forEach(obs => {
        respuesta += `- ${obs.C0}\n`;
      });
    }
    
    return respuesta;
  } else {
    return `No encontré un dispositivo con el ID ${id}. ¿Te gustaría ver los dispositivos disponibles?`;
  }
}

// Función para manejar consultas sobre envases de venta
const handleEnvasesVtaQuery = async (userMessage) => {
  const lowerMessage = userMessage.toLowerCase();
  console.log("Mensaje recibido:", userMessage);

  // Detectar si es una consulta sobre envases de venta
  const isEnvasesVtaQuery = 
    lowerMessage.includes("envase") ||
    lowerMessage.includes("envases") ||
    lowerMessage.includes("sobre") ||
    lowerMessage.includes("sobres") ||
    lowerMessage.includes("envases_vta") ||
    lowerMessage.includes("envases de venta");

  if (!isEnvasesVtaQuery) {
    return null;
  }

  // Detectar si es una consulta de conteo total
  const isConteoTotal = 
    lowerMessage.includes("cuantos") || 
    lowerMessage.includes("cuántos") || 
    lowerMessage.includes("total") ||
    lowerMessage.includes("cantidad");

  if (isConteoTotal) {
    // Consulta para obtener el conteo total
    const [total] = await db.query("SELECT COUNT(*) as total FROM envases_vta");
    return `Actualmente tenemos un total de ${total[0].total} envases de venta registrados en el sistema.`;
  }

  // Construir la consulta SQL base
  let query = "SELECT * FROM envases_vta";
  let params = [];
  let whereConditions = [];

  // Filtros por tipo de envase
  if (lowerMessage.includes("hortícola") || lowerMessage.includes("horticola")) {
    whereConditions.push("EV_DENO LIKE ?");
    params.push("%HORTÍCOLA%");
  }

  if (lowerMessage.includes("flor") || lowerMessage.includes("flores")) {
    whereConditions.push("EV_DENO LIKE ?");
    params.push("%FLOR%");
  }

  if (lowerMessage.includes("tubo") || lowerMessage.includes("tubos")) {
    whereConditions.push("EV_DENO LIKE ?");
    params.push("%TUBO%");
  }

  // Filtros por características específicas
  if (lowerMessage.includes("conversión") || lowerMessage.includes("conversion")) {
    whereConditions.push("EV_CONV > 0");
  }

  if (lowerMessage.includes("precio") || lowerMessage.includes("pvp")) {
    if (lowerMessage.includes("mayor") || lowerMessage.includes("más caro")) {
      query = "SELECT * FROM envases_vta WHERE EV_PVP IS NOT NULL ORDER BY EV_PVP DESC LIMIT 1";
    } else if (lowerMessage.includes("menor") || lowerMessage.includes("más barato")) {
      query = "SELECT * FROM envases_vta WHERE EV_PVP IS NOT NULL ORDER BY EV_PVP ASC LIMIT 1";
    } else if (lowerMessage.includes("mayor a") || lowerMessage.includes("más de")) {
      const precioMatch = userMessage.match(/(\d+(?:\.\d+)?)\s*€/);
      if (precioMatch) {
        whereConditions.push("EV_PVP > ?");
        params.push(precioMatch[1]);
      }
    }
  }

  if (lowerMessage.includes("cantidad") || lowerMessage.includes("uds")) {
    if (lowerMessage.includes("mayor") || lowerMessage.includes("más")) {
      const cantidadMatch = userMessage.match(/(\d+)\s*(?:unidades|uds|sobres)/i);
      if (cantidadMatch) {
        whereConditions.push("EV_CANT > ?");
        params.push(cantidadMatch[1]);
      }
    }
  }

  if (lowerMessage.includes("m²") || lowerMessage.includes("metro cuadrado")) {
    whereConditions.push("EV_EM2 IS NOT NULL AND EV_EM2 > 0");
  }

  // Filtros por observaciones/consumos
  if (lowerMessage.includes("observacion") || lowerMessage.includes("observación") || 
      lowerMessage.includes("consumo") || lowerMessage.includes("consumos")) {
    if (lowerMessage.includes("sin") || lowerMessage.includes("ninguna")) {
      whereConditions.push("EV_CONS IS NULL");
    } else {
      whereConditions.push("EV_CONS IS NOT NULL");
    }
  }

  // Agregar condiciones WHERE si existen
  if (whereConditions.length > 0) {
    query = "SELECT * FROM envases_vta WHERE " + whereConditions.join(" AND ");
  }

  // Ordenar por ID y ajustar el límite según el tipo de consulta
  let limit = 10;
  if (lowerMessage.includes("todos") || lowerMessage.includes("listar") || lowerMessage.includes("mostrar")) {
    limit = 50;
  }
  query += ` ORDER BY id LIMIT ${limit}`;

  // Ejecutar la consulta
  const [results] = await db.query(query, params);

  if (results.length > 0) {
    // Generar un prompt para que la IA interprete los resultados
    const interpretPrompt = {
      system: `Eres un asistente experto de Semilleros Deitana. El usuario ha solicitado información sobre envases de venta.
      Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
      
      IMPORTANTE:
      1. NO saludes si ya estás en medio de una conversación
      2. Si el usuario pidió información específica (precio, cantidad, tipo), enfócate en esos datos
      3. Incluye todos los datos relevantes de cada envase
      4. Si hay información faltante, no la menciones
      5. Mantén un tono profesional pero amigable
      6. Si el usuario quiere más información, invítalo a preguntar
      7. Usa el formato: "Código - Denominación (Nem.) – Cantidad sobres x Unidades por sobre – PVP: X€ – Y envases/m²"
      8. Si se pregunta por precios, incluye siempre la unidad monetaria (€)
      9. Si se pregunta por cantidades, especifica las unidades (sobres, unidades)
      10. Si se pregunta por conversión o consumos, destaca esa información
      11. Si hay muchos resultados, agrupa los envases por tipo cuando sea posible
      
      Por ejemplo, si se pregunta por sobres hortícolas, agrupa todos los que son de ese tipo.
      Si se pregunta por precios, destaca el valor del PVP.`,
      user: `Pregunta original: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`
    };

    const interpretedResponse = await sendToDeepSeek(interpretPrompt);
    return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
  } else {
    return `No encontré envases que coincidan con tu búsqueda. ¿Te gustaría ver los envases disponibles?`;
  }
};

// Variable para mantener el contexto de las casas comerciales
let casasComercialesContext = {
  lastResults: [],
  lastQuery: null
};

// Función para manejar consultas sobre invernaderos
const handleInvernaderosQuery = async (userMessage) => {
  const lowerMessage = userMessage.toLowerCase();
  console.log("Mensaje recibido:", userMessage);

  // Detectar si es una consulta sobre invernaderos
  const isInvernaderosQuery = 
    lowerMessage.includes("invernadero") ||
    lowerMessage.includes("invernaderos");

  if (!isInvernaderosQuery) {
    return null;
  }

  // Construir la consulta SQL base
  let query = "SELECT * FROM invernaderos";
  let params = [];
  let whereConditions = [];

  // Detectar si es una consulta de conteo total
  const isConteoTotal = 
    lowerMessage.includes("cuantos") || 
    lowerMessage.includes("cuántos") || 
    lowerMessage.includes("total") ||
    lowerMessage.includes("cantidad");

  if (isConteoTotal) {
    // Consulta para obtener el conteo total
    const [total] = await db.query("SELECT COUNT(*) as total FROM invernaderos");
    
    // Generar un prompt para que la IA interprete el resultado
    const interpretPrompt = {
      system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre el número total de invernaderos.
      Tu tarea es interpretar este resultado y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
      
      IMPORTANTE:
      1. NO saludes si ya estás en medio de una conversación
      2. Menciona el número exacto de invernaderos
      3. Mantén un tono profesional pero amigable
      4. Si el usuario quiere más información, invítalo a preguntar
      5. Usa un formato natural y conversacional
      6. NO hagas referencia a datos personales del usuario
      7. NO menciones información de perfil o contacto
      8. Enfócate ÚNICAMENTE en la información de invernaderos
      
      Por ejemplo: "Actualmente tenemos X invernaderos en nuestras instalaciones. ¿Te gustaría saber más detalles sobre alguno en particular?"`,
      user: `Pregunta original: "${userMessage}"
Resultado de la consulta SQL:\n${JSON.stringify(total[0], null, 2)}`
    };

    const interpretedResponse = await sendToDeepSeek(interpretPrompt);
    return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
  }

  // Filtros por características específicas
  if (lowerMessage.includes("sección") || lowerMessage.includes("seccion")) {
    if (lowerMessage.includes("más") || lowerMessage.includes("mayor")) {
      query = "SELECT * FROM invernaderos ORDER BY INV_NSEC DESC LIMIT 1";
    } else if (lowerMessage.includes("menos") || lowerMessage.includes("menor")) {
      query = "SELECT * FROM invernaderos ORDER BY INV_NSEC ASC LIMIT 1";
    }
  }

  if (lowerMessage.includes("fila") || lowerMessage.includes("filas")) {
    if (lowerMessage.includes("más") || lowerMessage.includes("mayor")) {
      query = "SELECT * FROM invernaderos ORDER BY INV_NFIL DESC LIMIT 1";
    } else if (lowerMessage.includes("menos") || lowerMessage.includes("menor")) {
      query = "SELECT * FROM invernaderos ORDER BY INV_NFIL ASC LIMIT 1";
    }
  }

  if (lowerMessage.includes("bandeja") || lowerMessage.includes("bandejas")) {
    if (lowerMessage.includes("más") || lowerMessage.includes("mayor")) {
      query = "SELECT * FROM invernaderos ORDER BY INV_NBAN DESC LIMIT 1";
    } else if (lowerMessage.includes("menos") || lowerMessage.includes("menor")) {
      query = "SELECT * FROM invernaderos ORDER BY INV_NBAN ASC LIMIT 1";
    }
  }

  // Filtros por código o nombre
  if (lowerMessage.includes("código") || lowerMessage.includes("codigo")) {
    const codigoMatch = userMessage.match(/(?:código|codigo)\s*[:\s-]?\s*([A-Za-z0-9]+)/i);
    if (codigoMatch) {
      whereConditions.push("id = ?");
      params.push(codigoMatch[1]);
    }
  }

  if (lowerMessage.includes("nombre") || lowerMessage.includes("denominación") || lowerMessage.includes("denominacion")) {
    const nombreMatch = userMessage.match(/(?:nombre|denominación|denominacion)\s*[:\s-]?\s*"([^"]+)"/i);
    if (nombreMatch) {
      whereConditions.push("INV_DENO LIKE ?");
      params.push(`%${nombreMatch[1]}%`);
    }
  }

  // Agregar condiciones WHERE si existen
  if (whereConditions.length > 0) {
    query = "SELECT * FROM invernaderos WHERE " + whereConditions.join(" AND ");
  }

  // Ordenar por ID y ajustar el límite según el tipo de consulta
  let limit = 10;
  if (lowerMessage.includes("todos") || lowerMessage.includes("listar") || lowerMessage.includes("mostrar")) {
    limit = 50;
  }
  query += ` ORDER BY id LIMIT ${limit}`;

  // Ejecutar la consulta
  const [results] = await db.query(query, params);

  if (results.length > 0) {
    // Generar un prompt para que la IA interprete los resultados
    const interpretPrompt = {
      system: `Eres un asistente experto de Semilleros Deitana. El usuario ha solicitado información sobre invernaderos.
      Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
      
      IMPORTANTE:
      1. NO saludes si ya estás en medio de una conversación
      2. Si el usuario pidió información específica (secciones, filas, bandejas), enfócate en esos datos
      3. Incluye todos los datos relevantes de cada invernadero
      4. Si hay información faltante, no la menciones
      5. Mantén un tono profesional pero amigable
      6. Si el usuario quiere más información, invítalo a preguntar
      7. Usa el formato: "Código - Denominación – Secciones: X – Filas: Y – Bandejas: Z"
      8. Si se pregunta por cantidades, especifica las unidades (secciones, filas, bandejas)
      9. Si hay muchos resultados, agrupa los invernaderos por características similares
      10. NO hagas referencia a datos personales del usuario
      11. NO menciones información de perfil o contacto
      12. Enfócate ÚNICAMENTE en la información de invernaderos
      
      
      Por ejemplo, si se pregunta por invernaderos con más secciones, destaca ese dato específicamente.
      Si se pregunta por un invernadero específico, muestra todos sus detalles relevantes.`,
      user: `Pregunta original: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`
    };

    const interpretedResponse = await sendToDeepSeek(interpretPrompt);
    return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
  } else {
    // Generar un prompt para que la IA interprete la ausencia de resultados
    const interpretPrompt = {
      system: `Eres un asistente experto de Semilleros Deitana. El usuario ha solicitado información sobre invernaderos, pero no se encontraron resultados que coincidan con su búsqueda.
      Tu tarea es responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
      
      IMPORTANTE:
      1. NO saludes si ya estás en medio de una conversación
      2. Indica amablemente que no se encontraron resultados
      3. Sugiere ver los invernaderos disponibles
      4. Mantén un tono profesional pero amigable
      5. Invita al usuario a reformular su pregunta si lo desea`,
      user: `Pregunta original: "${userMessage}"
No se encontraron resultados en la base de datos.`
    };

    const interpretedResponse = await sendToDeepSeek(interpretPrompt);
    return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
  }
};

// Función para manejar consultas sobre países
const handlePaisesQuery = async (userMessage) => {
  const lowerMessage = userMessage.toLowerCase();
  console.log("Mensaje recibido:", userMessage);

  // Detectar si es una consulta sobre países
  const isPaisesQuery = 
    lowerMessage.includes("país") ||
    lowerMessage.includes("pais") ||
    lowerMessage.includes("países") ||
    lowerMessage.includes("paises");

  if (!isPaisesQuery) {
    return null;
  }

  // Construir la consulta SQL base
  let query = "SELECT * FROM paises";
  let params = [];
  let whereConditions = [];

  // Detectar si es una consulta de conteo total
  const isConteoTotal = 
    lowerMessage.includes("cuantos") || 
    lowerMessage.includes("cuántos") || 
    lowerMessage.includes("total") ||
    lowerMessage.includes("cantidad");

  if (isConteoTotal) {
    // Consulta para obtener el conteo total
    const [total] = await db.query("SELECT COUNT(*) as total FROM paises");
    
    // Generar un prompt para que la IA interprete el resultado
    const interpretPrompt = {
      system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre el número total de países.
      Tu tarea es interpretar este resultado y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
      
      IMPORTANTE:
      1. NO saludes si ya estás en medio de una conversación
      2. Menciona el número exacto de países
      3. Mantén un tono profesional pero amigable
      4. Si el usuario quiere más información, invítalo a preguntar
      5. Usa un formato natural y conversacional
      6. NO hagas referencia a datos personales del usuario
      7. NO menciones información de perfil o contacto
      8. Enfócate ÚNICAMENTE en la información de países
      
      Por ejemplo: "Actualmente tenemos X países registrados en nuestro sistema. ¿Te gustaría saber más detalles sobre alguno en particular?"`,
      user: `Pregunta original: "${userMessage}"
Resultado de la consulta SQL:\n${JSON.stringify(total[0], null, 2)}`
    };

    const interpretedResponse = await sendToDeepSeek(interpretPrompt);
    return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
  }

  // Filtros por código o nombre
  if (lowerMessage.includes("código") || lowerMessage.includes("codigo")) {
    const codigoMatch = userMessage.match(/(?:código|codigo)\s*[:\s-]?\s*([A-Za-z0-9]+)/i);
    if (codigoMatch) {
      whereConditions.push("id = ?");
      params.push(codigoMatch[1]);
    }
  }

  if (lowerMessage.includes("nombre") || lowerMessage.includes("denominación") || lowerMessage.includes("denominacion")) {
    const nombreMatch = userMessage.match(/(?:nombre|denominación|denominacion)\s*[:\s-]?\s*"([^"]+)"/i);
    if (nombreMatch) {
      whereConditions.push("PA_DENO LIKE ?");
      params.push(`%${nombreMatch[1]}%`);
    }
  }

  // Agregar condiciones WHERE si existen
  if (whereConditions.length > 0) {
    query = "SELECT * FROM paises WHERE " + whereConditions.join(" AND ");
  }

  // Ordenar por ID y ajustar el límite según el tipo de consulta
  let limit = 10;
  if (lowerMessage.includes("todos") || lowerMessage.includes("listar") || lowerMessage.includes("mostrar")) {
    limit = 50;
  }
  query += ` ORDER BY id LIMIT ${limit}`;

  // Ejecutar la consulta
  const [results] = await db.query(query, params);

  if (results.length > 0) {
    // Generar un prompt para que la IA interprete los resultados
    const interpretPrompt = {
      system: `Eres un asistente experto de Semilleros Deitana. El usuario ha solicitado información sobre países.
      Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
      
      IMPORTANTE:
      1. NO saludes si ya estás en medio de una conversación
      2. Si el usuario pidió información específica (código, nombre), enfócate en esos datos
      3. Incluye todos los datos relevantes de cada país
      4. Si hay información faltante, no la menciones
      5. Mantén un tono profesional pero amigable
      6. Si el usuario quiere más información, invítalo a preguntar
      7. Usa el formato: "Código - Denominación"
      8. Si hay muchos resultados, agrupa los países por regiones o continentes si es posible
      9. NO hagas referencia a datos personales del usuario
      10. NO menciones información de perfil o contacto
      11. Enfócate ÚNICAMENTE en la información de países
      
      Por ejemplo, si se pregunta por un país específico, muestra todos sus detalles relevantes.
      Si se pregunta por una lista de países, organízalos de manera clara y concisa.`,
      user: `Pregunta original: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`
    };

    const interpretedResponse = await sendToDeepSeek(interpretPrompt);
    return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
  } else {
    return `No encontré países que coincidan con tu búsqueda. ¿Te gustaría ver la lista de países disponibles?`;
  }
};

// Función para manejar consultas sobre procesos
const handleProcesosQuery = async (userMessage) => {
  const lowerMessage = userMessage.toLowerCase();
  console.log("Mensaje recibido:", userMessage);

  // Detectar si es una consulta sobre procesos
  const isProcesosQuery = 
    lowerMessage.includes("proceso") ||
    lowerMessage.includes("procesos");

  if (!isProcesosQuery) {
    return null;
  }

  // Construir la consulta SQL base
  let query = "SELECT * FROM procesos";
  let params = [];
  let whereConditions = [];

  // Detectar si es una consulta de conteo total
  const isConteoTotal = 
    lowerMessage.includes("cuantos") || 
    lowerMessage.includes("cuántos") || 
    lowerMessage.includes("total") ||
    lowerMessage.includes("cantidad");

  if (isConteoTotal) {
    // Consulta para obtener el conteo total
    const [total] = await db.query("SELECT COUNT(*) as total FROM procesos");
    
    // Generar un prompt para que la IA interprete el resultado
    const interpretPrompt = {
      system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre el número total de procesos.
      Tu tarea es interpretar este resultado y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
      
      IMPORTANTE:
      1. NO saludes si ya estás en medio de una conversación
      2. Menciona el número exacto de procesos
      3. Mantén un tono profesional pero amigable
      4. Si el usuario quiere más información, invítalo a preguntar
      5. Usa un formato natural y conversacional
      6. NO hagas referencia a datos personales del usuario
      7. NO menciones información de perfil o contacto
      8. Enfócate ÚNICAMENTE en la información de procesos
      
      Por ejemplo: "Actualmente tenemos X procesos registrados en nuestro sistema. ¿Te gustaría saber más detalles sobre alguno en particular?"`,
      user: `Pregunta original: "${userMessage}"
Resultado de la consulta SQL:\n${JSON.stringify(total[0], null, 2)}`
    };

    const interpretedResponse = await sendToDeepSeek(interpretPrompt);
    return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
  }

  // Filtros por código o nombre
  if (lowerMessage.includes("código") || lowerMessage.includes("codigo") || 
      lowerMessage.includes("proceso") && /[0-9]{3}/.test(userMessage)) {
    const codigoMatch = userMessage.match(/(?:código|codigo|proceso)\s*[:\s-]?\s*([0-9]{3})/i);
    if (codigoMatch) {
      whereConditions.push("id = ?");
      params.push(codigoMatch[1]);
    }
  }

  if (lowerMessage.includes("nombre") || lowerMessage.includes("denominación") || lowerMessage.includes("denominacion")) {
    const nombreMatch = userMessage.match(/(?:nombre|denominación|denominacion)\s*[:\s-]?\s*"([^"]+)"/i);
    if (nombreMatch) {
      whereConditions.push("PRO_DENO LIKE ?");
      params.push(`%${nombreMatch[1]}%`);
    }
  }

  // Agregar condiciones WHERE si existen
  if (whereConditions.length > 0) {
    query = "SELECT * FROM procesos WHERE " + whereConditions.join(" AND ");
  }

  // Ordenar por ID y ajustar el límite según el tipo de consulta
  let limit = 10;
  if (lowerMessage.includes("todos") || lowerMessage.includes("listar") || lowerMessage.includes("mostrar")) {
    limit = 50;
  }
  query += ` ORDER BY id LIMIT ${limit}`;

  // Ejecutar la consulta
  const [results] = await db.query(query, params);

  if (results.length > 0) {
    // Para cada proceso, buscar sus observaciones
    for (let i = 0; i < results.length; i++) {
      const [observaciones] = await db.query(
        "SELECT * FROM procesos_pro_obs WHERE id = ? ORDER BY id2",
        [results[i].id]
      );
      results[i].observaciones = observaciones;
    }

    // Generar un prompt para que la IA interprete los resultados
    const interpretPrompt = {
      system: `Eres un asistente experto de Semilleros Deitana. El usuario ha solicitado información sobre procesos.
      Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
      
      IMPORTANTE:
      1. NO saludes si ya estás en medio de una conversación
      2. Si el usuario pidió información específica (código, nombre), enfócate en esos datos
      3. Incluye todos los datos relevantes de cada proceso
      4. Si hay información faltante, no la menciones
      5. Mantén un tono profesional pero amigable
      6. Si el usuario quiere más información, invítalo a preguntar
      7. Usa el formato: "Código - Denominación - Tipo: [tipo] - Modifica: [germinación/bandejas/soporte]"
      8. Si el proceso tiene observaciones, inclúyelas al final
      9. NO hagas referencia a datos personales del usuario
      10. NO menciones información de perfil o contacto
      11. Enfócate ÚNICAMENTE en la información de procesos
      
      Por ejemplo, si se pregunta por un proceso específico, muestra todos sus detalles relevantes.
      Si se pregunta por una lista de procesos, organízalos de manera clara y concisa.`,
      user: `Pregunta original: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`
    };

    const interpretedResponse = await sendToDeepSeek(interpretPrompt);
    return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
  } else {
    // Generar un prompt para que la IA interprete la ausencia de resultados
    const interpretPrompt = {
      system: `Eres un asistente experto de Semilleros Deitana. El usuario ha solicitado información sobre un proceso específico, pero no se encontró en la base de datos.
      Tu tarea es responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
      
      IMPORTANTE:
      1. NO saludes si ya estás en medio de una conversación
      2. Indica amablemente que no se encontró el proceso solicitado
      3. Sugiere ver los procesos disponibles
      4. Mantén un tono profesional pero amigable
      5. Invita al usuario a reformular su pregunta si lo desea
      6. NO hagas suposiciones sobre el rango de códigos existentes
      7. NO menciones información de perfil o contacto
      8. Enfócate ÚNICAMENTE en la información de procesos`,
      user: `Pregunta original: "${userMessage}"
No se encontró el proceso solicitado en la base de datos.`
    };

    const interpretedResponse = await sendToDeepSeek(interpretPrompt);
    return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
  }
};

const handleRutasQuery = async (userMessage) => {
  const lowerMessage = userMessage.toLowerCase();
  console.log("Mensaje recibido:", userMessage);

  // Detectar si es una consulta sobre rutas
  const isRutasQuery = 
    lowerMessage.includes("ruta") ||
    lowerMessage.includes("rutas") ||
    lowerMessage.includes("reparto") ||
    lowerMessage.includes("logística") ||
    lowerMessage.includes("porte") ||
    lowerMessage.includes("transporte");

  if (!isRutasQuery) {
    return null;
  }

  // Construir la consulta SQL base
  let query = "SELECT * FROM rutas";
  let params = [];
  let whereConditions = [];

  // Detectar si es una consulta de conteo total
  const isConteoTotal = 
    lowerMessage.includes("cuantos") || 
    lowerMessage.includes("cuántos") || 
    lowerMessage.includes("total") ||
    lowerMessage.includes("cantidad");

  if (isConteoTotal) {
    // Consulta para obtener el conteo total
    const [total] = await db.query("SELECT COUNT(*) as total FROM rutas");
    
    // Generar un prompt para que la IA interprete el resultado
    const interpretPrompt = {
      system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre el número total de rutas de reparto.
      Tu tarea es interpretar este resultado y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
      
      IMPORTANTE:
      1. NO saludes si ya estás en medio de una conversación
      2. Menciona el número exacto de rutas
      3. Mantén un tono profesional pero amigable
      4. Si el usuario quiere más información, invítalo a preguntar
      5. Usa un formato natural y conversacional
      6. NO hagas referencia a datos personales del usuario
      7. NO menciones información de perfil o contacto
      8. Enfócate ÚNICAMENTE en la información de rutas
      
      Por ejemplo: "Actualmente tenemos X rutas de reparto configuradas en nuestro sistema. ¿Te gustaría saber más detalles sobre alguna en particular?"`,
      user: `Pregunta original: "${userMessage}"
Resultado de la consulta SQL:\n${JSON.stringify(total[0], null, 2)}`
    };

    const interpretedResponse = await sendToDeepSeek(interpretPrompt);
    return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
  }

  // Filtros por código o nombre
  if (lowerMessage.includes("código") || lowerMessage.includes("codigo") || 
      lowerMessage.includes("ruta") && /[0-9]{3}/.test(userMessage)) {
    const codigoMatch = userMessage.match(/(?:código|codigo|ruta)\s*[:\s-]?\s*([0-9]{3})/i);
    if (codigoMatch) {
      whereConditions.push("id = ?");
      params.push(codigoMatch[1]);
    }
  }

  if (lowerMessage.includes("nombre") || lowerMessage.includes("denominación") || lowerMessage.includes("denominacion")) {
    const nombreMatch = userMessage.match(/(?:nombre|denominación|denominacion)\s*[:\s-]?\s*"([^"]+)"/i);
    if (nombreMatch) {
      whereConditions.push("RU_DENO LIKE ?");
      params.push(`%${nombreMatch[1]}%`);
    }
  }

  // Filtros por tipo de porte
  if (lowerMessage.includes("porte") || lowerMessage.includes("portes")) {
    if (lowerMessage.includes("sin") || lowerMessage.includes("gratis") || lowerMessage.includes("gratuito")) {
      whereConditions.push("RU_PREC = 0");
    } else if (lowerMessage.includes("con") || lowerMessage.includes("pago")) {
      whereConditions.push("RU_PREC > 0");
    }
  }

  // Filtros por precio
  if (lowerMessage.includes("precio") || lowerMessage.includes("coste")) {
    const precioMatch = userMessage.match(/(\d+(?:\.\d+)?)\s*€/);
    if (precioMatch) {
      whereConditions.push("RU_PREC = ?");
      params.push(precioMatch[1]);
    }
  }

  // Agregar condiciones WHERE si existen
  if (whereConditions.length > 0) {
    query = "SELECT * FROM rutas WHERE " + whereConditions.join(" AND ");
  }

  // Ordenar por ID y ajustar el límite según el tipo de consulta
  let limit = 10;
  if (lowerMessage.includes("todos") || lowerMessage.includes("listar") || lowerMessage.includes("mostrar")) {
    limit = 50;
  }
  query += ` ORDER BY id LIMIT ${limit}`;

  // Ejecutar la consulta
  const [results] = await db.query(query, params);

  if (results.length > 0) {
    // Generar un prompt para que la IA interprete los resultados
    const interpretPrompt = {
      system: `Eres un asistente experto de Semilleros Deitana. El usuario ha solicitado información sobre rutas de reparto.
      Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
      
      IMPORTANTE:
      1. NO saludes si ya estás en medio de una conversación
      2. Si el usuario pidió información específica (código, nombre, porte), enfócate en esos datos
      3. Incluye todos los datos relevantes de cada ruta
      4. Si hay información faltante, no la menciones
      5. Mantén un tono profesional pero amigable
      6. Si el usuario quiere más información, invítalo a preguntar
      7. Usa el formato: "Código - Denominación - Porte: [precio]€ - Tipo: [tipo]"
      8. Si la ruta tiene porte, menciona el código de artículo asociado (RU_CDAR)
      9. NO hagas referencia a datos personales del usuario
      10. NO menciones información de perfil o contacto
      11. Enfócate ÚNICAMENTE en la información de rutas
      
      Por ejemplo, si se pregunta por una ruta específica, muestra todos sus detalles relevantes.
      Si se pregunta por rutas con porte, destaca el precio y el tipo de porte.`,
      user: `Pregunta original: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`
    };

    const interpretedResponse = await sendToDeepSeek(interpretPrompt);
    return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
  } else {
    // Generar un prompt para que la IA interprete la ausencia de resultados
    const interpretPrompt = {
      system: `Eres un asistente experto de Semilleros Deitana. El usuario ha solicitado información sobre rutas de reparto, pero no se encontraron resultados que coincidan con su búsqueda.
      Tu tarea es responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
      
      IMPORTANTE:
      1. NO saludes si ya estás en medio de una conversación
      2. Indica amablemente que no se encontraron rutas que coincidan
      3. Sugiere ver las rutas disponibles
      4. Mantén un tono profesional pero amigable
      5. Invita al usuario a reformular su pregunta si lo desea
      6. NO hagas suposiciones sobre los datos
      7. NO menciones información de perfil o contacto
      8. Enfócate ÚNICAMENTE en la información de rutas`,
      user: `Pregunta original: "${userMessage}"
No se encontraron rutas que coincidan con la búsqueda en la base de datos.`
    };

    const interpretedResponse = await sendToDeepSeek(interpretPrompt);
    return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
  }
};

const handleTareasSeccionQuery = async (userMessage) => {
  const lowerMessage = userMessage.toLowerCase();
  
  // Verificar si la consulta es sobre tareas_seccion
  if (!lowerMessage.includes("tarea") && 
      !lowerMessage.includes("sección") && 
      !lowerMessage.includes("seccion") && 
      !lowerMessage.includes("actividad")) {
    return null;
  }

  // Construir la consulta base
  let query = `
    SELECT 
      id as TARS_COD,
      TARS_DENO,
      TARS_UNDM
    FROM tareas_seccion
  `;

  // Verificar si es una consulta de conteo total
  if (lowerMessage.includes("cuantos") || 
      lowerMessage.includes("cuántos") || 
      lowerMessage.includes("total") || 
      lowerMessage.includes("cantidad")) {
    const [countResults] = await db.query(`
      SELECT COUNT(*) as total FROM tareas_seccion
    `);
    
    const interpretPrompt = {
      system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre el total de tareas registradas.
      Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable.
      
      IMPORTANTE:
      1. Menciona el total de tareas registradas
      2. Explica que estas tareas representan diferentes actividades en el vivero
      3. Invita al usuario a preguntar por tareas específicas si lo desea
      4. Mantén un tono profesional y amigable`,
      user: `Pregunta original: "${userMessage}"
      Resultados de la consulta SQL:\n${JSON.stringify(countResults, null, 2)}`,
    };
    
    const interpretedResponse = await sendToDeepSeek(interpretPrompt);
    return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
  }

  // Verificar si es una consulta por código o denominación
  const codigoMatch = lowerMessage.match(/(?:tarea|sección|seccion|actividad)\s+(\d+)/i);
  const denominacionMatch = lowerMessage.match(/(?:tarea|sección|seccion|actividad)\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+)/i);

  if (codigoMatch) {
    query += ` WHERE id = ?`;
    const [results] = await db.query(query, [codigoMatch[1]]);
    
    if (results.length > 0) {
      const interpretPrompt = {
        system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre una tarea específica.
        Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable.
        
        IMPORTANTE:
        1. Menciona el código, denominación y unidad de medida de la tarea
        2. Explica brevemente qué representa esta tarea en el contexto del vivero
        3. Si hay unidad de medida, menciona en qué unidades se mide esta tarea
        4. Mantén un tono profesional y amigable`,
        user: `Pregunta original: "${userMessage}"
        Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
      };
      
      const interpretedResponse = await sendToDeepSeek(interpretPrompt);
      return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
    }
  } else if (denominacionMatch) {
    query += ` WHERE TARS_DENO LIKE ?`;
    const [results] = await db.query(query, [`%${denominacionMatch[1]}%`]);
    
    if (results.length > 0) {
      const interpretPrompt = {
        system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre tareas relacionadas con una denominación específica.
        Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable.
        
        IMPORTANTE:
        1. Lista todas las tareas encontradas con su código y denominación
        2. Si alguna tarea tiene unidad de medida, menciónala
        3. Explica brevemente qué representan estas tareas en el contexto del vivero
        4. Mantén un tono profesional y amigable`,
        user: `Pregunta original: "${userMessage}"
        Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
      };
      
      const interpretedResponse = await sendToDeepSeek(interpretPrompt);
      return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
    }
  } else {
    // Consulta general de todas las tareas
    const [results] = await db.query(query);
    
    if (results.length > 0) {
      const interpretPrompt = {
        system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre las tareas registradas.
        Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable.
        
        IMPORTANTE:
        1. Lista todas las tareas encontradas con su código y denominación
        2. Si alguna tarea tiene unidad de medida, menciónala
        3. Explica que estas tareas representan diferentes actividades en el vivero
        4. Invita al usuario a preguntar por tareas específicas si lo desea
        5. Mantén un tono profesional y amigable`,
        user: `Pregunta original: "${userMessage}"
        Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
      };
      
      const interpretedResponse = await sendToDeepSeek(interpretPrompt);
      return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
    }
  }

  return "No encontré tareas que coincidan con tu búsqueda. ¿Te gustaría ver la lista completa de tareas disponibles?";
};

const handleSectoresQuery = async (userMessage) => {
  const lowerMessage = userMessage.toLowerCase();
  
  // Verificar si la consulta es sobre sectores
  if (!lowerMessage.includes("sector") && 
      !lowerMessage.includes("subsector") && 
      !lowerMessage.includes("canal") && 
      !lowerMessage.includes("área") && 
      !lowerMessage.includes("area") && 
      !lowerMessage.includes("clasificación") && 
      !lowerMessage.includes("clasificacion")) {
    return null;
  }

  // Construir la consulta base
  let query = `
    SELECT 
      id as SC_COD,
      SC_DENO
    FROM sectores
  `;

  // Verificar si es una consulta de conteo total
  if (lowerMessage.includes("cuantos") || 
      lowerMessage.includes("cuántos") || 
      lowerMessage.includes("total") || 
      lowerMessage.includes("cantidad")) {
    const [countResults] = await db.query(`
      SELECT COUNT(*) as total FROM sectores
    `);
    
    const interpretPrompt = {
      system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre el total de sectores registrados.
      Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable.
      
      IMPORTANTE:
      1. Menciona el total de sectores registrados
      2. Explica que estos sectores representan diferentes canales de venta o áreas del negocio
      3. Invita al usuario a preguntar por sectores específicos si lo desea
      4. Mantén un tono profesional y amigable`,
      user: `Pregunta original: "${userMessage}"
      Resultados de la consulta SQL:\n${JSON.stringify(countResults, null, 2)}`,
    };
    
    const interpretedResponse = await sendToDeepSeek(interpretPrompt);
    return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
  }

  // Verificar si es una consulta por código o denominación
  const codigoMatch = lowerMessage.match(/(?:sector|subsector|canal|área|area)\s+(\d+)/i);
  const denominacionMatch = lowerMessage.match(/(?:sector|subsector|canal|área|area)\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+)/i);

  if (codigoMatch) {
    query += ` WHERE id = ?`;
    const [results] = await db.query(query, [codigoMatch[1]]);
    
    if (results.length > 0) {
      const interpretPrompt = {
        system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre un sector específico.
        Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable.
        
        IMPORTANTE:
        1. Menciona el código y denominación del sector
        2. Explica brevemente qué representa este sector en el contexto del negocio
        3. Mantén un tono profesional y amigable`,
        user: `Pregunta original: "${userMessage}"
        Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
      };
      
      const interpretedResponse = await sendToDeepSeek(interpretPrompt);
      return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
    }
  } else if (denominacionMatch) {
    query += ` WHERE SC_DENO LIKE ?`;
    const [results] = await db.query(query, [`%${denominacionMatch[1]}%`]);
    
    if (results.length > 0) {
      const interpretPrompt = {
        system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre sectores relacionados con una denominación específica.
        Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable.
        
        IMPORTANTE:
        1. Lista todos los sectores encontrados con su código y denominación
        2. Explica brevemente qué representan estos sectores en el contexto del negocio
        3. Mantén un tono profesional y amigable`,
        user: `Pregunta original: "${userMessage}"
        Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
      };
      
      const interpretedResponse = await sendToDeepSeek(interpretPrompt);
      return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
    }
  } else {
    // Consulta general de todos los sectores
    const [results] = await db.query(query);
    
    if (results.length > 0) {
      const interpretPrompt = {
        system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre los sectores registrados.
        Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable.
        
        IMPORTANTE:
        1. Lista todos los sectores encontrados con su código y denominación
        2. Explica que estos sectores representan diferentes canales de venta o áreas del negocio
        3. Invita al usuario a preguntar por sectores específicos si lo desea
        4. Mantén un tono profesional y amigable`,
        user: `Pregunta original: "${userMessage}"
        Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
      };
      
      const interpretedResponse = await sendToDeepSeek(interpretPrompt);
      return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
    }
  }

  return "No encontré sectores que coincidan con tu búsqueda. ¿Te gustaría ver la lista completa de sectores disponibles?";
};

const handleSustratosQuery = async (userMessage) => {
  const lowerMessage = userMessage.toLowerCase();
  
  // Verificar si la consulta es sobre sustratos
  if (!lowerMessage.includes("sustrato") && 
      !lowerMessage.includes("medio de cultivo") && 
      !lowerMessage.includes("mezcla de cultivo") && 
      !lowerMessage.includes("perlita") && 
      !lowerMessage.includes("turba") && 
      !lowerMessage.includes("fibra de coco")) {
    return null;
  }

  // Construir la consulta base
  let query = `
    SELECT 
      id as SUS_COD,
      SUS_DENO,
      SUS_PVP,
      SUS_COS
    FROM sustratos
  `;

  // Verificar si es una consulta de conteo total
  if (lowerMessage.includes("cuantos") || 
      lowerMessage.includes("cuántos") || 
      lowerMessage.includes("total") || 
      lowerMessage.includes("cantidad")) {
    const [countResults] = await db.query(`
      SELECT COUNT(*) as total FROM sustratos
    `);
    
    const interpretPrompt = {
      system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre el total de sustratos registrados.
      Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable.
      
      IMPORTANTE:
      1. Menciona el total de sustratos registrados
      2. Explica que los sustratos son medios de cultivo utilizados en el proceso de siembra
      3. Invita al usuario a preguntar por sustratos específicos si lo desea
      4. Mantén un tono profesional y amigable`,
      user: `Pregunta original: "${userMessage}"
      Resultados de la consulta SQL:\n${JSON.stringify(countResults, null, 2)}`,
    };
    
    const interpretedResponse = await sendToDeepSeek(interpretPrompt);
    return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
  }

  // Verificar si es una consulta por código o denominación
  const codigoMatch = lowerMessage.match(/(?:sustrato|medio de cultivo|mezcla de cultivo)\s+(\d+)/i);
  const denominacionMatch = lowerMessage.match(/(?:sustrato|medio de cultivo|mezcla de cultivo)\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+)/i);

  if (codigoMatch) {
    query += ` WHERE id = ?`;
    const [results] = await db.query(query, [codigoMatch[1]]);
    
    if (results.length > 0) {
      const interpretPrompt = {
        system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre un sustrato específico.
        Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable.
        
        IMPORTANTE:
        1. Menciona el código y denominación del sustrato
        2. Si hay precio por alveolo (SUS_PVP), menciónalo
        3. Si hay coste por alveolo (SUS_COS), menciónalo
        4. Explica brevemente qué representa este sustrato en el contexto del vivero
        5. Mantén un tono profesional y amigable`,
        user: `Pregunta original: "${userMessage}"
        Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
      };
      
      const interpretedResponse = await sendToDeepSeek(interpretPrompt);
      return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
    }
  } else if (denominacionMatch) {
    query += ` WHERE SUS_DENO LIKE ?`;
    const [results] = await db.query(query, [`%${denominacionMatch[1]}%`]);
    
    if (results.length > 0) {
      const interpretPrompt = {
        system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre sustratos relacionados con una denominación específica.
        Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable.
        
        IMPORTANTE:
        1. Lista todos los sustratos encontrados con su código y denominación
        2. Si hay precios o costes por alveolo, menciónalos
        3. Explica brevemente qué representan estos sustratos en el contexto del vivero
        4. Mantén un tono profesional y amigable`,
        user: `Pregunta original: "${userMessage}"
        Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
      };
      
      const interpretedResponse = await sendToDeepSeek(interpretPrompt);
      return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
    }
  } else {
    // Consulta general de todos los sustratos
    const [results] = await db.query(query);
    
    if (results.length > 0) {
      const interpretPrompt = {
        system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre los sustratos registrados.
        Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable.
        
        IMPORTANTE:
        1. Lista todos los sustratos encontrados con su código y denominación
        2. Si hay precios o costes por alveolo, menciónalos
        3. Explica que los sustratos son medios de cultivo utilizados en el proceso de siembra
        4. Invita al usuario a preguntar por sustratos específicos si lo desea
        5. Mantén un tono profesional y amigable`,
        user: `Pregunta original: "${userMessage}"
        Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
      };
      
      const interpretedResponse = await sendToDeepSeek(interpretPrompt);
      return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
    }
  }

  return "No encontré sustratos que coincidan con tu búsqueda. ¿Te gustaría ver la lista completa de sustratos disponibles?";
};

const handleAccionesComQuery = async (userMessage) => {
  const lowerMessage = userMessage.toLowerCase();
  
  // Si es una consulta sobre acciones comerciales
  if (lowerMessage.includes("acciones") || 
      lowerMessage.includes("incidencias") || 
      lowerMessage.includes("visitas") || 
      lowerMessage.includes("llamadas") || 
      lowerMessage.includes("negociaciones") || 
      lowerMessage.includes("seguimientos")) {
    
    // Extraer el número de acciones solicitadas
    const cantidadMatch = userMessage.match(/(\d+)\s*(?:acciones|incidencias|visitas|llamadas|negociaciones|seguimientos)/i);
    const limit = cantidadMatch ? Number.parseInt(cantidadMatch[1]) : 5;
    
    // Construir la consulta base
    let query = `
      SELECT 
        a.id,
        a.ACCO_DENO as tipo_accion,
        a.ACCO_FEC as fecha,
        a.ACCO_HOR as hora,
        c.CL_DENO as cliente,
        v.VD_DENO as vendedor,
        GROUP_CONCAT(n.C0 ORDER BY n.id2 SEPARATOR '') as nota_completa
      FROM acciones_com a
      LEFT JOIN clientes c ON a.ACCO_CDCL = c.id
      LEFT JOIN vendedores v ON a.ACCO_CDVD = v.id
      LEFT JOIN acciones_com_acco_not n ON a.id = n.id
    `;
    
    // Agregar condiciones según el tipo de consulta
    if (lowerMessage.includes("incidencias")) {
      query += ` WHERE a.ACCO_DENO LIKE '%INCIDENCIA%'`;
    } else if (lowerMessage.includes("visitas")) {
      query += ` WHERE a.ACCO_DENO LIKE '%VISITA%'`;
    } else if (lowerMessage.includes("llamadas")) {
      query += ` WHERE a.ACCO_DENO LIKE '%LLAMADA%'`;
    } else if (lowerMessage.includes("negociaciones")) {
      query += ` WHERE a.ACCO_DENO LIKE '%NEGOCIACION%'`;
    } else if (lowerMessage.includes("seguimientos")) {
      query += ` WHERE a.ACCO_DENO LIKE '%SEGUIMIENTO%'`;
    }
    
    // Si se menciona un vendedor específico
    const vendedorMatch = userMessage.match(/(?:vendedor|por)\s+([^\s]+(?:\s+[^\s]+)*)/i);
    if (vendedorMatch) {
      const vendedorNombre = vendedorMatch[1];
      query += ` AND v.VD_DENO LIKE '%${vendedorNombre}%'`;
    }
    
    // Si se menciona un cliente específico
    const clienteMatch = userMessage.match(/(?:cliente|con)\s+([^\s]+(?:\s+[^\s]+)*)/i);
    if (clienteMatch) {
      const clienteNombre = clienteMatch[1];
      query += ` AND c.CL_DENO LIKE '%${clienteNombre}%'`;
    }
    
    // Si se menciona un rango de fechas
    const fechaMatch = userMessage.match(/(?:entre|del|desde)\s+(\d{1,2})\s+(?:de\s+)?([^\s]+)\s+(?:de\s+)?(\d{4})/i);
    if (fechaMatch) {
      const dia = fechaMatch[1];
      const mes = fechaMatch[2];
      const año = fechaMatch[3];
      query += ` AND a.ACCO_FEC >= '${año}-${mes}-${dia}'`;
    }
    
    // Agrupar por acción para reconstruir las notas completas
    query += ` GROUP BY a.id, a.ACCO_DENO, a.ACCO_FEC, a.ACCO_HOR, c.CL_DENO, v.VD_DENO`;
    
    // Ordenar por fecha y hora
    query += ` ORDER BY a.ACCO_FEC DESC, a.ACCO_HOR DESC LIMIT ${limit}`;
    
    const [results] = await db.query(query);
    
    if (results.length > 0) {
      const interpretPrompt = {
        system: `Eres un experto en gestión comercial de Semilleros Deitana. El usuario ha solicitado información sobre acciones comerciales.
        Tu tarea es presentar la información de manera clara y profesional.
        
        IMPORTANTE:
        1. Para cada acción, menciona:
           - Tipo de acción
           - Fecha y hora
           - Cliente
           - Vendedor
           - Nota completa (si existe)
        2. Si hay notas, preséntalas de manera clara y legible
        3. Mantén un tono profesional
        4. Organiza la información de manera estructurada
        5. Si la nota es larga, preséntala en párrafos separados
        6. Invita a preguntas más específicas si es necesario
        
        Tu respuesta debe ser informativa y fácil de leer.`,
        user: `Pregunta actual: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
      };
      
      const interpretedResponse = await sendToDeepSeek(interpretPrompt);
      return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
    }
  }
  
  return null;
};

const handleProveedoresQuery = async (userMessage) => {
  const lowerMessage = userMessage.toLowerCase();
  
  // Si es una consulta sobre proveedores
  if (lowerMessage.includes("proveedor") || 
      lowerMessage.includes("proveedores") || 
      lowerMessage.includes("suministrador") || 
      lowerMessage.includes("suministradores")) {
    
    // Construir la consulta base
    let query = `
      SELECT 
        id,
        PR_DENO as denominacion,
        PR_DOM as domicilio,
        PR_CDP as codigo_postal,
        PR_POB as localidad,
        PR_PROV as provincia,
        PR_PAIS as pais,
        PR_TEL as telefonos,
        PR_FAX as fax,
        PR_CIF as cif,
        PR_EMA as email,
        PR_WEB as web,
        PR_ACTI as actividad,
        PR_TIPO as tipo,
        PR_OBS as observaciones,
        PR_FPG as forma_pago,
        PR_FAL as fecha_alta,
        PR_FUC as fecha_ultima_compra,
        PR_BIC as bic,
        PR_IBAN as iban,
        PR_DOMEN as domicilio_envio,
        PR_DIAS as dias_aviso
      FROM proveedores
    `;
    
    // Si se menciona una provincia específica
    const provinciaMatch = userMessage.match(/(?:provincia|de)\s+([^\s]+(?:\s+[^\s]+)*)/i);
    if (provinciaMatch) {
      const provinciaNombre = provinciaMatch[1];
      query += ` WHERE PR_PROV LIKE '%${provinciaNombre}%'`;
    }
    
    // Si se pregunta por el total de proveedores
    if (lowerMessage.includes("cuántos") || lowerMessage.includes("cuantos")) {
      query = `SELECT COUNT(*) as total FROM proveedores`;
    }
    
    // Ordenar por denominación
    if (!lowerMessage.includes("cuántos") && !lowerMessage.includes("cuantos")) {
      query += ` ORDER BY PR_DENO`;
    }
    
    const [results] = await db.query(query);
    
    if (results.length > 0) {
      const interpretPrompt = {
        system: `Eres un experto en gestión de proveedores de Semilleros Deitana. El usuario ha solicitado información sobre proveedores.
        Tu tarea es presentar la información de manera clara y profesional.
        
        IMPORTANTE:
        1. Si es un conteo de proveedores, menciona solo el número total
        2. Si es una lista de proveedores, para cada uno menciona:
           - Denominación social
           - Localidad y provincia
           - Teléfonos de contacto
           - Email principal
        3. Si hay observaciones relevantes, inclúyelas
        4. Mantén un tono profesional
        5. Organiza la información de manera clara
        6. Si hay muchos resultados, sugiere filtrar por provincia o tipo
        
        Tu respuesta debe ser informativa pero concisa.`,
        user: `Pregunta actual: "${userMessage}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
      };
      
      const interpretedResponse = await sendToDeepSeek(interpretPrompt);
      return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
    }
  }
  
  return null;
};

module.exports = { sendToDeepSeek, getQueryFromIA, getAnalyticalResponse, handleAccionesComQuery, handleProveedoresQuery }