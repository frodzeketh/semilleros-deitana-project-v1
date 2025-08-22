// =====================================
// SISTEMA DE CACHE INTELIGENTE PARA DEITANA
// =====================================
// 
// Cache en memoria para:
// - Información de usuarios (evitar Firebase Auth repetido)
// - Historial conversacional reciente
// - Embeddings de consultas frecuentes
// - Contexto RAG reciente
// =====================================

// =====================================
// CONFIGURACIÓN DE CACHES (IMPLEMENTACIÓN SIMPLE)
// =====================================

// Implementación simple de cache con TTL
class SimpleCache {
    constructor(maxSize = 1000, ttl = 30 * 60 * 1000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = ttl;
    }
    
    set(key, value) {
        const expires = Date.now() + this.ttl;
        
        // Si el cache está lleno, eliminar el más antiguo
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, { value, expires });
    }
    
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        // Verificar si expiró
        if (Date.now() > item.expires) {
            this.cache.delete(key);
            return null;
        }
        
        return item.value;
    }
    
    clear() {
        this.cache.clear();
    }
    
    get size() {
        return this.cache.size;
    }
    
    get max() {
        return this.maxSize;
    }
}

// Cache de usuarios (30 minutos)
const userInfoCache = new SimpleCache(1000, 30 * 60 * 1000);

// Cache de historial conversacional (10 minutos)
const conversationCache = new SimpleCache(500, 10 * 60 * 1000);

// Cache de embeddings (1 hora)
const embeddingCache = new SimpleCache(2000, 60 * 60 * 1000);

// Cache de contexto RAG (15 minutos)
const ragContextCache = new SimpleCache(300, 15 * 60 * 1000);

// Cache de intenciones (5 minutos)
const intentionCache = new SimpleCache(1000, 5 * 60 * 1000);

// =====================================
// FUNCIONES DE CACHE
// =====================================

/**
 * Cache de información de usuarios
 */
function cacheUserInfo(userId, userInfo) {
    userInfoCache.set(userId, userInfo);
    console.log(`📦 [CACHE] Usuario guardado en cache: ${userId}`);
}

function getCachedUserInfo(userId) {
    const cached = userInfoCache.get(userId);
    if (cached) {
        console.log(`⚡ [CACHE] Usuario encontrado en cache: ${userId}`);
        return cached;
    }
    return null;
}

/**
 * Cache de historial conversacional
 */
function cacheConversation(userId, conversationId, messages) {
    const key = `${userId}_${conversationId}`;
    conversationCache.set(key, messages);
    console.log(`📦 [CACHE] Conversación guardada en cache: ${key}`);
}

function getCachedConversation(userId, conversationId) {
    const key = `${userId}_${conversationId}`;
    const cached = conversationCache.get(key);
    if (cached) {
        console.log(`⚡ [CACHE] Conversación encontrada en cache: ${key}`);
        return cached;
    }
    return null;
}

/**
 * Cache de embeddings
 */
function cacheEmbedding(text, embedding) {
    // Usar hash del texto como key para ahorrar memoria
    const key = simpleHash(text);
    embeddingCache.set(key, embedding);
    console.log(`📦 [CACHE] Embedding guardado: ${text.substring(0, 30)}...`);
}

function getCachedEmbedding(text) {
    const key = simpleHash(text);
    const cached = embeddingCache.get(key);
    if (cached) {
        console.log(`⚡ [CACHE] Embedding encontrado: ${text.substring(0, 30)}...`);
        return cached;
    }
    return null;
}

/**
 * Cache de contexto RAG
 */
function cacheRAGContext(query, context) {
    const key = simpleHash(query);
    ragContextCache.set(key, context);
    console.log(`📦 [CACHE] Contexto RAG guardado: ${query.substring(0, 30)}...`);
}

function getCachedRAGContext(query) {
    const key = simpleHash(query);
    const cached = ragContextCache.get(key);
    if (cached) {
        console.log(`⚡ [CACHE] Contexto RAG encontrado: ${query.substring(0, 30)}...`);
        return cached;
    }
    return null;
}

/**
 * Cache de análisis de intención
 */
function cacheIntention(query, intention) {
    const key = simpleHash(query);
    intentionCache.set(key, intention);
    console.log(`📦 [CACHE] Intención guardada: ${query.substring(0, 30)}...`);
}

function getCachedIntention(query) {
    const key = simpleHash(query);
    const cached = intentionCache.get(key);
    if (cached) {
        console.log(`⚡ [CACHE] Intención encontrada: ${query.substring(0, 30)}...`);
        return cached;
    }
    return null;
}

// =====================================
// UTILIDADES
// =====================================

/**
 * Hash simple para keys de cache
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
}

/**
 * Estadísticas de cache
 */
function getCacheStats() {
    return {
        userInfo: {
            size: userInfoCache.size,
            max: userInfoCache.max
        },
        conversations: {
            size: conversationCache.size,
            max: conversationCache.max
        },
        embeddings: {
            size: embeddingCache.size,
            max: embeddingCache.max
        },
        ragContext: {
            size: ragContextCache.size,
            max: ragContextCache.max
        },
        intentions: {
            size: intentionCache.size,
            max: intentionCache.max
        }
    };
}

/**
 * Limpiar todos los caches
 */
function clearAllCaches() {
    userInfoCache.clear();
    conversationCache.clear();
    embeddingCache.clear();
    ragContextCache.clear();
    intentionCache.clear();
    console.log('🧹 [CACHE] Todos los caches limpiados');
}

module.exports = {
    // Cache de usuarios
    cacheUserInfo,
    getCachedUserInfo,
    
    // Cache de conversaciones
    cacheConversation,
    getCachedConversation,
    
    // Cache de embeddings
    cacheEmbedding,
    getCachedEmbedding,
    
    // Cache de RAG
    cacheRAGContext,
    getCachedRAGContext,
    
    // Cache de intenciones
    cacheIntention,
    getCachedIntention,
    
    // Utilidades
    getCacheStats,
    clearAllCaches
};
