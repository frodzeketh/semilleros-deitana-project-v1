const mapaERP = {





    /* ================================================*/
    /* Archivos – Generales – Acciones Comerciales */
    /* ================================================*/
    acciones_com: {
        descripcion: "Registro de acciones comerciales realizadas con clientes",
        columnas: {
            id: "Identificador único de la acción comercial",
            ACCO_DENO: "Denominación o tipo de acción comercial",
            ACCO_CDCL: "Código del cliente",
            ACCO_CDVD: "Código del vendedor",
            ACCO_FEC: "Fecha de la acción",
            ACCO_HOR: "Hora de la acción"
        },
        relaciones: [
            {
                tablaDestino: "clientes",
                campoOrigen: "ACCO_CDCL",
                campoDestino: "id",
                tipo: "muchos-a-uno",
                uso: "Para obtener información detallada del cliente asociado a la acción comercial"
            },
            {
                tablaDestino: "vendedores",
                campoOrigen: "ACCO_CDVD",
                campoDestino: "id",
                tipo: "muchos-a-uno",
                uso: "Para conocer el vendedor responsable de la acción"
            },
            {
                tablaDestino: "acciones_com_acco_not",
                campoOrigen: "id",
                campoDestino: "id",
                tipo: "uno-a-muchos",
                uso: "Para obtener las observaciones asociadas a la acción comercial"
            }
        ],
        ejemplos: [
            {
                descripcion: "Obtener información completa de una acción comercial",
                query: "SELECT a.*, c.CL_DENO as cliente, v.VD_DENO as vendedor, o.C0 as observacion FROM acciones_com a LEFT JOIN clientes c ON a.ACCO_CDCL = c.id LEFT JOIN vendedores v ON a.ACCO_CDVD = v.id LEFT JOIN acciones_com_acco_not o ON a.id = o.id WHERE a.id = 1"
            }
        ]
    },

    acciones_com_acco_not: {
        descripcion: "Tabla que registra información detallada sobre observaciones, incidencias y feedback. Almacena notas asociadas a cada acción en acciones_com, divididas en filas según el id2.",
        tabla: "acciones_com_acco_not",
        columnas: {
            id: "Identificador de la acción comercial a la que se refiere la observación",
            id2: "Identificador secuencial de la parte del texto de la observación",
            C0: "Texto de la observación o nota"
        },
        ejemplos: {
            consulta_observaciones: "Para obtener todas las observaciones de una acción, se buscaría por el mismo id en diferentes id2",
            ejemplo_observacion: "Una observación puede estar dividida en múltiples registros, por ejemplo:\nid: '0000000293', id2: '1', C0: 'INCIDENCIA 348'\nid: '0000000293', id2: '2', C0: 'Salvador Garro llama a Antonio G...'\nid: '0000000293', id2: '3', C0: 'planta que no se puede poner...'"
        }
    },





/* ================================================*/
/* Archivos – Generales – Artículos */
/* ================================================*/
articulos: {
    descripcion: "La tabla 'articulos' en el ERP de Semilleros Deitana contiene el inventario completo de productos. Cada registro representa un artículo único, identificado por un código (id). Esta tabla almacena información esencial de cada artículo, incluyendo su descripción (AR_DENO), códigos de barras (AR_BAR), proveedor asignado (AR_PRV), clasificación por grupo y familia (AR_GRP, AR_FAM), precio (AR_PUD, AR_POP, AR_PST, AR_PVME), stock (AR_STOK), y otros datos relevantes como tipo de IVA (AR_TIVA) y estado (AR_EST).",
    tabla: "articulos",
    columnas: {
        id: "Código único del artículo",
        AR_DENO: "Denominación o descripción del artículo",
        AR_REF: "Referencia adicional del artículo (Sin información específica en el ejemplo)",
        AR_BAR: "Código de barras del artículo",
        AR_TIVA: "Tipo de IVA aplicado al artículo",
        AR_GRP: "Código del grupo al que pertenece el artículo",
        AR_FAM: "Código de la familia del artículo",
        AR_PRV: "Código del proveedor principal del artículo. Referencia al campo 'id' en la tabla 'proveedores'. Si está vacío, el proveedor no está cargado o se adquirió de otra forma.",
        AR_WEB: "Información adicional para la web",
        AR_DCG: "(Sin información específica)",
        AR_IVAP: "IVA aplicado al precio",
        AR_PGE: "% de germinación",
        // Nota: Los campos de precio (AR_PUD, AR_POP, AR_PST, AR_PVME) y stock (AR_STOK) mencionados en la descripción general no están detallados individualmente en la lista de campos proporcionada, pero se infiere su existencia.
    },
    relaciones: {
        proveedores: {
            tabla_relacionada: "proveedores",
            tipo: "Uno a muchos (un proveedor puede proveer muchos artículos)",
            campo_enlace_local: "AR_PRV",
            campo_enlace_externo: "id",
            descripcion: "Permite identificar qué proveedor principal suministra cada artículo. Si el campo 'AR_PRV' está vacío en un registro de artículo, significa que el proveedor principal no está registrado para ese artículo en este sistema."
        }
    },
    ejemplos: {
        consulta_proveedor: "Un artículo con id '00000042' y AR_DENO 'TOMATE RIO GRANDE( PERA RASTRERO)' tiene AR_PRV '00040'. Esto significa que el proveedor con id '00040' en la tabla 'proveedores' es el encargado de proveer este artículo.",
        consulta_grupo_familia: "Se puede filtrar o agrupar artículos por su código de grupo (AR_GRP) o familia (AR_FAM).",
        consulta_barra: "Buscar un artículo por su código de barras utilizando el campo AR_BAR."
    }
},














    /* ================================================*/
    /* Archivos – Generales – Clientes */
    /* ================================================*/
    clientes: {
        descripcion: "En Semilleros Deitana, la sección de 'Clientes' dentro del ERP centraliza la información detallada de nuestra cartera de clientes. Cada registro contiene datos esenciales como teléfono, domicilio, código postal, población, provincia, entre otros. Disponer de esta información de manera organizada es fundamental para la accesibilidad, la vinculación con otros registros del sistema y la gestión eficiente de la información relevante de cada cliente.",
        tabla: "clientes",
        columnas: {
            id: "Código único que identifica a cada cliente",
            CL_DENO: "Denominación o nombre completo del cliente",
            CL_DOM: "Domicilio del cliente",
            CL_POB: "Población del cliente",
            CL_PROV: "Provincia del cliente",
            CL_CDP: "Código postal del cliente",
            CL_TEL: "Número(s) de teléfono del cliente",
            CL_FAX: "Número de FAX del cliente",
            CL_CIF: "Código de Identificación",
            CL_EMA: "Dirección de correo electrónico del cliente",
            CL_WEB: "Dirección web del cliente",
            CL_PAIS: "País de residencia del cliente"
        },
        relaciones: {
            // Aquí se pueden añadir las relaciones con otras tablas cuando sea necesario
        },
        ejemplos: {
            consulta_pais: "Para obtener información de clientes residentes en España, se consultaría el campo CL_PAIS buscando el valor 'España'",
            consulta_poblacion: "Se puede filtrar por población (CL_POB) o provincia (CL_PROV)",
            consulta_completa: "Si se solicita la información completa de un cliente, se proporcionarán los datos cargados en los campos correspondientes (CL_DENO, CL_DOM, CL_POB, etc.)"
        }
    },














/* ================================================*/
/* Archivos – Generales – Proveedores */
/* ================================================*/
proveedores: {
    descripcion: "La tabla 'proveedores' dentro del sistema ERP centraliza la información detallada de todos los proveedores con los que opera Semilleros Deitana. Cada registro representa un proveedor único, identificado mediante un código (id). Esta tabla almacena datos cruciales que abarcan información fiscal, detalles de contacto, datos bancarios y aspectos administrativos, incluyendo domicilio, provincia, CIF, y registros de la última compra, entre otros. Disponer de esta información completa y organizada es esencial para la gestión eficiente de la cadena de suministro y las relaciones con los proveedores.",
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
        PR_DOMEN: "Domicilio o detalles para el envío de facturas"
        // Nota sobre campos vacíos: Si un campo no tiene información, se asume 'No hay información disponible'.
    },
    relaciones: {
        // Aquí se pueden añadir las relaciones con otras tablas cuando sea necesario (ej: con pedidos de compra, facturas recibidas)
    },
    ejemplos: {
        consulta_provincia: "Para encontrar proveedores ubicados en la provincia de 'Almeria', se consultaría la tabla proveedores filtrando por el campo PR_PROV con el valor 'ALMERIA'.",
        consulta_email: "Si se buscan proveedores con un correo electrónico registrado, se verificaría la existencia de un valor en el campo PR_EMA.",
        consulta_completa: "Al solicitar la información completa de un proveedor, se proporcionarían los datos cargados en los campos correspondientes (PR_DENO, PR_DOM, PR_POB, etc.)"
    }
},

















    
    /* ================================================*/
    /* Archivos – Generales – Vendedores/Usuarios */
    /* ================================================*/
    vendedores: {
        descripcion: "La sección 'Archivos – Generales – Vendedores/Usuarios' del sistema ERP de Semilleros Deitana constituye el repositorio centralizado para la gestión de la información de los usuarios internos que desempeñan funciones de venta o que simplemente tienen acceso al sistema como usuarios.",
        tabla: "vendedores",
        columnas: {
            id: "Código único que identifica a cada vendedor/usuario",
            VD_DENO: "Denominación o nombre completo del vendedor/usuario",
            VD_DOM: "Domicilio del vendedor/usuario",
            VD_POB: "Población de residencia",
            VD_PROV: "Provincia de residencia",
            VD_PDA: "Número técnico asociado (clave foránea a tabla tecnicos)"
        },
        ejemplos: {
            consulta_nombre: "Para buscar un vendedor por nombre, se consultaría el campo VD_DENO",
            consulta_ubicacion: "Se puede filtrar por población (VD_POB) o provincia (VD_PROV)",
            consulta_completa: "Si se solicita la información completa de un vendedor, se proporcionarán los datos cargados en los campos correspondientes (VD_DENO, VD_DOM, VD_POB, etc.)"
        }
    },

    tecnicos: {
        descripcion: "Tabla que almacena información más exhaustiva y detallada para aquellos usuarios que, además de su rol como vendedores o usuarios generales, también cumplen funciones técnicas.",
        tabla: "tecnicos",
        columnas: {
            id: "Código único identificador del técnico",
            TN_TEL: "Teléfono de contacto",
            TN_EMA: "Email de contacto",
            TN_DOM: "Domicilio completo",
            TN_POB: "Población",
            TN_PROV: "Provincia",
            TN_CIF: "Código de Identificación Fiscal"
        }
    },

    vendedores_vd_obs: {
        descripcion: "Tabla destinada exclusivamente a la documentación y almacenamiento de observaciones, notas o comentarios adicionales asociados a un vendedor o usuario particular.",
        tabla: "vendedores_vd_obs",
        columnas: {
            id_vendedor: "Código del vendedor al que se refiere la observación",
            observacion: "Texto de la observación o nota",
            fecha: "Fecha de registro de la observación"
        }
    }
};

module.exports = { mapaERP };