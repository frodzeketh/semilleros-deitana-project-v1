// Lista de correos electrónicos de administradores
const adminEmails = [
    // Lista vacía - todos los usuarios serán tratados como empleados
    'test1@gmail.com',  // Comentado para usar sistema employee
    'administrador@gmail.com'
];

// Función para verificar si un correo es de administrador
function isAdmin(email) {
    return adminEmails.includes(email);
}

module.exports = {
    adminEmails,
    isAdmin
}; 