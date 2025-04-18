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
  if (lowerMessage.includes("bandeja") && 
      (lowerMessage.includes("ejemplo") || 
       lowerMessage.includes("ejemplos") || 
       lowerMessage.includes("mostrar") || 
       lowerMessage.includes("listar"))) {
    
    // Extraer el número de ejemplos solicitados
    const cantidadMatch = userMessage.match(/(\d+)\s*(?:ejemplos|ejemplo)/i);
    const limit = cantidadMatch ? Number.parseInt(cantidadMatch[1]) : 10;
    
    const [results] = await db.query(`
      SELECT * FROM bandejas 
      ORDER BY BN_ALV DESC 
      LIMIT ${limit}
    `);

    if (results.length > 0) {
      // Generar un prompt para que la IA interprete los resultados
      const interpretPrompt = {
        system: `Eres un asistente experto de Semilleros Deitana. El usuario ha solicitado ver ejemplos de bandejas.
        Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
        
        IMPORTANTE:
        1. Presenta la información de forma natural y organizada
        2. Incluye todos los datos relevantes (denominación, número de alvéolos, si es retornable, código)
        3. Si hay bandejas especiales (como las de aromáticas), destácalas
        4. Mantén un tono amigable y profesional
        5. Invita al usuario a hacer preguntas de seguimiento si lo desea
        
        Por ejemplo, si hay una bandeja con 1066 alvéolos, puedes mencionar que es una de las más grandes y explicar su uso común.
        Si hay bandejas específicas para aromáticas, puedes explicar sus características especiales.`,
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
const getAnalyticalResponse = async (userMessage) => {
  try {
    console.log("Iniciando getAnalyticalResponse para:", userMessage)
    console.log("Contexto actual:", conversationContext)

    // Intentar manejar la consulta con contexto primero
    const contextualResponse = await handleBandejasQuery(userMessage)
    if (contextualResponse) {
      return contextualResponse
    }

    // Intentar manejar consultas sobre casas comerciales
    const casasComResponse = await handleCasasComercialesQuery(userMessage);
    if (casasComResponse) {
      return casasComResponse;
    }

    // Detectar si es una consulta simple sobre clientes
    const isClientQuery =
      userMessage.toLowerCase().includes("cliente") ||
      userMessage.toLowerCase().includes("clientes") ||
      /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:los|las|unos|unas)?\s*clientes/i.test(
        userMessage,
      )

    // Detectar solicitud específica de cantidad
    const cantidadMatch = userMessage.match(/(\d+)\s+(?:ejemplo|información|informacion|datos)/i)
    const cantidadEspecifica = cantidadMatch ? Number.parseInt(cantidadMatch[1]) : null

    if (
      isClientQuery &&
      !userMessage.toLowerCase().includes("casa") &&
      !userMessage.toLowerCase().includes("comercial")
    ) {
      console.log("Detectada consulta simple sobre clientes")
      // Para consultas simples sobre clientes, delegamos al sistema existente
      return null // Retornamos null para que el sistema use el fallback tradicional
    }

    // Detectar si es una consulta múltiple (cliente y casa comercial)
    const isMultipleQuery =
      (userMessage.toLowerCase().includes("cliente") &&
        (userMessage.toLowerCase().includes("casa comercial") ||
          userMessage.toLowerCase().includes("casas comerciales"))) ||
      (userMessage.toLowerCase().includes("cliente") && userMessage.toLowerCase().includes("proveedor")) ||
      (userMessage.toLowerCase().includes("artículo") && userMessage.toLowerCase().includes("proveedor")) ||
      (userMessage.toLowerCase().includes("articulo") && userMessage.toLowerCase().includes("proveedor"))

    if (isMultipleQuery) {
      console.log("Detectada consulta múltiple")

      let respuesta = ""

      // Procesar parte de cliente
      if (userMessage.toLowerCase().includes("cliente")) {
        try {
          const [clientResults] = await db.query("SELECT * FROM clientes ORDER BY RAND() LIMIT 1")
          if (clientResults.length > 0) {
            const cliente = clientResults[0]
            respuesta += `Cliente encontrado:\n\nNombre: ${cliente.CL_DENO || "No disponible"}\n`
            respuesta += `Ubicación: ${[cliente.CL_DOM, cliente.CL_POB, cliente.CL_PROV].filter((v) => v && v !== "").join(", ") || "No disponible"}\n`
            respuesta += `Teléfono: ${cliente.CL_TEL || "No disponible"}\n`
            respuesta += `Email: ${cliente.CL_EMA || "No disponible"}\n\n`
          }
        } catch (error) {
          console.error("Error al obtener cliente aleatorio:", error)
        }
      }

      // Procesar parte de casa comercial
      if (
        userMessage.toLowerCase().includes("casa comercial") ||
        userMessage.toLowerCase().includes("casas comerciales")
      ) {
        try {
          const [ccResults] = await db.query("SELECT * FROM casas_com ORDER BY RAND() LIMIT 1")
          if (ccResults.length > 0) {
            const cc = ccResults[0]
            respuesta += `Casa comercial encontrada:\n\n`
            respuesta += `Nombre: ${cc.CC_DENO || "No disponible"}\n`
            respuesta += `ID: ${cc.id || "No disponible"}\n`
            respuesta += `Ubicación: ${[cc.CC_DOM, cc.CC_POB, cc.CC_PROV].filter((v) => v && v !== "").join(", ") || "No disponible"}\n`
            respuesta += `Teléfono: ${cc.CC_TEL || "No disponible"}\n`
            respuesta += `Email: ${cc.CC_EMA || "No disponible"}\n`
          }
        } catch (error) {
          console.error("Error al obtener casa comercial aleatoria:", error)
        }
      }

      // Procesar parte de proveedor
      if (userMessage.toLowerCase().includes("proveedor")) {
        try {
          const [provResults] = await db.query("SELECT * FROM proveedores ORDER BY RAND() LIMIT 1")
          if (provResults.length > 0) {
            const prov = provResults[0]
            respuesta += `Proveedor encontrado:\n\n`
            respuesta += `Nombre: ${prov.PR_DENO || "No disponible"}\n`
            respuesta += `Ubicación: ${[prov.PR_DOM, prov.PR_POB, prov.PR_PRO].filter((v) => v && v !== "").join(", ") || "No disponible"}\n`
            respuesta += `Teléfono: ${prov.PR_TEL || "No disponible"}\n`
            respuesta += `Email: ${prov.PR_EMA || "No disponible"}\n\n`
          }
        } catch (error) {
          console.error("Error al obtener proveedor aleatorio:", error)
        }
      }

      // Procesar parte de artículo
      if (userMessage.toLowerCase().includes("artículo") || userMessage.toLowerCase().includes("articulo")) {
        try {
          const [artResults] = await db.query(
            "SELECT a.*, p.PR_DENO as NombreProveedor FROM articulos a LEFT JOIN proveedores p ON a.AR_PRV = p.id ORDER BY RAND() LIMIT 1",
          )
          if (artResults.length > 0) {
            const art = artResults[0]
            respuesta += `Artículo encontrado:\n\n`
            respuesta += `Nombre: ${art.AR_DENO || "No disponible"}\n`
            respuesta += `Código: ${art.id || "No disponible"}\n`
            respuesta += `Referencia: ${art.AR_REF || "No disponible"}\n`
            respuesta += `Precio: ${art.AR_PVP || "No disponible"}\n`
            respuesta += `Proveedor: ${art.NombreProveedor || "No disponible"}\n`
          }
        } catch (error) {
          console.error("Error al obtener artículo aleatorio:", error)
        }
      }

      return respuesta || null
    }

    // Detectar si es una consulta sobre categorías
    const isCategoriasQuery =
      userMessage.toLowerCase().includes("categoría") ||
      userMessage.toLowerCase().includes("categoria") ||
      userMessage.toLowerCase().includes("categorías") ||
      userMessage.toLowerCase().includes("categorias") ||
      userMessage.toLowerCase().includes("categoría laboral") ||
      userMessage.toLowerCase().includes("categoria laboral") ||
      userMessage.toLowerCase().includes("salario") ||
      userMessage.toLowerCase().includes("coste laboral") ||
      userMessage.toLowerCase().includes("horas laborales")

    // Consulta para listar todas las categorías
    if (
      isCategoriasQuery &&
      (userMessage.toLowerCase().includes("información") ||
        userMessage.includes("informacion") ||
        userMessage.includes("todas") ||
        userMessage.includes("listar") ||
        userMessage.includes("mostrar") ||
        userMessage.includes("dame") ||
        userMessage.includes("dime"))
    ) {
      console.log("Ejecutando consulta para listar categorías")
      try {
        const [results] = await db.query("SELECT * FROM categorias ORDER BY id LIMIT 10")

        if (results.length > 0) {
          let respuesta = "Aquí tienes información sobre las categorías laborales disponibles:\n\n"

          results.forEach((categoria, index) => {
            respuesta += `${index + 1}. ${categoria.CG_DENO || "Sin nombre"}\n`
            if (categoria.CG_SALDIA) {
              respuesta += `   Salario diario: ${categoria.CG_SALDIA}€\n`
            }
            if (categoria.CG_COSHOR) {
              respuesta += `   Coste por hora: ${categoria.CG_COSHOR}€\n`
            }
            if (categoria.CG_DIETA) {
              respuesta += `   Dieta diaria: ${categoria.CG_DIETA}€\n`
            }
            respuesta += "\n"
          })

          respuesta +=
            "Estas categorías se utilizan para definir las condiciones contractuales y económicas de cada tipo de trabajador en la empresa."

          return respuesta
        }
      } catch (error) {
        console.error("Error al consultar categorías:", error)
        // Si hay un error, continuamos con el flujo normal
      }
    }

    // Detectar si es una consulta sobre casas comerciales
    const isCasasComQuery =
      userMessage.toLowerCase().includes("casa comercial") ||
      userMessage.toLowerCase().includes("casas comerciales") ||
      userMessage.toLowerCase().includes("casas_com") ||
      userMessage.toLowerCase().includes("proveedor principal") ||
      userMessage.toLowerCase().includes("proveedores principales")

    // Consulta para listar casas comerciales
    if (
      isCasasComQuery &&
      (userMessage.toLowerCase().includes("información") ||
        userMessage.toLowerCase().includes("informacion") ||
        userMessage.toLowerCase().includes("todas") ||
        userMessage.toLowerCase().includes("listar") ||
        userMessage.toLowerCase().includes("mostrar") ||
        userMessage.toLowerCase().includes("dame") ||
        userMessage.toLowerCase().includes("puedes") ||
        userMessage.toLowerCase().includes("dime"))
    ) {
      console.log("Ejecutando consulta para listar casas comerciales")
      try {
        // Limitar la cantidad si es solicitada específicamente
        const limit = cantidadEspecifica ? cantidadEspecifica : 10
        const [results] = await db.query(`SELECT * FROM casas_com ORDER BY id LIMIT ${limit}`)

        if (results.length > 0) {
          let respuesta = "Aquí tienes información sobre las casas comerciales con las que trabajamos:\n\n"

          results.forEach((casa, index) => {
            respuesta += `${index + 1}. ${casa.CC_DENO || "Sin nombre"}\n`
            respuesta += `   Ubicación: ${casa.CC_POB || "No disponible"}, ${casa.CC_PROV || "No disponible"}\n`
            respuesta += `   Teléfono: ${casa.CC_TEL || "No disponible"}\n`
            if (casa.CC_EMA && casa.CC_EMA.trim() !== "") {
              respuesta += `   Email: ${casa.CC_EMA}\n`
            }
            if (casa.CC_WEB && casa.CC_WEB.trim() !== "") {
              respuesta += `   Web: ${casa.CC_WEB}\n`
            }
            respuesta += "\n"
          })

          return respuesta
        }
      } catch (error) {
        console.error("Error al consultar casas comerciales:", error)
        // Si hay un error, continuamos con el flujo normal
      }
    }

    // Detectar si es una consulta sobre bandejas o macetas
    const isBandejasQuery =
      userMessage.toLowerCase().includes("bandeja") ||
      userMessage.toLowerCase().includes("alvéolo") ||
      userMessage.toLowerCase().includes("alveolo")

    const isMacetasQuery = userMessage.toLowerCase().includes("maceta") || userMessage.toLowerCase().includes("macetas")

    // Detectar si es una consulta sobre máximos/mínimos
    const isMaxQuery =
      userMessage.toLowerCase().includes("más") ||
      userMessage.toLowerCase().includes("mayor") ||
      userMessage.toLowerCase().includes("máximo") ||
      userMessage.toLowerCase().includes("maximo") ||
      userMessage.toLowerCase().includes("máximos") ||
      userMessage.toLowerCase().includes("maximos")

    const isMinQuery =
      userMessage.toLowerCase().includes("menos") ||
      userMessage.toLowerCase().includes("menor") ||
      userMessage.toLowerCase().includes("mínimo") ||
      userMessage.toLowerCase().includes("minimo")

    // Consulta específica para bandejas con más alveolos
    if (isBandejasQuery && isMaxQuery && userMessage.toLowerCase().includes("alveolo")) {
      console.log("Ejecutando consulta para bandeja con más alveolos")
      const [results] = await db.query("SELECT * FROM bandejas ORDER BY BN_ALV DESC LIMIT 1")

      if (results.length > 0) {
        const bandeja = results[0]
        const respuesta = `Actualmente, la bandeja que contiene más alvéolos es la "${bandeja.BN_DENO}" con código ${bandeja.id} y ${bandeja.BN_ALV} alvéolos. ${bandeja.BN_RET === "S" ? "Esta bandeja es retornable." : "Esta bandeja no es retornable."}`
        return respuesta
      }
    }

    // Consulta para código de bandeja específica
    if (
      isBandejasQuery &&
      userMessage.toLowerCase().includes("código") &&
      userMessage.toLowerCase().includes("alveolo")
    ) {
      console.log("Ejecutando consulta para obtener código de bandeja por alvéolos")
      // Intentamos extraer un número de alvéolos
      const alveolosMatch = userMessage.match(/(\d+)\s*(?:alvéolo|alveolo|alveolos|alvéolos)/i)
      if (alveolosMatch && alveolosMatch[1]) {
        const numAlveolos = Number.parseInt(alveolosMatch[1])
        const [results] = await db.query("SELECT * FROM bandejas WHERE BN_ALV = ? LIMIT 1", [numAlveolos])

        if (results.length > 0) {
          const bandeja = results[0]
          return `La bandeja con ${bandeja.BN_ALV} alvéolos tiene el código "${bandeja.id}" y su denominación es "${bandeja.BN_DENO}".`
        }
      } else {
        // Si no se especifica número de alvéolos, asumimos que es una consulta de seguimiento
        const [results] = await db.query("SELECT * FROM bandejas ORDER BY BN_ALV DESC LIMIT 1")
        if (results.length > 0) {
          const bandeja = results[0]
          return `El código de la bandeja con más alvéolos (${bandeja.BN_ALV}) es "${bandeja.id}" y su denominación es "${bandeja.BN_DENO}".`
        }
      }
    }

    // Consulta para listar bandejas
    if (
      isBandejasQuery &&
      (userMessage.toLowerCase().includes("información") ||
        userMessage.toLowerCase().includes("informacion") ||
        userMessage.toLowerCase().includes("todas") ||
        userMessage.toLowerCase().includes("listar") ||
        userMessage.toLowerCase().includes("mostrar") ||
        userMessage.toLowerCase().includes("ejemplo") ||
        userMessage.toLowerCase().includes("ejemplos"))
    ) {
      console.log("Ejecutando consulta para listar bandejas")
      try {
        // Limitar la cantidad si es solicitada específicamente
        const limit = cantidadEspecifica ? cantidadEspecifica : 10
        const [results] = await db.query(`SELECT * FROM bandejas ORDER BY BN_ALV DESC LIMIT ${limit}`)

        if (results.length > 0) {
          let respuesta = `Aquí tienes ${limit === 1 ? "un ejemplo de bandeja" : `${limit} ejemplos de bandejas`} en nuestro inventario:\n\n`

          results.forEach((bandeja, index) => {
            respuesta += `${index + 1}. ${bandeja.BN_DENO}: ${bandeja.BN_ALV} alvéolos${bandeja.BN_RET === "S" ? " (retornable)" : ""}, Código: ${bandeja.id}\n`
          })

          respuesta += "\nTambién contamos con diversos tamaños de macetas para diferentes necesidades de cultivo."
          return respuesta
        }
      } catch (error) {
        console.error("Error al consultar bandejas:", error)
        // Si hay un error, continuamos con el flujo normal
      }
    }

    // Consulta para listar macetas
    if (
      isMacetasQuery &&
      (userMessage.toLowerCase().includes("información") ||
        userMessage.toLowerCase().includes("informacion") ||
        userMessage.toLowerCase().includes("todas") ||
        userMessage.toLowerCase().includes("listar") ||
        userMessage.toLowerCase().includes("mostrar") ||
        userMessage.toLowerCase().includes("ejemplo") ||
        userMessage.toLowerCase().includes("ejemplos"))
    ) {
      console.log("Ejecutando consulta para listar macetas")
      try {
        // Limitar la cantidad si es solicitada específicamente
        const limit = cantidadEspecifica ? cantidadEspecifica : 5
        const [results] = await db.query(
          `SELECT * FROM bandejas WHERE BN_DENO LIKE '%MACETA%' ORDER BY id LIMIT ${limit}`,
        )

        if (results.length > 0) {
          let respuesta = `Aquí tienes ${limit === 1 ? "un ejemplo de maceta" : `${limit} ejemplos de macetas`} en nuestro inventario:\n\n`

          results.forEach((maceta, index) => {
            respuesta += `${index + 1}. ${maceta.BN_DENO}, Código: ${maceta.id}\n`
            if (maceta.BN_ALV) respuesta += `   Alvéolos: ${maceta.BN_ALV}\n`
            respuesta += `   Retornable: ${maceta.BN_RET === "S" ? "Sí" : "No"}\n\n`
          })

          return respuesta
        } else {
          // Si no encontramos resultados directos, intentamos una búsqueda más amplia
          const [results] = await db.query(
            `SELECT * FROM bandejas WHERE BN_DENO LIKE '%MACETA%' OR BN_DENO LIKE '%CM%' ORDER BY id LIMIT ${limit}`,
          )

          if (results.length > 0) {
            let respuesta = `Aquí tienes ${limit === 1 ? "un ejemplo de maceta" : `${limit} ejemplos de macetas`} en nuestro inventario:\n\n`

            results.forEach((maceta, index) => {
              respuesta += `${index + 1}. ${maceta.BN_DENO}, Código: ${maceta.id}\n`
              if (maceta.BN_ALV) respuesta += `   Alvéolos: ${maceta.BN_ALV}\n`
              respuesta += `   Retornable: ${maceta.BN_RET === "S" ? "Sí" : "No"}\n\n`
            })

            return respuesta
          }
        }
      } catch (error) {
        console.error("Error al consultar macetas:", error)
        // Si hay un error, continuamos con el flujo normal
      }
    }

    // Intentar manejar consultas sobre dispositivos
    const dispositivosResponse = await handleDispositivosQuery(userMessage);
    if (dispositivosResponse) {
      return dispositivosResponse;
    }

    // Detectar si es una consulta sobre dispositivos
    const isDispositivosQuery =
      userMessage.toLowerCase().includes("dispositivo") ||
      userMessage.toLowerCase().includes("dispositivos") ||
      userMessage.toLowerCase().includes("pda") ||
      userMessage.toLowerCase().includes("pdas") ||
      userMessage.toLowerCase().includes("móvil") ||
      userMessage.toLowerCase().includes("móviles") ||
      userMessage.toLowerCase().includes("movil") ||
      userMessage.toLowerCase().includes("moviles") ||
      userMessage.toLowerCase().includes("terminal") ||
      userMessage.toLowerCase().includes("terminales")

    // Consulta para dispositivo específico por código o nombre
    if (
      isDispositivosQuery &&
      (userMessage.toLowerCase().includes("información") ||
        userMessage.toLowerCase().includes("informacion") ||
        userMessage.toLowerCase().includes("detalle") ||
        userMessage.toLowerCase().includes("datos") ||
        userMessage.toLowerCase().includes("código") ||
        userMessage.toLowerCase().includes("codigo") ||
        userMessage.toLowerCase().includes("pda"))
    ) {
      console.log("Ejecutando consulta para dispositivo específico")

      // Intentar extraer un código de dispositivo o nombre
      const codigoMatch = userMessage.match(/(?:código|codigo|id)\s*[:\s-]?\s*(\d+)/i)
      const pdaMatch = userMessage.match(/(?:pda|dispositivo)\s*[:\s-]?\s*(\d+|\w+)/i)

      let codigoDispositivo = ""
      if (codigoMatch && codigoMatch[1]) {
        codigoDispositivo = codigoMatch[1]
      } else if (pdaMatch && pdaMatch[1]) {
        codigoDispositivo = pdaMatch[1]
      }

      if (codigoDispositivo) {
        try {
          // Consultar información completa del dispositivo
          const [resultados] = await db.query(
            `
            SELECT d.*, o.id2, o.C0 as Observacion
            FROM dispositivos d
            LEFT JOIN dispositivos_dis_obs o ON d.id = o.id
            WHERE d.id = ? OR d.DIS_DENO LIKE ?
            ORDER BY o.id2
          `,
            [codigoDispositivo, `%${codigoDispositivo}%`],
          )

          if (resultados.length > 0) {
            // El primer resultado contiene los datos principales del dispositivo
            const dispositivo = resultados[0]

            // Determinar estado
            const estado = dispositivo.DIS_BAJA === 0 ? "Activo" : "Inactivo"

            let respuesta = `Información del dispositivo ${dispositivo.DIS_DENO}:\n\n`
            respuesta += `Código: ${dispositivo.id}\n`
            respuesta += `Denominación: ${dispositivo.DIS_DENO || "No disponible"}\n`
            respuesta += `Marca: ${dispositivo.DIS_MARCA || "No disponible"}\n`
            respuesta += `Modelo: ${dispositivo.DIS_MOD || "No disponible"}\n`

            if (dispositivo.DIS_FCOM) {
              // Formatear fecha de compra si existe
              const fecha = new Date(dispositivo.DIS_FCOM)
              respuesta += `Fecha de compra: ${fecha.toLocaleDateString()}\n`
            }

            if (dispositivo.DIS_MAC) respuesta += `MAC Address: ${dispositivo.DIS_MAC}\n`
            if (dispositivo.DIS_IP) respuesta += `Dirección IP: ${dispositivo.DIS_IP}\n`
            respuesta += `Estado: ${estado}\n`

            // Procesar observaciones si existen
            if (resultados.some((r) => r.Observacion)) {
              respuesta += `\nObservaciones:\n`
              resultados.forEach((r) => {
                if (r.Observacion) {
                  respuesta += `- ${r.Observacion}\n`
                }
              })
            }

            return respuesta
          }
        } catch (error) {
          console.error("Error al consultar dispositivo específico:", error)
          // Continuamos con el flujo normal
        }
      }
    }

    // Si no es una consulta específica que podamos manejar directamente,
    // generamos una consulta SQL con la IA y la ejecutamos
    try {
      console.log("Generando consulta SQL con IA")
      const sqlQuery = await getQueryFromIA(userMessage)
      console.log("Consulta SQL generada:", sqlQuery)

      // Si la respuesta es conversacional, la devolvemos directamente
      if (sqlQuery.includes("'CONVERSACIONAL'")) {
        const match = sqlQuery.match(/SELECT 'CONVERSACIONAL' as response_type, "(.*)" as message/)
        if (match && match[1]) {
          return match[1].replace(/\\n/g, "\n")
        }
      }

      // Si es una consulta SQL válida, la ejecutamos
      if (!sqlQuery.includes("'TEXT'") && !sqlQuery.includes("'No se pudo generar'")) {
        try {
          console.log("Ejecutando consulta SQL:", sqlQuery)
          const [results] = await db.query(sqlQuery)
          console.log("Resultados obtenidos:", results.length)

          // Si tenemos resultados, formateamos una respuesta amigable
          if (results.length > 0) {
            // Generar un prompt para que la IA interprete los resultados
            const interpretPrompt = {
              system: `Eres un asistente experto de Semilleros Deitana. Te proporcionaré los resultados de una consulta SQL basada en la pregunta del usuario. 
              Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
              Incluye todos los datos relevantes de los resultados, pero preséntalo de forma natural y fácil de entender.`,
              user: `Pregunta original: "${userMessage}"\n\nResultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
            }

            console.log("Interpretando resultados con IA")
            const interpretedResponse = await sendToDeepSeek(interpretPrompt)
            return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "")
          } else {
            return "No encontré información que coincida con tu consulta en nuestra base de datos. ¿Podrías reformular tu pregunta?"
          }
        } catch (error) {
          console.error("Error ejecutando consulta SQL:", error)
          // Si hay un error en la ejecución de la consulta, retornamos null para usar el fallback
          return null
        }
      }

      // Si llegamos aquí, es porque la IA generó una respuesta textual
      const match = sqlQuery.match(/SELECT 'TEXT' as response_type, "(.*)" as message/)
      if (match && match[1]) {
        return match[1].replace(/\\n/g, "\n")
      }
    } catch (error) {
      console.error("Error al generar o ejecutar consulta SQL:", error)
      // Si hay un error, retornamos null para usar el fallback
      return null
    }

    // Actualizar el contexto después de cada consulta exitosa
    if (isBandejasQuery) {
      conversationContext.lastTopic = 'bandejas';
      conversationContext.lastQuery = userMessage;
    }

    // Si llegamos aquí, significa que no pudimos manejar la consulta específicamente
    console.log("No se pudo manejar la consulta analíticamente, delegando al sistema tradicional")
    return null // Retornamos null para que el sistema use el fallback tradicional
  } catch (error) {
    console.error("Error general en getAnalyticalResponse:", error)
    // En caso de error, retornamos null para que el sistema use el fallback tradicional
    return null
  }
}

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

  // Detectar si es una consulta de conteo total
  const isConteoTotal = 
    lowerMessage.includes("cuantos") || 
    lowerMessage.includes("cuántos") || 
    lowerMessage.includes("total") ||
    lowerMessage.includes("cantidad");

  if (isConteoTotal) {
    // Consulta para obtener el conteo total
    const [total] = await db.query("SELECT COUNT(*) as total FROM dispositivos");
    const [activos] = await db.query("SELECT COUNT(*) as activos FROM dispositivos WHERE DIS_BAJA = 0");
    const [inactivos] = await db.query("SELECT COUNT(*) as inactivos FROM dispositivos WHERE DIS_BAJA = 1");
    
    return `Actualmente tenemos un total de ${total[0].total} dispositivos móviles en el inventario:\n` +
           `- Dispositivos activos: ${activos[0].activos}\n` +
           `- Dispositivos inactivos: ${inactivos[0].inactivos}`;
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

module.exports = { sendToDeepSeek, getQueryFromIA, getAnalyticalResponse }