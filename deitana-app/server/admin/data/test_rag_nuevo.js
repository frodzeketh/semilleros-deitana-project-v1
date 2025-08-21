// =====================================
// TEST DEL NUEVO SISTEMA RAG
// =====================================

const ragNuevo = require('./rag_nuevo');

async function testRagNuevo() {
    console.log('🧪 [TEST] Probando nuevo sistema RAG...\n');
    
    try {
        // Verificar estado del índice
        console.log('📊 [TEST] Verificando estado del índice...');
        await ragNuevo.verificarIndice();
        
        // Probar búsquedas
        const consultas = [
            "¿Cuál es la función del Cabezal B en los invernaderos?",
            "¿Qué información hay sobre Pedro Muñoz?",
            "¿Cuántos alvéolos defectuosos hacen que una bandeja se tire?",
            "¿Quién es el Responsable de la sección de Siembra?",
            "¿Qué son los tratamientos extraordinarios?",
            "¿Cómo funcionan los cultivos ecológicos?",
            "¿Qué información hay sobre B1 B2 B3 sectores?"
        ];
        
        console.log('\n🔍 [TEST] Probando búsquedas...\n');
        
        for (let i = 0; i < consultas.length; i++) {
            const consulta = consultas[i];
            console.log(`📝 [TEST ${i + 1}] "${consulta}"`);
            console.log('─'.repeat(80));
            
            try {
                const resultado = await ragNuevo.buscarInformacion(consulta);
                console.log(resultado);
                
                // Verificar si encontró información relevante
                if (resultado && !resultado.includes('No se encontró información')) {
                    console.log(`✅ [ÉXITO] Consulta ${i + 1} encontró información`);
                } else {
                    console.log(`❌ [FALLO] Consulta ${i + 1} no encontró información`);
                }
                
            } catch (error) {
                console.error(`❌ [ERROR] Error en consulta ${i + 1}:`, error.message);
            }
            
            console.log('─'.repeat(80));
            console.log(''); // Separador
            
            // Pausa entre consultas
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('🏁 [TEST] Todas las consultas probadas');
        
    } catch (error) {
        console.error('❌ [ERROR] Error en test:', error.message);
    }
}

// Ejecutar test
if (require.main === module) {
    testRagNuevo().then(() => {
        console.log('\n🎉 Test completado');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Error ejecutando test:', error);
        process.exit(1);
    });
}

module.exports = { testRagNuevo };
