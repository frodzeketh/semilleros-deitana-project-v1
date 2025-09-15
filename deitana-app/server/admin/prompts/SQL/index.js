// =====================================
// ÍNDICE DE PROMPTS SQL
// =====================================
// 
// Este archivo exporta todos los prompts relacionados con SQL
// para facilitar las importaciones
// =====================================

const { sqlRules } = require('./sqlRules');
const { sqlExamples } = require('./sqlExamples');

module.exports = {
    // Prompts de texto
    sqlRules,
    sqlExamples
};
