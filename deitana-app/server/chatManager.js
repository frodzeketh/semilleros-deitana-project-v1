const admin = require('firebase-admin');

class ChatManager {
  constructor() {
    this.db = admin.firestore();
  }

  async createConversation(userId, initialMessage) {
    try {
      const conversationRef = this.db.collection('conversations').doc();
      const conversationId = conversationRef.id;

      await conversationRef.set({
        userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        title: initialMessage.substring(0, 50) + (initialMessage.length > 50 ? '...' : ''),
        messages: [{
          text: initialMessage,
          sender: 'user',
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        }]
      });

      return conversationId;
    } catch (error) {
      console.error('Error al crear conversación:', error);
      throw error;
    }
  }

  async getConversations(userId) {
    try {
      const conversationsSnapshot = await this.db
        .collection('conversations')
        .where('userId', '==', userId)
        .orderBy('updatedAt', 'desc')
        .get();

      return conversationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }));
    } catch (error) {
      console.error('Error al obtener conversaciones:', error);
      throw error;
    }
  }

  async getConversationMessages(userId, conversationId) {
    try {
      const conversationDoc = await this.db
        .collection('conversations')
        .doc(conversationId)
        .get();

      if (!conversationDoc.exists) {
        throw new Error('Conversación no encontrada');
      }

      const conversationData = conversationDoc.data();
      if (conversationData.userId !== userId) {
        throw new Error('No autorizado para acceder a esta conversación');
      }

      return conversationData.messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp?.toDate()
      }));
    } catch (error) {
      console.error('Error al obtener mensajes:', error);
      throw error;
    }
  }

  async addMessageToConversation(userId, conversationId, message) {
    try {
      const conversationRef = this.db.collection('conversations').doc(conversationId);
      const conversationDoc = await conversationRef.get();

      if (!conversationDoc.exists) {
        throw new Error('Conversación no encontrada');
      }

      const conversationData = conversationDoc.data();
      if (conversationData.userId !== userId) {
        throw new Error('No autorizado para modificar esta conversación');
      }

      await conversationRef.update({
        messages: admin.firestore.FieldValue.arrayUnion(message),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Error al añadir mensaje:', error);
      throw error;
    }
  }
}

module.exports = new ChatManager(); 