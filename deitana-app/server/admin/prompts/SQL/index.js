// =====================================
// ÍNDICE DE PROMPTS SQL
// =====================================
// 
// Este archivo exporta todos los prompts relacionados con SQL
// para facilitar las importaciones
// =====================================

const { sqlRules } = require('./sqlRules');
const { sqlExamples } = require('./sqlExamples');
const { ejemplosSQL } = require('./ejemplos');
const { 
    construirContextoMapaERP,
    validarTablaEnMapaERP,
    validarColumnasEnTabla,
    obtenerRelacionesTabla,
    generarSugerenciasJoin
} = require('./sqlContext');

module.exports = {
    // Prompts de texto
    sqlRules,
    sqlExamples,
    ejemplosSQL,
    
    // Funciones de contexto
    construirContextoMapaERP,
    validarTablaEnMapaERP,
    validarColumnasEnTabla,
    obtenerRelacionesTabla,
    generarSugerenciasJoin
};
