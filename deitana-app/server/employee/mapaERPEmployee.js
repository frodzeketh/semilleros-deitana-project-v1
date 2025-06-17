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
            AR_BAR: "Código de barras del artículo.",
            AR_IVAP: "Porcentaje de IVA aplicable",
            AR_PRV: "Código del proveedor principal",
            AR_FAM: "Familia o categoría del artículo",
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









    partidas: {
      // Clave principal (nombre de tabla)
      descripcion:
        "Registra las partidas de siembra, vinculadas a los encargos de los clientes. Contiene información sobre la fecha, tipo de semilla (propia o no), la semilla utilizada, lote, germinación, tipo de siembra, sustrato, cantidades (semillas, plantas, alveolos, bandejas), fechas (siembra, entrega, solicitada) y denominación/observaciones.",
      tabla: `partidas`, // Nombre de la tabla principal
      columnas: {
        id: "ID de la partida (Clave Primaria)",
        PAR_ENC: "Número del encargo asociado. Clave foránea a la tabla 'encargos'.",
        PAR_FEC: "Fecha de la partida.",
        PAR_TIPO: "Tipo de semilla ('D': Depósito cliente, 'N': No depósito).",
        PAR_SEM: "Semilla utilizada. Clave foránea a la tabla 'articulos' para obtener la denominación (AR_DENO).",
        PAR_LOTE: "Lote de la semilla.",
        PAR_PGER: "Porcentaje de germinación.",
        PAR_TSI: "Tipo de siembra. Clave foránea a la tabla 't-siembras' para obtener la denominación (TSI_DENO) y detalles.",
        
        PAR_ALVS: "Cantidad de semillas a sembrar.",
        PAR_PLAS: "Cantidad de plantas solicitadas.",
        PAR_PLAP: "Cantidad de plantas aproximadas.",
        PAR_PLS: "Cantidad de alveolos solicitados.",
        PAR_BASI: "Cantidad de bandejas de siembra.",
        PAR_FECS: "Fecha de siembra.",
        PAR_DIASS: "Días de siembra.",
        PAR_FECE: "Fecha de entrega.",
        PAR_DIASG: "Días de germinación.",
        PAR_PPLA: "Planta (¿denominación?).",
        PAR_PALV: "Alveolos (¿cantidad?).",
        PAR_TOT: "Total (¿importe?).",
        PAR_DENO: "Denominación u observación de la partida (Ej: 'PARTIDA Nº ...').",
        PAR_FECES: "Fechas (Solicitada 'E'/Entrega 'E'/Siembra 'S').",
        PAR_PMER: "Nombre (¿?).",
        PAR_NMCL: "Nombre de la semilla.",
      },
      relaciones: {
        encargos: {
          tabla_relacionada: "encargos",
          tipo: "Muchos a uno",
          campo_enlace_local: "PAR_ENC",
          campo_enlace_externo: "id",
          descripcion: "Vincula la partida con el encargo del cliente.",
        },
        articulos: {
          tabla_relacionada: "articulos",
          tipo: "Muchos a uno",
          campo_enlace_local: "PAR_SEM",
          campo_enlace_externo: "id",
          descripcion: "Vincula la partida con la semilla utilizada.",
        },
        t_siembras: {
          tabla_relacionada: "t-siembras",
          tipo: "Muchos a uno",
          campo_enlace_local: "PAR_TSI",
          campo_enlace_externo: "id",
          descripcion: "Vincula la partida con el tipo de siembra.",
        },
        sustratos: {
          tabla_relacionada: "sustratos",
          tipo: "Muchos a uno",
          
          campo_enlace_externo: "id",
          descripcion: "Vincula la partida con el sustrato utilizado.",
        },
        clientes: {
          tabla_relacionada: "clientes",
          tipo: "Muchos a uno",
          campo_enlace_local: "PAR_CCL", // Inferido del contexto de "encargos" -> "clientes"
          campo_enlace_externo: "id",
          descripcion: "Vincula la partida con el cliente (a través del encargo).",
        },
      },
      ejemplos: {
        consulta_partida_por_id:
          "Obtener los detalles de una partida específica usando su 'id'.",
        consultar_info_relacionada:
          "Para una partida, obtener información del encargo asociado, la semilla, el tipo de siembra y el sustrato.",
        filtrar_partidas_por_encargo:
          "Listar todas las partidas asociadas a un número de encargo específico (filtrando por PAR_ENC).",
        filtrar_partidas_por_fecha:
          "Listar partidas por fecha de partida o fecha de entrega.",
        filtrar_partidas_por_semilla:
          "Listar partidas donde se utilizó una semilla específica (filtrando por PAR_SEM).",
      },
    },








    pedidos_pr: {
      // Clave principal (nombre de tabla)
      descripcion:
        "Registra y sigue los pedidos de compra realizados a proveedores. Es el punto de partida formal para solicitar la adquisición de bienes o servicios. Es crucial para la planificación de compras, el control de inventario, la gestión de proveedores y sirve como base para las recepciones de mercancía y las facturas de compra.",
      tabla: "pedidos_pr", // Nombre de tabla original
      columnas: {
        id: "Número único que identifica cada pedido a proveedor (Clave Primaria). Este ID se utiliza como clave foránea en la tabla 'pedidos_pr_pp_lna'.",
        PP_CPR: "Código del proveedor. Clave foránea a la tabla 'proveedores' para obtener la denominación (PR_DENO).",
        PP_ALM: "Almacén de recepción designado. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
        PP_FEC: "Fecha en que se emitió el pedido.",
        PP_FSV: "Fecha esperada de entrega por el proveedor ('fecha servir').",
        PP_FP: "Forma de pago acordada. Clave foránea a la tabla 'fpago' para obtener la denominación (FP_DENO).",
        PP_BRU: "Monto bruto total del pedido.",
        PP_NETO: "Monto neto del pedido.",
        PP_IMPU: "Costo total de los impuestos aplicados.",
        PP_TTT: "Monto total final del pedido.",
        PP_PDP: "Persona dentro de la empresa que realizó o solicitó el pedido ('Pedido por') usuarios/empleados.",
      },
      relaciones: {
        proveedores: {
          tabla_relacionada: "proveedores",
          tipo: "Muchos a uno",
          campo_enlace_local: "PP_CPR",
          campo_enlace_externo: "id",
          descripcion: "Vincula el pedido con el proveedor al que se le realizó la solicitud.",
        },
        almacenes: {
          tabla_relacionada: "almacenes",
          tipo: "Muchos a uno",
          campo_enlace_local: "PP_ALM",
          campo_enlace_externo: "id",
          descripcion: "Vincula el pedido con el almacén donde se espera recibir la mercancía.",
        },
        fpago: {
          tabla_relacionada: "fpago",
          tipo: "Muchos a uno",
          campo_enlace_local: "PP_FP",
          campo_enlace_externo: "id",
          descripcion: "Vincula el pedido con la forma de pago acordada.",
        },
        pedidos_pr_pp_lna: {
          tabla_relacionada: "pedidos_pr_pp_lna",
          tipo: "Uno a muchos (un pedido a proveedor puede incluir múltiples artículos/líneas de pedido)",
          campo_enlace_local: "id", // ID del pedido en la tabla principal
          campo_enlace_externo: "id", // ID del pedido en la tabla de detalle
          descripcion: "Detalla los artículos específicos pedidos a cada proveedor en una línea de pedido.",
          estructura_relacionada: {
            id: "Código del pedido (igual que 'pedidos_pr.id').",
            id2: "Identificador secuencial de la línea de pedido (para diferentes artículos dentro del mismo pedido, ej: '1', '2', '3').",
            C0: "Código del artículo que se pidió al proveedor. Clave foránea a la tabla 'articulos' para obtener la denominación (AR_DENO).",
            C1: "Código del envase de venta. Clave foránea a la tabla 'envases_vta' para obtener la denominación (EV_DENO).",
            C2: "Número de sobres.",
            C3: "Unidades por sobre.",
            C4: "Precio de compra (P/Compra).",
            C5: "Porcentaje de descuento (Descuento %).",
          },
          relaciones_internas_de_detalle: {
            articulos: {
              tabla_relacionada: "articulos",
              tipo: "Muchos a uno",
              campo_enlace_local: "C0",
              campo_enlace_externo: "id",
              descripcion: "Vincula la línea del pedido con el artículo correspondiente para obtener su denominación.",
            },
            envases_vta: {
              tabla_relacionada: "envases_vta",
              tipo: "Muchos a uno",
              campo_enlace_local: "C1",
              campo_enlace_externo: "id",
              descripcion: "Vincula la línea del pedido con el tipo de envase de venta para obtener su denominación.",
            },
          },
        },
        
      },
      ejemplos: {
        consulta_pedido_por_id: "Obtener los detalles de un pedido a proveedor específico usando su 'id'.",
        consultar_info_relacionada:
          "Para un pedido, usar PP_CPR, PP_ALM y PP_FP para consultar 'proveedores', 'almacenes' y 'fpago' y obtener los nombres del proveedor, almacén y forma de pago.",
        filtrar_pedidos_por_proveedor_o_fecha:
          "Listar pedidos realizados a un proveedor específico (filtrando por PP_CPR) o en un rango de fechas (filtrando por PP_FEC).",
        filtrar_pedidos_por_fecha_entrega_esperada:
          "Buscar pedidos con una fecha de entrega esperada (PP_FSV) en un rango específico.",
        filtrar_pedidos_por_solicitante:
          "Encontrar pedidos realizados por una persona específica dentro de la empresa (filtrando por PP_PDP).",
        consultar_articulos_en_pedido:
          "Para un pedido (ej. ID '005001'), listar todos los artículos pedidos desde 'pedidos_pr_pp_lna', incluyendo su denominación (uniéndose a 'articulos'), tipo de envase, unidades, precio de compra y descuento.",
        calcular_costo_total_por_articulo_en_pedido:
          "Para un pedido específico, calcular el costo total de cada artículo multiplicando 'C3' (Unidades/Sob) * 'C4' (P/Compra) y aplicando 'C5' (Descuento %).",
      },
    },




    tratamientos: {
      // Clave principal (nombre de tabla)
      descripcion:
        "Catálogo de tratamientos fitosanitarios, incluyendo su denominación y método de aplicación. Contiene relaciones con las plagas que ataca, los productos fitosanitarios utilizados y las familias afectadas.",
      tabla: `tratamientos`, // Nombre de la tabla principal
      columnas: {
        id: "Código del tratamiento (Ej: '00000008') (Clave Primaria)",
        TT_DENO: "Denominación del tratamiento (Ej: 'BRASSICACEAE Y ASTERACEAE 1')",
        TT_MET: "Método de aplicación (Ej: 'Pulverización')",
      },
      relaciones: {
        tratamientos_tt_plag: {
          tabla_relacionada: "tratamientos_tt_plag",
          tipo: "Uno a muchos (un tratamiento ataca varias plagas)",
          campo_enlace_local: "id", // ID del tratamiento
          campo_enlace_externo: "id", // ID del tratamiento en la tabla de enlace
          descripcion: "Tabla de enlace que relaciona tratamientos con las plagas que ataca.",
          estructura_relacionada: {
            id: "ID del tratamiento fitosanitario.",
            id2: "Identificador secuencial dentro del tratamiento.",
            C0: "ID de la plaga. Clave foránea a la tabla 'plagas'.",
          },
          relaciones_internas_de_detalle: {
            plagas: {
              tabla_relacionada: "plagas",
              tipo: "Muchos a uno",
              campo_enlace_local: "C0",
              campo_enlace_externo: "id",
              descripcion: "Vincula el tratamiento con la plaga que ataca.",
            },
          },
        },
        tratamientos_tt_pro: {
          tabla_relacionada: "tratamientos_tt_pro",
          tipo: "Uno a muchos (un tratamiento utiliza varios productos)",
          campo_enlace_local: "id", // ID del tratamiento
          campo_enlace_externo: "id", // ID del tratamiento en la tabla de enlace
          descripcion: "Tabla de enlace que relaciona tratamientos con los productos fitosanitarios utilizados.",
          estructura_relacionada: {
            id: "ID del tratamiento fitosanitario.",
            id2: "Identificador secuencial dentro del tratamiento.",
            C0: "ID del tipo de producto fitosanitario. Clave foránea a la tabla 'tipo_trat'.",
            C1: "Dosis del producto (Ej: '30cc/hl').",
            C2: "Valor asociado al producto (Ej: '1000000000.00').",
          },
          relaciones_internas_de_detalle: {
            tipo_trat: {
              tabla_relacionada: "tipo_trat",
              tipo: "Muchos a uno",
              campo_enlace_local: "C0",
              campo_enlace_externo: "id",
              descripcion: "Vincula el tratamiento con el tipo de producto fitosanitario utilizado.",
            },
          },
        },
        tratamientos_tt_fam: {
          tabla_relacionada: "tratamientos_tt_fam",
          tipo: "Uno a muchos (un tratamiento afecta a varias familias)",
          campo_enlace_local: "id", // ID del tratamiento
          campo_enlace_externo: "id", // ID del tratamiento en la tabla de enlace
          descripcion: "Tabla de enlace que relaciona tratamientos con las familias afectadas.",
          estructura_relacionada: {
            id: "ID del tratamiento fitosanitario.",
            id2: "Identificador secuencial dentro del tratamiento.",
            C0: "ID de la familia afectada. Clave foránea a la tabla 'familias'.",
            C1: "Valor asociado a la familia (Ej: '25').",
            C2: "Otro valor asociado a la familia (Ej: '0').",
          },
          relaciones_internas_de_detalle: {
            familias: {
              tabla_relacionada: "familias",
              tipo: "Muchos a uno",
              campo_enlace_local: "C0",
              campo_enlace_externo: "id",
              descripcion: "Vincula el tratamiento con la familia afectada.",
            },
          },
        },
      },
      ejemplos: {
        consulta_tratamiento_por_id:
          "Obtener la denominación y método de aplicación de un tratamiento fitosanitario específico usando su 'id'.",
        listar_todos_tratamientos:
          "Listar todos los tratamientos fitosanitarios registrados.",
        consultar_plagas_atacadas:
          "Para un tratamiento, consultar la tabla 'tratamientos_tt_plag' para ver las plagas que ataca y luego obtener sus denominaciones desde la tabla 'plagas'.",
        consultar_productos_utilizados:
          "Para un tratamiento, consultar la tabla 'tratamientos_tt_pro' para ver los productos utilizados (y sus dosis) y obtener sus nombres desde 'tipo_trat'.",
        consultar_familias_afectadas:
          "Para un tratamiento, consultar la tabla 'tratamientos_tt_fam' para ver las familias afectadas y obtener sus denominaciones desde la tabla 'familias'.",
      },
    },



    tarifas_plantas: {
      // Clave principal (nombre de tabla)
      descripcion:
        "Gestiona las diferentes tarifas de precios para plantas, especificando el período de validez, el almacén asociado y el título de la tarifa. Un registro principal puede tener múltiples líneas de detalle que definen los precios por artículo y tipo de tarifa.",
      tabla: `tarifas_plantas`, // Nombre de la tabla principal
      columnas: {
        id: "Código identificador único de la tarifa (Clave Primaria).",
        TAP_DENO: "Denominación o título de la tarifa (ej: 'TARIFA ACTUALIZA 2024 – ULTIMA').",
        TAP_DFEC: "Fecha de inicio de validez de la tarifa de precio (ej: '2024-05-04').",
        TAP_HFEC: "Fecha de fin de validez de la tarifa de precio (ej: '2025-12-31').",
        TAP_ALM: "Código del almacén asociado a la tarifa. Clave foránea a la tabla 'almacenes' para obtener la denominación (AM_DENO).",
      },
      relaciones: {
        almacenes: {
          tabla_relacionada: "almacenes",
          tipo: "Muchos a uno",
          campo_enlace_local: "TAP_ALM",
          campo_enlace_externo: "id",
          descripcion: "Vincula la tarifa de plantas con el almacén al que aplica.",
        },
        tarifas_plantas_tap_lna: {
          tabla_relacionada: "tarifas_plantas_tap_lna",
          tipo: "Uno a muchos (una tarifa puede contener múltiples líneas de precios para diferentes productos/tipos)",
          campo_enlace_local: "id", // ID de la tarifa en la tabla principal
          campo_enlace_externo: "id", // ID de la tarifa en la tabla de detalle
          descripcion: "Detalla los precios de los productos específicos dentro de una tarifa, incluyendo el tipo de tarifa, costes y precios de venta.",
          estructura_relacionada: {
            id: "Código de la tarifa (igual que 'tarifas_plantas.id').",
            id2: "Identificador secuencial de la línea de detalle (indica la cantidad de productos con precios actualizados).",
            C0: "Código del artículo. Clave foránea a la tabla 'articulos' para obtener la denominación (AR_DENO).",
            C1: "Tipo de tarifa (ej: 'A', 'B'), que afecta el precio. Puede haber múltiples tipos para un mismo producto.",
            C2: "Tipo de siembra (ej: '5001').",
            C3: "Campo de propósito desconocido ('No se sabe').",
            C4: "Porcentaje (%).",
            C5: "Coste de producción.",
            C6: "Campo de propósito desconocido ('No se sabe').",
            C7: "Coste de la semilla.",
            C8: "Coste del patrón.",
            C9: "Incremento.",
            C10: "Precio de Venta al Público (PvP) Fijo por Bandeja.",
            C11: "Precio de Venta al Público (PvP) por Planta.",
            C12: "Precio de Venta al Público (PvP) por Bandeja.",
          },
          relaciones_internas_de_detalle: {
            articulos: {
              tabla_relacionada: "articulos",
              tipo: "Muchos a uno",
              campo_enlace_local: "C0",
              campo_enlace_externo: "id",
              descripcion: "Vincula la línea de precio con el artículo correspondiente para obtener su denominación.",
            },
            // Posible relación con 't-siembras' si C2 es una clave foránea.
            /*
            t_siembras: {
              tabla_relacionada: "t-siembras",
              tipo: "Muchos a uno",
              campo_enlace_local: "C2",
              campo_enlace_externo: "id",
              descripcion: "Vincula la línea de precio con el tipo de siembra."
            }
            */
          },
        },
      },
      ejemplos: {
        consulta_tarifa_por_id:
          "Obtener la denominación y el período de validez de una tarifa de precios específica usando su 'id'.",
        consultar_precios_de_tarifa:
          "Para una tarifa específica (ej. ID '21001414'), listar todos los artículos incluidos en esa tarifa desde 'tarifas_plantas_tap_lna', mostrando su denominación, tipo de tarifa, y los diferentes precios (PvP Fijo Bandeja, PvP Planta, PvP Bandeja).",
        buscar_precio_articulo_por_fecha:
          "Encontrar el precio de un artículo específico ('C0') para una fecha determinada, buscando en 'tarifas_plantas' la tarifa activa y luego en 'tarifas_plantas_tap_lna' el precio correspondiente.",
        analisis_de_costes_y_precios:
          "Comparar los costes de producción (C5), semilla (C7) y patrón (C8) con los precios de venta (C10, C11, C12) para evaluar la rentabilidad por artículo.",
      },
    },
  

    

    maquinaria: {
      // Clave principal (basada en el nombre de la sección)
      descripcion:
        "Registra y administra las máquinas y equipos utilizados por la empresa como un inventario detallado. Permite mantener un registro completo de características, adquisición, seguro, operador actual y tipo de maquinaria. Crucial para gestión de activos, mantenimiento, control y asignación.",
      tabla: "maquinaria", // Nombre de tabla inferido (campos con prefijo MA_)
      columnas: {
        id: "Código identificador único de cada máquina o equipo (Clave Primaria)",
        MA_MOD: "Modelo de la maquinaria (Ej: 'Balanza-2 CABEZAL INV.B COBOS').",
        MA_TIPO: "Tipo de maquinaria (campo genérico, distinto de MA_TP).",
        MA_NU: "Información relacionada con el uso de la maquinaria.",
        MA_AFAB: "Año de Fabricación.",
        MA_FCOM: "Año de compra.",
        MA_BAS: "Número de Bastidor.",
        MA_VSE: "Fecha de vencimiento del seguro.",
        MA_COM: "Nombre de la compañía de seguro (campo de texto).",
        MA_TRAB: "Código del trabajador técnico conductor actual. Clave foránea a la tabla 'tecnicos' para obtener la denominación (TN_DENO).",
        MA_TP: "Código del tipo general de maquinaria. Clave foránea a la tabla 'tipo-maq' para obtener la denominación (TM_DENO).",
      },
      relaciones: {
        tecnicos: {
          tabla_relacionada: "tecnicos",
          tipo: "Muchos a uno",
          campo_enlace_local: "MA_TRAB",
          campo_enlace_externo: "id",
          descripcion: "Vincula la maquinaria con el trabajador técnico que la opera/conduce actualmente.",
        },
        tipo_maquinaria: {
          // Usamos un nombre más descriptivo para la relación con tipo-maq
          tabla_relacionada: "tipo-maq",
          tipo: "Muchos a uno",
          campo_enlace_local: "MA_TP",
          campo_enlace_externo: "id",
          descripcion: "Vincula la maquinaria con su tipo general, definido en la tabla 'tipo-maq'.",
        },
        // La descripción no detalla explícitamente otras relaciones formales.
      },
      ejemplos: {
        consulta_maquinaria_por_id: "Obtener todos los detalles de una máquina específica usando su 'id'.",
        consultar_info_relacionada:
          "Para una máquina, usar MA_TRAB y MA_TP para consultar 'tecnicos' y 'tipo-maq' y obtener el nombre del conductor actual (TN_DENO) y la denominación del tipo de maquinaria (TM_DENO).",
        filtrar_por_tipo_general:
          "Listar maquinaria de un tipo general específico usando el campo MA_TP (vinculando con 'tipo-maq' si es necesario filtrar por nombre de tipo).",
        filtrar_por_conductor_actual:
          "Buscar maquinaria asignada a un trabajador específico (filtrando por MA_TRAB).",
        consultar_fechas_clave:
          "Obtener el año de fabricación (MA_AFAB), año de compra (MA_FCOM) o fecha de vencimiento del seguro (MA_VSE) de una máquina.",
        buscar_por_modelo_o_bastidor:
          "Encontrar maquinaria usando su modelo (MA_MOD) o número de bastidor (MA_BAS).",
      },
    },








    tipo_maq: {
      // Clave principal (basada en el nombre de tabla)
      descripcion:
        "Define y gestiona las categorías o tipos de maquinaria utilizados por la empresa. Funciona como un catálogo maestro para estandarizar la clasificación de equipos y sirve como referencia para otros módulos.",
      tabla: "tipo-maq", // Nombre de tabla original
      columnas: {
        id: "Código identificador único asignado a cada tipo de maquinaria (Clave Primaria)",
        TM_DENO: "Denominación o nombre descriptivo del tipo de máquina (Ej: 'CAMION').",
      },
      relaciones: {
        maquinaria: {
          tabla_relacionada: "maquinaria", // Nombre inferido de la tabla que contiene los registros individuales de máquinas
          tipo: "Uno a muchos (un tipo puede aplicarse a muchas máquinas)",
          campo_enlace_local: "id", // El id en tipo-maq
          campo_enlace_externo: "MA_TP", // El campo en la tabla 'maquinaria' que referencia a tipo-maq.id
          descripcion:
            "Es referenciada por la tabla 'maquinaria' (mediante el campo MA_TP) para clasificar cada máquina individual por su tipo.",
        },
      },
      ejemplos: {
        consulta_tipo_por_id: "Obtener los detalles de un tipo de maquinaria específico usando su 'id'.",
        consulta_tipo_por_denominacion:
          "Buscar un tipo de maquinaria por su denominación (TM_DENO).",
        consultar_maquinas_por_tipo:
          "Listar todas las máquinas individuales que pertenecen a un tipo específico (requiere consultar la tabla 'maquinaria' filtrando por MA_TP).",
      },
    },




    tecnicos: {
      alias: "tecnicos",
      descripcion:
        "Información de los técnicos de la empresa, incluyendo su nombre, teléfono, email y otros datos relevantes, así como su historial laboral y contractual.",
      tabla: "tecnicos",
      columnas: {
        id: "Código identificador único del técnico (Clave Primaria).",
        TN_DENO: "Nombre completo del técnico.",
        TN_TEL: "Número de teléfono del técnico.",
        TN_DOM: "Domicilio del técnico.",
        TN_POB: "Población del técnico.",
        TN_CDP: "Código postal del técnico.",
        TN_CIF: "Número de identificación fiscal del técnico.",
        TN_ACT: "Estado de actividad del técnico (Ej: 'A' - Activo, 'I' - Inactivo, 'B' - Baja).",
      },
      relaciones: {
        tecnicos_tn_hist: {
          tabla_relacionada: "tecnicos_tn_hist",
          tipo: "Uno a muchos (un técnico puede tener múltiples registros en su historial)",
          campo_enlace_local: "id", // El ID del técnico en esta tabla
          campo_enlace_externo: "id", // El ID del técnico en la tabla de historial
          descripcion: "Vincula al técnico con su historial laboral y contractual detallado, incluyendo fechas de inicio/fin, área, lugar de trabajo y tipo de contrato.",
        },
        // Otras posibles relaciones no mencionadas en la descripción original pero lógicamente existentes:
        // - Si los técnicos pueden ser vendedores, una relación con la tabla 'vendedores'.
        // - Si los técnicos están asignados a clientes, una relación con la tabla 'clientes'.
      },
      ejemplos: {
        consulta_tecnico_por_id:
          "Obtener la información básica de un técnico específico usando su 'id'.",
        consultar_historial_completo_tecnico:
          "Para un técnico (ej. ID '850'), obtener todos los registros de su historial laboral desde 'tecnicos_tn_hist', incluyendo fechas, áreas y tipos de contrato.",
        filtrar_tecnicos_activos:
          "Listar todos los técnicos que están actualmente activos (filtrando por TN_ACT = 'A').",
        buscar_tecnico_por_nombre:
          "Encontrar técnicos por su nombre completo (filtrando por TN_DENO).",
      },
    },

    





    aplicadores_fit: {
      // Clave principal (nombre de tabla)
      descripcion:
        "Catálogo de aplicadores fitosanitarios registrados en el sistema, identificados por un código único y una denominación.",
      tabla: `aplicadores_fit`, // Nombre de la tabla principal
      columnas: {
        id: "Código ID único del aplicador fitosanitario (Clave Primaria)",
        AFI_DENO: "Denominación del aplicador fitosanitario (Ej: 'LUIS TUBON')",
      },
      relaciones: {
        // Esta tabla podría ser referenciada por otras tablas, pero no se detalla aquí.
      },
      ejemplos: {
        consulta_aplicador_por_id:
          "Obtener la denominación de un aplicador fitosanitario específico usando su 'id'.",
        listar_todos_aplicadores:
          "Listar todos los aplicadores fitosanitarios registrados (consultando todos los registros de la tabla).",
        buscar_aplicador_por_denominacion:
          "Buscar un aplicador fitosanitario por su nombre o denominación (filtrando por AFI_DENO).",
      },
    },









    equipo_fito: {
      // Clave principal (nombre de tabla)
      descripcion:
        "Catálogo de equipos fitosanitarios registrados en el sistema, identificados por un código único y una denominación.",
      tabla: `equipo_fito`, // Nombre de la tabla principal
      columnas: {
        id: "Código único del equipo fitosanitario (Clave Primaria)",
        EFI_DENO: "Denominación del equipo fitosanitario.",
      },
      relaciones: {
        // Esta tabla podría ser referenciada por otras tablas, pero no se detalla aquí.
      },
      ejemplos: {
        consulta_equipo_por_id:
          "Obtener la denominación de un equipo fitosanitario específico usando su 'id'.",
        listar_todos_equipos:
          "Listar todos los equipos fitosanitarios registrados (consultando todos los registros de la tabla).",
        buscar_equipo_por_denominacion:
          "Buscar un equipo fitosanitario por su nombre o denominación (filtrando por EFI_DENO).",
      },
    },







    tarifas: {
      // Clave principal (nombre de tabla)
      descripcion:
        "Registra las diferentes tarifas disponibles en el sistema. Cada tarifa tiene un identificador único y una denominación que la describe.",
      tabla: `tarifas`, // Nombre de la tabla principal
      columnas: {
        ID: "Identificador único de la tarifa (Clave Primaria).",
        TP_DENO: "Denominación o descripción de la tarifa (ej: 'Tarifa A', 'Tarifa por Volumen').",
      },
      relaciones: {
        // 
        
      },
      ejemplos: {
        consulta_tarifa_por_id:
          "Obtener la denominación de una tarifa específica utilizando su 'ID'.",
        listar_todas_las_tarifas:
          "Recuperar todos los identificadores y denominaciones de las tarifas disponibles en el sistema.",
      },
    },
  



};

module.exports = mapaERP; 