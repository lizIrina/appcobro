const { getDb } = require('../db');

class ProcessedInvoice {
  constructor(data) {
    this.invoice_number = data.invoice_number;
    this.total_factura = data.total_factura;
    this.total_pagado = data.total_pagado || 0;
    this.diferencia = data.diferencia || 0;
    this.estado = data.estado;
    this.banco = data.banco;
    this.referencia_wispro = data.referencia_wispro;
    this.cliente = data.cliente;
  }

  // Insertar o actualizar resultado procesado
  static async upsert(processedData, connection = null) {
    const conn = connection || await getDb();
    const sql = `
      INSERT INTO processed_invoices
      (invoice_number, total_factura, total_pagado, diferencia, estado, banco, referencia_wispro, cliente)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        total_pagado = VALUES(total_pagado),
        diferencia = VALUES(diferencia),
        estado = VALUES(estado),
        banco = VALUES(banco),
        referencia_wispro = VALUES(referencia_wispro),
        cliente = VALUES(cliente),
        processed_at = CURRENT_TIMESTAMP
    `;
    const values = [
      processedData.invoice_number,
      processedData.total_factura,
      processedData.total_pagado,
      processedData.diferencia,
      processedData.estado,
      processedData.banco,
      processedData.referencia_wispro,
      processedData.cliente
    ];
    const [result] = await conn.execute(sql, values);
    return result;
  }

  // Obtener todos los resultados procesados
  static async getAll() {
    const db = await getDb();
    const sql = 'SELECT * FROM processed_invoices ORDER BY processed_at DESC';
    const [rows] = await db.execute(sql);
    return rows;
  }

  // Obtener por estado
  static async getByEstado(estado) {
    const db = await getDb();
    const sql = 'SELECT * FROM processed_invoices WHERE estado = ? ORDER BY processed_at DESC';
    const [rows] = await db.execute(sql, [estado]);
    return rows;
  }

  // Limpiar resultados anteriores
  static async clearAll() {
    const db = await getDb();
    const sql = 'DELETE FROM processed_invoices';
    await db.execute(sql);
  }

  // Insertar múltiples
  static async insertMultiple(processedInvoices) {
    const promises = processedInvoices.map(invoice => this.upsert(invoice));
    await Promise.all(promises);
  }
}

module.exports = ProcessedInvoice;