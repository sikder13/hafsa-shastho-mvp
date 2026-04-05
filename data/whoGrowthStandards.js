/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
// data/whoGrowthStandards.js
// WHO Child Growth Standards — Weight-for-age (0-24 months)
// Source: WHO Multicentre Growth Reference Study (2006)
// Both boys and girls, every month 0-24

export const WHO_WEIGHT_BOYS = {
  0: { p3: 2.5, p15: 2.9, p50: 3.3, p85: 3.9, p97: 4.4 },
  1: { p3: 3.4, p15: 3.9, p50: 4.5, p85: 5.1, p97: 5.8 },
  2: { p3: 4.3, p15: 4.9, p50: 5.6, p85: 6.3, p97: 7.1 },
  3: { p3: 5.0, p15: 5.7, p50: 6.4, p85: 7.2, p97: 8.0 },
  4: { p3: 5.6, p15: 6.2, p50: 7.0, p85: 7.8, p97: 8.7 },
  5: { p3: 6.0, p15: 6.7, p50: 7.5, p85: 8.4, p97: 9.3 },
  6: { p3: 6.4, p15: 7.1, p50: 7.9, p85: 8.8, p97: 9.8 },
  7: { p3: 6.7, p15: 7.4, p50: 8.3, p85: 9.2, p97: 10.3 },
  8: { p3: 6.9, p15: 7.7, p50: 8.6, p85: 9.6, p97: 10.7 },
  9: { p3: 7.1, p15: 7.9, p50: 8.9, p85: 9.9, p97: 11.0 },
  10: { p3: 7.4, p15: 8.2, p50: 9.2, p85: 10.2, p97: 11.4 },
  11: { p3: 7.6, p15: 8.4, p50: 9.4, p85: 10.5, p97: 11.7 },
  12: { p3: 7.7, p15: 8.6, p50: 9.6, p85: 10.8, p97: 11.9 },
  13: { p3: 7.9, p15: 8.8, p50: 9.9, p85: 11.0, p97: 12.3 },
  14: { p3: 8.1, p15: 9.0, p50: 10.1, p85: 11.3, p97: 12.6 },
  15: { p3: 8.3, p15: 9.2, p50: 10.3, p85: 11.5, p97: 12.8 },
  16: { p3: 8.4, p15: 9.4, p50: 10.5, p85: 11.7, p97: 13.1 },
  17: { p3: 8.6, p15: 9.6, p50: 10.7, p85: 12.0, p97: 13.4 },
  18: { p3: 8.8, p15: 9.8, p50: 10.9, p85: 12.2, p97: 13.5 },
  19: { p3: 8.9, p15: 10.0, p50: 11.1, p85: 12.5, p97: 13.9 },
  20: { p3: 9.1, p15: 10.1, p50: 11.3, p85: 12.7, p97: 14.1 },
  21: { p3: 9.2, p15: 10.3, p50: 11.5, p85: 12.9, p97: 14.3 },
  22: { p3: 9.4, p15: 10.5, p50: 11.8, p85: 13.2, p97: 14.7 },
  23: { p3: 9.5, p15: 10.7, p50: 12.0, p85: 13.4, p97: 15.0 },
  24: { p3: 9.7, p15: 10.8, p50: 12.2, p85: 13.6, p97: 15.3 }
};

export const WHO_WEIGHT_GIRLS = {
  0: { p3: 2.4, p15: 2.8, p50: 3.2, p85: 3.7, p97: 4.2 },
  1: { p3: 3.2, p15: 3.6, p50: 4.2, p85: 4.8, p97: 5.5 },
  2: { p3: 3.9, p15: 4.5, p50: 5.1, p85: 5.8, p97: 6.6 },
  3: { p3: 4.5, p15: 5.2, p50: 5.8, p85: 6.6, p97: 7.5 },
  4: { p3: 5.0, p15: 5.7, p50: 6.4, p85: 7.3, p97: 8.2 },
  5: { p3: 5.4, p15: 6.1, p50: 6.9, p85: 7.8, p97: 8.8 },
  6: { p3: 5.7, p15: 6.5, p50: 7.3, p85: 8.2, p97: 9.3 },
  7: { p3: 6.0, p15: 6.8, p50: 7.6, p85: 8.6, p97: 9.8 },
  8: { p3: 6.3, p15: 7.0, p50: 7.9, p85: 9.0, p97: 10.2 },
  9: { p3: 6.5, p15: 7.3, p50: 8.2, p85: 9.3, p97: 10.5 },
  10: { p3: 6.7, p15: 7.5, p50: 8.5, p85: 9.6, p97: 10.9 },
  11: { p3: 6.9, p15: 7.7, p50: 8.7, p85: 9.9, p97: 11.2 },
  12: { p3: 7.0, p15: 7.9, p50: 8.9, p85: 10.1, p97: 11.5 },
  13: { p3: 7.2, p15: 8.1, p50: 9.2, p85: 10.4, p97: 11.8 },
  14: { p3: 7.4, p15: 8.3, p50: 9.4, p85: 10.6, p97: 12.1 },
  15: { p3: 7.6, p15: 8.5, p50: 9.6, p85: 10.9, p97: 12.4 },
  16: { p3: 7.7, p15: 8.7, p50: 9.8, p85: 11.1, p97: 12.6 },
  17: { p3: 7.9, p15: 8.9, p50: 10.0, p85: 11.4, p97: 12.9 },
  18: { p3: 8.1, p15: 9.1, p50: 10.2, p85: 11.6, p97: 13.2 },
  19: { p3: 8.2, p15: 9.2, p50: 10.4, p85: 11.8, p97: 13.5 },
  20: { p3: 8.4, p15: 9.4, p50: 10.6, p85: 12.1, p97: 13.7 },
  21: { p3: 8.6, p15: 9.6, p50: 10.9, p85: 12.3, p97: 14.0 },
  22: { p3: 8.7, p15: 9.8, p50: 11.1, p85: 12.5, p97: 14.3 },
  23: { p3: 8.9, p15: 10.0, p50: 11.3, p85: 12.8, p97: 14.6 },
  24: { p3: 9.0, p15: 10.2, p50: 11.5, p85: 13.0, p97: 14.8 }
};

/**
 * Calculate percentile for a given age, weight, and gender
 * @param {number} ageMonths - Baby's age in months
 * @param {number} weight - Weight in kg
 * @param {string} gender - 'male' or 'female' (defaults to male if unknown)
 * @returns {Object|null} - {percentile, status, color}
 */
export const calculatePercentile = (ageMonths, weight, gender) => {
  // Clamp age to 0-24
  const month = Math.min(24, Math.max(0, Math.round(ageMonths)));

  // Select correct gender table
  const table = (gender === 'female') ? WHO_WEIGHT_GIRLS : WHO_WEIGHT_BOYS;
  const standards = table[month];

  if (!standards) return null;

  if (weight < standards.p3) return { percentile: '<৩', status: 'underweight', color: '#F44336' };
  if (weight < standards.p15) return { percentile: '৩-১৫', status: 'slightly_low', color: '#FF9800' };
  if (weight < standards.p85) return { percentile: '১৫-৮৫', status: 'normal', color: '#4CAF50' };
  if (weight < standards.p97) return { percentile: '৮৫-৯৭', status: 'slightly_high', color: '#FF9800' };
  return { percentile: '>৯৭', status: 'overweight', color: '#F44336' };
};
