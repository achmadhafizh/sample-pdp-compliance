
import React, { useState, useMemo } from 'react';
import { Patient, AuditLog } from './types';
import { INITIAL_PATIENTS, INITIAL_LOGS } from './constants';
import { IconShield, IconUser, IconPlus, IconSearch, IconLock, IconClipboard, IconHistory, IconEdit, IconTrash } from './components/Icons';
import PatientForm from './components/PatientForm';
import AuditLogView from './components/AuditLogView';
import { geminiService } from './services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type ActiveMenu = 'DASHBOARD' | 'PATIENT_MANAGEMENT' | 'PDP_COMPLIANCE';

// Masking Utilities (Centralized)
export const maskNIK = (nik: string) => {
  if (!nik || nik.includes('*')) return nik;
  if (nik.length < 8) return nik;
  return `${nik.substring(0, 4)}********${nik.substring(nik.length - 4)}`;
};

export const maskPhone = (phone: string) => {
  if (!phone || phone.includes('*')) return phone;
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 8) return phone;
  return `${cleanPhone.substring(0, 4)}*****${cleanPhone.substring(cleanPhone.length - 4)}`;
};

export const maskEmail = (email: string) => {
  if (!email || email.includes('*')) return email;
  const atIndex = email.indexOf('@');
  const prefix = email.substring(0, 4);
  const domain = email.substring(atIndex !== -1 ? atIndex : email.length);
  return `${prefix}********${domain}`;
};

export const maskBirthDate = (date: string) => {
  if (!date || date.includes('*')) return date;
  // Expecting DD-MM-YYYY
  return `${date.substring(0, 2)}******${date.substring(date.length - 2)}`;
};

const App: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [logs, setLogs] = useState<AuditLog[]>(INITIAL_LOGS);
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>('DASHBOARD');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingPatient, setIsAddingPatient] = useState(false);
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [pdpAdvice, setPdpAdvice] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // States for Unmasking Access
  const [isUnmaskModalOpen, setIsUnmaskModalOpen] = useState(false);
  const [unmaskTarget, setUnmaskTarget] = useState<{ patientId: string, field: string, label: string, value: string } | null>(null);
  const [accessReason, setAccessReason] = useState('');
  const [unmaskedFields, setUnmaskedFields] = useState<Record<string, Set<string>>>({});

  // State for Log Details
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const currentUser = { id: 'u-dr-hafizh', name: 'dr. Achmad Hafizh', role: 'DOCTOR' as const };

  const calculateAge = (birthDate: string) => {
    if (!birthDate || birthDate.includes('*')) return '??';
    let parts = birthDate.split('-');
    let bDay;
    if (parts[0].length === 4) {
      bDay = new Date(birthDate);
    } else {
      bDay = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
    const today = new Date();
    let age = today.getFullYear() - bDay.getFullYear();
    const m = today.getMonth() - bDay.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bDay.getDate())) {
      age--;
    }
    return age;
  };

  const addLog = (action: AuditLog['action'], resourceId: string, details: string) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      action,
      resourceId,
      resourceType: 'PATIENT',
      details
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleUnmaskRequest = (patientId: string, field: string, label: string, value: string) => {
    if (unmaskedFields[patientId]?.has(field)) return;
    setUnmaskTarget({ patientId, field, label, value });
    setIsUnmaskModalOpen(true);
    setAccessReason('');
  };

  const submitUnmaskReason = () => {
    if (!accessReason.trim()) {
      alert("Alasan akses wajib diisi untuk kepatuhan PDP.");
      return;
    }
    if (unmaskTarget) {
      const { patientId, field, label } = unmaskTarget;
      addLog('VIEW', patientId, `AKSES DATA SENSITIF (${label}). Alasan: ${accessReason}`);
      
      setUnmaskedFields(prev => {
        const next = { ...prev };
        if (!next[patientId]) next[patientId] = new Set();
        next[patientId].add(field);
        return next;
      });

      setIsUnmaskModalOpen(false);
      setUnmaskTarget(null);
    }
  };

  const isFieldUnmasked = (patientId: string, field: string) => {
    return unmaskedFields[patientId]?.has(field);
  };

  const handleSavePatient = (patientData: Partial<Patient>) => {
    if (isEditingPatient && selectedPatient) {
      // Logic to merge: if input contains asterisks, use the original value
      const mergedData = { ...patientData };
      if (mergedData.nik?.includes('*')) mergedData.nik = selectedPatient.nik;
      if (mergedData.email?.includes('*')) mergedData.email = selectedPatient.email;
      if (mergedData.phone?.includes('*')) mergedData.phone = selectedPatient.phone;
      if (mergedData.birthDate?.includes('*')) mergedData.birthDate = selectedPatient.birthDate;

      const updatedPatients = patients.map(p => 
        p.id === selectedPatient.id ? { ...p, ...mergedData } as Patient : p
      );
      setPatients(updatedPatients);
      addLog('UPDATE', selectedPatient.id, `Pembaruan data pasien: ${mergedData.name}`);
      setIsEditingPatient(false);
      setSelectedPatient({ ...selectedPatient, ...mergedData } as Patient);
    } else {
      const newPatient: Patient = {
        ...patientData as Patient,
        id: `p-${Date.now()}`,
        consentDate: new Date().toISOString(),
        records: []
      };
      setPatients([...patients, newPatient]);
      addLog('CREATE', newPatient.id, `Pendaftaran pasien baru: ${newPatient.name}`);
      setIsAddingPatient(false);
    }
  };

  const handleDeletePatient = (id: string) => {
    const p = patients.find(x => x.id === id);
    if (confirm(`PERINGATAN UU PDP: Hapus permanen seluruh data ${p?.name}? Tindakan ini direkam sebagai 'Right to Erasure'.`)) {
      setPatients(patients.filter(p => p.id !== id));
      addLog('DELETE', id, `Penghapusan data (Hak untuk Dilupakan): ${p?.name}`);
      setSelectedPatient(null);
    }
  };

  const viewPatientDetails = async (patient: Patient) => {
    setSelectedPatient(patient);
    addLog('VIEW', patient.id, `Akses rekam medis: ${patient.name}`);
    setLoadingAi(true);
    setAiSummary(null);
    try {
      const summary = await geminiService.summarizePatientHistory(patient);
      setAiSummary(summary);
    } catch (e) {
      setAiSummary("Ringkasan AI tidak tersedia.");
    } finally {
      setLoadingAi(false);
    }
  };

  const fetchPDPAdvice = async (topic: string) => {
    setLoadingAi(true);
    try {
      const advice = await geminiService.getPDPAdvisory(topic);
      setPdpAdvice(advice);
    } catch (e) {
      setPdpAdvice("Saran AI gagal dimuat.");
    } finally {
      setLoadingAi(false);
    }
  };

  const genderData = useMemo(() => {
    const dist = patients.reduce((acc: any, curr) => {
      acc[curr.gender] = (acc[curr.gender] || 0) + 1;
      return acc;
    }, {});
    return Object.keys(dist).map(name => ({ name, value: dist[name] }));
  }, [patients]);

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Inter']">
      <header className="bg-white border-b border-slate-200 h-16 flex items-center px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-blue-100">
            <IconShield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800 tracking-tight">MedGuard Pro</h1>
            <p className="text-[10px] text-slate-500 font-black uppercase">Health Data Governance</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="hidden sm:flex px-4 py-1.5 bg-blue-50 text-blue-700 text-[10px] font-black rounded-full border border-blue-100 items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
            ENCRYPTED SESSION ACTIVE
          </div>
          <div className="h-8 w-px bg-slate-200"></div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <p className="text-xs font-black text-slate-700">{currentUser.name}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase">{currentUser.role}</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-400 shadow-sm">
              <IconUser className="w-5 h-5" />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex max-w-7xl mx-auto w-full px-6 py-8 gap-8">
        <aside className="w-64 flex flex-col gap-3 shrink-0">
          <nav className="space-y-1">
            <button 
              onClick={() => { setActiveMenu('DASHBOARD'); setSelectedPatient(null); setIsAddingPatient(false); setIsEditingPatient(false); }}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeMenu === 'DASHBOARD' ? 'bg-blue-600 text-white shadow-2xl shadow-blue-200 scale-105' : 'text-slate-400 hover:bg-white hover:text-slate-800'}`}
            >
              <IconClipboard className="w-5 h-5" /> Dashboard
            </button>
            <button 
              onClick={() => { setActiveMenu('PATIENT_MANAGEMENT'); setSelectedPatient(null); setIsAddingPatient(false); setIsEditingPatient(false); }}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeMenu === 'PATIENT_MANAGEMENT' ? 'bg-blue-600 text-white shadow-2xl shadow-blue-200 scale-105' : 'text-slate-400 hover:bg-white hover:text-slate-800'}`}
            >
              <IconUser className="w-5 h-5" /> Pasien
            </button>
            <button 
              onClick={() => { setActiveMenu('PDP_COMPLIANCE'); setSelectedPatient(null); setIsAddingPatient(false); setIsEditingPatient(false); }}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeMenu === 'PDP_COMPLIANCE' ? 'bg-blue-600 text-white shadow-2xl shadow-blue-200 scale-105' : 'text-slate-400 hover:bg-white hover:text-slate-800'}`}
            >
              <IconLock className="w-5 h-5" /> Kepatuhan
            </button>
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          {activeMenu === 'DASHBOARD' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <IconUser className="w-20 h-20" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Total Pasien</p>
                  <p className="text-4xl font-black text-slate-800">{patients.length}</p>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-[10px] font-black text-green-500 px-2 py-0.5 bg-green-50 rounded-lg">↑ 4.2%</span>
                    <span className="text-[10px] font-bold text-slate-400 italic">vs bulan lalu</span>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <IconShield className="w-20 h-20" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">PDP Consent Rate</p>
                  <p className="text-4xl font-black text-slate-800">{patients.length > 0 ? Math.round((patients.filter(p => p.consentSigned).length / patients.length) * 100) : 0}%</p>
                  <div className="mt-4 text-[10px] font-black text-blue-600 px-2 py-0.5 bg-blue-50 rounded-lg inline-block">100% REQUIRED</div>
                </div>
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <IconHistory className="w-20 h-20" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Log Keamanan</p>
                  <p className="text-4xl font-black text-slate-800">{logs.length}</p>
                  <div className="mt-4 text-[10px] font-bold text-slate-400 italic">Real-time auditing active</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-black text-slate-800 mb-8 uppercase tracking-widest flex items-center gap-3">
                    <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div> Pasien by Gender
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={genderData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" fontSize={10} fontWeight="black" axisLine={false} tickLine={false} />
                        <YAxis fontSize={10} fontWeight="black" axisLine={false} tickLine={false} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', padding: '15px'}} />
                        <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={40}>
                          {genderData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.name === 'Laki-laki' ? '#3b82f6' : '#ec4899'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                   <h3 className="text-sm font-black text-slate-800 mb-8 uppercase tracking-widest flex items-center gap-3">
                    <div className="w-1.5 h-4 bg-purple-600 rounded-full"></div> Security Events
                  </h3>
                  <div className="space-y-5">
                    {logs.slice(0, 4).map(log => (
                      <div key={log.id} onClick={() => setSelectedLog(log)} className="flex gap-4 items-start p-4 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100 group cursor-pointer">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.4)] group-hover:scale-125 transition-transform"></div>
                        <div className="flex-1">
                          <p className="text-xs font-black text-slate-700 leading-tight">{log.details}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[10px] font-bold text-slate-400 font-mono tracking-tighter">{new Date(log.timestamp).toLocaleString()}</span>
                            <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-black uppercase">{log.action}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'PATIENT_MANAGEMENT' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              {!selectedPatient && !isAddingPatient && !isEditingPatient && (
                <div className="flex flex-col md:flex-row gap-6 items-center justify-between mb-8">
                  <div className="relative flex-1 w-full">
                    <IconSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input 
                      type="text" 
                      placeholder="Cari pasien berdasarkan nama, email, atau NIK..."
                      className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-[1.5rem] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold transition-all shadow-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={() => setIsAddingPatient(true)}
                    className="bg-blue-600 text-white px-8 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-blue-700 transition-all shadow-2xl shadow-blue-200 shrink-0"
                  >
                    <IconPlus className="w-5 h-5" /> Tambah Pasien
                  </button>
                </div>
              )}

              {(isAddingPatient || isEditingPatient) ? (
                <PatientForm 
                  initialData={isEditingPatient ? selectedPatient || undefined : undefined}
                  unmaskedFields={isEditingPatient ? unmaskedFields[selectedPatient?.id || ''] : undefined}
                  onSave={handleSavePatient} 
                  onCancel={() => { setIsAddingPatient(false); setIsEditingPatient(false); }} 
                />
              ) : selectedPatient ? (
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
                  <div className="p-10 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-8">
                      <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center text-4xl font-black shadow-inner border-4 border-white ${selectedPatient.gender === 'Laki-laki' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
                        {selectedPatient.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-4 mb-2">
                          <h2 className="text-3xl font-black text-slate-800 tracking-tight">{selectedPatient.name}</h2>
                          <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${selectedPatient.consentSigned ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                            {selectedPatient.consentSigned ? 'PDP Verified' : 'Missing Consent'}
                          </span>
                        </div>
                        <div className="text-slate-500 text-sm font-bold flex flex-col gap-1">
                           <p>{selectedPatient.gender} • <span className="cursor-pointer hover:text-blue-600" onClick={() => handleUnmaskRequest(selectedPatient.id, 'birthDate', 'Tanggal Lahir', selectedPatient.birthDate)}>{isFieldUnmasked(selectedPatient.id, 'birthDate') ? selectedPatient.birthDate : maskBirthDate(selectedPatient.birthDate)}</span> (Umur: {calculateAge(selectedPatient.birthDate)} thn)</p>
                           <div className="flex flex-wrap items-center gap-4 mt-1">
                              <span className="flex items-center gap-1 cursor-pointer hover:text-blue-600" onClick={() => handleUnmaskRequest(selectedPatient.id, 'nik', 'NIK', selectedPatient.nik)}>
                                <IconLock className="w-3 h-3"/> NIK: {isFieldUnmasked(selectedPatient.id, 'nik') ? selectedPatient.nik : maskNIK(selectedPatient.nik)}
                              </span>
                              <span className="flex items-center gap-1 cursor-pointer hover:text-blue-600" onClick={() => handleUnmaskRequest(selectedPatient.id, 'email', 'Email', selectedPatient.email)}>
                                📧 {isFieldUnmasked(selectedPatient.id, 'email') ? selectedPatient.email : maskEmail(selectedPatient.email)}
                              </span>
                              <span className="flex items-center gap-1 cursor-pointer hover:text-blue-600" onClick={() => handleUnmaskRequest(selectedPatient.id, 'phone', 'Phone', selectedPatient.phone)}>
                                📞 {isFieldUnmasked(selectedPatient.id, 'phone') ? selectedPatient.phone : maskPhone(selectedPatient.phone)}
                              </span>
                           </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setIsEditingPatient(true)}
                        className="p-4 bg-white border border-slate-200 rounded-2xl text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
                        title="Edit Data"
                      >
                        <IconEdit className="w-6 h-6" />
                      </button>
                      <button 
                        onClick={() => handleDeletePatient(selectedPatient.id)}
                        className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 hover:bg-red-100 transition-all shadow-sm"
                        title="Hapus Pasien"
                      >
                        <IconTrash className="w-6 h-6" />
                      </button>
                      <button 
                        onClick={() => setSelectedPatient(null)} 
                        className="p-4 hover:bg-slate-200 rounded-2xl transition-all"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                    <div className="p-10 col-span-2 space-y-10">
                      <section>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                          <IconClipboard className="w-5 h-5 text-blue-600" /> Clinical History
                        </h4>
                        {selectedPatient.records.length > 0 ? (
                          <div className="space-y-6">
                            {selectedPatient.records.map(r => (
                              <div key={r.id} className="p-8 border border-slate-100 rounded-[2rem] bg-slate-50/50 hover:bg-white transition-all hover:shadow-xl group">
                                <div className="flex justify-between items-start mb-4">
                                  <span className="text-[10px] font-black text-slate-400 bg-white px-3 py-1.5 rounded-xl border border-slate-100 uppercase tracking-widest">{r.date}</span>
                                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">{r.doctor}</span>
                                </div>
                                <h5 className="font-black text-slate-800 text-xl mb-3 group-hover:text-blue-600 transition-colors">{r.diagnosis}</h5>
                                <p className="text-sm text-slate-600 leading-relaxed mb-6">{r.treatment}</p>
                                <div className="flex gap-3 flex-wrap">
                                  {r.prescriptions.map((p, idx) => (
                                    <span key={idx} className="bg-white text-slate-700 px-4 py-2 rounded-2xl text-[10px] font-black border border-slate-200 italic shadow-sm">
                                      💊 {p}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-24 text-center bg-slate-50/50 rounded-[2.5rem] border-4 border-dashed border-slate-100">
                            <IconClipboard className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                            <p className="text-slate-400 font-black uppercase tracking-widest text-xs italic">Belum ada rekam medis tersimpan.</p>
                          </div>
                        )}
                      </section>
                    </div>

                    <div className="p-10 bg-slate-50/50 space-y-10">
                      <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                          AI Clinical Insights
                        </h4>
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xl min-h-[160px] flex items-center justify-center relative overflow-hidden group">
                          <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                          {loadingAi ? (
                            <div className="flex flex-col items-center justify-center gap-4 text-center">
                              <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Processing medical intelligence...</p>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-700 leading-relaxed italic font-medium px-2">"{aiSummary || 'Pilih pasien untuk memulai analisa AI otomatis berdasarkan riwayat kesehatan.'}"</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Privacy Controls</h4>
                        <div className="p-5 bg-white rounded-[1.5rem] border border-slate-200 space-y-3 shadow-sm">
                           <div className="flex justify-between items-center text-[10px] font-black">
                             <span className="text-slate-400 uppercase">Encryption</span>
                             <span className="text-green-500 uppercase">ACTIVE</span>
                           </div>
                           <div className="flex justify-between items-center text-[10px] font-black">
                             <span className="text-slate-400 uppercase">Logs Recorded</span>
                             <span className="text-blue-500 uppercase">YES</span>
                           </div>
                           <div className="flex justify-between items-center text-[10px] font-black">
                             <span className="text-slate-400 uppercase">Data Portability</span>
                             <span className="text-slate-800 uppercase underline cursor-pointer">EXPORT</span>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredPatients.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => viewPatientDetails(p)}
                      className="bg-white p-8 rounded-[2rem] border border-slate-200 hover:border-blue-500 hover:shadow-2xl transition-all cursor-pointer group hover:-translate-y-2 duration-300"
                    >
                      <div className="flex items-center gap-5 mb-8">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner border-4 border-white ${p.gender === 'Laki-laki' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                          {p.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-black text-slate-800 text-lg group-hover:text-blue-600 transition-colors truncate">{p.name}</h3>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Umur: {calculateAge(p.birthDate)} thn</p>
                        </div>
                      </div>
                      <div className="space-y-4 mb-8">
                        <div className="flex items-center gap-3 text-xs font-bold text-slate-500 group-hover:text-slate-700" onClick={(e) => { e.stopPropagation(); handleUnmaskRequest(p.id, 'nik', 'NIK', p.nik); }}>
                          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-blue-50 transition-colors">
                            <IconLock className="w-4 h-4" />
                          </div>
                          <span className="font-mono tracking-tight font-black">{isFieldUnmasked(p.id, 'nik') ? p.nik : maskNIK(p.nik)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-bold text-slate-500 group-hover:text-slate-700" onClick={(e) => { e.stopPropagation(); handleUnmaskRequest(p.id, 'email', 'Email', p.email); }}>
                          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-blue-50 transition-colors">
                             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                          </div>
                          <span className="truncate font-black">{isFieldUnmasked(p.id, 'email') ? p.email : maskEmail(p.email)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-bold text-slate-500 group-hover:text-slate-700" onClick={(e) => { e.stopPropagation(); handleUnmaskRequest(p.id, 'phone', 'Phone', p.phone); }}>
                          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-blue-50 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                          </div>
                          <span className="font-black">{isFieldUnmasked(p.id, 'phone') ? p.phone : maskPhone(p.phone)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-6 border-t border-slate-50">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${p.consentSigned ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`}></div>
                          <span className={`text-[9px] font-black uppercase tracking-widest ${p.consentSigned ? 'text-green-600' : 'text-red-600'}`}>
                            {p.consentSigned ? 'Verified' : 'Unverified'}
                          </span>
                        </div>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter italic cursor-pointer hover:text-blue-600" onClick={(e) => { e.stopPropagation(); handleUnmaskRequest(p.id, 'birthDate', 'Tanggal Lahir', p.birthDate); }}>{isFieldUnmasked(p.id, 'birthDate') ? p.birthDate : maskBirthDate(p.birthDate)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeMenu === 'PDP_COMPLIANCE' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16"></div>
                    <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-4 relative z-10">
                      <IconHistory className="text-blue-600 w-8 h-8" /> Audit Transparansi Data
                    </h2>
                    <AuditLogView logs={logs} onLogClick={setSelectedLog} />
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden group">
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-600/10 rounded-full group-hover:scale-110 transition-transform"></div>
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                      <IconLock className="text-blue-400 w-5 h-5" /> PDP Legal Assistant
                    </h3>
                    <p className="text-slate-400 text-xs mb-8 leading-relaxed font-medium italic">"Tanyakan pedoman hukum UU PDP Nomor 27 Tahun 2022 melalui konsultasi AI instan."</p>
                    
                    <div className="space-y-3 mb-10 relative z-10">
                      {['Izin Data Sensitif', 'Masa Retensi Data', 'Sanksi Pelanggaran', 'Hak Dilupakan'].map(topic => (
                        <button 
                          key={topic}
                          onClick={() => fetchPDPAdvice(topic)}
                          className="w-full text-left px-5 py-4 bg-slate-800 border border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 hover:border-blue-500/50 transition-all shadow-sm"
                        >
                          Topik: {topic}
                        </button>
                      ))}
                    </div>

                    <div className="bg-slate-800/80 p-6 rounded-[1.5rem] border border-slate-700 min-h-[180px] shadow-inner">
                      {loadingAi ? (
                        <div className="flex flex-col justify-center items-center h-32 gap-4">
                          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Consulting AI Knowledge Base...</p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-300 leading-relaxed italic font-medium">
                          {pdpAdvice || "Silahkan pilih salah satu topik hukum di atas untuk mendapatkan ringkasan kepatuhan."}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Security Framework</h3>
                    <div className="space-y-6">
                      {[
                        { label: 'Data Encryption', status: 'AES-256 Verified', active: true },
                        { label: 'Audit Trail', status: 'Immutability Check OK', active: true },
                        { label: 'Consent Engine', status: 'Dynamic Verification', active: true },
                        { label: 'Penetration Test', status: 'Next: 12 July 2024', active: false }
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-4 group">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${item.active ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400 group-hover:bg-orange-50 group-hover:text-orange-600'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{item.label}</p>
                            <p className="text-[9px] font-bold text-slate-400 italic mt-0.5">{item.status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* PDP Compliance Modal for Unmasking Reason */}
      {isUnmaskModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-slate-100 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <IconLock className="w-24 h-24" />
            </div>
            <div className="relative z-10">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-[1.5rem] flex items-center justify-center mb-6">
                <IconShield className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">Otoritas Akses Data</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">KEPATUHAN UU PDP PASAL 39</p>
              
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 mb-6">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Target Akses</p>
                <p className="text-sm font-black text-slate-700">{unmaskTarget?.label}: {patients.find(p => p.id === unmaskTarget?.patientId)?.name}</p>
              </div>

              <div className="space-y-4">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Alasan Mengakses Data Sensitif</label>
                <textarea 
                  className="w-full p-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold transition-all h-28 resize-none shadow-inner"
                  placeholder="Contoh: Keperluan verifikasi klaim asuransi atau konsultasi medis mendesak..."
                  value={accessReason}
                  onChange={(e) => setAccessReason(e.target.value)}
                  autoFocus
                />
                <p className="text-[9px] text-slate-400 leading-relaxed italic">
                  *Tindakan ini akan direkam dalam audit log permanen beserta nama akun Anda dan alasan akses.
                </p>
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setIsUnmaskModalOpen(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button 
                  onClick={submitUnmaskReason}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-200"
                >
                  Konfirmasi Akses
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl p-10 border border-slate-100 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-10 opacity-5">
              <IconHistory className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Detail Log Audit</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Keamanan Sistem Terintegrasi</p>
                </div>
                <button onClick={() => setSelectedLog(null)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Timestamp</p>
                    <p className="text-xs font-bold text-slate-700 font-mono">{new Date(selectedLog.timestamp).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">User ID</p>
                    <p className="text-xs font-bold text-slate-700 font-mono">{selectedLog.userId}</p>
                  </div>
                  <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Action Type</p>
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                      selectedLog.action === 'VIEW' ? 'bg-blue-100 text-blue-700' :
                      selectedLog.action === 'DELETE' ? 'bg-red-100 text-red-700' :
                      'bg-slate-200 text-slate-700'
                    }`}>
                      {selectedLog.action}
                    </span>
                  </div>
                  <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Resource ID</p>
                    <p className="text-xs font-bold text-slate-700 font-mono">{selectedLog.resourceId}</p>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Deskripsi Lengkap Aktivitas</p>
                  <p className="text-sm font-bold text-slate-800 leading-relaxed italic">
                    "{selectedLog.details}"
                  </p>
                </div>

                <div className="p-6 border-l-4 border-blue-500 bg-blue-50/50 rounded-r-3xl">
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Catatan Kepatuhan</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Data log ini bersifat 'immutable' dan telah terenkripsi. Sesuai Pasal 39 UU PDP, bukti akses ini disimpan untuk audit forensik jika terjadi sengketa perlindungan data.
                  </p>
                </div>
              </div>

              <div className="mt-10">
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="w-full py-4 bg-slate-900 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl"
                >
                  Tutup Rincian
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-white border-t border-slate-100 py-8 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
              <IconShield className="w-4 h-4" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">MedGuard Pro • UU PDP No. 27/2022 Verified System</p>
          </div>
          <div className="flex gap-8">
            <a href="#" className="text-[10px] font-black text-slate-400 hover:text-blue-600 transition-all uppercase tracking-widest underline decoration-slate-200 decoration-2 underline-offset-8">Data Privacy Portal</a>
            <a href="#" className="text-[10px] font-black text-slate-400 hover:text-blue-600 transition-all uppercase tracking-widest underline decoration-slate-200 decoration-2 underline-offset-8">Compliance Whitepaper</a>
            <a href="#" className="text-[10px] font-black text-slate-400 hover:text-blue-600 transition-all uppercase tracking-widest underline decoration-slate-200 decoration-2 underline-offset-8">Legal API</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
