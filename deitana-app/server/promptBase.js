const fs = require("fs")
const path = require("path")

const schemaPath = path.join(__dirname, "schema.json")
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"))

// Función promptBase para generar el prompt para DeepSeek
function promptBase(userPrompt) {
  const lowerPrompt = userPrompt.toLowerCase()

  // Detectar si es una consulta sobre artículos
  const esConsultaArticulos =
    lowerPrompt.includes("articulo") ||
    lowerPrompt.includes("artículos") ||
    lowerPrompt.includes("producto") ||
    lowerPrompt.includes("productos")

  // Detectar si es una consulta sobre proveedores
  const esConsultaProveedores =
    lowerPrompt.includes("proveedor") ||
    lowerPrompt.includes("proveedores") ||
    lowerPrompt.includes("suministrador") ||
    lowerPrompt.includes("suministradores") ||
    lowerPrompt.includes("distribuidor") ||
    lowerPrompt.includes("distribuidores")

  // Buscar coincidencias exactas por nombre de tabla
  const tablasCoincidentes = Object.entries(schema).filter(([table]) => lowerPrompt.includes(table.toLowerCase()))

  // Si no hay coincidencias, usamos tablas clave como fallback
  // Añadimos las tablas relevantes según el tipo de consulta
  let tablasClave = ["clientes", "articulos", "inventario"]

  if (esConsultaArticulos) {
    tablasClave = ["articulos", "proveedores", "clientes"]
  } else if (esConsultaProveedores) {
    tablasClave = ["proveedores", "articulos", "clientes"]
  }

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

  // Detectar si es una consulta sobre un artículo específico
  const articuloRegex =
    /(?:articulo|artículo|producto|información|informacion|datos|código|codigo|referencia|precio|stock)\s+(?:de|sobre|del|para|acerca)\s+(?:el producto|producto|articulo|artículo)?\s*([A-Za-z0-9\s.]+)/i
  const articuloMatch = userPrompt.match(articuloRegex)

  // Detectar si es una consulta sobre un proveedor específico
  const proveedorRegex =
    /(?:proveedor|proveedores|suministrador|distribuidor|información|informacion|datos)\s+(?:de|sobre|del|para|acerca)\s+(?:el proveedor|proveedor|empresa)?\s*([A-Za-z0-9\s.]+)/i
  const proveedorMatch = userPrompt.match(proveedorRegex)

  let clienteNombre = ""
  let articuloNombre = ""
  let proveedorNombre = ""

  if (clienteMatch && clienteMatch[1]) {
    clienteNombre = clienteMatch[1].trim()
  } else {
    // Buscar cualquier nombre que pueda ser un cliente (palabras en mayúsculas o con puntos)
    const posibleClienteRegex = /([A-Z][A-Za-z0-9\s.-]+(?:\s+S\.?(?:COOP|L|A|C\.?V|R\.?L))?)/g
    const posiblesClientes = [...userPrompt.matchAll(posibleClienteRegex)]
    if (posiblesClientes.length > 0 && !esConsultaProveedores && !esConsultaArticulos) {
      // Tomar el nombre más largo como posible cliente
      clienteNombre = posiblesClientes
        .reduce((prev, current) => (prev[0].length > current[0].length ? prev : current))[0]
        .trim()
    }
  }

  if (articuloMatch && articuloMatch[1]) {
    articuloNombre = articuloMatch[1].trim()
  } else if (esConsultaArticulos && !clienteMatch) {
    // Si es una consulta de artículos pero no se detectó un nombre específico,
    // intentar extraer cualquier texto que pueda ser un nombre de artículo
    const posibleArticuloRegex = /([A-Z][A-Za-z0-9\s.-]+)/g
    const posiblesArticulos = [...userPrompt.matchAll(posibleArticuloRegex)]
    if (posiblesArticulos.length > 0) {
      articuloNombre = posiblesArticulos
        .reduce((prev, current) => (prev[0].length > current[0].length ? prev : current))[0]
        .trim()
    }
  }

  if (proveedorMatch && proveedorMatch[1]) {
    proveedorNombre = proveedorMatch[1].trim()
  } else if (esConsultaProveedores && !clienteMatch && !articuloMatch) {
    // Si es una consulta de proveedores pero no se detectó un nombre específico,
    // intentar extraer cualquier texto que pueda ser un nombre de proveedor
    const posibleProveedorRegex = /([A-Z][A-Za-z0-9\s.-]+)/g
    const posiblesProveedores = [...userPrompt.matchAll(posibleProveedorRegex)]
    if (posiblesProveedores.length > 0) {
      proveedorNombre = posiblesProveedores
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
  if (clienteNombre && !esConsultaProveedores && !esConsultaArticulos) {
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

  // Si se detectó un posible nombre de artículo, añadir instrucciones específicas
  if (esConsultaArticulos || articuloNombre) {
    systemPrompt += `
IMPORTANTE: Detecto que estás buscando información sobre artículos${articuloNombre ? ` específicamente "${articuloNombre}"` : ""}.

La tabla principal es 'articulos' que contiene campos como:
- id: Código interno del artículo
- AR_DENO: Denominación/nombre del artículo
- AR_REF: Referencia interna
- AR_BAR: Código de barras
- AR_PVP: Precio de venta
- AR_PMC: Precio medio de coste
- AR_STOK: Información de stock

Para obtener información completa, considera hacer JOIN con la tabla 'proveedores' usando el campo 'AR_PRV' que es una clave foránea.

Ejemplo de consulta para buscar un artículo:
\`\`\`sql
SELECT a.*, p.PR_DENO as NombreProveedor 
FROM articulos a 
LEFT JOIN proveedores p ON a.AR_PRV = p.id
WHERE a.AR_DENO LIKE '%${articuloNombre || "término de búsqueda"}%' OR a.AR_REF LIKE '%${articuloNombre || "término de búsqueda"}%'
LIMIT 10
\`\`\`

Si es una consulta general sobre artículos, usa:
\`\`\`sql
SELECT id, AR_DENO, AR_REF, AR_BAR, AR_PVP, AR_PMC FROM articulos LIMIT 25
\`\`\`
`
  }

  // Si se detectó un posible nombre de proveedor, añadir instrucciones específicas
  if (esConsultaProveedores || proveedorNombre) {
    systemPrompt += `
IMPORTANTE: Detecto que estás buscando información sobre proveedores${proveedorNombre ? ` específicamente "${proveedorNombre}"` : ""}.

La tabla principal es 'proveedores' que contiene campos como:
- id: Código interno del proveedor
- PR_DENO: Denominación/nombre del proveedor
- PR_DOM: Domicilio
- PR_POB: Población
- PR_PRO: Provincia
- PR_TEL: Teléfono
- PR_EMA: Email
- PR_CIF: CIF

Ejemplo de consulta para buscar un proveedor:
\`\`\`sql
SELECT * FROM proveedores 
WHERE PR_DENO LIKE '%${proveedorNombre || "término de búsqueda"}%'
LIMIT 10
\`\`\`

Si es una consulta general sobre proveedores, usa:
\`\`\`sql
SELECT id, PR_DENO, PR_POB, PR_TEL, PR_EMA FROM proveedores LIMIT 25
\`\`\`

Para ver los artículos de un proveedor específico, usa:
\`\`\`sql
SELECT a.id, a.AR_DENO, a.AR_REF, a.AR_PVP, p.PR_DENO as NombreProveedor
FROM articulos a
JOIN proveedores p ON a.AR_PRV = p.id
WHERE p.PR_DENO LIKE '%${proveedorNombre || "término de búsqueda"}%'
LIMIT 25
\`\`\`
`
  }

  return {
    system: systemPrompt,
    user: userPrompt,
  }
}

module.exports = promptBase
