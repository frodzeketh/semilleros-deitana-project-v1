const express = require("express")
const cors = require("cors")
const mysql = require("mysql2/promise")
const axios = require("axios")
const dotenv = require("dotenv")
const fs = require("fs")
const promptBase = require("./promptBase")
const { sendToDeepSeek, getQueryFromIA, getAnalyticalResponse } = require("./utils/deepseek")

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
let ultimasCasasComercialMostradas = []
let ultimasCategoriasLaboralesMostradas = []

// Función para procesar datos de un cliente usando los nombres de columna reales
async function procesarDatosCliente(fila, campos, userPrompt) {
  const cliente = {}
  campos.forEach((key, idx) => {
    // Guardamos todos los valores, incluso los vacíos
    cliente[key] = fila[idx]
  })

  const interpretPrompt = {
    system: `Eres un asistente experto de Semilleros Deitana. Tu tarea es interpretar estos datos de clientes y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
    Incluye todos los datos relevantes, pero preséntalo de forma natural y fácil de entender.
    Mantén el contexto de la conversación.`,
    user: `Datos del cliente:\n${JSON.stringify(cliente, null, 2)}\n\nPregunta del usuario: ${userPrompt}`
  }
  
  const interpretedResponse = await sendToDeepSeek(interpretPrompt);
  return interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
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

// Añadir función para procesar datos de una casa comercial
function procesarDatosCasaComercial(fila, campos, userPrompt) {
  const casa = {}
  campos.forEach((key, idx) => {
    // Guardamos todos los valores, incluso los vacíos
    casa[key] = fila[idx]
  })

  // Claves relevantes en la tabla casas_com
  const id = casa["id"] || "No disponible"
  const denominacion = casa["CC_DENO"] || "No disponible"
  const nombreComercial = casa["CC_NOM"] || ""
  const direccion = casa["CC_DOM"] || "No disponible"
  const ciudad = casa["CC_POB"] || "No disponible"
  const provincia = casa["CC_PROV"] || "No disponible"
  const cp = casa["CC_CDP"] || "No disponible"
  const telefono = casa["CC_TEL"] || "No disponible"
  const fax = casa["CC_FAX"] || "No disponible"
  const cif = casa["CC_CIF"] || "No disponible"
  const email = casa["CC_EMA"] || "No disponible"
  const web = casa["CC_WEB"] || "No disponible"
  const pais = casa["CC_PAIS"] || "No disponible"
  const fechaInicio = casa["CC_DFEC"] || "No disponible"
  const fechaFin = casa["CC_HFEC"] || "No disponible"

  const lowerPrompt = userPrompt.toLowerCase()
  const quiereMasInfo =
    lowerPrompt.includes("todo") || lowerPrompt.includes("más información") || lowerPrompt.includes("completo")

  if (quiereMasInfo) {
    // Devolver todos los campos disponibles que no sean vacíos
    const detalles = Object.entries(casa)
      .filter(([_, v]) => v !== null && v.toString().trim() !== "" && v !== "0" && v !== 0 && v !== "0.00")
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n")
    return `Información completa de la casa comercial:\n\n${detalles}`
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
      lowerPrompt.includes("pais") ||
      lowerPrompt.includes("tarifa") ||
      lowerPrompt.includes("tarifas") ||
      lowerPrompt.includes("validez")

    // Si es una consulta específica, mostrar solo ese campo
    if (campoEspecifico) {
      let respuesta = `Información de la casa comercial ${denominacion}:\n\n`

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

      if (lowerPrompt.includes("tarifa") || lowerPrompt.includes("tarifas") || lowerPrompt.includes("validez")) {
        respuesta += `Validez de tarifas: `
        if (fechaInicio !== "No disponible") respuesta += `Desde ${fechaInicio} `
        if (fechaFin !== "No disponible") respuesta += `Hasta ${fechaFin}`
        respuesta += "\n"
      }

      respuesta += "\n¿Necesitas más información sobre esta casa comercial?"
      return respuesta
    } else {
      // Mostrar información general
      const ubicacion = [direccion, ciudad, provincia, cp].filter((v) => v !== "No disponible").join(", ")

      let respuesta = `Casa comercial encontrada:\n\n`
      respuesta += `ID: ${id}\n`
      respuesta += `Denominación: ${denominacion}\n`

      if (nombreComercial && nombreComercial !== denominacion) {
        respuesta += `Nombre comercial: ${nombreComercial}\n`
      }

      respuesta += `Ubicación: ${ubicacion || "No disponible"}\n`
      respuesta += `Teléfono: ${telefono}\n`
      respuesta += `Email: ${email}\n`

      if (web && web.trim() !== "") {
        respuesta += `Web: ${web}\n`
      }

      respuesta += `País: ${pais}\n`

      // Información sobre validez de tarifas si está disponible
      if (fechaInicio !== "No disponible" || fechaFin !== "No disponible") {
        respuesta += `Validez de tarifas: `
        if (fechaInicio !== "No disponible") respuesta += `Desde ${fechaInicio} `
        if (fechaFin !== "No disponible") respuesta += `Hasta ${fechaFin}`
        respuesta += "\n"
      }

      respuesta += "\n¿Necesitas más información sobre esta casa comercial?"
      return respuesta
    }
  }
}

// Añadir función para procesar datos de una categoría laboral
function procesarDatosCategoria(fila, campos, userPrompt) {
  const categoria = {}
  campos.forEach((key, idx) => {
    // Guardamos todos los valores, incluso los vacíos
    categoria[key] = fila[idx]
  })

  // Claves relevantes en la tabla categorias
  const id = categoria["id"] || "No disponible"
  const denominacion = categoria["CG_DENO"] || "No disponible"
  const salarioDiario = categoria["CG_SALDIA"] || "No disponible"
  const costeHora = categoria["CG_COSHOR"] || "No disponible"
  const dieta = categoria["CG_DIETA"] || "No disponible"
  const horasLaborales = categoria["CG_HORL"] || "No disponible"
  const horasFestivas = categoria["CG_HORF"] || "No disponible"
  const horasExtra = categoria["CG_HOREXT"] || "No disponible"
  const horasLunes = categoria["CG_LUN"] || "No disponible"
  const horasMartes = categoria["CG_MAR"] || "No disponible"
  const horasMiercoles = categoria["CG_MIE"] || "No disponible"
  const horasJueves = categoria["CG_JUE"] || "No disponible"
  const horasViernes = categoria["CG_VIE"] || "No disponible"
  const horasSabado = categoria["CG_SAB"] || "No disponible"
  const horasDomingo = categoria["CG_DOM"] || "No disponible"
  const valorAsistencia = categoria["CG_ASIS"] || "No disponible"
  const valorInasistencia = categoria["CG_INC"] || "No disponible"

  const lowerPrompt = userPrompt.toLowerCase()
  const quiereMasInfo =
    lowerPrompt.includes("todo") || lowerPrompt.includes("más información") || lowerPrompt.includes("completo")

  if (quiereMasInfo) {
    // Devolver todos los campos disponibles que no sean vacíos
    const detalles = Object.entries(categoria)
      .filter(([_, v]) => v !== null && v.toString().trim() !== "" && v !== "0" && v !== 0 && v !== "0.00")
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n")
    return `Información completa de la categoría laboral:\n\n${detalles}`
  } else {
    // Verificar si la consulta es específica sobre algún campo
    const campoEspecifico =
      lowerPrompt.includes("salario") ||
      lowerPrompt.includes("sueldo") ||
      lowerPrompt.includes("coste") ||
      lowerPrompt.includes("costo") ||
      lowerPrompt.includes("hora") ||
      lowerPrompt.includes("dieta") ||
      lowerPrompt.includes("jornada") ||
      lowerPrompt.includes("horario") ||
      lowerPrompt.includes("festivo") ||
      lowerPrompt.includes("extra")

    // Si es una consulta específica, mostrar solo ese campo
    if (campoEspecifico) {
      let respuesta = `Información de la categoría laboral ${denominacion}:\n\n`

      if (lowerPrompt.includes("salario") || lowerPrompt.includes("sueldo")) {
        respuesta += `Salario diario: ${salarioDiario}€\n`
      }

      if (lowerPrompt.includes("coste") || lowerPrompt.includes("costo") || lowerPrompt.includes("hora")) {
        respuesta += `Coste por hora: ${costeHora}€\n`
      }

      if (lowerPrompt.includes("dieta")) {
        respuesta += `Dieta diaria: ${dieta}€\n`
      }

      if (lowerPrompt.includes("jornada") || lowerPrompt.includes("horario")) {
        respuesta += `Horas laborales por día de la semana:\n`
        respuesta += `- Lunes: ${horasLunes}h\n`
        respuesta += `- Martes: ${horasMartes}h\n`
        respuesta += `- Miércoles: ${horasMiercoles}h\n`
        respuesta += `- Jueves: ${horasJueves}h\n`
        respuesta += `- Viernes: ${horasViernes}h\n`
        respuesta += `- Sábado: ${horasSabado}h\n`
        respuesta += `- Domingo: ${horasDomingo}h\n`
      }

      if (lowerPrompt.includes("festivo")) {
        respuesta += `Horas festivas: ${horasFestivas}h\n`
      }

      if (lowerPrompt.includes("extra")) {
        respuesta += `Horas extra: ${horasExtra}h\n`
      }

      respuesta += "\n¿Necesitas más información sobre esta categoría laboral?"
      return respuesta
    } else {
      // Mostrar información general
      let respuesta = `Categoría laboral encontrada:\n\n`
      respuesta += `ID: ${id}\n`
      respuesta += `Denominación: ${denominacion}\n`
      respuesta += `Salario diario: ${salarioDiario}€\n`
      respuesta += `Coste por hora: ${costeHora}€\n`
      respuesta += `Dieta diaria: ${dieta}€\n`

      respuesta += `\nHoras laborales por día de la semana:\n`
      respuesta += `- Lunes: ${horasLunes}h\n`
      respuesta += `- Martes: ${horasMartes}h\n`
      respuesta += `- Miércoles: ${horasMiercoles}h\n`
      respuesta += `- Jueves: ${horasJueves}h\n`
      respuesta += `- Viernes: ${horasViernes}h\n`
      respuesta += `- Sábado: ${horasSabado}h\n`
      respuesta += `- Domingo: ${horasDomingo}h\n`

      respuesta += "\n¿Necesitas más información sobre esta categoría laboral?"
      return respuesta
    }
  }
}

// Añadir función para procesar datos de un dispositivo
// Añadir después de la función procesarDatosCategoria:

// Función para procesar datos de un dispositivo
function procesarDatosDispositivo(dispositivo, observaciones, userPrompt) {
  // Determinar estado
  const estado = dispositivo.DIS_BAJA === 0 ? "Activo" : "Inactivo"

  const lowerPrompt = userPrompt.toLowerCase()
  const quiereMasInfo =
    lowerPrompt.includes("todo") ||
    lowerPrompt.includes("más información") ||
    lowerPrompt.includes("mas información") ||
    lowerPrompt.includes("completo")

  if (quiereMasInfo) {
    // Devolver todos los campos disponibles que no sean vacíos
    const detalles = Object.entries(dispositivo)
      .filter(([_, v]) => v !== null && v.toString().trim() !== "" && v !== "0" && v !== 0 && v !== "0.00")
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n")

    let respuesta = `Información completa del dispositivo:\n\n${detalles}`

    // Añadir observaciones si existen
    if (observaciones && observaciones.length > 0) {
      respuesta += "\n\nObservaciones:\n"
      observaciones.forEach((obs) => {
        respuesta += `- ${obs.C0}\n`
      })
    }

    return respuesta
  } else {
    // Verificar si la consulta es específica sobre algún campo
    const campoEspecifico =
      lowerPrompt.includes("marca") ||
      lowerPrompt.includes("modelo") ||
      lowerPrompt.includes("fecha") ||
      lowerPrompt.includes("compra") ||
      lowerPrompt.includes("mac") ||
      lowerPrompt.includes("ip") ||
      lowerPrompt.includes("clave") ||
      lowerPrompt.includes("key") ||
      lowerPrompt.includes("estado") ||
      lowerPrompt.includes("activo") ||
      lowerPrompt.includes("baja") ||
      lowerPrompt.includes("observación") ||
      lowerPrompt.includes("observacion")

    // Si es una consulta específica, mostrar solo ese campo
    if (campoEspecifico) {
      let respuesta = `Información del dispositivo ${dispositivo.DIS_DENO || dispositivo.id}:\n\n`

      if (lowerPrompt.includes("marca")) {
        respuesta += `Marca: ${dispositivo.DIS_MARCA || "No disponible"}\n`
      }

      if (lowerPrompt.includes("modelo")) {
        respuesta += `Modelo: ${dispositivo.DIS_MOD || "No disponible"}\n`
      }

      if (lowerPrompt.includes("fecha") || lowerPrompt.includes("compra")) {
        if (dispositivo.DIS_FCOM) {
          const fecha = new Date(dispositivo.DIS_FCOM)
          respuesta += `Fecha de compra: ${fecha.toLocaleDateString()}\n`
        } else {
          respuesta += `Fecha de compra: No disponible\n`
        }
      }

      if (lowerPrompt.includes("mac")) {
        respuesta += `MAC Address: ${dispositivo.DIS_MAC || "No disponible"}\n`
      }

      if (lowerPrompt.includes("ip")) {
        respuesta += `Dirección IP: ${dispositivo.DIS_IP || "No disponible"}\n`
      }

      if (lowerPrompt.includes("clave") || lowerPrompt.includes("key")) {
        respuesta += `Clave: ${dispositivo.DIS_KEY || "No disponible"}\n`
      }

      if (lowerPrompt.includes("estado") || lowerPrompt.includes("activo") || lowerPrompt.includes("baja")) {
        respuesta += `Estado: ${estado}\n`
      }

      if (lowerPrompt.includes("observación") || lowerPrompt.includes("observacion")) {
        respuesta += `Observaciones:\n`
        if (observaciones && observaciones.length > 0) {
          observaciones.forEach((obs) => {
            respuesta += `- ${obs.C0}\n`
          })
        } else {
          respuesta += "No hay observaciones registradas\n"
        }
      }

      respuesta += "\n¿Necesitas más información sobre este dispositivo?"
      return respuesta
    } else {
      // Mostrar información general
      let respuesta = `Dispositivo encontrado:\n\n`
      respuesta += `Código: ${dispositivo.id}\n`
      respuesta += `Denominación: ${dispositivo.DIS_DENO || "No disponible"}\n`
      respuesta += `Marca: ${dispositivo.DIS_MARCA || "No disponible"}\n`
      respuesta += `Modelo: ${dispositivo.DIS_MOD || "No disponible"}\n`
      respuesta += `Estado: ${estado}\n`

      // Añadir la última observación si existe
      if (observaciones && observaciones.length > 0) {
        respuesta += `Última observación: ${observaciones[observaciones.length - 1].C0}\n`
      }

      respuesta += "\n¿Necesitas más información sobre este dispositivo?"
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

// Función para buscar una casa comercial por nombre con búsqueda flexible
async function buscarCasaComercialPorNombre(nombre) {
  try {
    // Primero intentamos una búsqueda exacta
    let [results, fields] = await pool.query("SELECT * FROM casas_com WHERE CC_DENO = ? OR CC_NOM = ? LIMIT 1", [
      nombre,
      nombre,
    ])

    // Si no hay resultados, intentamos con LIKE
    if (results.length === 0) {
      ;[results, fields] = await pool.query("SELECT * FROM casas_com WHERE CC_DENO LIKE ? OR CC_NOM LIKE ? LIMIT 1", [
        `%${nombre}%`,
        `%${nombre}%`,
      ])
    }

    // Si aún no hay resultados, intentamos con una búsqueda más flexible
    if (results.length === 0) {
      const palabras = nombre.split(" ").filter((p) => p.length > 2)
      if (palabras.length > 0) {
        const condiciones = palabras.map((p) => `CC_DENO LIKE ? OR CC_NOM LIKE ?`).join(" OR ")
        const parametros = []
        palabras.forEach((p) => {
          parametros.push(`%${p}%`)
          parametros.push(`%${p}%`)
        })
        ;[results, fields] = await pool.query(`SELECT * FROM casas_com WHERE ${condiciones} LIMIT 1`, parametros)
      }
    }

    return { results, fields }
  } catch (error) {
    console.error("Error al buscar casa comercial:", error)
    return { results: [], fields: [] }
  }
}

// Función para buscar una categoría laboral por nombre con búsqueda flexible
async function buscarCategoriaPorNombre(nombre) {
  try {
    // Primero intentamos una búsqueda exacta
    let [results, fields] = await pool.query("SELECT * FROM categorias WHERE CG_DENO = ? LIMIT 1", [nombre])

    // Si no hay resultados, intentamos con LIKE
    if (results.length === 0) {
      ;[results, fields] = await pool.query("SELECT * FROM categorias WHERE CG_DENO LIKE ? LIMIT 1", [`%${nombre}%`])
    }

    // Si aún no hay resultados, intentamos con una búsqueda más flexible
    if (results.length === 0) {
      const palabras = nombre.split(" ").filter((p) => p.length > 2)
      if (palabras.length > 0) {
        const condiciones = palabras.map((p) => `CG_DENO LIKE ?`).join(" OR ")
        const parametros = palabras.map((p) => `%${p}%`)
        ;[results, fields] = await pool.query(`SELECT * FROM categorias WHERE ${condiciones} LIMIT 1`, parametros)
      }
    }

    return { results, fields }
  } catch (error) {
    console.error("Error al buscar categoría:", error)
    return { results: [], fields: [] }
  }
}

// Función para buscar un dispositivo por código o nombre
async function buscarDispositivoPorCodigoONombre(codigoONombre) {
  try {
    // Primero intentamos una búsqueda exacta por ID
    let [dispositivo, fields] = await pool.query("SELECT * FROM dispositivos WHERE id = ? LIMIT 1", [codigoONombre])

    // Si no hay resultados, intentamos con LIKE en el nombre
    if (dispositivo.length === 0) {
      ;[dispositivo, fields] = await pool.query("SELECT * FROM dispositivos WHERE DIS_DENO LIKE ? LIMIT 1", [
        `%${codigoONombre}%`,
      ])
    }

    // Si aún no hay resultados, intentamos con una búsqueda más flexible
    if (dispositivo.length === 0) {
      const palabras = codigoONombre.split(" ").filter((p) => p.length > 2)
      if (palabras.length > 0) {
        const condiciones = palabras.map((p) => `DIS_DENO LIKE ? OR DIS_MARCA LIKE ? OR DIS_MOD LIKE ?`).join(" OR ")
        const parametros = []
        palabras.forEach((p) => {
          parametros.push(`%${p}%`)
          parametros.push(`%${p}%`)
          parametros.push(`%${p}%`)
        })
        ;[dispositivo, fields] = await pool.query(`SELECT * FROM dispositivos WHERE ${condiciones} LIMIT 1`, parametros)
      }
    }

    if (dispositivo.length > 0) {
      // Buscar observaciones asociadas
      const [observaciones] = await pool.query("SELECT * FROM dispositivos_dis_obs WHERE id = ? ORDER BY id2", [
        dispositivo[0].id,
      ])

      return {
        dispositivo: dispositivo[0],
        observaciones,
        fields,
      }
    }

    return { dispositivo: null, observaciones: [], fields: null }
  } catch (error) {
    console.error("Error al buscar dispositivo:", error)
    return { dispositivo: null, observaciones: [], fields: null }
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

// Función para obtener una lista de casas comerciales
async function obtenerListaCasasComerciales(cantidad, mostrarDatos = false) {
  try {
    let query = "SELECT * FROM casas_com"
    query += ` LIMIT ${cantidad}`

    console.log("Ejecutando consulta para lista de casas comerciales:", query)
    const [results] = await pool.query(query)

    if (results.length === 0) {
      return "No se encontraron casas comerciales que cumplan con los criterios."
    }

    // Guardar los resultados en una variable global para consultas de seguimiento
    ultimasCasasComercialMostradas = results

    if (mostrarDatos) {
      // Mostrar información detallada de cada casa comercial
      const formatted = results
        .map((casa, i) => {
          let info = `${i + 1}. ${casa.CC_DENO}\n`
          info += `   Domicilio: ${casa.CC_DOM || "No disponible"}, ${casa.CC_POB || "Sin localidad"}\n`
          info += `   Provincia: ${casa.CC_PROV || "No disponible"}\n`
          info += `   Teléfono: ${casa.CC_TEL || "No disponible"}\n`
          if (casa.CC_EMA && casa.CC_EMA.trim() !== "") {
            info += `   Email: ${casa.CC_EMA}\n`
          }
          if (casa.CC_WEB && casa.CC_WEB.trim() !== "") {
            info += `   Web: ${casa.CC_WEB}\n`
          }
          if (casa.CC_PAIS && casa.CC_PAIS.trim() !== "") {
            info += `   País: ${casa.CC_PAIS}\n`
          }
          return info
        })
        .join("\n")
      return formatted
    } else {
      // Formatear los resultados de forma concisa
      const formatted = results
        .map((row, i) => {
          return `${i + 1}. ${row.CC_DENO} - ${row.CC_POB || "Sin localidad"} - Tel: ${row.CC_TEL || "N/A"}`
        })
        .join("\n")
      return formatted
    }
  } catch (error) {
    console.error("Error al obtener lista de casas comerciales:", error)
    return "Error al obtener la lista de casas comerciales."
  }
}

// Función para obtener una lista de categorías laborales
async function obtenerListaCategorias(cantidad, mostrarDatos = false) {
  try {
    let query = "SELECT * FROM categorias"
    query += ` LIMIT ${cantidad}`

    console.log("Ejecutando consulta para lista de categorías laborales:", query)
    const [results] = await pool.query(query)

    if (results.length === 0) {
      return "No se encontraron categorías laborales que cumplan con los criterios."
    }

    // Guardar los resultados en una variable global para consultas de seguimiento
    ultimasCategoriasLaboralesMostradas = results

    if (mostrarDatos) {
      // Mostrar información detallada de cada categoría
      const formatted = results
        .map((categoria, i) => {
          let info = `${i + 1}. ${categoria.CG_DENO}\n`
          if (categoria.CG_SALDIA) {
            info += `   Salario diario: ${categoria.CG_SALDIA}€\n`
          }
          if (categoria.CG_COSHOR) {
            info += `   Coste por hora: ${categoria.CG_COSHOR}€\n`
          }
          if (categoria.CG_DIETA) {
            info += `   Dieta diaria: ${categoria.CG_DIETA}€\n`
          }

          // Información de horas laborales por día
          const diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
          const camposDias = ["CG_LUN", "CG_MAR", "CG_MIE", "CG_JUE", "CG_VIE", "CG_SAB", "CG_DOM"]

          let horasSemana = ""
          for (let j = 0; j < diasSemana.length; j++) {
            if (categoria[camposDias[j]] !== undefined && categoria[camposDias[j]] !== null) {
              horasSemana += `   ${diasSemana[j]}: ${categoria[camposDias[j]]}h\n`
            }
          }

          if (horasSemana) {
            info += `   Horas por día:\n${horasSemana}`
          }

          return info
        })
        .join("\n")
      return formatted
    } else {
      // Formatear los resultados de forma concisa
      const formatted = results
        .map((row, i) => {
          let salarioInfo = ""
          if (row.CG_SALDIA) {
            salarioInfo = ` - Salario: ${row.CG_SALDIA}€/día`
          } else if (row.CG_COSHOR) {
            salarioInfo = ` - Coste: ${row.CG_COSHOR}€/h`
          }
          return `${i + 1}. ${row.CG_DENO || "Sin nombre"}${salarioInfo}`
        })
        .join("\n")
      return formatted
    }
  } catch (error) {
    console.error("Error al obtener lista de categorías laborales:", error)
    return "Error al obtener la lista de categorías laborales."
  }
}

// Función para obtener una lista de dispositivos
async function obtenerListaDispositivos(cantidad, mostrarDatos = false) {
  try {
    // Esta consulta obtiene los dispositivos con su última observación si existe
    const query = `
      SELECT d.id, d.DIS_DENO, d.DIS_MARCA, d.DIS_MOD, d.DIS_BAJA, o.C0 as UltimaObservacion
      FROM dispositivos d
      LEFT JOIN (
        SELECT id, MAX(id2) as max_id2
        FROM dispositivos_dis_obs
        GROUP BY id
      ) latest ON d.id = latest.id
      LEFT JOIN dispositivos_dis_obs o ON latest.id = o.id AND latest.max_id2 = o.id2
      ORDER BY d.id
      LIMIT ${cantidad}
    `

    console.log("Ejecutando consulta para lista de dispositivos:", query)
    const [results] = await pool.query(query)

    if (results.length === 0) {
      return "No se encontraron dispositivos que cumplan con los criterios."
    }

    // Para almacenar los últimos dispositivos mostrados
    const ultimosDispositivosMostrados = results

    if (mostrarDatos) {
      // Mostrar información detallada de cada dispositivo
      const formatted = results
        .map((dispositivo, i) => {
          // Determinar estado
          const estado = dispositivo.DIS_BAJA === 0 ? "Activo" : "Inactivo"

          let info = `${i + 1}. ${dispositivo.DIS_DENO || "Sin nombre"} (${dispositivo.DIS_MARCA || ""} ${dispositivo.DIS_MOD || ""})\n`
          info += `   Código: ${dispositivo.id}\n`
          info += `   Estado: ${estado}\n`

          if (dispositivo.UltimaObservacion) {
            info += `   Observación: ${dispositivo.UltimaObservacion}\n`
          }

          return info
        })
        .join("\n")
      return formatted
    } else {
      // Formatear los resultados de forma concisa
      const formatted = results
        .map((row, i) => {
          const estado = row.DIS_BAJA === 0 ? "Activo" : "Inactivo"
          let info = `${i + 1}. ${row.DIS_DENO || "Sin nombre"} (${row.DIS_MARCA || ""} ${row.DIS_MOD || ""}) - ${estado}`

          if (row.UltimaObservacion) {
            info += ` - ${row.UltimaObservacion}`
          }

          return info
        })
        .join("\n")
      return formatted
    }
  } catch (error) {
    console.error("Error al obtener lista de dispositivos:", error)
    return "Error al obtener la lista de dispositivos."
  }
}

// Modificar la función fallbackClientes para incluir soporte para categorías
async function fallbackClientes(userMessage) {
  // Detectar si es una solicitud de lista de categorías
  const esListaCategorias =
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:una\s+lista\s+de\s+)?(\d+)?\s*(?:categorías|categorias|categoría|categoria|categorías laborales|categorias laborales)/i.test(
      userMessage,
    ) ||
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:los|las|unos|unas)\s+(\d+)?\s*(?:categorías|categorias|categoría|categoria|categorías laborales|categorias laborales)/i.test(
      userMessage,
    ) ||
    /^(?:información|informacion|datos)\s+(?:de|sobre|acerca de)\s+(?:los|algunos|varios)?\s*(?:categorías|categorias|categoría|categoria|categorías laborales|categorias laborales)/i.test(
      userMessage,
    )

  // Detectar si es una solicitud de lista de casas comerciales
  const esListaCasasComerciales =
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:una\s+lista\s+de\s+)?(\d+)?\s*(?:casas comerciales|casa comercial|casas_com)/i.test(
      userMessage,
    ) ||
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:los|las|unos|unas)\s+(\d+)?\s*(?:casas comerciales|casa comercial|casas_com)/i.test(
      userMessage,
    ) ||
    /^(?:información|informacion|datos)\s+(?:de|sobre|acerca de)\s+(?:los|algunos|varios)?\s*(?:casas comerciales|casa comercial|casas_com)/i.test(
      userMessage,
    )

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
    /(?:quiero|podrías|podrias|puedes)\s+(?:una\s+lista\s+de\s+)?(\d+)?\s*(?:proveedores|proveedor|distribuidores|distribuidor)/i.test(userMessage) ||
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:los|las|unos|unas)\s+(\d+)?\s*(?:proveedores|proveedor|distribuidores|distribuidor)/i.test(userMessage) ||
    /^(?:información|informacion|datos)\s+(?:de|sobre|acerca de)\s+(?:los|algunos|varios)?\s*(?:proveedores|proveedor|distribuidores|distribuidor)/i.test(userMessage);

  // Detectar si es una solicitud de lista de dispositivos
  const esListaDispositivos =
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:una\s+lista\s+de\s+)?(\d+)?\s*(?:dispositivos|dispositivo|pda|pdas|móviles|móvil|moviles|movil|terminales|terminal)/i.test(
      userMessage,
    ) ||
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:los|las|unos|unas)\s+(\d+)?\s*(?:dispositivos|dispositivo|pda|pdas|móviles|móvil|moviles|movil|terminales|terminal)/i.test(
      userMessage,
    ) ||
    /^(?:información|informacion|datos)\s+(?:de|sobre|acerca de)\s+(?:los|algunos|varios)?\s*(?:dispositivos|dispositivo|pda|pdas|móviles|móvil|moviles|movil|terminales|terminal)/i.test(
      userMessage,
    )

  const esClientesActivos = /clientes\s+activos/i.test(userMessage)

  // Detectar si se piden datos completos
  const pideDatosCompletos =
    /datos|información|informacion|completo|completa|detalle|detalles|todo|todos/i.test(userMessage) ||
    /envía|envia|muestra|dame|dime/i.test(userMessage)

  // Extraer el número de clientes/artículos/proveedores/casas comerciales/categorías solicitados
  const cantidadMatch = userMessage.match(
    /(\d+)\s*(?:clientes|articulos|artículos|productos|proveedores|proveedor|distribuidores|distribuidor|casas comerciales|casa comercial|casas_com|categorías|categorias|categoría|categoria|categorías laborales|categorias laborales|dispositivos|dispositivo|pda|pdas|móviles|móvil|moviles|movil|terminales|terminal)/i,
  )
  const cantidad = cantidadMatch ? Number.parseInt(cantidadMatch[1]) : 5 // Por defecto 5 si no se especifica

  if (esListaCategorias) {
    return await obtenerListaCategorias(cantidad, pideDatosCompletos)
  }

  if (esListaCasasComerciales) {
    return await obtenerListaCasasComerciales(cantidad, pideDatosCompletos)
  }

  if (esListaClientes) {
    return await obtenerListaClientes(cantidad, esClientesActivos, false, pideDatosCompletos)
  }

  if (esListaArticulos) {
    return await obtenerListaArticulos(cantidad, pideDatosCompletos)
  }

  if (esListaProveedores) {
    return await obtenerListaProveedores(cantidad, pideDatosCompletos)
  }

  if (esListaDispositivos) {
    return await obtenerListaDispositivos(cantidad, pideDatosCompletos)
  }

  // Verificar si es una solicitud de información sobre los últimos elementos mostrados
  if (
    (ultimosClientesMostrados.length > 0 ||
      ultimosArticulosMostrados.length > 0 ||
      ultimosProveedoresMostrados.length > 0 ||
      ultimasCasasComercialMostradas.length > 0 ||
      ultimasCategoriasLaboralesMostradas.length > 0) &&
    pideDatosCompletos
  ) {
    // Determinar qué tipo de datos mostrar basado en lo último que se mostró
    if (
      ultimosClientesMostrados.length > 0 &&
      ultimosClientesMostrados.length >= ultimosArticulosMostrados.length &&
      ultimosClientesMostrados.length >= ultimosProveedoresMostrados.length &&
      ultimosClientesMostrados.length >= ultimasCasasComercialMostradas.length &&
      ultimosClientesMostrados.length >= ultimasCategoriasLaboralesMostradas.length
    ) {
      return await obtenerListaClientes(ultimosClientesMostrados.length, false, false, true)
    } else if (
      ultimosArticulosMostrados.length > 0 &&
      ultimosArticulosMostrados.length >= ultimosProveedoresMostrados.length &&
      ultimosArticulosMostrados.length >= ultimasCasasComercialMostradas.length &&
      ultimosArticulosMostrados.length >= ultimasCategoriasLaboralesMostradas.length
    ) {
      return await obtenerListaArticulos(ultimosArticulosMostrados.length, true)
    } else if (
      ultimosProveedoresMostrados.length > 0 &&
      ultimosProveedoresMostrados.length >= ultimasCasasComercialMostradas.length &&
      ultimosProveedoresMostrados.length >= ultimasCategoriasLaboralesMostradas.length
    ) {
      return await obtenerListaProveedores(ultimosProveedoresMostrados.length, true)
    } else if (
      ultimasCasasComercialMostradas.length > 0 &&
      ultimasCasasComercialMostradas.length >= ultimasCategoriasLaboralesMostradas.length
    ) {
      return await obtenerListaCasasComerciales(ultimasCasasComercialMostradas.length, true)
    } else if (ultimasCategoriasLaboralesMostradas.length > 0) {
      return await obtenerListaCategorias(ultimasCategoriasLaboralesMostradas.length, true)
    }
  }

  // Extraer posible nombre de categoría
  const categoriaRegex =
    /(?:categoría|categoria|categorías|categorias|categoría laboral|categoria laboral|información|informacion|datos)\s+(?:de|sobre|del|para|acerca)\s+(?:la categoría|categoría|categoria)?\s*([A-Za-z0-9\s.]+)/i
  const categoriaMatch = userMessage.match(categoriaRegex)

  // Extraer posible nombre de casa comercial
  const casaComercialRegex =
    /(?:casa comercial|casas comerciales|casas_com|información|informacion|datos)\s+(?:de|sobre|del|para|acerca)\s+(?:la casa comercial|casa comercial)?\s*([A-Za-z0-9\s.]+)/i
  const casaComercialMatch = userMessage.match(casaComercialRegex)

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

  // Extraer posible código o nombre de dispositivo
  const dispositivoRegex =
    /(?:dispositivo|pda|móvil|movil|terminal|información|informacion|datos|código|codigo)\s+(?:de|sobre|del|para|acerca)\s+(?:el dispositivo|dispositivo|pda)?\s*([A-Za-z0-9\s.]+)/i
  const dispositivoMatch = userMessage.match(dispositivoRegex)

  let dispositivoCodigoONombre = ""
  if (dispositivoMatch && dispositivoMatch[1]) {
    dispositivoCodigoONombre = dispositivoMatch[1].trim()
  } else if (
    userMessage.toLowerCase().includes("dispositivo") ||
    userMessage.toLowerCase().includes("pda") ||
    userMessage.toLowerCase().includes("móvil") ||
    userMessage.toLowerCase().includes("movil") ||
    userMessage.toLowerCase().includes("terminal")
  ) {
    // Buscar cualquier texto que pueda ser un código o nombre de dispositivo
    const posibleDispositivoRegex = /([A-Z0-9][A-Za-z0-9\s.-]+)/g
    const posiblesDispositivos = [...userMessage.matchAll(posibleDispositivoRegex)]
    if (posiblesDispositivos.length > 0) {
      // Tomar el nombre más largo como posible dispositivo
      dispositivoCodigoONombre = posiblesDispositivos
        .reduce((prev, current) => (prev[0].length > current[0].length ? prev : current))[0]
        .trim()
    }
  }

  let categoriaNombre = ""
  if (categoriaMatch && categoriaMatch[1]) {
    categoriaNombre = categoriaMatch[1].trim()
  } else if (
    userMessage.toLowerCase().includes("categoría") ||
    userMessage.toLowerCase().includes("categoria") ||
    userMessage.toLowerCase().includes("categorías") ||
    userMessage.toLowerCase().includes("categorias") ||
    userMessage.toLowerCase().includes("categoría laboral") ||
    userMessage.toLowerCase().includes("categoria laboral")
  ) {
    // Buscar cualquier nombre que pueda ser una categoría (palabras en mayúsculas)
    const posibleCategoriaRegex = /([A-Z][A-Za-z0-9\s.-]+)/g
    const posiblesCategorias = [...userMessage.matchAll(posibleCategoriaRegex)]
    if (posiblesCategorias.length > 0) {
      // Tomar el nombre más largo como posible categoría
      categoriaNombre = posiblesCategorias
        .reduce((prev, current) => (prev[0].length > current[0].length ? prev : current))[0]
        .trim()
    }
  }

  let casaComercialNombre = ""
  if (casaComercialMatch && casaComercialMatch[1]) {
    casaComercialNombre = casaComercialMatch[1].trim()
  } else if (
    userMessage.toLowerCase().includes("casa comercial") ||
    userMessage.toLowerCase().includes("casas comerciales") ||
    userMessage.toLowerCase().includes("casas_com")
  ) {
    // Buscar cualquier nombre que pueda ser una casa comercial (palabras en mayúsculas o con puntos)
    const posibleCasaComercialRegex = /([A-Z][A-Za-z0-9\s.-]+(?:\s+S\.?(?:COOP|L|A|C\.?V|R\.?L))?)/g
    const posiblesCasasComerciales = [...userMessage.matchAll(posibleCasaComercialRegex)]
    if (posiblesCasasComerciales.length > 0) {
      // Tomar el nombre más largo como posible casa comercial
      casaComercialNombre = posiblesCasasComerciales
        .reduce((prev, current) => (prev[0].length > current[0].length ? prev : current))[0]
        .trim()
    }
  }

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
      !userMessage.toLowerCase().includes("producto") &&
      !userMessage.toLowerCase().includes("casa comercial") &&
      !userMessage.toLowerCase().includes("casas comerciales") &&
      !userMessage.toLowerCase().includes("casas_com") &&
      !userMessage.toLowerCase().includes("categoría") &&
      !userMessage.toLowerCase().includes("categoria") &&
      !userMessage.toLowerCase().includes("categorías") &&
      !userMessage.toLowerCase().includes("categorias")
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

  // Si tenemos un nombre de categoría, intentar buscarla primero
  if (
    categoriaNombre ||
    userMessage.toLowerCase().includes("categoría") ||
    userMessage.toLowerCase().includes("categoria") ||
    userMessage.toLowerCase().includes("categorías") ||
    userMessage.toLowerCase().includes("categorias") ||
    userMessage.toLowerCase().includes("categoría laboral") ||
    userMessage.toLowerCase().includes("categoria laboral")
  ) {
    console.log(`Buscando categoría: "${categoriaNombre || "consulta general"}"`)
    const { results, fields } = await buscarCategoriaPorNombre(categoriaNombre)

    if (results.length > 0 && fields) {
      const campos = fields.map((f) => f.name)
      const fila = Object.values(results[0])
      return procesarDatosCategoria(fila, campos, userMessage)
    }
  }

  // Si tenemos un nombre de casa comercial, intentar buscarla primero
  if (
    casaComercialNombre ||
    userMessage.toLowerCase().includes("casa comercial") ||
    userMessage.toLowerCase().includes("casas comerciales") ||
    userMessage.toLowerCase().includes("casas_com")
  ) {
    console.log(`Buscando casa comercial: "${casaComercialNombre || "consulta general"}"`)
    const { results, fields } = await buscarCasaComercialPorNombre(casaComercialNombre)

    if (results.length > 0 && fields) {
      const campos = fields.map((f) => f.name)
      const fila = Object.values(results[0])
      return procesarDatosCasaComercial(fila, campos, userMessage)
    }
  }

  // Si tenemos un código o nombre de dispositivo, intentar buscarlo
  if (
    dispositivoCodigoONombre ||
    userMessage.toLowerCase().includes("dispositivo") ||
    userMessage.toLowerCase().includes("pda") ||
    userMessage.toLowerCase().includes("móvil") ||
    userMessage.toLowerCase().includes("movil") ||
    userMessage.toLowerCase().includes("terminal")
  ) {
    console.log(`Buscando dispositivo: "${dispositivoCodigoONombre || "consulta general"}"`)
    const { dispositivo, observaciones } = await buscarDispositivoPorCodigoONombre(dispositivoCodigoONombre)

    if (dispositivo) {
      return procesarDatosDispositivo(dispositivo, observaciones, userMessage)
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
    !userMessage.toLowerCase().includes("producto") &&
    !userMessage.toLowerCase().includes("casa comercial") &&
    !userMessage.toLowerCase().includes("casas comerciales") &&
    !userMessage.toLowerCase().includes("casas_com") &&
    !userMessage.toLowerCase().includes("categoría") &&
    !userMessage.toLowerCase().includes("categoria") &&
    !userMessage.toLowerCase().includes("categorías") &&
    !userMessage.toLowerCase().includes("categorias")
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

  // Si no se encontró un cliente, artículo, proveedor, casa comercial o categoría específica, buscar varios clientes
  const match = userMessage.match(
    /(\d+)\s*(?:clientes|articulos|artículos|productos|proveedores|proveedor|distribuidores|distribuidor|casas comerciales|casa comercial|casas_com|categorías|categorias|categoría|categoria|categorías laborales|categorias laborales)/i,
  )
  const cantidadClientes = match ? Number.parseInt(match[1]) : 5 // Si no se encuentra, usar 5 por defecto

  // Si es una solicitud de lista de categorías, usar la función especializada
  if (
    userMessage.toLowerCase().includes("categoría") ||
    userMessage.toLowerCase().includes("categoria") ||
    userMessage.toLowerCase().includes("categorías") ||
    userMessage.toLowerCase().includes("categorias") ||
    userMessage.toLowerCase().includes("categoría laboral") ||
    userMessage.toLowerCase().includes("categoria laboral")
  ) {
    return await obtenerListaCategorias(cantidadClientes, pideDatosCompletos)
  }

  // Si es una solicitud de lista de casas comerciales, usar la función especializada
  if (
    userMessage.toLowerCase().includes("casa comercial") ||
    userMessage.toLowerCase().includes("casas comerciales") ||
    userMessage.toLowerCase().includes("casas_com")
  ) {
    return await obtenerListaCasasComerciales(cantidadClientes, pideDatosCompletos)
  }

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

// Modificar la función detectIntentFn para incluir detección de intenciones relacionadas con categorías
function detectIntentFn(message, context) {
  const lowerMessage = message.toLowerCase().trim()

  // Detectar si es una consulta sobre categorías
  const isCategoriasQuery =
    lowerMessage.includes("categoría") ||
    lowerMessage.includes("categoria") ||
    lowerMessage.includes("categorías") ||
    lowerMessage.includes("categorias") ||
    lowerMessage.includes("categoría laboral") ||
    lowerMessage.includes("categoria laboral") ||
    lowerMessage.includes("categorías laborales") ||
    lowerMessage.includes("categorias laborales") ||
    lowerMessage.includes("salario") ||
    lowerMessage.includes("coste laboral") ||
    lowerMessage.includes("horas laborales")

  if (isCategoriasQuery) {
    return "categorias_query"
  }

  // Detectar si es una consulta sobre casas comerciales
  const isCasasComQuery =
    lowerMessage.includes("casa comercial") ||
    lowerMessage.includes("casas comerciales") ||
    lowerMessage.includes("casas_com") ||
    lowerMessage.includes("proveedor principal") ||
    lowerMessage.includes("proveedores principales")

  if (isCasasComQuery) {
    return "casas_com_query"
  }

  // Detectar si es una consulta sobre macetas
  const isMacetasQuery = lowerMessage.includes("maceta") || lowerMessage.includes("macetas")

  if (isMacetasQuery) {
    return "macetas_query"
  }

  // Detectar si es una consulta sobre dispositivos
  const isDispositivosQuery =
    lowerMessage.includes("dispositivo") ||
    lowerMessage.includes("dispositivos") ||
    lowerMessage.includes("pda") ||
    lowerMessage.includes("pdas") ||
    lowerMessage.includes("móvil") ||
    lowerMessage.includes("móviles") ||
    lowerMessage.includes("movil") ||
    lowerMessage.includes("moviles") ||
    lowerMessage.includes("terminal") ||
    lowerMessage.includes("terminales")

  if (isDispositivosQuery) {
    return "dispositivos_query"
  }

  // Detectar si es una consulta múltiple
  const isMultipleQuery =
    (lowerMessage.includes("cliente") &&
      (lowerMessage.includes("casa comercial") || lowerMessage.includes("casas comerciales"))) ||
    (lowerMessage.includes("cliente") && lowerMessage.includes("proveedor")) ||
    (lowerMessage.includes("artículo") && lowerMessage.includes("proveedor")) ||
    (lowerMessage.includes("articulo") && lowerMessage.includes("proveedor"))

  if (isMultipleQuery) {
    return "multiple_query"
  }

  // Detect if the query is asking for a definition or explanation
  const isDefinitionQuery =
    lowerMessage.includes("qué son") ||
    lowerMessage.includes("que son") ||
    lowerMessage.includes("qué es") ||
    lowerMessage.includes("que es") ||
    lowerMessage.includes("definición de") ||
    lowerMessage.includes("definicion de") ||
    lowerMessage.includes("explica") ||
    lowerMessage.includes("explicar") ||
    lowerMessage.includes("significado de") ||
    lowerMessage.includes("para qué sirve") ||
    lowerMessage.includes("para que sirve") ||
    lowerMessage.includes("cómo funciona") ||
    lowerMessage.includes("como funciona") ||
    lowerMessage.includes("por qué son importantes") ||
    lowerMessage.includes("por que son importantes")

  if (isDefinitionQuery) {
    return "definition_query"
  }

  // Detectar consultas simples sobre clientes
  const isSimpleClientQuery =
    (lowerMessage.includes("cliente") || lowerMessage.includes("clientes")) &&
    (lowerMessage.startsWith("dime") ||
      lowerMessage.startsWith("dame") ||
      lowerMessage.startsWith("muestra") ||
      lowerMessage.startsWith("lista") ||
      lowerMessage.startsWith("podrias") ||
      lowerMessage.startsWith("podrías") ||
      lowerMessage.startsWith("puedes"))

  if (isSimpleClientQuery) {
    return "client_list"
  }

  // Detectar si es una consulta analítica sobre bandejas o datos específicos
  const isAnalyticalQuery =
    (lowerMessage.includes("bandeja") &&
      (lowerMessage.includes("más") || lowerMessage.includes("mayor") || lowerMessage.includes("alveolo"))) ||
    (lowerMessage.includes("información") && lowerMessage.includes("bandeja")) ||
    (lowerMessage.includes("cuál") && lowerMessage.includes("bandeja")) ||
    (lowerMessage.includes("cual") && lowerMessage.includes("bandeja")) ||
    (lowerMessage.includes("código") && lowerMessage.includes("bandeja")) ||
    (lowerMessage.includes("codigo") && lowerMessage.includes("bandeja"))

  if (isAnalyticalQuery) {
    return "analytical_query"
  }

  // Detectar consulta de seguimiento sobre bandeja específica
  const isBandejaFollowUp =
    context.lastQuery &&
    context.lastQuery.toLowerCase().includes("bandeja") &&
    (lowerMessage.includes("código") ||
      lowerMessage.includes("codigo") ||
      lowerMessage.includes("más información") ||
      lowerMessage.includes("mas información"))

  if (isBandejaFollowUp) {
    return "bandeja_followup"
  }

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

  // Detectar despedidas con mayor tolerance a errores
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

  // Detect specific table queries
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
    macetas: /maceta[s]?/i,
    dispositivos: /dispositivo[s]?|pda[s]?|móvil[es]?|movil[es]?|terminal[es]?/i,
  }

  // Find which table the query is most likely about
  for (const [table, pattern] of Object.entries(specificTableQueries)) {
    if (pattern.test(lowerMessage)) {
      return `${table}_query`
    }
  }

  // Detectar solicitud de lista de categorías
  const esListaCategorias =
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:una\s+lista\s+de\s+)?(\d+)?\s*(?:categorías|categorias|categoría|categoria|categorías laborales|categorias laborales)/i.test(
      message,
    ) ||
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:los|las|unos|unas)\s+(\d+)?\s*(?:categorías|categorias|categoría|categoria|categorías laborales|categorias laborales)/i.test(
      message,
    ) ||
    /^(?:información|informacion|datos)\s+(?:de|sobre|acerca de)\s+(?:los|algunos|varios)?\s*(?:categorías|categorias|categoría|categoria|categorías laborales|categorias laborales)/i.test(
      message,
    )

  if (esListaCategorias) {
    return "categorias_list"
  }

  // Detectar solicitud de lista de casas comerciales
  const esListaCasasComerciales =
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:una\s+lista\s+de\s+)?(\d+)?\s*(?:casas comerciales|casa comercial|casas_com)/i.test(
      message,
    ) ||
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:los|las|unos|unas)\s+(\d+)?\s*(?:casas comerciales|casa comercial|casas_com)/i.test(
      message,
    ) ||
    /^(?:información|informacion|datos)\s+(?:de|sobre|acerca de)\s+(?:los|algunos|varios)?\s*(?:casas comerciales|casa comercial|casas_com)/i.test(
      message,
    )

  if (esListaCasasComerciales) {
    return "casas_com_list"
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

  // Detectar solicitud de lista o ejemplos de macetas
  const esListaMacetas =
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:una\s+lista\s+de\s+)?(\d+)?\s*(?:macetas|maceta)/i.test(
      message,
    ) ||
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:los|las|unos|unas)\s+(\d+)?\s*(?:macetas|maceta)/i.test(
      message,
    ) ||
    /^(?:información|informacion|datos|ejemplo|ejemplos)\s+(?:de|sobre|acerca de)\s+(?:los|algunos|varios)?\s*(?:macetas|maceta)/i.test(
      message,
    )

  // Detectar solicitud de lista de dispositivos
  const esListaDispositivos =
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:una\s+lista\s+de\s+)?(\d+)?\s*(?:dispositivos|dispositivo|pda|pdas|móviles|móvil|moviles|movil|terminales|terminal)/i.test(
      message,
    ) ||
    /^(?:dame|dime|muestra|lista|listar|mostrar|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:los|las|unos|unas)\s+(\d+)?\s*(?:dispositivos|dispositivo|pda|pdas|móviles|móvil|moviles|movil|terminales|terminal)/i.test(
      message,
    ) ||
    /^(?:información|informacion|datos)\s+(?:de|sobre|acerca de)\s+(?:los|algunos|varios)?\s*(?:dispositivos|dispositivo|pda|pdas|móviles|móvil|moviles|movil|terminales|terminal)/i.test(
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

  if (esListaMacetas) {
    return "macetas_list"
  }

  if (esListaDispositivos) {
    return "dispositivos_list"
  }

  // Detectar solicitud de ejemplos de bandejas
  const esEjemplosBandejas =
    /^(?:dame|dime|muestra|ver|obtener|necesito|quiero|podrías|podrias|puedes)\s+(?:\d+)?\s*(?:ejemplo|ejemplos)\s+(?:de)?\s*(?:bandejas|bandeja)/i.test(
      message,
    )

  if (esEjemplosBandejas) {
    return "bandejas_examples"
  }

  // Detectar si es una solicitud de información sobre los últimos elementos mostrados
  const pideDatosCompletos =
    /datos|información|informacion|completo|completa|detalle|detalles|todo|todos/i.test(message) ||
    /envía|envia|muestra|dame|dime/i.test(message)

  if (
    (ultimosClientesMostrados.length > 0 ||
      ultimosArticulosMostrados.length > 0 ||
      ultimosProveedoresMostrados.length > 0 ||
      ultimasCasasComercialMostradas.length > 0 ||
      ultimasCategoriasLaboralesMostradas.length > 0) &&
    pideDatosCompletos
  ) {
    return "show_details"
  }

  // Detectar consulta sobre categoría específica
  const categoriaRegex =
    /(?:categoría|categoria|categorías|categorias|categoría laboral|categoria laboral|información|informacion|datos)\s+(?:de|sobre|del|para|acerca)\s+(?:la categoría|categoría|categoria)?\s*([A-Za-z0-9\s.]+)/i
  const categoriaMatch = message.match(categoriaRegex)

  // Detectar consulta sobre casa comercial específica
  const casaComercialRegex =
    /(?:casa comercial|casas comerciales|casas_com|información|informacion|datos)\s+(?:de|sobre|del|para|acerca)\s+(?:la casa comercial|casa comercial)?\s*([A-Za-z0-9\s.]+)/i
  const casaComercialMatch = message.match(casaComercialRegex)

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

  // Detectar consulta sobre dispositivo específico
  const dispositivoRegex =
    /(?:dispositivo|pda|móvil|movil|terminal|información|informacion|datos|código|codigo)\s+(?:de|sobre|del|para|acerca)\s+(?:el dispositivo|dispositivo|pda)?\s*([A-Za-z0-9\s.]+)/i
  const dispositivoMatch = message.match(dispositivoRegex)

  if (categoriaMatch && categoriaMatch[1]) {
    return "categorias_query"
  }

  if (casaComercialMatch && casaComercialMatch[1]) {
    return "casas_com_query"
  }

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

  if (dispositivoMatch && dispositivoMatch[1]) {
    return "dispositivos_query"
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

  // Detectar si es una pregunta de seguimiento sobre la última casa comercial
  const isCasaComercialFollowUpQuestion =
    context.lastCasaComercialName &&
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
      lowerMessage.includes("tarifa") ||
      lowerMessage.includes("tarifas") ||
      lowerMessage.includes("validez"))

  if (isCasaComercialFollowUpQuestion) {
    return "casas_com_followup_query"
  }

  // Detectar si es una pregunta de seguimiento sobre la última categoría laboral
  const isCategoriaFollowUpQuestion =
    context.lastCategoriaName &&
    (lowerMessage.includes("salario") ||
      lowerMessage.includes("sueldo") ||
      lowerMessage.includes("coste") ||
      lowerMessage.includes("costo") ||
      lowerMessage.includes("hora") ||
      lowerMessage.includes("dieta") ||
      lowerMessage.includes("jornada") ||
      lowerMessage.includes("horario") ||
      lowerMessage.includes("festivo") ||
      lowerMessage.includes("extra") ||
      lowerMessage.includes("más información") ||
      lowerMessage.includes("mas informacion") ||
      lowerMessage.includes("todo") ||
      lowerMessage.includes("completo"))

  if (isCategoriaFollowUpQuestion) {
    return "categorias_followup_query"
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
    !/cliente|artículo|articulo|producto|stock|inventario|factura|pedido|venta|compra|select|from|where|proveedor|proveedores|casa comercial|casas comerciales|casas_com|categoría|categoria|categorías|categorias/i.test(
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

  // Guardar el mensaje actual para contexto futuro
  context.lastQuery = message

  // Si no se detecta ninguna intención específica, asumir que es una consulta de base de datos
  return "database_query"
}

// Modificar la función app.post("/chat"...) para mejorar el manejo de consultas
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
      lastCasaComercialName: null,
      lastCasaComercialData: null,
      lastCategoriaName: null,
      lastCategoriaData: null,
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

  // Guardar el mensaje actual para consultas de seguimiento
  context.lastQuery = message

  console.log("Mensaje recibido:", message)

  try {
    // Detectar la intención del mensaje
    const intent = detectIntentFn(message, context)
    console.log("Intención detectada:", intent)

    // Manejar diferentes tipos de intenciones
    switch (intent) {
      case "multiple_query":
        try {
          // Usar la función analítica para consultas múltiples
          const response = await getAnalyticalResponse(message)

          if (response) {
            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: response,
            })

            return res.json({ response })
          }

          // Si no hay respuesta analítica, usar un mensaje genérico
          const fallbackResponse =
            "Lo siento, pero no pude obtener la información solicitada. ¿Podrías hacer preguntas separadas para cada tipo de información que necesitas?"

          // Guardar la respuesta en el historial
          context.conversationHistory.push({
            role: "assistant",
            content: fallbackResponse,
          })

          return res.json({ response: fallbackResponse })
        } catch (error) {
          console.error("Error al procesar consulta múltiple:", error)
          return res.json({
            response:
              "Lo siento, hubo un error al procesar tu consulta múltiple. Intenta hacer preguntas individuales.",
          })
        }

      case "macetas_query":
      case "macetas_list":
        try {
          // Intentar con la función analítica para macetas
          const response = await getAnalyticalResponse(message)

          if (response) {
            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: response,
            })

            return res.json({ response })
          }

          // Si no hay resultados, buscar en la base de datos
          const cantidadMatch = message.match(/(\d+)\s*(?:ejemplo|ejemplos|macetas|maceta)/i)
          const cantidad = cantidadMatch ? Number.parseInt(cantidadMatch[1]) : 5

          const [results] = await db.query(`SELECT * FROM bandejas WHERE BN_DENO LIKE '%MACETA%' LIMIT ${cantidad}`)

          if (results.length > 0) {
            let respuesta = `Aquí tienes ${cantidad === 1 ? "un ejemplo de maceta" : `${cantidad} ejemplos de macetas`} de nuestro inventario:\n\n`

            results.forEach((maceta, i) => {
              respuesta += `${i + 1}. ${maceta.BN_DENO} (Código: ${maceta.id})\n`
              if (maceta.BN_ALV) respuesta += `   Alvéolos: ${maceta.BN_ALV}\n`
              respuesta += `   Retornable: ${maceta.BN_RET === "S" ? "Sí" : "No"}\n\n`
            })

            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: respuesta,
            })

            return res.json({ response: respuesta })
          } else {
            const respuesta = "Lo siento, no pude encontrar información sobre macetas en nuestra base de datos."

            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: respuesta,
            })

            return res.json({ response: respuesta })
          }
        } catch (error) {
          console.error("Error al procesar consulta de macetas:", error)
          return res.json({
            response: "Lo siento, hubo un error al buscar información sobre macetas. ¿Podrías reformular tu consulta?",
          })
        }

      case "bandejas_examples":
        try {
          // Intentar con la función analítica que maneja el contexto
          const response = await getAnalyticalResponse(message)
          
          if (response) {
            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: response,
            })
            return res.json({ response })
          }

          // Si no hay respuesta analítica, intentar con una consulta SQL
          const sqlQuery = await getQueryFromIA(message)
          const [results] = await db.query(sqlQuery)
          
          if (results && results.length > 0) {
            // Generar un prompt para que la IA interprete los resultados
            const interpretPrompt = {
              system: `Eres un asistente experto de Semilleros Deitana. El usuario ha preguntado sobre bandejas.
              Tu tarea es interpretar estos resultados y responder de manera conversacional y amigable, como si fueras parte del equipo de la empresa.
              
              IMPORTANTE:
              1. Proporciona una explicación clara sobre qué son las bandejas y su importancia
              2. Menciona los tipos de bandejas que existen (por tamaño, número de alvéolos, etc.)
              3. Explica su uso en el contexto de un semillero
              4. Ofrece un ejemplo concreto de una bandeja común
              5. Invita al usuario a hacer preguntas más específicas si lo desea
              
              Responde de manera conversacional y amigable, como si estuvieras hablando con un colega.`,
              user: `Pregunta original: "${message}"
Resultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
            }
            
            const interpretedResponse = await sendToDeepSeek(interpretPrompt)
            const finalResponse = interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "")
            
            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: finalResponse,
            })
            
            return res.json({ response: finalResponse })
          }

          return res.json({
            response: "Lo siento, no pude encontrar información sobre bandejas. ¿Podrías reformular tu consulta?",
          })
        } catch (error) {
          console.error("Error al procesar consulta de bandejas:", error)
          return res.json({
            response: "Lo siento, hubo un error al buscar información sobre bandejas. ¿Podrías reformular tu consulta?",
          })
        }

      case "bandeja_followup":
        try {
          // Consulta para obtener la bandeja con más alvéolos
          const [results] = await db.query("SELECT * FROM bandejas ORDER BY BN_ALV DESC LIMIT 1")

          if (results.length > 0) {
            const bandeja = results[0]
            const respuesta = `El código de la bandeja con más alvéolos (${bandeja.BN_ALV}) es "${bandeja.id}" y su denominación es "${bandeja.BN_DENO}".`

            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: respuesta,
            })

            return res.json({ response: respuesta })
          } else {
            const respuesta = "Lo siento, no pude encontrar información sobre la bandeja solicitada."

            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: respuesta,
            })

            return res.json({ response: respuesta })
          }
        } catch (error) {
          console.error("Error al procesar seguimiento de bandejas:", error)
          return res.json({
            response:
              "Lo siento, hubo un error al buscar información sobre la bandeja. ¿Podrías reformular tu consulta?",
          })
        }

      case "categorias_query":
      case "categorias_list":
        try {
          // Intentar primero con la función analítica
          const response = await getAnalyticalResponse(message)

          // Si tenemos una respuesta, la devolvemos
          if (response) {
            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: response,
            })

            return res.json({ response })
          }

          // Si no, usar el fallback
          const fallbackResponse = await fallbackClientes(message)
          if (fallbackResponse) {
            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: fallbackResponse,
            })

            return res.json({ response: fallbackResponse })
          }

          // Si el fallback tampoco funcionó, intentar con una consulta SQL
          const [results] = await pool.query("SELECT * FROM categorias LIMIT 5")

          if (results.length > 0) {
            const formatted = results
              .map((row, i) => {
                let salarioInfo = ""
                if (row.CG_SALDIA) {
                  salarioInfo = ` - Salario: ${row.CG_SALDIA}€/día`
                } else if (row.CG_COSHOR) {
                  salarioInfo = ` - Coste: ${row.CG_COSHOR}€/h`
                }
                return `${i + 1}. ${row.CG_DENO || "Sin nombre"}${salarioInfo}`
              })
              .join("\n")

            const respuesta = `Aquí tienes algunas categorías laborales:\n\n${formatted}\n\n¿Necesitas información más específica?`

            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: respuesta,
            })

            return res.json({ response: respuesta })
          } else {
            const respuesta = "No se encontraron categorías laborales en la base de datos."

            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: respuesta,
            })

            return res.json({ response: respuesta })
          }
        } catch (error) {
          console.error("Error al procesar consulta de categorías laborales:", error)
          return res.json({
            response:
              "Lo siento, no pude obtener información sobre categorías laborales. ¿Podrías reformular tu consulta?",
          })
        }

      case "casas_com_query":
      case "casas_com_list":
        try {
          // Intentar primero con la función analítica
          const response = await getAnalyticalResponse(message)

          // Si tenemos una respuesta, la devolvemos
          if (response) {
            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: response,
            })

            return res.json({ response })
          }

          // Si no, usar el fallback
          const fallbackResponse = await fallbackClientes(message)
          if (fallbackResponse) {
            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: fallbackResponse,
            })

            return res.json({ response: fallbackResponse })
          }

          // Si el fallback tampoco funcionó, intentar con una consulta SQL
          const [results] = await pool.query("SELECT * FROM casas_com LIMIT 5")

          if (results.length > 0) {
            const formatted = results
              .map((row, i) => {
                return `${i + 1}. ${row.CC_DENO || "Sin nombre"} - ${row.CC_POB || "Sin localidad"} - Tel: ${row.CC_TEL || "N/A"}`
              })
              .join("\n")

            const respuesta = `Aquí tienes algunas casas comerciales:\n\n${formatted}\n\n¿Necesitas información más específica?`

            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: respuesta,
            })

            return res.json({ response: respuesta })
          } else {
            const respuesta = "No se encontraron casas comerciales en la base de datos."

            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: respuesta,
            })

            return res.json({ response: respuesta })
          }
        } catch (error) {
          console.error("Error al procesar consulta de casas comerciales:", error)
          return res.json({
            response:
              "Lo siento, no pude obtener información sobre casas comerciales. ¿Podrías reformular tu consulta?",
          })
        }

      case "dispositivos_query":
      case "dispositivos_list":
        try {
          // Intentar primero con la función analítica
          const response = await getAnalyticalResponse(message)

          // Si tenemos una respuesta, la devolvemos
          if (response) {
            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: response,
            })

            return res.json({ response })
          }

          // Si no, usar el fallback
          const fallbackResponse = await fallbackClientes(message)
          if (fallbackResponse) {
            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: fallbackResponse,
            })

            return res.json({ response: fallbackResponse })
          }

          // Si el fallback tampoco funcionó, intentar con una consulta SQL
          const [results] = await pool.query(`
            SELECT d.id, d.DIS_DENO, d.DIS_MARCA, d.DIS_MOD, d.DIS_BAJA, o.C0 as UltimaObservacion
            FROM dispositivos d
            LEFT JOIN (
              SELECT id, MAX(id2) as max_id2
              FROM dispositivos_dis_obs
              GROUP BY id
            ) latest ON d.id = latest.id
            LEFT JOIN dispositivos_dis_obs o ON latest.id = o.id AND latest.max_id2 = o.id2
            ORDER BY d.id
            LIMIT 5
          `)

          if (results.length > 0) {
            const formatted = results
              .map((row, i) => {
                const estado = row.DIS_BAJA === 0 ? "Activo" : "Inactivo"
                let info = `${i + 1}. ${row.DIS_DENO || "Sin nombre"} (${row.DIS_MARCA || ""} ${row.DIS_MOD || ""})`
                info += ` - Estado: ${estado}`

                if (row.UltimaObservacion) {
                  info += ` - ${row.UltimaObservacion}`
                }

                return info
              })
              .join("\n")

            const respuesta = `Aquí tienes algunos dispositivos registrados:\n\n${formatted}\n\n¿Necesitas información más específica?`

            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: respuesta,
            })

            return res.json({ response: respuesta })
          } else {
            const respuesta = "No se encontraron dispositivos en la base de datos."

            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: respuesta,
            })

            return res.json({ response: respuesta })
          }
        } catch (error) {
          console.error("Error al procesar consulta de dispositivos:", error)
          return res.json({
            response: "Lo siento, no pude obtener información sobre dispositivos. ¿Podrías reformular tu consulta?",
          })
        }

      case "definition_query":
        try {
          // Use DeepSeek API to get a definition response
          const promptBase = require("./promptBase")
          const prompt = promptBase(message)
          const { sendToDeepSeek } = require("./utils/deepseek")

          const aiResponse = await sendToDeepSeek(prompt)

          // Clean up the response if needed
          let cleanResponse = aiResponse
          if (aiResponse.startsWith("CONVERSACIONAL:")) {
            cleanResponse = aiResponse.substring(15).trim()
          }

          // Save the response in conversation history
          context.conversationHistory.push({
            role: "assistant",
            content: cleanResponse,
          })

          return res.json({ response: cleanResponse })
        } catch (error) {
          console.error("Error al procesar consulta de definición:", error)
          return res.json({
            response: "Lo siento, no pude generar una definición para esa consulta. ¿Podrías reformularla?",
          })
        }

      case "analytical_query":
        try {
          // Usar la nueva función para consultas analíticas
          const response = await getAnalyticalResponse(message)

          // Si la función analítica no pudo manejar la consulta, usar el fallback
          if (!response) {
            console.log("La función analítica no pudo manejar la consulta, usando fallback")
            const fallbackResponse = await fallbackClientes(message)

            if (fallbackResponse) {
              // Guardar la respuesta en el historial
              context.conversationHistory.push({
                role: "assistant",
                content: fallbackResponse,
              })
              return res.json({ response: fallbackResponse })
            } else {
              throw new Error("El fallback tampoco pudo manejar la consulta")
            }
          }

          // Guardar la respuesta en el historial
          context.conversationHistory.push({
            role: "assistant",
            content: response,
          })

          return res.json({ response })
        } catch (error) {
          console.error("Error al procesar consulta analítica:", error)
          // Si falla la consulta analítica, intentar con el fallback
          try {
            const fallbackResponse = await fallbackClientes(message)
            if (fallbackResponse) {
              context.conversationHistory.push({
                role: "assistant",
                content: fallbackResponse,
              })
              return res.json({ response: fallbackResponse })
            }
          } catch (fallbackError) {
            console.error("Error en fallback:", fallbackError)
          }

          return res.json({
            response: "Lo siento, hubo un problema al analizar los datos. ¿Podrías reformular tu pregunta?",
          })
        }

      case "bandejas_query":
        try {
          // Intentar primero con la función analítica para bandejas
          const response = await getAnalyticalResponse(message);

          // Si tenemos una respuesta, la devolvemos
          if (response) {
            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: response,
            });

            return res.json({ response });
          }

          // Si no hay respuesta analítica, proceder con la consulta SQL
          const sqlQuery = await getQueryFromIA(message);
          
          // Si la respuesta es conversacional, la devolvemos directamente
          if (sqlQuery.includes("'CONVERSACIONAL'")) {
            const match = sqlQuery.match(/SELECT 'CONVERSACIONAL' as response_type, "(.*)" as message/);
            if (match && match[1]) {
              const respuesta = match[1].replace(/\\n/g, "\n");
              
              // Guardar la respuesta en el historial
              context.conversationHistory.push({
                role: "assistant",
                content: respuesta,
              });

              return res.json({ response: respuesta });
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
                  user: `Pregunta original: "${message}"\n\nResultados de la consulta SQL:\n${JSON.stringify(results, null, 2)}`,
                }

                const interpretedResponse = await sendToDeepSeek(interpretPrompt);
                const respuesta = interpretedResponse.replace(/^CONVERSACIONAL:\s*/i, "");
                
                // Guardar la respuesta en el historial
                context.conversationHistory.push({
                  role: "assistant",
                  content: respuesta,
                });

                return res.json({ response: respuesta });
              } else {
                const respuesta = "No encontré información que coincida con tu consulta en nuestra base de datos. ¿Podrías reformular tu pregunta?";
                
                // Guardar la respuesta en el historial
                context.conversationHistory.push({
                  role: "assistant",
                  content: respuesta,
                });

                return res.json({ response: respuesta });
              }
            } catch (error) {
              console.error("Error ejecutando consulta SQL:", error);
              const respuesta = "Lo siento, hubo un error al procesar tu consulta. ¿Podrías reformularla?";
              
              // Guardar la respuesta en el historial
              context.conversationHistory.push({
                role: "assistant",
                content: respuesta,
              });

              return res.json({ response: respuesta });
            }
          }

          // Si llegamos aquí, es porque la IA generó una respuesta textual
          const match = sqlQuery.match(/SELECT 'TEXT' as response_type, "(.*)" as message/);
          if (match && match[1]) {
            const respuesta = match[1].replace(/\\n/g, "\n");
            
            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: respuesta,
            });

            return res.json({ response: respuesta });
          }

          const respuesta = "Lo siento, no pude procesar tu consulta. ¿Podrías reformularla?";
          
          // Guardar la respuesta en el historial
          context.conversationHistory.push({
            role: "assistant",
            content: respuesta,
          });

          return res.json({ response: respuesta });
        } catch (error) {
          console.error("Error al procesar consulta de bandejas:", error);
          const respuesta = "Lo siento, hubo un error al procesar tu consulta. ¿Podrías reformularla?";
          
          // Guardar la respuesta en el historial
          context.conversationHistory.push({
            role: "assistant",
            content: respuesta,
          });

          return res.json({ response: respuesta });
        }

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
          context.lastCasaComercialName = null
          context.lastCasaComercialData = null
          context.lastCategoriaName = null
          context.lastCategoriaData = null

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
          context.lastCasaComercialName = null
          context.lastCasaComercialData = null
          context.lastCategoriaName = null
          context.lastCategoriaData = null

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
          context.lastCasaComercialName = null
          context.lastCasaComercialData = null
          context.lastCategoriaName = null
          context.lastCategoriaData = null

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

      case "macetas_list":
        try {
          // Extraer el número de macetas solicitadas
          const cantidadMatch = message.match(/(\d+)\s*(?:macetas|maceta)/i)
          const numMacetas = cantidadMatch ? Number.parseInt(cantidadMatch[1]) : 5 // Por defecto 5 si no se especifica

          const listaMacetas = await obtenerListaMacetas(numMacetas)

          // Limpiar el contexto ya que estamos cambiando de tema
          context.lastClientName = null
          context.lastClientData = null
          context.lastArticleName = null
          context.lastArticleData = null
          context.lastProviderName = null
          context.lastProviderData = null
          context.lastCasaComercialName = null
          context.lastCasaComercialData = null
          context.lastCategoriaName = null
          context.lastCategoriaData = null

          const respuesta = `Aquí tienes las macetas solicitadas:\n\n${listaMacetas}`

          // Guardar la respuesta en el historial
          context.conversationHistory.push({
            role: "assistant",
            content: respuesta,
          })

          return res.json({ response: respuesta })
        } catch (error) {
          console.error("Error al procesar lista de macetas:", error)
          return res.json({
            response: "Hubo un error al obtener la lista de macetas. Por favor, intenta de nuevo.",
          })
        }

      case "bandejas_examples":
        try {
          // Extraer el número de ejemplos de bandejas solicitados
          const cantidadMatch = message.match(/(\d+)\s*(?:ejemplos|ejemplo)/i)
          const numEjemplos = cantidadMatch ? Number.parseInt(cantidadMatch[1]) : 2 // Por defecto 2 si no se especifica

          const listaEjemplos = await obtenerListaEjemplosBandejas(numEjemplos)

          // Limpiar el contexto ya que estamos cambiando de tema
          context.lastClientName = null
          context.lastClientData = null
          context.lastArticleName = null
          context.lastArticleData = null
          context.lastProviderName = null
          context.lastProviderData = null
          context.lastCasaComercialName = null
          context.lastCasaComercialData = null
          context.lastCategoriaName = null
          context.lastCategoriaData = null

          const respuesta = `Aquí tienes los ejemplos de bandejas solicitados:\n\n${listaEjemplos}`

          // Guardar la respuesta en el historial
          context.conversationHistory.push({
            role: "assistant",
            content: respuesta,
          })

          return res.json({ response: respuesta })
        } catch (error) {
          console.error("Error al procesar lista de ejemplos de bandejas:", error)
          return res.json({
            response: "Hubo un error al obtener la lista de ejemplos de bandejas. Por favor, intenta de nuevo.",
          })
        }

      case "dispositivos_query":
      case "dispositivos_list":
        try {
          // Intentar primero con la función analítica
          const response = await getAnalyticalResponse(message)

          // Si tenemos una respuesta, la devolvemos
          if (response) {
            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: response,
            })

            return res.json({ response })
          }

          // Si no, usar el fallback
          const fallbackResponse = await fallbackClientes(message)
          if (fallbackResponse) {
            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: fallbackResponse,
            })

            return res.json({ response: fallbackResponse })
          }

          // Si el fallback tampoco funcionó, intentar con una consulta SQL
          const [results] = await pool.query(`
            SELECT d.id, d.DIS_DENO, d.DIS_MARCA, d.DIS_MOD, d.DIS_BAJA, o.C0 as UltimaObservacion
            FROM dispositivos d
            LEFT JOIN (
              SELECT id, MAX(id2) as max_id2
              FROM dispositivos_dis_obs
              GROUP BY id
            ) latest ON d.id = latest.id
            LEFT JOIN dispositivos_dis_obs o ON latest.id = o.id AND latest.max_id2 = o.id2
            ORDER BY d.id
            LIMIT 5
          `)

          if (results.length > 0) {
            const formatted = results
              .map((row, i) => {
                const estado = row.DIS_BAJA === 0 ? "Activo" : "Inactivo"
                let info = `${i + 1}. ${row.DIS_DENO || "Sin nombre"} (${row.DIS_MARCA || ""} ${row.DIS_MOD || ""})`
                info += ` - Estado: ${estado}`

                if (row.UltimaObservacion) {
                  info += ` - ${row.UltimaObservacion}`
                }

                return info
              })
              .join("\n")

            const respuesta = `Aquí tienes algunos dispositivos registrados:\n\n${formatted}\n\n¿Necesitas información más específica?`

            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: respuesta,
            })

            return res.json({ response: respuesta })
          } else {
            const respuesta = "No se encontraron dispositivos en la base de datos."

            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: respuesta,
            })

            return res.json({ response: respuesta })
          }
        } catch (error) {
          console.error("Error al procesar consulta de dispositivos:", error)
          return res.json({
            response: "Lo siento, no pude obtener información sobre dispositivos. ¿Podrías reformular tu consulta?",
          })
        }

      case "definition_query":
        try {
          // Use DeepSeek API to get a definition response
          const promptBase = require("./promptBase")
          const prompt = promptBase(message)
          const { sendToDeepSeek } = require("./utils/deepseek")

          const aiResponse = await sendToDeepSeek(prompt)

          // Clean up the response if needed
          let cleanResponse = aiResponse
          if (aiResponse.startsWith("CONVERSACIONAL:")) {
            cleanResponse = aiResponse.substring(15).trim()
          }

          // Save the response in conversation history
          context.conversationHistory.push({
            role: "assistant",
            content: cleanResponse,
          })

          return res.json({ response: cleanResponse })
        } catch (error) {
          console.error("Error al procesar consulta de definición:", error)
          return res.json({
            response: "Lo siento, no pude generar una definición para esa consulta. ¿Podrías reformularla?",
          })
        }

      case "analytical_query":
        try {
          // Usar la nueva función para consultas analíticas
          const response = await getAnalyticalResponse(message)

          // Si la función analítica no pudo manejar la consulta, usar el fallback
          if (!response) {
            console.log("La función analítica no pudo manejar la consulta, usando fallback")
            const fallbackResponse = await fallbackClientes(message)

            if (fallbackResponse) {
              // Guardar la respuesta en el historial
              context.conversationHistory.push({
                role: "assistant",
                content: fallbackResponse,
              })
              return res.json({ response: fallbackResponse })
            } else {
              throw new Error("El fallback tampoco pudo manejar la consulta")
            }
          }

          // Guardar la respuesta en el historial
          context.conversationHistory.push({
            role: "assistant",
            content: response,
          })

          return res.json({ response })
        } catch (error) {
          console.error("Error al procesar consulta analítica:", error)
          // Si falla la consulta analítica, intentar con el fallback
          try {
            const fallbackResponse = await fallbackClientes(message)
            if (fallbackResponse) {
              context.conversationHistory.push({
                role: "assistant",
                content: fallbackResponse,
              })
              return res.json({ response: fallbackResponse })
            }
          } catch (fallbackError) {
            console.error("Error en fallback:", fallbackError)
          }

          return res.json({
            response: "Lo siento, hubo un problema al analizar los datos. ¿Podrías reformular tu pregunta?",
          })
        }

      case "bandejas_query":
        try {
          // Intentar primero con la función analítica para bandejas
          const response = await getAnalyticalResponse(message)

          // Si tenemos una respuesta, la devolvemos
          if (response) {
            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: response,
            })

            return res.json({ response })
          }

          // Si no, usar la consulta tradicional
          const [results] = await pool.query("SELECT * FROM bandejas LIMIT 10")

          if (results.length > 0) {
            const formatted = results
              .map((row, i) => {
                return `${i + 1}. ${row.BN_DENO || "Sin nombre"} - Alvéolos: ${row.BN_ALV || "N/A"} - Retornable: ${row.BN_RET === "S" ? "Sí" : "No"} - Código: ${row.id}`
              })
              .join("\n")

            const respuesta = `Aquí tienes información sobre las bandejas:\n\n${formatted}`

            // Save the response in conversation history
            context.conversationHistory.push({
              role: "assistant",
              content: respuesta,
            })

            return res.json({ response: respuesta })
          } else {
            // If no results, try using the AI to explain what bandejas are
            const promptBase = require("./promptBase")
            const prompt = promptBase("¿Qué son las bandejas en un semillero?")
            const { sendToDeepSeek } = require("./utils/deepseek")

            const aiResponse = await sendToDeepSeek(prompt)

            // Clean up the response if needed
            let cleanResponse = aiResponse
            if (aiResponse.startsWith("CONVERSACIONAL:")) {
              cleanResponse = aiResponse.substring(15).trim()
            }

            // Save the response in conversation history
            context.conversationHistory.push({
              role: "assistant",
              content: cleanResponse,
            })

            return res.json({ response: cleanResponse })
          }
        } catch (error) {
          console.error("Error al procesar consulta de bandejas:", error)
          return res.json({
            response: "Lo siento, no pude obtener información sobre bandejas. ¿Podrías reformular tu consulta?",
          })
        }

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

      case "database_query":
      default:
        // Si llegamos aquí, intentamos procesar como una consulta de base de datos genérica
        try {
          // Intentar primero con la función analítica
          try {
            console.log("Intentando procesar con getAnalyticalResponse")
            const analyticalResponse = await getAnalyticalResponse(message)
            if (analyticalResponse) {
              console.log("Respuesta analítica obtenida")
              // Guardar la respuesta en el historial
              context.conversationHistory.push({
                role: "assistant",
                content: analyticalResponse,
              })

              return res.json({ response: analyticalResponse })
            } else {
              console.log("La función analítica no pudo manejar la consulta")
            }
          } catch (error) {
            console.error("Error en consulta analítica, continuando con fallback:", error)
          }

          // Intentar con el fallback para consultas comunes
          console.log("Intentando procesar con fallbackClientes")
          const fallbackResponse = await fallbackClientes(message)
          if (fallbackResponse) {
            console.log("Respuesta fallback obtenida")
            // Guardar la respuesta en el historial
            context.conversationHistory.push({
              role: "assistant",
              content: fallbackResponse,
            })

            return res.json({ response: fallbackResponse })
          } else {
            console.log("El fallback no pudo manejar la consulta")
          }

          // Si el fallback no funcionó, intentar con una consulta SQL
          console.log("Ejecutando consulta SQL genérica")
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
          console.error("Error general en database_query:", error.message)

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
  } catch (error) {
    console.error("Error crítico en el procesamiento del mensaje:", error)
    return res.json({
      response:
        "Lo siento, ocurrió un error al procesar tu mensaje. Por favor, intenta de nuevo con una consulta diferente.",
    })
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
  console.log(`Servidor escuchando en http://localhost:${port}`);
})