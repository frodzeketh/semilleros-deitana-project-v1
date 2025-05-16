const { mapaERP } = require('../mapaERP');

// Función para extraer conceptos clave de un texto
function extraerConceptos(texto) {
    // Convertir a minúsculas y eliminar caracteres especiales
    const textoLimpio = texto.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
        .replace(/\s{2,}/g, ' ');
    
    // Dividir en palabras y filtrar palabras comunes
    const palabrasComunes = ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'de', 'del', 'en', 'con', 'por', 'para'];
    const palabras = textoLimpio.split(' ')
        .filter(palabra => palabra.length > 3 && !palabrasComunes.includes(palabra));
    
    return [...new Set(palabras)]; // Eliminar duplicados
}

// Función para calcular la relevancia de un concepto en una descripción
function calcularRelevancia(concepto, descripcion) {
    const descripcionLimpia = descripcion.toLowerCase();
    const conceptoLimpio = concepto.toLowerCase();
    
    // Contar ocurrencias del concepto
    const ocurrencias = (descripcionLimpia.match(new RegExp(conceptoLimpio, 'g')) || []).length;
    
    // Calcular relevancia basada en ocurrencias y posición
    const posicion = descripcionLimpia.indexOf(conceptoLimpio);
    const relevanciaPosicion = posicion === -1 ? 0 : 1 / (posicion + 1);
    
    return ocurrencias + relevanciaPosicion;
}

// Función para procesar el contexto del mapaERP
function procesarContexto() {
    const indiceSemantico = {};
    
    Object.entries(mapaERP).forEach(([tabla, info]) => {
        const conceptos = extraerConceptos(info.descripcion);
        
        conceptos.forEach(concepto => {
            if (!indiceSemantico[concepto]) {
                indiceSemantico[concepto] = [];
            }
            indiceSemantico[concepto].push({
                tabla: info.tabla,
                descripcion: info.descripcion,
                relevancia: calcularRelevancia(concepto, info.descripcion)
            });
        });
    });
    
    return indiceSemantico;
}

// Función para encontrar la tabla más relevante para una consulta
function encontrarTablaRelevante(consulta, indiceSemantico) {
    const conceptosConsulta = extraerConceptos(consulta);
    const tablasRelevantes = {};
    
    conceptosConsulta.forEach(concepto => {
        if (indiceSemantico[concepto]) {
            indiceSemantico[concepto].forEach(info => {
                if (!tablasRelevantes[info.tabla]) {
                    tablasRelevantes[info.tabla] = {
                        tabla: info.tabla,
                        descripcion: info.descripcion,
                        relevanciaTotal: 0
                    };
                }
                tablasRelevantes[info.tabla].relevanciaTotal += info.relevancia;
            });
        }
    });
    
    // Encontrar la tabla con mayor relevancia
    const tablaMasRelevante = Object.values(tablasRelevantes)
        .sort((a, b) => b.relevanciaTotal - a.relevanciaTotal)[0];
    
    return tablaMasRelevante;
}

// Función principal para procesar una consulta
function procesarConsulta(consulta) {
    const indiceSemantico = procesarContexto();
    const tablaRelevante = encontrarTablaRelevante(consulta, indiceSemantico);
    
    return tablaRelevante;
}

module.exports = {
    procesarConsulta,
    extraerConceptos,
    calcularRelevancia,
    procesarContexto,
    encontrarTablaRelevante
};