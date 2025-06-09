const admin = require('firebase-admin');
const serviceAccount = require('./login-deitana-firebase-adminsdk-fbsvc-a596a8627e.json');

// Inicializar Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

module.exports = admin; 