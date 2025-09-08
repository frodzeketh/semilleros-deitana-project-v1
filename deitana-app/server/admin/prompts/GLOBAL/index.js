// =====================================
// ÍNDICE DE PROMPTS GLOBALES
// =====================================
// 
// Este archivo exporta todos los prompts globales del sistema
// para facilitar las importaciones
// =====================================

const { comportamientoGlobal } = require('./comportamiento');
const { comportamientoChatGPT } = require('./comportamientoChatGPT');
const { promptBase } = require('./base');
const { promptGlobal } = require('./promptGlobal');
const { formatoRespuesta } = require('./formatoRespuesta');
const { formatoRespuestaSimple } = require('./formatoRespuestaSimple');
const { formatoUltraNatural } = require('./formatoUltraNatural');
const { guiaMarkdownCompleta } = require('./guiaMarkdownCompleta');
const { estiloVisualChatGPT } = require('./estiloVisualChatGPT');
const { formatoObligatorio } = require('./formatoObligatorio');

module.exports = {
    // Prompts de comportamiento
    comportamientoGlobal,
    comportamientoChatGPT,
    
    // Prompts base y globales
    promptBase,
    promptGlobal,
    
    // Prompts de formato
    formatoRespuesta,
    formatoRespuestaSimple,
    formatoUltraNatural,
    guiaMarkdownCompleta,
    estiloVisualChatGPT,
    formatoObligatorio
};
