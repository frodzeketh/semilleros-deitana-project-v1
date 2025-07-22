console.log('🟢 Se está usando: sqlRules.js (admin/prompts)');

// =====================================
// REGLAS SQL - GENERACIÓN Y VALIDACIÓN
// =====================================
// 
// Este archivo contiene las reglas base para generación de SQL y funciones auxiliares
// para obtener contexto relevante de la base de datos.
//
// ESTRUCTURA:
// 1. sqlRules = Reglas base unificadas para todas las consultas SQL
// 2. Funciones auxiliares = Para obtener contexto de la base de datos
//
// USO EN openAI.js:
// - sqlRules se usa directamente en prompts
// =====================================

const sqlRules = `🎯 REGLAS SQL CRÍTICAS:

## 🚨 FORMATO OBLIGATORIO PARA SQL:
- **SIEMPRE** usa etiquetas <sql>...</sql> para encerrar consultas SQL
- **NUNCA** uses bloques de código markdown (  sql)
- **EJEMPLO CORRECTO:**
  <sql>SELECT id, PAR_DENO, PAR_FEC FROM partidas LIMIT 2;</sql>

- Debes ejecutar la consulta SQL utilizando únicamente las columnas reales y válidas según el mapaERP.
- Nunca inventes nombres de columnas. Por ejemplo, si te piden el monto de la última factura emitida, no utilices FACTURAE_IMPO o columnas inexistentes.
- El mapaERP indica claramente que el monto total de una factura está en la columna FE_TTT y la fecha de emisión está en FE_FEC, por lo tanto esas deben usarse.
- Siempre valida nombres de columnas con el mapaERP antes de generar cualquier consulta.

## 📋 REGLAS DE GENERACIÓN:
1. **Formato**: Usa <sql>...</sql> + respuesta natural
2. **Marcadores**: SELECT CL_DENO → usar [CL_DENO] en respuesta
3. **Validación**: Solo SELECT, nunca INSERT/UPDATE/DELETE
4. **Límites**: Agregar LIMIT automáticamente si no existe
5. **Seguridad**: Usar nombres exactos de mapaERP

## 🎯 INSTRUCCIONES ESPECÍFICAS:
- **Para consultas de datos**: Genera SQL real ejecutable
- **Para explicaciones**: Usa solo texto natural
- **Para combinaciones**: SQL + explicación natural
- **Formato final**: Respuesta natural + <sql>consulta</sql> + resultados

## 🚨 CRÍTICO - NUNCA INVENTES DATOS:
- **NUNCA** inventes nombres, direcciones, teléfonos, emails de entidades
- **NUNCA** inventes datos de clientes, proveedores, almacenes, artículos
- **NUNCA** uses ejemplos ficticios como "PROVEEDOR EJEMPLO" o "ALMACÉN CENTRAL"
- **SIEMPRE** genera SQL real y deja que el sistema ejecute y muestre datos reales
- **SI** no hay datos reales, di claramente "No se encontraron registros en la base de datos"
- **USA** solo el conocimiento empresarial del archivo .txt para contexto, no para datos de entidades

## 🔧 REGLA DE ORO:
- **Para listados de entidades**: SIEMPRE genera SQL, NUNCA inventes datos
- **Para contexto empresarial**: Usa el archivo .txt
- **Para combinaciones**: SQL para datos + .txt para contexto
- **NUNCA** mezcles datos inventados con datos reales

## 📊 ESTRUCTURA DE CONSULTAS INTELIGENTES:

1. **ESTRUCTURA DE CONSULTAS:**
   - SIEMPRE genera UNA consulta SQL que responda TODAS las preguntas
   - Usa subconsultas y JOINs para obtener TODA la información necesaria
   - Incluye GROUP BY y HAVING cuando sea necesario
   - Optimiza la consulta para obtener TODOS los datos en una sola operación

2. **NOMBRES DE TABLA IMPORTANTES:**
   - SIEMPRE usa el nombre exacto de la tabla como está definido en la propiedad 'tabla'
   - Algunas tablas usan guiones (-) en lugar de guiones bajos (_)
   - Ejemplos importantes:
     * Usa 'p-siembras' (NO 'p_siembras')
     * Usa 'alb-compra' (NO 'alb_compra')
     * Usa 'facturas-r' (NO 'facturas_r')
     * Usa 'devol-clientes' (NO 'devol_clientes')

3. **EJEMPLOS DE CONSULTAS INTELIGENTES:**
   
   a) Para "cuantas acciones comerciales hay, dime un cliente que haya hecho multiples acciones":
   SELECT 
       (SELECT COUNT(*) FROM acciones_com) as total_acciones,
       c.CL_DENO as nombre_cliente,
       COUNT(ac.id) as total_acciones_cliente
   FROM acciones_com ac
   LEFT JOIN clientes c ON ac.ACCO_CDCL = c.id
   GROUP BY ac.ACCO_CDCL, c.CL_DENO
   HAVING COUNT(ac.id) > 1
   ORDER BY COUNT(ac.id) DESC
   LIMIT 1
   
   b) Para "dime un tipo de tomate con su proveedor y una bandeja que podamos cultivar 104 tomates":
   SELECT 
       a.AR_DENO as nombre_tomate,
       p.PR_DENO as nombre_proveedor,
       b.BA_DENO as nombre_bandeja,
       b.BA_ALV as alveolos
   FROM articulos a
   LEFT JOIN proveedores p ON a.AR_PRV = p.id
   LEFT JOIN bandejas b ON b.BA_ALV >= 104
   WHERE a.AR_DENO LIKE '%tomate%'
   LIMIT 1

4. **VALIDACIONES OBLIGATORIAS:**
   - SIEMPRE especifica columnas en SELECT (NUNCA uses SELECT *)
   - Incluye LIMIT cuando sea apropiado
   - Usa las columnas exactas definidas en mapaERP
   - Valida que las tablas y columnas existan en el mapa ERP

## 🚀 INSTRUCCIONES FINALES

- Analiza la consulta completa para identificar TODAS las preguntas
- Genera UNA consulta SQL que responda TODO
- Incluye TODAS las relaciones necesarias
- Muestra TODA la información disponible
- NUNCA uses respuestas genéricas
- NUNCA pidas más información si ya tienes los datos
- NUNCA generes múltiples consultas SQL cuando puedas usar una sola

Responde SOLO con la consulta SQL, sin explicaciones adicionales.`;

const mapaERP = require('../core/mapaERP');

/**
 * Obtiene el contenido del mapa ERP relevante para la consulta
 * PROPÓSITO: Busca tablas y columnas relevantes basándose en palabras clave
 * EJEMPLO: Usuario: "dime clientes" → Busca tablas con "cliente" en nombre/descripción
 * 
 * @param {string} consulta - Consulta del usuario
 * @returns {string} Contenido del mapa ERP
 */
function obtenerContenidoMapaERP(consulta) {
    let contenido = '';
    
    // Buscar tablas relevantes basadas en palabras clave
    const palabrasClave = consulta.toLowerCase().split(' ');
    
    for (const [tabla, info] of Object.entries(mapaERP)) {
        const esRelevante = palabrasClave.some(palabra => 
            tabla.toLowerCase().includes(palabra) ||
            info.descripcion.toLowerCase().includes(palabra) ||
            Object.keys(info.columnas || {}).some(col => 
                col.toLowerCase().includes(palabra)
            )
        );
        
        if (esRelevante) {
            contenido += `\n**Tabla: ${tabla}**\n`;
            contenido += `Descripción: ${info.descripcion}\n`;
            contenido += `Columnas disponibles: ${Object.keys(info.columnas || {}).join(', ')}\n`;
        }
    }
    
    return contenido || 'No se encontraron tablas específicas para esta consulta.';
}

/**
 * Obtiene la descripción del mapa ERP
 * PROPÓSITO: Obtiene solo descripciones de tablas relevantes
 * EJEMPLO: Usuario: "dime facturas" → Busca tablas con "factura" en nombre/descripción
 * 
 * @param {string} consulta - Consulta del usuario
 * @returns {string} Descripción del mapa ERP
 */
function obtenerDescripcionMapaERP(consulta) {
    let descripcion = '';
    
    // Buscar tablas relevantes
    const palabrasClave = consulta.toLowerCase().split(' ');
    
    for (const [tabla, info] of Object.entries(mapaERP)) {
        const esRelevante = palabrasClave.some(palabra => 
            tabla.toLowerCase().includes(palabra) ||
            info.descripcion.toLowerCase().includes(palabra)
        );
        
        if (esRelevante) {
            descripcion += `${tabla}: ${info.descripcion}\n`;
        }
    }
    
    return descripcion || 'No se encontraron tablas específicas para esta consulta.';
}

module.exports = { 
    sqlRules, 
    obtenerContenidoMapaERP, 
    obtenerDescripcionMapaERP 
}; 