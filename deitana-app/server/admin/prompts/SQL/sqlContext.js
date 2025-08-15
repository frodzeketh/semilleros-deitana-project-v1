// =====================================
// CONTEXTO SQL - ESTRUCTURA DE BASE DE DATOS
// =====================================
// 
// Este archivo contiene:
// - Función para construir contexto de mapaERP
// - Estructura de tablas y relaciones
// - Instrucciones para la IA sobre BD
// - Validación de tablas y columnas
// =====================================

/**
 * Construye el contexto completo del mapa ERP para que la IA analice
 * @param {Object} mapaERP - Mapa de estructura de la base de datos
 * @returns {string} Contexto formateado para el prompt
 */
function construirContextoMapaERP(mapaERP) {
    if (!mapaERP) {
        console.log('⚠️ [SQL-CONTEXT] No hay mapaERP disponible');
        return '';
    }
    
    let contexto = '\n=== ESTRUCTURA COMPLETA DE LA BASE DE DATOS ===\n';
    contexto += `\nTOTAL DE TABLAS DISPONIBLES: ${Object.keys(mapaERP).length}\n\n`;
    
    // Incluir TODAS las tablas del mapaERP para que la IA las analice
    Object.entries(mapaERP).forEach(([nombreTabla, infoTabla]) => {
        contexto += `\n## 📊 TABLA: ${nombreTabla}\n`;
        contexto += `Descripción: ${infoTabla.descripcion || 'Sin descripción'}\n`;
        
        // Columnas disponibles
        if (infoTabla.columnas) {
            contexto += `\n### 📋 COLUMNAS:\n`;
            Object.entries(infoTabla.columnas).forEach(([columna, descripcion]) => {
                contexto += `- ${columna}: ${descripcion}\n`;
            });
        }
        
        // Relaciones con otras tablas
        if (infoTabla.tablas_relacionadas) {
            contexto += `\n### 🔗 RELACIONES:\n`;
            Object.entries(infoTabla.tablas_relacionadas).forEach(([tablaRelacionada, infoRelacion]) => {
                contexto += `- ${tablaRelacionada}: ${infoRelacion.descripcion || 'Relación directa'}\n`;
                if (infoRelacion.tipo) {
                    contexto += `  Tipo: ${infoRelacion.tipo}\n`;
                }
                if (infoRelacion.campo_enlace_local && infoRelacion.campo_enlace_externo) {
                    contexto += `  JOIN: ${nombreTabla}.${infoRelacion.campo_enlace_local} = ${tablaRelacionada}.${infoRelacion.campo_enlace_externo}\n`;
                }
            });
        }
        
        contexto += '\n';
    });
    
    // Instrucciones para la IA
    contexto += `\n### 🎯 INSTRUCCIONES PARA LA IA:\n`;
    contexto += `- Analiza la consulta del usuario\n`;
    contexto += `- Identifica qué tablas del mapaERP son relevantes\n`;
    contexto += `- Usa las relaciones definidas para hacer JOINs correctos\n`;
    contexto += `- NO inventes tablas que no estén en esta lista\n`;
    contexto += `- Genera SQL usando EXACTAMENTE las columnas mostradas\n`;
    contexto += `- Formato: <sql>SELECT columnas FROM tabla [JOIN otras_tablas] WHERE condiciones</sql>\n\n`;
    
    return contexto;
}

/**
 * Valida que una tabla existe en el mapaERP
 * @param {string} tabla - Nombre de la tabla a validar
 * @param {Object} mapaERP - Mapa de estructura de la base de datos
 * @returns {boolean} True si la tabla existe
 */
function validarTablaEnMapaERP(tabla, mapaERP) {
    return Object.keys(mapaERP).includes(tabla);
}

/**
 * Valida que las columnas existen en una tabla
 * @param {string} tabla - Nombre de la tabla
 * @param {Array} columnas - Array de columnas a validar
 * @param {Object} mapaERP - Mapa de estructura de la base de datos
 * @returns {Object} { valido: boolean, columnasValidas: Array, columnasInvalidas: Array }
 */
function validarColumnasEnTabla(tabla, columnas, mapaERP) {
    if (!mapaERP[tabla] || !mapaERP[tabla].columnas) {
        return {
            valido: false,
            columnasValidas: [],
            columnasInvalidas: columnas,
            error: `La tabla ${tabla} no está definida correctamente en mapaERP`
        };
    }

    const columnasDisponibles = Object.keys(mapaERP[tabla].columnas);
    const columnasValidas = [];
    const columnasInvalidas = [];
    
    columnas.forEach(columna => {
        if (columnasDisponibles.includes(columna)) {
            columnasValidas.push(columna);
        } else {
            columnasInvalidas.push(columna);
        }
    });
    
    return {
        valido: columnasInvalidas.length === 0,
        columnasValidas,
        columnasInvalidas,
        columnasDisponibles
    };
}

/**
 * Obtiene las relaciones de una tabla
 * @param {string} tabla - Nombre de la tabla
 * @param {Object} mapaERP - Mapa de estructura de la base de datos
 * @returns {Object} Relaciones de la tabla
 */
function obtenerRelacionesTabla(tabla, mapaERP) {
    if (!mapaERP[tabla] || !mapaERP[tabla].tablas_relacionadas) {
        return {};
    }
    
    return mapaERP[tabla].tablas_relacionadas;
}

/**
 * Genera sugerencias de JOIN basadas en relaciones
 * @param {Array} tablas - Array de tablas a relacionar
 * @param {Object} mapaERP - Mapa de estructura de la base de datos
 * @returns {Array} Array de sugerencias de JOIN
 */
function generarSugerenciasJoin(tablas, mapaERP) {
    const sugerencias = [];
    
    tablas.forEach(tabla => {
        const relaciones = obtenerRelacionesTabla(tabla, mapaERP);
        
        Object.entries(relaciones).forEach(([tablaRelacionada, infoRelacion]) => {
            if (tablas.includes(tablaRelacionada)) {
                sugerencias.push({
                    tabla1: tabla,
                    tabla2: tablaRelacionada,
                    campo1: infoRelacion.campo_enlace_local,
                    campo2: infoRelacion.campo_enlace_externo,
                    tipo: infoRelacion.tipo || 'INNER JOIN'
                });
            }
        });
    });
    
    return sugerencias;
}

module.exports = {
    construirContextoMapaERP,
    validarTablaEnMapaERP,
    validarColumnasEnTabla,
    obtenerRelacionesTabla,
    generarSugerenciasJoin
};
