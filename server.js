require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const mysql = require('mysql2/promise');
const CsvService = require('./src/services/csv.service');
const Payment = require('./models/Payment');
const Invoice = require('./models/Invoice');
const Logger = require('./models/Logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Función de inicialización automática
async function initializeDatabase() {
  let connection;
  try {
    console.log('Verificando y creando tablas...');

    // Crear conexión local
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: 'appcobro',
      multipleStatements: true
    });

    // Leer el archivo SQL
    const sqlContent = fs.readFileSync('db/init.sql', 'utf8');
    // Remover CREATE DATABASE y USE
    let sqlStatements = sqlContent
      .replace(/CREATE DATABASE IF NOT EXISTS appcobro;\s*USE appcobro;\s*/, '')
      .replace(/--.*$/gm, '') // Remover comentarios
      .trim();

    // Dividir en statements individuales
    const statements = sqlStatements
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    // Ejecutar cada statement por separado
    for (const statement of statements) {
      if (statement) {
        try {
          await connection.execute(statement + ';');
        } catch (error) {
          // Ignorar errores de índices duplicados
          if (!error.message.includes('Duplicate key name')) {
            throw error;
          }
          console.log(`Índice ya existe, omitiendo: ${statement}`);
        }
      }
    }

    console.log('Tablas verificadas/creadas');

    // Verificar si las tablas están vacías
    const [paymentsCount] = await connection.execute('SELECT COUNT(*) as count FROM payments');
    const [invoicesCount] = await connection.execute('SELECT COUNT(*) as count FROM invoices');

    if (paymentsCount[0].count === 0 && invoicesCount[0].count === 0) {
      console.log('Tablas vacías, importando datos desde CSV...');

      // Importar pagos
      let paymentsInserted = 0;
      let transactionsInserted = 0;
      try {
        const wisproData = await CsvService.parseCsv('wispro.csv');
        for (const row of wisproData) {
          const id = row.id_pago || row.id;
          const transactionCode = row.transaction_code || row.id_pago || row.id;

          if (!id || !transactionCode) {
            console.log('Fila de pago inválida, omitiendo:', row);
            continue;
          }

          const paymentData = {
            id: id,
            created_at: row.created_at || new Date().toISOString().slice(0, 19).replace('T', ' '),
            state: row.state || 'success',
            amount: CsvService.parseAmount(row.amount || '0'),
            name_user: row.name_user || '',
            client_name: row.client_name || '',
            transaction_code: transactionCode,
            bank: 'Desconocido' // No hay campo bank en este CSV
          };

          await Payment.insert(paymentData, connection);
          paymentsInserted++;

          // Procesar transacciones si existen
          try {
            if (row.payment_transactions_invoice_numbers && row.payment_transactions_amounts) {
              // Parsear los strings con formato (valor1-valor2) y (monto1,monto2)
              const invoiceNumbersStr = row.payment_transactions_invoice_numbers.replace(/[()]/g, '');
              const amountsStr = row.payment_transactions_amounts.replace(/[()]/g, '');

              // CORRECCIÓN: Usar regex para capturar números de factura completos A-xxxx-xxxxxxxxx
              const invoicePattern = /A-\d{4}-\d{8}/g;
              const invoiceNumbers = invoiceNumbersStr.match(invoicePattern) || [];
              const amounts = amountsStr.split(',').map(a => CsvService.parseAmount(a.trim()));

              if (invoiceNumbers.length > 0 && amounts.length > 0 && invoiceNumbers.length === amounts.length) {
                await Payment.insertTransactions(paymentData.id, invoiceNumbers, amounts, connection);
                transactionsInserted += invoiceNumbers.length;
              }
            }
          } catch (transactionError) {
            console.log(`⚠️ Error procesando transacciones para pago ${paymentData.id}:`, transactionError.message);
            // Continuar con la importación del pago aunque fallen las transacciones
          }
        }
      } catch (error) {
        console.log('No se pudo importar wispro.csv:', error.message);
      }

      // Importar facturas
      let invoicesInserted = 0;
      try {
        const facturasData = await CsvService.parseCsv('facturas.csv');
        for (const row of facturasData) {
          const invoiceNumber = row.invoice_number || row.numero_factura || row.documento_numero;

          if (!invoiceNumber) {
            console.log('Fila de factura inválida, omitiendo:', row);
            continue;
          }

          const totalAmount = CsvService.parseAmount(row.total_amount || row.total_factura);

          if (totalAmount <= 0) {
            console.log('Factura con monto inválido, omitiendo:', row);
            continue;
          }

          const invoiceData = {
            invoice_number: invoiceNumber,
            emission_date: row.emission_date || row.fecha_emision || row.fecha || null,
            total_amount: totalAmount,
            state: 'pending',
            client: row.client || row.cliente || 'Desconocido'
          };

          await Invoice.insert(invoiceData, connection);
          invoicesInserted++;
        }
      } catch (error) {
        console.log('No se pudo importar facturas.csv:', error.message);
      }

      // Registrar logs
      const logSql = 'INSERT INTO logs (level, message, data) VALUES (?, ?, ?)';
      await connection.execute(logSql, ['info', 'Inicialización automática completada', JSON.stringify({
        paymentsInserted,
        transactionsInserted,
        invoicesInserted
      })]);

      console.log(`Datos importados: ${paymentsInserted} pagos, ${transactionsInserted} transacciones, ${invoicesInserted} facturas`);
    } else {
      console.log('Tablas ya contienen datos, omitiendo importación automática');
    }

  } catch (error) {
    console.error('Error en inicialización automática:', error);
  } finally {
    if (connection) await connection.end();
  }
}

// Start server
async function startServer() {
  try {
    await initializeDatabase();

    // Routes (import after DB initialization)
    app.get('/', (req, res) => {
      res.json({ message: 'API de App de Cobros funcionando' });
    });

    // Import routes
    const paymentRoutes = require('./routes/payments');
    const invoiceRoutes = require('./routes/invoices');
    const processRoutes = require('./routes/process');

    app.use('/api/payments', paymentRoutes);
    app.use('/api/invoices', invoiceRoutes);
    app.use('/api/process', processRoutes);

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({ error: 'Algo salió mal!' });
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({ error: 'Ruta no encontrada' });
    });

    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('Error iniciando servidor:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app };