const db = require('../db');

// Funciones para consultas de casas comerciales
async function queryCasasComerciales(provincia = null, limit = null) {
  const query = `
    SELECT 
      id,
      NULLIF(CC_DENO, '') as denominacion,
      NULLIF(CC_NOM, '') as nombre_comercial,
      NULLIF(CC_DOM, '') as domicilio,
      NULLIF(CC_POB, '') as poblacion,
      NULLIF(CC_PROV, '') as provincia,
      NULLIF(CC_CDP, '') as codigo_postal,
      NULLIF(CC_TEL, '') as telefono,
      NULLIF(CC_FAX, '') as fax,
      NULLIF(CC_CIF, '') as cif,
      NULLIF(CC_EMA, '') as email,
      NULLIF(CC_WEB, '') as web,
      NULLIF(CC_PAIS, '') as pais
    FROM casas_com
    ${provincia ? 'WHERE LOWER(CC_PROV) LIKE LOWER(?)' : ''}
    ORDER BY CC_DENO
    ${limit ? 'LIMIT ?' : ''}`;
  
  try {
    const params = [];
    if (provincia) params.push(`%${provincia}%`);
    if (limit) params.push(limit);
    
    const [results] = await db.query(query, params);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryCasasComercialesTodas() {
  const query = `
    SELECT 
      id,
      NULLIF(CC_DENO, '') as denominacion,
      NULLIF(CC_POB, '') as poblacion,
      NULLIF(CC_PROV, '') as provincia
    FROM casas_com
    ORDER BY CC_DENO`;
  
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryCasasComercialConFiltros(options = {}) {
  const { provincia, codigoPostal, conTelefono, conEmail, conWeb } = options;
  
  let conditions = [];
  let params = [];
  
  if (provincia) {
    conditions.push('LOWER(CC_PROV) LIKE LOWER(?)');
    params.push(`%${provincia}%`);
  }
  
  if (codigoPostal) {
    conditions.push('CC_CDP = ?');
    params.push(codigoPostal);
  }
  
  if (conTelefono) {
    conditions.push('CC_TEL IS NOT NULL AND CC_TEL != ""');
  }
  
  if (conEmail) {
    conditions.push('CC_EMA IS NOT NULL AND CC_EMA != ""');
  }
  
  if (conWeb) {
    conditions.push('CC_WEB IS NOT NULL AND CC_WEB != ""');
  }
  
  const query = `
    SELECT 
      id,
      NULLIF(CC_DENO, '') as denominacion,
      NULLIF(CC_NOM, '') as nombre_comercial,
      NULLIF(CC_DOM, '') as domicilio,
      NULLIF(CC_POB, '') as poblacion,
      NULLIF(CC_PROV, '') as provincia,
      NULLIF(CC_CDP, '') as codigo_postal,
      NULLIF(CC_TEL, '') as telefono,
      NULLIF(CC_EMA, '') as email,
      NULLIF(CC_WEB, '') as web
    FROM casas_com
    ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
    ORDER BY CC_DENO
    ${options.limit ? 'LIMIT ?' : ''}`;
  
  if (options.limit) params.push(options.limit);
  
  try {
    const [results] = await db.query(query, params);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

// Función para procesar mensajes relacionados con casas comerciales
async function processCasasComercialesMessage(message) {
  const messageLower = message.toLowerCase();
  let dbData = null;
  let contextType = null;

  if (messageLower.includes('casa') && messageLower.includes('comercial')) {
    let options = {};
    
    // Detectar provincia
    const provinciaMatch = messageLower.match(/(?:en|de) ([a-zá-úñ]+)(?:\s|$)/i);
    if (provinciaMatch) {
      options.provincia = provinciaMatch[1];
    }
    
    // Detectar código postal
    const cpMatch = messageLower.match(/(?:postal|cp) (\d{5})/);
    if (cpMatch) {
      options.codigoPostal = cpMatch[1];
    }
    
    // Detectar filtros específicos
    if (messageLower.includes('teléfono') || messageLower.includes('telefono')) {
      options.conTelefono = true;
    }
    if (messageLower.includes('correo') || messageLower.includes('email')) {
      options.conEmail = true;
    }
    if (messageLower.includes('web') || messageLower.includes('página web')) {
      options.conWeb = true;
    }
    
    // Detectar límite
    const limitMatch = messageLower.match(/(?:muestra|dame|ver|lista|mostrar) (\d+)/);
    if (limitMatch) {
      options.limit = parseInt(limitMatch[1]);
    }
    
    if (Object.keys(options).length > 0) {
      dbData = await queryCasasComercialConFiltros(options);
      contextType = 'casas_comerciales_filtradas';
    } else {
      dbData = await queryCasasComercialesTodas();
      contextType = 'casas_comerciales_todas';
    }
  }

  return { dbData, contextType };
}

module.exports = {
  processCasasComercialesMessage,
  queryCasasComerciales,
  queryCasasComercialesTodas,
  queryCasasComercialConFiltros
}; 