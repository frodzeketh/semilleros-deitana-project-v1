// =====================================
// VERIFICACIÓN PINECONE - ESTADO DEL SISTEMA RAG
// =====================================

const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAI } = require('openai');
require('dotenv').config();

const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const INDEX_NAME = process.env.PINECONE_INDEX || 'memoria-deitana';

async function verificarPinecone() {
    console.log('🔍 [VERIFICACIÓN] Comprobando estado de Pinecone...\n');
    
    try {
        // 1. Verificar conexión a Pinecone
        console.log('📡 [PINECONE] Verificando conexión...');
        const index = pinecone.Index(INDEX_NAME);
        const stats = await index.describeIndexStats();
        console.log('✅ [PINECONE] Conexión exitosa');
        console.log(`📊 [PINECONE] Estadísticas del índice:`);
        console.log(`   - Nombre: ${stats.database?.name || INDEX_NAME}`);
        console.log(`   - Dimensiones: ${stats.dimension || 'N/A'}`);
        console.log(`   - Vectores totales: ${stats.totalVectorCount || 0}`);
        console.log(`   - Namespaces: ${Object.keys(stats.namespaces || {}).length}`);
        
        // 2. Verificar si hay datos del archivo de información empresarial
        console.log('\n🔍 [BUSQUEDA] Verificando datos de información empresarial...');
        
        // Buscar por términos específicos del archivo
        const terminosBusqueda = [
            'cucurbitáceas',
            'ecológico',
            'tratamientos extraordinarios',
            'Pedro Muñoz',
            'tomate amarelo'
        ];
        
        for (const termino of terminosBusqueda) {
            console.log(`\n🔍 [BUSQUEDA] Buscando: "${termino}"`);
            
            try {
                const embedding = await openai.embeddings.create({
                    model: "text-embedding-ada-002",
                    input: termino,
                });
                
                const queryResponse = await index.query({
                    vector: embedding.data[0].embedding,
                    topK: 3,
                    includeMetadata: true
                });
                
                if (queryResponse.matches && queryResponse.matches.length > 0) {
                    console.log(`✅ [BUSQUEDA] Encontrados ${queryResponse.matches.length} resultados para "${termino}"`);
                    
                    for (let i = 0; i < Math.min(2, queryResponse.matches.length); i++) {
                        const match = queryResponse.matches[i];
                        console.log(`   ${i + 1}. Score: ${(match.score * 100).toFixed(1)}%`);
                        console.log(`      ID: ${match.id}`);
                        if (match.metadata && match.metadata.titulo) {
                            console.log(`      Título: ${match.metadata.titulo}`);
                        }
                        if (match.metadata && match.metadata.texto) {
                            const preview = match.metadata.texto.substring(0, 100) + '...';
                            console.log(`      Preview: ${preview}`);
                        }
                    }
                } else {
                    console.log(`❌ [BUSQUEDA] No se encontraron resultados para "${termino}"`);
                }
                
            } catch (error) {
                console.log(`❌ [BUSQUEDA] Error buscando "${termino}": ${error.message}`);
            }
            
            // Pausa entre búsquedas
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // 3. Verificar namespaces específicos
        console.log('\n📁 [NAMESPACES] Verificando namespaces...');
        if (stats.namespaces) {
            for (const [namespace, info] of Object.entries(stats.namespaces)) {
                console.log(`   - ${namespace}: ${info.vectorCount} vectores`);
            }
        }
        
        // 4. Recomendaciones
        console.log('\n💡 [RECOMENDACIONES]');
        const totalVectores = stats.totalVectorCount || 0;
        
        if (totalVectores === 0) {
            console.log('❌ No hay vectores en Pinecone. Necesitas ejecutar el procesamiento inicial.');
            console.log('   Ejecuta: node procesar_conocimiento.js');
        } else if (totalVectores < 100) {
            console.log('⚠️ Pocos vectores en Pinecone. Considera reprocesar el archivo de información.');
        } else {
            console.log('✅ Pinecone tiene suficientes vectores para funcionar correctamente.');
        }
        
    } catch (error) {
        console.error('❌ [ERROR] Error verificando Pinecone:', error.message);
        
        if (error.message.includes('API key')) {
            console.log('💡 Verifica que PINECONE_API_KEY esté configurado en .env');
        } else if (error.message.includes('index')) {
            console.log('💡 Verifica que el índice "memoria-deitana" exista en Pinecone');
        }
    }
}

// Ejecutar verificación
if (require.main === module) {
    verificarPinecone().then(() => {
        console.log('\n🏁 Verificación completada');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Error en verificación:', error);
        process.exit(1);
    });
}

module.exports = { verificarPinecone };
