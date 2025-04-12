const express = require("express")
const cors = require("cors")
const mysql = require("mysql2/promise")
const axios = require("axios")
const dotenv = require("dotenv")
const fs = require("fs")
const promptBase = require("./promptBase")

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const port = process.env.PORT || 3001

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
})

// Almacén simple para mantener el contexto de las conversaciones
const conversationContexts = new Map()

// Añadir esta variable global para almacenar los últimos clientes mostrados
let ultimosClientesMostrados = []

// Función para procesar datos de un cliente usando los nombres de columna reales
function procesarDatosCliente(fila, campos, userPrompt) {
  const cliente = {}
  campos.forEach((key, idx) => {
    // Guardamos todos los valores, incluso los vacíos
    cliente[key] = fila[idx]
  })

  // Claves relevantes en tu base
  const nombre = cliente["CL_DENO"] || "No disponible"
  const nombreComercial = cliente["CL_NOM"] || ""
  const direccion = cliente["CL_DOM"] || "No disponible"
  const ciudad = cliente["CL_POB"] || "No disponible"
  const provincia = cliente["CL_PROV"] || "No disponible"
  const cp = cliente["CL_CDP"] || "No disponible"
  const telefono = cliente["CL_TEL"] || "No disponible"
  const email = cliente["CL_EMA"] || "No disponible"
  const cif = cliente["CL_CIF"] || "No disponible"
  const fax = cliente["CL_FAX"] || "No disponible"
  const web = cliente["CL_WEB"] || "No disponible"
  const pais = cliente["CL_PAIS"] || "No disponible"

  // Estado del cliente (activo/inactivo)
  const situacion = cliente["CL_SIT"] || ""
  const estadoCliente = situacion.toUpperCase() === "ACTIVO" ? "Activo" : "De baja"

  const lowerPrompt = userPrompt.toLowerCase()
  const quiereMasInfo =
    lowerPrompt.includes("todo") || lowerPrompt.includes("más información") || lowerPrompt.includes("completo")

  // Verificar si la pregunta es sobre el estado del cliente
  if (
    lowerPrompt.includes("activo") ||
    lowerPrompt.includes("estado") ||
    lowerPrompt.includes("situación") ||
    lowerPrompt.includes("situacion") ||
    lowerPrompt.includes("de baja") ||
    lowerPrompt.includes("dado de baja")
  ) {
    return `Estado del cliente ${nombre}: ${estadoCliente}`
  }

  if (quiereMasInfo) {
    // Devolver todos los campos disponibles que no sean vacíos
    const detalles = Object.entries(cliente)
      .filter(([_, v]) => v !== null && v.toString().trim() !== "" && v !== "0" && v !== 0 && v !== "0.00")
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n")
    return `Información completa del cliente:\n\n${detalles}`
  } else {
    // Verificar si la consulta es específica sobre algún campo
    const campoEspecifico =
      lowerPrompt.includes("email") ||
      lowerPrompt.includes("correo") ||
      lowerPrompt.includes("teléfono") ||
      lowerPrompt.includes("telefono") ||
      lowerPrompt.includes("cif") ||
      lowerPrompt.includes("dirección") ||
      lowerPrompt.includes("direccion") ||
      lowerPrompt.includes("provincia") ||
      lowerPrompt.includes("código postal") ||
      lowerPrompt.includes("codigo postal") ||
      lowerPrompt.includes("cp") ||
      lowerPrompt.includes("fax") ||
      lowerPrompt.includes("web") ||
      lowerPrompt.includes("sitio web") ||
      lowerPrompt.includes("país") ||
      lowerPrompt.includes("pais")

    // Si es una consulta específica, mostrar solo ese campo
    if (campoEspecifico) {
      let respuesta = `Información del cliente ${nombre}:\n\n`

      if (lowerPrompt.includes("email") || lowerPrompt.includes("correo")) {
        respuesta += `Email: ${email}\n`
      }

      if (lowerPrompt.includes("teléfono") || lowerPrompt.includes("telefono")) {
        respuesta += `Teléfono: ${telefono}\n`
      }

      if (lowerPrompt.includes("cif")) {
        respuesta += `CIF: ${cif}\n`
      }

      if (lowerPrompt.includes("dirección") || lowerPrompt.includes("direccion")) {
        respuesta += `Dirección: ${direccion}\n`
      }

      if (lowerPrompt.includes("provincia")) {
        respuesta += `Provincia: ${provincia}\n`
      }

      if (
        lowerPrompt.includes("código postal") ||
        lowerPrompt.includes("codigo postal") ||
        lowerPrompt.includes("cp")
      ) {
        respuesta += `Código Postal: ${cp}\n`
      }

      if (lowerPrompt.includes("fax")) {
        respuesta += `Fax: ${fax}\n`
      }

      if (lowerPrompt.includes("web") || lowerPrompt.includes("sitio web")) {
        respuesta += `Web: ${web}\n`
      }

      if (lowerPrompt.includes("país") || lowerPrompt.includes("pais")) {
        respuesta += `País: ${pais}\n`
      }

      respuesta += "\n¿Necesitas más información (teléfono, CIF, etc.)?"
      return respuesta
    } else {
      // Mostrar información general
      const ubicacion = [direccion, ciudad, provincia, cp].filter((v) => v !== "No disponible").join(", ")

      let respuesta = `Cliente encontrado:\n\nNombre: ${nombre}\n`

      if (nombreComercial && nombreComercial !== nombre) {
        respuesta += `Nombre comercial: ${nombreComercial}\n`
      }

      respuesta += `Ubicación: ${ubicacion || "No disponible"}\n`
      respuesta += `Teléfono: ${telefono}\n`
      respuesta += `Email: ${email}\n`
      respuesta += `CIF: ${cif}\n`
      respuesta += `Estado: ${estadoCliente}\n`

      respuesta += "\n¿Necesitas más información?"
      return respuesta
    }
  }
}

// Función para buscar un cliente por nombre con búsqueda flexible
async function buscarClientePorNombre(nombre) {
  try {
    // Primero intentamos una búsqueda exacta
    let [results, fields] = await pool.query("SELECT * FROM clientes WHERE CL_DENO = ? OR CL_NOM = ? LIMIT 1", [
      nombre,
      nombre,
    ])

    // Si no hay resultados, intentamos con LIKE
    if (results.length === 0) {
      ;[results, fields] = await pool.query("SELECT * FROM clientes WHERE CL_DENO LIKE ? OR CL_NOM LIKE ? LIMIT 1", [
        `%${nombre}%`,
        `%${nombre}%`,
      ])
    }

    // Si aún no hay resultados, intentamos con una búsqueda más flexible
    if (results.length === 0) {
      const palabras = nombre.split(" ").filter((p) => p.length > 2)
      if (palabras.length > 0) {
        const condiciones = palabras.map((p) => `CL_DENO LIKE ? OR CL_NOM LIKE ?`).join(" OR ")
        const parametros = []
        palabras.forEach((p) => {
          parametros.push(`%${p}%`)
          parametros.push(`%${p}%`)
        })[
          // Corregido: Asignar correctamente el resultado de la consulta
          (results, fields)
        ] = await pool.query(`SELECT * FROM clientes WHERE ${condiciones} LIMIT 1`, parametros)
      }
    }

    return { results, fields }
  } catch (error) {
    console.error("Error al buscar cliente:", error)
    return { results: [], fields: [] }
  }
}

// Modificar la función obtenerListaClientes para que sea más inteligente
async function obtenerListaClientes(cantidad, filtroActivos = false, mostrarEstado = false) {
  try {
    let query = "SELECT CL_DENO, CL_POB, CL_SIT, CL_CIF FROM clientes"

    if (filtroActivos) {
      query += " WHERE CL_SIT = 'ACTIVO'"
    }

    query += ` LIMIT ${cantidad}`

    console.log("Ejecutando consulta para lista de clientes:", query)
    const [results] = await pool.query(query)

    if (results.length === 0) {
      return "No se encontraron clientes que cumplan con los criterios."
    }

    // Formatear los resultados de forma concisa
    const formatted = results
      .map((row, i) => {
        // Solo incluir el estado si se solicita específicamente
        if (mostrarEstado) {
          const estado = row.CL_SIT && row.CL_SIT.toUpperCase() === "ACTIVO" ? "Activo" : "De baja"
          return `${i + 1}. ${row.CL_DENO} - ${row.CL_POB || "Sin localidad"} (${estado})`
        } else {
          return `${i + 1}. ${row.CL_DENO} - ${row.CL_POB || "Sin localidad"}`
        }
      })
      .join("\n")

    // Guardar los resultados en una variable global para consultas de seguimiento
    ultimosClientesMostrados = results

    return formatted
  } catch (error) {
    console.error("Error al obtener lista de clientes:", error)
    return "Error al obtener la lista de clientes."
  }
}

// Implementación completa de la función fallbackClientes
async function fallbackClientes(userMessage) {
  // Detectar si es una solicitud de lista de clientes
  const esListaClientes =
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:una\s+lista\s+de\s+)?(\d+)?\s*clientes/i.test(
      userMessage,
    ) ||
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:los|las|unos|unas)\s+(\d+)?\s*clientes/i.test(
      userMessage,
    )

  const esClientesActivos = /clientes\s+activos/i.test(userMessage)

  // Extraer el número de clientes solicitados
  const cantidadMatch = userMessage.match(/(\d+)\s*clientes/i)
  const cantidad = cantidadMatch ? Number.parseInt(cantidadMatch[1]) : 5 // Por defecto 5 si no se especifica

  if (esListaClientes) {
    return await obtenerListaClientes(cantidad, esClientesActivos)
  }

  // Extraer posible nombre de cliente
  const clienteRegex =
    /(?:cliente|información|informacion|datos|email|correo|teléfono|telefono|cif|dirección|direccion|provincia|localidad|ciudad)\s+(?:de|sobre|del|para|acerca)\s+(?:la empresa|empresa|cliente)?\s*([A-Za-z0-9\s.]+)/i
  const clienteMatch = userMessage.match(clienteRegex)

  let clienteNombre = ""
  if (clienteMatch && clienteMatch[1]) {
    clienteNombre = clienteMatch[1].trim()
  } else {
    // Buscar cualquier nombre que pueda ser un cliente (palabras en mayúsculas o con puntos)
    const posibleClienteRegex = /([A-Z][A-Za-z0-9\s.-]+(?:\s+S\.?(?:COOP|L|A|C\.?V|R\.?L))?)/g
    const posiblesClientes = [...userMessage.matchAll(posibleClienteRegex)]
    if (posiblesClientes.length > 0) {
      // Tomar el nombre más largo como posible cliente
      clienteNombre = posiblesClientes
        .reduce((prev, current) => (prev[0].length > current[0].length ? prev : current))[0]
        .trim()
    }
  }

  if (clienteNombre) {
    const { results, fields } = await buscarClientePorNombre(clienteNombre)

    if (results.length > 0 && fields) {
      const campos = fields.map((f) => f.name)
      const fila = Object.values(results[0])
      return procesarDatosCliente(fila, campos, userMessage)
    }
  }

  // Si no se encontró un cliente específico o no hay resultados, buscar varios clientes
  const match = userMessage.match(/(\d+)\s*clientes/i)
  const cantidadClientes = match ? Number.parseInt(match[1]) : 5 // Si no se encuentra, usar 5 por defecto

  // Si es una solicitud de lista de clientes, usar la función especializada
  if (userMessage.toLowerCase().includes("clientes")) {
    return await obtenerListaClientes(cantidadClientes, userMessage.toLowerCase().includes("activos"))
  }

  // Si no, ejecutar la consulta genérica
  const fallbackSQL = `SELECT * FROM clientes LIMIT ${cantidadClientes}`
  const [results, fields] = await pool.query(fallbackSQL)

  if (results.length === 0) {
    return "No se encontraron resultados en la consulta de respaldo."
  }

  if (results.length === 1 && fields.some((f) => f.name.includes("CL_"))) {
    const campos = fields.map((f) => f.name)
    const fila = Object.values(results[0])
    return procesarDatosCliente(fila, campos, userMessage)
  }

  // Formatear resultados de forma concisa para listas de clientes
  const formatted = results
    .map((row, i) => {
      const nombre = row.CL_DENO || "Cliente sin nombre"
      const localidad = row.CL_POB || "Sin localidad"
      const estado = row.CL_SIT && row.CL_SIT.toUpperCase() === "ACTIVO" ? "Activo" : "De baja"
      return `${i + 1}. ${nombre} - ${localidad} (${estado})`
    })
    .join("\n")

  return `Aquí tienes los clientes solicitados:\n\n${formatted}`
}

// Modificar la función app.post("/chat"...) para incluir detección de intenciones
app.post("/chat", async (req, res) => {
  const { message } = req.body
  // Obtener o crear un ID de sesión
  const sessionId = req.headers["session-id"] || "default-session"

  // Obtener el contexto de la conversación o crear uno nuevo
  if (!conversationContexts.has(sessionId)) {
    conversationContexts.set(sessionId, {
      lastClientName: null,
      lastClientData: null,
      lastQuery: null,
      conversationHistory: [],
    })
  }

  const context = conversationContexts.get(sessionId)

  // Guardar el mensaje en el historial de conversación
  context.conversationHistory.push({
    role: "user",
    content: message,
  })

  console.log("Mensaje recibido:", message)

  // Detectar la intención del mensaje
  const intent = detectIntent(message, context)
  console.log("Intención detectada:", intent)

  // Manejar diferentes tipos de intenciones
  switch (intent) {
    case "greeting":
      return res.json({
        response: getGreetingResponse(),
      })

    case "farewell":
      return res.json({
        response: getFarewellResponse(),
      })

    case "gratitude":
      return res.json({
        response: getGratitudeResponse(),
      })

    case "smalltalk":
      return res.json({
        response: getSmallTalkResponse(message),
      })

    case "client_list":
      // Continuar con la lógica existente para listar clientes
      try {
        // Extraer el número de clientes solicitados
        const cantidadMatch = message.match(/(\d+)\s*clientes/i)
        const numClientes = cantidadMatch ? Number.parseInt(cantidadMatch[1]) : 5 // Por defecto 5 si no se especifica

        const esClientesActivos = /clientes\s+activos/i.test(message)
        const pideEstado = /estado|activo|de baja|situación|situacion/i.test(message)

        // Solo mostrar el estado si se pide específicamente o si se piden clientes activos
        const mostrarEstado = pideEstado || esClientesActivos
        const listaClientes = await obtenerListaClientes(numClientes, esClientesActivos, mostrarEstado)

        // Limpiar el contexto ya que estamos cambiando de tema
        context.lastClientName = null
        context.lastClientData = null

        let respuesta
        if (esClientesActivos) {
          respuesta = `Aquí tienes los clientes activos solicitados:\n\n${listaClientes}`
        } else {
          respuesta = `Aquí tienes los clientes solicitados:\n\n${listaClientes}`
        }

        // Guardar la respuesta en el historial
        context.conversationHistory.push({
          role: "assistant",
          content: respuesta,
        })

        return res.json({ response: respuesta })
      } catch (error) {
        console.error("Error al procesar lista de clientes:", error)
        return res.json({
          response: "Hubo un error al obtener la lista de clientes. Por favor, intenta de nuevo.",
        })
      }

    case "client_query":
      // Extraer posible nombre de cliente del mensaje
      const clienteRegex =
        /(?:cliente|información|informacion|datos|email|correo|teléfono|telefono|cif|dirección|direccion|provincia|localidad|ciudad)\s+(?:de|sobre|del|para|acerca)\s+(?:la empresa|empresa|cliente)?\s*([A-Za-z0-9\s.]+)/i
      const clienteMatch = message.match(clienteRegex)

      let clienteNombre = ""
      if (clienteMatch && clienteMatch[1]) {
        clienteNombre = clienteMatch[1].trim()
      } else {
        // Buscar cualquier nombre que pueda ser un cliente (palabras en mayúsculas o con puntos)
        const posibleClienteRegex = /([A-Z][A-Za-z0-9\s.-]+(?:\s+S\.?(?:COOP|L|A|C\.?V|R\.?L))?)/g
        const posiblesClientes = [...message.matchAll(posibleClienteRegex)]
        if (posiblesClientes.length > 0) {
          // Tomar el nombre más largo como posible cliente
          clienteNombre = posiblesClientes
            .reduce((prev, current) => (prev[0].length > current[0].length ? prev : current))[0]
            .trim()
        }
      }

      try {
        if (clienteNombre) {
          console.log(`Buscando cliente: "${clienteNombre}"`)
          const { results, fields } = await buscarClientePorNombre(clienteNombre)

          if (results.length > 0 && fields) {
            const campos = fields.map((f) => f.name)
            const fila = Object.values(results[0])

            // Crear un objeto con los datos del cliente
            const clienteData = {}
            campos.forEach((key, idx) => {
              clienteData[key] = fila[idx]
            })

            // Guardar el nombre del cliente y sus datos en el contexto
            context.lastClientName = clienteData["CL_DENO"] || clienteNombre
            context.lastClientData = clienteData

            const respuesta = procesarDatosCliente(fila, campos, message)

            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: respuesta,
            })

            return res.json({ response: respuesta })
          } else {
            const respuesta = `No he podido encontrar información sobre el cliente "${clienteNombre}". ¿Podrías verificar el nombre o proporcionarme más detalles?`

            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: respuesta,
            })

            return res.json({ response: respuesta })
          }
        }
      } catch (error) {
        console.error("Error al buscar cliente:", error)
        return res.json({
          response: "Hubo un error al buscar la información del cliente. Por favor, intenta de nuevo.",
        })
      }
      break

    case "followup_query":
      // Verificar si es una pregunta de seguimiento sobre el último cliente
      if (context.lastClientData) {
        const clienteData = context.lastClientData

        // Filtrar solo los campos solicitados o devolver todos si pide "todo"
        let respuesta = ""

        if (message.toLowerCase().includes("todo") || message.toLowerCase().includes("completo")) {
          // Devolver todos los campos disponibles
          const detalles = Object.entries(clienteData)
            .filter(([_, v]) => v !== null && v.toString().trim() !== "" && v !== "0" && v !== 0 && v !== "0.00")
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n")
          respuesta = `Información completa del cliente ${context.lastClientName}:\n\n${detalles}`
        } else if (
          message.toLowerCase().includes("activo") ||
          message.toLowerCase().includes("estado") ||
          message.toLowerCase().includes("situación") ||
          message.toLowerCase().includes("situacion") ||
          message.toLowerCase().includes("de baja") ||
          message.toLowerCase().includes("dado de baja")
        ) {
          // Verificar estado del cliente
          const situacion = clienteData["CL_SIT"] || ""
          const estadoCliente = situacion.toUpperCase() === "ACTIVO" ? "Activo" : "De baja"
          respuesta = `Estado del cliente ${context.lastClientName}: ${estadoCliente}`
        } else {
          // Construir respuesta con los campos específicos solicitados
          respuesta = `Información adicional para ${context.lastClientName}:\n\n`
          let camposEncontrados = false

          if (message.toLowerCase().includes("cif")) {
            const valor = clienteData["CL_CIF"]
            respuesta += `CIF: ${valor && valor !== "0" && valor !== "0.00" ? valor : "No disponible"}\n`
            camposEncontrados = true
          }

          if (message.toLowerCase().includes("teléfono") || message.toLowerCase().includes("telefono")) {
            const valor = clienteData["CL_TEL"]
            respuesta += `Teléfono: ${valor && valor !== "0" && valor !== "0.00" ? valor : "No disponible"}\n`
            camposEncontrados = true
          }

          if (message.toLowerCase().includes("email") || message.toLowerCase().includes("correo")) {
            const valor = clienteData["CL_EMA"]
            respuesta += `Email: ${valor && valor !== "0" && valor !== "0.00" ? valor : "No disponible"}\n`
            camposEncontrados = true
          }

          if (message.toLowerCase().includes("dirección") || message.toLowerCase().includes("direccion")) {
            const valor = clienteData["CL_DOM"]
            respuesta += `Dirección: ${valor && valor !== "0" && valor !== "0.00" ? valor : "No disponible"}\n`
            camposEncontrados = true
          }

          if (
            message.toLowerCase().includes("código postal") ||
            message.toLowerCase().includes("codigo postal") ||
            message.toLowerCase().includes("cp")
          ) {
            const valor = clienteData["CL_CDP"]
            respuesta += `Código Postal: ${valor && valor !== "0" && valor !== "0.00" ? valor : "No disponible"}\n`
            camposEncontrados = true
          }

          if (message.toLowerCase().includes("provincia")) {
            const valor = clienteData["CL_PROV"]
            respuesta += `Provincia: ${valor && valor !== "0" && valor !== "0.00" ? valor : "No disponible"}\n`
            camposEncontrados = true
          }

          if (
            message.toLowerCase().includes("localidad") ||
            message.toLowerCase().includes("ciudad") ||
            message.toLowerCase().includes("población") ||
            message.toLowerCase().includes("poblacion")
          ) {
            const valor = clienteData["CL_POB"]
            respuesta += `Localidad: ${valor && valor !== "0" && valor !== "0.00" ? valor : "No disponible"}\n`
            camposEncontrados = true
          }

          if (message.toLowerCase().includes("fax")) {
            const valor = clienteData["CL_FAX"]
            respuesta += `Fax: ${valor && valor !== "0" && valor !== "0.00" ? valor : "No disponible"}\n`
            camposEncontrados = true
          }

          if (
            message.toLowerCase().includes("web") ||
            message.toLowerCase().includes("sitio web") ||
            message.toLowerCase().includes("página web") ||
            message.toLowerCase().includes("pagina web")
          ) {
            const valor = clienteData["CL_WEB"]
            respuesta += `Web: ${valor && valor !== "0" && valor !== "0.00" ? valor : "No disponible"}\n`
            camposEncontrados = true
          }

          if (message.toLowerCase().includes("país") || message.toLowerCase().includes("pais")) {
            const valor = clienteData["CL_PAIS"]
            respuesta += `País: ${valor && valor !== "0" && valor !== "0.00" ? valor : "No disponible"}\n`
            camposEncontrados = true
          }

          // Si no se encontró ningún campo específico solicitado
          if (!camposEncontrados) {
            respuesta = `No se encontró la información solicitada para ${context.lastClientName}. ¿Qué información específica necesitas?`
          }
        }

        // Guardar la respuesta en el historial
        context.conversationHistory.push({
          role: "assistant",
          content: respuesta,
        })

        return res.json({ response: respuesta })
      }
      break

    case "list_followup":
      // Detectar si es una pregunta sobre los clientes mostrados anteriormente
      if (ultimosClientesMostrados.length > 0) {
        console.log("Procesando pregunta sobre la lista anterior de clientes")

        // Determinar qué información se está solicitando
        const pideActivos = /activo|activos|estado/i.test(message)
        const pideLocalidades = /localidad|localidades|ubicación|ubicacion|donde/i.test(message)
        const pideCIF = /cif|identificación|identificacion|fiscal/i.test(message)

        let respuesta = ""

        if (pideActivos) {
          const clientesActivos = ultimosClientesMostrados.filter(
            (cliente) => cliente.CL_SIT && cliente.CL_SIT.toUpperCase() === "ACTIVO",
          )

          if (clientesActivos.length === 0) {
            respuesta = "Ninguno de los clientes mostrados está activo."
          } else {
            respuesta = `Los siguientes clientes están activos:\n\n${clientesActivos
              .map((cliente, i) => `${i + 1}. ${cliente.CL_DENO} - ${cliente.CL_POB || "Sin localidad"}`)
              .join("\n")}`
          }
        } else if (pideLocalidades) {
          respuesta = `Localidades de los clientes mostrados:\n\n${ultimosClientesMostrados
            .map((cliente, i) => `${i + 1}. ${cliente.CL_DENO}: ${cliente.CL_POB || "Sin localidad"}`)
            .join("\n")}`
        } else if (pideCIF) {
          respuesta = `CIF de los clientes mostrados:\n\n${ultimosClientesMostrados
            .map((cliente, i) => `${i + 1}. ${cliente.CL_DENO}: ${cliente.CL_CIF || "No disponible"}`)
            .join("\n")}`
        } else {
          respuesta = "¿Qué información específica necesitas sobre los clientes que te mostré anteriormente?"
        }

        // Guardar la respuesta en el historial
        context.conversationHistory.push({
          role: "assistant",
          content: respuesta,
        })

        return res.json({ response: respuesta })
      }
      break

    case "database_query":
    default:
      // Si llegamos aquí, intentamos procesar como una consulta de base de datos genérica
      try {
        // Cargar el schema desde schema.json
        const schema = JSON.parse(fs.readFileSync("schema.json", "utf8"))
        const prompt = promptBase(message, schema)

        // Si no es una pregunta de seguimiento o no tenemos datos del cliente, procedemos normalmente
        const response = await axios.post(
          "https://api.deepseek.com/v1/chat/completions",
          {
            model: "deepseek-chat",
            messages: [
              { role: "system", content: prompt.system },
              { role: "user", content: prompt.user },
            ],
            temperature: 0.3,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
            },
          },
        )

        const fullResponse = response.data.choices[0]?.message?.content?.trim()
        console.log("Respuesta de la IA:\n", fullResponse)

        // Verificar si la respuesta indica que es conversacional
        if (fullResponse.startsWith("CONVERSACIONAL:")) {
          const respuestaConversacional = fullResponse.replace("CONVERSACIONAL:", "").trim()

          // Guardar la respuesta en el historial
          context.conversationHistory.push({
            role: "assistant",
            content: respuestaConversacional,
          })

          return res.json({ response: respuestaConversacional })
        }

        // Extraer la consulta SQL del bloque markdown si existe
        const match = fullResponse.match(/```sql\s*([\s\S]*?)```/i)
        const sql = match ? match[1].trim() : fullResponse

        if (!sql.toLowerCase().startsWith("select")) {
          const respuesta = "Lo siento, solo puedo ejecutar consultas SELECT por seguridad."

          // Guardar la respuesta en el historial
          context.conversationHistory.push({
            role: "assistant",
            content: respuesta,
          })

          return res.json({ response: respuesta })
        }

        // Guardar la última consulta en el contexto
        context.lastQuery = sql

        const [results, fields] = await pool.query(sql)

        // Si no se encontraron resultados, y la consulta era de clientes, usar fallback
        if (results.length === 0) {
          // Si el mensaje contiene "cliente" o un nombre que parece ser un cliente, usar fallback
          if (message.toLowerCase().includes("cliente") || clienteNombre) {
            const fallbackResponse = await fallbackClientes(message)

            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: fallbackResponse,
            })

            return res.json({ response: fallbackResponse })
          }

          const respuesta = "No se encontraron resultados para tu consulta."

          // Guardar la respuesta en el historial
          context.conversationHistory.push({
            role: "assistant",
            content: respuesta,
          })

          return res.json({ response: respuesta })
        }

        // Si hay un solo resultado y parece ser de clientes
        if (results.length === 1 && fields.some((f) => f.name.includes("CL_"))) {
          const campos = fields.map((f) => f.name)
          const fila = Object.values(results[0])

          // Crear un objeto con los datos del cliente
          const clienteData = {}
          campos.forEach((key, idx) => {
            clienteData[key] = fila[idx]
          })

          // Guardar el nombre del cliente y sus datos en el contexto
          context.lastClientName = clienteData["CL_DENO"] || "Cliente"
          context.lastClientData = clienteData

          const respuesta = procesarDatosCliente(fila, campos, message)

          // Guardar la respuesta en el historial
          context.conversationHistory.push({
            role: "assistant",
            content: respuesta,
          })

          return res.json({ response: respuesta })
        }

        // Si hay varios resultados o no es de clientes, formatearlos de forma genérica
        // Resetear el contexto del cliente ya que no estamos hablando de un cliente específico
        context.lastClientName = null
        context.lastClientData = null

        // Si la consulta parece ser sobre una lista de clientes, formatear de manera concisa
        if (
          message.toLowerCase().includes("clientes") &&
          results.length > 1 &&
          fields.some((f) => f.name === "CL_DENO" || f.name === "CL_POB" || f.name === "CL_SIT")
        ) {
          const formatted = results
            .map((row, i) => {
              const nombre = row.CL_DENO || "Cliente sin nombre"
              const localidad = row.CL_POB || "Sin localidad"
              const estado = row.CL_SIT && row.CL_SIT.toUpperCase() === "ACTIVO" ? "Activo" : "De baja"
              return `${i + 1}. ${nombre} - ${localidad} (${estado})`
            })
            .join("\n")

          const respuesta = `Aquí tienes los clientes solicitados:\n\n${formatted}`

          // Guardar la respuesta en el historial
          context.conversationHistory.push({
            role: "assistant",
            content: respuesta,
          })

          return res.json({ response: respuesta })
        } else {
          // Para otros tipos de consultas, usar el formato genérico
          const formatted = results
            .map((row, i) => {
              const line = Object.entries(row)
                .filter(([_, v]) => v !== null && v.toString().trim() !== "" && v !== "0" && v !== 0)
                .map(([key, value]) => `${key}: ${value}`)
                .join(" | ")
              return `${i + 1} - ${line}`
            })
            .join("\n")

          // Guardar la respuesta en el historial
          context.conversationHistory.push({
            role: "assistant",
            content: formatted,
          })

          return res.json({ response: formatted })
        }
      } catch (error) {
        console.error("Error:", error.message)

        // Si no podemos procesar como consulta de base de datos, responder de forma genérica
        const respuesta =
          "No estoy seguro de cómo responder a eso. ¿Podrías reformular tu pregunta o especificar qué información necesitas de la base de datos?"

        // Guardar la respuesta en el historial
        context.conversationHistory.push({
          role: "assistant",
          content: respuesta,
        })

        return res.json({ response: respuesta })
      }
  }
})

// Función para detectar la intención del mensaje
function detectIntent(message, context) {
  const lowerMessage = message.toLowerCase().trim()

  // Detectar saludos
  if (/^(hola|buenos días|buenas tardes|buenas noches|saludos|hey|hi|hello)(\s|$)/i.test(lowerMessage)) {
    return "greeting"
  }

  // Detectar despedidas
  if (/^(adiós|chao|hasta luego|hasta pronto|nos vemos|bye|goodbye)(\s|$)/i.test(lowerMessage)) {
    return "farewell"
  }

  // Detectar agradecimientos
  if (/^(gracias|muchas gracias|te lo agradezco|thanks|thank you)(\s|$)/i.test(lowerMessage)) {
    return "gratitude"
  }

  // Detectar solicitud de lista de clientes
  const esListaClientes =
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:una\s+lista\s+de\s+)?(\d+)?\s*clientes/i.test(
      message,
    ) ||
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:los|las|unos|unas)\s+(\d+)?\s*clientes/i.test(
      message,
    )

  if (esListaClientes) {
    return "client_list"
  }

  // Detectar consulta sobre cliente específico
  const clienteRegex =
    /(?:cliente|información|informacion|datos|email|correo|teléfono|telefono|cif|dirección|direccion|provincia|localidad|ciudad)\s+(?:de|sobre|del|para|acerca)\s+(?:la empresa|empresa|cliente)?\s*([A-Za-z0-9\s.]+)/i
  const clienteMatch = message.match(clienteRegex)

  if (clienteMatch && clienteMatch[1]) {
    return "client_query"
  }

  // Detectar si es una pregunta de seguimiento sobre el último cliente
  const isFollowUpQuestion =
    context.lastClientName &&
    (lowerMessage.includes("cif") ||
      lowerMessage.includes("teléfono") ||
      lowerMessage.includes("telefono") ||
      lowerMessage.includes("más información") ||
      lowerMessage.includes("mas informacion") ||
      lowerMessage.includes("email") ||
      lowerMessage.includes("correo") ||
      lowerMessage.includes("dirección") ||
      lowerMessage.includes("direccion") ||
      lowerMessage.includes("todo") ||
      lowerMessage.includes("completo") ||
      lowerMessage.includes("código postal") ||
      lowerMessage.includes("codigo postal") ||
      lowerMessage.includes("cp") ||
      lowerMessage.includes("provincia") ||
      lowerMessage.includes("localidad") ||
      lowerMessage.includes("ciudad") ||
      lowerMessage.includes("población") ||
      lowerMessage.includes("poblacion") ||
      lowerMessage.includes("fax") ||
      lowerMessage.includes("web") ||
      lowerMessage.includes("sitio web") ||
      lowerMessage.includes("página web") ||
      lowerMessage.includes("pagina web") ||
      lowerMessage.includes("país") ||
      lowerMessage.includes("pais") ||
      lowerMessage.includes("activo") ||
      lowerMessage.includes("estado") ||
      lowerMessage.includes("situación") ||
      lowerMessage.includes("situacion") ||
      lowerMessage.includes("de baja") ||
      lowerMessage.includes("dado de baja"))

  if (isFollowUpQuestion) {
    return "followup_query"
  }

  // Detectar si es una pregunta sobre los clientes mostrados anteriormente
  const esPreguntaSobreListaAnterior =
    ultimosClientesMostrados.length > 0 &&
    /cuál|cual|cuales|cuáles|qué|que|quién|quien|cuantos|cuántos|dime|muestra|lista/i.test(message) &&
    /activo|activos|estado|baja|localidad|localidades|cif|dirección|direccion|teléfono|telefono/i.test(message)

  if (esPreguntaSobreListaAnterior) {
    return "list_followup"
  }

  // Detectar small talk (conversación casual)
  if (
    lowerMessage.length < 15 &&
    !/cliente|artículo|articulo|producto|stock|inventario|factura|pedido|venta|compra/i.test(lowerMessage)
  ) {
    return "smalltalk"
  }

  // Si no se detecta ninguna intención específica, asumir que es una consulta de base de datos
  return "database_query"
}

// Añadir después de la función detectIntent, antes de las funciones de respuesta

// Función para manejar consultas sobre tablas específicas
async function consultarTablaEspecifica(tableName, cantidad = 1) {
  try {
    // Validar el nombre de la tabla para evitar inyección SQL
    // Solo permitir nombres de tabla que contengan caracteres alfanuméricos, guiones y guiones bajos
    if (!tableName.match(/^[a-zA-Z0-9_-]+$/)) {
      return `Nombre de tabla inválido: ${tableName}`
    }

    // Manejar tablas con guiones en el nombre
    let queryTableName = tableName
    if (tableName.includes("-")) {
      queryTableName = "`" + tableName + "`"
    }

    const query = `SELECT * FROM ${queryTableName} LIMIT ${cantidad}`
    console.log(`Ejecutando consulta: ${query}`)

    const [results, fields] = await pool.query(query)

    if (results.length === 0) {
      return `No se encontraron registros en la tabla ${tableName}.`
    }

    // Formatear los resultados
    let respuesta = `Información de la tabla ${tableName}:\n\n`

    // Añadir encabezados de columnas
    if (fields && fields.length > 0) {
      respuesta += "Columnas: " + fields.map((f) => f.name).join(", ") + "\n\n"
    }

    // Añadir datos
    results.forEach((row, index) => {
      respuesta += `Registro ${index + 1}:\n`
      Object.entries(row).forEach(([key, value]) => {
        // Solo mostrar valores que no sean nulos o vacíos
        if (value !== null && value !== "") {
          respuesta += `${key}: ${value}\n`
        }
      })
      respuesta += "\n"
    })

    return respuesta
  } catch (error) {
    console.error(`Error al consultar tabla ${tableName}:`, error)
    return `Error al consultar la tabla ${tableName}: ${error.message}`
  }
}

// Modificar la función detectIntent para añadir detección de consultas de tablas específicas
function detectIntent(message, context) {
  const lowerMessage = message.toLowerCase().trim()

  // Detectar saludos
  if (/^(hola|buenos días|buenas tardes|buenas noches|saludos|hey|hi|hello)(\s|$)/i.test(lowerMessage)) {
    return "greeting"
  }

  // Detectar despedidas
  if (/^(adiós|chao|hasta luego|hasta pronto|nos vemos|bye|goodbye)(\s|$)/i.test(lowerMessage)) {
    return "farewell"
  }

  // Detectar agradecimientos
  if (/^(gracias|muchas gracias|te lo agradezco|thanks|thank you)(\s|$)/i.test(lowerMessage)) {
    return "gratitude"
  }

  // Detectar consulta de tabla específica
  // Patrones como "dime 1 acciones_com_acco_not" o "muestra 5 registros de bancos"
  const tablaEspecificaRegex =
    /(?:dime|muestra|dame|consulta|obtén|obtener|ver|mostrar)\s+(\d+)?\s+(?:registros?\s+de\s+)?([a-zA-Z0-9_-]+)$/i
  const tablaMatch = message.match(tablaEspecificaRegex)

  if (tablaMatch) {
    return "specific_table"
  }

  // Detectar solicitud de lista de clientes
  const esListaClientes =
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:una\s+lista\s+de\s+)?(\d+)?\s*clientes/i.test(
      message,
    ) ||
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:los|las|unos|unas)\s+(\d+)?\s*clientes/i.test(
      message,
    )

  if (esListaClientes) {
    return "client_list"
  }

  // Resto del código de detección de intenciones...
  // [Mantener el código existente]

  // Si no se detecta ninguna intención específica, asumir que es una consulta de base de datos
  return "database_query"
}

// Modificar la función app.post("/chat"...) para incluir el manejo de consultas de tablas específicas
// Añadir un nuevo case en el switch de intenciones, justo después del case "greeting":

// En el switch de intenciones, añadir este case después de "greeting":
app.post('/chat', async (req, res) => {
    const { message, type, context } = req.body;
  
    switch (type) {
      case "specific_table":
        try {
          // Regex para extraer cantidad y nombre de tabla
          const tablaEspecificaRegex = 
            /(?:dime|muestra|dame|consulta|obtén|obtener|ver|mostrar)\s+(\d+)?\s+(?:registros?\s+de\s+)?([a-zA-Z0-9_-]+)$/i;
          const tablaMatch = message.match(tablaEspecificaRegex);
  
          if (tablaMatch) {
            const cantidad = tablaMatch[1] ? parseInt(tablaMatch[1]) : 1;
            const nombreTabla = tablaMatch[2];
  
            // Validar que el nombre de la tabla no esté vacío
            if (!nombreTabla) {
              throw new Error("Nombre de tabla no especificado");
            }
  
            // Ejecutar función que consulta la tabla (debes tenerla implementada)
            const respuesta = await consultarTablaEspecifica(nombreTabla, cantidad);
  
            // Guardar respuesta en el historial si tenés contexto
            if (context?.conversationHistory) {
              context.conversationHistory.push({
                role: "assistant",
                content: respuesta,
              });
            }
  
            return res.json({ response: respuesta });
  
          } else {
            return res.json({
              response: "No entendí tu solicitud. Por favor, formula tu petición de manera clara, como: 'Muestra 5 registros de usuarios'."
            });
          }
        } catch (error) {
          console.error("Error al procesar consulta de tabla específica:", error);
          return res.json({
            response: "Hubo un error al consultar la tabla. Por favor, intenta de nuevo o verifica el nombre de la tabla.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
  
      // Podés agregar más casos acá
      default:
        return res.json({ response: "Tipo de mensaje no reconocido." });
    }
  });
  

// Funciones para generar respuestas según la intención
function getGreetingResponse() {
  const greetings = [
    "¡Hola! Soy Deitana IA, ¿en qué puedo ayudarte hoy?",
    "¡Bienvenido! Estoy aquí para ayudarte con información sobre clientes, productos y más. ¿Qué necesitas?",
    "Hola, soy el asistente virtual de Semilleros Deitana. ¿Cómo puedo asistirte?",
    "¡Saludos! ¿Necesitas información sobre algún cliente o producto específico?",
    "Hola, ¿en qué puedo ayudarte con la base de datos de Semilleros Deitana hoy?",
  ]

  return greetings[Math.floor(Math.random() * greetings.length)]
}

function getFarewellResponse() {
  const farewells = [
    "¡Hasta luego! Estoy aquí si necesitas más información.",
    "Adiós, ha sido un placer ayudarte. Vuelve cuando necesites más información.",
    "Hasta pronto. No dudes en consultarme cuando necesites datos de la base de Semilleros Deitana.",
    "¡Que tengas un buen día! Estoy disponible cuando me necesites.",
    "Adiós, recuerda que puedo ayudarte con consultas sobre clientes, productos y más información de la base de datos.",
  ]

  return farewells[Math.floor(Math.random() * farewells.length)]
}

function getGratitudeResponse() {
  const gratitude = [
    "De nada, estoy aquí para ayudarte. ¿Necesitas algo más?",
    "No hay de qué. Si necesitas más información, solo pregúntame.",
    "Es un placer poder ayudarte. ¿Hay algo más en lo que pueda asistirte?",
    "Para eso estoy. ¿Necesitas consultar algo más de la base de Semilleros Deitana?",
    "Encantado de ser útil. Estoy disponible si necesitas más información.",
  ]

  return gratitude[Math.floor(Math.random() * gratitude.length)]
}

function getSmallTalkResponse(message) {
  // Respuestas genéricas para conversación casual
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes("cómo estás") || lowerMessage.includes("como estas")) {
    return "Estoy funcionando perfectamente, gracias por preguntar. ¿En qué puedo ayudarte con la base de datos de Semilleros Deitana?"
  }

  if (lowerMessage.includes("quién eres") || lowerMessage.includes("quien eres")) {
    return "Soy Deitana IA, el asistente virtual de Semilleros Deitana. Estoy aquí para ayudarte a consultar información de la base de datos de clientes, productos y más."
  }

  if (lowerMessage.includes("qué puedes hacer") || lowerMessage.includes("que puedes hacer")) {
    return "Puedo ayudarte a consultar información sobre clientes, productos, stock y más datos de Semilleros Deitana. Por ejemplo, puedes preguntarme sobre un cliente específico o pedirme una lista de clientes activos."
  }

  // Respuesta genérica para otras conversaciones casuales
  return "Estoy aquí para ayudarte con consultas sobre la base de datos de Semilleros Deitana. ¿Qué información necesitas consultar hoy?"
}

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`)
})
