const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

// Configuración
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || 'pcsk_ctXEB_EytPZdg6HJhk2HPbfvEfknyuM671AZUmwz82YSMVgjYfGfR3QfsLMXC8BcRjUvY';
const INDEX_NAME = 'deitana-knowledge';
const RAG_FILE_PATH = path.join(__dirname, 'rag.txt');

// Validar configuración
if (!OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY no encontrada');
    process.exit(1);
}

console.log('✅ Configuración cargada (MODO INTELIGENTE)');
console.log(`   📁 Archivo RAG: ${RAG_FILE_PATH}`);
console.log(`   🧠 Modo: Chunking Inteligente con Metadata Enriquecida\n`);

// Inicializar clientes
const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

class PineconeLoaderInteligente {
    constructor() {
        this.index = pinecone.index(INDEX_NAME);
        this.batchSize = 50; // Reducido para procesar metadata
        this.chunkSize = 1500; // AUMENTADO: Chunks mucho más grandes para mejor contexto
        this.overlap = 300; // AUMENTADO: Más overlap para mantener continuidad
        
        // Patrones para detectar conceptos importantes
        this.patterns = {
            familia: /familia\s+([a-záéíóúñ]+)/gi,
            articulo: /artículo[s]?\s+([a-záéíóúñ\s]+)/gi,
            formaPago: /forma[s]?\s+de\s+pago/gi,
            cliente: /cliente[s]?\s+([a-záéíóúñ\s]+)/gi,
            proveedor: /proveedor[es]?\s+([a-záéíóúñ\s]+)/gi,
            tarifa: /tarifa[s]?|rango\s+de\s+tarifa/gi,
            precio: /precio[s]?/gi,
            vencimiento: /vencimiento[s]?/gi
        };
    }

    // Función para extraer metadata inteligente del texto
    extractMetadata(text, chunkId) {
        const metadata = {
            chunk_id: chunkId,
            length: text.length,
            source: 'rag.txt',
            text: text.trim(),
            // Campos adicionales para búsqueda inteligente (como arrays de strings)
            conceptos: [],
            relaciones: []
        };

        // Detectar conceptos principales
        for (const [concepto, pattern] of Object.entries(this.patterns)) {
            const matches = text.match(pattern);
            if (matches && matches.length > 0) {
                metadata.conceptos.push(concepto);
                
                // Extraer entidades específicas como arrays de strings
                if (concepto === 'familia') {
                    const familias = [];
                    let match;
                    const regex = new RegExp(pattern);
                    while ((match = regex.exec(text)) !== null) {
                        familias.push(match[1].toLowerCase().trim());
                    }
                    if (familias.length > 0) {
                        // Guardar como array directo en metadata (Pinecone acepta arrays de strings)
                        metadata.familias = familias;
                    }
                }
            }
        }

        // Detectar si habla de formas de pago
        if (text.toLowerCase().includes('forma de pago') || 
            text.toLowerCase().includes('formas de pago')) {
            metadata.tipo_info = 'formas_pago';
            
            // Detectar relaciones con clientes/proveedores/facturas
            if (text.toLowerCase().includes('cliente')) {
                metadata.relaciones.push('formas_pago_clientes');
            }
            if (text.toLowerCase().includes('proveedor')) {
                metadata.relaciones.push('formas_pago_proveedores');
            }
            if (text.toLowerCase().includes('factura')) {
                metadata.relaciones.push('formas_pago_facturas');
            }
        }

        // Detectar información de familias y tarifas
        if (text.toLowerCase().includes('rango de tarifa')) {
            metadata.tiene_tarifa = true;
            
            // Si menciona una familia específica
            const familiaMatch = text.match(/familia\s+([a-záéíóúñ]+)/i);
            if (familiaMatch) {
                metadata.familia_con_tarifa = familiaMatch[1].toLowerCase();
            }
        }

        // Detectar secciones importantes
        if (text.includes('SECCIÓN:')) {
            const seccionMatch = text.match(/SECCIÓN:\s*([^\n]+)/);
            if (seccionMatch) {
                metadata.seccion = seccionMatch[1].trim();
            }
        }

        if (text.includes('DESCRIPCIÓN GENERAL:')) {
            metadata.es_descripcion_general = true;
        }

        return metadata;
    }

    // Crear chunks inteligentes con contexto
    createIntelligentChunks(text) {
        const chunks = [];
        const lines = text.split('\n');
        let currentChunk = '';
        let chunkId = 0;
        let currentSection = '';
        let currentContext = {
            familia: null,
            categoria: null,
            seccion: null
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (!line) continue;

            // Detectar cambios de sección para mantener contexto
            if (line.includes('SECCIÓN:')) {
                currentContext.seccion = line;
            }

            // Detectar mención de familia para contexto
            const familiaMatch = line.match(/familia\s+([a-záéíóúñ]+)/i);
            if (familiaMatch) {
                currentContext.familia = familiaMatch[1].toLowerCase();
            }

            // Si agregar esta línea excede el tamaño
            if (currentChunk.length + line.length > this.chunkSize && currentChunk.length > 0) {
                // Crear metadata enriquecida
                const metadata = this.extractMetadata(currentChunk, chunkId);
                
                // Agregar contexto heredado
                if (currentContext.familia) {
                    if (!metadata.familias) {
                        metadata.familias = [];
                    }
                    if (!metadata.familias.includes(currentContext.familia)) {
                        metadata.familias.push(currentContext.familia);
                    }
                }
                if (currentContext.seccion) {
                    metadata.seccion_contexto = currentContext.seccion;
                }

                chunks.push({
                    id: `chunk_${chunkId}`,
                    text: currentChunk.trim(),
                    metadata: metadata
                });
                chunkId++;

                // Crear nuevo chunk con solapamiento
                const words = currentChunk.split(' ');
                const overlapWords = words.slice(-Math.floor(this.overlap / 10));
                currentChunk = overlapWords.join(' ') + ' ' + line;
            } else {
                currentChunk += (currentChunk ? ' ' : '') + line;
            }

            // Forzar nuevo chunk en secciones importantes
            if (line.includes('==============================') || 
                line.includes('SECCIÓN:') ||
                line.includes('DESCRIPCIÓN GENERAL:')) {
                if (currentChunk.length > 100) {
                    const metadata = this.extractMetadata(currentChunk, chunkId);
                    
                    chunks.push({
                        id: `chunk_${chunkId}`,
                        text: currentChunk.trim(),
                        metadata: metadata
                    });
                    chunkId++;
                    currentChunk = line;
                }
            }
        }

        // Agregar el último chunk
        if (currentChunk.trim()) {
            const metadata = this.extractMetadata(currentChunk, chunkId);
            chunks.push({
                id: `chunk_${chunkId}`,
                text: currentChunk.trim(),
                metadata: metadata
            });
        }

        return chunks;
    }

    // Crear embeddings mejorados
    async createEmbeddings(chunks) {
        try {
            const texts = chunks.map(chunk => {
                // Enriquecer el texto para embedding con metadata clave
                let enrichedText = chunk.text;
                
                const metadata = chunk.metadata;
                
                // Agregar conceptos detectados al texto para mejor embedding
                if (metadata.conceptos && metadata.conceptos.length > 0) {
                    enrichedText = `[Conceptos: ${metadata.conceptos.join(', ')}] ${enrichedText}`;
                }
                
                // Agregar familias detectadas
                if (metadata.familias && metadata.familias.length > 0) {
                    enrichedText = `[Familias: ${metadata.familias.join(', ')}] ${enrichedText}`;
                }

                return enrichedText;
            });
            
            const response = await openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: texts,
                dimensions: 512
            });

            return response.data.map((embedding, index) => ({
                id: chunks[index].id,
                values: embedding.embedding,
                metadata: {
                    ...chunks[index].metadata,
                    text: chunks[index].text  // ✅ AGREGAR EL TEXTO A LOS METADATOS
                }
            }));
        } catch (error) {
            console.error('❌ Error creando embeddings:', error);
            throw error;
        }
    }

    async uploadBatch(vectors) {
        try {
            await this.index.upsert(vectors);
            console.log(`✅ Lote de ${vectors.length} vectores cargado con metadata enriquecida`);
        } catch (error) {
            console.error('❌ Error cargando lote:', error);
            throw error;
        }
    }

    async loadRAGFile() {
        try {
            console.log('🚀 Iniciando carga INTELIGENTE en Pinecone...\n');
            
            // Limpiar índice (si no está vacío)
            console.log('🧹 Limpiando índice existente...');
            try {
                await this.index.deleteAll();
                console.log('✅ Índice limpiado\n');
            } catch (error) {
                if (error.message.includes('404') || error.name === 'PineconeNotFoundError') {
                    console.log('ℹ️ Índice ya estaba vacío, continuando...\n');
                } else {
                    throw error;
                }
            }

            // Leer archivo
            if (!fs.existsSync(RAG_FILE_PATH)) {
                throw new Error(`Archivo no encontrado: ${RAG_FILE_PATH}`);
            }

            const fileContent = fs.readFileSync(RAG_FILE_PATH, 'utf-8');
            console.log(`📊 Tamaño del archivo: ${fileContent.length.toLocaleString()} caracteres`);

            // Crear chunks inteligentes
            console.log('🧠 Creando chunks INTELIGENTES con metadata enriquecida...');
            const chunks = this.createIntelligentChunks(fileContent);
            console.log(`📦 Total de chunks creados: ${chunks.length}`);
            
            // Mostrar ejemplos de metadata
            console.log('\n🔍 Ejemplo de metadata enriquecida:');
            const ejemploChunk = chunks.find(c => c.metadata.conceptos.length > 0) || chunks[0];
            console.log(JSON.stringify(ejemploChunk.metadata, null, 2));
            console.log('');

            // Procesar en lotes
            console.log('🔄 Procesando en lotes...\n');
            let totalProcessed = 0;

            for (let i = 0; i < chunks.length; i += this.batchSize) {
                const batch = chunks.slice(i, i + this.batchSize);
                console.log(`📦 Procesando lote ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(chunks.length / this.batchSize)}`);
                console.log(`   Chunks ${i + 1} a ${Math.min(i + this.batchSize, chunks.length)}`);

                // Crear embeddings enriquecidos
                const vectors = await this.createEmbeddings(batch);

                // Cargar a Pinecone
                await this.uploadBatch(vectors);

                totalProcessed += batch.length;
                console.log(`✅ Progreso: ${totalProcessed}/${chunks.length} chunks (${Math.round((totalProcessed / chunks.length) * 100)}%)\n`);

                // Pausa para no sobrecargar
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            console.log('🎉 ¡Carga INTELIGENTE completada!\n');
            console.log('📊 Estadísticas finales:');
            console.log(`   - Total chunks: ${chunks.length}`);
            console.log(`   - Total caracteres: ${fileContent.length.toLocaleString()}`);
            console.log(`   - Promedio por chunk: ${Math.round(fileContent.length / chunks.length)} caracteres`);
            console.log(`   - Índice: ${INDEX_NAME}`);
            console.log(`   - Metadata enriquecida: ✓`);
            console.log(`   - Relaciones detectadas: ✓`);

            // Verificar
            console.log('\n🔍 Verificando índice...');
            const stats = await this.index.describeIndexStats();
            console.log(`📈 Vectores en el índice: ${stats.totalVectorCount}\n`);

        } catch (error) {
            console.error('❌ Error en la carga:', error);
            throw error;
        }
    }
}

// Ejecutar
if (require.main === module) {
    const loader = new PineconeLoaderInteligente();
    
    async function main() {
        try {
            await loader.loadRAGFile();
            console.log('✅ Proceso completado exitosamente');
        } catch (error) {
            console.error('💥 Error fatal:', error);
            process.exit(1);
        }
    }

    main();
}

module.exports = PineconeLoaderInteligente;

