const fs = require("fs")
const path = require("path")

const schemaPath = path.join(__dirname, "schema.json")
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"))

function promptBase(userPrompt) {
  const lowerPrompt = userPrompt.toLowerCase()

  // Buscar coincidencias exactas por nombre de tabla
  const tablasCoincidentes = Object.entries(schema).filter(([table]) => lowerPrompt.includes(table.toLowerCase()))

  // Si no hay coincidencias, usamos tablas clave como fallback
  const tablasClave = ["clientes", "articulos", "inventario"]
  let tablasFinales =
    tablasCoincidentes.length > 0
      ? tablasCoincidentes
      : Object.entries(schema).filter(([table]) => tablasClave.includes(table.toLowerCase()))

  // Limitamos a un máximo de 5 tablas para evitar overflow
  tablasFinales = tablasFinales.slice(0, 5)

  const schemaString = tablasFinales.map(([table, fields]) => `Tabla ${table}: ${fields.join(", ")}`).join("\n")

  // Detectar si es una consulta sobre un cliente específico
  const clienteRegex =
    /(?:cliente|información|informacion|datos|email|correo|teléfono|telefono|cif|dirección|direccion|provincia|localidad|ciudad)\s+(?:de|sobre|del|para|acerca)\s+(?:la empresa|empresa|cliente)?\s*([A-Za-z0-9\s.]+)/i
  const clienteMatch = userPrompt.match(clienteRegex)

  let clienteNombre = ""
  if (clienteMatch && clienteMatch[1]) {
    clienteNombre = clienteMatch[1].trim()
  } else {
    // Buscar cualquier nombre que pueda ser un cliente (palabras en mayúsculas o con puntos)
    const posibleClienteRegex = /([A-Z][A-Za-z0-9\s.-]+(?:\s+S\.?(?:COOP|L|A|C\.?V|R\.?L))?)/g
    const posiblesClientes = [...userPrompt.matchAll(posibleClienteRegex)]
    if (posiblesClientes.length > 0) {
      // Tomar el nombre más largo como posible cliente
      clienteNombre = posiblesClientes
        .reduce((prev, current) => (prev[0].length > current[0].length ? prev : current))[0]
        .trim()
    }
  }

  let systemPrompt = `Eres un asistente experto en bases de datos para la empresa Semilleros Deitana.

Tu trabajo consiste en interpretar preguntas en lenguaje natural, analizar el esquema de base de datos y generar una consulta SQL precisa y segura. Luego, la consulta será ejecutada en una base de datos MySQL.

IMPORTANTE: Si el mensaje del usuario no parece ser una consulta relacionada con la base de datos (como saludos, agradecimientos o preguntas generales), NO generes una consulta SQL. En su lugar, responde con: "CONVERSACIONAL: [mensaje apropiado]".

Tu respuesta debe incluir solamente la consulta SQL dentro de un bloque de código así:

\`\`\`sql
-- aquí va la consulta
\`\`\`

Si la consulta puede ser peligrosa o requiere eliminar o modificar datos, no la generes.

Esquema de base de datos relevante (máximo 5 tablas):
${schemaString}
`

  // Si se detectó un posible nombre de cliente, añadir instrucciones específicas
  if (clienteNombre) {
    systemPrompt += `
IMPORTANTE: Detecto que estás buscando información sobre el cliente "${clienteNombre}".
Usa una consulta flexible que pueda encontrar este cliente incluso si el nombre no es exacto.

Por ejemplo:
\`\`\`sql
SELECT * FROM clientes WHERE CL_DENO LIKE '%${clienteNombre}%' OR CL_NOM LIKE '%${clienteNombre}%'
\`\`\`

Si no encuentras resultados con esa consulta, prueba con una búsqueda más amplia:
\`\`\`sql
SELECT * FROM clientes WHERE 
  CL_DENO LIKE '%${clienteNombre.split(" ").join("%")}%' OR 
  CL_NOM LIKE '%${clienteNombre.split(" ").join("%")}%'
\`\`\`
`
  }

  return {
    system: systemPrompt,
    user: userPrompt,
  }
}

module.exports = promptBase
