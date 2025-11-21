# App de Cobros - API Backend

Backend automático para procesamiento de pagos y facturas usando archivos CSV. Sistema completo de reconciliación contable con inicialización automática.

## 🚀 Instalación Rápida

```bash
npm install
cp .env.example .env  # Configurar BD
npm start            # Inicia automáticamente
```

## 💡 Explicaciones Importantes

### 🔍 ¿Por qué NO replicamos todos los campos del sistema original?

**Respuesta corta:** No consumimos la API real de Wispro, solo trabajamos con los CSV proporcionados.

#### 📋 Contexto del desarrollo:
- ❌ **No teníamos credenciales** para la API real de Wispro
- ❌ **No teníamos endpoints oficiales** ni tokens de autenticación
- ❌ **No teníamos conexión HTTP** directa con Wispro
- ✅ **Solo teníamos archivos CSV** (`wispro.csv` y `facturas.csv`)

#### 📊 Campos disponibles vs. esperados:
Los CSV contenían **únicamente** estos campos reales:
- `id`, `created_at`, `state`, `amount`, `name_user`, `client_name`
- `payment_transactions_invoice_numbers`, `payment_transactions_amounts`
- `invoice_number`, `total_amount`, `client`, `emission_date`

**NO contenían** campos como:
- ID interno de Wispro, UID global, campos de auditoría
- Geolocalización, código de plan, código de servicio
- Estructura de contratos, formas de pago predefinidas
- Metadatos contables del sistema real

#### ✅ Conclusión funcional:
**Replicar toda la estructura hubiera sido:**
- ❌ Innecesario (no teníamos acceso a esos datos)
- ❌ Imposible (campos no existían en los CSV)
- ❌ Confuso y excesivo

**La aplicación funciona perfectamente** con los datos disponibles y cumple todos los requerimientos del flujo de reconciliación contable.

---

### 📁 Formato de Archivos CSV

#### `data/wispro.csv` (Pagos de Wispro)
```csv
id;created_at;state;amount;name_user;client_name;payment_transactions_invoice_numbers;payment_transactions_amounts
550e8400-e29b-41d4-a716-01;2025-01-05T10:00:00;success;20.50;Juan Pérez;Tecnología S.A.;(A-0001-00001001-A-0001-00001002);(10.25,10.25)
```

**Campos importantes:**
- `payment_transactions_invoice_numbers`: Facturas pagadas (formato: `(FAC1-FAC2)`)
- `payment_transactions_amounts`: Montos aplicados (formato: `(10.25,10.25)`)

#### `data/facturas.csv` (Facturas)
```csv
invoice_number;total_amount;client;emission_date
A-0001-00001001;20.50;Tecnología S.A.;2025-01-01
```

---

### 🔄 Lógica de Procesamiento de Transacciones

1. **Lectura del CSV**: Se lee `wispro.csv` fila por fila
2. **Parsing de transacciones**:
   - `"(A-0001-00001001-A-0001-00001002)"` → `["A-0001-00001001", "A-0001-00001002"]`
   - `"(10.25,10.25)"` → `[10.25, 10.25]`
3. **Inserción en BD**: Se crean registros en `payment_transactions`
4. **Relación**: Cada pago puede tener múltiples facturas pagadas

---

### 📊 Lógica de Comparación Pagos vs Facturas

Para cada factura en la BD:
1. **Suma total pagado**: Busca todas las transacciones relacionadas
2. **Compara montos**:
   - `EXACTA`: `total_pagado == total_factura`
   - `PARCIAL`: `total_pagado < total_factura`
   - `SOBREPAGO`: `total_pagado > total_factura`
   - `NO ENCONTRADA`: Sin transacciones asociadas
3. **Genera resultado**: Incluye banco, referencia, cliente

---

### 🎯 Formato Contífico (Endpoint `/cobros`)

El endpoint `/api/invoices/{numero}/cobros` devuelve datos en formato compatible con sistemas Contífico:

```json
[
  {
    "factura": "A-0001-00001001",
    "monto": 10.25,
    "fecha_pago": "2025-01-05T15:00:00.000Z",
    "cliente": "Tecnología S.A.",
    "forma_cobro": "TRANSFERENCIA",
    "banco": "Desconocido",
    "referencia": "550e8400-e29b-41d4-a716-01",
    "id_pago": "550e8400-e29b-41d4-a716-01"
  }
]
```

---

### 🗄️ Estructura de Base de Datos

#### Tablas principales:
- **`payments`**: Pagos importados de Wispro
- **`invoices`**: Facturas importadas
- **`payment_transactions`**: Desglose de pagos por factura
- **`processed_invoices`**: Resultados de comparación clasificados
- **`logs`**: Registro de operaciones del sistema

#### Relaciones:
```
payments (1) ──── (N) payment_transactions (N) ──── (1) invoices
```

---

### ⚡ Inicio Automático Detallado

Al ejecutar `npm start`:

1. **Verificación de BD**: Crea `appcobro` si no existe
2. **Creación de tablas**: Ejecuta DDL automáticamente
3. **Verificación de datos**: Consulta `COUNT(*)` en tablas
4. **Importación condicional**: Solo si tablas están vacías
5. **Procesamiento de transacciones**: Parsea y crea relaciones
6. **Inicio del servidor**: Puerto 3000 listo

**¡Cero configuración manual requerida!**

---

## 📋 API Endpoints - Todas las Rutas Disponibles

## 🛠️ **Guía para Thunder Client**

### **Para peticiones GET:**
- **Method:** `GET`
- **URL:** Copia la URL completa
- **Headers:** Ninguno requerido
- **Body:** Vacío

### **Para peticiones POST:**
- **Method:** `POST`
- **URL:** Copia la URL completa
- **Headers:**
  ```
  Content-Type: application/json
  ```
- **Body:** Selecciona "JSON" y pega el contenido JSON

### **Ejemplo completo en Thunder Client:**
1. **Method:** `POST`
2. **URL:** `http://localhost:3000/api/process/compare`
3. **Headers:** Agrega `Content-Type: application/json`
4. **Body:** Selecciona tipo "JSON" y pega:
   ```json
   {
     "startDate": "2025-01-01",
     "endDate": "2025-12-31"
   }
   ```
5. **Send** → Obtén la respuesta

---

### 🏠 **Raíz**
**Thunder Client Config:**
- **Method:** `GET`
- **URL:** `http://localhost:3000/`
- **Headers:** Ninguno requerido
- **Body:** Vacío

**Respuesta:**
```json
{"message": "API de App de Cobros funcionando"}
```

---

### 📄 **Facturas (/api/invoices)**

#### 1. Obtener todas las facturas
**Thunder Client Config:**
- **Method:** `GET`
- **URL:** `http://localhost:3000/api/invoices`
- **Headers:** Ninguno requerido
- **Body:** Vacío

**Respuesta (primeros 2 registros):**
```json
[
  {
    "id": 1,
    "invoice_number": "A-0001-00001001",
    "emission_date": null,
    "total_amount": "20.50",
    "state": "pending",
    "client": "Tecnología S.A.",
    "normalized_number": "A-0001-00001001",
    "imported_at": "2025-11-21T05:16:01.000Z"
  },
  {
    "id": 2,
    "invoice_number": "A-0001-00001002",
    "emission_date": null,
    "total_amount": "20.50",
    "state": "pending",
    "client": "Tecnología S.A.",
    "normalized_number": "A-0001-00001002",
    "imported_at": "2025-11-21T05:16:01.000Z"
  }
]
```

#### 2. Obtener factura específica
**Thunder Client Config:**
- **Method:** `GET`
- **URL:** `http://localhost:3000/api/invoices/A-0001-00001001`
- **Headers:** Ninguno requerido
- **Body:** Vacío

**Respuesta:**
```json
{
  "id": 1,
  "invoice_number": "A-0001-00001001",
  "emission_date": null,
  "total_amount": "20.50",
  "state": "pending",
  "client": "Tecnología S.A.",
  "normalized_number": "A-0001-00001001",
  "imported_at": "2025-11-21T05:16:01.000Z"
}
```

#### 3. Obtener cobros de una factura (Formato Contífico)
**Thunder Client Config:**
- **Method:** `GET`
- **URL:** `http://localhost:3000/api/invoices/A-0001-00001001/cobros`
- **Headers:** Ninguno requerido
- **Body:** Vacío

**Respuesta:**
```json
[
  {
    "factura": "A-0001-00001001",
    "monto": 10.25,
    "fecha_pago": "2025-01-05T15:00:00.000Z",
    "cliente": "Tecnología S.A.",
    "forma_cobro": "TRANSFERENCIA",
    "banco": "Desconocido",
    "referencia": "550e8400-e29b-41d4-a716-01",
    "id_pago": "550e8400-e29b-41d4-a716-01"
  }
]
```

---

### 💰 **Pagos (/api/payments)**

#### 1. Obtener todos los pagos
**Thunder Client Config:**
- **Method:** `GET`
- **URL:** `http://localhost:3000/api/payments`
- **Headers:** Ninguno requerido
- **Body:** Vacío

**Respuesta (primeros 2 registros):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-01",
    "created_at": "2025-01-05T10:00:00.000Z",
    "state": "success",
    "amount": "20.50",
    "name_user": "Juan Pérez",
    "client_name": "Tecnología S.A.",
    "transaction_code": "550e8400-e29b-41d4-a716-01",
    "bank": "Desconocido",
    "imported_at": "2025-11-21T05:16:01.000Z"
  },
  {
    "id": "550e8400-e29b-41d4-a716-02",
    "created_at": "2025-01-06T11:30:00.000Z",
    "state": "success",
    "amount": "15.00",
    "name_user": "María López",
    "client_name": "Servicios Globales",
    "transaction_code": "550e8400-e29b-41d4-a716-02",
    "bank": "Desconocido",
    "imported_at": "2025-11-21T05:16:01.000Z"
  }
]
```

#### 2. Obtener pago específico
**Thunder Client Config:**
- **Method:** `GET`
- **URL:** `http://localhost:3000/api/payments/550e8400-e29b-41d4-a716-01`
- **Headers:** Ninguno requerido
- **Body:** Vacío

**Respuesta:**
```json
{
  "id": "550e8400-e29b-41d4-a716-01",
  "created_at": "2025-01-05T10:00:00.000Z",
  "state": "success",
  "amount": "20.50",
  "name_user": "Juan Pérez",
  "client_name": "Tecnología S.A.",
  "transaction_code": "550e8400-e29b-41d4-a716-01",
  "bank": "Desconocido",
  "imported_at": "2025-11-21T05:16:01.000Z"
}
```

---

### ⚙️ **Procesamiento (/api/process)**

#### 1. Procesar comparación pagos vs facturas
**Thunder Client Config:**
- **Method:** `POST`
- **URL:** `http://localhost:3000/api/process/compare`
- **Headers:**
  ```
  Content-Type: application/json
  ```
- **Body (JSON):**
  ```json
  {
    "startDate": "2025-01-01",
    "endDate": "2025-12-31"
  }
  ```

**Respuesta:**
```json
{
  "message": "Comparación completada",
  "results": 52,
  "summary": {
    "exactas": 11,
    "parciales": 18,
    "sobrepagos": 0,
    "noEncontradas": 23
  }
}
```

#### 2. Obtener todos los resultados procesados
**Thunder Client Config:**
- **Method:** `GET`
- **URL:** `http://localhost:3000/api/process/results`
- **Headers:** Ninguno requerido

**Respuesta (ejemplo con datos procesados):**
```json
[
  {
    "id": 157,
    "invoice_number": "A-0001-00001052",
    "total_factura": "22.40",
    "total_pagado": "22.40",
    "diferencia": "0.00",
    "estado": "EXACTA",
    "banco": "Desconocido",
    "referencia_wispro": "550e8400-e29b-41d4-a716-40",
    "cliente": "Call Center",
    "processed_at": "2025-11-21T05:48:35.000Z"
  }
]
```

#### 3. Obtener resultados por estado
**Thunder Client Config:**
- **Method:** `GET`
- **URL:** `http://localhost:3000/api/process/results/EXACTA`
  *(También funciona con: PARCIAL, SOBREPAGO, NO%20ENCONTRADA)*
- **Headers:** Ninguno requerido

**Respuesta (ejemplo EXACTA):**
```json
[
  {
    "id": 157,
    "invoice_number": "A-0001-00001052",
    "total_factura": "22.40",
    "total_pagado": "22.40",
    "diferencia": "0.00",
    "estado": "EXACTA",
    "banco": "Desconocido",
    "referencia_wispro": "550e8400-e29b-41d4-a716-40",
    "cliente": "Call Center",
    "processed_at": "2025-11-21T05:48:35.000Z"
  }
]
```

#### 4. Exportar resultados a Excel
**Thunder Client Config:**
- **Method:** `POST`
- **URL:** `http://localhost:3000/api/process/export-excel`
- **Headers:**
  ```
  Content-Type: application/json
  ```
- **Body (JSON):**
  ```json
  {
    "filePath": "resultados.xlsx"
  }
  ```

**Respuesta:**
```json
{
  "message": "Archivo Excel generado",
  "filePath": "resultados.xlsx",
  "records": 52
}
```

#### 5. Exportar resultados como JSON
**Thunder Client Config:**
- **Method:** `POST`
- **URL:** `http://localhost:3000/api/process/export-json`
- **Headers:** Ninguno requerido
- **Body:** Vacío

**Respuesta:**
```json
{
  "exactas": [
    {
      "documento": "A-0001-00001003",
      "monto_total": "15.00",
      "referencia": "550e8400-e29b-41d4-a716-02",
      "banco": "Desconocido",
      "cliente": "Servicios Globales"
    }
  ],
  "parciales": [
    {
      "documento": "A-0001-00001001",
      "monto_pagado": "10.25",
      "saldo_pendiente": "10.25",
      "cliente": "Tecnología S.A."
    }
  ],
  "no_encontradas": [
    {
      "documento": "A-0001-00001052",
      "monto_factura": "22.40",
      "cliente": "Call Center",
      "error": "Factura no encontrada en pagos"
    }
  ]
}
```

---

## 🔧 Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| DB_HOST | Host MySQL | localhost |
| DB_USER | Usuario MySQL | root |
| DB_PASSWORD | Contraseña MySQL | (vacío) |
| DB_NAME | Base de datos | appcobro |
| PORT | Puerto servidor | 3000 |

## 📊 Estados de Clasificación

- **EXACTA**: `total_pagado == total_factura`
- **PARCIAL**: `total_pagado < total_factura`
- **SOBREPAGO**: `total_pagado > total_factura`
- **NO ENCONTRADA**: Factura sin pagos asociados

## 🚀 Inicio Automático

Al ejecutar `npm start`, el sistema:
1. ✅ Crea BD y tablas automáticamente
2. ✅ Importa datos desde CSV
3. ✅ Crea transacciones relacionadas
4. ✅ Inicia servidor en puerto 3000

**¡No requiere configuración manual!**

---

**App de Cobros - API completa y funcional** 🚀