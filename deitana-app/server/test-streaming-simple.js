// =====================================
// TEST SIMPLE DE STREAMING
// =====================================

const { processQueryStream } = require('./admin/core/openAI');

async function testStreamingSimple() {
    console.log('🧪 [TEST] Iniciando test de streaming simple...');
    
    // Simular respuesta HTTP
    let chunksRecibidos = [];
    let finalResponse = '';
    
    const mockResponse = {
        writeHead: (status, headers) => {
            console.log('📤 [MOCK] Headers enviados:', status, headers);
        },
        write: (data) => {
            console.log('📤 [MOCK] Chunk recibido:', data.toString().substring(0, 100) + '...');
            chunksRecibidos.push(data.toString());
            
            // Parsear el JSON para extraer el contenido
            try {
                const lines = data.toString().split('\n').filter(line => line.trim());
                for (const line of lines) {
                    const parsed = JSON.parse(line);
                    if (parsed.type === 'chunk' && parsed.content) {
                        finalResponse += parsed.content;
                    } else if (parsed.type === 'end') {
                        console.log('✅ [MOCK] Stream finalizado con respuesta completa');
                    }
                }
            } catch (error) {
                console.log('⚠️ [MOCK] Error parseando chunk:', error.message);
            }
        },
        end: () => {
            console.log('🏁 [MOCK] Response finalizada');
        }
    };
    
    try {
        await processQueryStream({
            message: 'qué significa quando el cliente dice quiero todo',
            userId: 'test-streaming',
            conversationId: 'test-conversation',
            response: mockResponse
        });
        
        console.log('✅ [TEST] Test completado exitosamente');
        console.log('📊 [TEST] Chunks recibidos:', chunksRecibidos.length);
        console.log('📝 [TEST] Respuesta final:', finalResponse.substring(0, 200) + '...');
        
    } catch (error) {
        console.error('❌ [TEST] Error en test:', error);
    }
}

// Ejecutar test
testStreamingSimple(); 