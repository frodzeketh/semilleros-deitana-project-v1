// =====================================
// MEMORIA RAM SIMPLE - SOLO FUNCIONA
// =====================================

// Memoria global en RAM
const conversations = new Map(); // conversationId -> messages[]

// Función para obtener o crear conversación
function getConversation(conversationId) {
    if (!conversations.has(conversationId)) {
        conversations.set(conversationId, []);
        console.log(`🆕 [RAM] Nueva conversación: ${conversationId}`);
    }
    return conversations.get(conversationId);
}

// Agregar mensaje
function addMessage(conversationId, role, content) {
    const messages = getConversation(conversationId);
    messages.push({ role, content, timestamp: Date.now() });
    console.log(`💬 [RAM] Mensaje agregado: ${conversationId} (${role})`);
}

// Obtener historial
function getHistory(conversationId) {
    const messages = getConversation(conversationId);
    console.log(`📖 [RAM] Historial: ${conversationId} (${messages.length} mensajes)`);
    return messages;
}

// Limpiar conversaciones antiguas (cada hora)
setInterval(() => {
    const now = Date.now();
    const maxAge = 2 * 60 * 60 * 1000; // 2 horas
    
    for (const [id, messages] of conversations) {
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (now - lastMessage.timestamp > maxAge) {
                conversations.delete(id);
                console.log(`🧹 [RAM] Conversación eliminada: ${id}`);
            }
        }
    }
}, 60 * 60 * 1000); // Cada hora

console.log('🧠 [RAM] Memoria RAM simple inicializada');

module.exports = {
    addMessage,
    getHistory
};
