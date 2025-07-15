// =====================================
// TEST SIMPLE DE STREAMING - VERSIÓN BÁSICA
// =====================================

const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function testStreamingSimple() {
    console.log('🧪 [TEST] Iniciando test de streaming simple...');
    
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
    
    try {
        console.log('🚀 [TEST] Llamando a OpenAI...');
        
        const stream = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'Eres un asistente útil. Responde de forma natural y amigable.'
                },
                {
                    role: 'user',
                    content: 'hola'
                }
            ],
            max_tokens: 100,
            temperature: 0.3,
            stream: true
        });

        console.log('✅ [TEST] Stream iniciado correctamente');

        // Procesar cada chunk del stream
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            
            if (content) {
                // Enviar chunk al frontend
                mockResponse.write(JSON.stringify({
                    type: 'chunk',
                    content: content,
                    timestamp: Date.now()
                }) + '\n');
            }
            
            // Si el stream terminó
            if (chunk.choices[0]?.finish_reason) {
                console.log('✅ [TEST] Stream completado');
                break;
            }
        }

        // Enviar señal de finalización
        mockResponse.write(JSON.stringify({
            type: 'end',
            fullResponse: finalResponse,
            timestamp: Date.now()
        }) + '\n');

        mockResponse.end();
        
        console.log('✅ [TEST] Test completado exitosamente');
        console.log('📊 [TEST] Chunks recibidos:', chunksRecibidos.length);
        console.log('📝 [TEST] Respuesta final:', finalResponse);
        
    } catch (error) {
        console.error('❌ [TEST] Error en test:', error);
    }
}

// Ejecutar test
testStreamingSimple(); 