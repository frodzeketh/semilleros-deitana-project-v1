const fs = require("fs")
const path = require("path")

const schemaPath = path.join(__dirname, "schema.json")
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"))

// Variable para mantener el contexto de la conversación
let conversationContext = {
  lastTopic: null,
  lastResults: null,
  lastQuery: null
};

function promptBase(userPrompt) {
  const lowerPrompt = userPrompt.toLowerCase()

  // Verificar si es una consulta de seguimiento
  const isFollowUpQuery = 
    (lowerPrompt.includes("más grande") || 
     lowerPrompt.includes("mas grande") || 
     lowerPrompt.includes("mayor") ||
     lowerPrompt.includes("más pequeño") ||
     lowerPrompt.includes("mas pequeño") ||
     lowerPrompt.includes("menor")) &&
    conversationContext.lastTopic

  if (isFollowUpQuery) {
    return {
      system: `Eres un asistente experto en sistemas ERP para empresas agrícolas y de semilleros como Semilleros Deitana.
      
Estás en medio de una conversación sobre ${conversationContext.lastTopic}. El usuario acaba de hacer una pregunta de seguimiento relacionada con tamaños o cantidades.

Tu tarea es:
1. Mantener el contexto de la conversación anterior
2. Entender que la pregunta actual se refiere al tema anterior
3. Proporcionar una respuesta coherente con el contexto

Por ejemplo, si estaban hablando de bandejas y el usuario pregunta "la más grande", debes entender que se refiere a la bandeja de mayor tamaño.

Responde de manera conversacional y natural, manteniendo la coherencia con la conversación anterior.`,
      user: `Contexto anterior: ${conversationContext.lastQuery}
Pregunta actual: ${userPrompt}`
    }
  }

  const isDefinitionQuery =
    lowerPrompt.includes("qué son") ||
    lowerPrompt.includes("que son") ||
    lowerPrompt.includes("qué es") ||
    lowerPrompt.includes("que es") ||
    lowerPrompt.includes("definición de") ||
    lowerPrompt.includes("definicion de") ||
    lowerPrompt.includes("explica") ||
    lowerPrompt.includes("explicar") ||
    lowerPrompt.includes("significado de") ||
    lowerPrompt.includes("para qué sirve") ||
    lowerPrompt.includes("para que sirve") ||
    lowerPrompt.includes("cómo funciona") ||
    lowerPrompt.includes("como funciona") ||
    lowerPrompt.includes("por qué son importantes") ||
    lowerPrompt.includes("por que son importantes")

  if (isDefinitionQuery) {
    return {
      system: `Eres un asistente experto en sistemas ERP para empresas agrícolas y de semilleros como Semilleros Deitana.

Tu tarea es proporcionar explicaciones claras y detalladas sobre conceptos, tablas y procesos del sistema.
Utiliza tu conocimiento sobre agricultura, semilleros y sistemas de gestión para dar respuestas informativas.

Si te preguntan sobre un concepto específico como "bandejas", "clientes", "artículos", "casas comerciales", etc., proporciona:
1. Una definición clara del concepto
2. Su importancia en el contexto de un semillero
3. Cómo se utiliza en el sistema ERP
4. Información sobre los campos relevantes en la base de datos

Responde de manera conversacional y educativa, no como una consulta SQL.`,
      user: userPrompt,
    }
  }

  const specificTableQueries = {
    bandejas: /bandeja[s]?|alvéolo[s]?|alveolo[s]?/i,
    clientes: /cliente[s]?|comprador[es]?/i,
    articulos: /artículo[s]?|articulo[s]?|producto[s]?/i,
    proveedores: /proveedor[es]?|suministrador[es]?|distribuidor[es]?/i,
    partidas: /partida[s]?|lote[s]?/i,
    invernaderos: /invernadero[s]?/i,
    almacenes: /almac[eé]n[es]?/i,
    casas_com: /casa[s]?_com|casa[s]? comercial[es]?|proveedor[es]? principal[es]?/i,
    categorias: /categoría[s]?|categoria[s]?|categoría[s]? laboral[es]?|categoria[s]? laboral[es]?/i,
    dispositivos: /dispositivo[s]?|PDA[s]?|móvil[es]?|movil[es]?|terminal[es]?|equipo[s]?/i,
    envases_vta: /envase[s]?|envase[s]? de venta|envases_vta/i,
    rutas: /ruta[s]?|reparto|logística|porte[s]?|transporte/i,
    tareas_seccion: /tarea[s]?|sección de tareas|seccion de tareas|tareas_seccion|actividad[es]?|actividades/i,
    sectores: /sector[es]?|subsector[es]?|canal[es]? de venta|área[s]? del negocio|clasificación[es]? comercial/i,
    sustratos: /sustrato[s]?|medio de cultivo|mezcla[s]? de cultivo|perlita|turba|fibra de coco/i,
  }

  let targetTable = null
  let highestConfidence = 0

  for (const [table, pattern] of Object.entries(specificTableQueries)) {
    const matches = lowerPrompt.match(pattern)
    if (matches && matches.length > highestConfidence) {
      highestConfidence = matches.length
      targetTable = table
    }
  }

  // Verificar si es una consulta general sobre bandejas
  if (targetTable === 'bandejas' && !lowerPrompt.includes("información") && 
      !lowerPrompt.includes("informacion") && !lowerPrompt.includes("ejemplo") && 
      !lowerPrompt.includes("ejemplos") && !lowerPrompt.includes("listar") && 
      !lowerPrompt.includes("mostrar")) {
    return {
      system: `Eres un asistente experto en sistemas ERP para empresas agrícolas y de semilleros como Semilleros Deitana.

Las bandejas son unidades físicas reutilizables o no reutilizables donde se siembran semillas o se trasplantan esquejes en alvéolos individuales, facilitando el proceso de germinación, crecimiento inicial y transporte de las plantas jóvenes.

Tu tarea es:
1. Proporcionar una explicación clara y concisa sobre qué son las bandejas y su importancia
2. Mencionar brevemente los tipos de bandejas que existen (por tamaño, número de alvéolos, etc.)
3. Explicar su uso en el contexto de un semillero
4. Ofrecer un ejemplo concreto de una bandeja común
5. Invitar al usuario a hacer preguntas más específicas si lo desea

Responde de manera conversacional y amigable, como si estuvieras hablando con un colega.`,
      user: userPrompt
    }
  }

  if (targetTable && highestConfidence > 0) {
    const tableSchema = schema[targetTable] ? schema[targetTable].join(", ") : ""

    // Actualizar el contexto después de determinar el tipo de consulta
    conversationContext.lastTopic = targetTable;
    conversationContext.lastQuery = userPrompt;

    return {
      system: `Eres un asistente experto en bases de datos para la empresa Semilleros Deitana.

Tu trabajo consiste en interpretar preguntas en lenguaje natural sobre la tabla "${targetTable}", analizar el esquema de base de datos y generar una consulta SQL precisa y segura. Luego, la consulta será ejecutada en una base de datos MySQL.

IMPORTANTE: Si el mensaje del usuario no parece ser una consulta relacionada con la base de datos (como saludos, agradecimientos o preguntas generales), NO generes una consulta SQL. En su lugar, responde con: "CONVERSACIONAL: [mensaje apropiado]".

Tu respuesta debe incluir solamente la consulta SQL dentro de un bloque de código así:

\`\`\`sql
-- aquí va la consulta
\`\`\`

Esquema de la tabla "${targetTable}":
${tableSchema}

Si la consulta puede ser peligrosa o requiere eliminar o modificar datos, no la generes.`,
      user: userPrompt,
    }
  }

  const esCasasComerciales =
    lowerPrompt.includes("casa comercial") ||
    lowerPrompt.includes("casas comerciales") ||
    lowerPrompt.includes("casas_com") ||
    lowerPrompt.includes("proveedor principal") ||
    lowerPrompt.includes("proveedores principales")

  const esConsultaArticulos =
    lowerPrompt.includes("articulo") ||
    lowerPrompt.includes("artículos") ||
    lowerPrompt.includes("producto") ||
    lowerPrompt.includes("productos")

  const esConsultaProveedores =
    lowerPrompt.includes("proveedor") ||
    lowerPrompt.includes("proveedores") ||
    lowerPrompt.includes("suministrador") ||
    lowerPrompt.includes("suministradores") ||
    lowerPrompt.includes("distribuidor") ||
    lowerPrompt.includes("distribuidores")

  const tablasCoincidentes = Object.entries(schema).filter(([table]) =>
    lowerPrompt.includes(table.toLowerCase())
  )

  let tablasClave = ["clientes", "articulos", "inventario", "envases_vta"]

  if (esConsultaArticulos) {
    tablasClave = ["articulos", "proveedores", "clientes"]
  } else if (esConsultaProveedores) {
    tablasClave = ["proveedores", "articulos", "clientes"]
  }

  let tablasFinales =
    tablasCoincidentes.length > 0
      ? tablasCoincidentes
      : Object.entries(schema).filter(([table]) =>
          tablasClave.includes(table.toLowerCase())
        )

  tablasFinales = tablasFinales.slice(0, 5)

  const schemaString = tablasFinales
    .map(([table, fields]) => `Tabla ${table}: ${fields.join(", ")}`)
    .join("\n")

  return {
    system: `Eres un asistente experto en bases de datos para la empresa Semilleros Deitana.

Tu trabajo consiste en interpretar preguntas en lenguaje natural, analizar el esquema de base de datos y generar una consulta SQL precisa y segura. Luego, la consulta será ejecutada en una base de datos MySQL.

IMPORTANTE: Si el mensaje del usuario no parece ser una consulta relacionada con la base de datos (como saludos, agradecimientos o preguntas generales), NO generes una consulta SQL. En su lugar, responde con: "CONVERSACIONAL: [mensaje apropiado]".

Tu respuesta debe incluir solamente la consulta SQL dentro de un bloque de código así:

\`\`\`sql
-- aquí va la consulta
\`\`\`

Esquemas relevantes:
${schemaString}

Si la consulta puede ser peligrosa o requiere eliminar o modificar datos, no la generes.`,
    user: userPrompt,
  }
}

module.exports = { promptBase, conversationContext }