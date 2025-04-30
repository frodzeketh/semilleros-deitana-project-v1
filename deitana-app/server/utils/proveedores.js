const db = require('../db');

// Funciones para consultas de proveedores
async function queryProveedoresPorProvincia(provincia, limit = 5) {
  const query = `
    SELECT 
      id,
      NULLIF(PR_DENO, '') as denominacion,
      NULLIF(PR_DOM, '') as domicilio,
      NULLIF(PR_POB, '') as poblacion,
      NULLIF(PR_PROV, '') as provincia,
      NULLIF(PR_CDP, '') as codigo_postal,
      NULLIF(PR_TEL, '') as telefono,
      NULLIF(PR_FAX, '') as fax,
      NULLIF(PR_CIF, '') as cif,
      NULLIF(PR_EMA, '') as email,
      NULLIF(PR_WEB, '') as web,
      NULLIF(PR_DOMEN, '') as domicilio_envio
    FROM proveedores
    WHERE LOWER(PR_PROV) LIKE LOWER(?)
    ORDER BY PR_DENO
    LIMIT ?`;
  
  try {
    const [results] = await db.query(query, [`%${provincia}%`, limit]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryProveedoresPorPoblacion(poblacion) {
  const query = `
    SELECT 
      id,
      NULLIF(PR_DENO, '') as denominacion,
      NULLIF(PR_DOM, '') as domicilio,
      NULLIF(PR_POB, '') as poblacion,
      NULLIF(PR_PROV, '') as provincia,
      NULLIF(PR_CDP, '') as codigo_postal,
      NULLIF(PR_TEL, '') as telefono,
      NULLIF(PR_FAX, '') as fax,
      NULLIF(PR_CIF, '') as cif,
      NULLIF(PR_EMA, '') as email,
      NULLIF(PR_WEB, '') as web
    FROM proveedores
    WHERE LOWER(PR_POB) LIKE LOWER(?)`;
  
  try {
    const [results] = await db.query(query, [`%${poblacion}%`]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryProveedorPorNombre(nombre) {
  const query = `
    SELECT 
      id,
      NULLIF(PR_DENO, '') as denominacion,
      NULLIF(PR_DOM, '') as domicilio,
      NULLIF(PR_POB, '') as poblacion,
      NULLIF(PR_PROV, '') as provincia,
      NULLIF(PR_CDP, '') as codigo_postal,
      NULLIF(PR_TEL, '') as telefono,
      NULLIF(PR_FAX, '') as fax,
      NULLIF(PR_CIF, '') as cif,
      NULLIF(PR_EMA, '') as email,
      NULLIF(PR_WEB, '') as web,
      NULLIF(PR_DOMEN, '') as domicilio_envio
    FROM proveedores
    WHERE LOWER(PR_DENO) LIKE LOWER(?)`;
  
  try {
    const [results] = await db.query(query, [`%${nombre}%`]);
    return results[0];
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryProveedorPorId(id) {
  const query = `
    SELECT 
      id,
      NULLIF(PR_DENO, '') as denominacion,
      NULLIF(PR_DOM, '') as domicilio,
      NULLIF(PR_POB, '') as poblacion,
      NULLIF(PR_PROV, '') as provincia,
      NULLIF(PR_CDP, '') as codigo_postal,
      NULLIF(PR_TEL, '') as telefono,
      NULLIF(PR_FAX, '') as fax,
      NULLIF(PR_CIF, '') as cif,
      NULLIF(PR_EMA, '') as email,
      NULLIF(PR_WEB, '') as web,
      NULLIF(PR_DOMEN, '') as domicilio_envio
    FROM proveedores
    WHERE id = ?`;
  
  try {
    const [results] = await db.query(query, [id]);
    return results[0];
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryProveedoresPorLetra(letra, limit = 10) {
  const query = `
    SELECT 
      id,
      NULLIF(PR_DENO, '') as denominacion,
      NULLIF(PR_POB, '') as poblacion,
      NULLIF(PR_PROV, '') as provincia
    FROM proveedores
    WHERE PR_DENO LIKE ?
    ORDER BY PR_DENO
    LIMIT ?`;
  
  try {
    const [results] = await db.query(query, [`${letra}%`, limit]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryProveedoresConWeb() {
  const query = `
    SELECT 
      id,
      NULLIF(PR_DENO, '') as denominacion,
      NULLIF(PR_EMA, '') as email,
      NULLIF(PR_WEB, '') as web
    FROM proveedores
    WHERE PR_WEB IS NOT NULL 
    AND PR_WEB != ''
    AND PR_EMA IS NOT NULL 
    AND PR_EMA != ''`;
  
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryProveedoresConTelefono(limit = 5) {
  const query = `
    SELECT 
      id,
      NULLIF(PR_DENO, '') as denominacion,
      NULLIF(PR_TEL, '') as telefono
    FROM proveedores
    WHERE PR_TEL IS NOT NULL 
    AND PR_TEL != ''
    ORDER BY PR_DENO
    LIMIT ?`;
  
  try {
    const [results] = await db.query(query, [limit]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryProveedoresPorTelefono(telefono) {
  const query = `
    SELECT 
      id,
      NULLIF(PR_DENO, '') as denominacion,
      NULLIF(PR_TEL, '') as telefono,
      NULLIF(PR_EMA, '') as email
    FROM proveedores
    WHERE PR_TEL LIKE ?`;
  
  try {
    const [results] = await db.query(query, [`%${telefono}%`]);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

async function queryProveedoresConFax() {
  const query = `
    SELECT 
      id,
      NULLIF(PR_DENO, '') as denominacion,
      NULLIF(PR_FAX, '') as fax
    FROM proveedores
    WHERE PR_FAX IS NOT NULL 
    AND PR_FAX != ''
    ORDER BY PR_DENO`;
  
  try {
    const [results] = await db.query(query);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', error);
    return null;
  }
}

// Función para procesar mensajes relacionados con proveedores
async function processProveedoresMessage(message) {
  const messageLower = message.toLowerCase();
  let dbData = null;
  let contextType = null;

  if (messageLower.includes('provincia')) {
    const provincia = messageLower.match(/provincia de ([a-zá-úñ\s]+)/i)?.[1];
    if (provincia) {
      dbData = await queryProveedoresPorProvincia(provincia);
      contextType = 'proveedores_provincia';
    }
  } else if (messageLower.includes('población') || messageLower.includes('poblacion')) {
    const poblacion = messageLower.match(/población de ([a-zá-úñ\s]+)/i)?.[1] || 
                     messageLower.match(/poblacion de ([a-zá-úñ\s]+)/i)?.[1];
    if (poblacion) {
      dbData = await queryProveedoresPorPoblacion(poblacion);
      contextType = 'proveedores_poblacion';
    }
  } else if (messageLower.includes('código') || messageLower.includes('codigo')) {
    const codigo = messageLower.match(/código (\d+)/i)?.[1] || 
                  messageLower.match(/codigo (\d+)/i)?.[1];
    if (codigo) {
      dbData = await queryProveedorPorId(codigo.padStart(5, '0'));
      contextType = 'proveedor_id';
    }
  } else if (messageLower.includes('empiecen con') || messageLower.includes('letra')) {
    const letra = messageLower.match(/letra ["']?([a-z])["']?/i)?.[1];
    if (letra) {
      dbData = await queryProveedoresPorLetra(letra);
      contextType = 'proveedores_letra';
    }
  } else if (messageLower.includes('web') || messageLower.includes('página web')) {
    dbData = await queryProveedoresConWeb();
    contextType = 'proveedores_web';
  } else if (messageLower.includes('teléfono') || messageLower.includes('telefono')) {
    if (messageLower.includes('número')) {
      const telefono = messageLower.match(/número[:\s]+([0-9\s]+)/i)?.[1];
      if (telefono) {
        dbData = await queryProveedoresPorTelefono(telefono.trim());
        contextType = 'proveedor_telefono';
      }
    } else {
      dbData = await queryProveedoresConTelefono();
      contextType = 'proveedores_con_telefono';
    }
  } else if (messageLower.includes('fax')) {
    dbData = await queryProveedoresConFax();
    contextType = 'proveedores_fax';
  } else if (messageLower.includes('información completa') || messageLower.includes('informacion completa')) {
    const nombre = messageLower.match(/["'](.*?)["']/)?.[1];
    if (nombre) {
      dbData = await queryProveedorPorNombre(nombre);
      contextType = 'proveedor_info_completa';
    }
  } else {
    dbData = await queryProveedoresConTelefono(5);
    contextType = 'proveedores_general';
  }

  return { dbData, contextType };
}

module.exports = {
  processProveedoresMessage,
  queryProveedoresPorProvincia,
  queryProveedoresPorPoblacion,
  queryProveedorPorNombre,
  queryProveedorPorId,
  queryProveedoresPorLetra,
  queryProveedoresConWeb,
  queryProveedoresConTelefono,
  queryProveedoresPorTelefono,
  queryProveedoresConFax
}; 