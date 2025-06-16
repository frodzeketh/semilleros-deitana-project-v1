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
            BN_ALV: "Número total de alvéolos",
            
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
    }, 

    fpago: {
        descripcion:
          "Define y gestiona las formas de pago y cobro utilizadas en transacciones comerciales. Actúa como un catálogo maestro para estandarizar operaciones financieras, vincular transacciones y gestionar vencimientos.",
        tabla: "fpago", // Nombre de tabla original
        alias: "Formas de pago/cobro",
        columnas: {
          id: "Código único de la forma de pago/cobro (Clave Primaria)",
          FP_DENO: "Denominación o descripción de la forma de pago (ej: 'RECIBO 90 DIAS F.F.')",
          FP_NVT: "Número de vencimientos asociados",
          FP_CART: "Indica si se gestiona en cartera de cobros/pagos",
          FP_RW: "Referencia relacionada con la web (propósito no especificado)",
        }
    },

    vendedores: {
        descripcion:
          "La tabla 'vendedores'  del sistema ERP de Semilleros Deitana constituye el repositorio centralizado para la gestión de la información de los usuarios internos que desempeñan funciones de venta o que simplemente tienen acceso al sistema como usuarios.",
        tabla: "vendedores",
        columnas: {
          id: "Código único que identifica a cada vendedor/usuario",
          VD_DENO: "Denominación o nombre completo del vendedor/usuario",
          VD_DOM: "Domicilio del vendedor/usuario",
          VD_POB: "Población de residencia",
          VD_PROV: "Provincia de residencia",
          VD_PDA: "Número técnico asociado (clave foránea a tabla tecnicos)",
        },
    },

    casas_com: {
        // Usamos el nombre de la tabla como clave principal
        descripcion:
          "Gestión y almacenamiento de información de las casas comerciales con las que Semilleros Deitana interactúa. Es fundamental para mantener un registro organizado de socios comerciales y sus datos clave.",
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

        },
    },

    categorias: {
        descripcion:
          "Define las categorías laborales utilizadas en Semilleros Deitana para establecer condiciones contractuales y económicas de los trabajadores (salario, horarios, costes). No son categorías de producto.",
        tabla: "categorias",
        columnas: {
          id: "Identificador único de la categoría laboral (Clave Primaria)",
          CG_DENO: "Nombre o denominación de la categoría laboral (Ej: PRODUCCION, ENCARGADO)",
          CG_SALDIA: "Salario diario base para esta categoría (Tipo: DECIMAL)",
          CG_COSHOR: "Coste calculado por hora de trabajo normal (Tipo: DECIMAL)",
          CG_SDIA: "Coste calculado por hora extra (Tipo: DECIMAL). Nota: Aunque el nombre sugiere 'Salario Día', representa el coste por hora extra según la descripción.",
        },
    },

    almacenes: {
        descripcion:
          "Representa las delegaciones o almacenes físicos y operativos de la empresa. Sirve como referencia para identificar la ubicación asociada a una acción en el ERP y vincular recursos financieros por defecto.",
        tabla: "almacenes", // Nombre de tabla original
        columnas: {
          id: "Código único de la delegación o almacén (Clave Primaria)",
          AM_DENO: "Denominación o nombre de la delegación/almacén (Ej: 'GARDEN')",
          AM_CAJA: "Denominación de la 'Caja Almacen / Sucursal Efectivo' por defecto. Se relaciona con 'bancos' (id) para obtener la denominación (BA_DENO).", // Descripción basada estrictamente en el texto provisto
          AM_BCO: "Denominación del 'Banco Cobros / Pagos Defectos' por defecto. Se relaciona con 'bancos' (id) para obtener la denominación (BA_DENO).", // Descripción basada estrictamente en el texto provisto
        },
    },

    envases_vta: {
        descripcion:
          "Cataloga los diferentes tipos de envases y formatos utilizados para la comercialización de semillas y productos, detallando características físicas y comerciales.",
        tabla: "envases_vta",
        columnas: {
          id: "Identificador único del envase de venta (Clave Primaria)",
          EV_DENO: "Denominación o nombre del envase (Ej: Sobre pequeño, Bolsa 1 Kg)",
          EV_NEM: "Unidad de medida del envase (Ej: UD, SB, L, KG)",
          EV_CANT: "Cantidad total contenida en el envase",
          EV_UDSS: "Número de unidades por presentación o sobre, si aplica",
        },
    },

    invernaderos: {
        descripcion:
          "Contiene la información base de las estructuras físicas de invernaderos, utilizadas para siembra y cultivo. Incluye identificación, vinculación a almacenes, secciones y filas. Nota: Existen otras tablas relacionadas (secciones, filas, tratamientos) no detalladas aquí.",
        tabla: "invernaderos",
        columnas: {
          id: "Identificador único del invernadero (Clave Primaria)",
          INV_DENO: "Denominación o nombre completo del invernadero (Ej: A4 Pg.28-Parcela.1000)",
          INV_ALM: "Código del almacén asociado o vinculado a este invernadero.", // Clave foránea a la tabla 'almacenes'
          INV_NSECI: "Número de secciones inicial o de referencia",
          INV_NSEC: "Número total de secciones",
          INV_NFIL: "Número total de filas",
          INV_EXLT: "Secciones excluidas de tratamientos"
        },
    },

    tipo_trat: {
        descripcion:
          "Gestión y registro detallado de productos fitosanitarios para tratamientos agronómicos (prevención, control de plagas/enfermedades). Centraliza información técnica y de uso para aplicación segura y trazabilidad.",
        tabla: "tipo_trat",
        alias: "Productos Fitosanitarios",
        columnas: {
          id: "Identificador único del producto fitosanitario (Clave Primaria)",
          TTR_NOM: "Nombre comercial del producto (Ej: PREVICUR ENERGY)",
          TTR_DOS: "Dosis estándar o recomendada (Ej: 0,2-0,3 %)",
          TTR_FOR: "Fórmula o principio(s) activo(s)",
          TTR_ENS: "Campo auxiliar (Información incierta, puede estar vacío)", // Nota sobre validación/significado
          TTR_ECO: "Indica si es ecológico ('S'/'N')",
          TTR_BIO: "Indica si es de origen biológico ('S'/'N')",
          TTR_ESP: "Especies vegetales autorizadas o recomendadas (Ej: CALABACÍN - MELÓN)",
          TTR_AGN: "Agentes nocivos que combate (Ej: FITOPHTHORA - PITIUM)",
          TTR_INT: "Enlace web (ficha técnica, registro, etc.)",
          TTR_REG: "Número de registro oficial",
          TTR_FCAD: "Fecha de caducidad",
        },
    },

    sectores: {
        descripcion:
          "Define clasificaciones de origen para pedidos y clientesCrucial para análisis segmentación y seguimiento por canal. Nota: Aunque la gestión directa no siempre es visible en el entorno de prueba, los datos existen y se usan para clasificación.",
        tabla: "sectores",
        columnas: {
          id: "Código único del sector o subsector (Clave Primaria)",
          SC_DENO: "Nombre o denominación del sector o subsector (Ej: SIN ASIGNAR, TIENDA, INTERNET, PROFESIONAL)",
        },
    },

    sustratos: {
        descripcion:
          "Gestión y registro de materiales o mezclas utilizados como medio de cultivo. Esencial para control de costes, precios y planificación de materiales en la producción.",
        tabla: "sustratos",
        columnas: {
          id: "Código único del sustrato (Clave Primaria, también SUS_COD)",
          SUS_DENO: "Denominación o nombre descriptivo del sustrato (Ej: PERLITA PELIGRAM, SUST.ESPECIAL)",
          SUS_PVP: "Precio de venta al público por alveolo (Tipo: DECIMAL)",
          SUS_COS: "Coste interno por alveolo (Tipo: DECIMAL)",
        },
    },

    ubicaciones: {
        descripcion:
          "Catálogo centralizado de ubicaciones físicas o lógicas (invernaderos, semilleros, almacenes) relevantes para las operaciones. Proporciona referencia espacial estandarizada para organizar, trazar y optimizar actividades y recursos.",
        tabla: "ubicaciones", // Nombre de tabla original
        columnas: {
          id: "Código único de la ubicación (Clave Primaria)",
          UBI_DENO: "Denominación o nombre descriptivo de la ubicación (Ej: 'SEMILLERO A', 'Semillero C')",
        },
    },

    zonas: {
        descripcion:
          "Catálogo para organizar áreas físicas o lógicas operativas (trabajo, producción, almacenamiento). Fundamental para estructurar espacialmente, mejorar trazabilidad y optimizar gestión de inventario y tareas.",
        tabla: "zonas",
        columnas: {
          id: "Código único de la zona (Clave Primaria)",
          ZN_DENO: "Denominación o nombre descriptivo de la zona (Ej: Garden, ZONA)",
          ZN_SUB: "Subzona o código de agrupación secundaria (Puede estar vacío)",
          ZN_RUTA: "Campo asociado a una ruta (Puede estar vacío)",
        },
    },

    departamentos: {
        descripcion:
          "Cataloga las áreas o unidades funcionales de la empresa (administración, producción, etc.). Fundamental para asignar responsabilidades, gestionar usuarios/roles, clasificar tareas y generar reportes por área.",
        tabla: "departamentos",
        columnas: {
          id: "Código único del departamento (Clave Primaria)",
          DEP_DENO: "Denominación o nombre del departamento (Ej: COORDINADOR, ADMINISTRACION)",
        },
    },


    secciones: {
        // Usamos el nombre que aparece en la descripción de campos
        descripcion:
          "Cataloga áreas funcionales, grupos o secciones internas a las que pertenecen los trabajadores. Fundamental para la gestión de RRHH, asignación de tareas y reportes de personal segmentados.",
        // Nota: El texto fuente menciona "Tabla principal: secciones", pero luego describe campos para "secciones_trabajadores". Asumimos que 'secciones_trabajadores' es el nombre de tabla relevante aquí.
        tabla: "secciones", // Nombre de tabla basado en los campos descritos
        columnas: {
          id: "Código único de la sección de trabajador (Clave Primaria)",
          SE_DENO: "Denominación o nombre de la sección (Ej: ADMINISTRACION, PRODUCCION)",
        },
    },


    tareas_per: {
        descripcion:
          "Gestión detallada de tareas internas realizadas por el personal. Cada tarea se vincula a una 'Sección de Tarea' (de la tabla tareas_seccion). Esencial para partes de trabajo, seguimiento de tiempo/recursos y análisis de productividad.",
        tabla: "tareas_per",
        columnas: {
          id: "Código único de la tarea (Clave Primaria)",
          TARP_DENO: "Denominación o nombre de la tarea (Ej: H.CARRETILLERO, H.LIMPIEZA GENERAL)",
          TARP_SECC: "Código de la sección de tarea a la que pertenece. Clave foránea a la tabla 'tareas_seccion'.",
          TARP_TIPO: "Tipo general de tarea (Ej: 'Otros', 'Siembra', 'Mantenimiento')",
        },
        relaciones: {
          tareas_seccion: {
            tabla_relacionada: "tareas_seccion",
            tipo: "Muchos a uno (varias tareas_per pueden estar en una tareas_seccion)",
            campo_enlace_local: "TARP_SECC",
            campo_enlace_externo: "id", // o TARS_COD en tareas_seccion
            descripcion:
              "Vincula cada tarea con su sección de tarea correspondiente. Permite obtener la denominación de la sección (TARS_DENO) a partir del código TARP_SECC.",
          },
        },
    },


    'p-siembras': {
        descripcion:
          "Parte de siembra. Registra operaciones de siembra documentando cuándo,partes de siembra, quién, qué semilla, dónde se sembró (almacén), lote y resultados globales (bandejas/palet, total bandejas). Fundamental para documentar el proceso, vincular insumos/personal/ubicación y controlar la producción desde el inicio.",
        tabla: `p-siembras`, // Nombre de tabla principal
        columnas: {
          id: "Número identificador único del parte de siembra (Clave Primaria)",
          PSI_FEC: "Fecha en que se realizó el parte de siembra.",
          PSI_HORA: "Hora en que se realizó el parte de siembra.",
          PSI_OPE: "Número de código del operador. Clave foránea a la tabla 'vendedores' para obtener la denominación (VD_DENO).",
          PSI_SEM: "Código de la semilla o artículo utilizado. Clave foránea a la tabla 'articulos' para obtener la denominación (AR_DENO).",
          PSI_CONP: "Consumo previo (propósito no especificado).",
          PSI_EST: "Estado del parte de siembra.",
          PSI_ALM: "Código del almacén principal donde se realizó el parte de siembra. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
          PSI_LOTE: "Número de lote de la semilla utilizada.",
          PSI_BAPP: "Bandejas por Palet en este parte.",
          PSI_TBAN: "Número Total de Bandejas en este parte.",
        },
        relaciones: {
          vendedores: {
            tabla_relacionada: "vendedores",
            tipo: "Muchos a uno",
            campo_enlace_local: "PSI_OPE",
            campo_enlace_externo: "id",
            descripcion: "Vincula el parte de siembra con el operador que lo realizó.",
          },
          articulos: {
            tabla_relacionada: "articulos",
            tipo: "Muchos a uno",
            campo_enlace_local: "PSI_SEM",
            campo_enlace_externo: "id",
            descripcion: "Vincula el parte de siembra con el artículo/semilla utilizado.",
          },
          almacenes_principal: {
            // Relación para el almacén principal del parte
            tabla_relacionada: "almacenes",
            tipo: "Muchos a uno",
            campo_enlace_local: "PSI_ALM",
            campo_enlace_externo: "id",
            descripcion: "Vincula el parte de siembra con el almacén principal donde se realizó la operación.",
          },
          p_siembras_psi_semb: {
            tabla_relacionada: `p-siembras_psi_semb`,
            tipo: "Uno a muchos (un parte puede tener múltiples líneas de sembrado de partidas)",
            campo_enlace_local: "id", // El id del parte en p-siembras
            campo_enlace_externo: "id", // El campo id en p-siembras_psi_semb que referencia al parte principal
            descripcion:
              "Almacena los detalles de cada partida sembrada dentro de un parte de siembra.",
            estructura_relacionada: {
              // Estructura de la tabla de detalle
              id: "ID del parte de siembra principal asociado",
              id2: "Línea o cantidad de sembrados dentro de este parte (Ej: 1, 2, 3)",
              C0: "Número de partida sembrada en esta línea. Clave foránea a la tabla 'partidas'.",
              C1: "Número de bandejas sembradas para esta partida en esta línea (Ej: '49').",
              C2: "Número de palet (Ej: '01').",
              C3: "Número de delegación o almacén específico donde se colocaron las bandejas. Clave foránea a la tabla 'almacenes'",
              // Nota: Este es un almacén/sub-ubicación dentro del almacén principal del parte
            },
            relaciones_internas_de_detalle: {
              // Relaciones que parten de la tabla de detalle
              partidas: {
                tabla_relacionada: "partidas",
                tipo: "Muchos a uno (varias líneas pueden referenciar a la misma partida)",
                campo_enlace_local: "C0", // El campo local que contiene el número de partida
                campo_enlace_externo: "id", // El campo referenciado en la tabla partidas
                descripcion:
                  "Vincula la línea de detalle con la partida sembrada específica.",
                relaciones_externas_de_partida: {
                  // Relaciones que parten de la tabla relacionada (partidas)
                  clientes: {
                    tabla_relacionada: "clientes",
                    tipo: "Muchos a uno (una partida pertenece a un cliente)",
                    campo_enlace_local: "PAR_CCL", // Campo en partidas que apunta a clientes
                    campo_enlace_externo: "id", // Campo en clientes
                    descripcion:
                      "La tabla 'partidas' se relaciona con 'clientes' para obtener la denominación (CL_DENO) del cliente asociado a la partida sembrada (ruta: p-siembras_psi_semb.C0 -> partidas.id -> partidas.PAR_CCL -> clientes.id).",
                  },
                  // La tabla 'partidas' también se relaciona con 'articulos' (PAR_SEM -> articulos.id)
                },
              },
              almacenes_ubicacion_especifica: {
                // Relación para la ubicación específica del sembrado (C3)
                tabla_relacionada: "almacenes",
                tipo: "Muchos a uno (varias líneas de detalle pueden referenciar al mismo almacén/delegación)",
                campo_enlace_local: "C3", // El campo local que contiene el código del almacén/delegación
                campo_enlace_externo: "id", // El campo referenciado en la tabla almacenes
                descripcion:
                  "Vincula la línea de detalle con la delegación o almacén específico donde se colocaron las bandejas sembradas (sub-ubicación).",
              },
            },
          },
        },
    },



};

module.exports = mapaERP; 