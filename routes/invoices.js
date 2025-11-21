const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const CsvService = require('../src/services/csv.service');

// GET /api/invoices - Obtener todas las facturas
router.get('/', async (req, res) => {
  try {
    const invoices = await Invoice.getAll();
    res.json(invoices);
  } catch (error) {
    console.error('Error obteniendo facturas:', error.message);
    res.status(500).json({ error: 'Error obteniendo facturas' });
  }
});

// GET /api/invoices/:number - Obtener factura por número
router.get('/:number', async (req, res) => {
  try {
    const normalized = new Invoice({ invoice_number: req.params.number }).normalized_number;
    const invoice = await Invoice.getByNormalizedNumber(normalized);
    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    res.json(invoice);
  } catch (error) {
    console.error('Error obteniendo factura:', req.params.number, error.message);
    res.status(500).json({ error: 'Error obteniendo factura' });
  }
});

// GET /api/invoices/:number/cobros - Obtener cobros por factura (formato Contífico-like)
router.get('/:number/cobros', async (req, res) => {
  try {
    const normalized = new Invoice({ invoice_number: req.params.number }).normalized_number;
    const cobros = await Payment.getCobrosByFactura(normalized);
    res.json(cobros);
  } catch (error) {
    console.error('Error obteniendo cobros por factura:', req.params.number, error.message);
    res.status(500).json({ error: 'Error obteniendo cobros' });
  }
});

module.exports = router;