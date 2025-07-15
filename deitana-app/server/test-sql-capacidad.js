// =====================================
// TEST DE CAPACIDAD SQL INTELIGENTE
// =====================================

const { processQueryStream } = require('./admin/core/openAI');

async function testSQLCapacidad() {
    console.log('🧪 [TEST] Iniciando test de capacidad SQL inteligente...');
    
    // Simular respuesta HTTP
    let chunksRecibidos = [];
    let finalResponse = '';
    
    const mockResponse = {
        writeHead: (status, headers) => {
            console.log('📤 [MOCK] Headers enviados:', status);
        },
        write: (data) => {
            console.log('📤 [MOCK] Chunk recibido:', data.toString().substring(0, 100));
            chunksRecibidos.push(data.toString());
            
            // Parsear el JSON
            try {
                const lines = data.toString().split('\n').filter(line => line.trim());
                for (const line of lines) {
                    const parsed = JSON.parse(line);
                    if (parsed.type === 'chunk' && parsed.content) {
                        finalResponse += parsed.content;
                    } else if (parsed.type === 'end') {
                        console.log('✅ [MOCK] Stream finalizado con respuesta completa');
                        console.log('✅ [MOCK] Respuesta final:', parsed.fullResponse);
                    }
                }
            } catch (error) {
                console.log('⚠️ [MOCK] Error parseando:', error.message);
            }
        },
        end: () => {
            console.log('🏁 [MOCK] Response finalizada');
        }
    };
    
    // Test 1: Consulta que debería generar SQL
    console.log('\n📝 [TEST] Test 1: "dame 2 clientes"');
    try {
        await processQueryStream({
            message: 'dame 2 clientes',
            userId: 'test-sql-capacidad',
            conversationId: 'test-conversation',
            response: mockResponse
        });
        
        console.log('✅ [TEST] Test 1 completado');
        console.log('📊 [TEST] Chunks recibidos:', chunksRecibidos.length);
        console.log('📝 [TEST] Respuesta final:', finalResponse.substring(0, 200) + '...');
        
    } catch (error) {
        console.error('❌ [TEST] Error en test 1:', error);
    }
    
    // Test 2: Consulta de conocimiento puro
    console.log('\n📝 [TEST] Test 2: "qué significa quando el cliente dice quiero todo"');
    try {
        await processQueryStream({
            message: 'qué significa quando el cliente dice quiero todo',
            userId: 'test-sql-capacidad',
            conversationId: 'test-conversation',
            response: mockResponse
        });
        
        console.log('✅ [TEST] Test 2 completado');
        console.log('📊 [TEST] Chunks recibidos:', chunksRecibidos.length);
        console.log('📝 [TEST] Respuesta final:', finalResponse.substring(0, 200) + '...');
        
    } catch (error) {
        console.error('❌ [TEST] Error en test 2:', error);
    }
}

// Ejecutar test
testSQLCapacidad(); 