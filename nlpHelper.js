/**
 * NLP Helper - Natural Language Processing utilities for review analysis
 */

class NLPHelper {
  constructor() {
    // Sentiment word lists
    this.positiveWords = [
      'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'awesome',
      'delicious', 'tasty', 'flavorful', 'savory', 'yummy', 'scrumptious',
      'fresh', 'quality', 'perfect', 'outstanding', 'exceptional', 'superb',
      'love', 'like', 'enjoy', 'recommend', 'satisfied', 'happy', 'pleased',
      'quick', 'fast', 'prompt', 'efficient', 'friendly', 'helpful', 'courteous',
      'clean', 'neat', 'organized', 'professional', 'value', 'worth', 'affordable'
    ];

    this.negativeWords = [
      'bad', 'poor', 'terrible', 'awful', 'horrible', 'disappointing', 'worst',
      'bland', 'tasteless', 'overcooked', 'undercooked', 'cold', 'stale',
      'expensive', 'overpriced', 'waste', 'money', 'not worth',
      'slow', 'late', 'rude', 'unfriendly', 'ignorant', 'careless',
      'dirty', 'messy', 'unhygienic', 'unprofessional', 'damaged', 'leaking'
    ];

    // Intensifiers and modifiers
    this.intensifiers = ['very', 'extremely', 'absolutely', 'really', 'so', 'too', 'quite', 'highly'];
    this.negations = ['not', 'no', 'never', 'neither', 'nor', 'none', 'nobody', 'nothing'];

    // Food quality indicators
    this.foodQualityIndicators = {
      positive: [
        'fresh', 'hot', 'crispy', 'juicy', 'tender', 'flavorful', 'aromatic',
        'well-cooked', 'perfectly seasoned', 'melt in mouth', 'authentic'
      ],
      negative: [
        'cold', 'stale', 'dry', 'tough', 'chewy', 'greasy', 'oily', 'burnt',
        'overcooked', 'undercooked', 'raw', 'bland', 'salty', 'soggy'
      ]
    };

    // Service quality indicators
    this.serviceIndicators = {
      positive: [
        'attentive', 'prompt', 'courteous', 'knowledgeable', 'accommodating',
        'efficient', 'professional', 'welcoming', 'responsive'
      ],
      negative: [
        'slow', 'inattentive', 'rude', 'unhelpful', 'disorganized',
        'unresponsive', 'unprofessional', 'dismissive'
      ]
    };
  }

  /**
   * Analyze sentiment of text
   * @param {string} text - Text to analyze
   * @returns {Object} Sentiment analysis result
   */
  analyzeSentiment(text) {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    let positiveScore = 0;
    let negativeScore = 0;
    let negationActive = false;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // Check for negations
      if (this.negations.includes(word)) {
        negationActive = true;
        continue;
      }
      
      // Check for intensifiers
      const isIntensifier = this.intensifiers.includes(word);
      let multiplier = isIntensifier ? 1.5 : 1;
      
      if (this.positiveWords.includes(word)) {
        positiveScore += multiplier * (negationActive ? -1 : 1);
        negationActive = false;
      } else if (this.negativeWords.includes(word)) {
        negativeScore += multiplier * (negationActive ? -1 : 1);
        negationActive = false;
      }
    }

    const totalScore = positiveScore - negativeScore;
    const maxPossibleScore = Math.max(positiveScore, negativeScore) || 1;
    const confidence = Math.min((Math.abs(totalScore) / maxPossibleScore) * 0.8 + 0.2, 1);
    
    let sentiment;
    if (totalScore >= 2) sentiment = 'very_positive';
    else if (totalScore >= 0.5) sentiment = 'positive';
    else if (totalScore >= -0.5) sentiment = 'neutral';
    else if (totalScore >= -2) sentiment = 'negative';
    else sentiment = 'very_negative';

    return {
      sentiment,
      score: totalScore,
      confidence,
      positiveScore,
      negativeScore,
      interpretation: this.getSentimentInterpretation(totalScore),
    };
  }

  /**
   * Get sentiment interpretation
   */
  getSentimentInterpretation(score) {
    if (score >= 3) return 'Overwhelmingly Positive';
    if (score >= 1.5) return 'Strongly Positive';
    if (score >= 0.5) return 'Moderately Positive';
    if (score >= -0.5) return 'Neutral/Mixed';
    if (score >= -1.5) return 'Moderately Negative';
    if (score >= -3) return 'Strongly Negative';
    return 'Overwhelmingly Negative';
  }

  /**
   * Extract key aspects from review
   */
  extractAspects(text) {
    const aspects = {
      food: [],
      service: [],
      ambience: [],
      value: [],
      delivery: [],
      packaging: [],
    };

    const lowerText = text.toLowerCase();

    // Food aspects
    for (const indicator of this.foodQualityIndicators.positive) {
      if (lowerText.includes(indicator)) {
        aspects.food.push({ aspect: indicator, sentiment: 'positive' });
      }
    }
    for (const indicator of this.foodQualityIndicators.negative) {
      if (lowerText.includes(indicator)) {
        aspects.food.push({ aspect: indicator, sentiment: 'negative' });
      }
    }

    // Service aspects
    for (const indicator of this.serviceIndicators.positive) {
      if (lowerText.includes(indicator)) {
        aspects.service.push({ aspect: indicator, sentiment: 'positive' });
      }
    }
    for (const indicator of this.serviceIndicators.negative) {
      if (lowerText.includes(indicator)) {
        aspects.service.push({ aspect: indicator, sentiment: 'negative' });
      }
    }

    // Ambience keywords
    const ambienceKeywords = ['ambience', 'atmosphere', 'decor', 'lighting', 'music', 'seating', 'space'];
    for (const keyword of ambienceKeywords) {
      if (lowerText.includes(keyword)) {
        const nearbyWords = this.getNearbyWords(text, keyword);
        const sentiment = this.analyzeSentiment(nearbyWords).sentiment;
        aspects.ambience.push({ aspect: keyword, sentiment });
      }
    }

    // Value keywords
    const valueKeywords = ['price', 'cost', 'value', 'worth', 'expensive', 'affordable', 'reasonable'];
    for (const keyword of valueKeywords) {
      if (lowerText.includes(keyword)) {
        const nearbyWords = this.getNearbyWords(text, keyword);
        const sentiment = this.analyzeSentiment(nearbyWords).sentiment;
        aspects.value.push({ aspect: keyword, sentiment });
      }
    }

    return aspects;
  }

  /**
   * Get nearby words for context
   */
  getNearbyWords(text, targetWord, windowSize = 10) {
    const words = text.split(/\s+/);
    const index = words.findIndex(w => w.toLowerCase().includes(targetWord));
    if (index === -1) return '';
    
    const start = Math.max(0, index - windowSize);
    const end = Math.min(words.length, index + windowSize + 1);
    return words.slice(start, end).join(' ');
  }

  /**
   * Calculate readability score (Flesch-Kincaid)
   */
  calculateReadability(text) {
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).length;
    const syllables = this.countSyllables(text);
    
    if (sentences === 0 || words === 0) return 0;
    
    const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
    
    let level;
    if (score >= 90) level = 'Very Easy';
    else if (score >= 80) level = 'Easy';
    else if (score >= 70) level = 'Fairly Easy';
    else if (score >= 60) level = 'Standard';
    else if (score >= 50) level = 'Fairly Difficult';
    else if (score >= 30) level = 'Difficult';
    else level = 'Very Difficult';
    
    return {
      score: Math.round(score * 100) / 100,
      level,
      words,
      sentences,
      syllables,
    };
  }

  /**
   * Count syllables in text
   */
  countSyllables(text) {
    const words = text.toLowerCase().split(/\s+/);
    let totalSyllables = 0;
    
    for (const word of words) {
      totalSyllables += this.countWordSyllables(word);
    }
    
    return totalSyllables;
  }

  /**
   * Count syllables in a single word
   */
  countWordSyllables(word) {
    word = word.toLowerCase();
    let count = 0;
    let isPrevVowel = false;
    
    const vowels = 'aeiouy';
    
    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i]);
      if (isVowel && !isPrevVowel) {
        count++;
      }
      isPrevVowel = isVowel;
    }
    
    // Adjust for silent e at the end
    if (word.endsWith('e')) {
      count--;
    }
    
    // Ensure at least one syllable
    return Math.max(1, count);
  }

  /**
   * Extract keywords from text
   */
  extractKeywords(text, limit = 10) {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const stopwords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'this',
      'that', 'these', 'those', 'it', 'they', 'them', 'we', 'you', 'he', 'she'
    ]);
    
    const wordFreq = new Map();
    
    for (const word of words) {
      if (word.length > 3 && !stopwords.has(word)) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    }
    
    const sortedKeywords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word, frequency]) => ({ word, frequency }));
    
    return sortedKeywords;
  }

  /**
   * Generate review summary
   */
  generateSummary(review) {
    const sentiment = this.analyzeSentiment(review.content);
    const aspects = this.extractAspects(review.content);
    const keywords = this.extractKeywords(review.content, 5);
    
    let summary = '';
    
    if (sentiment.sentiment.includes('positive')) {
      summary += `Positive review about `;
      const positiveAspects = [];
      if (aspects.food.some(a => a.sentiment === 'positive')) positiveAspects.push('food quality');
      if (aspects.service.some(a => a.sentiment === 'positive')) positiveAspects.push('service');
      if (positiveAspects.length > 0) {
        summary += positiveAspects.join(' and ');
      } else {
        summary += 'overall experience';
      }
    } else if (sentiment.sentiment.includes('negative')) {
      summary += `Areas needing improvement: `;
      const negativeAspects = [];
      if (aspects.food.some(a => a.sentiment === 'negative')) negativeAspects.push('food quality');
      if (aspects.service.some(a => a.sentiment === 'negative')) negativeAspects.push('service');
      if (negativeAspects.length > 0) {
        summary += negativeAspects.join(' and ');
      } else {
        summary += 'multiple aspects';
      }
    } else {
      summary += `Mixed review with balanced feedback`;
    }
    
    if (keywords.length > 0) {
      summary += `. Key mentions: ${keywords.slice(0, 3).map(k => k.word).join(', ')}`;
    }
    
    return summary;
  }

  /**
   * Check if review is high quality
   */
  isHighQuality(review) {
    const wordCount = review.content.split(/\s+/).length;
    const hasDetails = wordCount >= 50;
    const hasSpecifics = /dish|order|restaurant|delivery|service|food/i.test(review.content);
    const hasBalancedView = this.hasBalancedView(review.content);
    
    return {
      isHighQuality: hasDetails && hasSpecifics,
      criteria: {
        wordCount: wordCount >= 50,
        hasSpecificDetails: hasSpecifics,
        hasBalancedView: hasBalancedView,
      },
      wordCount,
    };
  }

  /**
   * Check if review has balanced view (both positives and negatives)
   */
  hasBalancedView(text) {
    const sentiment = this.analyzeSentiment(text);
    const hasPositive = sentiment.positiveScore > 0;
    const hasNegative = sentiment.negativeScore > 0;
    return hasPositive && hasNegative;
  }
}

module.exports = new NLPHelper();