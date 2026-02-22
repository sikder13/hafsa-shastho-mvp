export const WHO_WEIGHT_BOYS = {
  0: { p3: 2.5, p15: 2.9, p50: 3.3, p85: 3.9, p97: 4.4 },
  1: { p3: 3.4, p15: 3.9, p50: 4.5, p85: 5.1, p97: 5.8 },
  2: { p3: 4.3, p15: 4.9, p50: 5.6, p85: 6.3, p97: 7.1 },
  3: { p3: 5.0, p15: 5.7, p50: 6.4, p85: 7.2, p97: 8.0 },
  4: { p3: 5.6, p15: 6.2, p50: 7.0, p85: 7.8, p97: 8.7 },
  5: { p3: 6.0, p15: 6.7, p50: 7.5, p85: 8.4, p97: 9.3 },
  6: { p3: 6.4, p15: 7.1, p50: 7.9, p85: 8.8, p97: 9.8 },
  9: { p3: 7.1, p15: 7.8, p50: 8.9, p85: 9.9, p97: 11.0 },
  12: { p3: 7.7, p15: 8.6, p50: 9.6, p85: 10.8, p97: 11.9 },
  15: { p3: 8.3, p15: 9.2, p50: 10.3, p85: 11.5, p97: 12.8 },
  18: { p3: 8.8, p15: 9.8, p50: 10.9, p85: 12.2, p97: 13.5 },
  24: { p3: 9.7, p15: 10.8, p50: 12.2, p85: 13.6, p97: 15.3 }
};

export const calculatePercentile = (ageMonths, weight) => {
  const monthKey = ageMonths <= 6 ? ageMonths : 
                   ageMonths <= 12 ? Math.floor(ageMonths / 3) * 3 :
                   ageMonths <= 18 ? Math.floor(ageMonths / 6) * 6 : 24;
  
  const standards = WHO_WEIGHT_BOYS[monthKey];
  if (!standards) return null;

  if (weight < standards.p3) return { percentile: '<3', status: 'underweight', color: '#F44336' };
  if (weight < standards.p15) return { percentile: '3-15', status: 'slightly_low', color: '#FF9800' };
  if (weight < standards.p85) return { percentile: '15-85', status: 'normal', color: '#4CAF50' };
  if (weight < standards.p97) return { percentile: '85-97', status: 'slightly_high', color: '#FF9800' };
  return { percentile: '>97', status: 'overweight', color: '#F44336' };
};
