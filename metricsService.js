/**
 * Metrics Service - Collects and aggregates system metrics
 */

const os = require('os');
const mongoose = require('mongoose');

class MetricsService {
  constructor() {
    this.metrics = {
      requests: [],
      errors: [],
      responseTimes: [],
      startTime: Date.now(),
    };
  }

  /**
   * Record API request metric
   */
  recordRequest(method, endpoint, statusCode, responseTime) {
    this.metrics.requests.push({
      timestamp: new Date(),
      method,
      endpoint,
      statusCode,
      responseTime,
    });

    // Keep only last 10000 requests
    if (this.metrics.requests.length > 10000) {
      this.metrics.requests.shift();
    }
  }

  /**
   * Record error metric
   */
  recordError(error, context = {}) {
    this.metrics.errors.push({
      timestamp: new Date(),
      error: error.message,
      stack: error.stack,
      context,
    });

    if (this.metrics.errors.length > 1000) {
      this.metrics.errors.shift();
    }
  }

  /**
   * Get system metrics
   */
  getSystemMetrics() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      cpu: {
        cores: os.cpus().length,
        loadAverage: os.loadavg(),
        usage: this.getCPUUsage(),
      },
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: usedMemory,
        usagePercent: (usedMemory / totalMemory) * 100,
      },
      disk: {
        // Would require additional package for disk metrics
        status: 'Not available',
      },
      uptime: {
        system: os.uptime(),
        process: process.uptime(),
        server: (Date.now() - this.metrics.startTime) / 1000,
      },
    };
  }

  /**
   * Get API metrics
   */
  getAPIMetrics() {
    const lastHour = Date.now() - 60 * 60 * 1000;
    const recentRequests = this.metrics.requests.filter(r => r.timestamp.getTime() > lastHour);
    
    const statusCodes = {};
    recentRequests.forEach(r => {
      statusCodes[r.statusCode] = (statusCodes[r.statusCode] || 0) + 1;
    });

    const responseTimes = recentRequests.map(r => r.responseTime);
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;

    return {
      totalRequests: this.metrics.requests.length,
      requestsLastHour: recentRequests.length,
      statusCodeDistribution: statusCodes,
      averageResponseTime: Math.round(avgResponseTime),
      errorRate: this.metrics.errors.length / (this.metrics.requests.length || 1),
      errorsLastHour: this.metrics.errors.filter(e => e.timestamp.getTime() > lastHour).length,
    };
  }

  /**
   * Get database metrics
   */
  async getDatabaseMetrics() {
    const db = mongoose.connection;
    const dbState = db.readyState;
    
    let collections = [];
    let stats = {};
    
    if (dbState === 1) {
      collections = await db.db.listCollections().toArray();
      stats = await db.db.stats();
    }

    return {
      status: ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState],
      host: db.host,
      name: db.name,
      collections: collections.length,
      documentCount: stats.objects || 0,
      dataSize: stats.dataSize || 0,
      indexSize: stats.indexSize || 0,
    };
  }

  /**
   * Get CPU usage percentage
   */
  getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - (idle / total * 100);
    
    return Math.round(usage * 100) / 100;
  }

  /**
   * Get comprehensive metrics report
   */
  async getMetricsReport() {
    const [system, api, database] = await Promise.all([
      Promise.resolve(this.getSystemMetrics()),
      Promise.resolve(this.getAPIMetrics()),
      this.getDatabaseMetrics(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      system,
      api,
      database,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      requests: [],
      errors: [],
      responseTimes: [],
      startTime: Date.now(),
    };
  }
}

module.exports = new MetricsService();