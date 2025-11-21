const { getDb } = require('../db');

class Invoice {
  constructor(data) {
    this.invoice_number = data.invoice_number;
    this.emission_date = data.emission_date;
    this.total_amount = data.total_amount;
    this.state = data.state;
    this.client = data.client;
    this.normalized_number = this.normalizeNumber(data.invoice_number);
  }

  // Normalizar número de factura (quitar espacios, ceros a la izquierda)
  normalizeNumber(number) {
    return number.replace(/\s+/g, '').replace(/^0+/, '');
  }

  // Insertar factura
  static async insert(invoiceData, connection = null) {
    const conn = connection || await getDb();
    const normalized = new Invoice(invoiceData).normalized_number;
    const sql = `
      INSERT INTO invoices (invoice_number, emission_date, total_amount, state, client, normalized_number)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        emission_date = VALUES(emission_date),
        total_amount = VALUES(total_amount),
        state = VALUES(state),
        client = VALUES(client),
        normalized_number = VALUES(normalized_number)
    `;
    const values = [
      invoiceData.invoice_number,
      invoiceData.emission_date,
      invoiceData.total_amount,
      invoiceData.state,
      invoiceData.client,
      normalized
    ];
    const [result] = await conn.execute(sql, values);
    return result;
  }

  // Obtener factura por número normalizado
  static async getByNormalizedNumber(normalizedNumber) {
    const db = await getDb();
    const sql = 'SELECT * FROM invoices WHERE normalized_number = ?';
    const [rows] = await db.execute(sql, [normalizedNumber]);
    return rows[0];
  }

  // Obtener todas las facturas
  static async getAll() {
    const db = await getDb();
    const sql = 'SELECT * FROM invoices ORDER BY emission_date DESC';
    const [rows] = await db.execute(sql);
    return rows;
  }

  // Buscar facturas por cliente
  static async getByClient(client) {
    const db = await getDb();
    const sql = 'SELECT * FROM invoices WHERE client LIKE ?';
    const [rows] = await db.execute(sql, [`%${client}%`]);
    return rows;
  }

  // Insertar múltiples facturas
  static async insertMultiple(invoices) {
    const promises = invoices.map(invoice => this.insert(invoice));
    await Promise.all(promises);
  }
}

module.exports = Invoice;