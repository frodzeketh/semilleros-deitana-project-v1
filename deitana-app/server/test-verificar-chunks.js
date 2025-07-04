// =====================================
// TEST: VERIFICAR CONTENIDO DE CHUNKS CARGADOS
// =====================================

require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');

async function verificarChunks() {
    console.log('🔍 [TEST] Verificando contenido de chunks cargados...');
    
    try {
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });
        
        const index = pinecone.Index(process.env.PINECONE_INDEX || 'memoria-deitana');
        
        // Buscar todos los fragmentos de conocimiento empresarial
        const queryResponse = await index.query({
            vector: new Array(1536).fill(0.1), // Vector dummy
            filter: {
                tipo: { $eq: 'conocimiento_empresa' }
            },
            topK: 20,
            includeMetadata: true
        });
        
        console.log(`📊 [TEST] Fragmentos de conocimiento empresarial encontrados: ${queryResponse.matches.length}`);
        
        // Verificar el contenido de cada fragmento
        queryResponse.matches.forEach((match, index) => {
            const contenido = match.metadata.texto || '';
            console.log(`\n📄 [TEST] Fragmento ${index + 1}: ${match.id}`);
            console.log(`   Score: ${match.score}`);
            console.log(`   Contenido (primeros 200 caracteres):`);
            console.log(`   "${contenido.substring(0, 200)}..."`);
            
            // Verificar si contiene palabras clave
            const palabrasClave = ['tarifa', 'precio', 'costo', 'sección', 'denominación'];
            const contiene = palabrasClave.filter(palabra => contenido.toLowerCase().includes(palabra));
            if (contiene.length > 0) {
                console.log(`   ✅ Contiene: ${contiene.join(', ')}`);
            } else {
                console.log(`   ❌ No contiene palabras clave`);
            }
        });
        
        // Buscar específicamente fragmentos que contengan "tarifa"
        console.log('\n🔍 [TEST] === BUSCANDO FRAGMENTOS CON "TARIFA" ===');
        
        const queryResponseTarifas = await index.query({
            vector: new Array(1536).fill(0.1), // Vector dummy
            topK: 50,
            includeMetadata: true
        });
        
        let fragmentosConTarifa = [];
        queryResponseTarifas.matches.forEach(match => {
            const contenido = match.metadata.texto || '';
            if (contenido.toLowerCase().includes('tarifa')) {
                fragmentosConTarifa.push({
                    id: match.id,
                    tipo: match.metadata.tipo || 'sin_tipo',
                    score: match.score,
                    contenido: contenido.substring(0, 100) + '...'
                });
            }
        });
        
        console.log(`📊 [TEST] Fragmentos que contienen "tarifa": ${fragmentosConTarifa.length}`);
        fragmentosConTarifa.forEach((frag, index) => {
            console.log(`   ${index + 1}. ${frag.id} (tipo: ${frag.tipo}, score: ${frag.score})`);
            console.log(`      "${frag.contenido}"`);
        });
        
    } catch (error) {
        console.error('❌ [TEST] Error verificando chunks:', error);
    }
}

// Ejecutar verificación
verificarChunks().then(() => {
    console.log('\n✅ [TEST] Verificación completada');
}).catch(error => {
    console.error('❌ [TEST] Error en la verificación:', error);
}); 