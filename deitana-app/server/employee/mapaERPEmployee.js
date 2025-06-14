const mapaERP = {
    clientes: {
        descripcion: "Gestiona la información de los clientes de Semilleros Deitana, incluyendo datos de contacto, ubicación y detalles comerciales.",
        tabla: "clientes",
        columnas: {
            id: "Código único que identifica a cada cliente",
            CL_DENO: "Nombre o denominación del cliente",
            CL_DOM: "Domicilio del cliente",
            CL_POB: "Población",
            CL_PROV: "Provincia",
            CL_CDP: "Código postal",
            CL_TEL: "Teléfono de contacto",
            CL_FAX: "Número de FAX",
            CL_CIF: "Código de Identificación Fiscal (CIF)",
            CL_EMA: "Correo electrónico",
            CL_WEB: "Página web",
            CL_PAIS: "País",
            CL_IBAN: "Número de cuenta bancaria en formato IBAN"
        }
    },

    articulos: {
        descripcion: "Catálogo completo de artículos, incluyendo plantas, semillas, injertos y otros productos disponibles en Semilleros Deitana.",
        tabla: "articulos",
        columnas: {
            id: "Código único que identifica cada artículo",
            AR_DENO: "Denominación o nombre del artículo",
            AR_REF: "Referencia o código interno del artículo",
            AR_STOK: "Stock actual del artículo",
            AR_PVP: "Precio de venta al público",
            AR_IVAP: "Porcentaje de IVA aplicable",
            AR_PRV: "Código del proveedor principal",
            AR_FAM: "Familia o categoría del artículo",
            AR_TIPO: "Tipo de artículo (planta, semilla, injerto, etc.)",
        }
    },

    bandejas: {
        descripcion: "Catálogo de bandejas, estas bandejas no las vendemos, se las compramos a un proveedor",
        tabla: "bandejas",
        columnas: {
            id: "Código único que identifica cada artículo",
            BN_DENO: "Denominación o nombre de bandeja",
            
        }
    },

    proveedores: {
        descripcion: "Gestiona la información de los proveedores de Semilleros Deitana, incluyendo datos de contacto y detalles comerciales.",
        tabla: "proveedores",
        columnas: {
            id: "Código único que identifica a cada proveedor",
            PR_DENO: "Nombre del proveedor",
            PR_DOM: "Domicilio del proveedor",
            PR_POB: "Población",
            PR_PROV: "Provincia",
            PR_CDP: "Código postal del proveedor",
            PR_TEL: "Número(s) de teléfono del proveedor",
            PR_FAX: "Número de FAX del proveedor",
            PR_CIF: "Código de Identificación Fiscal (CIF) del proveedor",
            PR_EMA: "Dirección de correo electrónico del proveedor",
            PR_WEB: "Dirección de la página web del proveedor",
            PR_DOMEN: "Domicilio o detalles para el envío de facturas",
            PR_PAIS: "País de residencia del proveedor",
            PR_FPG: "Forma de pago preferida del proveedor",
            PR_IBAN: "Número de cuenta bancaria en formato IBAN del proveedor"
        }
    }
};

module.exports = mapaERP; 