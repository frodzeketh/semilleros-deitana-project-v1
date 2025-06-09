// Lista de correos electrónicos de administradores
const adminEmails = [
    // Agrega aquí los correos de los administradores
    'test1@gmail.com'
];

// Función para verificar si un correo es de administrador
function isAdmin(email) {
    return adminEmails.includes(email);
}

module.exports = {
    adminEmails,
    isAdmin
}; 