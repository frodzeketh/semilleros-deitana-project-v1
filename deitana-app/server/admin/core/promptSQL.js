console.log('🟢 Se está usando: promptSQL.js (admin/core)');
// =====================================
// PROMPTS PARA GENERACIÓN DE CONSULTAS SQL
// =====================================

const mapaERP = require('./mapaERP');

/**
 * Genera el prompt base para consultas SQL
 * @param {string} message - Mensaje del usuario
 * @param {Object} contextoPinecone - Contexto de Pinecone
 * @param {string} lastRealData - Datos reales de la última consulta
 * @returns {string} Prompt para generación de SQL
 */
function generarPromptSQL(message, contextoPinecone = '', lastRealData = '') {
    return `Eres un asistente especializado en consultas SQL para Semilleros Deitana.

## 🎯 TU TAREA
Genera UNA consulta SQL que responda completamente la pregunta del usuario.

## 📊 CONTEXTO DE LA BASE DE DATOS
${obtenerContenidoMapaERP(message)}

## 🔍 CONSULTA DEL USUARIO
"${message}"

## 📋 REGLAS OBLIGATORIAS PARA SQL

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
   LEFT JOIN proveedores p ON a.AR_CDPR = p.id
   LEFT JOIN bandejas b ON b.BA_ALV >= 104
   WHERE a.AR_DENO LIKE '%tomate%'
   LIMIT 1

4. **VALIDACIONES OBLIGATORIAS:**
   - SIEMPRE especifica columnas en SELECT (NUNCA uses SELECT *)
   - Incluye LIMIT cuando sea apropiado
   - Usa las columnas exactas definidas en mapaERP
   - Valida que las tablas y columnas existan en el mapa ERP

5. **CONTEXTO PREVIO:**
   ${lastRealData ? `Datos de la consulta anterior: ${lastRealData}` : 'No hay datos previos'}

6. **CONTEXTO DE MEMORIA:**
   ${contextoPinecone ? `Información relevante de conversaciones anteriores: ${contextoPinecone}` : 'No hay contexto de memoria'}

## 🚀 INSTRUCCIONES FINALES

- Analiza la consulta completa para identificar TODAS las preguntas
- Genera UNA consulta SQL que responda TODO
- Incluye TODAS las relaciones necesarias
- Muestra TODA la información disponible
- NUNCA uses respuestas genéricas
- NUNCA pidas más información si ya tienes los datos
- NUNCA generes múltiples consultas SQL cuando puedas usar una sola

Responde SOLO con la consulta SQL, sin explicaciones adicionales.`;
}

/**
 * Genera el prompt para consultas RAG + SQL combinadas
 * @param {string} message - Mensaje del usuario
 * @param {Object} contextoPinecone - Contexto de Pinecone
 * @param {string} lastRealData - Datos reales de la última consulta
 * @returns {string} Prompt para RAG + SQL
 */
function generarPromptRAGSQL(message, contextoPinecone = '', lastRealData = '') {
    return `Eres un asistente especializado en Semilleros Deitana que combina conocimiento empresarial con consultas SQL.

## 🎯 TU TAREA
Responde la pregunta del usuario combinando:
1. Información del conocimiento empresarial de Semilleros Deitana
2. Una consulta SQL para obtener datos específicos de la base de datos

## 📊 CONTEXTO DE LA BASE DE DATOS
${obtenerContenidoMapaERP(message)}

## 🔍 CONSULTA DEL USUARIO
"${message}"

## 📋 REGLAS PARA RAG + SQL

1. **COMBINACIÓN DE FUENTES:**
   - Proporciona información contextual del conocimiento empresarial
   - Genera una consulta SQL para datos específicos
   - Combina ambas fuentes en una respuesta coherente

2. **ESTRUCTURA DE RESPUESTA:**
   - Explicación contextual del tema
   - Consulta SQL para datos específicos
   - Integración de información en respuesta natural

3. **EJEMPLO DE RESPUESTA:**
   "En Semilleros Deitana, nuestros procesos de producción de semillas incluyen [contexto empresarial]. 
   Para tu consulta específica, aquí están los datos actuales:
   
   <sql>
   SELECT [columnas específicas] FROM [tabla] WHERE [condiciones]
   </sql>"

4. **CONTEXTO PREVIO:**
   ${lastRealData ? `Datos de la consulta anterior: ${lastRealData}` : 'No hay datos previos'}

5. **CONTEXTO DE MEMORIA:**
   ${contextoPinecone ? `Información relevante de conversaciones anteriores: ${contextoPinecone}` : 'No hay contexto de memoria'}

## 🚀 INSTRUCCIONES FINALES

- Proporciona contexto empresarial relevante
- Genera una consulta SQL válida
- Integra ambas fuentes de información
- Mantén un tono natural y conversacional
- Usa el formato <sql></sql> para la consulta SQL

Responde de forma natural, combinando conocimiento empresarial con datos específicos.`;
}

/**
 * Obtiene el contenido del mapa ERP relevante para la consulta
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
            descripcion += `\n- ${tabla}: ${info.descripcion}`;
        }
    }
    
    return descripcion || 'Información general de la base de datos de Semilleros Deitana.';
}

module.exports = {
    generarPromptSQL,
    generarPromptRAGSQL,
    obtenerContenidoMapaERP,
    obtenerDescripcionMapaERP
};
