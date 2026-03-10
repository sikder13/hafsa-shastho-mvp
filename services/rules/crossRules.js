// services/rules/crossRules.js
// Cross-connection rules between mother and baby data
// These detect correlations that neither motherRules nor feedRules catch alone
// Returns structured data ONLY — no Bengali text

/**
 * Analyze cross-connections between mother and baby health
 * @param {Object} motherAssessment - From motherRules.assessMother()
 * @param {Object} feedAssessment - From feedRules.assessFeeding()
 * @param {Object} growthAssessment - From growthRules.assessGrowth()
 * @returns {Object} Cross-connection insights
 */
export function analyzeCrossConnections(motherAssessment, feedAssessment, growthAssessment) {
    const insights = [];
    const alerts = [];
  
    if (!motherAssessment || !feedAssessment) {
      return { insights, alerts, hasCrossInsights: false };
    }
  
    // === CROSS-CONNECTION 1: Mother sleep + Baby feeding ===
    // If mother is sleep deprived AND baby feeds are low, they're connected
    if (
      motherAssessment.sleep?.pattern?.trend === 'very_low' ||
      motherAssessment.sleep?.pattern?.trend === 'critical'
    ) {
      if (feedAssessment.status === 'low' || feedAssessment.status === 'critical') {
        insights.push({
          type: 'sleep_feed_connection',
          motherFactor: 'low_sleep',
          babyFactor: 'low_feeds',
          severity: 'high',
          recommendation: 'family_help_night_feeds',
        });
      }
  
      // Even if feeds are okay, low sleep is dangerous
      insights.push({
        type: 'mother_needs_rest',
        severity: motherAssessment.sleep.pattern.trend === 'critical' ? 'critical' : 'high',
        recommendation: 'sleep_when_baby_sleeps',
      });
    }
  
    // === CROSS-CONNECTION 2: Mother mood + Feed trend ===
    // Sad mother + decreasing feeds = milk supply risk
    if (
      (motherAssessment.mood?.today === 'sad' || motherAssessment.mood?.today === 'bad') &&
      (feedAssessment.trend === 'decreasing')
    ) {
      insights.push({
        type: 'mood_feed_connection',
        motherFactor: 'sad_mood',
        babyFactor: 'feed_decreasing',
        severity: 'high',
        recommendation: 'stress_affects_milk_supply',
      });
    }
  
    // === CROSS-CONNECTION 3: No support + Sad mood ===
    // Mother handling everything alone AND feeling bad
    if (
      motherAssessment.support?.consecutiveNoHelpDays >= 3 &&
      motherAssessment.mood?.pattern?.consecutiveSadDays >= 2
    ) {
      insights.push({
        type: 'isolation_mood_connection',
        motherFactor: 'no_support',
        days: motherAssessment.support.consecutiveNoHelpDays,
        severity: 'high',
        recommendation: 'ask_for_help',
      });
      alerts.push('isolation_depression_risk');
    }
  
    // === CROSS-CONNECTION 4: Low water + Breastfeeding ===
    if (
      motherAssessment.water?.today < 4 &&
      feedAssessment.breastCount > 0
    ) {
      insights.push({
        type: 'water_milk_connection',
        motherFactor: 'low_water',
        waterIntake: motherAssessment.water.today,
        severity: 'medium',
        recommendation: 'drink_more_water_for_milk',
      });
    }
  
    // === CROSS-CONNECTION 5: Mother not checked in + Baby data shows issues ===
    if (
      !motherAssessment.checkedInToday &&
      (feedAssessment.status === 'low' || feedAssessment.status === 'critical')
    ) {
      insights.push({
        type: 'unchecked_mother_baby_issue',
        severity: 'medium',
        recommendation: 'checkin_to_understand_full_picture',
      });
    }
  
    // === CROSS-CONNECTION 6: Growth concern + Feed pattern ===
    if (growthAssessment && growthAssessment.status !== 'no_data') {
      if (
        (growthAssessment.status === 'underweight' || growthAssessment.status === 'slightly_low') &&
        (feedAssessment.trend === 'decreasing' || feedAssessment.status === 'low')
      ) {
        insights.push({
          type: 'growth_feed_connection',
          growthFactor: growthAssessment.status,
          feedFactor: feedAssessment.status,
          severity: 'high',
          recommendation: 'increase_feeds_for_growth',
        });
        alerts.push('growth_feed_concern');
      }
    }
  
    // === CROSS-CONNECTION 7: EPDS high + sleep critical ===
    if (
      motherAssessment.epds?.score >= 13 &&
      motherAssessment.sleep?.pattern?.trend === 'critical'
    ) {
      insights.push({
        type: 'depression_sleep_connection',
        severity: 'critical',
        recommendation: 'professional_help_needed',
      });
      alerts.push('depression_sleep_crisis');
    }
  
    return {
      insights,
      alerts,
      hasCrossInsights: insights.length > 0,
      highestSeverity: insights.length > 0 ?
        insights.reduce((max, i) => {
          const order = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
          return (order[i.severity] || 0) > (order[max] || 0) ? i.severity : max;
        }, 'none') : 'none',
    };
  }