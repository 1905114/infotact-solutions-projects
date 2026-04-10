/**
 * Query Optimization Service
 * Analyzes and optimizes MongoDB queries using explain() plans
 */

const mongoose = require('mongoose');

class QueryOptimizer {
  constructor() {
    this.slowQueryThreshold = 100; // milliseconds
    this.queryLogs = [];
  }

  /**
   * Analyze query execution plan
   */
  async analyzeQuery(model, query, options = {}) {
    const startTime = Date.now();
    
    const explainResult = await model.find(query)
      .setOptions(options)
      .explain('executionStats');
    
    const executionTime = Date.now() - startTime;
    const stats = explainResult.executionStats;

    const analysis = {
      collection: model.collection.name,
      query: JSON.stringify(query),
      executionTimeMs: executionTime,
      totalDocsExamined: stats.totalDocsExamined,
      totalKeysExamined: stats.totalKeysExamined,
      totalDocsReturned: stats.nReturned,
      executionStages: stats.executionStages.stage,
      indexUsed: stats.executionStages.inputStage?.indexName || 'None',
      isCollectionScan: stats.executionStages.stage === 'COLLSCAN',
      efficiency: this.calculateEfficiency(stats),
      recommendations: [],
    };

    // Generate recommendations
    if (analysis.isCollectionScan) {
      analysis.recommendations.push('Create appropriate index to avoid collection scan');
    }

    if (analysis.totalDocsExamined > analysis.totalDocsReturned * 10) {
      analysis.recommendations.push('Query is examining too many documents. Consider adding more specific filters');
    }

    if (analysis.executionTimeMs > this.slowQueryThreshold) {
      analysis.recommendations.push(`Query took ${analysis.executionTimeMs}ms, consider optimization`);
      this.queryLogs.push(analysis);
    }

    return analysis;
  }

  /**
   * Calculate query efficiency score (0-100)
   */
  calculateEfficiency(stats) {
    if (stats.totalDocsExamined === 0) return 100;
    
    const ratio = stats.nReturned / stats.totalDocsExamined;
    let score = ratio * 100;
    
    if (stats.totalKeysExamined > stats.totalDocsExamined * 2) {
      score *= 0.7;
    }
    
    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Analyze geospatial query
   */
  async analyzeGeospatialQuery(model, query) {
    const explainResult = await model.find(query)
      .explain('executionStats');
    
    const stats = explainResult.executionStats;
    const geoStage = this.findGeoStage(explainResult);

    const analysis = {
      collection: model.collection.name,
      query: JSON.stringify(query),
      usesGeoIndex: geoStage !== null,
      geoIndexType: geoStage?.indexName || 'None',
      totalDocsExamined: stats.totalDocsExamined,
      executionTimeMs: stats.executionTimeMillis,
      isOptimal: false,
      recommendations: [],
    };

    if (analysis.usesGeoIndex && analysis.totalDocsExamined < 1000) {
      analysis.isOptimal = true;
    } else if (!analysis.usesGeoIndex) {
      analysis.recommendations.push('Create 2dsphere index for geospatial queries');
    } else {
      analysis.recommendations.push('Consider reducing search radius or adding additional filters');
    }

    return analysis;
  }

  /**
   * Find geospatial stage in execution plan
   */
  findGeoStage(explainResult) {
    const stages = [];
    const traverse = (stage) => {
      if (stage.stage === 'GEO_NEAR' || stage.stage === 'GEO_NEAR_2DSPHERE') {
        stages.push(stage);
      }
      if (stage.inputStage) traverse(stage.inputStage);
      if (stage.inputStages) stage.inputStages.forEach(traverse);
    };
    
    traverse(explainResult.queryPlanner.winningPlan);
    return stages[0] || null;
  }

  /**
   * Get index recommendations
   */
  async getIndexRecommendations() {
    const collections = mongoose.connection.collections;
    const recommendations = [];

    for (const [name, collection] of Object.entries(collections)) {
      const indexes = await collection.indexes();
      const stats = await collection.stats();
      
      recommendations.push({
        collection: name,
        currentIndexes: indexes.length,
        documentCount: stats.count,
        indexSizeMB: Math.round(stats.indexSizes.total / 1024 / 1024),
        recommendations: [],
      });
    }

    // Common recommendations
    const commonIndexes = [
      { collection: 'orders', fields: { userId: 1, createdAt: -1 }, description: 'For user order history queries' },
      { collection: 'orders', fields: { restaurantId: 1, status: 1 }, description: 'For restaurant order management' },
      { collection: 'reviews', fields: { restaurantId: 1, rating: -1 }, description: 'For restaurant review sorting' },
      { collection: 'menuitems', fields: { restaurantId: 1, isAvailable: 1 }, description: 'For menu filtering' },
    ];

    return { currentStatus: recommendations, recommendedIndexes: commonIndexes };
  }

  /**
   * Optimize aggregation pipeline
   */
  optimizeAggregation(pipeline) {
    const optimized = [];
    const stages = ['$match', '$sort', '$limit', '$skip', '$project'];
    
    // Reorder stages for efficiency
    const matchStages = pipeline.filter(s => Object.keys(s)[0] === '$match');
    const otherStages = pipeline.filter(s => Object.keys(s)[0] !== '$match');
    
    // Move $match to beginning
    optimized.push(...matchStages);
    
    // Add $sort early if exists
    const sortStage = otherStages.find(s => Object.keys(s)[0] === '$sort');
    if (sortStage) optimized.push(sortStage);
    
    // Add $limit early if exists
    const limitStage = otherStages.find(s => Object.keys(s)[0] === '$limit');
    if (limitStage) optimized.push(limitStage);
    
    // Add remaining stages
    optimized.push(...otherStages.filter(s => 
      !['$sort', '$limit'].includes(Object.keys(s)[0])
    ));
    
    return optimized;
  }

  /**
   * Get slow query log
   */
  getSlowQueries() {
    return this.queryLogs.filter(log => log.executionTimeMs > this.slowQueryThreshold);
  }

  /**
   * Clear query log
   */
  clearQueryLog() {
    this.queryLogs = [];
  }

  /**
   * Set slow query threshold
   */
  setSlowQueryThreshold(ms) {
    this.slowQueryThreshold = ms;
  }
}

module.exports = new QueryOptimizer();