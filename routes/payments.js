const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const CsvService = require('../src/services/csv.service');

// GET /api/payments - Obtener todos los pagos
router.get('/', async (req, res) => {
  try {
    const payments = await Payment.getAll();
    res.json(payments);
  } catch (error) {
    console.error('Error obteniendo pagos:', error.message);
    res.status(500).json({ error: 'Error obteniendo pagos' });
  }
});

// GET /api/payments/:id - Obtener pago por ID
router.get('/:id', async (req, res) => {
  try {
    const payments = await Payment.getAll();
    const payment = payments.find(p => p.id === req.params.id);
    if (!payment) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }
    res.json(payment);
  } catch (error) {
    console.error('Error obteniendo pago:', req.params.id, error.message);
    res.status(500).json({ error: 'Error obteniendo pago' });
  }
});

module.exports = router;