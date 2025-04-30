const db = require('../db');

// Funciones para consultas de bandejas
async function queryBandejas(limit = null) {
  const query = `
    SELECT 
      id,
      BN_DENO as denominacion,
      BN_ALV as total_alveolos,
      BN_RET as retornable,
      BN_PVP as precio_venta,
      BN_COS as coste,
      BN_ALVC as alveolos_columna,
      BN_EM2 as metros_cuadrados,
      BN_ALVG as alveolos_grandes
    FROM bandejas
    ORDER BY CAST(BN_ALV AS SIGNED) DESC
    ${limit ? 'LIMIT ?' : ''}`;
  
  try {
    const [results] = await db.query(query, limit ? [limit] : []);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryBandejasConMasAlveolos(minAlveolos) {
  const query = `
    SELECT 
      id,
      BN_DENO as denominacion,
      BN_ALV as total_alveolos,
      BN_RET as retornable,
      BN_PVP as precio_venta,
      BN_ALVC as alveolos_columna,
      BN_EM2 as metros_cuadrados
    FROM bandejas
    WHERE BN_ALV >= ?
    ORDER BY BN_ALV DESC`;
  
  try {
    const [results] = await db.query(query, [minAlveolos]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryBandejaMasAlveolos() {
  const query = `
    SELECT 
      id,
      BN_DENO as denominacion,
      BN_ALV as total_alveolos,
      BN_RET as retornable,
      BN_PVP as precio_venta,
      BN_ALVC as alveolos_columna,
      BN_EM2 as metros_cuadrados
    FROM bandejas
    ORDER BY CAST(BN_ALV AS SIGNED) DESC
    LIMIT 1`;
  
  try {
    const [results] = await db.query(query);
    return results[0];
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

// Función para procesar mensajes relacionados con bandejas
async function processBandejasMessage(message) {
  const messageLower = message.toLowerCase();
  let dbData = null;
  let contextType = null;

  if (messageLower.includes('más alveolos') || messageLower.includes('mayor número')) {
    dbData = await queryBandejaMasAlveolos();
    contextType = 'bandeja_mas_alveolos';
  } else if (messageLower.match(/más de (\d+) alveolos/)) {
    const numAlveolos = parseInt(messageLower.match(/más de (\d+) alveolos/)[1]);
    dbData = await queryBandejasConMasAlveolos(numAlveolos);
    contextType = 'bandejas_filtradas';
  } else if (messageLower.includes('tipos de bandejas') || messageLower.includes('que bandejas')) {
    dbData = await queryBandejas();
    contextType = 'tipos_bandejas';
  } else if (messageLower.match(/dime (\d+) bandejas/)) {
    const numBandejas = parseInt(messageLower.match(/dime (\d+) bandejas/)[1]);
    dbData = await queryBandejas(numBandejas);
    contextType = 'lista_bandejas';
  } else {
    dbData = await queryBandejas(5);
    contextType = 'tipos_bandejas';
  }

  return { dbData, contextType };
}

module.exports = {
  processBandejasMessage,
  queryBandejas,
  queryBandejasConMasAlveolos,
  queryBandejaMasAlveolos
}; 