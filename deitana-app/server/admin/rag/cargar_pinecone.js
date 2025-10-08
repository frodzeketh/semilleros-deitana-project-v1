const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

// Configuración

// Leer API key desde .env (ubicado en server/.env)
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || 'pcsk_ctXEB_EytPZdg6HJhk2HPbfvEfknyuM671AZUmwz82YSMVgjYfGfR3QfsLMXC8BcRjUvY';
const INDEX_NAME = 'deitana-knowledge';
const RAG_FILE_PATH = path.join(__dirname, 'rag.txt');

// Validar configuración
if (!OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY no encontrada');
    console.error('📁 Ruta del .env:', path.join(__dirname, '../../.env'));
    console.error('💡 Asegúrate de que el archivo server/.env existe y contiene OPENAI_API_KEY');
    process.exit(1);
}

console.log('✅ Configuración cargada:');
console.log(`   📁 Archivo RAG: ${RAG_FILE_PATH}`);
console.log(`   🔑 OpenAI API Key: ${OPENAI_API_KEY ? '✓ Configurada' : '✗ No encontrada'}`);
console.log(`   🔑 Pinecone API Key: ${PINECONE_API_KEY ? '✓ Configurada' : '✗ No encontrada'}`);
console.log(`   📊 Índice Pinecone: ${INDEX_NAME}\n`);

// Inicializar clientes
const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

class PineconeLoader {
    constructor() {
        this.index = pinecone.index(INDEX_NAME);
        this.batchSize = 100; // Procesar en lotes para eficiencias
        this.chunkSize = 500; // Chunks más pequeños para capturar información específica
        this.overlap = 100; // Menos solapamiento
    }

    // Función para dividir texto en chunks inteligentes
    createChunks(text) {
        const chunks = [];
        const lines = text.split('\n');
        let currentChunk = '';
        let chunkId = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Si la línea está vacía, continuar
            if (!line) continue;

            // Si agregar esta línea excede el tamaño del chunk
            if (currentChunk.length + line.length > this.chunkSize && currentChunk.length > 0) {
                // Guardar el chunk actual
                chunks.push({
                    id: `chunk_${chunkId}`,
                    text: currentChunk.trim(),
                    metadata: {
                        chunk_id: chunkId,
                        length: currentChunk.length,
                        source: 'rag.txt',
                        text: currentChunk.trim()  // ¡AGREGAR EL TEXTO A LOS METADATOS!
                    }
                });
                chunkId++;

                // Crear nuevo chunk con solapamiento
                const words = currentChunk.split(' ');
                const overlapWords = words.slice(-Math.floor(this.overlap / 10)); // Aproximadamente 200 chars
                currentChunk = overlapWords.join(' ') + ' ' + line;
            } else {
                currentChunk += (currentChunk ? ' ' : '') + line;
            }

            // Si es una sección importante, forzar nuevo chunk
            if (line.includes('SECCIÓN:') || line.includes('DESCRIPCIÓN GENERAL:') || line.includes('==============================')) {
                if (currentChunk.length > 100) {
                    chunks.push({
                        id: `chunk_${chunkId}`,
                        text: currentChunk.trim(),
                        metadata: {
                            chunk_id: chunkId,
                            length: currentChunk.length,
                            source: 'rag.txt',
                            section: line,
                            text: currentChunk.trim()  // ¡AGREGAR EL TEXTO A LOS METADATOS!
                        }
                    });
                    chunkId++;
                    currentChunk = line;
                }
            }
        }

        // Agregar el último chunk
        if (currentChunk.trim()) {
            chunks.push({
                id: `chunk_${chunkId}`,
                text: currentChunk.trim(),
                metadata: {
                    chunk_id: chunkId,
                    length: currentChunk.length,
                    source: 'rag.txt',
                    text: currentChunk.trim()  // ¡AGREGAR EL TEXTO A LOS METADATOS!
                }
            });
        }

        return chunks;
    }

    // Crear embeddings para un lote de chunks
    async createEmbeddings(chunks) {
        try {
            const texts = chunks.map(chunk => chunk.text);
            
            const response = await openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: texts,
                dimensions: 512
            });

            return response.data.map((embedding, index) => ({
                id: chunks[index].id,
                values: embedding.embedding,
                metadata: chunks[index].metadata
            }));
        } catch (error) {
            console.error('Error creando embeddings:', error);
            throw error;
        }
    }

    // Cargar un lote a Pinecone
    async uploadBatch(vectors) {
        try {
            await this.index.upsert(vectors);
            console.log(`✅ Lote de ${vectors.length} vectores cargado exitosamente`);
        } catch (error) {
            console.error('Error cargando lote:', error);
            throw error;
        }
    }

    // Función principal para cargar todo
    async loadRAGFile() {
        try {
            console.log('🚀 Iniciando carga de base de conocimiento en Pinecone...');
            console.log(`📁 Archivo: ${RAG_FILE_PATH}`);
            
            // Limpiar índice antes de cargar
            console.log('🧹 Limpiando índice existente...');
            await this.index.deleteAll();
            console.log('✅ Índice limpiado');

            // Leer el archivo
            if (!fs.existsSync(RAG_FILE_PATH)) {
                throw new Error(`Archivo no encontrado: ${RAG_FILE_PATH}`);
            }

            const fileContent = fs.readFileSync(RAG_FILE_PATH, 'utf-8');
            console.log(`📊 Tamaño del archivo: ${fileContent.length.toLocaleString()} caracteres`);

            // Crear chunks
            console.log('✂️ Creando chunks inteligentes...');
            const chunks = this.createChunks(fileContent);
            console.log(`📦 Total de chunks creados: ${chunks.length}`);

            // Procesar en lotes
            console.log('🔄 Procesando en lotes...');
            let totalProcessed = 0;

            for (let i = 0; i < chunks.length; i += this.batchSize) {
                const batch = chunks.slice(i, i + this.batchSize);
                console.log(`\n📦 Procesando lote ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(chunks.length / this.batchSize)}`);
                console.log(`   Chunks ${i + 1} a ${Math.min(i + this.batchSize, chunks.length)}`);

                // Crear embeddings
                console.log('🧠 Creando embeddings...');
                const vectors = await this.createEmbeddings(batch);

                // Cargar a Pinecone
                console.log('⬆️ Subiendo a Pinecone...');
                await this.uploadBatch(vectors);

                totalProcessed += batch.length;
                console.log(`✅ Progreso: ${totalProcessed}/${chunks.length} chunks procesados (${Math.round((totalProcessed / chunks.length) * 100)}%)`);

                // Pequeña pausa para no sobrecargar la API
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            console.log('\n🎉 ¡Carga completada exitosamente!');
            console.log(`📊 Estadísticas finales:`);
            console.log(`   - Total de chunks: ${chunks.length}`);
            console.log(`   - Total de caracteres: ${fileContent.length.toLocaleString()}`);
            console.log(`   - Promedio por chunk: ${Math.round(fileContent.length / chunks.length)} caracteres`);
            console.log(`   - Índice: ${INDEX_NAME}`);

            // Verificar el índice
            console.log('\n🔍 Verificando índice...');
            const stats = await this.index.describeIndexStats();
            console.log(`📈 Vectores en el índice: ${stats.totalVectorCount}`);

        } catch (error) {
            console.error('❌ Error en la carga:', error);
            throw error;
        }
    }

    // Función para limpiar el índice (opcional)
    async clearIndex() {
        try {
            console.log('🧹 Limpiando índice...');
            await this.index.deleteAll();
            console.log('✅ Índice limpiado');
        } catch (error) {
            console.error('❌ Error limpiando índice:', error);
        }
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    const loader = new PineconeLoader();
    
    async function main() {
        try {
            // Opcional: limpiar índice antes de cargar
            // await loader.clearIndex();
            
            await loader.loadRAGFile();
        } catch (error) {
            console.error('💥 Error fatal:', error);
            process.exit(1);
        }
    }

    main();
}

module.exports = PineconeLoader;
