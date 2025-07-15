// =====================================
// TEST DE DEBUG PARA STREAMING
// =====================================

const { processQueryStream } = require('./admin/core/openAI');

async function testStreamingDebug() {
    console.log('🧪 [DEBUG] Iniciando test de debug para streaming...');
    
    // Simular respuesta HTTP simple
    let chunksRecibidos = [];
    let finalResponse = '';
    let headersEnviados = false;
    
    const mockResponse = {
        writeHead: (status, headers) => {
            console.log('📤 [DEBUG] Headers enviados:', status);
            console.log('📤 [DEBUG] Headers:', headers);
            headersEnviados = true;
        },
        write: (data) => {
            console.log('📤 [DEBUG] Chunk recibido (longitud:', data.toString().length, '):');
            console.log('📤 [DEBUG] Contenido:', data.toString().substring(0, 200));
            chunksRecibidos.push(data.toString());
            
            // Parsear el JSON para extraer el contenido
            try {
                const lines = data.toString().split('\n').filter(line => line.trim());
                for (const line of lines) {
                    console.log('📤 [DEBUG] Procesando línea:', line.substring(0, 100));
                    const parsed = JSON.parse(line);
                    if (parsed.type === 'chunk' && parsed.content) {
                        finalResponse += parsed.content;
                        console.log('📤 [DEBUG] Contenido agregado:', parsed.content);
                    } else if (parsed.type === 'end') {
                        console.log('✅ [DEBUG] Stream finalizado con respuesta completa');
                        console.log('✅ [DEBUG] Respuesta final:', parsed.fullResponse);
                    } else if (parsed.type === 'error') {
                        console.log('❌ [DEBUG] Error en stream:', parsed.message);
                    }
                }
            } catch (error) {
                console.log('⚠️ [DEBUG] Error parseando línea:', error.message);
                console.log('⚠️ [DEBUG] Línea problemática:', line);
            }
        },
        end: () => {
            console.log('🏁 [DEBUG] Response finalizada');
        },
        headersSent: false
    };
    
    try {
        console.log('🚀 [DEBUG] Llamando a processQueryStream...');
        
        await processQueryStream({
            message: 'hola',
            userId: 'test-debug',
            conversationId: 'test-conversation',
            response: mockResponse
        });
        
        console.log('✅ [DEBUG] Test completado exitosamente');
        console.log('📊 [DEBUG] Headers enviados:', headersEnviados);
        console.log('📊 [DEBUG] Chunks recibidos:', chunksRecibidos.length);
        console.log('📝 [DEBUG] Respuesta final acumulada:', finalResponse.substring(0, 200) + '...');
        
    } catch (error) {
        console.error('❌ [DEBUG] Error en test:', error);
        console.error('❌ [DEBUG] Stack trace:', error.stack);
    }
}

// Ejecutar test
testStreamingDebug(); 