const db = require('../db');

// Funciones para consultas de clientes
async function queryClientesPorPais(pais, limit = 5) {
  const query = `
    SELECT 
      id,
      NULLIF(CL_DENO, '') as nombre,
      NULLIF(CL_DOM, '') as domicilio,
      NULLIF(CL_POB, '') as poblacion,
      NULLIF(CL_PROV, '') as provincia,
      NULLIF(CL_CDP, '') as codigo_postal,
      NULLIF(CL_TEL, '') as telefono,
      NULLIF(CL_FAX, '') as fax,
      NULLIF(CL_CIF, '') as cif,
      NULLIF(CL_EMA, '') as email,
      NULLIF(CL_WEB, '') as web,
      NULLIF(CL_PAIS, '') as pais
    FROM clientes
    WHERE LOWER(CL_PAIS) LIKE LOWER(?)
    ORDER BY CL_DENO
    LIMIT ?`;
  
  try {
    const [results] = await db.query(query, [`%${pais}%`, limit]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryClientesPorProvincia(provincia) {
  const query = `
    SELECT 
      COUNT(*) as total_clientes,
      NULLIF(CL_PROV, '') as provincia
    FROM clientes
    WHERE LOWER(CL_PROV) LIKE LOWER(?)
    GROUP BY CL_PROV`;
  
  try {
    const [results] = await db.query(query, [`%${provincia}%`]);
    return results[0];
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryClientesPorPoblacion(poblacion, limit = 3) {
  const query = `
    SELECT 
      id,
      NULLIF(CL_DENO, '') as nombre,
      NULLIF(CL_DOM, '') as domicilio,
      NULLIF(CL_POB, '') as poblacion,
      NULLIF(CL_PROV, '') as provincia,
      NULLIF(CL_CDP, '') as codigo_postal,
      NULLIF(CL_TEL, '') as telefono,
      NULLIF(CL_FAX, '') as fax,
      NULLIF(CL_CIF, '') as cif,
      NULLIF(CL_EMA, '') as email,
      NULLIF(CL_WEB, '') as web,
      NULLIF(CL_PAIS, '') as pais
    FROM clientes
    WHERE LOWER(CL_POB) LIKE LOWER(?)
    ORDER BY CL_DENO
    LIMIT ?`;
  
  try {
    const [results] = await db.query(query, [`%${poblacion}%`, limit]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryClientePorNombre(nombre) {
  const query = `
    SELECT 
      id,
      NULLIF(CL_DENO, '') as nombre,
      NULLIF(CL_DOM, '') as domicilio,
      NULLIF(CL_POB, '') as poblacion,
      NULLIF(CL_PROV, '') as provincia,
      NULLIF(CL_CDP, '') as codigo_postal,
      NULLIF(CL_TEL, '') as telefono,
      NULLIF(CL_FAX, '') as fax,
      NULLIF(CL_CIF, '') as cif,
      NULLIF(CL_EMA, '') as email,
      NULLIF(CL_WEB, '') as web,
      NULLIF(CL_PAIS, '') as pais
    FROM clientes
    WHERE LOWER(CL_DENO) LIKE LOWER(?)`;
  
  try {
    const [results] = await db.query(query, [`%${nombre}%`]);
    return results[0];
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryClientePorCIF(cif) {
  const query = `
    SELECT 
      id,
      NULLIF(CL_DENO, '') as nombre,
      NULLIF(CL_DOM, '') as domicilio,
      NULLIF(CL_POB, '') as poblacion,
      NULLIF(CL_PROV, '') as provincia,
      NULLIF(CL_CDP, '') as codigo_postal,
      NULLIF(CL_TEL, '') as telefono,
      NULLIF(CL_FAX, '') as fax,
      NULLIF(CL_CIF, '') as cif,
      NULLIF(CL_EMA, '') as email,
      NULLIF(CL_WEB, '') as web,
      NULLIF(CL_PAIS, '') as pais
    FROM clientes
    WHERE CL_CIF = ?`;
  
  try {
    const [results] = await db.query(query, [cif]);
    return results[0];
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryClientesOrdenados(limit = 10) {
  const query = `
    SELECT 
      id,
      NULLIF(CL_DENO, '') as nombre,
      NULLIF(CL_DOM, '') as domicilio,
      NULLIF(CL_POB, '') as poblacion,
      NULLIF(CL_PROV, '') as provincia,
      NULLIF(CL_CDP, '') as codigo_postal,
      NULLIF(CL_TEL, '') as telefono,
      NULLIF(CL_FAX, '') as fax,
      NULLIF(CL_CIF, '') as cif,
      NULLIF(CL_EMA, '') as email,
      NULLIF(CL_WEB, '') as web,
      NULLIF(CL_PAIS, '') as pais
    FROM clientes
    ORDER BY CL_DENO
    LIMIT ?`;
  
  try {
    const [results] = await db.query(query, [limit]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

// Función para procesar mensajes relacionados con clientes
async function processClientesMessage(message) {
  const messageLower = message.toLowerCase();
  let dbData = null;
  let contextType = null;

  if (messageLower.includes('provincia')) {
    const provincia = messageLower.match(/provincia de ([a-zá-úñ\s]+)/i)?.[1];
    if (provincia) {
      dbData = await queryClientesPorProvincia(provincia);
      contextType = 'clientes_provincia';
    }
  } else if (messageLower.includes('población') || messageLower.includes('poblacion')) {
    const poblacion = messageLower.match(/población de ([a-zá-úñ\s]+)/i)?.[1] || 
                     messageLower.match(/poblacion de ([a-zá-úñ\s]+)/i)?.[1];
    if (poblacion) {
      dbData = await queryClientesPorPoblacion(poblacion);
      contextType = 'clientes_poblacion';
    }
  } else if (messageLower.includes('cif')) {
    const cif = messageLower.match(/cif ([a-z0-9]+)/i)?.[1];
    if (cif) {
      dbData = await queryClientePorCIF(cif);
      contextType = 'cliente_cif';
    }
  } else if (messageLower.includes('ordenados')) {
    dbData = await queryClientesOrdenados();
    contextType = 'clientes_ordenados';
  } else if (messageLower.includes('españa') || messageLower.includes('espana')) {
    dbData = await queryClientesPorPais('ESPAÑA');
    contextType = 'clientes_pais';
  } else if (messageLower.includes('información de') || messageLower.includes('informacion de')) {
    const nombre = messageLower.match(/información de "(.*?)"/i)?.[1] || 
                  messageLower.match(/informacion de "(.*?)"/i)?.[1];
    if (nombre) {
      dbData = await queryClientePorNombre(nombre);
      contextType = 'cliente_nombre';
    } else {
      dbData = await queryClientesOrdenados(5);
      contextType = 'clientes_info';
    }
  } else {
    dbData = await queryClientesOrdenados(5);
    contextType = 'clientes_general';
  }

  return { dbData, contextType };
}

module.exports = {
  processClientesMessage,
  queryClientesPorPais,
  queryClientesPorProvincia,
  queryClientesPorPoblacion,
  queryClientePorNombre,
  queryClientePorCIF,
  queryClientesOrdenados
}; 