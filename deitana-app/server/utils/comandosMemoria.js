// =====================================
// COMANDOS ESPECIALES PARA MEMORIA SEMÁNTICA
// =====================================

const pineconeMemoria = require('./pinecone');

/**
 * Procesa comandos especiales de memoria
 * Retorna null si no es un comando especial
 */
async function procesarComandoMemoria(mensaje, userId) {
    const mensajeLower = mensaje.toLowerCase();
    
    // Comando: Guardar preferencia
    if (mensajeLower.startsWith('recuerda que') || mensajeLower.startsWith('mi preferencia es')) {
        const preferencia = mensaje.replace(/^(recuerda que|mi preferencia es)\s*/i, '');
        await pineconeMemoria.guardarRecuerdo(userId, preferencia, 'preferencia');
        return {
            success: true,
            data: {
                message: `✅ Perfecto, he guardado tu preferencia: "${preferencia}". La recordaré para futuras consultas.`
            }
        };
    }
    
    // Comando: Ver mis recuerdos
    if (mensajeLower.includes('mis recuerdos') || mensajeLower.includes('qué recuerdas de mí')) {
        const preferencias = await pineconeMemoria.buscarPreferencias(userId);
        
        if (preferencias.length === 0) {
            return {
                success: true,
                data: {
                    message: `🤔 Aún no tengo preferencias guardadas tuyas. Puedes decirme cosas como "Recuerda que prefiero bandejas de 104 alvéolos" y las guardaré para futuras consultas.`
                }
            };
        }
        
        let respuesta = `🧠 Aquí están tus preferencias que tengo guardadas:\n\n`;
        preferencias.forEach((pref, index) => {
            respuesta += `${index + 1}. ${pref.texto}\n`;
        });
        respuesta += `\n¿Te gustaría agregar alguna nueva preferencia?`;
        
        return {
            success: true,
            data: {
                message: respuesta
            }
        };
    }
    
    // Comando: Buscar en memoria
    if (mensajeLower.startsWith('busca en mi memoria') || mensajeLower.startsWith('qué sabes sobre')) {
        const consulta = mensaje.replace(/^(busca en mi memoria|qué sabes sobre)\s*/i, '');
        const recuerdos = await pineconeMemoria.buscarRecuerdos(userId, consulta, 5);
        
        if (recuerdos.length === 0) {
            return {
                success: true,
                data: {
                    message: `🔍 No encontré información específica sobre "${consulta}" en nuestra historia de conversaciones.`
                }
            };
        }
        
        let respuesta = `🔍 Esto es lo que encontré sobre "${consulta}":\n\n`;
        recuerdos.forEach((recuerdo, index) => {
            respuesta += `${index + 1}. ${recuerdo.texto} (similitud: ${Math.round(recuerdo.similitud * 100)}%)\n`;
        });
        
        return {
            success: true,
            data: {
                message: respuesta
            }
        };
    }
    
    // Comando: Limpiar memoria
    if (mensajeLower.includes('olvida todo') || mensajeLower.includes('borrar mi memoria')) {
        // Por seguridad, solo mostrar instrucciones en lugar de ejecutar automáticamente
        return {
            success: true,
            data: {
                message: `⚠️ Para proteger tu información, el borrado de memoria debe hacerse manualmente desde la consola de Pinecone. Si realmente necesitas limpiar toda tu memoria, contacta al administrador del sistema.`
            }
        };
    }
    
    // No es un comando especial
    return null;
}

/**
 * Lista de comandos especiales disponibles
 */
function obtenerComandosDisponibles() {
    return `
🧠 **Comandos de Memoria Disponibles:**

• \`Recuerda que [preferencia]\` - Guarda una preferencia personal
• \`Mi preferencia es [preferencia]\` - Guarda una preferencia personal  
• \`Mis recuerdos\` - Muestra todas tus preferencias guardadas
• \`Qué recuerdas de mí\` - Muestra todas tus preferencias guardadas
• \`Busca en mi memoria [tema]\` - Busca información específica en tu historial
• \`Qué sabes sobre [tema]\` - Busca información específica en tu historial

**Ejemplos:**
• "Recuerda que siempre uso bandejas de 104 alvéolos para lechuga"
• "Mi preferencia es trabajar con el proveedor XYZ para sustratos"
• "Busca en mi memoria problemas con tomates"
`;
}

module.exports = {
    procesarComandoMemoria,
    obtenerComandosDisponibles
}; 