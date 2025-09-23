const admin = require('../firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const db = admin.firestore();

class ChatManager {
    constructor() {
        this.chatsCollection = db.collection('chats');
    }

    // Crear o obtener el documento de chat de un usuario
    async getUserChatDoc(userId) {
        if (!userId) {
            throw new Error('userId es requerido');
        }

        const userChatRef = this.chatsCollection.doc(userId);
        const userChatDoc = await userChatRef.get();

        if (!userChatDoc.exists) {
            await userChatRef.set({
                createdAt: new Date(),
                conversationCount: 0
            });
        }

        return userChatRef;
    }

    // Crear una nueva conversación
    async createConversation(userId, initialMessage) {
        if (!userId || !initialMessage || initialMessage.trim() === '') {
            return null;
        }

        const conversationRef = this.chatsCollection.doc(userId).collection('conversations').doc();
        const timestamp = new Date().toISOString();

        // Generar un título más descriptivo
        let title = 'Nueva conversación';
        if (initialMessage && initialMessage !== 'NUEVA_CONEXION') {
            // Limpiar el mensaje para el título
            const cleanMessage = initialMessage.trim();
            title = cleanMessage.substring(0, 50) + (cleanMessage.length > 50 ? '...' : '');
        }

        const conversationData = {
            title: title,
            createdAt: timestamp,
            updatedAt: timestamp,
            messages: [] // Inicializamos con un array vacío
        };

        await conversationRef.set(conversationData);
        return conversationRef.id;
    }

    // Obtener todas las conversaciones de un usuario
    async getUserConversations(userId) {
        if (!userId) {
            throw new Error('userId es requerido');
        }

        const userChatRef = await this.getUserChatDoc(userId);
        const conversationsSnapshot = await userChatRef.collection('conversations').get();
        
        return conversationsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    async getConversations(userId) {
        const snapshot = await this.chatsCollection
            .doc(userId)
            .collection('conversations')
            .orderBy('updatedAt', 'desc')
            .get();

        const conversations = [];
        snapshot.forEach(doc => {
            conversations.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return conversations;
    }

    async getConversationMessages(userId, conversationId) {
        const conversationRef = this.chatsCollection
            .doc(userId)
            .collection('conversations')
            .doc(conversationId);
        const conversation = await conversationRef.get();

        if (!conversation.exists) {
            throw new Error('Conversación no encontrada');
        }

        const data = conversation.data();
        console.log('🔍 [CHAT-MANAGER] Mensajes cargados del historial:', data.messages?.map(msg => ({
            role: msg.role,
            content: msg.content?.substring(0, 100) + '...',
            hasTrace: !!msg.trace,
            trace: msg.trace
        })));
        return data.messages;
    }

    async addMessageToConversation(userId, conversationId, message) {
        const conversationRef = this.chatsCollection
            .doc(userId)
            .collection('conversations')
            .doc(conversationId);
        const conversation = await conversationRef.get();

        if (!conversation.exists) {
            throw new Error('Conversación no encontrada');
        }

        const timestamp = new Date().toISOString();
        const newMessage = {
            role: message.role,
            content: message.content,
            timestamp: timestamp
        };

        await conversationRef.update({
            messages: FieldValue.arrayUnion(newMessage),
            updatedAt: timestamp
        });

        return true;
    }

    async verifyChatOwnership(userId, conversationId) {
        const conversationRef = this.chatsCollection
            .doc(userId)
            .collection('conversations')
            .doc(conversationId);
        const conversation = await conversationRef.get();

        if (!conversation.exists) {
            throw new Error('Conversación no encontrada');
        }

        return true;
    }
}

module.exports = new ChatManager(); 