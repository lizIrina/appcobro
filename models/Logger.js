const { getDb } = require('../db');

class Logger {
  // Log info
  static async info(message, data = null) {
    await this.log('info', message, data);
  }

  // Log warning
  static async warn(message, data = null) {
    await this.log('warn', message, data);
  }

  // Log error
  static async error(message, data = null) {
    // Direct console logging to avoid DB issues
    console.log(`[ERROR] ${message}`, data);
  }

  // Generic log method
  static async log(level, message, data = null) {
    // For now, just use console logging to avoid DB dependency issues
    // TODO: Re-enable DB logging once circular dependency is resolved
    console.log(`[${level.toUpperCase()}] ${message}`, data);
  }

  // Get logs by level
  static async getByLevel(level, limit = 100) {
    const db = await getDb();
    const sql = 'SELECT * FROM logs WHERE level = ? ORDER BY created_at DESC LIMIT ?';
    const [rows] = await db.execute(sql, [level, limit]);
    return rows;
  }

  // Get recent logs
  static async getRecent(limit = 100) {
    const db = await getDb();
    const sql = 'SELECT * FROM logs ORDER BY created_at DESC LIMIT ?';
    const [rows] = await db.execute(sql, [limit]);
    return rows;
  }

  // Clear old logs (older than X days)
  static async clearOld(days = 30) {
    const db = await getDb();
    const sql = 'DELETE FROM logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)';
    await db.execute(sql, [days]);
  }
}

module.exports = Logger;