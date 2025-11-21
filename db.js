const mysql = require('mysql2/promise');
require('dotenv').config();

let db;
let isConnected = false;

async function connectDB() {
  if (!isConnected) {
    try {
      db = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'appcobro',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });
      isConnected = true;
      console.log('Conectado a MySQL');
    } catch (error) {
      console.error('Error conectando a MySQL:', error);
      process.exit(1);
    }
  }
  return db;
}

// Función para obtener la conexión
async function getDb() {
  if (!isConnected) {
    await connectDB();
  }
  if (!db) {
    throw new Error('Database connection failed');
  }
  return db;
}

// Conectar al importar
connectDB();

module.exports = { getDb };