// =====================================
// CONFIGURACIÓN DE PINECONE PARA MEMORIA SEMÁNTICA
// =====================================

const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAI } = require('openai');
require('dotenv').config();

// Inicializar clientes
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const INDEX_NAME = process.env.PINECONE_INDEX || 'memoria-deitana';

// =====================================
// FUNCIONES PRINCIPALES
// =====================================

/**
 * Genera un embedding de un texto usando OpenAI
 */
async function generarEmbedding(texto) {
    try {
        console.log('🧠 [PINECONE] Generando embedding para:', texto.substring(0, 50) + '...');
        
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: texto,
        });
        
        console.log('✅ [PINECONE] Embedding generado exitosamente');
        return response.data[0].embedding;
    } catch (error) {
        console.error('❌ [PINECONE] Error generando embedding:', error);
        throw error;
    }
}

/**
 * Guarda un recuerdo en Pinecone
 */
async function guardarRecuerdo(userId, texto, tipo = 'conversacion') {
    try {
        console.log('💾 [PINECONE] Guardando recuerdo para usuario:', userId);
        
        const index = pinecone.Index(INDEX_NAME);
        const embedding = await generarEmbedding(texto);
        
        const id = `${userId}-${Date.now()}`;
        const metadata = {
            userId: userId,
            texto: texto,
            tipo: tipo,
            timestamp: new Date().toISOString(),
            // Extraer palabras clave para búsqueda adicional
            palabrasClave: extraerPalabrasClave(texto)
        };
        
        await index.upsert([{
            id: id,
            values: embedding,
            metadata: metadata
        }]);
        
        console.log('✅ [PINECONE] Recuerdo guardado con ID:', id);
        return id;
    } catch (error) {
        console.error('❌ [PINECONE] Error guardando recuerdo:', error);
        throw error;
    }
}

/**
 * Busca recuerdos similares en Pinecone
 */
async function buscarRecuerdos(userIdOrConsulta, consultaOrLimit, limite = 5) {
    try {
        // Detectar si se llama con userId o solo consulta
        let userId, consulta, topK;
        
        if (typeof consultaOrLimit === 'string') {
            // Llamada tradicional: buscarRecuerdos(userId, consulta, limite)
            userId = userIdOrConsulta;
            consulta = consultaOrLimit;
            topK = limite;
        } else {
            // Llamada nueva: buscarRecuerdos(consulta, limite) - sin filtro de usuario
            consulta = userIdOrConsulta;
            topK = consultaOrLimit || 5;
            userId = null;
        }
        
        console.log('🔍 [PINECONE] Buscando recuerdos:', consulta.substring(0, 50) + '...');
        
        const index = pinecone.Index(INDEX_NAME);
        const embedding = await generarEmbedding(consulta);
        
        let queryOptions = {
            vector: embedding,
            topK: topK,
            includeMetadata: true
        };
        
        // Solo filtrar por usuario si se proporciona
        if (userId) {
            queryOptions.filter = {
                userId: { "$eq": userId }
            };
        }
        
        const queryResponse = await index.query(queryOptions);
        
        const recuerdos = queryResponse.matches
            .filter(match => match.score > 0.3) // Umbral más bajo para testing
            .map(match => ({
                id: match.id,
                contenido: match.metadata.texto,
                tipo: match.metadata.tipo,
                timestamp: match.metadata.timestamp,
                score: match.score,
                palabrasClave: match.metadata.palabrasClave
            }));
        
        console.log(`✅ [PINECONE] Encontrados ${recuerdos.length} recuerdos relevantes`);
        return recuerdos;
    } catch (error) {
        console.error('❌ [PINECONE] Error buscando recuerdos:', error);
        return []; // Devolver array vacío en caso de error
    }
}

/**
 * Busca recuerdos de preferencias específicas del usuario
 */
async function buscarPreferencias(userId) {
    try {
        console.log('⚙️ [PINECONE] Buscando preferencias de usuario:', userId);
        
        // Usar un vector genérico para buscar todas las preferencias del usuario
        const vectorGenerico = await generarEmbedding("preferencias usuario");
        const index = pinecone.Index(INDEX_NAME);
        
        const queryResponse = await index.query({
            vector: vectorGenerico,
            filter: {
                userId: { "$eq": userId },
                tipo: { "$eq": "preferencia" }
            },
            topK: 10,
            includeMetadata: true
        });
        
        const preferencias = queryResponse.matches.map(match => ({
            texto: match.metadata.texto,
            timestamp: match.metadata.timestamp
        }));
        
        console.log(`✅ [PINECONE] Encontradas ${preferencias.length} preferencias`);
        return preferencias;
    } catch (error) {
        console.error('❌ [PINECONE] Error buscando preferencias:', error);
        return [];
    }
}

/**
 * Actualiza el contexto de conversación con recuerdos relevantes
 */
async function agregarContextoMemoria(userId, consulta) {
    try {
        const recuerdos = await buscarRecuerdos(userId, consulta, 3);
        
        if (recuerdos.length === 0) {
            return '';
        }
        
        let contexto = '\n=== MEMORIA CONVERSACIONAL ===\n';
        contexto += 'Recuerdos relevantes de conversaciones anteriores:\n';
        
        recuerdos.forEach((recuerdo, index) => {
            contexto += `${index + 1}. ${recuerdo.texto}\n`;
        });
        
        contexto += '\nUsa esta información para personalizar tu respuesta.\n';
        
        console.log(`🧠 [PINECONE] Contexto de memoria agregado: ${recuerdos.length} recuerdos`);
        return contexto;
    } catch (error) {
        console.error('❌ [PINECONE] Error agregando contexto de memoria:', error);
        return '';
    }
}

// =====================================
// FUNCIONES AUXILIARES
// =====================================

/**
 * Extrae palabras clave de un texto para búsqueda adicional
 */
function extraerPalabrasClave(texto) {
    return texto.toLowerCase()
        .replace(/[¿?¡!.,;:()\[\]]/g, ' ')
        .split(/\s+/)
        .filter(palabra => palabra.length > 3)
        .filter(palabra => !['para', 'cuando', 'donde', 'como', 'porque', 'aunque'].includes(palabra))
        .slice(0, 10); // Máximo 10 palabras clave
}

/**
 * Determina si un texto contiene información importante para guardar
 */
function esTextoImportante(texto) {
    const palabrasImportantes = [
        'prefiero', 'siempre', 'nunca', 'recuerda', 'importante',
        'cliente', 'proveedor', 'bandeja', 'sustrato', 'partida',
        'problema', 'éxito', 'recomiendo', 'funciona', 'no funciona'
    ];
    
    const textoLower = texto.toLowerCase();
    return palabrasImportantes.some(palabra => textoLower.includes(palabra));
}

/**
 * Guarda automáticamente información importante de la conversación
 */
async function guardarAutomatico(userId, mensaje, respuesta) {
    try {
        // Guardar mensaje del usuario si es importante
        if (esTextoImportante(mensaje)) {
            await guardarRecuerdo(userId, mensaje, 'usuario_importante');
        }
        
        // Guardar respuesta del asistente si contiene información valiosa
        if (respuesta.includes('SELECT') || esTextoImportante(respuesta)) {
            await guardarRecuerdo(userId, respuesta, 'asistente_importante');
        }
        
        console.log('✅ [PINECONE] Información importante guardada automáticamente');
    } catch (error) {
        console.error('❌ [PINECONE] Error en guardado automático:', error);
        // No lanzar error para no interrumpir el flujo principal
    }
}

// =====================================
// EXPORTAR FUNCIONES
// =====================================

module.exports = {
    generarEmbedding,
    guardarRecuerdo,
    buscarRecuerdos,
    buscarPreferencias,
    agregarContextoMemoria,
    guardarAutomatico,
    esTextoImportante
}; 