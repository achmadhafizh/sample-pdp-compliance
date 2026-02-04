
import { Patient, Gender, AuditLog } from './types';

export const INITIAL_PATIENTS: Patient[] = [
  {
    id: 'p-001',
    nik: '3273100412090001',
    name: 'Budi Santoso',
    email: 'budi.santoso@email.com',
    phone: '081234567890',
    birthDate: '15-05-1985',
    gender: Gender.Male,
    address: 'Jl. Merdeka No. 123, Bandung',
    bloodType: 'O',
    allergies: ['Amoxicillin'],
    consentSigned: true,
    consentDate: '2023-10-01',
    records: [
      {
        id: 'mr-101',
        date: '2023-12-10',
        diagnosis: 'Hipertensi Grade I',
        treatment: 'Observasi tekanan darah rutin',
        prescriptions: ['Amlodipine 5mg'],
        doctor: 'dr. Sarah Wijaya'
      }
    ]
  },
  {
    id: 'p-002',
    nik: '3171050210920005',
    name: 'Siti Aminah',
    email: 'siti.aminah@email.com',
    phone: '085711223344',
    birthDate: '22-08-1992',
    gender: Gender.Female,
    address: 'Komp. Hijau Lestari B-4, Jakarta Selatan',
    bloodType: 'A',
    allergies: ['Seafood', 'Debu'],
    consentSigned: true,
    consentDate: '2023-11-15',
    records: [
      {
        id: 'mr-102',
        date: '2024-01-05',
        diagnosis: 'Gastritis Akut',
        treatment: 'Diet lambung',
        prescriptions: ['Omeprazole 20mg', 'Antasida'],
        doctor: 'dr. Achmad Hafizh'
      }
    ]
  }
];

export const INITIAL_LOGS: AuditLog[] = [
  {
    id: 'log-001',
    timestamp: new Date().toISOString(),
    userId: 'u-dr-hafizh',
    action: 'VIEW',
    resourceId: 'p-001',
    resourceType: 'PATIENT',
    details: 'Melihat profil pasien Budi Santoso'
  }
];
