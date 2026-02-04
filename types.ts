
export enum Gender {
  Male = 'Laki-laki',
  Female = 'Perempuan'
}

export interface MedicalRecord {
  id: string;
  date: string;
  diagnosis: string;
  treatment: string;
  prescriptions: string[];
  doctor: string;
}

export interface Patient {
  id: string;
  nik: string; // Masked for privacy
  name: string;
  email: string;
  phone: string;
  birthDate: string;
  gender: Gender;
  address: string;
  bloodType: string;
  allergies: string[];
  consentSigned: boolean;
  consentDate: string;
  records: MedicalRecord[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  action: 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'CONSENT_CHANGE';
  resourceId: string;
  resourceType: 'PATIENT' | 'MEDICAL_RECORD' | 'SYSTEM';
  details: string;
}

export interface AppState {
  patients: Patient[];
  logs: AuditLog[];
  currentUser: {
    id: string;
    name: string;
    role: 'ADMIN' | 'DOCTOR' | 'NURSE';
  };
}
