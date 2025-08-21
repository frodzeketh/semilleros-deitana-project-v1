// =====================================
// CARGAR ARCHIVO .TXT EN PINECONE
// =====================================

const ragNuevo = require('./rag_nuevo');

async function cargarPinecone() {
    console.log('🚀 [CARGA] Iniciando carga del archivo .txt en Pinecone...\n');
    
    try {
        // Verificar estado actual
        console.log('📊 [CARGA] Estado actual del índice:');
        await ragNuevo.verificarIndice();
        
        // Limpiar e indexar automáticamente
        console.log('\n🔄 [CARGA] Limpiando e indexando archivo...');
        const chunksIndexados = await ragNuevo.indexarArchivoCompleto();
        
        console.log(`\n✅ [CARGA] ¡COMPLETADO! Se indexaron ${chunksIndexados} chunks`);
        
        // Verificar estado final
        console.log('\n📊 [CARGA] Estado final del índice:');
        await ragNuevo.verificarIndice();
        
        console.log('\n🎉 [CARGA] Pinecone cargado exitosamente con el archivo .txt');
        
    } catch (error) {
        console.error('❌ [CARGA] Error:', error.message);
        throw error;
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    cargarPinecone().then(() => {
        console.log('\n✅ Carga completada');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Error en carga:', error);
        process.exit(1);
    });
}

module.exports = { cargarPinecone };
