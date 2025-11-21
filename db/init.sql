-- Base de datos para App de Cobros

CREATE DATABASE IF NOT EXISTS appcobro;
USE appcobro;

-- Tabla de pagos (basado en Wispro)
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(50) PRIMARY KEY,
    created_at DATETIME NOT NULL,
    state ENUM('success', 'void', 'pending') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    name_user VARCHAR(100),
    client_name VARCHAR(100) NOT NULL,
    transaction_code VARCHAR(100),
    bank VARCHAR(100),
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de transacciones de pago (desglose por facturas)
CREATE TABLE IF NOT EXISTS payment_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_id VARCHAR(50) NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    applied_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
    UNIQUE KEY unique_payment_invoice (payment_id, invoice_number)
);

-- Tabla de facturas (desde Google Sheets)
CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    emission_date DATE,
    total_amount DECIMAL(10,2) NOT NULL,
    state ENUM('pending', 'paid') DEFAULT 'pending',
    client VARCHAR(100) NOT NULL,
    normalized_number VARCHAR(50) NOT NULL,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de resultados procesados
CREATE TABLE IF NOT EXISTS processed_invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(50) NOT NULL,
    total_factura DECIMAL(10,2) NOT NULL,
    total_pagado DECIMAL(10,2) DEFAULT 0,
    diferencia DECIMAL(10,2) DEFAULT 0,
    estado ENUM('EXACTA', 'PARCIAL', 'SOBREPAGO', 'NO ENCONTRADA') NOT NULL,
    banco VARCHAR(100),
    referencia_wispro VARCHAR(100),
    cliente VARCHAR(100),
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_invoice (invoice_number)
);

-- Tabla de logs
CREATE TABLE IF NOT EXISTS logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    level ENUM('info', 'warn', 'error') NOT NULL,
    message TEXT NOT NULL,
    data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimización
CREATE INDEX idx_payments_state ON payments(state);
CREATE INDEX idx_payments_client ON payments(client_name);
CREATE INDEX idx_payment_transactions_payment_id ON payment_transactions(payment_id);
CREATE INDEX idx_payment_transactions_invoice ON payment_transactions(invoice_number);
CREATE INDEX idx_invoices_client ON invoices(client);
CREATE INDEX idx_invoices_normalized ON invoices(normalized_number);
CREATE INDEX idx_processed_invoices_estado ON processed_invoices(estado);