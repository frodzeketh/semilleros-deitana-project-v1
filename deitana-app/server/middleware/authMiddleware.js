const { isAdmin } = require('../adminEmails');
const admin = require('../firebase-admin');

function authMiddleware(req, res, next) {
    try {
        // Obtener el token de Firebase del header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No se proporcionó token de autenticación' });
        }

        const token = authHeader.split('Bearer ')[1];
        
        // Verificar el token con Firebase Admin
        admin.auth().verifyIdToken(token)
            .then((decodedToken) => {
                const email = decodedToken.email;
                
                // Verificar si el usuario es admin
                const isUserAdmin = isAdmin(email);
                
                // Agregar información del usuario al request
                req.user = {
                    email: email,
                    isAdmin: isUserAdmin
                };
                
                next();
            })
            .catch((error) => {
                console.error('Error al verificar token:', error);
                res.status(401).json({ error: 'Token inválido' });
            });
    } catch (error) {
        console.error('Error en middleware de autenticación:', error);
        res.status(500).json({ error: 'Error en la autenticación' });
    }
}

module.exports = authMiddleware; 