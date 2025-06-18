const admin = require('../firebase-admin');
const { adminEmails } = require('../adminEmails');

const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // Asegurarnos de que el uid esté presente
        if (!decodedToken.uid) {
            return res.status(401).json({ error: 'Token inválido: no contiene uid' });
        }

        // Agregar información del usuario al request
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            isAdmin: adminEmails.includes(decodedToken.email)
        };

        // console.log('Usuario autenticado:', req.user); // Para debugging
        next();
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
};

const isAdmin = async (req, res, next) => {
    try {
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de administrador.' });
        }
        next();
    } catch (error) {
        console.error('Error checking admin status:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

const isEmployee = async (req, res, next) => {
    try {
        if (req.user.isAdmin) {
            return res.status(403).json({ error: 'Los administradores no pueden acceder a las funcionalidades de empleado.' });
        }
        next();
    } catch (error) {
        console.error('Error checking employee status:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

module.exports = {
    verifyToken,
    isAdmin,
    isEmployee
}; 