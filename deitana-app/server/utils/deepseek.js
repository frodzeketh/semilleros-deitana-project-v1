const axios = require("axios")
const db = require("../db")
const { conversationContext } = require("../promptBase")

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

// Función para manejar consultas sobre bandejas con contexto
const handleBandejasQuery = async (userMessage) => {
  const lowerMessage = userMessage.toLowerCase();
  
  // Si hay contexto previo de bandejas y se pregunta por "la más grande"
  if (conversationContext.lastTopic === 'bandejas' && 
      (lowerMessage.includes('más grande') || 
       lowerMessage.includes('mas grande') || 
       lowerMessage.includes('mayor'))) {
    
    // Buscar la bandeja con mayor tamaño en CM
    const [results] = await db.query(`
      SELECT * FROM bandejas 
      WHERE BN_DENO LIKE '%CM%' 
      ORDER BY CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(BN_DENO, 'CM', 1), ' ', -1) AS DECIMAL(10,2)) DESC 
      LIMIT 1
    `);

    if (results.length > 0) {
      // Generar un prompt para que la IA interprete los resultados
      const interpretPrompt = {
        system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre la bandeja más grande.
        Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
        
        IMPORTANTE: 
        1. Analiza cuidadosamente el tamaño en centímetros de cada bandeja en el campo BN_DENO
        2. Compara los tamaños numéricos para identificar la más grande
        3. Si hay bandejas con el mismo tamaño, menciona todas las opciones
        4. Incluye todos los datos relevantes de los resultados, pero preséntalo de forma natural y fácil de entender
        5. Mantén el contexto de la conversación anterior sobre bandejas
        
        Por ejemplo, si en la conversación anterior se mencionaron:
        - "MACETA 25 CM" (código 028)
        - "MACETA 40 CM" (código 033)
        
        Y ahora preguntan por "la más grande", debes identificar que la de 40 cm es la más grande, no la de 25 cm.
        
        Recuerda que debes usar el contexto de la conversación anterior para dar una respuesta coherente.`,
        user: `Contexto anterior: ${conversationContext.lastQuery}
Resultados anteriores: ${JSON.stringify(conversationContext.lastResults, null, 2)}
Pregunta actual: ${userMessage}
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
      }
      const interpretedResponse = await sendToDeepSeek(interpretPrompt);
      return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
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

  return null;
};

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
      userMessage.toLowerCase().includes("categorías laborales") ||
      userMessage.toLowerCase().includes("categorias laborales") ||
      userMessage.toLowerCase().includes("salario") ||
      userMessage.toLowerCase().includes("coste laboral") ||
      userMessage.toLowerCase().includes("horas laborales")

    // Consulta para listar todas las categorías
    if (
      isCategoriasQuery &&
      (userMessage.toLowerCase().includes("información") ||
        userMessage.toLowerCase().includes("informacion") ||
        userMessage.toLowerCase().includes("todas") ||
        userMessage.toLowerCase().includes("listar") ||
        userMessage.toLowerCase().includes("mostrar") ||
        userMessage.toLowerCase().includes("dame") ||
        userMessage.toLowerCase().includes("dime"))
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

    // Consulta para listar dispositivos
    if (
      isDispositivosQuery &&
      (userMessage.toLowerCase().includes("información") ||
        userMessage.toLowerCase().includes("informacion") ||
        userMessage.toLowerCase().includes("todos") ||
        userMessage.toLowerCase().includes("listar") ||
        userMessage.toLowerCase().includes("mostrar") ||
        userMessage.toLowerCase().includes("dame") ||
        userMessage.toLowerCase().includes("dime"))
    ) {
      console.log("Ejecutando consulta para listar dispositivos")
      try {
        // Limitar la cantidad si es solicitada específicamente
        const limit = cantidadEspecifica ? cantidadEspecifica : 10

        // Esta consulta obtiene los dispositivos con su última observación si existe
        const [results] = await db.query(`
          SELECT d.id, d.DIS_DENO, d.DIS_MARCA, d.DIS_MOD, d.DIS_BAJA, o.C0 as UltimaObservacion
          FROM dispositivos d
          LEFT JOIN (
            SELECT id, MAX(id2) as max_id2
            FROM dispositivos_dis_obs
            GROUP BY id
          ) latest ON d.id = latest.id
          LEFT JOIN dispositivos_dis_obs o ON latest.id = o.id AND latest.max_id2 = o.id2
          ORDER BY d.id
          LIMIT ${limit}
        `)

        if (results.length > 0) {
          let respuesta = "Aquí tienes información sobre los dispositivos registrados:\n\n"

          results.forEach((dispositivo, index) => {
            // Determinar estado
            const estado = dispositivo.DIS_BAJA === 0 ? "Activo" : "Inactivo"

            respuesta += `${index + 1}. ${dispositivo.DIS_DENO || "Sin nombre"} (${dispositivo.DIS_MARCA || "Sin marca"} ${dispositivo.DIS_MOD || "Sin modelo"})\n`
            respuesta += `   Código: ${dispositivo.id}\n`
            respuesta += `   Estado: ${estado}\n`

            if (dispositivo.UltimaObservacion) {
              respuesta += `   Observación: ${dispositivo.UltimaObservacion}\n`
            }

            respuesta += "\n"
          })

          return respuesta
        }
      } catch (error) {
        console.error("Error al consultar dispositivos:", error)
        // Si hay un error, continuamos con el flujo normal
      }
    }

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

module.exports = { sendToDeepSeek, getQueryFromIA, getAnalyticalResponse }
