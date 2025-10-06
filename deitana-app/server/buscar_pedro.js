const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAI } = require('openai');
require('dotenv').config();

const pinecone = new Pinecone({
    apiKey: 'pcsk_ctXEB_EytPZdg6HJhk2HPbfvEfknyuM671AZUmwz82YSMVgjYfGfR3QfsLMXC8BcRjUvY'
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const index = pinecone.index('deitana-knowledge');

async function buscarPedro() {
    try {
        console.log('🔍 Buscando información específica sobre Pedro Muñoz...');
        
        // Buscar con el texto exacto
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: 'Pedro Muñoz será responsable de que todos los encargos salgan ya con esta fórmula aplicada',
            dimensions: 512
        });
        
        const queryEmbedding = embeddingResponse.data[0].embedding;
        
        const searchResponse = await index.query({
            vector: queryEmbedding,
            topK: 50,  // Buscar muchos resultados
            includeMetadata: true
        });
        
        console.log(`📊 Encontrados ${searchResponse.matches.length} resultados:`);
        
        let encontrado = false;
        searchResponse.matches.forEach((match, index) => {
            const text = match.metadata?.text || '';
            if (text.includes('Pedro Muñoz será responsable')) {
                console.log(`\n🎯 ¡ENCONTRADO! Resultado ${index + 1}:`);
                console.log(`Score: ${match.score}`);
                console.log(`ID: ${match.id}`);
                console.log(`Texto completo: ${text}`);
                encontrado = true;
            }
        });
        
        if (!encontrado) {
            console.log('\n❌ NO SE ENCONTRÓ la información específica sobre Pedro Muñoz');
            console.log('📋 Mostrando los primeros 10 resultados:');
            
            searchResponse.matches.slice(0, 10).forEach((match, index) => {
                console.log(`\n--- Resultado ${index + 1} ---`);
                console.log(`Score: ${match.score.toFixed(3)}`);
                console.log(`Texto: ${match.metadata?.text?.substring(0, 200)}...`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

buscarPedro();
