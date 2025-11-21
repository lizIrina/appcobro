// db se importa dinámicamente en cada función para evitar problemas de inicialización
const { getDb } = require('../db');

class Payment {
  constructor(data) {
    this.id = data.id;
    this.created_at = data.created_at;
    this.state = data.state;
    this.amount = data.amount;
    this.name_user = data.name_user;
    this.client_name = data.client_name;
    this.transaction_code = data.transaction_code;
    this.bank = data.bank;
  }

  // Insertar pago sin duplicar
  static async insert(paymentData, connection = null) {
    const conn = connection || await getDb();
    const sql = `
      INSERT INTO payments (id, created_at, state, amount, name_user, client_name, transaction_code, bank)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        created_at = VALUES(created_at),
        state = VALUES(state),
        amount = VALUES(amount),
        name_user = VALUES(name_user),
        client_name = VALUES(client_name),
        transaction_code = VALUES(transaction_code),
        bank = VALUES(bank)
    `;
    const values = [
      paymentData.id,
      paymentData.created_at,
      paymentData.state,
      paymentData.amount,
      paymentData.name_user,
      paymentData.client_name,
      paymentData.transaction_code,
      paymentData.bank
    ];
    const [result] = await conn.execute(sql, values);
    return result;
  }

  // Obtener pagos por rango de fechas
  static async getByDateRange(startDate, endDate) {
    const db = await getDb();
    const sql = 'SELECT * FROM payments WHERE created_at BETWEEN ? AND ? AND state = "success"';
    const [rows] = await db.execute(sql, [startDate, endDate]);
    return rows;
  }

  // Obtener todos los pagos
  static async getAll() {
    const db = await getDb();
    const sql = 'SELECT * FROM payments ORDER BY created_at DESC';
    const [rows] = await db.execute(sql);
    return rows;
  }

  // Insertar transacciones de pago
  static async insertTransactions(paymentId, invoiceNumbers, amounts, connection = null) {
    const conn = connection || await getDb();
    const sql = `
      INSERT INTO payment_transactions (payment_id, invoice_number, applied_amount)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE applied_amount = VALUES(applied_amount)
    `;
    const promises = invoiceNumbers.map((invoice, index) =>
      conn.execute(sql, [paymentId, invoice, amounts[index]])
    );
    await Promise.all(promises);
  }

  // Función para obtener cobros por factura
  static async getCobrosByFactura(normalizedFactura) {
    console.log('🔍 getCobrosByFactura called with normalizedFactura:', normalizedFactura);

    try {
      console.log('📡 Importing db module...');
      const dbModule = require('../db');
      console.log('📦 dbModule imported:', typeof dbModule);

      console.log('🔍 Checking getDb function...');
      const { getDb } = dbModule;
      console.log('✅ getDb function obtained:', typeof getDb);

      console.log('🔌 Getting db connection...');
      const db = await getDb();
      console.log('✅ db connection obtained:', !!db, typeof db);

      if (!db) {
        throw new Error('Database connection is null/undefined');
      }

      const sql = `
        SELECT
          pt.invoice_number AS factura,
          pt.applied_amount AS monto,
          p.created_at AS fecha_pago,
          p.client_name AS cliente,
          p.bank AS banco,
          p.transaction_code AS referencia,
          p.id AS id_pago
        FROM payment_transactions pt
        JOIN payments p ON pt.payment_id = p.id
        WHERE pt.invoice_number = ?
        ORDER BY p.created_at DESC
      `;

      console.log('🔍 Executing SQL query with param:', normalizedFactura);
      const [rows] = await db.execute(sql, [normalizedFactura]);
      console.log('✅ Query executed successfully, rows returned:', rows.length);

      const result = rows.map(row => ({
        factura: row.factura,
        monto: parseFloat(row.monto),
        fecha_pago: row.fecha_pago,
        cliente: row.cliente,
        forma_cobro: 'TRANSFERENCIA',
        banco: row.banco || 'Desconocido',
        referencia: row.referencia,
        id_pago: row.id_pago
      }));

      console.log('📦 Mapped result:', result);
      return result;

    } catch (error) {
      console.error('❌ Error en getCobrosByFactura:', {
        message: error.message,
        stack: error.stack,
        normalizedFactura: normalizedFactura
      });
      throw error;
    }
  }
}

module.exports = Payment;