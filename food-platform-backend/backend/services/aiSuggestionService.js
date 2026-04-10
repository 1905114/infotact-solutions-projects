/**
 * AI Suggestion Service
 * Provides intelligent keyword suggestions, sentiment analysis, and review enhancements
 * Uses NLP techniques and order history analysis
 */

const natural = require('natural');
const stopwords = require('natural/lib/natural/util/stopwords').words;

class AISuggestionService {
  constructor() {
    // Initialize NLP tools
    this.tokenizer = new natural.WordTokenizer();
    this.tfidf = new natural.TfIdf();
    this.sentimentAnalyzer = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
    
    // Keyword categories for restaurant reviews
    this.keywordCategories = {
      taste: [
        'delicious', 'flavorful', 'savory', 'spicy', 'sweet', 'tangy', 
        'creamy', 'crispy', 'juicy', 'tender', 'fresh', 'authentic',
        'bland', 'overcooked', 'undercooked', 'salty', 'greasy',
        'aromatic', 'rich', 'zesty', 'succulent', 'flaky', 'creamy'
      ],
      service: [
        'friendly', 'attentive', 'quick', 'slow', 'professional', 
        'courteous', 'helpful', 'efficient', 'prompt', 'rude',
        'accommodating', 'knowledgeable', 'welcoming', 'responsive'
      ],
      ambience: [
        'cozy', 'spacious', 'clean', 'noisy', 'quiet', 'romantic',
        'family-friendly', 'modern', 'traditional', 'crowded',
        'elegant', 'casual', 'vibrant', 'relaxing', 'well-lit'
      ],
      value: [
        'affordable', 'expensive', 'reasonable', 'worth', 'overpriced',
        'value-for-money', 'budget-friendly', 'premium', 'cheap',
        'economical', 'cost-effective', 'pricey', 'fair-price'
      ],
      packaging: [
        'secure', 'leaking', 'eco-friendly', 'messy', 'organized',
        'insulated', 'compartmentalized', 'spill-proof', 'sturdy'
      ],
      delivery: [
        'fast', 'late', 'on-time', 'early', 'courteous', 'trackable',
        'accurate', 'careful', 'professional', 'efficient'
      ],
      portion: [
        'generous', 'small', 'hearty', 'filling', 'adequate',
        'substantial', 'meager', 'ample', 'satisfying'
      ],
      presentation: [
        'beautiful', 'appealing', 'messy', 'artistic', 'simple',
        'elegant', 'rustic', 'colorful', 'well-plated'
      ]
    };

    // Common phrases for review templates
    this.commonPhrases = {
      opening: [
        'I recently ordered from',
        'Had a great experience at',
        'My experience with',
        'I would like to share my thoughts on',
        'After trying',
        'I\'ve been a customer of'
      ],
      positive: [
        'I was thoroughly impressed with',
        'The highlight of my meal was',
        'What stood out the most was',
        'I particularly enjoyed',
        'The quality of the food was',
        'I would highly recommend'
      ],
      negative: [
        'I was disappointed with',
        'The area that needs improvement is',
        'Unfortunately,',
        'I had high expectations but',
        'The letdown was',
        'I wouldn\'t recommend'
      ],
      closing: [
        'Overall, I would rate',
        'In conclusion,',
        'To sum up,',
        'All things considered,',
        'I would definitely order again because',
        'I will be coming back for'
      ]
    };
  }

  /**
   * Generate review suggestions based on order history and user preferences
   * @param {Object} data - Input data for suggestions
   * @returns {Object} Generated suggestions
   */
  async generateReviewSuggestions(data) {
    const {
      userId,
      restaurant,
      specificOrder,
      userOrders,
      currentDraft = '',
    } = data;

    const suggestions = {
      keywords: [],
      phrases: [],
      topics: [],
      questions: [],
      templates: [],
      hashtags: [],
      sentiment: null,
    };

    // 1. Analyze current draft if provided
    if (currentDraft && currentDraft.length > 0) {
      suggestions.sentiment = this.analyzeSentiment(currentDraft);
      const extractedKeywords = this.extractKeywords(currentDraft);
      suggestions.keywords.push(...extractedKeywords);
    }

    // 2. Generate keyword suggestions based on restaurant cuisine
    if (restaurant && restaurant.cuisineTypes) {
      const cuisineKeywords = this.generateCuisineKeywords(restaurant.cuisineTypes);
      suggestions.keywords.push(...cuisineKeywords);
      
      // Generate hashtags from cuisine
      const cuisineHashtags = restaurant.cuisineTypes.map(c => `#${c.replace(/\s/g, '')}`);
      suggestions.hashtags.push(...cuisineHashtags);
    }

    // 3. Generate suggestions based on ordered items
    if (specificOrder && specificOrder.items) {
      const itemSuggestions = await this.generateItemSuggestions(specificOrder.items);
      suggestions.phrases.push(...itemSuggestions.phrases);
      suggestions.keywords.push(...itemSuggestions.keywords);
      
      // Generate item-specific hashtags
      const itemHashtags = specificOrder.items
        .slice(0, 3)
        .map(item => `#${item.name.replace(/\s/g, '')}`);
      suggestions.hashtags.push(...itemHashtags);
    }

    // 4. Generate topic suggestions based on user's previous reviews
    if (userOrders && userOrders.length > 0) {
      const userPreferences = this.analyzeUserPreferences(userOrders);
      suggestions.topics.push(...userPreferences);
      
      // Suggest based on frequently ordered items
      const frequentItems = this.getFrequentlyOrderedItems(userOrders);
      if (frequentItems.length > 0) {
        suggestions.phrases.push(`I keep coming back for the ${frequentItems[0]} - it's always amazing!`);
      }
    }

    // 5. Generate question prompts to help user write better reviews
    suggestions.questions = this.generateQuestionPrompts(restaurant, specificOrder);

    // 6. Suggest rating-appropriate phrases
    if (currentDraft) {
      const predictedRating = this.predictRatingFromDraft(currentDraft);
      suggestions.ratingPhrases = this.getRatingPhrases(predictedRating);
      suggestions.predictedRating = predictedRating;
    }

    // 7. Add common review templates
    suggestions.templates = this.getReviewTemplates(restaurant, specificOrder);

    // 8. Add category-specific keywords
    suggestions.categoryKeywords = this.getCategoryKeywords();

    // 9. Add improvement suggestions based on review length
    if (currentDraft && currentDraft.length < 50) {
      suggestions.improvementTips = [
        'Add more details about the taste and quality',
        'Mention specific dishes you ordered',
        'Share your experience with delivery/packaging',
        'Tell us if you would recommend this restaurant'
      ];
    }

    // 10. Generate personalized opening phrases
    if (userOrders && userOrders.length > 0) {
      suggestions.personalizedOpenings = this.generatePersonalizedOpenings(userOrders, restaurant);
    }

    return {
      success: true,
      data: suggestions,
      metadata: {
        generatedAt: new Date().toISOString(),
        confidence: this.calculateConfidenceScore(currentDraft),
        wordCount: currentDraft ? this.getWordCount(currentDraft) : 0,
      },
    };
  }

  /**
   * Generate keywords based on restaurant cuisine
   */
  generateCuisineKeywords(cuisineTypes) {
    const cuisineKeywordMap = {
      'North Indian': ['butter chicken', 'naan', 'tandoori', 'dal makhani', 'paneer tikka', 'biryani', 'roti', 'curry'],
      'South Indian': ['dosa', 'idli', 'sambar', 'coconut chutney', 'filter coffee', 'vada', 'uttapam', 'rasam'],
      'Chinese': ['noodles', 'fried rice', 'manchurian', 'dim sum', 'stir fry', 'spring rolls', 'kung pao'],
      'Italian': ['pasta', 'pizza', 'risotto', 'gnocchi', 'tiramisu', 'lasagna', 'ravioli', 'carbonara'],
      'Mexican': ['tacos', 'burritos', 'guacamole', 'quesadilla', 'salsa', 'enchiladas', 'fajitas'],
      'Japanese': ['sushi', 'ramen', 'tempura', 'teriyaki', 'miso', 'wasabi', 'sashimi', 'udon'],
      'Thai': ['pad thai', 'green curry', 'tom yum', 'coconut milk', 'basil rice', 'spring rolls'],
      'American': ['burger', 'fries', 'steak', 'milkshake', 'wings', 'bbq', 'sandwich'],
      'Mediterranean': ['hummus', 'falafel', 'gyro', 'tabbouleh', 'shawarma', 'olives', 'pita'],
      'Seafood': ['fish', 'prawns', 'crab', 'lobster', 'calamari', 'oysters', 'salmon'],
    };

    const keywords = [];
    for (const cuisine of cuisineTypes) {
      if (cuisineKeywordMap[cuisine]) {
        keywords.push(...cuisineKeywordMap[cuisine]);
      }
    }
    
    return [...new Set(keywords)].slice(0, 15);
  }

  /**
   * Generate suggestions based on ordered items
   */
  async generateItemSuggestions(items) {
    const suggestions = {
      keywords: [],
      phrases: [],
    };

    for (const item of items) {
      const itemName = item.name;
      suggestions.keywords.push(itemName);
      
      // Generate specific phrases for this item
      suggestions.phrases.push(`The ${itemName} was absolutely delicious!`);
      suggestions.phrases.push(`I particularly enjoyed the ${itemName}`);
      suggestions.phrases.push(`The ${itemName} could be improved by...`);
      suggestions.phrases.push(`${itemName} was worth every penny`);
      suggestions.phrases.push(`I would definitely order the ${itemName} again`);
    }

    return suggestions;
  }

  /**
   * Analyze user preferences from order history
   */
  analyzeUserPreferences(orders) {
    const preferences = new Set();
    const cuisineFrequency = {};
    const itemFrequency = {};
    const ratingHistory = [];

    for (const order of orders) {
      // Track cuisine preferences
      if (order.restaurantId && order.restaurantId.cuisineTypes) {
        for (const cuisine of order.restaurantId.cuisineTypes) {
          cuisineFrequency[cuisine] = (cuisineFrequency[cuisine] || 0) + 1;
        }
      }
      
      // Track item preferences
      if (order.items) {
        for (const item of order.items) {
          itemFrequency[item.name] = (itemFrequency[item.name] || 0) + 1;
        }
      }
      
      // Track ratings
      if (order.rating && order.rating.overallRating) {
        ratingHistory.push(order.rating.overallRating);
      }
    }

    // Find favorite cuisine
    const favoriteCuisine = Object.entries(cuisineFrequency)
      .sort((a, b) => b[1] - a[1])[0];
    
    if (favoriteCuisine) {
      preferences.add(`You seem to enjoy ${favoriteCuisine[0]} food. Share what keeps you coming back!`);
    }

    // Find frequently ordered items
    const frequentItems = Object.entries(itemFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    if (frequentItems.length > 0) {
      preferences.add(`You've ordered ${frequentItems.map(i => i[0]).join(', ')} multiple times. What makes them your go-to?`);
    }

    // Calculate average rating tendency
    if (ratingHistory.length > 0) {
      const avgRating = ratingHistory.reduce((a, b) => a + b, 0) / ratingHistory.length;
      if (avgRating >= 4) {
        preferences.add('You generally leave positive reviews. Share what restaurants are doing right!');
      } else if (avgRating <= 2) {
        preferences.add('You have high standards. Help others by sharing what could be improved.');
      }
    }

    return Array.from(preferences);
  }

  /**
   * Get frequently ordered items
   */
  getFrequentlyOrderedItems(orders) {
    const itemFrequency = {};
    
    for (const order of orders) {
      if (order.items) {
        for (const item of order.items) {
          itemFrequency[item.name] = (itemFrequency[item.name] || 0) + 1;
        }
      }
    }
    
    return Object.entries(itemFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);
  }

  /**
   * Generate question prompts
   */
  generateQuestionPrompts(restaurant, order) {
    const questions = [
      'How was the food quality and taste?',
      'Was the delivery/pickup on time?',
      'How would you rate the packaging?',
      'Would you recommend this restaurant to friends?',
      'What dish stood out the most?',
      'Was the portion size adequate?',
      'How was the temperature of the food?',
      'Did the food match the description?',
    ];

    if (restaurant && restaurant.deliverySettings) {
      questions.push('Was the delivery fee reasonable?');
      questions.push('How was the delivery time compared to estimate?');
    }

    if (order && order.items && order.items.length > 1) {
      questions.push('Which dish was your favorite and why?');
      questions.push('Were there any dishes that didn\'t meet expectations?');
    }

    return questions;
  }

  /**
   * Predict rating based on draft content
   */
  predictRatingFromDraft(draft) {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'delicious', 'love', 'best', 'wonderful', 'fantastic', 'awesome', 'perfect'];
    const negativeWords = ['bad', 'poor', 'terrible', 'awful', 'disappointing', 'hate', 'worst', 'horrible', 'mediocre', 'bland'];
    
    const lowerDraft = draft.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;
    
    for (const word of positiveWords) {
      if (lowerDraft.includes(word)) positiveCount++;
    }
    
    for (const word of negativeWords) {
      if (lowerDraft.includes(word)) negativeCount++;
    }
    
    const total = positiveCount + negativeCount;
    if (total === 0) return 3;
    
    const ratio = positiveCount / total;
    if (ratio >= 0.8) return 5;
    if (ratio >= 0.6) return 4;
    if (ratio >= 0.4) return 3;
    if (ratio >= 0.2) return 2;
    return 1;
  }

  /**
   * Get rating-appropriate phrases
   */
  getRatingPhrases(rating) {
    const phrases = {
      5: [
        'Absolutely loved it!',
        'Best meal I\'ve had!',
        'Will definitely order again',
        'Highly recommended!',
        'Exceeded my expectations',
        'Everything was perfect!'
      ],
      4: [
        'Really good experience',
        'Tasty food and quick service',
        'Almost perfect!',
        'Very satisfied with my order',
        'Great value for money'
      ],
      3: [
        'Decent experience',
        'Average food, might try again',
        'Nothing special but not bad',
        'It was okay',
        'Could be better'
      ],
      2: [
        'Disappointed with the quality',
        'Needs improvement',
        'Not worth the price',
        'Below expectations',
        'Wouldn\'t order again'
      ],
      1: [
        'Very disappointing',
        'Would not recommend',
        'Worst experience',
        'Terrible quality',
        'Complete letdown'
      ],
    };
    
    return phrases[rating] || phrases[3];
  }

  /**
   * Get review templates
   */
  getReviewTemplates(restaurant, order) {
    const restaurantName = restaurant ? restaurant.name : '[Restaurant Name]';
    const templates = [
      {
        title: 'Detailed Food Review',
        template: `I ordered from ${restaurantName} and the experience was [adjective]. The [specific dish] was [adjective] - [explain why]. The packaging was [adjective] and delivery was [on time/late]. Overall, I would rate this [rating]/5.`,
        rating: 4,
      },
      {
        title: 'Quick & Simple Review',
        template: `[Adjective] food from ${restaurantName}! The [dish name] was [adjective]. The service was [adjective]. ${'[Would/Would not]'} recommend. Rating: [rating]/5`,
        rating: 4,
      },
      {
        title: 'Service Focused Review',
        template: `The service from ${restaurantName} was [adjective]. The staff was [adjective] and [helpful/rude]. The food arrived [on time/late] and was [hot/cold]. Rating: [rating]/5`,
        rating: 3,
      },
      {
        title: 'First-Time Order Review',
        template: `This was my first time ordering from ${restaurantName}. I tried the [dish name] and it was [adjective]. The [other dish] was [adjective]. I will ${'[definitely/probably/won\'t]'} order from here again. Rating: [rating]/5`,
        rating: 4,
      },
      {
        title: 'Value for Money Review',
        template: `For ₹[price], the portion size was [generous/small]. The quality of ingredients was [good/poor]. ${restaurantName} offers [good/poor] value for money. Rating: [rating]/5`,
        rating: 3,
      },
    ];
    
    return templates;
  }

  /**
   * Get category-specific keywords
   */
  getCategoryKeywords() {
    return this.keywordCategories;
  }

  /**
   * Generate personalized opening phrases
   */
  generatePersonalizedOpenings(orders, restaurant) {
    const openings = [];
    const orderCount = orders.length;
    const restaurantName = restaurant ? restaurant.name : 'this restaurant';
    
    if (orderCount === 1) {
      openings.push(`As a first-time customer of ${restaurantName}, I was...`);
      openings.push(`I decided to try ${restaurantName} for the first time and...`);
    } else if (orderCount <= 5) {
      openings.push(`I've ordered from ${restaurantName} a few times now and...`);
      openings.push(`After multiple orders from ${restaurantName}, here's my honest review...`);
    } else {
      openings.push(`As a regular customer of ${restaurantName} (${orderCount}+ orders), I can confidently say...`);
      openings.push(`Having ordered from ${restaurantName} over ${orderCount} times, I've noticed...`);
    }
    
    return openings;
  }

  /**
   * Analyze sentiment of review content
   */
  analyzeSentiment(content) {
    const score = this.sentimentAnalyzer.getSentiment(this.tokenizer.tokenize(content));
    
    let sentiment;
    if (score > 0.2) sentiment = 'positive';
    else if (score < -0.2) sentiment = 'negative';
    else sentiment = 'neutral';
    
    let confidence = Math.min(Math.abs(score) * 2, 1);
    
    return {
      score,
      sentiment,
      confidence,
      interpretation: this.getSentimentInterpretation(score),
    };
  }

  /**
   * Get sentiment interpretation
   */
  getSentimentInterpretation(score) {
    if (score >= 0.5) return 'very positive';
    if (score >= 0.2) return 'positive';
    if (score >= -0.2) return 'neutral';
    if (score >= -0.5) return 'negative';
    return 'very negative';
  }

  /**
   * Extract keywords from text
   */
  extractKeywords(text) {
    const tokens = this.tokenizer.tokenize(text.toLowerCase());
    const filteredTokens = tokens.filter(token => 
      token.length > 3 && 
      !stopwords.includes(token) &&
      !/^\d+$/.test(token)
    );
    
    // Get unique keywords
    return [...new Set(filteredTokens)].slice(0, 10);
  }

  /**
   * Get word count
   */
  getWordCount(text) {
    return text.trim().split(/\s+/).length;
  }

  /**
   * Calculate confidence score for suggestions
   */
  calculateConfidenceScore(draft) {
    if (!draft || draft.length === 0) return 0.5;
    
    const wordCount = this.getWordCount(draft);
    if (wordCount < 10) return 0.3;
    if (wordCount < 30) return 0.6;
    if (wordCount < 50) return 0.8;
    return 0.9;
  }

  /**
   * Suggest improvements for low-quality reviews
   */
  suggestImprovements(content) {
    const suggestions = [];
    const wordCount = this.getWordCount(content);
    
    if (wordCount < 20) {
      suggestions.push('Add more details about your experience');
      suggestions.push('Mention specific dishes you tried');
    }
    
    if (!content.includes('would recommend') && !content.includes('will order')) {
      suggestions.push('Let others know if you would recommend this restaurant');
    }
    
    const hasRating = /\b[1-5]\b/.test(content);
    if (!hasRating) {
      suggestions.push('Include a rating (1-5) to help others decide');
    }
    
    return suggestions;
  }
}

module.exports = new AISuggestionService();