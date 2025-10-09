const { Pinecone } = require('@pinecone-database/pinecone');

const pinecone = new Pinecone({
    apiKey: 'pcsk_ctXEB_EytPZdg6HJhk2HPbfvEfknyuM671AZUmwz82YSMVgjYfGfR3QfsLMXC8BcRjUvY'
});

const index = pinecone.index('deitana-database');

async function limpiarDatabase() {
    try {
        console.log('🧹 Limpiando índice deitana-database...');
        
        // Eliminar TODOS los vectores del índice
        await index.deleteAll();
        
        console.log('✅ ¡Índice deitana-database limpiado completamente!');
        console.log('📊 Ahora puedes subir secciones específicas con subir_seccion_database.js');
        
    } catch (error) {
        console.error('❌ Error limpiando índice:', error);
        process.exit(1);
    }
}

limpiarDatabase();

