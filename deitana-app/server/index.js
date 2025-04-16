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
let ultimosArticulosMostrados = []
let ultimosProveedoresMostrados = []

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

// Añadir función para procesar datos de un artículo
function procesarDatosArticulo(fila, campos, userPrompt) {
  const articulo = {}
  campos.forEach((key, idx) => {
    // Guardamos todos los valores, incluso los vacíos
    articulo[key] = fila[idx]
  })

  // Claves relevantes en la tabla articulos
  const codigo = articulo["id"] || "No disponible"
  const denominacion = articulo["AR_DENO"] || "No disponible"
  const referencia = articulo["AR_REF"] || "No disponible"
  const codigoBarras = articulo["AR_BAR"] || "No disponible"
  const precioVenta = articulo["AR_PVP"] || "No disponible"
  const precioCoste = articulo["AR_PMC"] || "No disponible"
  const stockMinimo = articulo["AR_MIN"] || "No disponible"
  const stockMaximo = articulo["AR_MAX"] || "No disponible"
  const proveedor = articulo["NombreProveedor"] || articulo["PR_DENO"] || "No disponible"
  const idProveedor = articulo["AR_PRV"] || "No disponible"
  const stock = articulo["AR_STOK"] || "No disponible"

  const lowerPrompt = userPrompt.toLowerCase()
  const quiereMasInfo =
    lowerPrompt.includes("todo") || lowerPrompt.includes("más información") || lowerPrompt.includes("completo")

  if (quiereMasInfo) {
    // Devolver todos los campos disponibles que no sean vacíos
    const detalles = Object.entries(articulo)
      .filter(([_, v]) => v !== null && v.toString().trim() !== "" && v !== "0" && v !== 0 && v !== "0.00")
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n")
    return `Información completa del artículo:\n\n${detalles}`
  } else {
    // Verificar si la consulta es específica sobre algún campo
    const campoEspecifico =
      lowerPrompt.includes("precio") ||
      lowerPrompt.includes("coste") ||
      lowerPrompt.includes("stock") ||
      lowerPrompt.includes("inventario") ||
      lowerPrompt.includes("código") ||
      lowerPrompt.includes("codigo") ||
      lowerPrompt.includes("barras") ||
      lowerPrompt.includes("proveedor")

    // Si es una consulta específica, mostrar solo ese campo
    if (campoEspecifico) {
      let respuesta = `Información del artículo ${denominacion}:\n\n`

      if (lowerPrompt.includes("precio") && !lowerPrompt.includes("coste")) {
        respuesta += `Precio de venta: ${precioVenta}\n`
      }

      if (lowerPrompt.includes("coste")) {
        respuesta += `Precio de coste: ${precioCoste}\n`
      }

      if (lowerPrompt.includes("stock") || lowerPrompt.includes("inventario")) {
        respuesta += `Stock actual: ${stock}\n`
        respuesta += `Stock mínimo: ${stockMinimo}\n`
        respuesta += `Stock máximo: ${stockMaximo}\n`
      }

      if (lowerPrompt.includes("código") || lowerPrompt.includes("codigo")) {
        respuesta += `Código interno: ${codigo}\n`
        respuesta += `Referencia: ${referencia}\n`
      }

      if (lowerPrompt.includes("barras")) {
        respuesta += `Código de barras: ${codigoBarras}\n`
      }

      if (lowerPrompt.includes("proveedor")) {
        respuesta += `Proveedor: ${proveedor} (ID: ${idProveedor})\n`
      }

      respuesta += "\n¿Necesitas más información sobre este artículo?"
      return respuesta
    } else {
      // Mostrar información general
      let respuesta = `Artículo encontrado:\n\n`
      respuesta += `Código: ${codigo}\n`
      respuesta += `Denominación: ${denominacion}\n`
      respuesta += `Referencia: ${referencia}\n`
      respuesta += `Código de barras: ${codigoBarras}\n`
      respuesta += `Precio de venta: ${precioVenta}\n`
      respuesta += `Stock actual: ${stock}\n`
      respuesta += `Proveedor: ${proveedor} (ID: ${idProveedor})\n`

      respuesta += "\n¿Necesitas más información sobre este artículo?"
      return respuesta
    }
  }
}

// Añadir función para procesar datos de un proveedor
function procesarDatosProveedor(fila, campos, userPrompt) {
  const proveedor = {}
  campos.forEach((key, idx) => {
    // Guardamos todos los valores, incluso los vacíos
    proveedor[key] = fila[idx]
  })

  // Claves relevantes en la tabla proveedores
  const codigo = proveedor["id"] || "No disponible"
  const denominacion = proveedor["PR_DENO"] || "No disponible"
  const direccion = proveedor["PR_DOM"] || "No disponible"
  const ciudad = proveedor["PR_POB"] || "No disponible"
  const provincia = proveedor["PR_PRO"] || "No disponible"
  const telefono = proveedor["PR_TEL"] || "No disponible"
  const email = proveedor["PR_EMA"] || "No disponible"
  const cif = proveedor["PR_CIF"] || "No disponible"
  const web = proveedor["PR_WEB"] || "No disponible"

  const lowerPrompt = userPrompt.toLowerCase()
  const quiereMasInfo =
    lowerPrompt.includes("todo") || lowerPrompt.includes("más información") || lowerPrompt.includes("completo")

  if (quiereMasInfo) {
    // Devolver todos los campos disponibles que no sean vacíos
    const detalles = Object.entries(proveedor)
      .filter(([_, v]) => v !== null && v.toString().trim() !== "" && v !== "0" && v !== 0 && v !== "0.00")
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n")
    return `Información completa del proveedor:\n\n${detalles}`
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
      lowerPrompt.includes("web") ||
      lowerPrompt.includes("sitio web")

    // Si es una consulta específica, mostrar solo ese campo
    if (campoEspecifico) {
      let respuesta = `Información del proveedor ${denominacion}:\n\n`

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

      if (lowerPrompt.includes("web") || lowerPrompt.includes("sitio web")) {
        respuesta += `Web: ${web}\n`
      }

      respuesta += "\n¿Necesitas más información sobre este proveedor?"
      return respuesta
    } else {
      // Mostrar información general
      const ubicacion = [direccion, ciudad, provincia].filter((v) => v !== "No disponible").join(", ")

      let respuesta = `Proveedor encontrado:\n\n`
      respuesta += `Código: ${codigo}\n`
      respuesta += `Denominación: ${denominacion}\n`
      respuesta += `Ubicación: ${ubicacion || "No disponible"}\n`
      respuesta += `Teléfono: ${telefono}\n`
      respuesta += `Email: ${email}\n`
      respuesta += `CIF: ${cif}\n`

      respuesta += "\n¿Necesitas más información sobre este proveedor?"
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
        })
        ;[results, fields] = await pool.query(`SELECT * FROM clientes WHERE ${condiciones} LIMIT 1`, parametros)
      }
    }

    return { results, fields }
  } catch (error) {
    console.error("Error al buscar cliente:", error)
    return { results: [], fields: [] }
  }
}

// Modificar la función buscarArticuloPorNombre para manejar mejor el caso específico
async function buscarArticuloPorNombre(nombre) {
  try {
    console.log(`Buscando artículo con nombre: "${nombre}"`)

    // Caso específico para TOMATE RIO GRANDE (PERA RASTRERO)
    if (nombre.includes("TOMATE RIO GRANDE") || nombre.includes("PERA RASTRERO")) {
      console.log("Detectada búsqueda de TOMATE RIO GRANDE (PERA RASTRERO)")
      const [results, fields] = await pool.query(
        "SELECT a.*, p.PR_DENO as NombreProveedor FROM articulos a LEFT JOIN proveedores p ON a.AR_PRV = p.id WHERE a.AR_DENO LIKE ? LIMIT 1",
        [`%TOMATE RIO GRANDE%PERA RASTRERO%`],
      )

      if (results.length > 0) {
        console.log("Encontrado TOMATE RIO GRANDE (PERA RASTRERO) con búsqueda específica")
        return { results, fields }
      }
    }

    // Primero intentamos una búsqueda directa sin escapar caracteres
    let [results, fields] = await pool.query(
      "SELECT a.*, p.PR_DENO as NombreProveedor FROM articulos a LEFT JOIN proveedores p ON a.AR_PRV = p.id WHERE a.AR_DENO = ? OR a.AR_REF = ? LIMIT 1",
      [nombre, nombre],
    )

    // Si no hay resultados, intentamos con LIKE sin escapar
    if (results.length === 0) {
      console.log("No se encontraron resultados exactos, intentando con LIKE")
      ;[results, fields] = await pool.query(
        "SELECT a.*, p.PR_DENO as NombreProveedor FROM articulos a LEFT JOIN proveedores p ON a.AR_PRV = p.id WHERE a.AR_DENO LIKE ? OR a.AR_REF LIKE ? LIMIT 1",
        [`%${nombre}%`, `%${nombre}%`],
      )
    }

    // Si aún no hay resultados, intentamos con una búsqueda más flexible
    if (results.length === 0) {
      console.log("No se encontraron resultados con LIKE, intentando búsqueda por palabras")
      // Eliminar paréntesis para la búsqueda por palabras
      const nombreSinParentesis = nombre.replace(/[()]/g, " ").trim()
      const palabras = nombreSinParentesis.split(/\s+/).filter((p) => p.length > 2)

      if (palabras.length > 0) {
        console.log("Palabras para búsqueda:", palabras)

        // Priorizar búsqueda por la primera palabra (generalmente el tipo de producto)
        const primeraPalabra = palabras[0]
        console.log("Buscando primero por:", primeraPalabra)
        ;[results, fields] = await pool.query(
          "SELECT a.*, p.PR_DENO as NombreProveedor FROM articulos a LEFT JOIN proveedores p ON a.AR_PRV = p.id WHERE a.AR_DENO LIKE ? LIMIT 10",
          [`${primeraPalabra}%`],
        )

        // Si encontramos resultados, filtrar manualmente para encontrar la mejor coincidencia
        if (results.length > 0) {
          console.log(`Encontrados ${results.length} resultados que comienzan con ${primeraPalabra}`)

          // Filtrar para encontrar coincidencias con las demás palabras
          const filtrados = results.filter((row) => {
            const nombreArticulo = (row.AR_DENO || "").toUpperCase()
            // Verificar si contiene todas las palabras clave
            return palabras.slice(1).every((palabra) => nombreArticulo.includes(palabra))
          })

          if (filtrados.length > 0) {
            console.log(`Encontrados ${filtrados.length} resultados después de filtrar`)
            results = [filtrados[0]] // Tomar el primer resultado filtrado
            return { results, fields }
          }
        }

        // Si no encontramos con ese enfoque, intentar con la búsqueda tradicional por palabras
        const condiciones = palabras.map(() => `a.AR_DENO LIKE ?`).join(" OR ")
        const parametros = palabras.map((p) => `%${p}%`)

        const query = `SELECT a.*, p.PR_DENO as NombreProveedor FROM articulos a LEFT JOIN proveedores p ON a.AR_PRV = p.id WHERE ${condiciones} LIMIT 10`
        console.log("Consulta por palabras:", query, "Parámetros:", parametros)
        ;[results, fields] = await pool.query(query, parametros)

        // Si encontramos varios resultados, intentar encontrar el mejor
        if (results.length > 1) {
          // Ordenar por relevancia (cuántas palabras clave contiene)
          results.sort((a, b) => {
            const nombreA = (a.AR_DENO || "").toUpperCase()
            const nombreB = (b.AR_DENO || "").toUpperCase()

            const coincidenciasA = palabras.filter((p) => nombreA.includes(p)).length
            const coincidenciasB = palabras.filter((p) => nombreB.includes(p)).length

            return coincidenciasB - coincidenciasA // Ordenar de mayor a menor coincidencias
          })

          // Tomar solo el mejor resultado
          results = [results[0]]
        }
      }
    }

    // Si aún no hay resultados, intentar una búsqueda específica para TOMATE
    if (results.length === 0 && nombre.toUpperCase().includes("TOMATE")) {
      console.log("Intentando búsqueda específica para TOMATE")
      ;[results, fields] = await pool.query(
        "SELECT a.*, p.PR_DENO as NombreProveedor FROM articulos a LEFT JOIN proveedores p ON a.AR_PRV = p.id WHERE a.AR_DENO LIKE ? LIMIT 10",
        [`%TOMATE%`],
      )

      // Si encontramos resultados, filtrar para encontrar el mejor
      if (results.length > 0) {
        const nombreBusqueda = nombre.toUpperCase()
        // Filtrar y ordenar por relevancia
        results.sort((a, b) => {
          const nombreA = (a.AR_DENO || "").toUpperCase()
          const nombreB = (b.AR_DENO || "").toUpperCase()

          // Calcular similitud simple (cuántas palabras coinciden)
          const palabrasBusqueda = nombreBusqueda.split(/\s+/)
          const coincidenciasA = palabrasBusqueda.filter((p) => nombreA.includes(p)).length
          const coincidenciasB = palabrasBusqueda.filter((p) => nombreB.includes(p)).length

          return coincidenciasB - coincidenciasA
        })

        // Verificar si el mejor resultado tiene suficiente relevancia
        const mejorResultado = results[0]
        const nombreMejor = (mejorResultado.AR_DENO || "").toUpperCase()
        const palabrasBusqueda = nombreBusqueda.split(/\s+/)
        const coincidencias = palabrasBusqueda.filter((p) => nombreMejor.includes(p)).length

        // Si tiene al menos 2 palabras en común o más del 50% de las palabras
        if (coincidencias >= 2 || coincidencias >= palabrasBusqueda.length * 0.5) {
          results = [mejorResultado]
        } else {
          results = []
        }
      }
    }

    // Verificar que no estamos devolviendo "ARTICULOS VARIOS" por error
    if (results.length > 0 && results[0].AR_DENO && results[0].AR_DENO.includes("ARTICULOS VARIOS")) {
      // Si estamos buscando un artículo específico y encontramos "ARTICULOS VARIOS", es probablemente incorrecto
      if (nombre.length > 10 && !nombre.includes("ARTICULOS VARIOS")) {
        console.log("Descartando resultado 'ARTICULOS VARIOS' por ser genérico")
        results = []
      }
    }

    console.log(`Resultados encontrados: ${results.length}`)
    return { results, fields }
  } catch (error) {
    console.error("Error al buscar artículo:", error)
    return { results: [], fields: [] }
  }
}

// Función para buscar un proveedor por nombre con búsqueda flexible
async function buscarProveedorPorNombre(nombre) {
  try {
    // Primero intentamos una búsqueda exacta
    let [results, fields] = await pool.query("SELECT * FROM proveedores WHERE PR_DENO = ? LIMIT 1", [nombre])

    // Si no hay resultados, intentamos con LIKE
    if (results.length === 0) {
      ;[results, fields] = await pool.query("SELECT * FROM proveedores WHERE PR_DENO LIKE ? LIMIT 1", [`%${nombre}%`])
    }

    // Si aún no hay resultados, intentamos con una búsqueda más flexible
    if (results.length === 0) {
      const palabras = nombre.split(" ").filter((p) => p.length > 2)
      if (palabras.length > 0) {
        const condiciones = palabras.map((p) => `PR_DENO LIKE ?`).join(" OR ")
        const parametros = palabras.map((p) => `%${p}%`)
        ;[results, fields] = await pool.query(`SELECT * FROM proveedores WHERE ${condiciones} LIMIT 1`, parametros)
      }
    }

    return { results, fields }
  } catch (error) {
    console.error("Error al buscar proveedor:", error)
    return { results: [], fields: [] }
  }
}

// Modificar la función obtenerListaClientes para que sea más inteligente
async function obtenerListaClientes(cantidad, filtroActivos = false, mostrarEstado = false, mostrarDatos = false) {
  try {
    let query = "SELECT * FROM clientes"

    if (filtroActivos) {
      query += " WHERE CL_SIT = 'ACTIVO'"
    }

    query += ` LIMIT ${cantidad}`

    console.log("Ejecutando consulta para lista de clientes:", query)
    const [results] = await pool.query(query)

    if (results.length === 0) {
      return "No se encontraron clientes que cumplan con los criterios."
    }

    // Guardar los resultados en una variable global para consultas de seguimiento
    ultimosClientesMostrados = results

    if (mostrarDatos) {
      // Mostrar información detallada de cada cliente
      const formatted = results
        .map((cliente, i) => {
          let info = `${i + 1}. ${cliente.CL_DENO}\n`
          info += `   Domicilio: ${cliente.CL_DOM || "No disponible"}, ${cliente.CL_POB || "Sin localidad"}\n`
          info += `   Provincia: ${cliente.CL_PROV || "No disponible"}\n`
          info += `   Teléfono: ${cliente.CL_TEL || "No disponible"}\n`
          if (cliente.CL_EMA && cliente.CL_EMA.trim() !== "") {
            info += `   Email: ${cliente.CL_EMA}\n`
          }
          if (cliente.CL_CIF && cliente.CL_CIF.trim() !== "") {
            info += `   CIF: ${cliente.CL_CIF}\n`
          }
          const estado = cliente.CL_SIT && cliente.CL_SIT.toUpperCase() === "ACTIVO" ? "Activo" : "De baja"
          info += `   Estado: ${estado}\n`
          return info
        })
        .join("\n")
      return formatted
    } else {
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
      return formatted
    }
  } catch (error) {
    console.error("Error al obtener lista de clientes:", error)
    return "Error al obtener la lista de clientes."
  }
}

// Modificar la función obtenerListaArticulos para listar artículos
async function obtenerListaArticulos(cantidad, mostrarDatos = false) {
  try {
    let query = "SELECT a.*, p.PR_DENO as NombreProveedor FROM articulos a LEFT JOIN proveedores p ON a.AR_PRV = p.id"
    query += ` LIMIT ${cantidad}`

    console.log("Ejecutando consulta para lista de artículos:", query)
    const [results] = await pool.query(query)

    if (results.length === 0) {
      return "No se encontraron artículos que cumplan con los criterios."
    }

    // Guardar los resultados en una variable global para consultas de seguimiento
    ultimosArticulosMostrados = results

    if (mostrarDatos) {
      // Mostrar información detallada de cada artículo
      const formatted = results
        .map((articulo, i) => {
          let info = `${i + 1}. ${articulo.AR_DENO}\n`
          info += `   Código: ${articulo.id || "No disponible"}\n`
          info += `   Referencia: ${articulo.AR_REF || "No disponible"}\n`
          info += `   Precio: ${articulo.AR_PVP || "No disponible"}\n`
          info += `   Stock: ${articulo.AR_STOK || "No disponible"}\n`
          info += `   Proveedor: ${articulo.NombreProveedor || "No disponible"}\n`
          return info
        })
        .join("\n")
      return formatted
    } else {
      // Formatear los resultados de forma concisa
      const formatted = results
        .map((row, i) => {
          return `${i + 1}. ${row.AR_DENO || "Sin nombre"} - Ref: ${row.AR_REF || "N/A"} - Precio: ${row.AR_PVP || "N/A"}`
        })
        .join("\n")
      return formatted
    }
  } catch (error) {
    console.error("Error al obtener lista de artículos:", error)
    return "Error al obtener la lista de artículos."
  }
}

// Función para obtener una lista de proveedores
async function obtenerListaProveedores(cantidad, mostrarDatos = false) {
  try {
    let query = "SELECT * FROM proveedores"
    query += ` LIMIT ${cantidad}`

    console.log("Ejecutando consulta para lista de proveedores:", query)
    const [results] = await pool.query(query)

    if (results.length === 0) {
      return "No se encontraron proveedores que cumplan con los criterios."
    }

    // Guardar los resultados en una variable global para consultas de seguimiento
    ultimosProveedoresMostrados = results

    if (mostrarDatos) {
      // Mostrar información detallada de cada proveedor
      const formatted = results
        .map((proveedor, i) => {
          let info = `${i + 1}. ${proveedor.PR_DENO}\n`
          info += `   Domicilio: ${proveedor.PR_DOM || "No disponible"}, ${proveedor.PR_POB || "Sin localidad"}\n`
          info += `   Provincia: ${proveedor.PR_PRO || "No disponible"}\n`
          info += `   Teléfono: ${proveedor.PR_TEL || "No disponible"}\n`
          if (proveedor.PR_EMA && proveedor.PR_EMA.trim() !== "") {
            info += `   Email: ${proveedor.PR_EMA}\n`
          }
          if (proveedor.PR_CIF && proveedor.PR_CIF.trim() !== "") {
            info += `   CIF: ${proveedor.PR_CIF}\n`
          }
          return info
        })
        .join("\n")
      return formatted
    } else {
      // Formatear los resultados de forma concisa
      const formatted = results
        .map((row, i) => {
          return `${i + 1}. ${row.PR_DENO || "Sin nombre"} - ${row.PR_POB || "Sin localidad"} - Tel: ${row.PR_TEL || "N/A"}`
        })
        .join("\n")
      return formatted
    }
  } catch (error) {
    console.error("Error al obtener lista de proveedores:", error)
    return "Error al obtener la lista de proveedores."
  }
}

// Modificar la función fallbackClientes para incluir soporte para proveedores
async function fallbackClientes(userMessage) {
  // Detectar si es una solicitud de lista de clientes
  const esListaClientes =
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:una\s+lista\s+de\s+)?(\d+)?\s*clientes/i.test(
      userMessage,
    ) ||
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:los|las|unos|unas)\s+(\d+)?\s*clientes/i.test(
      userMessage,
    )

  // Detectar si es una solicitud de lista de artículos
  const esListaArticulos =
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:una\s+lista\s+de\s+)?(\d+)?\s*(?:articulos|artículos|productos)/i.test(
      userMessage,
    ) ||
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:los|las|unos|unas)\s+(\d+)?\s*(?:articulos|artículos|productos)/i.test(
      userMessage,
    )

  // Detectar si es una solicitud de lista de proveedores
  const esListaProveedores =
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:una\s+lista\s+de\s+)?(\d+)?\s*(?:proveedores|proveedor|distribuidores|distribuidor)/i.test(
      userMessage,
    ) ||
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:los|las|unos|unas)\s+(\d+)?\s*(?:proveedores|proveedor|distribuidores|distribuidor)/i.test(
      userMessage,
    ) ||
    /^(?:información|informacion|datos)\s+(?:de|sobre|acerca de)\s+(?:los|algunos|varios)?\s*(?:proveedores|proveedor|distribuidores|distribuidor)/i.test(
      userMessage,
    )

  const esClientesActivos = /clientes\s+activos/i.test(userMessage)

  // Detectar si se piden datos completos
  const pideDatosCompletos =
    /datos|información|informacion|completo|completa|detalle|detalles|todo|todos/i.test(userMessage) ||
    /envía|envia|muestra|dame|dime/i.test(userMessage)

  // Extraer el número de clientes/artículos/proveedores solicitados
  const cantidadMatch = userMessage.match(
    /(\d+)\s*(?:clientes|articulos|artículos|productos|proveedores|proveedor|distribuidores|distribuidor)/i,
  )
  const cantidad = cantidadMatch ? Number.parseInt(cantidadMatch[1]) : 5 // Por defecto 5 si no se especifica

  if (esListaClientes) {
    return await obtenerListaClientes(cantidad, esClientesActivos, false, pideDatosCompletos)
  }

  if (esListaArticulos) {
    return await obtenerListaArticulos(cantidad, pideDatosCompletos)
  }

  if (esListaProveedores) {
    return await obtenerListaProveedores(cantidad, pideDatosCompletos)
  }

  // Verificar si es una solicitud de información sobre los últimos elementos mostrados
  if (
    (ultimosClientesMostrados.length > 0 ||
      ultimosArticulosMostrados.length > 0 ||
      ultimosProveedoresMostrados.length > 0) &&
    pideDatosCompletos
  ) {
    // Determinar qué tipo de datos mostrar basado en lo último que se mostró
    if (
      ultimosClientesMostrados.length > 0 &&
      ultimosClientesMostrados.length >= ultimosArticulosMostrados.length &&
      ultimosClientesMostrados.length >= ultimosProveedoresMostrados.length
    ) {
      return await obtenerListaClientes(ultimosClientesMostrados.length, false, false, true)
    } else if (
      ultimosArticulosMostrados.length > 0 &&
      ultimosArticulosMostrados.length >= ultimosProveedoresMostrados.length
    ) {
      return await obtenerListaArticulos(ultimosArticulosMostrados.length, true)
    } else if (ultimosProveedoresMostrados.length > 0) {
      return await obtenerListaProveedores(ultimosProveedoresMostrados.length, true)
    }
  }

  // Extraer posible nombre de cliente
  const clienteRegex =
    /(?:cliente|información|informacion|datos|email|correo|teléfono|telefono|cif|dirección|direccion|provincia|localidad|ciudad)\s+(?:de|sobre|del|para|acerca)\s+(?:la empresa|empresa|cliente)?\s*([A-Za-z0-9\s.]+)/i
  const clienteMatch = userMessage.match(clienteRegex)

  // Extraer posible nombre de artículo
  const articuloRegex =
    /(?:articulo|artículo|producto|información|informacion|datos|código|codigo|referencia|precio|stock)\s+(?:de|sobre|del|para|acerca)\s+(?:el producto|producto|articulo|artículo)?\s*([A-Za-z0-9\s.()]+)/i
  const articuloMatch = userMessage.match(articuloRegex)

  // Extraer posible nombre de proveedor
  const proveedorRegex =
    /(?:proveedor|proveedores|suministrador|distribuidor|información|informacion|datos)\s+(?:de|sobre|del|para|acerca)\s+(?:el proveedor|proveedor|empresa)?\s*([A-Za-z0-9\s.]+)/i
  const proveedorMatch = userMessage.match(proveedorRegex)

  let clienteNombre = ""
  if (clienteMatch && clienteMatch[1]) {
    clienteNombre = clienteMatch[1].trim()
  } else {
    // Buscar cualquier nombre que pueda ser un cliente (palabras en mayúsculas o con puntos)
    const posibleClienteRegex = /([A-Z][A-Za-z0-9\s.-]+(?:\s+S\.?(?:COOP|L|A|C\.?V|R\.?L))?)/g
    const posiblesClientes = [...userMessage.matchAll(posibleClienteRegex)]
    if (
      posiblesClientes.length > 0 &&
      !userMessage.toLowerCase().includes("proveedor") &&
      !userMessage.toLowerCase().includes("articulo") &&
      !userMessage.toLowerCase().includes("artículo") &&
      !userMessage.toLowerCase().includes("producto")
    ) {
      // Tomar el nombre más largo como posible cliente
      clienteNombre = posiblesClientes
        .reduce((prev, current) => (prev[0].length > current[0].length ? prev : current))[0]
        .trim()
    }
  }

  // Extraer nombre de artículo directamente del mensaje si no hay palabras clave
  let articuloNombre = ""

  // Si hay una coincidencia con el regex, usarla
  if (articuloMatch && articuloMatch[1]) {
    articuloNombre = articuloMatch[1].trim()
  }
  // Si no hay coincidencia pero el mensaje está en mayúsculas, probablemente sea un nombre de artículo directo
  else if (/[A-Z]{3,}/.test(userMessage)) {
    // Extraer texto en mayúsculas como posible nombre de artículo
    const mayusculasMatch = userMessage.match(/([A-Z][A-Z\s()]+(?:$[A-Z\s]+$)?)/g)
    if (mayusculasMatch && mayusculasMatch.length > 0) {
      // Tomar la coincidencia más larga
      articuloNombre = mayusculasMatch.reduce((prev, current) => (prev.length > current.length ? prev : current)).trim()
    }
  }

  console.log("Nombre de artículo extraído:", articuloNombre)

  let proveedorNombre = ""
  if (proveedorMatch && proveedorMatch[1]) {
    proveedorNombre = proveedorMatch[1].trim()
  } else if (
    userMessage.toLowerCase().includes("proveedor") ||
    userMessage.toLowerCase().includes("proveedores") ||
    userMessage.toLowerCase().includes("distribuidor")
  ) {
    // Si no se detectó un nombre específico, intentar extraer cualquier texto que pueda ser un nombre de proveedor
    const posibleProveedorRegex = /([A-Z][A-Za-z0-9\s.]+)/g
    const posiblesProveedores = [...userMessage.matchAll(posibleProveedorRegex)]
    if (posiblesProveedores.length > 0) {
      proveedorNombre = posiblesProveedores
        .reduce((prev, current) => (prev[0].length > current[0].length ? prev : current))[0]
        .trim()
    }
  }

  // Si tenemos un nombre de artículo, intentar buscarlo primero
  if (articuloNombre) {
    console.log(`Buscando artículo: "${articuloNombre}"`)
    const { results, fields } = await buscarArticuloPorNombre(articuloNombre)

    if (results.length > 0 && fields) {
      const campos = fields.map((f) => f.name)
      const fila = Object.values(results[0])
      return procesarDatosArticulo(fila, campos, userMessage)
    }
  }

  // Primero intentamos buscar un cliente si hay un nombre
  if (
    clienteNombre &&
    !userMessage.toLowerCase().includes("proveedor") &&
    !userMessage.toLowerCase().includes("articulo") &&
    !userMessage.toLowerCase().includes("artículo") &&
    !userMessage.toLowerCase().includes("producto")
  ) {
    const { results, fields } = await buscarClientePorNombre(clienteNombre)

    if (results.length > 0 && fields) {
      const campos = fields.map((f) => f.name)
      const fila = Object.values(results[0])
      return procesarDatosCliente(fila, campos, userMessage)
    }
  }

  // Luego intentamos buscar un artículo si hay un nombre o si la consulta menciona artículos
  if (
    articuloNombre ||
    userMessage.toLowerCase().includes("articulo") ||
    userMessage.toLowerCase().includes("artículo") ||
    userMessage.toLowerCase().includes("producto") ||
    /^[A-Z\s()]+$/.test(userMessage.trim()) // Si el mensaje completo está en mayúsculas
  ) {
    const nombreBusqueda = articuloNombre || userMessage.trim() // Si no hay nombre específico, usar el mensaje completo
    const { results, fields } = await buscarArticuloPorNombre(nombreBusqueda)

    if (results.length > 0 && fields) {
      const campos = fields.map((f) => f.name)
      const fila = Object.values(results[0])
      return procesarDatosArticulo(fila, campos, userMessage)
    }
  }

  // Luego intentamos buscar un proveedor si hay un nombre o si la consulta menciona proveedores
  if (
    proveedorNombre ||
    userMessage.toLowerCase().includes("proveedor") ||
    userMessage.toLowerCase().includes("proveedores") ||
    userMessage.toLowerCase().includes("distribuidor")
  ) {
    const nombreBusqueda = proveedorNombre || "" // Si no hay nombre específico, usamos cadena vacía para búsqueda general
    const { results, fields } = await buscarProveedorPorNombre(nombreBusqueda)

    if (results.length > 0 && fields) {
      const campos = fields.map((f) => f.name)
      const fila = Object.values(results[0])
      return procesarDatosProveedor(fila, campos, userMessage)
    }
  }

  // Si no se encontró un cliente, artículo o proveedor específico, buscar varios clientes
  const match = userMessage.match(
    /(\d+)\s*(?:clientes|articulos|artículos|productos|proveedores|proveedor|distribuidores|distribuidor)/i,
  )
  const cantidadClientes = match ? Number.parseInt(match[1]) : 5 // Si no se encuentra, usar 5 por defecto

  // Si es una solicitud de lista de clientes, usar la función especializada
  if (userMessage.toLowerCase().includes("clientes")) {
    return await obtenerListaClientes(
      cantidadClientes,
      userMessage.toLowerCase().includes("activos"),
      false,
      pideDatosCompletos,
    )
  }

  // Si es una solicitud de lista de artículos, usar la función especializada
  if (
    userMessage.toLowerCase().includes("articulo") ||
    userMessage.toLowerCase().includes("artículo") ||
    userMessage.toLowerCase().includes("producto")
  ) {
    return await obtenerListaArticulos(cantidadClientes, pideDatosCompletos)
  }

  // Si es una solicitud de lista de proveedores, usar la función especializada
  if (
    userMessage.toLowerCase().includes("proveedor") ||
    userMessage.toLowerCase().includes("proveedores") ||
    userMessage.toLowerCase().includes("distribuidor")
  ) {
    return await obtenerListaProveedores(cantidadClientes, pideDatosCompletos)
  }

  // Si el mensaje está en mayúsculas y no se encontró nada, probablemente sea un artículo
  if (/[A-Z]{3,}/.test(userMessage)) {
    return `No he podido encontrar información sobre el artículo "${userMessage.trim()}". ¿Podrías verificar el nombre o proporcionarme más detalles?`
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

// Modificar la función detectIntentFn para incluir detección de intenciones relacionadas con artículos
function detectIntentFn(message, context) {
  const lowerMessage = message.toLowerCase().trim()

  // Función para verificar si un mensaje coincide con algún patrón usando similitud
  const matchesPattern = (input, patterns, threshold = 0.7) => {
    // Función simple para calcular la similitud entre dos cadenas
    const similarity = (s1, s2) => {
      if (s1.length < 2 || s2.length < 2) return 0

      // Si una cadena está contenida en la otra, alta similitud
      if (s1.includes(s2) || s2.includes(s1)) {
        return Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length)
      }

      // Similitud básica por caracteres compartidos
      let matches = 0
      const minLength = Math.min(s1.length, s2.length)
      for (let i = 0; i < minLength; i++) {
        if (s1[i] === s2[i]) matches++
      }
      return matches / Math.max(s1.length, s2.length)
    }

    // Verificar cada patrón
    for (const pattern of patterns) {
      if (input === pattern) return true // Coincidencia exacta
      if (similarity(input, pattern) >= threshold) return true // Coincidencia aproximada

      // Para entradas muy cortas, ser más flexible
      if (input.length <= 3 && pattern.startsWith(input)) return true
    }
    return false
  }

  // Patrones de saludos comunes y sus variantes
  const greetingPatterns = [
    "hola",
    "hol",
    "hl",
    "hello",
    "hi",
    "hey",
    "buenas",
    "buen día",
    "buenos días",
    "buenas tardes",
    "buenas noches",
    "saludos",
    "qué tal",
    "que tal",
    "cómo estás",
    "como estas",
    "qué hay",
    "que hay",
    "qué onda",
    "que onda",
  ]

  // Patrones de despedida
  const farewellPatterns = [
    "adiós",
    "adios",
    "chao",
    "chau",
    "hasta luego",
    "hasta pronto",
    "nos vemos",
    "bye",
    "goodbye",
    "hasta mañana",
    "me voy",
    "me despido",
  ]

  // Patrones de agradecimiento
  const gratitudePatterns = [
    "gracias",
    "muchas gracias",
    "te lo agradezco",
    "agradecido",
    "thanks",
    "thank you",
    "thx",
    "ty",
    "agradezco",
  ]

  // Detectar saludos con mayor tolerancia a errores
  if (matchesPattern(lowerMessage, greetingPatterns)) {
    return "greeting"
  }

  // Detectar despedidas con mayor tolerancia a errores
  if (matchesPattern(lowerMessage, farewellPatterns)) {
    return "farewell"
  }

  // Detectar agradecimientos con mayor tolerancia a errores
  if (matchesPattern(lowerMessage, gratitudePatterns)) {
    return "gratitude"
  }

  // Para mensajes muy cortos (menos de 4 caracteres), asumir que es conversación casual
  if (lowerMessage.length < 4) {
    return "smalltalk"
  }

  // Detectar solicitud de lista de clientes
  const esListaClientes =
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:una\s+lista\s+de\s+)?(\d+)?\s*clientes/i.test(
      message,
    ) ||
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:los|las|unos|unas)\s+(\d+)?\s*clientes/i.test(
      message,
    )

  // Detectar solicitud de lista de artículos
  const esListaArticulos =
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:una\s+lista\s+de\s+)?(\d+)?\s*(?:articulos|artículos|productos)/i.test(
      message,
    ) ||
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:los|las|unos|unas)\s+(\d+)?\s*(?:articulos|artículos|productos)/i.test(
      message,
    )

  // Detectar solicitud de lista de proveedores
  const esListaProveedores =
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:una\s+lista\s+de\s+)?(\d+)?\s*(?:proveedores|proveedor|distribuidores|distribuidor)/i.test(
      message,
    ) ||
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:los|las|unos|unas)\s+(\d+)?\s*(?:proveedores|proveedor|distribuidores|distribuidor)/i.test(
      message,
    ) ||
    /^(?:información|informacion|datos)\s+(?:de|sobre|acerca de)\s+(?:los|algunos|varios)?\s*(?:proveedores|proveedor|distribuidores|distribuidor)/i.test(
      message,
    )

  if (esListaClientes) {
    return "client_list"
  }

  if (esListaArticulos) {
    return "article_list"
  }

  if (esListaProveedores) {
    return "provider_list"
  }

  // Detectar si es una solicitud de información sobre los últimos elementos mostrados
  const pideDatosCompletos =
    /datos|información|informacion|completo|completa|detalle|detalles|todo|todos/i.test(message) ||
    /envía|envia|muestra|dame|dime/i.test(message)

  if (
    (ultimosClientesMostrados.length > 0 ||
      ultimosArticulosMostrados.length > 0 ||
      ultimosProveedoresMostrados.length > 0) &&
    pideDatosCompletos
  ) {
    return "show_details"
  }

  // Detectar consulta sobre cliente específico
  const clienteRegex =
    /(?:cliente|información|informacion|datos|email|correo|teléfono|telefono|cif|dirección|direccion|provincia|localidad|ciudad)\s+(?:de|sobre|del|para|acerca)\s+(?:la empresa|empresa|cliente)?\s*([A-Za-z0-9\s.]+)/i
  const clienteMatch = message.match(clienteRegex)

  // Detectar consulta sobre artículo específico
  const articuloRegex =
    /(?:articulo|artículo|producto|información|informacion|datos|código|codigo|referencia|precio|stock)\s+(?:de|sobre|del|para|acerca)\s+(?:el producto|producto|articulo|artículo)?\s*([A-Za-z0-9\s.]+)/i
  const articuloMatch = message.match(articuloRegex)

  // Detectar consulta sobre proveedor específico
  const proveedorRegex =
    /(?:proveedor|proveedores|suministrador|distribuidor|información|informacion|datos)\s+(?:de|sobre|del|para|acerca)\s+(?:el proveedor|proveedor|empresa)?\s*([A-Za-z0-9\s.]+)/i
  const proveedorMatch = message.match(proveedorRegex)

  if (clienteMatch && clienteMatch[1]) {
    return "client_query"
  }

  if (articuloMatch && articuloMatch[1]) {
    return "article_query"
  }

  // Si el mensaje está en mayúsculas, probablemente sea una consulta de artículo
  if (/[A-Z]{3,}/.test(message) && !/^dame|^dime|^muestra|^lista|^obtener|^busca/i.test(message)) {
    return "article_query"
  }

  if (proveedorMatch && proveedorMatch[1]) {
    return "provider_query"
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

  // Detectar si es una pregunta de seguimiento sobre el último artículo
  const isArticleFollowUpQuestion =
    context.lastArticleName &&
    (lowerMessage.includes("precio") ||
      lowerMessage.includes("coste") ||
      lowerMessage.includes("stock") ||
      lowerMessage.includes("inventario") ||
      lowerMessage.includes("código") ||
      lowerMessage.includes("codigo") ||
      lowerMessage.includes("barras") ||
      lowerMessage.includes("proveedor") ||
      lowerMessage.includes("más información") ||
      lowerMessage.includes("mas informacion") ||
      lowerMessage.includes("todo") ||
      lowerMessage.includes("completo") ||
      lowerMessage.includes("referencia"))

  if (isArticleFollowUpQuestion) {
    return "article_followup_query"
  }

  // Detectar si es una pregunta de seguimiento sobre el último proveedor
  const isProviderFollowUpQuestion =
    context.lastProviderName &&
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
      lowerMessage.includes("provincia") ||
      lowerMessage.includes("web") ||
      lowerMessage.includes("sitio web") ||
      lowerMessage.includes("artículos") ||
      lowerMessage.includes("articulos") ||
      lowerMessage.includes("productos"))

  if (isProviderFollowUpQuestion) {
    return "provider_followup_query"
  }

  // Detectar si es una pregunta sobre los clientes mostrados anteriormente
  const esPreguntaSobreListaAnterior =
    ultimosClientesMostrados.length > 0 &&
    /cuál|cual|cuales|cuáles|qué|que|quién|quien|cuantos|cuántos|dime|muestra|lista/i.test(message) &&
    /activo|activos|estado|baja|localidad|localidades|cif|dirección|direccion|teléfono|telefono/i.test(message)

  if (esPreguntaSobreListaAnterior) {
    return "list_followup"
  }

  // Detectar small talk (conversación casual) con criterios más amplios
  if (
    lowerMessage.length < 20 &&
    !/cliente|artículo|articulo|producto|stock|inventario|factura|pedido|venta|compra|select|from|where|proveedor|proveedores/i.test(
      lowerMessage,
    ) &&
    !/^dame|^dime|^muestra|^lista|^obtener|^busca/i.test(lowerMessage)
  ) {
    return "smalltalk"
  }

  // Detectar consulta de tabla específica
  const tablaEspecificaRegex =
    /(?:dime|muestra|dame|consulta|obtén|obtener|ver|mostrar)\s+(\d+)?\s+(?:registros?\s+de\s+)?([a-zA-Z0-9_-]+)$/i
  const tablaMatch = message.match(tablaEspecificaRegex)

  if (tablaMatch) {
    return "specific_table"
  }

  // Si no se detecta ninguna intención específica, asumir que es una consulta de base de datos
  return "database_query"
}

// Modificar la función app.post("/chat"...) para incluir manejo de proveedores
app.post("/chat", async (req, res) => {
  const { message } = req.body
  // Obtener o crear un ID de sesión
  const sessionId = req.headers["session-id"] || "default-session"

  // Obtener el contexto de la conversación o crear uno nuevo
  if (!conversationContexts.has(sessionId)) {
    conversationContexts.set(sessionId, {
      lastClientName: null,
      lastClientData: null,
      lastArticleName: null,
      lastArticleData: null,
      lastProviderName: null,
      lastProviderData: null,
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
  const intent = detectIntentFn(message, context)
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
        const pideDatosCompletos =
          /datos|información|informacion|completo|completa|detalle|detalles|todo|todos/i.test(message) ||
          /envía|envia|muestra|dame|dime/i.test(message)

        // Solo mostrar el estado si se pide específicamente o si se piden clientes activos
        const mostrarEstado = pideEstado || esClientesActivos
        const listaClientes = await obtenerListaClientes(
          numClientes,
          esClientesActivos,
          mostrarEstado,
          pideDatosCompletos,
        )

        // Limpiar el contexto ya que estamos cambiando de tema
        context.lastClientName = null
        context.lastClientData = null
        context.lastArticleName = null
        context.lastArticleData = null
        context.lastProviderName = null
        context.lastProviderData = null

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

    case "article_list":
      // Lógica para listar artículos
      try {
        // Extraer el número de artículos solicitados
        const cantidadMatch = message.match(/(\d+)\s*(?:articulos|artículos|productos)/i)
        const numArticulos = cantidadMatch ? Number.parseInt(cantidadMatch[1]) : 5 // Por defecto 5 si no se especifica
        const pideDatosCompletos =
          /datos|información|informacion|completo|completa|detalle|detalles|todo|todos/i.test(message) ||
          /envía|envia|muestra|dame|dime/i.test(message)

        const listaArticulos = await obtenerListaArticulos(numArticulos, pideDatosCompletos)

        // Limpiar el contexto ya que estamos cambiando de tema
        context.lastClientName = null
        context.lastClientData = null
        context.lastArticleName = null
        context.lastArticleData = null
        context.lastProviderName = null
        context.lastProviderData = null

        const respuesta = `Aquí tienes los artículos solicitados:\n\n${listaArticulos}`

        // Guardar la respuesta en el historial
        context.conversationHistory.push({
          role: "assistant",
          content: respuesta,
        })

        return res.json({ response: respuesta })
      } catch (error) {
        console.error("Error al procesar lista de artículos:", error)
        return res.json({
          response: "Hubo un error al obtener la lista de artículos. Por favor, intenta de nuevo.",
        })
      }

    case "provider_list":
      // Lógica para listar proveedores
      try {
        // Extraer el número de proveedores solicitados
        const cantidadMatch = message.match(/(\d+)\s*(?:proveedores|proveedor|distribuidores|distribuidor)/i)
        const numProveedores = cantidadMatch ? Number.parseInt(cantidadMatch[1]) : 5 // Por defecto 5 si no se especifica
        const pideDatosCompletos =
          /datos|información|informacion|completo|completa|detalle|detalles|todo|todos/i.test(message) ||
          /envía|envia|muestra|dame|dime/i.test(message)

        const listaProveedores = await obtenerListaProveedores(numProveedores, pideDatosCompletos)

        // Limpiar el contexto ya que estamos cambiando de tema
        context.lastClientName = null
        context.lastClientData = null
        context.lastArticleName = null
        context.lastArticleData = null
        context.lastProviderName = null
        context.lastProviderData = null

        const respuesta = `Aquí tienes los proveedores solicitados:\n\n${listaProveedores}`

        // Guardar la respuesta en el historial
        context.conversationHistory.push({
          role: "assistant",
          content: respuesta,
        })

        return res.json({ response: respuesta })
      } catch (error) {
        console.error("Error al procesar lista de proveedores:", error)
        return res.json({
          response: "Hubo un error al obtener la lista de proveedores. Por favor, intenta de nuevo.",
        })
      }

    case "show_details":
      // Mostrar detalles de los últimos elementos mostrados
      try {
        let respuesta = ""

        // Determinar qué tipo de datos mostrar basado en lo último que se mostró
        if (
          ultimosClientesMostrados.length > 0 &&
          ultimosClientesMostrados.length >= ultimosArticulosMostrados.length &&
          ultimosClientesMostrados.length >= ultimosProveedoresMostrados.length
        ) {
          const listaClientes = await obtenerListaClientes(ultimosClientesMostrados.length, false, false, true)
          respuesta = `Aquí tienes la información detallada de los clientes:\n\n${listaClientes}`
        } else if (
          ultimosArticulosMostrados.length > 0 &&
          ultimosArticulosMostrados.length >= ultimosProveedoresMostrados.length
        ) {
          const listaArticulos = await obtenerListaArticulos(ultimosArticulosMostrados.length, true)
          respuesta = `Aquí tienes la información detallada de los artículos:\n\n${listaArticulos}`
        } else if (ultimosProveedoresMostrados.length > 0) {
          const listaProveedores = await obtenerListaProveedores(ultimosProveedoresMostrados.length, true)
          respuesta = `Aquí tienes la información detallada de los proveedores:\n\n${listaProveedores}`
        } else {
          respuesta = "No tengo información previa para mostrar. ¿Podrías especificar qué datos necesitas?"
        }

        // Guardar la respuesta en el historial
        context.conversationHistory.push({
          role: "assistant",
          content: respuesta,
        })

        return res.json({ response: respuesta })
      } catch (error) {
        console.error("Error al mostrar detalles:", error)
        return res.json({
          response: "Hubo un error al obtener los detalles. Por favor, intenta de nuevo.",
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
            context.lastArticleName = null
            context.lastArticleData = null
            context.lastProviderName = null
            context.lastProviderData = null

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

    case "article_query":
      // Extraer posible nombre de artículo del mensaje
      const articuloRegex =
        /(?:articulo|artículo|producto|información|informacion|datos|código|codigo|referencia|precio|stock)\s+(?:de|sobre|del|para|acerca)\s+(?:el producto|producto|articulo|artículo)?\s*([A-Za-z0-9\s.()]+)/i
      const articuloMatch = message.match(articuloRegex)

      let articuloNombre = ""

      // Si hay una coincidencia con el regex, usarla
      if (articuloMatch && articuloMatch[1]) {
        articuloNombre = articuloMatch[1].trim()
      }
      // Si no hay coincidencia pero el mensaje está en mayúsculas, probablemente sea un nombre de artículo directo
      else if (/[A-Z]{3,}/.test(message)) {
        // Extraer texto en mayúsculas como posible nombre de artículo
        const mayusculasMatch = message.match(/([A-Z][A-Z\s()]+(?:$[A-Z\s]+$)?)/g)
        if (mayusculasMatch && mayusculasMatch.length > 0) {
          // Tomar la coincidencia más larga
          articuloNombre = mayusculasMatch
            .reduce((prev, current) => (prev.length > current.length ? prev : current))
            .trim()
        } else {
          // Si no hay coincidencias específicas, usar el mensaje completo
          articuloNombre = message.trim()
        }
      }

      try {
        if (articuloNombre) {
          console.log(`Buscando artículo: "${articuloNombre}"`)
          const { results, fields } = await buscarArticuloPorNombre(articuloNombre)

          if (results.length > 0 && fields) {
            const campos = fields.map((f) => f.name)
            const fila = Object.values(results[0])

            // Crear un objeto con los datos del artículo
            const articuloData = {}
            campos.forEach((key, idx) => {
              articuloData[key] = fila[idx]
            })

            // Guardar el nombre del artículo y sus datos en el contexto
            context.lastArticleName = articuloData["AR_DENO"] || articuloNombre
            context.lastArticleData = articuloData
            context.lastClientName = null
            context.lastClientData = null
            context.lastProviderName = null
            context.lastProviderData = null

            const respuesta = procesarDatosArticulo(fila, campos, message)

            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: respuesta,
            })

            return res.json({ response: respuesta })
          } else {
            const respuesta = `No he podido encontrar información sobre el artículo "${articuloNombre}". ¿Podrías verificar el nombre o proporcionarme más detalles?`

            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: respuesta,
            })

            return res.json({ response: respuesta })
          }
        } else {
          // Si no hay un nombre específico, mostrar una lista general de artículos
          const listaArticulos = await obtenerListaArticulos(5)
          const respuesta = `No he podido identificar un artículo específico. Aquí tienes algunos artículos disponibles:\n\n${listaArticulos}\n\n¿Sobre cuál te gustaría más información?`

          // Guardar la respuesta en el historial
          context.conversationHistory.push({
            role: "assistant",
            content: respuesta,
          })

          return res.json({ response: respuesta })
        }
      } catch (error) {
        console.error("Error al buscar artículo:", error)
        return res.json({
          response: "Hubo un error al buscar la información del artículo. Por favor, intenta de nuevo.",
        })
      }
      break

    case "provider_query":
      // Extraer posible nombre de proveedor del mensaje
      const proveedorRegex =
        /(?:proveedor|proveedores|suministrador|distribuidor|información|informacion|datos)\s+(?:de|sobre|del|para|acerca)\s+(?:el proveedor|proveedor|empresa)?\s*([A-Za-z0-9\s.]+)/i
      const proveedorMatch = message.match(proveedorRegex)

      let proveedorNombre = ""
      if (proveedorMatch && proveedorMatch[1]) {
        proveedorNombre = proveedorMatch[1].trim()
      } else {
        // Si no se detectó un nombre específico, intentar extraer cualquier texto que pueda ser un nombre de proveedor
        const posibleProveedorRegex = /([A-Z][A-Za-z0-9\s.]+)/g
        const posiblesProveedores = [...message.matchAll(posibleProveedorRegex)]
        if (posiblesProveedores.length > 0) {
          proveedorNombre = posiblesProveedores
            .reduce((prev, current) => (prev[0].length > current[0].length ? prev : current))[0]
            .trim()
        }
      }

      try {
        if (proveedorNombre) {
          console.log(`Buscando proveedor: "${proveedorNombre}"`)
          const { results, fields } = await buscarProveedorPorNombre(proveedorNombre)

          if (results.length > 0 && fields) {
            const campos = fields.map((f) => f.name)
            const fila = Object.values(results[0])

            // Crear un objeto con los datos del proveedor
            const proveedorData = {}
            campos.forEach((key, idx) => {
              proveedorData[key] = fila[idx]
            })

            // Guardar el nombre del proveedor y sus datos en el contexto
            context.lastProviderName = proveedorData["PR_DENO"] || proveedorNombre
            context.lastProviderData = proveedorData
            context.lastClientName = null
            context.lastClientData = null
            context.lastArticleName = null
            context.lastArticleData = null

            const respuesta = procesarDatosProveedor(fila, campos, message)

            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: respuesta,
            })

            return res.json({ response: respuesta })
          } else {
            const respuesta = `No he podido encontrar información sobre el proveedor "${proveedorNombre}". ¿Podrías verificar el nombre o proporcionarme más detalles?`

            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: respuesta,
            })

            return res.json({ response: respuesta })
          }
        } else {
          // Si no hay un nombre específico, mostrar una lista general de proveedores
          const listaProveedores = await obtenerListaProveedores(5)
          const respuesta = `No he podido identificar un proveedor específico. Aquí tienes algunos proveedores disponibles:\n\n${listaProveedores}\n\n¿Sobre cuál te gustaría más información?`

          // Guardar la respuesta en el historial
          context.conversationHistory.push({
            role: "assistant",
            content: respuesta,
          })

          return res.json({ response: respuesta })
        }
      } catch (error) {
        console.error("Error al buscar proveedor:", error)
        return res.json({
          response: "Hubo un error al buscar la información del proveedor. Por favor, intenta de nuevo.",
        })
      }
      break

    case "provider_followup_query":
      // Verificar si es una pregunta de seguimiento sobre el último proveedor
      if (context.lastProviderData) {
        const proveedorData = context.lastProviderData

        // Filtrar solo los campos solicitados o devolver todos si pide "todo"
        let respuesta = ""

        if (message.toLowerCase().includes("todo") || message.toLowerCase().includes("completo")) {
          // Devolver todos los campos disponibles
          const detalles = Object.entries(proveedorData)
            .filter(([_, v]) => v !== null && v.toString().trim() !== "" && v !== "0" && v !== 0 && v !== "0.00")
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n")
          respuesta = `Información completa del proveedor ${context.lastProviderName}:\n\n${detalles}`
        } else if (
          message.toLowerCase().includes("artículos") ||
          message.toLowerCase().includes("articulos") ||
          message.toLowerCase().includes("productos")
        ) {
          // Buscar artículos de este proveedor
          try {
            const [results] = await pool.query(
              `SELECT a.id, a.AR_DENO, a.AR_REF, a.AR_PVP 
               FROM articulos a 
               WHERE a.AR_PRV = ? 
               LIMIT 10`,
              [proveedorData.id],
            )

            if (results.length === 0) {
              respuesta = `No se encontraron artículos para el proveedor ${context.lastProviderName}.`
            } else {
              const listaArticulos = results
                .map(
                  (row, i) =>
                    `${i + 1}. ${row.AR_DENO || "Sin nombre"} - Ref: ${row.AR_REF || "N/A"} - Precio: ${row.AR_PVP || "N/A"}`,
                )
                .join("\n")
              respuesta = `Artículos del proveedor ${context.lastProviderName}:\n\n${listaArticulos}`
            }
          } catch (error) {
            console.error("Error al buscar artículos del proveedor:", error)
            respuesta = `Error al buscar artículos del proveedor ${context.lastProviderName}.`
          }
        } else {
          // Construir respuesta con los campos específicos solicitados
          respuesta = `Información adicional para ${context.lastProviderName}:\n\n`
          let camposEncontrados = false

          if (message.toLowerCase().includes("cif")) {
            const valor = proveedorData["PR_CIF"]
            respuesta += `CIF: ${valor && valor !== "0" && valor !== "0.00" ? valor : "No disponible"}\n`
            camposEncontrados = true
          }

          if (message.toLowerCase().includes("teléfono") || message.toLowerCase().includes("telefono")) {
            const valor = proveedorData["PR_TEL"]
            respuesta += `Teléfono: ${valor && valor !== "0" && valor !== "0.00" ? valor : "No disponible"}\n`
            camposEncontrados = true
          }

          if (message.toLowerCase().includes("email") || message.toLowerCase().includes("correo")) {
            const valor = proveedorData["PR_EMA"]
            respuesta += `Email: ${valor && valor !== "0" && valor !== "0.00" ? valor : "No disponible"}\n`
            camposEncontrados = true
          }

          if (message.toLowerCase().includes("dirección") || message.toLowerCase().includes("direccion")) {
            const valor = proveedorData["PR_DOM"]
            respuesta += `Dirección: ${valor && valor !== "0" && valor !== "0.00" ? valor : "No disponible"}\n`
            camposEncontrados = true
          }

          if (message.toLowerCase().includes("provincia")) {
            const valor = proveedorData["PR_PRO"]
            respuesta += `Provincia: ${valor && valor !== "0" && valor !== "0.00" ? valor : "No disponible"}\n`
            camposEncontrados = true
          }

          if (message.toLowerCase().includes("web") || message.toLowerCase().includes("sitio web")) {
            const valor = proveedorData["PR_WEB"]
            respuesta += `Web: ${valor && valor !== "0" && valor !== "0.00" ? valor : "No disponible"}\n`
            camposEncontrados = true
          }

          // Si no se encontró ningún campo específico solicitado
          if (!camposEncontrados) {
            respuesta = `No se encontró la información solicitada para ${context.lastProviderName}. ¿Qué información específica necesitas?`
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
        // Intentar primero con el fallback para consultas comunes
        const fallbackResponse = await fallbackClientes(message)
        if (fallbackResponse) {
          // Guardar la respuesta en el historial
          context.conversationHistory.push({
            role: "assistant",
            content: fallbackResponse,
          })

          return res.json({ response: fallbackResponse })
        }

        // Si el fallback no funcionó, intentar con una consulta SQL
        const [results] = await pool.query("SELECT * FROM clientes LIMIT 5")

        if (results.length > 0) {
          const formatted = results
            .map((row, i) => {
              const nombre = row.CL_DENO || "Cliente sin nombre"
              const localidad = row.CL_POB || "Sin localidad"
              const estado = row.CL_SIT && row.CL_SIT.toUpperCase() === "ACTIVO" ? "Activo" : "De baja"
              return `${i + 1}. ${nombre} - ${localidad} (${estado})`
            })
            .join("\n")

          const respuesta = `Aquí tienes algunos clientes de nuestra base de datos:\n\n${formatted}\n\n¿Necesitas información más específica?`

          // Guardar la respuesta en el historial
          context.conversationHistory.push({
            role: "assistant",
            content: respuesta,
          })

          return res.json({ response: respuesta })
        } else {
          const respuesta = "No se encontraron resultados en la base de datos. ¿Podrías reformular tu consulta?"

          // Guardar la respuesta en el historial
          context.conversationHistory.push({
            role: "assistant",
            content: respuesta,
          })

          return res.json({ response: respuesta })
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

// Mejorar las funciones de respuesta para tener más variedad
function getGreetingResponse() {
  // Obtener la hora actual para personalizar el saludo
  const hora = new Date().getHours()
  let saludoHora = ""

  if (hora >= 5 && hora < 12) {
    saludoHora = "buenos días"
  } else if (hora >= 12 && hora < 20) {
    saludoHora = "buenas tardes"
  } else {
    saludoHora = "buenas noches"
  }

  const greetings = [
    `¡Hola! Soy Deitana IA, ¿en qué puedo ayudarte hoy?`,
    `¡${saludoHora.charAt(0).toUpperCase() + saludoHora.slice(1)}! Estoy aquí para ayudarte con información sobre clientes, productos y más. ¿Qué necesitas?`,
    `Hola, soy el asistente virtual de Semilleros Deitana. ¿Cómo puedo asistirte?`,
    `¡Saludos! ¿Necesitas información sobre algún cliente o producto específico?`,
    `Hola, ¿en qué puedo ayudarte con la base de datos de Semilleros Deitana hoy?`,
    `¡Bienvenido! ¿En qué puedo ayudarte hoy?`,
    `¡Hola! Me alegra verte. ¿Qué información necesitas consultar?`,
    `${saludoHora.charAt(0).toUpperCase() + saludoHora.slice(1)}. Soy Deitana IA, tu asistente para consultas de la base de datos. ¿Qué necesitas saber?`,
    `¡Hola! Estoy listo para ayudarte con cualquier consulta sobre clientes, productos o inventario.`,
    `¡Saludos! Dime qué información necesitas y te ayudaré a encontrarla.`,
  ]

  // Usar un número aleatorio basado en la hora actual para variar las respuestas
  // incluso si se llama varias veces en poco tiempo
  const seed = Date.now() % greetings.length
  return greetings[seed]
}

function getFarewellResponse() {
  const farewells = [
    "¡Hasta luego! Estoy aquí si necesitas más información.",
    "Adiós, ha sido un placer ayudarte. Vuelve cuando necesites más información.",
    "Hasta pronto. No dudes en consultarme cuando necesites datos de la base de Semilleros Deitana.",
    "¡Que tengas un buen día! Estoy disponible cuando me necesites.",
    "Adiós, recuerda que puedo ayudarte con consultas sobre clientes, productos y más información de la base de datos.",
    "¡Hasta la próxima! Estaré aquí cuando necesites consultar algo.",
    "Adiós. Fue un gusto poder asistirte hoy.",
    "Hasta pronto. Recuerda que estoy disponible 24/7 para ayudarte con tus consultas.",
    "¡Que tengas un excelente día! Vuelve cuando quieras.",
    "Adiós. Espero haber sido de ayuda. ¡Hasta la próxima!",
  ]

  // Usar un número aleatorio basado en la hora actual para variar las respuestas
  const seed = Date.now() % farewells.length
  return farewells[seed]
}

function getGratitudeResponse() {
  const gratitude = [
    "De nada, estoy aquí para ayudarte. ¿Necesitas algo más?",
    "No hay de qué. Si necesitas más información, solo pregúntame.",
    "Es un placer poder ayudarte. ¿Hay algo más en lo que pueda asistirte?",
    "Para eso estoy. ¿Necesitas consultar algo más de la base de Semilleros Deitana?",
    "Encantado de ser útil. Estoy disponible si necesitas más información.",
    "¡Con gusto! ¿Hay algo más en lo que pueda ayudarte hoy?",
    "Es mi trabajo ayudarte. ¿Necesitas alguna otra consulta?",
    "Me alegra haber sido útil. ¿Qué más puedo hacer por ti?",
    "No hay problema, para eso estoy aquí. ¿Necesitas algo más?",
    "El placer es mío. ¿Hay alguna otra información que necesites?",
  ]

  // Usar un número aleatorio basado en la hora actual para variar las respuestas
  const seed = Date.now() % gratitude.length
  return gratitude[seed]
}

function getSmallTalkResponse(message) {
  // Respuestas genéricas para conversación casual
  const lowerMessage = message.toLowerCase().trim()

  // Crear un mapa de patrones y posibles respuestas
  const respuestas = {
    // Preguntas sobre el estado
    "cómo estás": [
      "Estoy funcionando perfectamente, gracias por preguntar. ¿En qué puedo ayudarte con la base de datos de Semilleros Deitana?",
      "¡Muy bien! Listo para ayudarte con cualquier consulta que tengas. ¿Qué necesitas saber?",
      "Estoy operando a plena capacidad y listo para asistirte. ¿Qué información necesitas hoy?",
      "Siempre bien y a tu servicio. ¿Cómo puedo ayudarte?",
      "Excelente y listo para responder tus consultas. ¿Qué necesitas?",
    ],

    // Preguntas sobre identidad
    "quién eres": [
      "Soy Deitana IA, el asistente virtual de Semilleros Deitana. Estoy aquí para ayudarte a consultar información de la base de datos de clientes, productos y más.",
      "Me llamo Deitana IA, soy un asistente especializado en la base de datos de Semilleros Deitana. Puedo ayudarte a encontrar información sobre clientes, productos y más.",
      "Soy el asistente virtual de Semilleros Deitana, diseñado para facilitar el acceso a la información de la base de datos de la empresa.",
      "Soy Deitana IA, tu asistente para consultas de datos. Estoy conectado a la base de datos de Semilleros Deitana para ofrecerte información precisa y rápida.",
    ],

    // Preguntas sobre capacidades
    "qué puedes hacer": [
      "Puedo ayudarte a consultar información sobre clientes, productos, stock y más datos de Semilleros Deitana. Por ejemplo, puedes preguntarme sobre un cliente específico o pedirme una lista de clientes activos.",
      "Estoy especializado en consultas a la base de datos de Semilleros Deitana. Puedo buscar información de clientes, mostrar listas de productos, verificar inventario y mucho más.",
      "Puedo buscar clientes por nombre, mostrar listas de productos, verificar estados de inventario, y responder preguntas generales sobre la información almacenada en la base de datos.",
      "Mi función principal es ayudarte a acceder a la información de la base de datos de forma conversacional. Puedo buscar clientes, productos, verificar inventario y más.",
    ],
  }

  // Función para encontrar la mejor coincidencia en las claves
  const encontrarMejorCoincidencia = (mensaje) => {
    for (const patron in respuestas) {
      if (mensaje.includes(patron)) {
        return patron
      }
    }

    // Buscar coincidencias parciales para mensajes cortos
    if (mensaje.length < 10) {
      for (const patron in respuestas) {
        // Si el mensaje es parte del patrón o viceversa
        if (
          patron.includes(mensaje) ||
          (mensaje.length > 3 && patron.split(" ").some((palabra) => palabra.startsWith(mensaje)))
        ) {
          return patron
        }
      }
    }

    return null
  }

  const coincidencia = encontrarMejorCoincidencia(lowerMessage)

  if (coincidencia) {
    const posiblesRespuestas = respuestas[coincidencia]
    return posiblesRespuestas[Math.floor(Math.random() * posiblesRespuestas.length)]
  }

  // Respuestas para mensajes muy cortos o que no coinciden con patrones conocidos
  if (lowerMessage.length < 5) {
    const respuestasCortas = [
      "¿En qué puedo ayudarte hoy? Puedo buscar información de clientes, productos o inventario.",
      "No estoy seguro de entender. ¿Podrías ser más específico sobre qué información necesitas?",
      "Estoy aquí para ayudarte con consultas sobre la base de datos. ¿Qué te gustaría saber?",
      "¿Necesitas información sobre algún cliente o producto en particular?",
      "Dime qué información necesitas y te ayudaré a encontrarla en la base de datos.",
    ]
    return respuestasCortas[Math.floor(Math.random() * respuestasCortas.length)]
  }

  // Respuesta genérica para otras conversaciones casuales
  const respuestasGenericas = [
    "Estoy aquí para ayudarte con consultas sobre la base de datos de Semilleros Deitana. ¿Qué información necesitas consultar hoy?",
    "Mi especialidad es ayudarte con información de la base de datos. ¿Qué datos necesitas encontrar?",
    "Puedo ayudarte a encontrar información en la base de datos. ¿Qué estás buscando específicamente?",
    "¿Necesitas ayuda con alguna consulta específica sobre clientes, productos o inventario?",
    "Estoy listo para asistirte con cualquier consulta de datos. ¿Qué información necesitas?",
  ]

  return respuestasGenericas[Math.floor(Math.random() * respuestasGenericas.length)]
}

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`)
})
