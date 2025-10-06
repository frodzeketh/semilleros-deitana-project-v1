// =====================================
// TEST DIRECTO DEL RAG
// =====================================

// Cargar variables de entorno
require('dotenv').config();

const ragInteligente = require('./admin/core/ragInteligente');

async function testRagDirecto() {
    console.log('🧪 [TEST DIRECTO] Probando sistema RAG...\n');
    
    try {
        // Consultas específicas sobre teorías de plantas grandes
        const consultas = [
            "¿Cuál es la teoría en plantas grandes?",
            "¿Qué son las teorías TPG1 TPG2 TPG3?",
            "¿Qué información hay sobre SOLANACEAE Y APIACEAE?",
            "¿Cuál es la información sobre zanahorias?",
            "¿Qué son las teorías de planta grande para zanahorias?",
            "FAMILIA: ZANAHORIAS",
            "TPG1 SOLANACEAE Y APIACEAE 1"
        ];
        
        console.log('🔍 [TEST] Probando búsquedas específicas...\n');
        
        for (let i = 0; i < consultas.length; i++) {
            const consulta = consultas[i];
            console.log(`📝 [TEST ${i + 1}] "${consulta}"`);
            console.log('─'.repeat(80));
            
            try {
                // Usar el sistema RAG existente
                const resultado = await ragInteligente.recuperarConocimientoRelevante(consulta, 'test_user');
                
                if (resultado && resultado.length > 0) {
                    console.log('✅ [ÉXITO] Información encontrada:');
                    console.log(resultado.substring(0, 500) + '...');
                    console.log(`📊 Longitud total: ${resultado.length} caracteres`);
                } else {
                    console.log('❌ [FALLO] No se encontró información');
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
    testRagDirecto().then(() => {
        console.log('\n🎉 Test completado');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Error ejecutando test:', error);
        process.exit(1);
    });
}

module.exports = { testRagDirecto };
