const admin = require('../firebase-admin');
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

        console.log('Creando/obteniendo documento para userId:', userId);

        const userChatRef = this.chatsCollection.doc(userId);
        const userChatDoc = await userChatRef.get();

        if (!userChatDoc.exists) {
            console.log('Creando nuevo documento para usuario:', userId);
            await userChatRef.set({
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                userId: userId
            });
        }

        return userChatRef;
    }

    // Crear una nueva conversación
    async createConversation(userId, initialMessage) {
        if (!userId) {
            throw new Error('userId es requerido');
        }

        const userChatRef = await this.getUserChatDoc(userId);
        const conversationRef = userChatRef.collection('conversations').doc();
        
        const now = new Date();
        await conversationRef.set({
            createdAt: now,
            lastUpdated: now,
            messages: [{
                content: initialMessage,
                role: 'assistant',
                timestamp: now
            }]
        });

        return conversationRef.id;
    }

    // Agregar un mensaje a una conversación existente
    async addMessage(userId, conversationId, message) {
        if (!userId) {
            throw new Error('userId es requerido');
        }

        console.log('Agregando mensaje para userId:', userId, 'conversationId:', conversationId);

        const userChatRef = await this.getUserChatDoc(userId);
        const conversationRef = userChatRef.collection('conversations').doc(conversationId);
        
        const now = new Date();
        const newMessage = {
            content: message.content,
            role: message.role,
            timestamp: now
        };

        // Primero obtenemos el documento actual
        const conversationDoc = await conversationRef.get();
        let messages = [];
        
        if (conversationDoc.exists) {
            messages = conversationDoc.data().messages || [];
        }
        
        // Agregamos el nuevo mensaje
        messages.push(newMessage);
        
        // Actualizamos el documento con el nuevo array de mensajes
        await conversationRef.set({
            lastUpdated: now,
            messages: messages
        }, { merge: true });
    }

    // Obtener el historial de mensajes de una conversación
    async getConversationHistory(userId, conversationId) {
        if (!userId) {
            throw new Error('userId es requerido');
        }

        const userChatRef = await this.getUserChatDoc(userId);
        const conversationDoc = await userChatRef.collection('conversations').doc(conversationId).get();
        
        if (!conversationDoc.exists) {
            throw new Error('Conversación no encontrada');
        }

        return conversationDoc.data().messages;
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
}

module.exports = new ChatManager(); 