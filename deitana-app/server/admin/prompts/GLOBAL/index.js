// =====================================
// ÍNDICE DE PROMPTS GLOBALES
// =====================================
// 
// Este archivo exporta todos los prompts globales del sistema
// para facilitar las importaciones
// =====================================

const { identidadGlobal } = require('./identidad');
const { comportamientoGlobal } = require('./comportamiento');
const { promptBase } = require('./base');
const { promptGlobal } = require('./promptGlobal');
const { formatoRespuesta } = require('./formatoRespuesta');
const { formatoObligatorio } = require('./formatoObligatorio');

module.exports = {
    // Prompts de identidad y comportamiento
    identidadGlobal,
    comportamientoGlobal,
    
    // Prompts base y globales
    promptBase,
    promptGlobal,
    
    // Prompts de formato
    formatoRespuesta,
    formatoObligatorio
};
