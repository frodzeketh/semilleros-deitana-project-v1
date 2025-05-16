// server/utils/relacionProcessor.js
const { mapaERP } = require('../mapaERP');

function procesarRelaciones(tablaRelevante) {
    if (!tablaRelevante || !tablaRelevante.relaciones) {
        return {
            query: `SELECT * FROM \`${tablaRelevante.tabla}\``,
            campos: Object.keys(tablaRelevante.columnas || {})
        };
    }

    let joins = [];
    let campos = [`${tablaRelevante.tabla}.*`];
    let alias = tablaRelevante.tabla.charAt(0);

    // Procesar relaciones
    if (Array.isArray(tablaRelevante.relaciones)) {
        tablaRelevante.relaciones.forEach(rel => {
            const tablaRelacionada = mapaERP[rel.tablaDestino];
            if (tablaRelacionada) {
                const aliasRel = rel.tablaDestino.charAt(0);
                joins.push(`LEFT JOIN \`${rel.tablaDestino}\` ${aliasRel} ON ${alias}.${rel.campoOrigen} = ${aliasRel}.${rel.campoDestino}`);
                
                // Agregar campo de denominación si existe
                const campoDenominacion = encontrarCampoDenominacion(rel.tablaDestino);
                if (campoDenominacion) {
                    campos.push(`${aliasRel}.${campoDenominacion} as ${rel.tablaDestino}_denominacion`);
                }
            }
        });
    }

    const query = `
        SELECT ${campos.join(', ')}
        FROM \`${tablaRelevante.tabla}\` ${alias}
        ${joins.join('\n')}
    `;

    return {
        query,
        campos: campos.map(campo => campo.split(' as ')[0])
    };
}

function encontrarCampoDenominacion(tabla) {
    const tablaInfo = mapaERP[tabla];
    if (!tablaInfo || !tablaInfo.columnas) return null;

    // Buscar campos que terminen en _DENO
    const campoDenominacion = Object.keys(tablaInfo.columnas)
        .find(campo => campo.endsWith('_DENO'));
    
    return campoDenominacion;
}

module.exports = {
    procesarRelaciones
};