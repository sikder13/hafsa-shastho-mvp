/**
 * Hafsa Sastho (হাফসা স্বাস্থ্য)
 * Bangladesh's First AI Companion for Postpartum and Early Childhood Care
 * Copyright © 2026 Nahl Technologies Inc. All rights reserved.
 *
 * @author Udaay Sikder — Co-Founder & Dev
 */
// Bangladesh EPI (Expanded Program on Immunization) Schedule
export const BD_EPI_SCHEDULE = [
  {
    id: 'bcg',
    name: 'বিসিজি (BCG)',
    nameBangla: 'বিসিজি',
    nameEnglish: 'BCG',
    ageDays: 0,
    ageDisplay: 'জন্মের সময়',
    description: 'যক্ষ্মা (টিবি) প্রতিরোধ',
    notes: 'জন্মের সাথে সাথে দিতে হবে'
  },
  {
    id: 'opv-0',
    name: 'পোলিও-০ (OPV-0)',
    nameBangla: 'পোলিও-০',
    nameEnglish: 'OPV-0',
    ageDays: 0,
    ageDisplay: 'জন্মের সময়',
    description: 'পোলিও প্রতিরোধ',
    notes: 'জন্মের সাথে সাথে দিতে হবে'
  },
  {
    id: 'penta-1',
    name: 'পেন্টা-১ (Penta-1)',
    nameBangla: 'পেন্টা-১',
    nameEnglish: 'Pentavalent-1',
    ageDays: 42,
    ageDisplay: '৬ সপ্তাহ',
    description: 'ডিপথেরিয়া, হুপিং কাশি, ধনুষ্টংকার, হেপাটাইটিস বি, হিমোফাইলাস ইনফ্লুয়েঞ্জা বি',
    notes: 'অবশ্যই ৬ সপ্তাহে দিতে হবে'
  },
  {
    id: 'opv-1',
    name: 'পোলিও-১ (OPV-1)',
    nameBangla: 'পোলিও-১',
    nameEnglish: 'OPV-1',
    ageDays: 42,
    ageDisplay: '৬ সপ্তাহ',
    description: 'পোলিও প্রতিরোধ',
    notes: 'পেন্টা-১ এর সাথে একই দিনে'
  },
  {
    id: 'pcv-1',
    name: 'পিসিভি-১ (PCV-1)',
    nameBangla: 'পিসিভি-১',
    nameEnglish: 'PCV-1',
    ageDays: 42,
    ageDisplay: '৬ সপ্তাহ',
    description: 'নিউমোনিয়া প্রতিরোধ',
    notes: 'পেন্টা-১ এর সাথে একই দিনে'
  },
  {
    id: 'penta-2',
    name: 'পেন্টা-২ (Penta-2)',
    nameBangla: 'পেন্টা-২',
    nameEnglish: 'Pentavalent-2',
    ageDays: 70,
    ageDisplay: '১০ সপ্তাহ',
    description: 'ডিপথেরিয়া, হুপিং কাশি, ধনুষ্টংকার, হেপাটাইটিস বি, হিমোফাইলাস ইনফ্লুয়েঞ্জা বি',
    notes: 'পেন্টা-১ এর ৪ সপ্তাহ পর'
  },
  {
    id: 'opv-2',
    name: 'পোলিও-২ (OPV-2)',
    nameBangla: 'পোলিও-২',
    nameEnglish: 'OPV-2',
    ageDays: 70,
    ageDisplay: '১০ সপ্তাহ',
    description: 'পোলিও প্রতিরোধ',
    notes: 'পেন্টা-২ এর সাথে একই দিনে'
  },
  {
    id: 'pcv-2',
    name: 'পিসিভি-২ (PCV-2)',
    nameBangla: 'পিসিভি-২',
    nameEnglish: 'PCV-2',
    ageDays: 70,
    ageDisplay: '১০ সপ্তাহ',
    description: 'নিউমোনিয়া প্রতিরোধ',
    notes: 'পিসিভি-১ এর ৪ সপ্তাহ পর'
  },
  {
    id: 'penta-3',
    name: 'পেন্টা-৩ (Penta-3)',
    nameBangla: 'পেন্টা-৩',
    nameEnglish: 'Pentavalent-3',
    ageDays: 98,
    ageDisplay: '১৪ সপ্তাহ',
    description: 'ডিপথেরিয়া, হুপিং কাশি, ধনুষ্টংকার, হেপাটাইটিস বি, হিমোফাইলাস ইনফ্লুয়েঞ্জা বি',
    notes: 'পেন্টা-২ এর ৪ সপ্তাহ পর'
  },
  {
    id: 'opv-3',
    name: 'পোলিও-৩ (OPV-3)',
    nameBangla: 'পোলিও-৩',
    nameEnglish: 'OPV-3',
    ageDays: 98,
    ageDisplay: '১৪ সপ্তাহ',
    description: 'পোলিও প্রতিরোধ',
    notes: 'পেন্টা-৩ এর সাথে একই দিনে'
  },
  {
    id: 'pcv-3',
    name: 'পিসিভি-৩ (PCV-3)',
    nameBangla: 'পিসিভি-৩',
    nameEnglish: 'PCV-3',
    ageDays: 98,
    ageDisplay: '১৪ সপ্তাহ',
    description: 'নিউমোনিয়া প্রতিরোধ',
    notes: 'পিসিভি-২ এর ৪ সপ্তাহ পর'
  },
  {
    id: 'ipv',
    name: 'আইপিভি (IPV)',
    nameBangla: 'আইপিভি',
    nameEnglish: 'IPV',
    ageDays: 98,
    ageDisplay: '১৪ সপ্তাহ',
    description: 'পোলিও প্রতিরোধ (ইনজেকশন)',
    notes: 'পেন্টা-৩ এর সাথে একই দিনে'
  },
  {
    id: 'mr-1',
    name: 'এমআর-১ (MR-1)',
    nameBangla: 'হাম-রুবেলা-১',
    nameEnglish: 'Measles-Rubella-1',
    ageDays: 270,
    ageDisplay: '৯ মাস',
    description: 'হাম ও রুবেলা প্রতিরোধ',
    notes: 'অবশ্যই ৯ মাসে দিতে হবে'
  },
  {
    id: 'mr-2',
    name: 'এমআর-২ (MR-2)',
    nameBangla: 'হাম-রুবেলা-২',
    nameEnglish: 'Measles-Rubella-2',
    ageDays: 540,
    ageDisplay: '১৮ মাস',
    description: 'হাম ও রুবেলা প্রতিরোধ',
    notes: 'এমআর-১ এর ৯ মাস পর'
  }
];
