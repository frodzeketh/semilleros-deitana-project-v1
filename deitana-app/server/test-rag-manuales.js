// =====================================
// TEST: VERIFICACIÓN DE SISTEMA RAG PARA MANUALES Y PROCESOS
// =====================================

const { processQuery } = require('./admin/core/openAI');

async function testRAGManuales() {
    console.log('🧪 [TEST] Iniciando prueba de sistema RAG para manuales y procesos...');
    
    const testQueries = [
        {
            message: 'dime un manual de procesos',
            expectedType: 'rag_sql',
            description: 'Consulta sobre manual de procesos'
        },
        {
            message: 'como es la entrada en camara y que se hace',
            expectedType: 'rag_sql',
            description: 'Consulta sobre entrada en cámara'
        },
        {
            message: '¿Qué tipos de bandejas utiliza la empresa y cuál es su función principal?',
            expectedType: 'rag_sql',
            description: 'Consulta sobre tipos de bandejas (para comparar)'
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
                userId: `test-user-rag-manuales-${i}`
            });
            
            console.log(`✅ [TEST ${i + 1}] Resultado obtenido:`);
            console.log(`✅ [TEST ${i + 1}] Estado:`, resultado.success);
            console.log(`✅ [TEST ${i + 1}] Respuesta:`, resultado.data.message.substring(0, 500) + '...');
            
            if (resultado.success) {
                console.log(`🎉 [TEST ${i + 1}] ¡ÉXITO! El sistema procesó correctamente la consulta`);
                
                // Verificar que la respuesta contiene información contextual del RAG
                const respuesta = resultado.data.message.toLowerCase();
                const palabrasClaveRAG = [
                    'semilleros deitana', 'totana', 'murcia', '1989', 'iso 9001',
                    'tomate', 'sandía', 'pepino', 'melón', 'injerto',
                    'bandeja', 'alvéolo', 'siembra', 'partida', 'etiquetado',
                    'cámara', 'germinación', 'invernadero', 'proveedor', 'cliente'
                ];
                
                const palabrasEncontradas = palabrasClaveRAG.filter(palabra => 
                    respuesta.includes(palabra)
                );
                
                console.log(`🔍 [TEST ${i + 1}] Palabras clave RAG encontradas:`, palabrasEncontradas);
                
                if (palabrasEncontradas.length >= 2) {
                    console.log(`✅ [TEST ${i + 1}] Respuesta contiene información contextual del RAG`);
                } else {
                    console.log(`⚠️ [TEST ${i + 1}] Respuesta podría no contener suficiente contexto RAG`);
                    console.log(`⚠️ [TEST ${i + 1}] Solo se encontraron ${palabrasEncontradas.length} palabras clave`);
                }
                
                // Verificar que NO contiene información inventada
                const palabrasInventadas = [
                    'manual de procedimientos para la selección y clasificación de semillas',
                    'envíos', 'embalaje', 'envío',
                    'plantones', 'desinfección', 'tratamiento previo'
                ];
                
                const palabrasInventadasEncontradas = palabrasInventadas.filter(palabra => 
                    respuesta.includes(palabra)
                );
                
                if (palabrasInventadasEncontradas.length > 0) {
                    console.log(`❌ [TEST ${i + 1}] ADVERTENCIA: Respuesta contiene información inventada:`, palabrasInventadasEncontradas);
                } else {
                    console.log(`✅ [TEST ${i + 1}] Respuesta no contiene información inventada`);
                }
                
            } else {
                console.log(`❌ [TEST ${i + 1}] El sistema falló al procesar la consulta`);
            }
            
        } catch (error) {
            console.error(`❌ [TEST ${i + 1}] Error durante la prueba:`, error.message);
        }
        
        // Pausa entre pruebas
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
}

// Ejecutar la prueba
testRAGManuales().then(() => {
    console.log('\n🏁 [TEST] Todas las pruebas completadas');
    process.exit(0);
}).catch(error => {
    console.error('💥 [TEST] Error fatal:', error);
    process.exit(1);
}); 