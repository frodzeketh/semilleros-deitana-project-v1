// =====================================
// TEST: VERIFICACIÓN DE SISTEMA RAG+SQL PARA BANDEJAS
// =====================================

const { processQuery } = require('./admin/core/openAI');

async function testRAGSQLBandejas() {
    console.log('🧪 [TEST] Iniciando prueba de sistema RAG+SQL para bandejas...');
    
    const testQueries = [
        {
            message: '¿Qué tipos de bandejas utiliza la empresa y cuál es su función principal?',
            expectedType: 'rag_sql',
            description: 'Consulta sobre tipos y funciones de bandejas'
        },
        {
            message: '¿Cómo se procede con el etiquetado de bandejas?',
            expectedType: 'rag_sql',
            description: 'Consulta sobre procedimiento de etiquetado'
        },
        {
            message: 'Listar 5 bandejas disponibles',
            expectedType: 'sql',
            description: 'Consulta SQL pura para listar bandejas'
        }
    ];
    
    for (let i = 0; i < testQueries.length; i++) {
        const testQuery = testQueries[i];
        console.log(`\n📝 [TEST ${i + 1}] ${testQuery.description}`);
        console.log(`📝 [TEST ${i + 1}] Consulta: "${testQuery.message}"`);
        console.log(`📝 [TEST ${i + 1}] Tipo esperado: ${testQuery.expectedType}`);
        
        try {
            const resultado = await processQuery({
                message: testQuery.message,
                userId: `test-user-rag-sql-${i}`
            });
            
            console.log(`✅ [TEST ${i + 1}] Resultado obtenido:`);
            console.log(`✅ [TEST ${i + 1}] Estado:`, resultado.success);
            console.log(`✅ [TEST ${i + 1}] Respuesta:`, resultado.data.message.substring(0, 300) + '...');
            
            if (resultado.success) {
                console.log(`🎉 [TEST ${i + 1}] ¡ÉXITO! El sistema procesó correctamente la consulta`);
                
                // Verificar que la respuesta contiene información contextual
                const respuesta = resultado.data.message.toLowerCase();
                if (testQuery.expectedType === 'rag_sql') {
                    if (respuesta.includes('tipos') || respuesta.includes('procedimiento') || respuesta.includes('etiquetado')) {
                        console.log(`✅ [TEST ${i + 1}] Respuesta contiene información contextual (RAG)`);
                    } else {
                        console.log(`⚠️ [TEST ${i + 1}] Respuesta podría no contener suficiente contexto RAG`);
                    }
                }
            } else {
                console.log(`❌ [TEST ${i + 1}] El sistema falló al procesar la consulta`);
            }
            
        } catch (error) {
            console.error(`❌ [TEST ${i + 1}] Error durante la prueba:`, error.message);
        }
        
        // Pausa entre pruebas
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

// Ejecutar la prueba
testRAGSQLBandejas().then(() => {
    console.log('\n🏁 [TEST] Todas las pruebas completadas');
    process.exit(0);
}).catch(error => {
    console.error('💥 [TEST] Error fatal:', error);
    process.exit(1);
}); 