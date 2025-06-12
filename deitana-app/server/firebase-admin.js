const admin = require('firebase-admin');
require('dotenv').config();

console.log('=== INICIO CONFIGURACIÓN FIREBASE ADMIN ===');
console.log('Verificando variables de entorno...');
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? 'Configurado' : 'No configurado');
console.log('FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? 'Configurado' : 'No configurado');
console.log('FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? 'Configurado' : 'No configurado');

// Verificar si ya existe una instancia de la app
if (!admin.apps.length) {
  try {
    // Inicializar Firebase Admin con las credenciales desde variables de entorno
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      })
    });

    console.log('Firebase Admin inicializado correctamente');
  } catch (error) {
    console.error('Error al inicializar Firebase Admin:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
} else {
  console.log('Firebase Admin ya está inicializado');
}

console.log('=== FIN CONFIGURACIÓN FIREBASE ADMIN ===');

module.exports = admin; 