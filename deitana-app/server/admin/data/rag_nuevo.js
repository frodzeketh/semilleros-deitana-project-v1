
// =====================================
// SISTEMA RAG NUEVO DESDE CERO
// =====================================

const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');

// Configuración
const CONFIG = {
    PINECONE_API_KEY: process.env.PINECONE_API_KEY,
    PINECONE_INDEX: 'memoria-deitana',
    PINECONE_ENVIRONMENT: 'us-east-1-aws',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    MAX_CHUNKS: 10,
    SIMILARITY_THRESHOLD: 0.7
};

// Inicializar Pinecone
const pinecone = new Pinecone({
    apiKey: CONFIG.PINECONE_API_KEY
});

// Inicializar OpenAI
const openai = new OpenAI({
    apiKey: CONFIG.OPENAI_API_KEY
});

/**
 * Generar embedding para un texto
 */
async function generarEmbedding(texto) {
    try {
        const response = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: texto
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error('❌ Error generando embedding:', error.message);
        throw error;
    }
}

/**
 * Indexar archivo completo en Pinecone
 */
async function indexarArchivoCompleto() {
    try {
        console.log('🚀 [RAG NUEVO] Iniciando indexación completa...');
        
        // Leer archivo
        const fs = require('fs');
        const path = require('path');
        const archivoPath = path.join(__dirname, 'informacionEmpresa.txt');
        
        if (!fs.existsSync(archivoPath)) {
            throw new Error('Archivo informacionEmpresa.txt no encontrado');
        }
        
        const contenido = fs.readFileSync(archivoPath, 'utf8');
        console.log(`📄 [RAG NUEVO] Archivo leído: ${contenido.length} caracteres`);
        
        // Limpiar índice existente
        console.log('🧹 [RAG NUEVO] Limpiando índice existente...');
        const index = pinecone.Index(CONFIG.PINECONE_INDEX);
        
        try {
            await index.deleteAll();
            console.log('✅ [RAG NUEVO] Índice limpiado');
        } catch (error) {
            console.log('⚠️ [RAG NUEVO] No se pudo limpiar el índice (puede estar vacío)');
        }
        
        // Dividir en chunks más inteligentes
        const chunks = dividirEnChunksInteligentes(contenido);
        console.log(`📦 [RAG NUEVO] Creados ${chunks.length} chunks inteligentes`);
        
        // Indexar cada chunk
        let indexados = 0;
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            console.log(`📝 [RAG NUEVO] Indexando chunk ${i + 1}/${chunks.length}: ${chunk.titulo}`);
            
            try {
                const embedding = await generarEmbedding(chunk.contenido);
                
                await index.upsert([{
                    id: `chunk_${i}_${Date.now()}`,
                    values: embedding,
                    metadata: {
                        texto: chunk.contenido,
                        titulo: chunk.titulo,
                        tipo: 'informacion_empresa',
                        timestamp: Date.now(),
                        chunk_id: i
                    }
                }]);
                
                indexados++;
                console.log(`✅ [RAG NUEVO] Chunk ${i + 1} indexado`);
                
                // Pausa para no sobrecargar la API
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`❌ [RAG NUEVO] Error indexando chunk ${i + 1}:`, error.message);
            }
        }
        
        console.log(`🎉 [RAG NUEVO] Indexación completada: ${indexados}/${chunks.length} chunks`);
        return indexados;
        
    } catch (error) {
        console.error('❌ [RAG NUEVO] Error en indexación:', error.message);
        throw error;
    }
}

/**
 * Dividir contenido en chunks inteligentes
 */
function dividirEnChunksInteligentes(contenido) {
    const chunks = [];
    
    // Dividir por secciones principales
    const secciones = contenido.split(/=== (.+?) ===/);
    
    for (let i = 1; i < secciones.length; i += 2) {
        const titulo = secciones[i].trim();
        const contenidoSeccion = secciones[i + 1] ? secciones[i + 1].trim() : '';
        
        if (contenidoSeccion.length > 100) { // Solo secciones con contenido
            chunks.push({
                titulo: titulo,
                contenido: `=== ${titulo} ===\n\n${contenidoSeccion}`
            });
        }
    }
    
    // Si no hay secciones claras, dividir por párrafos
    if (chunks.length === 0) {
        const parrafos = contenido.split(/\n\n+/);
        let chunkActual = '';
        let chunkId = 0;
        
        for (const parrafo of parrafos) {
            if (parrafo.trim().length > 50) {
                chunkActual += parrafo + '\n\n';
                
                if (chunkActual.length > 1500) {
                    chunks.push({
                        titulo: `Párrafo ${chunkId + 1}`,
                        contenido: chunkActual.trim()
                    });
                    chunkActual = '';
                    chunkId++;
                }
            }
        }
        
        if (chunkActual.trim()) {
            chunks.push({
                titulo: `Párrafo ${chunkId + 1}`,
                contenido: chunkActual.trim()
            });
        }
    }
    
    return chunks;
}

/**
 * Buscar información relevante
 */
async function buscarInformacion(consulta) {
    try {
        console.log(`🔍 [RAG NUEVO] Buscando: "${consulta}"`);
        
        // Generar embedding de la consulta
        const embeddingConsulta = await generarEmbedding(consulta);
        
        // Buscar en Pinecone
        const index = pinecone.Index(CONFIG.PINECONE_INDEX);
        const queryResponse = await index.query({
            vector: embeddingConsulta,
            topK: CONFIG.MAX_CHUNKS,
            includeMetadata: true
        });
        
        // Filtrar resultados relevantes
        const resultadosRelevantes = queryResponse.matches
            .filter(match => match.score > CONFIG.SIMILARITY_THRESHOLD)
            .map(match => ({
                contenido: match.metadata.texto,
                titulo: match.metadata.titulo,
                score: match.score,
                chunk_id: match.metadata.chunk_id
            }))
            .sort((a, b) => b.score - a.score);
        
        console.log(`📊 [RAG NUEVO] Encontrados ${resultadosRelevantes.length} resultados relevantes`);
        
        // Construir respuesta
        if (resultadosRelevantes.length > 0) {
            const respuesta = resultadosRelevantes
                .map(r => `**${r.titulo}** (Score: ${r.score.toFixed(3)})\n${r.contenido}`)
                .join('\n\n---\n\n');
            
            return respuesta;
        } else {
            return 'No se encontró información relevante para tu consulta.';
        }
        
    } catch (error) {
        console.error('❌ [RAG NUEVO] Error en búsqueda:', error.message);
        return `Error en la búsqueda: ${error.message}`;
    }
}

/**
 * Verificar estado del índice
 */
async function verificarIndice() {
    try {
        const index = pinecone.Index(CONFIG.PINECONE_INDEX);
        const stats = await index.describeIndexStats();
        
        console.log('📊 [RAG NUEVO] Estado del índice:');
        console.log(`   Total de vectores: ${stats.totalVectorCount}`);
        console.log(`   Dimensiones: ${stats.dimension}`);
        console.log(`   Espacio usado: ${stats.indexFullness}`);
        
        return stats;
    } catch (error) {
        console.error('❌ [RAG NUEVO] Error verificando índice:', error.message);
        throw error;
    }
}

// Exportar funciones
module.exports = {
    indexarArchivoCompleto,
    buscarInformacion,
    verificarIndice,
    generarEmbedding
};

// Ejecutar si se llama directamente
if (require.main === module) {
    console.log('🚀 [RAG NUEVO] Iniciando sistema...');
    
    async function main() {
        try {
            // Verificar índice
            await verificarIndice();
            
            // Preguntar si indexar
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            rl.question('¿Quieres reindexar el archivo? (s/n): ', async (respuesta) => {
                if (respuesta.toLowerCase() === 's') {
                    console.log('🔄 [RAG NUEVO] Iniciando reindexación...');
                    await indexarArchivoCompleto();
                    console.log('✅ [RAG NUEVO] Reindexación completada');
                } else {
                    console.log('ℹ️ [RAG NUEVO] No se reindexó');
                }
                
                rl.close();
                process.exit(0);
            });
            
        } catch (error) {
            console.error('❌ [RAG NUEVO] Error:', error.message);
            process.exit(1);
        }
    }
    
    main();
}
