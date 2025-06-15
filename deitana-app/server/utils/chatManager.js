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

        console.log('Creando/obteniendo documento para userId:', userId);

        const userChatRef = this.chatsCollection.doc(userId);
        const userChatDoc = await userChatRef.get();

        if (!userChatDoc.exists) {
            console.log('Creando nuevo documento para usuario:', userId);
            const timestamp = new Date().toISOString();
            await userChatRef.set({
                createdAt: timestamp,
                lastUpdated: timestamp
            });
        }

        return userChatRef;
    }

    // Crear una nueva conversación
    async createConversation(userId, initialMessage) {
        console.log('=== INICIO CREACIÓN DE CONVERSACIÓN ===');
        console.log('Usuario:', userId);
        console.log('Mensaje inicial:', initialMessage);

        try {
            // Si el mensaje es NUEVA_CONEXION o está vacío, no creamos la conversación
            if (!initialMessage || initialMessage === 'NUEVA_CONEXION') {
                console.log('No se creará la conversación - mensaje inicial inválido');
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
            console.log('Conversación creada con ID:', conversationRef.id);
            console.log('=== FIN CREACIÓN DE CONVERSACIÓN ===');
            return conversationRef.id;
        } catch (error) {
            console.error('Error al crear conversación:', error);
            console.error('Stack trace:', error.stack);
            throw error;
        }
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
        console.log('=== INICIO OBTENCIÓN DE CONVERSACIONES ===');
        console.log('Usuario:', userId);

        try {
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

            console.log(`Se encontraron ${conversations.length} conversaciones`);
            console.log('=== FIN OBTENCIÓN DE CONVERSACIONES ===');
            return conversations;
        } catch (error) {
            console.error('Error al obtener conversaciones:', error);
            console.error('Stack trace:', error.stack);
            throw error;
        }
    }

    async getConversationMessages(userId, conversationId) {
        console.log('=== INICIO OBTENCIÓN DE MENSAJES ===');
        console.log('Usuario:', userId);
        console.log('Conversación:', conversationId);

        try {
            const conversationRef = this.chatsCollection
                .doc(userId)
                .collection('conversations')
                .doc(conversationId);
            const conversation = await conversationRef.get();

            if (!conversation.exists) {
                throw new Error('Conversación no encontrada');
            }

            const data = conversation.data();
            console.log(`Se encontraron ${data.messages.length} mensajes`);
            console.log('=== FIN OBTENCIÓN DE MENSAJES ===');
            return data.messages;
        } catch (error) {
            console.error('Error al obtener mensajes:', error);
            console.error('Stack trace:', error.stack);
            throw error;
        }
    }

    async addMessageToConversation(userId, conversationId, message) {
        console.log('=== INICIO AGREGAR MENSAJE ===');
        console.log('Usuario:', userId);
        console.log('Conversación:', conversationId);
        console.log('Mensaje:', message);

        try {
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

            console.log('Mensaje agregado correctamente');
            console.log('=== FIN AGREGAR MENSAJE ===');
            return newMessage;
        } catch (error) {
            console.error('Error al agregar mensaje:', error);
            console.error('Stack trace:', error.stack);
            throw error;
        }
    }

    async verifyChatOwnership(userId, conversationId) {
        console.log('=== INICIO VERIFICACIÓN DE PROPIEDAD ===');
        console.log('Usuario:', userId);
        console.log('Conversación:', conversationId);

        try {
            const conversationRef = this.chatsCollection
                .doc(userId)
                .collection('conversations')
                .doc(conversationId);
            const conversation = await conversationRef.get();

            if (!conversation.exists) {
                throw new Error('Conversación no encontrada');
            }

            console.log('Propiedad verificada correctamente');
            console.log('=== FIN VERIFICACIÓN DE PROPIEDAD ===');
            return true;
        } catch (error) {
            console.error('Error al verificar propiedad:', error);
            console.error('Stack trace:', error.stack);
            throw error;
        }
    }
}

module.exports = new ChatManager(); 