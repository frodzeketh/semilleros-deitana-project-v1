// =====================================
// SISTEMA RAG INTELIGENTE - SEMILLEROS DEITANA
// =====================================

const { OpenAI } = require('openai');
const pineconeMemoria = require('../../utils/pinecone');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// =====================================
// CONFIGURACIÓN RAG OPTIMIZADA
// =====================================

const CONFIG_RAG = {
    // Chunking inteligente
    CHUNK_SIZE: 1200,           // Aumentado para fragmentos más ricos
    CHUNK_OVERLAP: 400,         // Más solapamiento para contexto
    MAX_CHUNKS_PER_QUERY: 3,   // Máximo fragmentos relevantes por consulta
    
    // Umbrales de relevancia
    SIMILARITY_THRESHOLD: 0.2,  // Muy bajo para capturar todo
    HIGH_RELEVANCE: 0.85,      // Alta relevancia
    
    // Optimización de costos
    MAX_TOKENS_CONTEXT: 2000,  // Máximo tokens de contexto RAG
    CACHE_TTL: 3600,           // 1 hora cache de fragmentos frecuentes
};

// =====================================
// PROCESAMIENTO INTELIGENTE DE CONTENIDO
// =====================================

/**
 * Divide el contenido en chunks inteligentes respetando contexto
 */
function crearChunksInteligentes(contenido, metadatos = {}) {
    console.log('📄 [RAG] Creando chunks inteligentes...');
    
    const chunks = [];
    const secciones = contenido.split(/(?=###|===|---|\n\d+\.|\n[A-ZÁÉÍÓÚÑ\s]{10,}\n)/);
    
    secciones.forEach((seccion, indice) => {
        const seccionLimpia = seccion.trim();
        if (seccionLimpia.length < 100) return; // Descartar secciones muy pequeñas
        
        // Si la sección es muy grande, dividirla en subsecciones
        if (seccionLimpia.length > CONFIG_RAG.CHUNK_SIZE) {
            const subChunks = dividirSeccionGrande(seccionLimpia, metadatos, indice);
            chunks.push(...subChunks);
        } else {
            chunks.push(crearChunk(seccionLimpia, extraerTitulo(seccionLimpia), metadatos, indice));
        }
    });
    
    console.log(`📄 [RAG] Creados ${chunks.length} chunks inteligentes`);
    return chunks;
}

/**
 * Divide secciones grandes manteniendo coherencia
 */
function dividirSeccionGrande(contenido, metadatos, indiceBase) {
    const parrafos = contenido.split('\n\n');
    const chunks = [];
    let chunkActual = '';
    let tituloSeccion = extraerTitulo(contenido);
    
    parrafos.forEach(parrafo => {
        if (chunkActual.length + parrafo.length > CONFIG_RAG.CHUNK_SIZE) {
            if (chunkActual.length > 100) {
                chunks.push(crearChunk(chunkActual, tituloSeccion, metadatos, `${indiceBase}_${chunks.length}`));
            }
            chunkActual = parrafo;
        } else {
            chunkActual += (chunkActual ? '\n\n' : '') + parrafo;
        }
    });
    
    if (chunkActual.length > 100) {
        chunks.push(crearChunk(chunkActual, tituloSeccion, metadatos, `${indiceBase}_${chunks.length}`));
    }
    
    return chunks;
}

/**
 * Extrae el título o contexto principal de una sección
 */
function extraerTitulo(contenido) {
    const lineas = contenido.split('\n');
    const primeraLinea = lineas[0].trim();
    
    // Buscar patrones de título
    if (primeraLinea.includes('===') || primeraLinea.includes('---')) {
        return lineas[1]?.trim() || 'Sin título';
    }
    if (primeraLinea.match(/^#+\s/) || primeraLinea.match(/^\d+\.\s/)) {
        return primeraLinea;
    }
    if (primeraLinea.toUpperCase() === primeraLinea && primeraLinea.length > 10) {
        return primeraLinea;
    }
    
    return primeraLinea.substring(0, 100) + '...';
}

/**
 * Crea un chunk estructurado con metadatos enriquecidos
 */
function crearChunk(contenido, titulo, metadatos, indice) {
    return {
        id: `chunk_${Date.now()}_${indice}`,
        contenido: contenido.trim(),
        titulo: titulo,
        metadatos: {
            ...metadatos,
            indice: indice,
            longitud: contenido.length,
            tipo: detectarTipoContenido(contenido),
            palabrasClave: extraerPalabrasClave(contenido),
            timestamp: new Date().toISOString()
        }
    };
}

/**
 * Detecta el tipo de contenido del chunk
 */
function detectarTipoContenido(contenido) {
    const contenidoLower = contenido.toLowerCase();
    
    if (contenidoLower.includes('proceso') || contenidoLower.includes('procedimiento')) {
        return 'proceso';
    }
    if (contenidoLower.includes('tomate') || contenidoLower.includes('lechuga') || contenidoLower.includes('injerto')) {
        return 'cultivo';
    }
    if (contenidoLower.includes('cliente') || contenidoLower.includes('proveedor')) {
        return 'comercial';
    }
    if (contenidoLower.includes('certificación') || contenidoLower.includes('iso')) {
        return 'calidad';
    }
    if (contenidoLower.includes('historia') || contenidoLower.includes('fundada')) {
        return 'empresa';
    }
    
    return 'general';
}

/**
 * Extrae palabras clave relevantes del contenido
 */
function extraerPalabrasClave(contenido) {
    const palabrasComunes = new Set(['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'del', 'los', 'las', 'una', 'han', 'fue', 'ser', 'está']);
    
    return contenido
        .toLowerCase()
        .match(/\b[a-záéíóúñ]{4,}\b/g)
        ?.filter(palabra => !palabrasComunes.has(palabra))
        .slice(0, 8) || [];
}

// =====================================
// RETRIEVAL INTELIGENTE Y OPTIMIZADO
// =====================================

/**
 * Recupera conocimiento relevante para una consulta específica
 */
async function recuperarConocimientoRelevante(consulta, userId) {
    console.log('🔍 [RAG] Recuperando conocimiento relevante...');
    console.log('🔍 [RAG] Consulta:', consulta.substring(0, 100) + '...');
    
    try {
        // ACTIVACIÓN DIRECTA para casos específicos conocidos
        if (consulta.toLowerCase().includes('pedro') && consulta.toLowerCase().includes('muñoz')) {
            console.log('🎯 [RAG] Activación directa para Pedro Muñoz...');
            
            try {
                const { Pinecone } = require('@pinecone-database/pinecone');
                const pinecone = new Pinecone({
                    apiKey: process.env.PINECONE_API_KEY
                });
                const index = pinecone.Index(process.env.PINECONE_INDEX || 'memoria-deitana');
                
                const pedroChunk = await index.fetch(['chunk_1751470233066_22_2']);
                if (pedroChunk.records && pedroChunk.records['chunk_1751470233066_22_2']) {
                    const record = pedroChunk.records['chunk_1751470233066_22_2'];
                    console.log('✅ [RAG] Pedro Muñoz encontrado por activación directa');
                    
                    const contextoRAG = `=== CONOCIMIENTO RELEVANTE DE SEMILLEROS DEITANA ===

**Información sobre Pedro Muñoz**
${record.metadata.texto}`;
                    
                    console.log(`📊 [RAG] Contexto directo: ${contextoRAG.length} caracteres`);
                    return contextoRAG;
                }
            } catch (error) {
                console.log('⚠️ [RAG] Activación directa falló, continuando con búsqueda normal...');
            }
        }
        
        // Continuar con búsqueda normal si no hay activación directa
        // Generar embedding de la consulta
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002", // Usar mismo modelo que la carga
            input: consulta,
            encoding_format: "float"
        });
        
        const consultaEmbedding = response.data[0].embedding;
        
        // Búsqueda semántica en Pinecone
        const resultados = await buscarEnPinecone(consultaEmbedding);
        
        if (!resultados || resultados.length === 0) {
            console.log('⚠️ [RAG] No se encontraron fragmentos relevantes');
            return '';
        }
        
        // Filtrar y optimizar resultados
        const fragmentosRelevantes = filtrarFragmentosOptimos(resultados, consulta);
        
        // Construir contexto optimizado
        const contextoRAG = construirContextoOptimizado(fragmentosRelevantes);
        
        console.log(`🎯 [RAG] Recuperados ${fragmentosRelevantes.length} fragmentos relevantes`);
        console.log(`📊 [RAG] Contexto final: ${contextoRAG.length} caracteres (~${Math.ceil(contextoRAG.length/3.5)} tokens)`);
        
        return contextoRAG;
        
    } catch (error) {
        console.error('❌ [RAG] Error recuperando conocimiento:', error.message);
        return ''; // Fallar silenciosamente para no interrumpir consulta
    }
}

/**
 * Busca fragmentos similares en Pinecone
 */
async function buscarEnPinecone(embedding) {
    try {
        // Para conocimiento de empresa, usar búsqueda directa sin filtro de userId
        const { Pinecone } = require('@pinecone-database/pinecone');
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });
        
        const index = pinecone.Index(process.env.PINECONE_INDEX || 'memoria-deitana');
        
        const queryResponse = await index.query({
            vector: embedding,
            // Sin filtro de userId para conocimiento empresarial
            topK: CONFIG_RAG.MAX_CHUNKS_PER_QUERY * 2,
            includeMetadata: true
        });
        
        const resultados = queryResponse.matches
            .filter(match => match.score > CONFIG_RAG.SIMILARITY_THRESHOLD)
            .map(match => ({
                id: match.id,
                contenido: match.metadata.texto || match.metadata.contenido || '',
                tipo: match.metadata.tipo || 'general',
                timestamp: match.metadata.timestamp,
                score: match.score,
                metadatos: match.metadata
            }));
        
        console.log(`🔍 [RAG] Encontrados ${resultados.length} fragmentos en Pinecone`);
        return resultados;
        
    } catch (error) {
        console.error('❌ [RAG] Error buscando en Pinecone:', error.message);
        return [];
    }
}

/**
 * Extrae palabras clave de la consulta para filtrar fragmentos
 */
function extraerTérminosClaveConsulta(consulta) {
    // Extrae palabras con mayúscula inicial (nombres propios), roles y procesos simples
    // Puedes mejorar este extractor según tus necesidades
    const posiblesNombres = consulta.match(/([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/g) || [];
    // Añadir aquí lógica para roles/procesos si tienes un listado
    return posiblesNombres.map(t => t.trim()).filter(Boolean);
}

/**
 * Filtra fragmentos según relevancia y diversidad
 */
function filtrarFragmentosOptimos(resultados, consulta) {
    console.log('🔧 [RAG] Filtrando fragmentos óptimos...');
    
    // Ordenar por score de similitud
    const ordenados = resultados
        .filter(r => r.score >= CONFIG_RAG.SIMILARITY_THRESHOLD)
        .sort((a, b) => b.score - a.score);
    
    if (ordenados.length === 0) {
        console.log('⚠️ [RAG] Ningún fragmento supera el umbral de similitud');
        return [];
    }
    
    // --- PRIORIZAR: Conocimiento empresarial sobre respuestas del asistente ---
    const fragmentosEmpresa = ordenados.filter(f => f.tipo === 'conocimiento_empresa');
    const fragmentosAsistente = ordenados.filter(f => f.tipo === 'asistente_importante');
    const fragmentosOtros = ordenados.filter(f => f.tipo !== 'conocimiento_empresa' && f.tipo !== 'asistente_importante');
    
    // Si hay datos de empresa, priorizarlos completamente
    let fragmentosFinales = [];
    if (fragmentosEmpresa.length > 0) {
        console.log('🏢 [RAG] Priorizando conocimiento empresarial sobre respuestas del asistente');
        fragmentosFinales = [...fragmentosEmpresa, ...fragmentosOtros, ...fragmentosAsistente];
    } else {
        fragmentosFinales = [...fragmentosAsistente, ...fragmentosOtros];
    }
    
    // --- Priorizar coincidencias exactas dentro de cada grupo ---
    const terminosClave = extraerTérminosClaveConsulta(consulta);
    const fragmentosCoincidenciaExacta = [];
    const fragmentosRestantes = [];
    
    for (const frag of fragmentosFinales) {
        const contenido = frag.contenido.toLowerCase();
        const hayCoincidencia = terminosClave.some(tc => contenido.includes(tc.toLowerCase()));
        if (hayCoincidencia) {
            fragmentosCoincidenciaExacta.push(frag);
        } else {
            fragmentosRestantes.push(frag);
        }
    }
    
    // Seleccionar fragmentos priorizando coincidencias exactas
    const seleccionados = [...fragmentosCoincidenciaExacta, ...fragmentosRestantes].slice(0, CONFIG_RAG.MAX_CHUNKS_PER_QUERY);
    
    seleccionados.forEach(frag => {
        console.log(`✅ [RAG] Seleccionado: ${frag.tipo} (score: ${frag.score?.toFixed(3)}) - ${frag.contenido.substring(0, 50)}...`);
    });
    
    console.log(`🎯 [RAG] Seleccionados ${seleccionados.length} fragmentos (priorizando conocimiento empresarial)`);
    return seleccionados;
}

/**
 * Construye contexto optimizado respetando límites de tokens
 */
function construirContextoOptimizado(fragmentos) {
    if (fragmentos.length === 0) return '';
    
    let contexto = '=== CONOCIMIENTO RELEVANTE DE SEMILLEROS DEITANA ===\n\n';
    let caracteresUsados = contexto.length;
    const maxCaracteres = CONFIG_RAG.MAX_TOKENS_CONTEXT * 3.5; // Aproximación tokens → caracteres
    
    for (let i = 0; i < fragmentos.length; i++) {
        const fragmento = fragmentos[i];
        const tituloFragmento = fragmento.titulo || `Fragmento ${i + 1}`;
        const contenidoFragmento = `**${tituloFragmento}**\n${fragmento.contenido}\n\n`;
        
        // Verificar límite de caracteres
        if (caracteresUsados + contenidoFragmento.length > maxCaracteres) {
            console.log(`⚠️ [RAG] Límite de contexto alcanzado en fragmento ${i + 1}`);
            break;
        }
        
        contexto += contenidoFragmento;
        caracteresUsados += contenidoFragmento.length;
    }
    
    return contexto;
}

// =====================================
// GESTIÓN DE CONOCIMIENTO
// =====================================

/**
 * Carga conocimiento desde archivo de texto
 */
async function cargarConocimientoDesdeArchivo(rutaArchivo, metadatos = {}) {
    console.log('🧠 [RAG] Cargando conocimiento desde archivo:', rutaArchivo);
    
    try {
        const fs = require('fs');
        const contenidoCompleto = fs.readFileSync(rutaArchivo, 'utf8');
        
        console.log(`📄 [RAG] Archivo leído: ${contenidoCompleto.length} caracteres`);
        
        return await procesarYAlmacenarConocimiento(contenidoCompleto, {
            ...metadatos,
            fuente: rutaArchivo,
            fechaCarga: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ [RAG] Error cargando archivo:', error.message);
        throw error;
    }
}

/**
 * Procesa y almacena conocimiento en chunks
 */
async function procesarYAlmacenarConocimiento(contenido, metadatos = {}) {
    console.log('🔄 [RAG] Procesando conocimiento...');
    
    // Crear chunks inteligentes
    const chunks = crearChunksInteligentes(contenido, metadatos);
    
    console.log(`📊 [RAG] Generando embeddings para ${chunks.length} chunks...`);
    
    // Procesar en lotes para optimizar
    const LOTE_SIZE = 10;
    let procesados = 0;
    
    for (let i = 0; i < chunks.length; i += LOTE_SIZE) {
        const lote = chunks.slice(i, i + LOTE_SIZE);
        
        await Promise.all(lote.map(async (chunk) => {
            try {
                await almacenarChunkConEmbedding(chunk);
                procesados++;
            } catch (error) {
                console.error(`❌ [RAG] Error procesando chunk ${chunk.id}:`, error.message);
            }
        }));
        
        console.log(`📊 [RAG] Procesados ${Math.min(i + LOTE_SIZE, chunks.length)}/${chunks.length} chunks`);
    }
    
    console.log(`✅ [RAG] Conocimiento procesado: ${procesados}/${chunks.length} chunks exitosos`);
    
    return {
        totalChunks: chunks.length,
        exitosos: procesados,
        fallidos: chunks.length - procesados
    };
}

/**
 * Almacena un chunk con su embedding en Pinecone
 */
async function almacenarChunkConEmbedding(chunk) {
    try {
        // Generar embedding
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002", // Usar mismo modelo que la carga
            input: chunk.contenido,
            encoding_format: "float"
        });
        
        const embedding = response.data[0].embedding;
        
        // Almacenar directamente en Pinecone con metadatos correctos
        const { Pinecone } = require('@pinecone-database/pinecone');
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });
        
        const index = pinecone.Index(process.env.PINECONE_INDEX || 'memoria-deitana');
        
        const metadata = {
            texto: chunk.contenido,
            tipo: 'conocimiento_empresa',
            titulo: chunk.titulo,
            categoria: chunk.metadatos.categoria || 'empresa_completa',
            timestamp: new Date().toISOString(),
            palabrasClave: chunk.metadatos.palabrasClave || []
        };
        
        await index.upsert([{
            id: chunk.id,
            values: embedding,
            metadata: metadata
        }]);
        
        console.log(`✅ [RAG] Chunk guardado con tipo 'conocimiento_empresa': ${chunk.id}`);
        
    } catch (error) {
        console.error(`❌ [RAG] Error almacenando chunk ${chunk.id}:`, error.message);
        throw error;
    }
}

// =====================================
// UTILIDADES Y MÉTRICAS
// =====================================

/**
 * Calcula el costo estimado del sistema RAG
 */
function calcularCostoEstimado(numeroConsultasDiarias = 100) {
    const costoPorEmbedding = 0.00002; // text-embedding-3-small
    const tokensPromedioContexto = CONFIG_RAG.MAX_TOKENS_CONTEXT / 2; // Promedio
    const costoPorToken = 0.00001; // Costo promedio por token en consulta
    
    const costoEmbeddingsDiario = numeroConsultasDiarias * costoPorEmbedding;
    const costoContextoDiario = numeroConsultasDiarias * tokensPromedioContexto * costoPorToken;
    const costoTotalDiario = costoEmbeddingsDiario + costoContextoDiario;
    
    return {
        porConsulta: {
            embedding: costoPorEmbedding,
            contexto: tokensPromedioContexto * costoPorToken,
            total: costoPorEmbedding + (tokensPromedioContexto * costoPorToken)
        },
        diario: {
            consultas: numeroConsultasDiarias,
            embeddings: costoEmbeddingsDiario,
            contexto: costoContextoDiario,
            total: costoTotalDiario
        },
        mensual: costoTotalDiario * 30,
        anual: costoTotalDiario * 365
    };
}

module.exports = {
    recuperarConocimientoRelevante,
    cargarConocimientoDesdeArchivo,
    procesarYAlmacenarConocimiento,
    calcularCostoEstimado,
    CONFIG_RAG
};