/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
// services/rules/growthRules.js
// Deterministic rules for baby growth assessment
// Returns structured data ONLY — no Bengali text
// WHO standards are hardcoded

import { calculatePercentile } from '../../data/whoGrowthStandards';
import { CONFIG } from '../../utils/constants';

/**
 * Assess baby's growth status
 * @param {Array} measurements - Growth measurements (newest first)
 * @param {number} ageMonths - Baby's age in months
 * @param {string} gender - 'male' or 'female'
 * @returns {Object} Growth assessment
 */
export function assessGrowth(measurements, ageMonths, gender) {
  if (!measurements || measurements.length === 0) {
    return {
      status: 'no_data',
      severity: 'none',
      alerts: ['no_measurements'],
      hasMeasurements: false,
      latestWeight: null,
      percentile: null,
      velocity: null,
      prediction: null,
    };
  }

  const latest = measurements[0];
  const percentile = calculatePercentile(latest.ageMonths || ageMonths, latest.weight, gender);

  // Velocity calculation (needs 2+ measurements)
  let velocity = null;
  if (measurements.length >= 2) {
    const previous = measurements[1];
    const weightGain = latest.weight - previous.weight;
    const daysBetween = Math.floor(
      (new Date(latest.date) - new Date(previous.date)) / (1000 * 60 * 60 * 24)
    );

    if (daysBetween > 0) {
      const gramsPerMonth = Math.round((weightGain * 1000 / daysBetween) * 30);
      velocity = {
        gainGrams: Math.round(weightGain * 1000),
        daysBetween,
        gramsPerMonth,
        isGood: gramsPerMonth >= CONFIG.minGrowthVelocity,
      };
    }
  }

  // Prediction (needs velocity)
  let prediction = null;
  if (velocity) {
    prediction = {
      nextMonthWeight: Math.round((latest.weight + velocity.gramsPerMonth / 1000) * 10) / 10,
    };
  }

  // Alerts
  const alerts = [];
  let severity = 'none';
  let status = 'normal';

  if (percentile) {
    if (percentile.status === 'underweight') {
      status = 'underweight';
      severity = 'high';
      alerts.push('weight_below_p3');
    } else if (percentile.status === 'slightly_low') {
      status = 'slightly_low';
      severity = 'medium';
      alerts.push('weight_below_p15');
    } else if (percentile.status === 'overweight') {
      status = 'overweight';
      severity = 'medium';
      alerts.push('weight_above_p97');
    } else if (percentile.status === 'slightly_high') {
      status = 'slightly_high';
      severity = 'low';
    }
  }

  // Velocity alerts
  if (velocity && !velocity.isGood && ageMonths < 6) {
    alerts.push('slow_growth_velocity');
    if (severity === 'none') severity = 'medium';
  }

  // Weight loss (negative velocity)
  if (velocity && velocity.gainGrams < 0) {
    alerts.push('weight_loss');
    severity = 'high';
  }

  return {
    status,
    severity,
    alerts,
    hasMeasurements: true,
    latestWeight: latest.weight,
    latestHeight: latest.height,
    latestDate: latest.date,
    percentile: percentile ? {
      range: percentile.percentile,
      status: percentile.status,
      color: percentile.color,
    } : null,
    velocity,
    prediction,
    totalMeasurements: measurements.length,
  };
}

/**
 * Get feedback after adding a new measurement
 * @param {Array} measurements - Updated measurements array
 * @param {number} ageMonths - Baby's age
 * @param {string} gender - 'male' or 'female'
 * @returns {Object} Post-measurement feedback
 */
export function getPostMeasurementFeedback(measurements, ageMonths, gender) {
  const assessment = assessGrowth(measurements, ageMonths, gender);

  let feedbackType = 'neutral';

  if (assessment.percentile?.status === 'normal') {
    feedbackType = 'healthy';
  } else if (assessment.percentile?.status === 'underweight' || assessment.alerts.includes('weight_loss')) {
    feedbackType = 'concern';
  } else if (assessment.velocity && assessment.velocity.isGood) {
    feedbackType = 'good_velocity';
  } else if (assessment.velocity && !assessment.velocity.isGood) {
    feedbackType = 'slow_velocity';
  }

  // Milestone check
  let milestone = null;
  if (measurements.length >= 2) {
    const current = measurements[0].weight;
    const previous = measurements[1].weight;
    const milestoneWeights = [4, 5, 6, 7, 8, 9, 10];
    const crossed = milestoneWeights.find(m => previous < m && current >= m);
    if (crossed) milestone = crossed;
  }

  return {
    feedbackType,
    assessment,
    milestone,
  };
}