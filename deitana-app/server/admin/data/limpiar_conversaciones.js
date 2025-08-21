// =====================================
// LIMPIAR CONVERSACIONES ANTIGUAS DE FIRESTORE
// =====================================

// Inicializar Firebase Admin
const admin = require('firebase-admin');
require('dotenv').config();

// Inicializar Firebase si no está inicializado
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
    });
}

async function limpiarConversacionesAntiguas() {
    console.log('🧹 [LIMPIEZA] Iniciando limpieza de conversaciones antiguas...\n');
    
    try {
        const db = admin.firestore();
        
        // Obtener todas las conversaciones
        const conversationsRef = db.collection('chats');
        const snapshot = await conversationsRef.get();
        
        console.log(`📊 [LIMPIEZA] Encontradas ${snapshot.size} conversaciones`);
        
        let eliminadas = 0;
        let mantenidas = 0;
        
        for (const doc of snapshot.docs) {
            const userId = doc.id;
            const conversationsSnapshot = await doc.ref.collection('conversations').get();
            
            console.log(`👤 [LIMPIEZA] Usuario ${userId}: ${conversationsSnapshot.size} conversaciones`);
            
            for (const convDoc of conversationsSnapshot.docs) {
                const conversationData = convDoc.data();
                const messages = conversationData.messages || [];
                
                // Si hay más de 50 mensajes, mantener solo los últimos 20
                if (messages.length > 50) {
                    console.log(`📝 [LIMPIEZA] Conversación ${convDoc.id}: ${messages.length} mensajes → manteniendo últimos 20`);
                    
                    const mensajesRecientes = messages.slice(-20);
                    await convDoc.ref.update({
                        messages: mensajesRecientes,
                        lastCleaned: new Date()
                    });
                    
                    eliminadas += (messages.length - 20);
                } else {
                    mantenidas += messages.length;
                }
            }
        }
        
        console.log(`\n✅ [LIMPIEZA] Completada:`);
        console.log(`   📤 Mensajes eliminados: ${eliminadas}`);
        console.log(`   📥 Mensajes mantenidos: ${mantenidas}`);
        
    } catch (error) {
        console.error('❌ [LIMPIEZA] Error:', error.message);
        throw error;
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    limpiarConversacionesAntiguas().then(() => {
        console.log('\n🎉 Limpieza completada');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Error en limpieza:', error);
        process.exit(1);
    });
}

module.exports = { limpiarConversacionesAntiguas };
