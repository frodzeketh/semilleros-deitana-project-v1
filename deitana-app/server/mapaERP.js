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
/* Archivos – Generales – Nuestros bancos */
/* ================================================*/
bancos: { // Usamos el nombre de la tabla principal, que es la misma
    descripcion: "Gestión centralizada de información de las entidades bancarias con las que opera Semilleros Deitana ('Nuestros bancos'). Sirve para la correcta ejecución de operaciones financieras, pagos y cobros.",
    tabla: "bancos",
    columnas: {
        id: "Código único del banco (Clave Primaria)",
        BA_DENO: "Denominación o nombre del banco",
        BA_DOM: "Domicilio del banco",
        BA_POB: "Población del banco",
        BA_PROV: "Provincia del banco",
        BA_CDP: "Código postal del banco",
        BA_TEL: "Número(s) de teléfono del banco",
        BA_FAX: "Número de FAX del banco",
        BA_EMA: "Dirección de correo electrónico del banco",
        BA_IBAN: "Número de cuenta bancaria en formato IBAN",
        BA_COD: "Código de la entidad bancaria",
        BA_OFI: "Código de la oficina bancaria",
        BA_DCD: "Dígito(s) de control de la cuenta",
        BA_CUEN: "Número de cuenta bancaria tradicional",
        BA_SWI: "Código SWIFT/BIC",
        BA_RIES: "Nivel de riesgo interno",
        BA_TIPO: "Tipo de banco (clasificación interna)",
        BA_OBS: "Observaciones o comentarios internos"
        // Nota: También se pueden registrar Contactos bancarios (Contacto, Cargo, Teléfono, Email) asociados a cada entidad, aunque no están detallados como campos directos aquí.
    },
    relaciones: {
        // No se especifican relaciones explícitas con otras tablas en el texto proporcionado.
    },
    ejemplos: {
        consulta_filtrada: "Buscar bancos por denominación (BA_DENO), código postal (BA_CDP) o código SWIFT (BA_SWI).",
        consulta_completa: "Obtener todos los datos cargados (BA_DENO, BA_DOM, BA_IBAN, BA_SWI, etc.) de un banco específico. Si un campo no tiene información, se indicará (ej: 'Código SWIFT: No hay información disponible').",
        consulta_contactos: "Consultar la información de los contactos bancarios asociados a una entidad (Contacto, Cargo, Teléfono, Email)."
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
    },










    /* ================================================*/
/* Archivos – Auxiliares – Bandejas */
/* ================================================*/
bandejas: {
    descripcion: "La tabla 'bandejas' dentro del sistema ERP contiene un listado exhaustivo y detallado de las características técnicas y económicas asociadas a los diferentes tipos de bandejas (ya sean físicas, reutilizables o desechables) que se emplean en los procesos de siembra y cultivo en alvéolos. Es importante notar que esta sección también puede incluir información relativa a macetas u otros contenedores utilizados en estos procesos.",
    tabla: "bandejas",
    columnas: {
        id: "Identificador único asignado a cada bandeja.", // Clave Primaria
        BN_DENO: "Nombre descriptivo que identifica la bandeja",
        BN_ALV: "Número total de alvéolos",
        BN_RET: "Reutilizable",
        BN_PVP: "Precio de venta de la bandeja",
        BN_COS: "Coste",
        BN_IVA1: "Información IVA 1",
        BN_IVA2: "Información IVA 2",
        BN_ART: "Identificador",
        BN_ALVC: "Número de alvéolos.",
        BN_EM2: "Especifica los metros cuadrados que ocupa la bandeja",
        BN_ALVG: "Número de alvéolos considerados",
    },
    relaciones: {
        // Se menciona una posible relación con 'articulos' a través del campo BN_ART, pero no se proporcionan detalles suficientes para estructurarla aquí.
    },
    ejemplos: {
        // El texto proporcionado no incluye ejemplos de consultas o uso específicos de la tabla 'bandejas'.
        // Los ejemplos dados son valores de ejemplo para campos específicos.
    }
},






/* ================================================*/
/* Archivos – Auxiliares – Casas comerciales */
/* ================================================*/
casas_com: { // Usamos el nombre de la tabla como clave principal
    descripcion: "Gestión y almacenamiento de información de las casas comerciales con las que Semilleros Deitana interactúa. Es fundamental para mantener un registro organizado de socios comerciales y sus datos clave.",
    tabla: "casas_com",
    columnas: {
        id: "Identificador único de la casa comercial (Clave Primaria)",
        CC_DENO: "Denominación social legal",
        CC_NOM: "Nombre comercial",
        CC_DOM: "Domicilio físico",
        CC_POB: "Población",
        CC_PROV: "Provincia",
        CC_CDP: "Código Postal",
        CC_TEL: "Número de teléfono",
        CC_FAX: "Número de fax",
        CC_CIF: "Código de Identificación Fiscal (CIF)",
        CC_EMA: "Dirección de correo electrónico",
        CC_WEB: "Dirección del sitio web",
        CC_PAIS: "País de ubicación",
        CC_DFEC: "Fecha de inicio de validez de tarifa",
        CC_HFEC: "Fecha de fin de validez de tarifa"
        // Nota sobre datos: La completitud de CC_DOM, CC_TEL, CC_FAX, CC_CIF, CC_EMA, CC_WEB, CC_DFEC, CC_HFEC puede variar (pueden ser NULL o vacíos).
    },
    relaciones: {
        // No se especifican relaciones explícitas con otras tablas en el texto proporcionado.
    },
    ejemplos: {
        // El texto proporcionado no incluye ejemplos de consultas o uso específicos de la tabla 'casas_comerciales'.
        // Se menciona la variabilidad de los datos en ciertos campos.
    }
},







/* ================================================*/
/* Archivos – Auxiliares – Categorias */
/* ================================================*/
categorias: {
    descripcion: "Define las categorías laborales utilizadas en Semilleros Deitana para establecer condiciones contractuales y económicas de los trabajadores (salario, horarios, costes). No son categorías de producto.",
    tabla: "categorias",
    columnas: {
        id: "Identificador único de la categoría laboral (Clave Primaria)",
        CG_DENO: "Nombre o denominación de la categoría laboral (Ej: PRODUCCION, ENCARGADO)",
        CG_SALDIA: "Salario diario base para esta categoría (Tipo: DECIMAL)",
        CG_COSHOR: "Coste calculado por hora de trabajo normal (Tipo: DECIMAL)",
        CG_SDIA: "Coste calculado por hora extra (Tipo: DECIMAL). Nota: Aunque el nombre sugiere 'Salario Día', representa el coste por hora extra según la descripción."
    },
    relaciones: {
        // No se especifican relaciones explícitas con otras tablas en el texto proporcionado (ej: con empleados).
    },
    ejemplos: {
        // El texto proporcionado no incluye ejemplos de consultas o uso específicos de la tabla 'categorias'.
        // Los ejemplos dados son valores de ejemplo para campos específicos.
    }
},






/* ================================================*/
/* Archivos – Auxiliares – Créditos caución */
/* ================================================*/
creditocau: {
    descripcion: "Gestión y seguimiento de seguros de crédito (créditos caución) asociados a clientes para proteger frente al riesgo de impago. Permite registrar y consultar pólizas o acuerdos de seguro de crédito específicos.",
    tabla: "creditocau",
    columnas: {
        id: "Identificador único del crédito caución (Clave Primaria)",
        CAU_CCL: "Código del cliente asociado. Clave foránea a la tabla 'clientes'.",
        CAU_DIAS: "Número máximo de días de crédito permitidos (Tipo: INT).",
        CAU_TIPO: "Tipo de crédito caución ('N': No asegurado, 'A': Asegurado)."
    },
    relaciones: {
        clientes: {
            tabla_relacionada: "clientes",
            tipo: "Muchos a uno (varios créditos caución para un cliente)",
            campo_enlace_local: "CAU_CCL",
            campo_enlace_externo: "id",
            descripcion: "Vincula el crédito caución con la información detallada del cliente correspondiente."
        },
        creditocau_cau_obs: {
            tabla_relacionada: "creditocau_cau_obs",
            tipo: "Uno a muchos (un crédito caución puede tener varias observaciones)",
            campo_enlace_local: "id", // El id del crédito caución
            campo_enlace_externo: "id", // El campo id en creditocau_cau_obs que referencia al crédito caución
            descripcion: "Almacena observaciones o seguimientos. Las observaciones completas para un crédito caución se reconstruyen concatenando el campo 'C0' de los registros vinculados por 'id'."
        }
    },
    ejemplos: {
        consulta_cliente: "Para obtener información del cliente asociado a un crédito caución, usar el campo CAU_CCL del registro creditocau para consultar la tabla 'clientes' por su 'id'.",
        consulta_observaciones: "Para ver las observaciones de un crédito caución, consultar la tabla 'creditocau_cau_obs' usando el 'id' del crédito caución y concatenar el contenido del campo 'C0' de los resultados.",
        consulta_tipo_dias: "Se puede filtrar o consultar créditos caución por el número de días (CAU_DIAS) o el tipo de cobertura (CAU_TIPO)."
    }
},







/* ================================================*/
/* Archivos – Auxiliares – Dispositivos móviles */
/* ================================================*/
dispositivos: {
    descripcion: "Gestión centralizada de dispositivos móviles (PDAs u otros terminales portátiles) utilizados en Semilleros Deitana. Mantiene un registro detallado con datos técnicos y administrativos para control y seguimiento.",
    tabla: "dispositivos",
    columnas: {
        id: "Código único del dispositivo móvil (Clave Primaria)",
        DIS_DENO: "Denominación o nombre descriptivo del dispositivo",
        DIS_MARCA: "Marca comercial del dispositivo",
        DIS_MOD: "Modelo técnico del dispositivo",
        DIS_FCOM: "Fecha de adquisición (Puede ser NULL)",
        DIS_MAC: "Dirección MAC del dispositivo",
        DIS_IP: "Dirección IP asignada al dispositivo",
        DIS_KEY: "Clave o identificador de seguridad",
        DIS_BAJA: "Estado operativo (0: Activo, 1: Dado de baja)"
    },
    relaciones: {
        dispositivos_dis_obs: {
            tabla_relacionada: "dispositivos_dis_obs",
            tipo: "Uno a muchos (un dispositivo puede tener varias observaciones)",
            campo_enlace_local: "id", // El id del dispositivo
            campo_enlace_externo: "id", // El campo id en dispositivos_dis_obs que referencia al dispositivo
            descripcion: "Almacena observaciones o comentarios complementarios. Las observaciones completas para un dispositivo se reconstruyen concatenando el campo 'C0' de los registros vinculados por 'id', posiblemente ordenados por 'id2'."
        }
    },
    ejemplos: {
        consulta_basica: "Obtener información principal de un dispositivo directamente de la tabla 'dispositivos' usando su 'id'.",
        consulta_observaciones: "Para ver las observaciones de un dispositivo, consultar 'dispositivos_dis_obs' usando el 'id' del dispositivo. Concatenar 'C0' de las filas resultantes. Nota: No todos los dispositivos pueden tener observaciones.",
        consulta_estado: "Filtrar dispositivos por su estado operativo (DIS_BAJA)."
    }
},







/* ================================================*/
/* Archivos – Auxiliares – Envases de venta */
/* ================================================*/
envases_vta: {
    descripcion: "Cataloga los diferentes tipos de envases y formatos utilizados para la comercialización de semillas y productos, detallando características físicas y comerciales.",
    tabla: "envases_vta",
    columnas: {
        id: "Identificador único del envase de venta (Clave Primaria)",
        EV_DENO: "Denominación o nombre del envase (Ej: Sobre pequeño, Bolsa 1 Kg)",
        EV_NEM: "Unidad de medida del envase (Ej: UD, SB, L, KG)",
        EV_CANT: "Cantidad total contenida en el envase",
        EV_UDSS: "Número de unidades por presentación o sobre, si aplica"
    },
    relaciones: {
        // No se especifican relaciones explícitas con otras tablas en el texto proporcionado (ej: con artículos).
    },
    ejemplos: {
        consulta_denominacion: "Buscar envases por su denominación (EV_DENO).",
        consulta_contenido: "Consultar la cantidad total (EV_CANT) y la unidad de medida (EV_NEM) de un envase.",
        consulta_presentacion: "Obtener el número de unidades por presentación (EV_UDSS) si aplica para un envase específico."
    }
},








/* ================================================*/
/* Archivos - Auxiliares - Invernaderos */
/* ================================================*/
invernaderos: {
    descripcion: "Contiene la información base de las estructuras físicas de invernaderos, utilizadas para siembra y cultivo. Incluye identificación, vinculación a almacenes, secciones y filas. Nota: Existen otras tablas relacionadas (secciones, filas, tratamientos) no detalladas aquí.",
    tabla: "invernaderos",
    columnas: {
        id: "Identificador único del invernadero (Clave Primaria)",
        INV_DENO: "Denominación o nombre completo del invernadero (Ej: A4 Pg.28-Parcela.1000)",
        INV_ALM: "Código del almacén asociado o vinculado a este invernadero.", // Clave foránea a la tabla 'almacenes'
        INV_NSECI: "Número de secciones inicial o de referencia",
        INV_NSEC: "Número total de secciones",
        INV_NFIL: "Número total de filas"
    },
    relaciones: {
        almacenes: {
            tabla_relacionada: "almacenes",
            tipo: "Muchos a uno (varios invernaderos pueden estar en un almacén)", // Inferred type
            campo_enlace_local: "INV_ALM",
            campo_enlace_externo: "id",
            descripcion: "Vincula el invernadero con el almacén asociado. La tabla 'almacenes' tiene campos como 'id' (código del almacén) y 'AM_DENO' (nombre del almacén)."
        }
        // Otras relaciones con secciones, filas, tratamientos, etc., existen pero no están detalladas.
    },
    ejemplos: {
        consulta_almacen_asociado: "Para obtener el nombre del almacén asociado a un invernadero, usar el campo INV_ALM del invernadero para consultar el campo 'id' en la tabla 'almacenes' y obtener su AM_DENO.",
        consulta_basica: "Obtener la identificación (id, INV_DENO), número de secciones (INV_NSEC) o filas (INV_NFIL) de un invernadero específico."
    }
},




/* ================================================*/
/* Archivos - Auxiliares - Motivos */
/* ================================================*/
motivos: {
    descripcion: "Catálogo estandarizado de causas o razones predefinidas utilizadas para documentar y clasificar eventos, acciones o situaciones internas (Ej: plagas, descartes, incidencias).",
    tabla: "motivos",
    columnas: {
        id: "Código único del motivo (Clave Primaria)",
        MOT_DENO: "Denominación o descripción del motivo (Ej: PLAGA, DESCARTE)"
    },
    relaciones: {
        // No se especifican relaciones explícitas en el texto, pero esta tabla es likely referenciada por otras tablas de eventos o incidencias.
    },
    ejemplos: {
        listar_motivos: "Obtener el listado de motivos, combinando el código (id) y la descripción (MOT_DENO) para presentación (Ej: '0001 - PLAGA').",
        clasificar_evento: "Utilizar el 'id' o 'MOT_DENO' de esta tabla para clasificar un evento registrado en otro lugar del sistema."
    }
},





/* ================================================*/
/* Archivos - Auxiliares - Paises */
/* ================================================*/
paises: {
    descripcion: "Catálogo maestro de referencia con el listado de países relevantes para la actividad comercial y productiva de la empresa (origen/destino productos, ubicación clientes/proveedores). Diseñada para servir como soporte a otras tablas.",
    tabla: "paises",
    columnas: {
        id: "Código único del país (Clave Primaria)",
        PA_DENO: "Denominación o nombre completo del país (Ej: FRANCIA, ESPAÑA)"
    },
    relaciones: {
        // No se especifican relaciones explícitas documentadas que referencien a 'paises' desde otras tablas en este contexto.
        // Sin embargo, se infieren relaciones potenciales (donde 'paises.id' sería clave foránea en otras tablas) con:
        // clientes: Para país de residencia o ubicación.
        // proveedores: Para país de origen o sede.
        // Registros de producción/exportación: Para país de destino de productos.
        // Información de semillas/variedades: Para país de origen o procedencia.
    },
    ejemplos: {
        listar_paises: "Obtener el listado de todos los países registrados (id y PA_DENO).",
        // Ejemplos de uso potencial en combinación con otras tablas (si las relaciones se confirman):
        // consultar_clientes_por_pais: "Encontrar clientes ubicados en un país específico (requiere relación con tabla 'clientes').",
        // consultar_proveedores_por_pais: "Listar proveedores de un país determinado (requiere relación con tabla 'proveedores')."
    }
},




/* ================================================*/
/* Archivos - Auxiliares - Procesos */
/* ================================================*/
procesos: {
    descripcion: "Define las etapas o procedimientos del ciclo productivo agrícola (semillero), como germinación o trasplante. Contiene campos que controlan la lógica interna del ERP para estas etapas.",
    tabla: "procesos",
    columnas: {
        id: "Código único del proceso (Clave Primaria)",
        PRO_DENO: "Denominación o nombre del proceso (Ej: GERMINACIÓN)",
        PRO_MGER: "¿Modifica germinación? ('S' o '')",
        PRO_MBAN: "¿Modifica bandejas? ('S' o '')",
        PRO_MSOP: "¿Modifica soporte? ('S' o '')",
        PRO_CDIF: "¿Calcular por diferencia? ('S' o '')",
        PRO_NOUBI: "¿Permitir sin ubicación? ('S' o '')",
        PRO_NEM: "Nemotécnico (abreviatura del proceso)",
        PRO_SEMB: "¿Es parte del proceso de siembra?",
        PRO_IDIAS: "Porcentaje o cantidad de días estimados de siembra",
        PRO_OBS: "Campo OBSOLETO para observaciones. Las observaciones se almacenan en una tabla separada (procesos_pro_obs).",
        // Otros campos internos no detallados...
    },
    relaciones: {
        procesos_pro_obs: {
            tabla_relacionada: "procesos_pro_obs",
            tipo: "Uno a muchos (un proceso puede tener varias observaciones)",
            campo_enlace_local: "id", // El id del proceso
            campo_enlace_externo: "id", // El campo id en procesos_pro_obs que referencia al proceso
            descripcion: "Almacena observaciones adicionales para los procesos. Las observaciones completas se reconstruyen concatenando el campo 'C0' de las filas vinculadas por 'id', ordenadas por 'id2'.",
            estructura_relacionada: { // Estructura de la tabla relacionada para referencia
                 id: "ID del proceso asociado",
                 id2: "Línea u orden de la observación",
                 C0: "Texto de la observación"
            }
        }
        // Relaciones potenciales inferidas de la interfaz (pestañas como General, Ornamental, Producción, Consumos, Incremento de días).
        // Es probable que existan relaciones con tablas de producción (produccion_*), consumos (consumos_*), tratamientos (p-tratamientos), siembras (p-siembras), inventario o invernaderos.
    },
    ejemplos: {
        consulta_procesos: "Listar todos los procesos registrados (id, PRO_DENO, etc.).",
        consulta_procesos_por_logica: "Filtrar procesos por su configuración (Ej: ¿Modifican bandejas? PRO_MBAN = 'S', ¿Permiten sin ubicación? PRO_NOUBI = 'S').",
        consulta_observaciones: "Buscar observaciones para un proceso específico usando su 'id' en la tabla 'procesos_pro_obs' y reconstruir el texto completo desde el campo 'C0'. Nota: No todos los procesos tienen observaciones.",
        consulta_siembra: "Identificar procesos que son parte de la siembra (PRO_SEMB)."
    }
},










/* ================================================*/
/* Archivos – Auxiliares – Productos Fitosanitarios */
/* ================================================*/
productos_fitosanitarios: {
    descripcion: "Gestión y registro detallado de productos fitosanitarios para tratamientos agronómicos (prevención, control de plagas/enfermedades). Centraliza información técnica y de uso para aplicación segura y trazabilidad.",
    tabla: "tipo_trat",
    columnas: {
        id: "Identificador único del producto fitosanitario (Clave Primaria)",
        TTR_NOM: "Nombre comercial del producto (Ej: PREVICUR ENERGY)",
        TTR_DOS: "Dosis estándar o recomendada (Ej: 0,2-0,3 %)",
        TTR_FOR: "Fórmula o principio(s) activo(s)",
        TTR_ENS: "Campo auxiliar (Información incierta, puede estar vacío)", // Nota sobre validación/significado
        TTR_ECO: "Indica si es ecológico ('S'/'N')",
        TTR_BIO: "Indica si es de origen biológico ('S'/'N')",
        TTR_ESPE: "Especies vegetales autorizadas o recomendadas (Ej: CALABACÍN - MELÓN)",
        TTR_AGN: "Agentes nocivos que combate (Ej: FITOPHTHORA - PITIUM)",
        TTR_INT: "Enlace web (ficha técnica, registro, etc.)",
        TTR_REG: "Número de registro oficial",
        TTR_FCAD: "Fecha de caducidad"
    },
    relaciones: {
        // No se especifican relaciones explícitas con otras tablas en el texto proporcionado (ej: con tratamientos aplicados).
    },
    ejemplos: {
        consulta_producto_por_nombre_id: "Buscar un producto fitosanitario por su id o TTR_NOM para obtener sus detalles técnicos y de uso.",
        listar_productos_por_tipo: "Filtrar productos fitosanitarios que son ecológicos (TTR_ECO='S') o biológicos (TTR_BIO='S').",
        consultar_aplicabilidad: "Verificar las especies (TTR_ESPE) o agentes (TTR_AGN) para los que un producto está autorizado."
    }
},






/* ================================================*/
/* Archivos – Auxiliares – Sección Tareas */
/* ================================================*/
tareas_seccion: {
    descripcion: "Catálogo de categorías o tipos de tareas operativas y administrativas (injertos, siembra, riegos, limpieza, etc.). Fundamental para clasificar y cuantificar mano de obra y actividades en partes de trabajo y reportes.",
    tabla: "tareas_seccion",
    columnas: {
        id: "Identificador único de la sección de tarea (Clave Primaria, también TARS_COD)",
        TARS_DENO: "Denominación o nombre de la sección de tarea (Ej: INJERTOS HACER, SIEMBRA)",
        TARS_UNDM: "Unidad de medida asociada a la tarea (Ej: 'Planta', 'Bandeja', o vacío para tareas sin unidad productiva). Indica cómo se cuantifica la tarea."
    },
    relaciones: {
        // No se especifican relaciones explícitas en el texto, pero esta tabla es referenciada por tablas que registran actividades o partes de trabajo.
    },
    ejemplos: {
        consulta_seccion: "Buscar una sección de tarea por su id o TARS_DENO para obtener su unidad de medida (TARS_UNDM).",
        clasificacion_actividad: "Utilizar el id o TARS_DENO de esta tabla para clasificar una actividad registrada (ej: en un parte de trabajo).",
        consulta_unidad_medida: "Identificar la unidad de medida (TARS_UNDM) usada para cuantificar una tarea específica, como 'Bandeja' para 'SIEMBRA'."
    }
},





/* ================================================*/
/* Archivos – Auxiliares – Sectores y Subsectores */
/* ================================================*/
sectores: {
    descripcion: "Define clasificaciones comerciales o de origen para pedidos y clientes (canales de venta, áreas de negocio). Crucial para análisis comercial, segmentación y seguimiento por canal. Nota: Aunque la gestión directa no siempre es visible en el entorno de prueba, los datos existen y se usan para clasificación.",
    tabla: "sectores",
    columnas: {
        id: "Código único del sector o subsector (Clave Primaria)",
        SC_DENO: "Nombre o denominación del sector o subsector (Ej: SIN ASIGNAR, TIENDA, INTERNET, PROFESIONAL)"
    },
    relaciones: {
        // No se especifican relaciones explícitas documentadas que referencien a 'sectores' desde otras tablas en este contexto.
        // Se infiere que esta tabla es utilizada como clave foránea en tablas como 'clientes' y 'pedidos' para clasificar registros.
    },
    ejemplos: {
        listar_sectores: "Obtener el listado de todos los sectores/subsectores registrados (id y SC_DENO).",
        clasificar_registro: "Utilizar el id o SC_DENO de esta tabla para clasificar clientes, pedidos u otras transacciones.",
        // Ejemplos de uso potencial en combinación con otras tablas (si las relaciones se confirman):
        // analisis_por_sector: "Agrupar y analizar pedidos o clientes según su sector asignado (requiere relación con tablas correspondientes)."
    }
},





/* ================================================*/
/* Archivos – Auxiliares – Sustratos */
/* ================================================*/
sustratos: {
    descripcion: "Gestión y registro de materiales o mezclas utilizados como medio de cultivo. Esencial para control de costes, precios y planificación de materiales en la producción.",
    tabla: "sustratos",
    columnas: {
        id: "Código único del sustrato (Clave Primaria, también SUS_COD)",
        SUS_DENO: "Denominación o nombre descriptivo del sustrato (Ej: PERLITA PELIGRAM, SUST.ESPECIAL)",
        SUS_PVP: "Precio de venta al público por alveolo (Tipo: DECIMAL)",
        SUS_COS: "Coste interno por alveolo (Tipo: DECIMAL)"
    },
    relaciones: {
        // No se especifican relaciones explícitas en el texto, pero esta tabla es referenciada por tablas relacionadas con producción o costos.
    },
    ejemplos: {
        consulta_sustrato: "Buscar un sustrato por su id o SUS_DENO para obtener su nombre, PVP y coste por alveolo.",
        calcular_coste_produccion: "Utilizar el campo SUS_COS en módulos de producción para calcular el coste del sustrato por alveolo o bandeja.",
        // Ejemplo de posible inconsistencia (basado en la observación):
        // visualizar_inconsistencia: "Observar posibles diferencias en la visualización de datos (PVP, COS, Denominación) para un mismo sustrato (ej: id 001) entre la base de datos y la interfaz del ERP de pruebas."
    },
    notas: {
        inconsistencia_datos_pruebas: "Se ha observado que los datos de un mismo sustrato (ej. id 001) pueden diferir entre la base de datos y la visualización en el entorno de pruebas del ERP. Se recomienda validar los datos críticos directamente en la base de datos."
    }
},







/* ================================================*/
/* Archivos – Auxiliares – Zonas */
/* ================================================*/
zonas: {
    descripcion: "Catálogo para organizar áreas físicas o lógicas operativas (trabajo, producción, almacenamiento). Fundamental para estructurar espacialmente, mejorar trazabilidad y optimizar gestión de inventario y tareas.",
    tabla: "zonas",
    columnas: {
        id: "Código único de la zona (Clave Primaria)",
        ZN_DENO: "Denominación o nombre descriptivo de la zona (Ej: Garden, ZONA)",
        ZN_SUB: "Subzona o código de agrupación secundaria (Puede estar vacío)",
        ZN_RUTA: "Campo asociado a una ruta (Puede estar vacío)"
    },
    relaciones: {
        // No se especifican relaciones explícitas documentadas que referencien a 'zonas' desde otras tablas en este contexto.
        // Sin embargo, esta tabla es referenciada por módulos como inventario, producción y logística para asignar y gestionar elementos por área.
    },
    ejemplos: {
        listar_zonas: "Obtener el listado de todas las zonas registradas (id, ZN_DENO, etc.).",
        consulta_denominacion_por_id: "Buscar la denominación (ZN_DENO) de una zona dado su código (id).",
        consulta_zonas_por_subzona: "Filtrar zonas que pertenecen a una subzona específica (ZN_SUB).",
        // Ejemplos de uso en combinación con otras tablas (si las relaciones se confirman):
        // filtrar_inventario_por_zona: "Ver el inventario en una zona específica (requiere relación con tabla de inventario)."
        // asignar_tarea_a_zona: "Planificar una tarea a realizar en una zona determinada."
    }
},





/* ================================================*/
/* Archivos – Otros – Departamentos */
/* ================================================*/
departamentos: {
    descripcion: "Cataloga las áreas o unidades funcionales de la empresa (administración, producción, etc.). Fundamental para asignar responsabilidades, gestionar usuarios/roles, clasificar tareas y generar reportes por área.",
    tabla: "departamentos",
    columnas: {
        id: "Código único del departamento (Clave Primaria)",
        DEP_DENO: "Denominación o nombre del departamento (Ej: COORDINADOR, ADMINISTRACION)"
    },
    relaciones: {
        // No se especifican relaciones explícitas documentadas que referencien a 'departamentos' desde otras tablas en este contexto.
        // Sin embargo, esta tabla es clave y referenciada por tablas como 'usuarios', 'tareas', o 'empleados'
        // para vincular registros a una unidad organizacional.
    },
    ejemplos: {
        listar_departamentos: "Obtener el listado de todos los departamentos registrados (id y DEP_DENO).",
        consulta_denominacion_por_id: "Buscar la denominación (DEP_DENO) de un departamento dado su código (id).",
        consulta_id_por_denominacion: "Buscar el código (id) de un departamento dada su denominación (DEP_DENO).",
        // Ejemplos de uso en combinación con otras tablas (si las relaciones se confirman):
        // filtrar_usuarios_por_departamento: "Listar usuarios que pertenecen a un departamento específico (requiere relación con tabla de usuarios)."
        // asignar_tarea_a_departamento: "Vincular una tarea a un departamento responsable."
    }
},





/* ================================================*/
/* Archivos – Otros – Secciones Trabajadores */
/* ================================================*/
secciones_trabajadores: { // Usamos el nombre que aparece en la descripción de campos
    descripcion: "Cataloga áreas funcionales, grupos o secciones internas a las que pertenecen los trabajadores. Fundamental para la gestión de RRHH, asignación de tareas y reportes de personal segmentados.",
    // Nota: El texto fuente menciona "Tabla principal: secciones", pero luego describe campos para "secciones_trabajadores". Asumimos que 'secciones_trabajadores' es el nombre de tabla relevante aquí.
    tabla: "secciones", // Nombre de tabla basado en los campos descritos
    columnas: {
        id: "Código único de la sección de trabajador (Clave Primaria)",
        SE_DENO: "Denominación o nombre de la sección (Ej: ADMINISTRACION, PRODUCCION)"
    },
    relaciones: {
        // No se especifican relaciones explícitas documentadas que referencien a 'secciones_trabajadores' desde otras tablas en este contexto.
        // Sin embargo, esta tabla es clave y es referenciada por la tabla 'trabajadores' para asignar a cada empleado su sección.
    },
    ejemplos: {
        listar_secciones: "Obtener el listado de todas las secciones de trabajadores registradas (id y SE_DENO).",
        consulta_denominacion_por_id: "Buscar la denominación (SE_DENO) de una sección dado su código (id).",
        consulta_id_por_denominacion: "Buscar el código (id) de una sección dada su denominación (SE_DENO).",
        // Ejemplos de uso en combinación con la tabla trabajadores (si la relación se confirma):
        // filtrar_trabajadores_por_seccion: "Listar trabajadores que pertenecen a una sección específica (requiere relación con tabla de trabajadores)."
        // contar_trabajadores_por_seccion: "Obtener el número de trabajadores en una sección determinada (requiere relación y conteo en tabla de trabajadores)."
    }
},






/* ================================================*/
/* Archivos – Otros – Tareas Per */
/* ================================================*/
tareas_per: {
    descripcion: "Gestión detallada de tareas internas realizadas por el personal. Cada tarea se vincula a una 'Sección de Tarea' (de la tabla tareas_seccion). Esencial para partes de trabajo, seguimiento de tiempo/recursos y análisis de productividad.",
    tabla: "tareas_per",
    columnas: {
        id: "Código único de la tarea (Clave Primaria)",
        TARP_DENO: "Denominación o nombre de la tarea (Ej: H.CARRETILLERO, H.LIMPIEZA GENERAL)",
        TARP_SECC: "Código de la sección de tarea a la que pertenece. Clave foránea a la tabla 'tareas_seccion'.",
        TARP_TIPO: "Tipo general de tarea (Ej: 'Otros', 'Siembra', 'Mantenimiento')"
    },
    relaciones: {
        tareas_seccion: {
            tabla_relacionada: "tareas_seccion",
            tipo: "Muchos a uno (varias tareas_per pueden estar en una tareas_seccion)",
            campo_enlace_local: "TARP_SECC",
            campo_enlace_externo: "id", // o TARS_COD en tareas_seccion
            descripcion: "Vincula cada tarea con su sección de tarea correspondiente. Permite obtener la denominación de la sección (TARS_DENO) a partir del código TARP_SECC."
        }
    },
    ejemplos: {
        listar_tareas: "Obtener el listado de todas las tareas registradas (id, TARP_DENO, etc.).",
        consulta_tarea_por_id: "Buscar una tarea por su código (id) para ver su denominación, sección y tipo.",
        consulta_tareas_por_seccion_codigo: "Listar todas las tareas (tareas_per) que pertenecen a una sección específica usando el código de sección (TARP_SECC).",
        consulta_tareas_por_seccion_nombre: "Listar tareas de una sección específica usando el nombre de la sección (requiere unir con la tabla tareas_seccion).",
        consulta_tareas_por_tipo: "Filtrar tareas por su tipo general (TARP_TIPO, Ej: 'Siembra')."
    }
},




















/* ================================================*/
/* Archivos - Produccion - Partes - Partes de siembra */
/* ================================================*/
p_siembras: { // Usamos p_siembras como clave
    descripcion: "Documenta las 'partes' o eventos específicos de siembra. Registra cuándo, dónde, qué artículo (semilla) se sembró, quién realizó la operación y bajo qué estado. Base para seguimiento de siembra, materiales, personal y ubicación inicial de cultivos.",
    tabla: `p-siembras`, // Nombre de tabla original
    columnas: {
        id: "Código único del registro de parte de siembra (Clave Primaria)",
        PSI_FEC: "Fecha de la operación de siembra",
        PSI_HOR: "Hora de la operación de siembra",
        PSI_OPE: "Identificador del operario responsable. Clave foránea a la tabla 'vendedores'.",
        PSI_SEM: "Identificador de la semilla o artículo sembrado. Clave foránea a la tabla 'articulos'.",
        PSI_EST: "Estado actual del registro de la parte de siembra (Ej: 'S').",
        PSI_ALM: "Identificador del almacén o ubicación asociado. Clave foránea a la tabla 'almacenes'.",
        PSI_TIPO: "Clasificador o tipo específico para la parte de siembra (Ej: 'A').",
        PSI_CCOM: "Identificador de la casa comercial asociada. Clave foránea a la tabla 'casas_com'."
    },
    relaciones: {
        vendedores: {
            tabla_relacionada: "vendedores",
            tipo: "Muchos a uno",
            campo_enlace_local: "PSI_OPE",
            campo_enlace_externo: "id",
            descripcion: "Permite obtener la denominación (VD_DENO) del operario que realizó la siembra."
        },
        articulos: {
            tabla_relacionada: "articulos",
            tipo: "Muchos a uno",
            campo_enlace_local: "PSI_SEM",
            campo_enlace_externo: "id",
            descripcion: "Permite obtener la denominación (AR_DENO) exacta de la semilla o artículo sembrado."
        },
        almacenes: {
            tabla_relacionada: "almacenes",
            tipo: "Muchos a uno",
            campo_enlace_local: "PSI_ALM",
            campo_enlace_externo: "id",
            descripcion: "Permite obtener la denominación (AM_DENO) del almacén o ubicación donde se registró la siembra."
        },
        casas_com: {
            tabla_relacionada: "casas_com",
            tipo: "Muchos a uno",
            campo_enlace_local: "PSI_CCOM",
            campo_enlace_externo: "id",
            descripcion: "Permite identificar la casa comercial asociada (obteniendo su denominación SC_DENO o CC_DENO de casas_com)." // Asumiendo SC_DENO o CC_DENO por ejemplos previos
        }
    },
    ejemplos: {
        consulta_parte_siembra: "Obtener los detalles de un registro de siembra específico usando su 'id'.",
        obtener_info_relacionada: "Para un registro de siembra, usar los campos PSI_OPE, PSI_SEM, PSI_ALM, PSI_CCOM para consultar las tablas 'vendedores', 'articulos', 'almacenes' y 'casas_com' y obtener nombres/denominaciones.",
        consultar_siembras_por_operario: "Listar todas las partes de siembra realizadas por un operario específico (filtrando por PSI_OPE).",
        consultar_siembras_de_semilla: "Encontrar todas las siembras registradas para un artículo/semilla particular (filtrando por PSI_SEM)."
    }
},







/* ================================================*/
/* Archivos - Produccion - Partes - Partes Extendido */
/* ================================================*/
p_extension: { // Usamos p_extension como clave
    descripcion: "Documenta operaciones de 'extendido' o movimiento interno de material (plántulas/bandejas) entre ubicaciones, principalmente invernaderos. Fundamental para seguimiento de ubicación y trazabilidad interna.",
    tabla: `p-extension`, // Nombre de tabla original
    columnas: {
        id: "Número único del registro de extendido (Clave Primaria)",
        PEX_NPA: "Número de partida asociado a la operación", // Probablemente clave foránea a tabla de partidas
        PEX_FEC: "Fecha de la operación de extendido",
        PEX_HORA: "Hora de la operación de extendido",
        PEX_USU: "Identificador del usuario o responsable que realizó el extendido. Clave foránea a la tabla 'vendedores'.",
        PEX_TIPO: "Tipo de operación de extendido (Ej: 'P', 'C'). El significado depende de la configuración.",
        PEX_IOR: "Identificador del invernadero de origen. Clave foránea a la tabla 'invernaderos'.",
        PEX_IDE: "Identificador del invernadero de destino. Clave foránea a la tabla 'invernaderos'."
    },
    relaciones: {
        vendedores: {
            tabla_relacionada: "vendedores",
            tipo: "Muchos a uno",
            campo_enlace_local: "PEX_USU",
            campo_enlace_externo: "id",
            descripcion: "Permite obtener el nombre (VD_DENO) del usuario que realizó el extendido."
        },
        invernaderos_origen: { // Relación para el invernadero de origen
            tabla_relacionada: "invernaderos",
            tipo: "Muchos a uno",
            campo_enlace_local: "PEX_IOR",
            campo_enlace_externo: "id",
            descripcion: "Permite obtener la denominación (INV_DENO) del invernadero desde donde se movió el material."
        },
        invernaderos_destino: { // Relación para el invernadero de destino
            tabla_relacionada: "invernaderos",
            tipo: "Muchos a uno",
            campo_enlace_local: "PEX_IDE",
            campo_enlace_externo: "id",
            descripcion: "Permite obtener la denominación (INV_DENO) del invernadero hacia donde se movió el material."
        }
        // Relación probable con una tabla de 'partidas' a través del campo PEX_NPA, no detallada en el texto.
    },
    ejemplos: {
        consulta_por_id: "Obtener los detalles de una operación de extendido específica usando su 'id'.",
        consulta_por_fecha: "Listar operaciones de extendido realizadas en una fecha o rango de fechas específico (filtrando por PEX_FEC).",
        obtener_invernaderos_usuario: "Para un registro de extendido, usar PEX_IOR, PEX_IDE y PEX_USU para consultar 'invernaderos' y 'vendedores' y obtener los nombres del origen, destino y usuario.",
        filtrar_por_origen_destino: "Encontrar extendidos realizados desde/hacia un invernadero específico (filtrando por PEX_IOR o PEX_IDE).",
        filtrar_por_usuario_fecha: "Buscar extendidos realizados por un usuario específico en un período de tiempo (filtrando por PEX_USU y PEX_FEC)."
    }
},




























};

module.exports = { mapaERP };