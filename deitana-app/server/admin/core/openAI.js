const { OpenAI } = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');
const { addMessage, getHistory } = require('../../utils/ramMemory');
const { query } = require('../../db-bridge');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Configurar Pinecone
const pinecone = new Pinecone({
    apiKey: 'pcsk_ctXEB_EytPZdg6HJhk2HPbfvEfknyuM671AZUmwz82YSMVgjYfGfR3QfsLMXC8BcRjUvY'
});

const index = pinecone.index('deitana-knowledge');

// Función para buscar información relevante en Pinecone
async function searchRelevantInfo(query) {
    try {
        // Crear embedding del query
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: query,
            dimensions: 512
        });
        
        const queryEmbedding = embeddingResponse.data[0].embedding;
        
        // Buscar en Pinecone con más resultados
        const searchResponse = await index.query({
            vector: queryEmbedding,
            topK: 10,  // Aumentar de 3 a 10 para más cobertura
            includeMetadata: true
        });
        
        // Extraer información relevante
        console.log('🔍 [RAG] Resultados de búsqueda:', searchResponse.matches.length);
        const relevantInfo = searchResponse.matches
            .map(match => {
                console.log('📄 [RAG] Match encontrado:', match.metadata);
                return match.metadata?.text || match.metadata?.content || '';
            })
            .filter(text => text.length > 0)
            .join('\n\n');
        
        console.log('📊 [RAG] Información relevante encontrada:', relevantInfo.length, 'caracteres');
            
        return relevantInfo;
    } catch (error) {
        console.error('Error buscando en Pinecone:', error);
        return '';
    }
}

async function processQueryStream({ message, conversationId, response }) {
    try {
        console.log('🚀 [OPENAI] Procesando con memoria RAM y function calling');
        
        // 1. MEMORIA RAM SIMPLE
        const conversationIdFinal = conversationId || `temp_${Date.now()}`;
        const history = getHistory(conversationIdFinal);
        
        // 2. AGREGAR MENSAJE DEL USUARIO
        addMessage(conversationIdFinal, 'user', message);
        
        // 3. BUSCAR INFORMACIÓN RELEVANTE EN RAG
        const relevantInfo = await searchRelevantInfo(message);
        
        // 4. CREAR PROMPT CON CONTEXTO DE LA EMPRESA
        const systemPrompt = `Eres un asistente especializado de Semilleros Deitana, S.L. 

INFORMACIÓN ESPECÍFICA DE LA EMPRESA:
${relevantInfo}

INSTRUCCIONES CRÍTICAS:
- SIEMPRE usa la información específica de Deitana que se te proporciona arriba
- Si encuentras información relevante en el contexto, úsala como base de tu respuesta
- Responde de manera completa y detallada
- Si la información específica no está disponible, menciona que no tienes esa información específica
- Mantén un tono profesional y cercano
- Responde siempre en español

CAPACIDADES ESPECIALES - EJECUCIÓN DE SQL:
- Tienes acceso a la función execute_sql para consultar la base de datos MySQL
- USA execute_sql cuando el usuario pregunte por:
  * Cantidades: "cuántos clientes", "cuántos vendedores", "cuántos artículos"
  * Listados: "listar clientes", "mostrar vendedores", "artículos con stock bajo"
  * Datos específicos: "clientes de Madrid", "vendedores activos", "stock de tomates"
- NO uses execute_sql para preguntas conceptuales como "qué es un ciprés" o "cómo funciona el injerto"
- IMPORTANTE: Usa nombres de tablas sin comillas o con comillas simples, NO comillas dobles
- Después de ejecutar SQL, explica los resultados de manera clara y útil

IMPORTANTE: La información de arriba es específica de Semilleros Deitana. Úsala para dar respuestas precisas sobre la empresa.`;

        // 5. PREPARAR MENSAJES CON HISTORIAL Y FUNCIONES
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history, // Historial completo desde RAM
            { role: 'user', content: message }
        ];

        console.log(`💬 [RAM] Enviando ${messages.length} mensajes a GPT-4o con function calling`);

        // UNA SOLA LLAMADA - STREAMING CON FUNCTION CALLING
        const stream = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            tools: [
                {
                    type: 'function',
                    function: {
                        name: 'execute_sql',
                        description: 'Ejecuta una consulta SQL en la base de datos de Semilleros Deitana',
                        parameters: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'La consulta SQL a ejecutar'
                                }
                            },
                            required: ['query']
                        }
                    }
                }
            ],
            tool_choice: 'auto',
            stream: true,
            max_tokens: 2000
        });

        // 6. STREAMING CON DETECCIÓN DE FUNCTION CALLS
        let assistantResponse = '';
        let functionName = null;
        let functionArguments = '';
        let toolCallId = null;
        
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            
            // Manejar contenido de texto
            if (delta?.content) {
                assistantResponse += delta.content;
                const jsonChunk = JSON.stringify({ type: 'chunk', content: delta.content }) + '\n';
                console.log('📤 [STREAM] Enviando chunk:', delta.content.substring(0, 50) + '...');
                response.write(jsonChunk);
            }
            
            // Manejar llamadas a funciones
            if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                    if (toolCall.function) {
                        if (toolCall.function.name) {
                            functionName = toolCall.function.name;
                            console.log('🔧 [FUNCTION] Función detectada:', functionName);
                        }
                        if (toolCall.function.arguments) {
                            functionArguments += toolCall.function.arguments;
                        }
                        if (toolCall.id) {
                            toolCallId = toolCall.id;
                        }
                    }
                }
            }
        }

        // 7. EJECUTAR SQL SI SE DETECTÓ
        console.log('🔍 [DEBUG] functionName:', functionName);
        console.log('🔍 [DEBUG] functionArguments:', functionArguments);
        console.log('🔍 [DEBUG] toolCallId:', toolCallId);
        
        if (functionName === 'execute_sql' && functionArguments) {
            try {
                console.log('🔍 [DEBUG] Argumentos completos:', functionArguments);
                const args = JSON.parse(functionArguments);
                let sqlQuery = args.query;
                
                // Arreglar comillas dobles por simples para MySQL
                sqlQuery = sqlQuery.replace(/"/g, '`');
                
                console.log('⚡ [SQL] Ejecutando SQL:', sqlQuery);
                
                // Ejecutar SQL
                const sqlResults = await query(sqlQuery);
                console.log('📊 [SQL] Resultados obtenidos:', sqlResults.length, 'filas');
                
                // Continuar la conversación con los resultados SQL para que el modelo responda inteligentemente
                const continuationMessages = [
                    { role: 'system', content: systemPrompt }, // Incluir system prompt en la segunda llamada
                    ...messages,
                    { role: 'assistant', content: assistantResponse, tool_calls: [{ type: 'function', function: { name: functionName, arguments: functionArguments }, id: toolCallId }] },
                    { role: 'tool', content: JSON.stringify(sqlResults), tool_call_id: toolCallId }
                ];
                
                console.log('🔄 [CONTINUATION] Enviando resultados SQL al modelo para respuesta inteligente');
                
                // Segunda llamada para que el modelo responda con los datos
                const continuationStream = await openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: continuationMessages,
                    stream: true,
                    max_tokens: 1000
                });
                
                // Stream de la respuesta inteligente del modelo
                for await (const chunk of continuationStream) {
                    const content = chunk.choices[0]?.delta?.content || '';
                    if (content) {
                        assistantResponse += content;
                        const jsonChunk = JSON.stringify({ type: 'chunk', content }) + '\n';
                        console.log('📤 [STREAM] Enviando chunk inteligente:', content.substring(0, 50) + '...');
                        response.write(jsonChunk);
                    }
                }
                
                console.log('✅ [SQL] Function calling completado - modelo respondió inteligentemente');
                
                // Guardar respuesta en memoria
                addMessage(conversationIdFinal, 'assistant', assistantResponse);
                console.log('💾 [RAM] Respuesta SQL formateada guardada en memoria');
                
                // Enviar mensaje de finalización
                const endChunk = JSON.stringify({ type: 'end', conversationId: conversationIdFinal }) + '\n';
                response.write(endChunk);
                console.log('🔚 [END] Enviando mensaje de finalización');
                
                response.end();
                return;
                
                } catch (error) {
                console.error('❌ [SQL] Error en function calling:', error);
                const errorChunk = JSON.stringify({ type: 'chunk', content: `Error al ejecutar la consulta: ${error.message}` }) + '\n';
                response.write(errorChunk);
                response.end();
                return;
            }
        }

        // 8. GUARDAR RESPUESTA FINAL EN RAM
        if (assistantResponse.trim()) {
            addMessage(conversationIdFinal, 'assistant', assistantResponse);
            console.log('💾 [RAM] Respuesta final guardada en memoria');
            console.log('📤 [FINAL] Respuesta completa:', assistantResponse.substring(0, 200) + '...');
        }

        // Enviar mensaje de finalización
        const endChunk = JSON.stringify({ type: 'end', conversationId: conversationIdFinal }) + '\n';
        response.write(endChunk);
        console.log('🔚 [END] Enviando mensaje de finalización');
        
        response.end();
            
                } catch (error) {
        console.error('Error:', error);
        if (!response.headersSent) {
            response.status(500).json({ error: 'Error al procesar la consulta' });
        }
    }
}

module.exports = {
    processQueryStream
};