// =====================================
// TEST RAG - ACTIVIDADES INCENTIVADAS
// =====================================

const ragInteligente = require('./admin/core/ragInteligente');

async function testRAGActividadesIncentivadas() {
    console.log('🧪 [TEST RAG] Probando sistema RAG con actividades incentivadas...');
    
    try {
        // Probar diferentes variaciones de la consulta
        const consultas = [
            'cuales son las actividades incentivadas?',
            'actividades incentivadas',
            'incentivos productividad',
            'tasa de productividad 600 plantas',
            'código 1 injertos hacer',
            'Z-ENTERRAR código 63'
        ];
        
        for (const consulta of consultas) {
            console.log(`\n🔍 [TEST RAG] Probando consulta: "${consulta}"`);
            
            try {
                const resultado = await ragInteligente.recuperarConocimientoRelevante(consulta, 'test-user');
                
                if (resultado && resultado.length > 0) {
                    console.log('✅ [TEST RAG] Resultado encontrado:');
                    console.log('='.repeat(50));
                    console.log(resultado.substring(0, 500) + '...');
                    console.log('='.repeat(50));
                    
                    // Verificar si contiene información específica
                    const contieneInfoEspecifica = resultado.includes('600 plantas por hora') || 
                                                 resultado.includes('código 1') ||
                                                 resultado.includes('Z-ENTERRAR') ||
                                                 resultado.includes('Injertos hacer');
                    
                    if (contieneInfoEspecifica) {
                        console.log('✅ [TEST RAG] ÉXITO: Contiene información específica sobre actividades incentivadas');
                    } else {
                        console.log('❌ [TEST RAG] ERROR: No contiene información específica sobre actividades incentivadas');
                    }
                } else {
                    console.log('❌ [TEST RAG] No se encontró resultado para esta consulta');
                }
                
            } catch (error) {
                console.error(`❌ [TEST RAG] Error con consulta "${consulta}":`, error.message);
            }
        }
        
    } catch (error) {
        console.error('❌ [TEST RAG] Error general:', error.message);
    }
}

// Ejecutar la prueba
testRAGActividadesIncentivadas().catch(console.error); 