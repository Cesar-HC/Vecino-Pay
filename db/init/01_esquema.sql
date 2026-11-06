-- VecinoPay: esquema de las 11 tablas del informe (sección 8, Tablas 23 a 33).
-- Idempotente: se ejecuta en cada "docker compose up". Nunca hace DROP; un cambio
-- de esquema en desarrollo exige "docker compose down -v".
-- Las restricciones marcadas "extra" no agregan columnas ni contradicen el informe.
-- Las únicas columnas fuera de la sección 8 son tienda.giro, tienda.telefono y pago.numero_operacion,
-- por decisión de Adrián (docs/escalaciones.md).
USE VecinoPay;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- Tabla 23
IF OBJECT_ID(N'dbo.usuario', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.usuario (
    id            BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_usuario PRIMARY KEY,
    perfil        VARCHAR(15)  NOT NULL,
    username      VARCHAR(120) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombres       VARCHAR(160) NOT NULL,
    estado        VARCHAR(8)   NOT NULL CONSTRAINT DF_usuario_estado DEFAULT 'ACTIVO',
    CONSTRAINT UQ_usuario_username UNIQUE (username),
    CONSTRAINT CK_usuario_perfil CHECK (perfil IN ('ADMIN_SISTEMA', 'DUENO', 'CLIENTE')),
    CONSTRAINT CK_usuario_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'))
  );
END;
GO

-- Tabla 24
IF OBJECT_ID(N'dbo.tienda', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.tienda (
    id               BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_tienda PRIMARY KEY,
    duenio_id        BIGINT        NOT NULL,
    ruc              CHAR(11)      NOT NULL,
    razon_social     VARCHAR(150)  NOT NULL,
    nombre_comercial VARCHAR(100)  NOT NULL,
    giro             VARCHAR(40)   NOT NULL, -- decisión de Adrián: no está en la Tabla 24 (A02, A03)
    direccion        VARCHAR(200)  NULL,
    telefono         VARCHAR(15)   NULL,     -- decisión de Adrián: no está en la Tabla 24 (A03)
    cok_tea          DECIMAL(12,9) NOT NULL,
    estado           VARCHAR(8)    NOT NULL CONSTRAINT DF_tienda_estado DEFAULT 'ACTIVO',
    CONSTRAINT FK_tienda_usuario FOREIGN KEY (duenio_id) REFERENCES dbo.usuario (id),
    CONSTRAINT UQ_tienda_ruc UNIQUE (ruc),
    CONSTRAINT CK_tienda_ruc CHECK (ruc LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
    CONSTRAINT CK_tienda_cok CHECK (cok_tea > 0),
    CONSTRAINT CK_tienda_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'))
  );
END;
GO

-- Tabla 25
IF OBJECT_ID(N'dbo.producto', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.producto (
    id              BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_producto PRIMARY KEY,
    tienda_id       BIGINT        NOT NULL,
    codigo          VARCHAR(30)   NOT NULL,
    nombre          VARCHAR(120)  NOT NULL,
    marca           VARCHAR(60)   NULL,
    descripcion     VARCHAR(500)  NULL,
    unidad          VARCHAR(5)    NOT NULL,
    proveedor       VARCHAR(150)  NULL,
    imagen_url      VARCHAR(300)  NULL,
    precio_contado  DECIMAL(10,2) NOT NULL,
    precio_lista    DECIMAL(10,2) NOT NULL,
    permite_fin_mes BIT           NOT NULL,
    permite_cuotas  BIT           NOT NULL,
    estado          VARCHAR(8)    NOT NULL CONSTRAINT DF_producto_estado DEFAULT 'ACTIVO',
    CONSTRAINT FK_producto_tienda FOREIGN KEY (tienda_id) REFERENCES dbo.tienda (id),
    CONSTRAINT UQ_producto_tienda_codigo UNIQUE (tienda_id, codigo),
    CONSTRAINT CK_producto_contado CHECK (precio_contado > 0),
    CONSTRAINT CK_producto_lista CHECK (precio_lista >= precio_contado),
    CONSTRAINT CK_producto_modalidad CHECK (permite_fin_mes = 1 OR permite_cuotas = 1),
    CONSTRAINT CK_producto_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'))
  );
END;
GO

-- Tabla 26
IF OBJECT_ID(N'dbo.cliente', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cliente (
    id                BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cliente PRIMARY KEY,
    tienda_id         BIGINT         NOT NULL,
    usuario_id        BIGINT         NULL,
    dni               CHAR(8)        NOT NULL,
    nombres           VARCHAR(80)    NOT NULL,
    apellidos         VARCHAR(80)    NOT NULL,
    celular           VARCHAR(15)    NULL,
    direccion         VARCHAR(200)   NULL,
    moneda            CHAR(3)        NOT NULL CONSTRAINT DF_cliente_moneda DEFAULT 'PEN',
    limite_credito    DECIMAL(12,2)  NOT NULL,
    max_meses         SMALLINT       NOT NULL,
    dia_corte         TINYINT        NOT NULL,
    hora_corte        TIME           NOT NULL CONSTRAINT DF_cliente_hora_corte DEFAULT '17:00:00',
    dia_pago          TINYINT        NOT NULL,
    tipo_tasa         VARCHAR(8)     NOT NULL,
    valor_tasa        DECIMAL(12,9)  NOT NULL,
    plazo_tasa        SMALLINT       NOT NULL,
    capitalizacion    SMALLINT       NULL,
    tipo_tasa_mora    VARCHAR(8)     NOT NULL,
    valor_tasa_mora   DECIMAL(12,9)  NOT NULL,
    ted               DECIMAL(18,15) NOT NULL,
    ted_mora          DECIMAL(18,15) NOT NULL,
    codigo_activacion VARCHAR(10)    NULL,
    estado            VARCHAR(8)     NOT NULL CONSTRAINT DF_cliente_estado DEFAULT 'ACTIVO',
    CONSTRAINT FK_cliente_tienda FOREIGN KEY (tienda_id) REFERENCES dbo.tienda (id),
    CONSTRAINT FK_cliente_usuario FOREIGN KEY (usuario_id) REFERENCES dbo.usuario (id),
    CONSTRAINT UQ_cliente_tienda_dni UNIQUE (tienda_id, dni),
    CONSTRAINT UQ_cliente_id_tienda UNIQUE (id, tienda_id), -- extra: destino de las FK compuestas
    CONSTRAINT CK_cliente_dni CHECK (dni LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
    CONSTRAINT CK_cliente_moneda CHECK (moneda IN ('PEN', 'USD')),
    CONSTRAINT CK_cliente_limite CHECK (limite_credito > 0),
    CONSTRAINT CK_cliente_max_meses CHECK (max_meses BETWEEN 1 AND 12),
    CONSTRAINT CK_cliente_dia_corte CHECK (dia_corte BETWEEN 1 AND 28),
    CONSTRAINT CK_cliente_dia_pago CHECK (dia_pago BETWEEN 1 AND 28),
    CONSTRAINT CK_cliente_dias_distintos CHECK (dia_pago <> dia_corte),
    CONSTRAINT CK_cliente_hora_corte CHECK (hora_corte = '17:00:00'),
    CONSTRAINT CK_cliente_tipo_tasa CHECK (tipo_tasa IN ('EFECTIVA', 'NOMINAL')),
    CONSTRAINT CK_cliente_valor_tasa CHECK (valor_tasa > 0),
    CONSTRAINT CK_cliente_plazo_tasa CHECK (plazo_tasa IN (1, 15, 30, 60, 90, 120, 180, 360)),
    CONSTRAINT CK_cliente_capitalizacion CHECK (
      (tipo_tasa = 'EFECTIVA' AND capitalizacion IS NULL)
      OR (tipo_tasa = 'NOMINAL' AND capitalizacion IS NOT NULL
          AND capitalizacion IN (1, 15, 30, 60, 90, 120, 180, 360)
          AND capitalizacion <= plazo_tasa)
    ),
    CONSTRAINT CK_cliente_tipo_mora CHECK (tipo_tasa_mora IN ('EFECTIVA', 'NOMINAL')),
    CONSTRAINT CK_cliente_valor_mora CHECK (valor_tasa_mora > 0),
    CONSTRAINT CK_cliente_ted CHECK (ted > 0),
    CONSTRAINT CK_cliente_ted_mora CHECK (ted_mora > 0),
    CONSTRAINT CK_cliente_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'))
  );
END;
GO

-- Tabla 34: usuario → cliente es 1:1 opcional (un UNIQUE normal solo admitiría un NULL).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_cliente_usuario' AND object_id = OBJECT_ID(N'dbo.cliente'))
  CREATE UNIQUE INDEX UX_cliente_usuario ON dbo.cliente (usuario_id) WHERE usuario_id IS NOT NULL;
GO

-- Extra: la activación busca por tienda y código.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_cliente_codigo' AND object_id = OBJECT_ID(N'dbo.cliente'))
  CREATE UNIQUE INDEX UX_cliente_codigo ON dbo.cliente (tienda_id, codigo_activacion) WHERE codigo_activacion IS NOT NULL;
GO

-- Tabla 27
IF OBJECT_ID(N'dbo.compra', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.compra (
    id                   BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_compra PRIMARY KEY,
    tienda_id            BIGINT         NOT NULL,
    cliente_id           BIGINT         NOT NULL,
    ticket               VARCHAR(20)    NOT NULL,
    fecha_hora           DATETIME2      NOT NULL, -- hora local de Lima, tomada del servidor
    modalidad            VARCHAR(7)     NOT NULL,
    monto_lista          DECIMAL(12,2)  NOT NULL,
    monto_contado        DECIMAL(12,2)  NOT NULL,
    fecha_corte          DATE           NOT NULL,
    fecha_pago           DATE           NOT NULL,
    num_cuotas           SMALLINT       NULL,
    dias_gracia          SMALLINT       NULL,
    capital_capitalizado DECIMAL(12,2)  NULL,
    tem                  DECIMAL(18,15) NULL,
    cuota_fija           DECIMAL(12,2)  NULL,
    tcea                 DECIMAL(16,10) NULL,
    van                  DECIMAL(12,2)  NULL,
    estado               VARCHAR(10)    NOT NULL CONSTRAINT DF_compra_estado DEFAULT 'PENDIENTE',
    CONSTRAINT FK_compra_tienda FOREIGN KEY (tienda_id) REFERENCES dbo.tienda (id),
    CONSTRAINT FK_compra_cliente FOREIGN KEY (cliente_id, tienda_id) REFERENCES dbo.cliente (id, tienda_id),
    CONSTRAINT UQ_compra_tienda_ticket UNIQUE (tienda_id, ticket),
    CONSTRAINT CK_compra_modalidad CHECK (modalidad IN ('FIN_MES', 'CUOTAS')),
    CONSTRAINT CK_compra_lista CHECK (monto_lista > 0),
    CONSTRAINT CK_compra_contado CHECK (monto_contado > 0 AND monto_contado <= monto_lista),
    CONSTRAINT CK_compra_estado CHECK (estado IN ('PENDIENTE', 'PAGADA', 'ANULADA')),
    CONSTRAINT CK_compra_campos_cuotas CHECK (
      (modalidad = 'CUOTAS' AND num_cuotas IS NOT NULL AND dias_gracia IS NOT NULL
        AND capital_capitalizado IS NOT NULL AND tem IS NOT NULL AND cuota_fija IS NOT NULL
        AND tcea IS NOT NULL AND van IS NOT NULL)
      OR (modalidad = 'FIN_MES' AND num_cuotas IS NULL AND dias_gracia IS NULL
        AND capital_capitalizado IS NULL AND tem IS NULL AND cuota_fija IS NULL
        AND tcea IS NULL AND van IS NULL)
    ),
    CONSTRAINT CK_compra_num_cuotas CHECK (num_cuotas BETWEEN 1 AND 12), -- extra (Tabla 6)
    CONSTRAINT CK_compra_fechas CHECK (fecha_pago > fecha_corte)         -- extra (6.3g)
  );
END;
GO

-- Tabla 28
IF OBJECT_ID(N'dbo.compra_detalle', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.compra_detalle (
    id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_compra_detalle PRIMARY KEY,
    compra_id      BIGINT        NOT NULL,
    producto_id    BIGINT        NOT NULL,
    cantidad       DECIMAL(10,3) NOT NULL,
    precio_lista   DECIMAL(10,2) NOT NULL,
    precio_contado DECIMAL(10,2) NOT NULL,
    subtotal       DECIMAL(12,2) NOT NULL,
    CONSTRAINT FK_detalle_compra FOREIGN KEY (compra_id) REFERENCES dbo.compra (id),
    CONSTRAINT FK_detalle_producto FOREIGN KEY (producto_id) REFERENCES dbo.producto (id),
    CONSTRAINT CK_detalle_cantidad CHECK (cantidad > 0),
    CONSTRAINT CK_detalle_subtotal CHECK (subtotal = ROUND(cantidad * precio_lista, 2)),
    CONSTRAINT CK_detalle_precios CHECK (precio_contado > 0 AND precio_lista >= precio_contado) -- extra (Tabla 25)
  );
END;
GO

-- Tabla 29
IF OBJECT_ID(N'dbo.cuota', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cuota (
    id                BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cuota PRIMARY KEY,
    compra_id         BIGINT        NOT NULL,
    numero            SMALLINT      NOT NULL,
    fecha_vencimiento DATE          NOT NULL,
    saldo_inicial     DECIMAL(12,2) NOT NULL,
    interes           DECIMAL(12,2) NOT NULL,
    amortizacion      DECIMAL(12,2) NOT NULL,
    monto             DECIMAL(12,2) NOT NULL,
    saldo_final       DECIMAL(12,2) NOT NULL,
    estado            VARCHAR(10)   NOT NULL CONSTRAINT DF_cuota_estado DEFAULT 'PENDIENTE',
    CONSTRAINT FK_cuota_compra FOREIGN KEY (compra_id) REFERENCES dbo.compra (id),
    CONSTRAINT UQ_cuota_compra_numero UNIQUE (compra_id, numero),
    CONSTRAINT CK_cuota_monto CHECK (monto = interes + amortizacion),
    CONSTRAINT CK_cuota_saldo_final CHECK (saldo_final >= 0),
    CONSTRAINT CK_cuota_estado CHECK (estado IN ('PENDIENTE', 'PAGADA')),
    CONSTRAINT CK_cuota_numero CHECK (numero >= 1),                               -- extra
    CONSTRAINT CK_cuota_cuadre CHECK (saldo_final = saldo_inicial - amortizacion) -- extra (6.3j)
  );
END;
GO

-- Tabla 30
IF OBJECT_ID(N'dbo.listado_pago', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.listado_pago (
    id              BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_listado_pago PRIMARY KEY,
    tienda_id       BIGINT        NOT NULL,
    cliente_id      BIGINT        NOT NULL,
    numero          VARCHAR(20)   NOT NULL,
    fecha_corte     DATE          NOT NULL,
    fecha_pago      DATE          NOT NULL,
    total_capital   DECIMAL(12,2) NOT NULL,
    total_interes   DECIMAL(12,2) NOT NULL,
    total_mora      DECIMAL(12,2) NOT NULL CONSTRAINT DF_listado_mora DEFAULT 0,
    total           DECIMAL(12,2) NOT NULL,
    estado          VARCHAR(10)   NOT NULL CONSTRAINT DF_listado_estado DEFAULT 'EMITIDO',
    fecha_pago_real DATE          NULL,
    dias_mora       SMALLINT      NULL,
    CONSTRAINT FK_listado_tienda FOREIGN KEY (tienda_id) REFERENCES dbo.tienda (id),
    CONSTRAINT FK_listado_cliente FOREIGN KEY (cliente_id, tienda_id) REFERENCES dbo.cliente (id, tienda_id),
    CONSTRAINT UQ_listado_cliente_corte UNIQUE (cliente_id, fecha_corte),
    CONSTRAINT UQ_listado_tienda_numero UNIQUE (tienda_id, numero), -- extra
    CONSTRAINT CK_listado_total CHECK (total = total_capital + total_interes + total_mora),
    CONSTRAINT CK_listado_estado CHECK (estado IN ('EMITIDO', 'PAGADO', 'VENCIDO')),
    CONSTRAINT CK_listado_componentes CHECK (total_capital >= 0 AND total_interes >= 0 AND total_mora >= 0), -- extra
    CONSTRAINT CK_listado_fechas CHECK (fecha_pago > fecha_corte), -- extra
    CONSTRAINT CK_listado_pagado CHECK ( -- extra: fecha real y días de mora se llenan solo al pagar
      (estado = 'PAGADO' AND fecha_pago_real IS NOT NULL AND dias_mora IS NOT NULL)
      OR (estado <> 'PAGADO' AND fecha_pago_real IS NULL AND dias_mora IS NULL)
    ),
    CONSTRAINT CK_listado_dias_mora CHECK (dias_mora >= 0) -- extra
  );
END;
GO

-- Tabla 31
IF OBJECT_ID(N'dbo.listado_item', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.listado_item (
    id         BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_listado_item PRIMARY KEY,
    listado_id BIGINT        NOT NULL,
    compra_id  BIGINT        NULL,
    cuota_id   BIGINT        NULL,
    orden      SMALLINT      NOT NULL,
    tipo       VARCHAR(6)    NOT NULL,
    fecha      DATE          NOT NULL,
    dias       SMALLINT      NOT NULL,
    capital    DECIMAL(12,2) NOT NULL,
    interes    DECIMAL(12,2) NOT NULL,
    mora       DECIMAL(12,2) NOT NULL,
    total      DECIMAL(12,2) NOT NULL,
    CONSTRAINT FK_item_listado FOREIGN KEY (listado_id) REFERENCES dbo.listado_pago (id),
    CONSTRAINT FK_item_compra FOREIGN KEY (compra_id) REFERENCES dbo.compra (id),
    CONSTRAINT FK_item_cuota FOREIGN KEY (cuota_id) REFERENCES dbo.cuota (id),
    CONSTRAINT UQ_item_listado_orden UNIQUE (listado_id, orden), -- extra
    CONSTRAINT CK_item_tipo CHECK (tipo IN ('COMPRA', 'CUOTA', 'MORA')),
    CONSTRAINT CK_item_total CHECK (total = capital + interes + mora),
    CONSTRAINT CK_item_por_tipo CHECK (
      (tipo = 'COMPRA' AND compra_id IS NOT NULL AND cuota_id IS NULL)
      OR (tipo = 'CUOTA' AND cuota_id IS NOT NULL AND compra_id IS NULL)
      OR (tipo = 'MORA' AND compra_id IS NULL AND cuota_id IS NULL AND capital = 0 AND interes = 0)
    ),
    CONSTRAINT CK_item_orden CHECK (orden >= 1), -- extra
    CONSTRAINT CK_item_montos CHECK (capital >= 0 AND interes >= 0 AND mora >= 0 AND dias >= 0) -- extra
  );
END;
GO

-- Tabla 32
IF OBJECT_ID(N'dbo.pago', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.pago (
    id               BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_pago PRIMARY KEY,
    listado_id       BIGINT        NOT NULL,
    fecha            DATE          NOT NULL,
    monto            DECIMAL(12,2) NOT NULL,
    medio_pago       VARCHAR(15)   NOT NULL,
    numero_operacion VARCHAR(30)   NULL, -- decisión de Adrián: no está en la Tabla 32 (D07, C07)
    mora_aplicada    DECIMAL(12,2) NOT NULL,
    interes_aplicado DECIMAL(12,2) NOT NULL,
    capital_aplicado DECIMAL(12,2) NOT NULL,
    CONSTRAINT FK_pago_listado FOREIGN KEY (listado_id) REFERENCES dbo.listado_pago (id),
    CONSTRAINT UQ_pago_listado UNIQUE (listado_id),
    CONSTRAINT CK_pago_monto CHECK (monto = mora_aplicada + interes_aplicado + capital_aplicado),
    CONSTRAINT CK_pago_medio CHECK (medio_pago IN ('Efectivo', 'Yape', 'Plin', 'Transferencia')),
    CONSTRAINT CK_pago_positivo CHECK (monto > 0), -- extra
    CONSTRAINT CK_pago_aplicados CHECK (mora_aplicada >= 0 AND interes_aplicado >= 0 AND capital_aplicado >= 0) -- extra
  );
END;
GO

-- Tabla 33
IF OBJECT_ID(N'dbo.auditoria', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.auditoria (
    id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_auditoria PRIMARY KEY,
    usuario_id  BIGINT        NULL,
    tienda_id   BIGINT        NULL,
    fecha_hora  DATETIME2     NOT NULL
      CONSTRAINT DF_auditoria_fecha DEFAULT CONVERT(DATETIME2, SYSDATETIMEOFFSET() AT TIME ZONE 'SA Pacific Standard Time'),
    accion      VARCHAR(15)   NOT NULL,
    tabla       VARCHAR(40)   NOT NULL,
    registro_id BIGINT        NULL,
    detalle     NVARCHAR(MAX) NULL,
    CONSTRAINT FK_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES dbo.usuario (id),
    CONSTRAINT FK_auditoria_tienda FOREIGN KEY (tienda_id) REFERENCES dbo.tienda (id),
    CONSTRAINT CK_auditoria_accion CHECK (accion IN ('ALTA', 'BAJA', 'CAMBIO', 'LOGIN', 'RECHAZO'))
  );
END;
GO

-- Tabla 33: la auditoría solo admite inserciones.
CREATE OR ALTER TRIGGER dbo.TR_auditoria_solo_insercion ON dbo.auditoria
INSTEAD OF UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;
  ;THROW 50001, N'La auditoría solo admite inserciones.', 1;
END;
GO

-- Aislamiento multitienda sin columnas nuevas (las Tablas 28 y 31 no tienen tienda_id).
CREATE OR ALTER TRIGGER dbo.TR_compra_detalle_misma_tienda ON dbo.compra_detalle
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT 1
    FROM inserted i
    JOIN dbo.compra c ON c.id = i.compra_id
    JOIN dbo.producto p ON p.id = i.producto_id
    WHERE p.tienda_id <> c.tienda_id
  )
  BEGIN
    ;THROW 50002, N'El producto debe pertenecer a la misma tienda que la compra.', 1;
  END;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_listado_item_mismo_cliente ON dbo.listado_item
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT 1
    FROM inserted i
    JOIN dbo.listado_pago l ON l.id = i.listado_id
    LEFT JOIN dbo.cuota q ON q.id = i.cuota_id
    JOIN dbo.compra c ON c.id = COALESCE(i.compra_id, q.compra_id)
    WHERE c.cliente_id <> l.cliente_id
       OR (i.tipo = 'COMPRA' AND c.modalidad <> 'FIN_MES')
       OR (i.tipo = 'CUOTA' AND c.modalidad <> 'CUOTAS')
  )
  BEGIN
    ;THROW 50003, N'El ítem debe ser del mismo cliente del listado y coincidir con la modalidad de la compra.', 1;
  END;
END;
GO

PRINT 'Esquema de VecinoPay listo (11 tablas).';
GO
