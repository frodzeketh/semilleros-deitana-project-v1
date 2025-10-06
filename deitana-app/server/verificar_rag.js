// =====================================
// SCRIPT PARA VERIFICAR EL RAG
// =====================================

const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');

// Configuración
const CONFIG = {
    PINECONE_API_KEY: process.env.PINECONE_API_KEY,
    PINECONE_INDEX: 'memoria-deitana',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY
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
 * Verificar estado del índice
 */
async function verificarIndice() {
    try {
        console.log('📊 [VERIFICACIÓN] Estado del índice Pinecone...');
        const index = pinecone.Index(CONFIG.PINECONE_INDEX);
        const stats = await index.describeIndexStats();
        
        console.log('📈 [ESTADÍSTICAS]');
        console.log(`   Total de vectores: ${stats.totalVectorCount}`);
        console.log(`   Dimensiones: ${stats.dimension}`);
        console.log(`   Espacio usado: ${stats.indexFullness}`);
        
        return stats;
    } catch (error) {
        console.error('❌ [ERROR] Verificando índice:', error.message);
        throw error;
    }
}

/**
 * Buscar información específica
 */
async function buscarInformacion(consulta) {
    try {
        console.log(`🔍 [BÚSQUEDA] Buscando: "${consulta}"`);
        
        // Generar embedding de la consulta
        const embeddingConsulta = await generarEmbedding(consulta);
        
        // Buscar en Pinecone
        const index = pinecone.Index(CONFIG.PINECONE_INDEX);
        const queryResponse = await index.query({
            vector: embeddingConsulta,
            topK: 10,
            includeMetadata: true,
            filter: {
                tipo: 'informacion_empresa_oficial'
            }
        });
        
        console.log(`📊 [RESULTADOS] Encontrados ${queryResponse.matches.length} fragmentos`);
        
        // Mostrar resultados
        queryResponse.matches.forEach((match, index) => {
            console.log(`\n--- RESULTADO ${index + 1} ---`);
            console.log(`ID: ${match.id}`);
            console.log(`Score: ${match.score.toFixed(4)}`);
            console.log(`Tipo: ${match.metadata.tipo}`);
            console.log(`Título: ${match.metadata.titulo || 'Sin título'}`);
            console.log(`Contenido (primeros 200 chars): ${match.metadata.texto.substring(0, 200)}...`);
        });
        
        return queryResponse.matches;
        
    } catch (error) {
        console.error('❌ [ERROR] En búsqueda:', error.message);
        return [];
    }
}

/**
 * Buscar por términos específicos
 */
async function buscarPorTerminos(terminos) {
    console.log(`🎯 [BÚSQUEDA ESPECÍFICA] Buscando términos: ${terminos.join(', ')}`);
    
    const resultados = [];
    
    for (const termino of terminos) {
        console.log(`\n🔍 Buscando: "${termino}"`);
        const matches = await buscarInformacion(termino);
        
        if (matches.length > 0) {
            console.log(`✅ Encontrado: ${matches.length} resultados para "${termino}"`);
            resultados.push({ termino, matches });
        } else {
            console.log(`❌ No encontrado: "${termino}"`);
        }
    }
    
    return resultados;
}

/**
 * Función principal
 */
async function main() {
    try {
        console.log('🚀 [VERIFICACIÓN RAG] Iniciando verificación...\n');
        
        // 1. Verificar estado del índice
        await verificarIndice();
        
        console.log('\n' + '='.repeat(50));
        
        // 2. Buscar información específica sobre teorías de plantas grandes
        const terminosBusqueda = [
            'teorías planta grande',
            'TPG1',
            'SOLANACEAE Y APIACEAE',
            'zanahorias',
            'FAMILIA: ZANAHORIAS',
            'teoría plantas grandes'
        ];
        
        const resultados = await buscarPorTerminos(terminosBusqueda);
        
        console.log('\n' + '='.repeat(50));
        console.log('📋 [RESUMEN]');
        console.log(`Términos buscados: ${terminosBusqueda.length}`);
        console.log(`Términos encontrados: ${resultados.length}`);
        
        if (resultados.length > 0) {
            console.log('\n✅ [ÉXITO] La información está disponible en Pinecone');
            console.log('🎯 El sistema RAG debería funcionar correctamente');
        } else {
            console.log('\n❌ [PROBLEMA] No se encontró la información específica');
            console.log('🔧 Posibles causas:');
            console.log('   - La información no se indexó correctamente');
            console.log('   - Los términos de búsqueda no coinciden');
            console.log('   - Problema con los embeddings');
        }
        
    } catch (error) {
        console.error('❌ [ERROR FATAL]:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main().then(() => {
        console.log('\n✅ Verificación completada');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Error en verificación:', error);
        process.exit(1);
    });
}

module.exports = { verificarIndice, buscarInformacion, buscarPorTerminos };
