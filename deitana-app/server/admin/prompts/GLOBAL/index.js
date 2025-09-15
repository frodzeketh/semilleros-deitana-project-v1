// =====================================
// ÍNDICE DE PROMPTS GLOBALES
// =====================================
// 
// Este archivo exporta todos los prompts globales del sistema
// para facilitar las importaciones
// =====================================

const { comportamientoGlobal } = require('./comportamiento');
const { promptGlobal } = require('./promptGlobal');
const { formatoRespuesta } = require('./formatoRespuesta');
const { guiaMarkdownCompleta } = require('./guiaMarkdownCompleta');

module.exports = {
    // Prompts de comportamiento
    comportamientoGlobal,
    
    // Prompts globales
    promptGlobal,
    
    // Prompts de formato
    formatoRespuesta,
    guiaMarkdownCompleta
};
