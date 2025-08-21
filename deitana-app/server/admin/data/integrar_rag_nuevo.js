// =====================================
// INTEGRAR NUEVO RAG CON SISTEMA PRINCIPAL
// =====================================

const ragNuevo = require('./rag_nuevo');

/**
 * Función principal para integrar con openAI.js
 */
async function recuperarConocimientoRelevante(consulta, usuario = null) {
    try {
        console.log('🧠 [RAG NUEVO] === INICIANDO BÚSQUEDA DE CONOCIMIENTO ===');
        console.log(`🧠 [RAG NUEVO] Consulta: ${consulta}`);
        console.log(`🧠 [RAG NUEVO] Usuario: ${usuario || 'undefined'}`);
        
        // Usar el nuevo sistema RAG
        const resultado = await ragNuevo.buscarInformacion(consulta);
        
        if (resultado && !resultado.includes('No se encontró información')) {
            console.log(`✅ [RAG NUEVO] Información encontrada: ${resultado.length} caracteres`);
            return resultado;
        } else {
            console.log('⚠️ [RAG NUEVO] No se encontró información específica');
            return '';
        }
        
    } catch (error) {
        console.error('❌ [RAG NUEVO] Error en recuperación:', error.message);
        return '';
    }
}

/**
 * Función para verificar que el RAG funciona
 */
async function verificarFuncionamiento() {
    console.log('🔍 [VERIFICACIÓN] Verificando funcionamiento del nuevo RAG...\n');
    
    try {
        // Verificar índice
        await ragNuevo.verificarIndice();
        
        // Probar consulta clave
        const consulta = "¿Cuál es la función del Cabezal B en los invernaderos?";
        console.log(`\n📝 [TEST] Probando: "${consulta}"`);
        
        const resultado = await recuperarConocimientoRelevante(consulta);
        
        if (resultado && resultado.length > 0) {
            console.log(`✅ [ÉXITO] RAG funcionando correctamente`);
            console.log(`📄 [RESULTADO]:`);
            console.log('─'.repeat(80));
            console.log(resultado);
            console.log('─'.repeat(80));
        } else {
            console.log(`❌ [FALLO] RAG no devolvió resultado`);
        }
        
    } catch (error) {
        console.error('❌ [ERROR] Error en verificación:', error.message);
    }
}

// Exportar función principal
module.exports = {
    recuperarConocimientoRelevante,
    verificarFuncionamiento
};

// Ejecutar si se llama directamente
if (require.main === module) {
    console.log('🚀 [INTEGRACIÓN] Iniciando verificación...');
    
    async function main() {
        try {
            await verificarFuncionamiento();
            console.log('\n✅ [INTEGRACIÓN] Verificación completada');
        } catch (error) {
            console.error('❌ [ERROR] Error en verificación:', error);
        }
        
        process.exit(0);
    }
    
    main();
}
