const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const ProcessedInvoice = require('../models/ProcessedInvoice');
const Logger = require('../models/Logger');
const XLSX = require('xlsx');

// GET /api/process/results - Obtener resultados procesados
router.get('/results', async (req, res) => {
  try {
    const results = await ProcessedInvoice.getAll();
    res.json(results);
  } catch (error) {
    Logger.error('Error obteniendo resultados', { error: error.message });
    res.status(500).json({ error: 'Error obteniendo resultados' });
  }
});

// GET /api/process/results/:estado - Obtener resultados por estado
router.get('/results/:estado', async (req, res) => {
  try {
    const results = await ProcessedInvoice.getByEstado(req.params.estado);
    res.json(results);
  } catch (error) {
    Logger.error('Error obteniendo resultados por estado', {
      estado: req.params.estado,
      error: error.message
    });
    res.status(500).json({ error: 'Error obteniendo resultados' });
  }
});

// POST /api/process/compare - Procesar comparación pagos vs facturas
router.post('/compare', async (req, res) => {
  const { startDate, endDate } = req.body;

  try {
    // Limpiar resultados anteriores
    await ProcessedInvoice.clearAll();

    // Obtener pagos en rango
    const payments = await Payment.getByDateRange(startDate, endDate);
    await Logger.info('Pagos obtenidos para procesamiento', {
      count: payments.length,
      startDate,
      endDate
    });

    // Agrupar pagos por invoice_number
    const paymentMap = new Map();

    for (const payment of payments) {
      // Obtener transacciones del pago
      const db = await getDb();
      const [transactions] = await db.execute(
        'SELECT * FROM payment_transactions WHERE payment_id = ?',
        [payment.id]
      );

      for (const transaction of transactions) {
        const normalizedInvoice = new Invoice({ invoice_number: transaction.invoice_number }).normalized_number;

        if (!paymentMap.has(normalizedInvoice)) {
          paymentMap.set(normalizedInvoice, {
            total_pagado: 0,
            bancos: new Set(),
            referencias: new Set(),
            clientes: new Set()
          });
        }

        const data = paymentMap.get(normalizedInvoice);
        data.total_pagado += parseFloat(transaction.applied_amount);
        data.bancos.add(payment.bank || 'Desconocido');
        data.referencias.add(payment.id);
        data.clientes.add(payment.client_name);
      }
    }

    // Procesar cada factura
    const invoices = await Invoice.getAll();
    const processedResults = [];

    for (const invoice of invoices) {
      const normalized = invoice.normalized_number;
      const paymentData = paymentMap.get(normalized);

      let estado = 'NO ENCONTRADA';
      let total_pagado = 0;
      let diferencia = -invoice.total_amount;
      let banco = null;
      let referencia = null;
      let cliente = invoice.client;

      if (paymentData) {
        total_pagado = paymentData.total_pagado;
        diferencia = total_pagado - invoice.total_amount;
        banco = Array.from(paymentData.bancos).join(', ');
        referencia = Array.from(paymentData.referencias).join(', ');
        cliente = Array.from(paymentData.clientes).join(', ') || invoice.client;

        if (Math.abs(diferencia) < 0.01) {
          estado = 'EXACTA';
        } else if (total_pagado < invoice.total_amount) {
          estado = 'PARCIAL';
        } else {
          estado = 'SOBREPAGO';
        }
      }

      const processedInvoice = {
        invoice_number: invoice.invoice_number,
        total_factura: invoice.total_amount,
        total_pagado,
        diferencia,
        estado,
        banco,
        referencia_wispro: referencia,
        cliente
      };

      processedResults.push(processedInvoice);
      await ProcessedInvoice.upsert(processedInvoice);
    }

    await Logger.info('Comparación completada', {
      invoicesProcessed: processedResults.length,
      exactas: processedResults.filter(r => r.estado === 'EXACTA').length,
      parciales: processedResults.filter(r => r.estado === 'PARCIAL').length,
      sobrepagos: processedResults.filter(r => r.estado === 'SOBREPAGO').length,
      noEncontradas: processedResults.filter(r => r.estado === 'NO ENCONTRADA').length
    });

    res.json({
      message: 'Comparación completada',
      results: processedResults.length,
      summary: {
        exactas: processedResults.filter(r => r.estado === 'EXACTA').length,
        parciales: processedResults.filter(r => r.estado === 'PARCIAL').length,
        sobrepagos: processedResults.filter(r => r.estado === 'SOBREPAGO').length,
        noEncontradas: processedResults.filter(r => r.estado === 'NO ENCONTRADA').length
      }
    });
  } catch (error) {
    Logger.error('Error en comparación', { error: error.message });
    res.status(500).json({ error: 'Error en procesamiento' });
  }
});

// POST /api/process/export-excel - Exportar resultados a Excel
router.post('/export-excel', async (req, res) => {
  const { filePath = 'resultados.xlsx' } = req.body;

  try {
    const results = await ProcessedInvoice.getAll();

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(results);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Resultados');
    XLSX.writeFile(workbook, filePath);

    await Logger.info('Resultados exportados a Excel', { filePath, count: results.length });

    res.json({
      message: 'Archivo Excel generado',
      filePath,
      records: results.length
    });
  } catch (error) {
    Logger.error('Error exportando a Excel', { error: error.message });
    res.status(500).json({ error: 'Error generando Excel' });
  }
});

// POST /api/process/export-json - Exportar resultados como JSON
router.post('/export-json', async (req, res) => {
  try {
    const results = await ProcessedInvoice.getAll();

    const exactas = results.filter(r => r.estado === 'EXACTA');
    const parciales = results.filter(r => r.estado === 'PARCIAL');
    const noEncontradas = results.filter(r => r.estado === 'NO ENCONTRADA');

    const output = {
      exactas: exactas.map(r => ({
        documento: r.invoice_number,
        monto_total: r.total_factura,
        referencia: r.referencia_wispro,
        banco: r.banco,
        cliente: r.cliente
      })),
      parciales: parciales.map(r => ({
        documento: r.invoice_number,
        monto_pagado: r.total_pagado,
        saldo_pendiente: r.diferencia * -1,
        cliente: r.cliente
      })),
      no_encontradas: noEncontradas.map(r => ({
        documento: r.invoice_number,
        monto_factura: r.total_factura,
        cliente: r.cliente,
        error: 'Factura no encontrada en pagos'
      }))
    };

    await Logger.info('Resultados exportados como JSON', { count: results.length });

    res.json(output);
  } catch (error) {
    Logger.error('Error exportando JSON', { error: error.message });
    res.status(500).json({ error: 'Error generando JSON' });
  }
});

module.exports = router;