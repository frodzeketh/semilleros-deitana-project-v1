// =====================================
// SISTEMA RAG INTELIGENTE - SEMILLEROS DEITANA
// =====================================

const { OpenAI } = require('openai');
const pineconeMemoria = require('../utils/pinecone');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// =====================================
// CONFIGURACIÓN RAG
// =====================================

const CONFIG_RAG = {
    // Chunking inteligente
    CHUNK_SIZE: 800,           // Caracteres por fragmento
    CHUNK_OVERLAP: 200,        // Solapamiento entre fragmentos
    MAX_CHUNKS_PER_QUERY: 3,   // Máximo fragmentos relevantes por consulta
    
    // Umbrales de relevancia
    SIMILARITY_THRESHOLD: 0.7,  // Mínima similitud para incluir fragmento
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
    const lineas = contenido.split('\n');
    let chunkActual = '';
    let contextoActual = '';
    
    for (let i = 0; i < lineas.length; i++) {
        const linea = lineas[i].trim();
        
        // Detectar nuevas secciones (títulos, headers)
        const esSeccion = detectarSeccion(linea);
        if (esSeccion) {
            // Guardar chunk anterior si tiene contenido
            if (chunkActual.length > 100) {
                chunks.push(crearChunk(chunkActual, contextoActual, metadatos, chunks.length));
            }
            contextoActual = linea;
            chunkActual = linea + '\n';
        } else {
            chunkActual += linea + '\n';
        }
        
        // Crear chunk si alcanza tamaño máximo
        if (chunkActual.length >= CONFIG_RAG.CHUNK_SIZE) {
            chunks.push(crearChunk(chunkActual, contextoActual, metadatos, chunks.length));
            
            // Mantener solapamiento
            const palabras = chunkActual.split(' ');
            const solapamiento = palabras.slice(-50).join(' '); // Últimas 50 palabras
            chunkActual = contextoActual + '\n' + solapamiento + '\n';
        }
    }
    
    // Último chunk
    if (chunkActual.length > 100) {
        chunks.push(crearChunk(chunkActual, contextoActual, metadatos, chunks.length));
    }
    
    console.log(`📄 [RAG] Creados ${chunks.length} chunks inteligentes`);
    return chunks;
}

/**
 * Detecta si una línea es una sección/título importante
 */
function detectarSeccion(linea) {
    return (
        linea.includes('===') ||           // Separadores
        linea.includes('---') ||           
        linea.match(/^#+\s/) ||            // Markdown headers
        linea.match(/^\d+\.\s/) ||         // Numeración
        linea.includes('PROCESO') ||       // Procesos clave
        linea.includes('CULTIVO') ||       // Cultivos
        linea.includes('CLIENTE') ||       // Información de clientes
        linea.includes('INJERTO') ||       // Injertos (especialidad)
        linea.includes('CERTIFICACIÓN') || // Certificaciones
        linea.toUpperCase() === linea && linea.length > 10 // Títulos en mayúsculas
    );
}

/**
 * Crea un chunk estructurado con metadatos enriquecidos
 */
function crearChunk(contenido, contexto, metadatos, indice) {
    return {
        id: `chunk_${Date.now()}_${indice}`,
        contenido: contenido.trim(),
        contexto: contexto,
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
        .match(/\b[a-záéíóúñ]{4,}\b/g) // Palabras de 4+ caracteres
        ?.filter(palabra => !palabrasComunes.has(palabra))
        .slice(0, 10) || []; // Top 10 palabras clave
}

// =====================================
// GESTIÓN DE BASE DE CONOCIMIENTO VECTORIAL
// =====================================

/**
 * Carga todo el conocimiento de la empresa en Pinecone
 */
async function cargarConocimientoEmpresa(archivoConocimiento) {
    console.log('🧠 [RAG] Cargando conocimiento de empresa...');
    
    try {
        // Leer contenido del archivo
        const fs = require('fs');
        const contenidoCompleto = fs.readFileSync(archivoConocimiento, 'utf8');
        
        // Crear chunks inteligentes
        const chunks = crearChunksInteligentes(contenidoCompleto, {
            fuente: 'conocimiento_empresa',
            version: '1.0',
            categoria: 'empresa'
        });
        
        console.log(`📄 [RAG] Procesando ${chunks.length} fragmentos de conocimiento...`);
        
        // Generar embeddings y almacenar en Pinecone
        let cargadosExitosamente = 0;
        for (const chunk of chunks) {
            try {
                await almacenarChunkEnPinecone(chunk);
                cargadosExitosamente++;
                
                if (cargadosExitosamente % 10 === 0) {
                    console.log(`📊 [RAG] Cargados ${cargadosExitosamente}/${chunks.length} fragmentos...`);
                }
            } catch (error) {
                console.error(`❌ [RAG] Error cargando chunk ${chunk.id}:`, error.message);
            }
        }
        
        console.log(`✅ [RAG] Conocimiento cargado: ${cargadosExitosamente}/${chunks.length} fragmentos`);
        return { total: chunks.length, exitosos: cargadosExitosamente };
        
    } catch (error) {
        console.error('❌ [RAG] Error cargando conocimiento:', error.message);
        throw error;
    }
}

/**
 * Almacena un chunk individual en Pinecone con embedding
 */
async function almacenarChunkEnPinecone(chunk) {
    try {
        // Generar embedding para el contenido
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small", // Modelo más económico
            input: chunk.contenido,
            encoding_format: "float"
        });
        
        const embedding = response.data[0].embedding;
        
        // Almacenar en Pinecone (usando la función existente adaptada)
        await pineconeMemoria.almacenarMemoria({
            id: chunk.id,
            contenido: chunk.contenido,
            contexto: chunk.contexto,
            metadatos: chunk.metadatos,
            embedding: embedding,
            namespace: 'conocimiento_empresa' // Namespace específico para RAG
        });
        
        console.log(`💾 [RAG] Chunk almacenado: ${chunk.id}`);
        
    } catch (error) {
        console.error(`❌ [RAG] Error almacenando chunk ${chunk.id}:`, error.message);
        throw error;
    }
}

// =====================================
// RETRIEVAL INTELIGENTE Y OPTIMIZADO
// =====================================

/**
 * Recupera conocimiento relevante para una consulta específica
 */
async function recuperarConocimientoRelevante(consulta, userId) {
    console.log('🔍 [RAG] Recuperando conocimiento relevante...');
    
    try {
        // Generar embedding de la consulta
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: consulta,
            encoding_format: "float"
        });
        
        const consultaEmbedding = response.data[0].embedding;
        
        // Búsqueda semántica en Pinecone (namespace específico)
        const resultados = await pineconeMemoria.buscarSimilares({
            embedding: consultaEmbedding,
            namespace: 'conocimiento_empresa',
            topK: CONFIG_RAG.MAX_CHUNKS_PER_QUERY * 2, // Obtener más para filtrar
            threshold: CONFIG_RAG.SIMILARITY_THRESHOLD
        });
        
        // Filtrar y optimizar resultados
        const fragmentosRelevantes = filtrarFragmentosOptimos(resultados, consulta);
        
        // Construir contexto optimizado
        const contextoRAG = construirContextoOptimizado(fragmentosRelevantes);
        
        console.log(`🎯 [RAG] Recuperados ${fragmentosRelevantes.length} fragmentos relevantes`);
        console.log(`📊 [RAG] Contexto final: ${contextoRAG.length} caracteres`);
        
        return contextoRAG;
        
    } catch (error) {
        console.error('❌ [RAG] Error recuperando conocimiento:', error.message);
        return ''; // Fallar silenciosamente para no interrumpir consulta
    }
}

/**
 * Filtra y optimiza fragmentos según relevancia y diversidad
 */
function filtrarFragmentosOptimos(resultados, consulta) {
    console.log('🔧 [RAG] Filtrando fragmentos óptimos...');
    
    // Ordenar por score de similitud
    const ordenados = resultados.sort((a, b) => b.score - a.score);
    
    // Selección inteligente para diversidad
    const seleccionados = [];
    const tiposIncluidos = new Set();
    
    for (const resultado of ordenados) {
        if (seleccionados.length >= CONFIG_RAG.MAX_CHUNKS_PER_QUERY) break;
        
        const tipo = resultado.metadatos?.tipo || 'general';
        
        // Incluir si es muy relevante O si agrega diversidad
        if (resultado.score >= CONFIG_RAG.HIGH_RELEVANCE || !tiposIncluidos.has(tipo)) {
            seleccionados.push(resultado);
            tiposIncluidos.add(tipo);
        }
    }
    
    console.log(`🎯 [RAG] Seleccionados ${seleccionados.length} fragmentos diversos`);
    return seleccionados;
}

/**
 * Construye contexto optimizado respetando límites de tokens
 */
function construirContextoOptimizado(fragmentos) {
    let contexto = '=== CONOCIMIENTO RELEVANTE DE SEMILLEROS DEITANA ===\n\n';
    let caracteresUsados = contexto.length;
    
    for (let i = 0; i < fragmentos.length; i++) {
        const fragmento = fragmentos[i];
        const contenidoFragmento = `${i + 1}. ${fragmento.contexto ? fragmento.contexto + '\n' : ''}${fragmento.contenido}\n\n`;
        
        // Verificar límite de tokens (aproximado)
        if (caracteresUsados + contenidoFragmento.length > CONFIG_RAG.MAX_TOKENS_CONTEXT * 3.5) {
            console.log(`⚠️ [RAG] Límite de contexto alcanzado en fragmento ${i + 1}`);
            break;
        }
        
        contexto += contenidoFragmento;
        caracteresUsados += contenidoFragmento.length;
    }
    
    return contexto;
}

// =====================================
// ACTUALIZACIÓN INCREMENTAL
// =====================================

/**
 * Añade nuevo conocimiento de forma incremental
 */
async function añadirConocimientoNuevo(nuevoContenido, metadatos = {}) {
    console.log('➕ [RAG] Añadiendo nuevo conocimiento...');
    
    try {
        const chunks = crearChunksInteligentes(nuevoContenido, {
            ...metadatos,
            version: metadatos.version || '1.0',
            fechaAñadido: new Date().toISOString()
        });
        
        let añadidos = 0;
        for (const chunk of chunks) {
            await almacenarChunkEnPinecone(chunk);
            añadidos++;
        }
        
        console.log(`✅ [RAG] Añadidos ${añadidos} nuevos fragmentos de conocimiento`);
        return añadidos;
        
    } catch (error) {
        console.error('❌ [RAG] Error añadiendo conocimiento:', error.message);
        throw error;
    }
}

// =====================================
// MÉTRICAS Y OPTIMIZACIÓN
// =====================================

/**
 * Analiza la efectividad del sistema RAG
 */
async function analizarEfectividadRAG(consultas = []) {
    console.log('📊 [RAG] Analizando efectividad del sistema...');
    
    const metricas = {
        consultasProcesadas: consultas.length,
        promedioPorConsulta: {
            fragmentosRecuperados: 0,
            caracteresContexto: 0,
            tokensAproximados: 0,
            costoEstimado: 0
        },
        distribucionTipos: {},
        rendimiento: {
            tiempoPromedio: 0,
            exitosas: 0,
            fallidas: 0
        }
    };
    
    // TODO: Implementar análisis detallado de métricas
    
    return metricas;
}

module.exports = {
    cargarConocimientoEmpresa,
    recuperarConocimientoRelevante,
    añadirConocimientoNuevo,
    analizarEfectividadRAG,
    CONFIG_RAG
}; 