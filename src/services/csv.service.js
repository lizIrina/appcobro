const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

class CsvService {
  // Leer y parsear CSV desde /data
  static async parseCsv(fileName) {
    return new Promise((resolve, reject) => {
      const fullPath = path.resolve(__dirname, '../../data', fileName);
      if (!fs.existsSync(fullPath)) {
        return reject(new Error(`Archivo no encontrado: ${fullPath}`));
      }

      const fileContent = fs.readFileSync(fullPath, 'utf8');
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase(),
        complete: (results) => {
          resolve(results.data);
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  }

  // Normalizar número de factura
  static normalizeInvoiceNumber(number) {
    if (!number) return '';
    return number.toString().replace(/\s+/g, '').replace(/^0+/, '');
  }

  // Limpiar y convertir monto
  static parseAmount(amount) {
    if (!amount) return 0;
    const cleaned = amount.toString().replace(/[^\d.,-]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }
}

module.exports = CsvService;