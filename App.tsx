
import React, { useState, useMemo } from 'react';
import { Patient, AuditLog } from './types';
import { INITIAL_PATIENTS, INITIAL_LOGS } from './constants';
import { IconShield, IconUser, IconPlus, IconSearch, IconLock, IconClipboard, IconHistory, IconEdit, IconTrash } from './components/Icons';
import PatientForm from './components/PatientForm';
import AuditLogView from './components/AuditLogView';
import { geminiService } from './services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type ActiveMenu = 'DASHBOARD' | 'PATIENT_MANAGEMENT' | 'PDP_COMPLIANCE';

// Masking Utilities
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
    if (confirm(`PERINGATAN UU PDP: Hapus permanen seluruh data ${p?.name}?`)) {
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

  const NavItem = ({ id, icon: Icon, label }: { id: ActiveMenu, icon: any, label: string }) => {
    const active = activeMenu === id;
    return (
      <button 
        onClick={() => { setActiveMenu(id); setSelectedPatient(null); setIsAddingPatient(false); setIsEditingPatient(false); }}
        className={`flex flex-col lg:flex-row items-center gap-1 lg:gap-4 px-3 lg:px-5 py-2 lg:py-4 rounded-xl lg:rounded-2xl font-black text-[10px] lg:text-xs uppercase tracking-widest transition-all flex-1 lg:flex-none ${active ? 'bg-blue-600 text-white shadow-lg lg:shadow-2xl lg:shadow-blue-200 lg:scale-105' : 'text-slate-400 hover:bg-white hover:text-slate-800'}`}
      >
        <Icon className={`w-5 h-5 lg:w-5 lg:h-5 ${active ? 'text-white' : 'text-slate-400'}`} />
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Inter'] pb-20 lg:pb-0">
      {/* Header - Adaptive */}
      <header className="bg-white border-b border-slate-200 h-14 lg:h-16 flex items-center px-4 lg:px-6 sticky top-0 z-50">
        <div className="flex items-center gap-2 lg:gap-3">
          <div className="w-8 h-8 lg:w-10 lg:h-10 bg-blue-600 rounded-lg lg:rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
            <IconShield className="w-5 h-5 lg:w-6 lg:h-6" />
          </div>
          <div className="hidden xs:block">
            <h1 className="text-sm lg:text-lg font-black text-slate-800 tracking-tight leading-none">MedGuard</h1>
            <p className="text-[8px] lg:text-[10px] text-slate-500 font-black uppercase tracking-tighter">Health Governance</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 lg:gap-4">
          <div className="hidden sm:flex px-3 py-1 bg-blue-50 text-blue-700 text-[9px] font-black rounded-full border border-blue-100 items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
            ENCRYPTED
          </div>
          <div className="h-6 lg:h-8 w-px bg-slate-200"></div>
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="text-right hidden lg:block">
              <p className="text-xs font-black text-slate-700">{currentUser.name}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase">{currentUser.role}</p>
            </div>
            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg lg:rounded-2xl bg-slate-100 border lg:border-2 border-slate-200 flex items-center justify-center text-slate-400 shadow-sm">
              <IconUser className="w-4 h-4 lg:w-5 lg:h-5" />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full px-4 lg:px-6 py-4 lg:py-8 gap-4 lg:gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 flex-col gap-3 shrink-0">
          <nav className="space-y-1">
            <NavItem id="DASHBOARD" icon={IconClipboard} label="Dashboard" />
            <NavItem id="PATIENT_MANAGEMENT" icon={IconUser} label="Pasien" />
            <NavItem id="PDP_COMPLIANCE" icon={IconLock} label="Kepatuhan" />
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 mobile-safe-area">
          {activeMenu === 'DASHBOARD' && (
            <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                <div className="bg-white p-6 lg:p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <IconUser className="w-16 h-16 lg:w-20 lg:h-20" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Total Pasien</p>
                  <p className="text-3xl lg:text-4xl font-black text-slate-800">{patients.length}</p>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-[10px] font-black text-green-500 px-2 py-0.5 bg-green-50 rounded-lg">↑ 4.2%</span>
                  </div>
                </div>
                <div className="bg-white p-6 lg:p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <IconShield className="w-16 h-16 lg:w-20 lg:h-20" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">PDP Consent Rate</p>
                  <p className="text-3xl lg:text-4xl font-black text-slate-800">{patients.length > 0 ? Math.round((patients.filter(p => p.consentSigned).length / patients.length) * 100) : 0}%</p>
                </div>
                <div className="bg-white p-6 lg:p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group sm:col-span-2 lg:col-span-1">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <IconHistory className="w-16 h-16 lg:w-20 lg:h-20" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Log Keamanan</p>
                  <p className="text-3xl lg:text-4xl font-black text-slate-800">{logs.length}</p>
                </div>
              </div>

              {/* Chart & Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                <div className="bg-white p-6 lg:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-black text-slate-800 mb-6 lg:mb-8 uppercase tracking-widest flex items-center gap-3">
                    <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div> Pasien by Gender
                  </h3>
                  <div className="h-60 lg:h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={genderData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" fontSize={10} fontWeight="black" axisLine={false} tickLine={false} />
                        <YAxis fontSize={10} fontWeight="black" axisLine={false} tickLine={false} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', padding: '12px'}} />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={32}>
                          {genderData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.name === 'Laki-laki' ? '#3b82f6' : '#ec4899'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white p-6 lg:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                   <h3 className="text-sm font-black text-slate-800 mb-6 lg:mb-8 uppercase tracking-widest flex items-center gap-3">
                    <div className="w-1.5 h-4 bg-purple-600 rounded-full"></div> Security Events
                  </h3>
                  <div className="space-y-4 lg:space-y-5">
                    {logs.slice(0, 4).map(log => (
                      <div key={log.id} onClick={() => setSelectedLog(log)} className="flex gap-3 lg:gap-4 items-start p-3 lg:p-4 hover:bg-slate-50 rounded-xl transition-all border border-transparent hover:border-slate-100 group cursor-pointer">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.4)]"></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] lg:text-xs font-black text-slate-700 leading-tight truncate">{log.details}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[9px] font-bold text-slate-400 font-mono tracking-tighter">{new Date(log.timestamp).toLocaleTimeString()}</span>
                            <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-black uppercase">{log.action}</span>
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
            <div className="space-y-4 lg:space-y-6 animate-in fade-in duration-500">
              {!selectedPatient && !isAddingPatient && !isEditingPatient && (
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between mb-4 lg:mb-8">
                  <div className="relative flex-1 w-full">
                    <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                      type="text" 
                      placeholder="Cari pasien..."
                      className="w-full pl-12 pr-4 py-3 lg:py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold transition-all shadow-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={() => setIsAddingPatient(true)}
                    className="w-full lg:w-auto bg-blue-600 text-white px-6 lg:px-8 py-3 lg:py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-lg"
                  >
                    <IconPlus className="w-4 h-4 lg:w-5 lg:h-5" /> <span>Pasien Baru</span>
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
                <div className="bg-white rounded-[2rem] lg:rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                  <div className="p-6 lg:p-10 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-4 lg:gap-8">
                      <div className={`w-16 h-16 lg:w-24 lg:h-24 rounded-2xl lg:rounded-[2rem] flex items-center justify-center text-2xl lg:text-4xl font-black shadow-inner border-4 border-white shrink-0 ${selectedPatient.gender === 'Laki-laki' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
                        {selectedPatient.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 lg:gap-4 mb-2">
                          <h2 className="text-xl lg:text-3xl font-black text-slate-800 tracking-tight truncate">{selectedPatient.name}</h2>
                        </div>
                        <div className="text-slate-500 text-[10px] lg:text-sm font-bold flex flex-col gap-1">
                           <p>{selectedPatient.gender} • <span className="cursor-pointer hover:text-blue-600" onClick={() => handleUnmaskRequest(selectedPatient.id, 'birthDate', 'Tanggal Lahir', selectedPatient.birthDate)}>{isFieldUnmasked(selectedPatient.id, 'birthDate') ? selectedPatient.birthDate : maskBirthDate(selectedPatient.birthDate)}</span> (Umur: {calculateAge(selectedPatient.birthDate)} thn)</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                      <button onClick={() => setIsEditingPatient(true)} className="flex-1 md:flex-none p-3 lg:p-4 bg-white border border-slate-200 rounded-xl lg:rounded-2xl text-blue-600 hover:bg-blue-50 transition-all shadow-sm flex items-center justify-center">
                        <IconEdit className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleDeletePatient(selectedPatient.id)} className="flex-1 md:flex-none p-3 lg:p-4 bg-red-50 border border-red-100 rounded-xl lg:rounded-2xl text-red-600 hover:bg-red-100 transition-all shadow-sm flex items-center justify-center">
                        <IconTrash className="w-5 h-5" />
                      </button>
                      <button onClick={() => setSelectedPatient(null)} className="flex-1 md:flex-none p-3 lg:p-4 hover:bg-slate-200 bg-white border border-slate-200 rounded-xl lg:rounded-2xl transition-all flex items-center justify-center">
                         <span className="text-slate-400 font-black">X</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                    <div className="p-6 lg:p-10 col-span-2 space-y-6 lg:space-y-10">
                       {/* Sensitive Data Grid */}
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-white transition-all" onClick={() => handleUnmaskRequest(selectedPatient.id, 'nik', 'NIK', selectedPatient.nik)}>
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">NIK</p>
                            <p className="text-xs font-bold font-mono">{isFieldUnmasked(selectedPatient.id, 'nik') ? selectedPatient.nik : maskNIK(selectedPatient.nik)}</p>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-white transition-all" onClick={() => handleUnmaskRequest(selectedPatient.id, 'email', 'Email', selectedPatient.email)}>
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Email</p>
                            <p className="text-xs font-bold">{isFieldUnmasked(selectedPatient.id, 'email') ? selectedPatient.email : maskEmail(selectedPatient.email)}</p>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-white transition-all" onClick={() => handleUnmaskRequest(selectedPatient.id, 'phone', 'Phone', selectedPatient.phone)}>
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Phone</p>
                            <p className="text-xs font-bold">{isFieldUnmasked(selectedPatient.id, 'phone') ? selectedPatient.phone : maskPhone(selectedPatient.phone)}</p>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-8">
                  {filteredPatients.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => viewPatientDetails(p)}
                      className="bg-white p-5 lg:p-8 rounded-[1.5rem] lg:rounded-[2rem] border border-slate-200 hover:border-blue-500 hover:shadow-xl transition-all cursor-pointer group group"
                    >
                      <div className="flex items-center gap-4 lg:gap-5 mb-6 lg:mb-8">
                        <div className={`w-12 h-12 lg:w-16 lg:h-16 rounded-xl lg:rounded-2xl flex items-center justify-center text-xl lg:text-2xl font-black shadow-inner border-2 lg:border-4 border-white ${p.gender === 'Laki-laki' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                          {p.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-black text-slate-800 text-sm lg:text-lg group-hover:text-blue-600 transition-colors truncate">{p.name}</h3>
                          <p className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Umur: {calculateAge(p.birthDate)} thn</p>
                        </div>
                      </div>
                      <div className="space-y-3 lg:space-y-4 mb-6 lg:mb-8">
                        <div className="flex items-center gap-3 text-[11px] lg:text-xs font-bold text-slate-500">
                          <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-blue-50 transition-colors">
                            <IconLock className="w-3 h-3 lg:w-4 lg:h-4" />
                          </div>
                          <span className="font-mono tracking-tight font-black">{isFieldUnmasked(p.id, 'nik') ? p.nik : maskNIK(p.nik)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] lg:text-xs font-bold text-slate-500">
                          <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-blue-50 transition-colors">
                             <span className="pi pi-envelope text-[10px] lg:text-xs"></span>
                          </div>
                          <span className="truncate font-black">{isFieldUnmasked(p.id, 'email') ? p.email : maskEmail(p.email)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-4 lg:pt-6 border-t border-slate-50">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${p.consentSigned ? 'bg-green-500 shadow-sm animate-pulse' : 'bg-red-500'}`}></div>
                          <span className={`text-[8px] lg:text-[9px] font-black uppercase tracking-widest ${p.consentSigned ? 'text-green-600' : 'text-red-600'}`}>
                            {p.consentSigned ? 'Verified' : 'Unverified'}
                          </span>
                        </div>
                        <span className="text-[9px] lg:text-[10px] font-black text-slate-300 uppercase italic">{isFieldUnmasked(p.id, 'birthDate') ? p.birthDate : maskBirthDate(p.birthDate)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeMenu === 'PDP_COMPLIANCE' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                <div className="lg:col-span-2">
                   <AuditLogView logs={logs} onLogClick={setSelectedLog} />
                </div>
                <div className="space-y-6">
                  <div className="bg-slate-900 text-white p-6 lg:p-8 rounded-[2rem] border border-slate-800 shadow-xl overflow-hidden group">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                      <IconLock className="text-blue-400 w-4 h-4" /> Legal Assistant
                    </h3>
                    <div className="space-y-2 mb-8 relative z-10">
                      {['Izin Data', 'Masa Retensi', 'Sanksi', 'Hak Hapus'].map(topic => (
                        <button key={topic} onClick={() => fetchPDPAdvice(topic)} className="w-full text-left px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all">
                          {topic}
                        </button>
                      ))}
                    </div>
                    <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 min-h-[120px]">
                      <p className="text-[11px] text-slate-300 leading-relaxed italic">
                        {pdpAdvice || "Pilih topik hukum untuk ringkasan kepatuhan."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 flex items-center px-2 z-[60] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <NavItem id="DASHBOARD" icon={IconClipboard} label="Dashboard" />
        <NavItem id="PATIENT_MANAGEMENT" icon={IconUser} label="Pasien" />
        <NavItem id="PDP_COMPLIANCE" icon={IconLock} label="Kepatuhan" />
      </nav>

      {/* Unmasking Modal - Responsive */}
      {isUnmaskModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center p-0 lg:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-t-[2rem] lg:rounded-[2.5rem] shadow-2xl p-6 lg:p-8 border-t lg:border border-slate-100 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <IconLock className="w-20 h-20" />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-blue-50 text-blue-600 rounded-xl lg:rounded-[1.5rem] flex items-center justify-center mb-4 lg:mb-6">
                <IconShield className="w-6 h-6 lg:w-8 lg:h-8" />
              </div>
              <h2 className="text-lg lg:text-xl font-black text-slate-800 mb-1 uppercase tracking-tight">Otoritas Akses</h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-6 italic">KEPATUHAN UU PDP PASAL 39</p>
              
              <div className="p-3 lg:p-4 bg-slate-50 rounded-xl border border-slate-200 mb-6">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Target Akses</p>
                <p className="text-xs lg:text-sm font-black text-slate-700 truncate">{unmaskTarget?.label}: {patients.find(p => p.id === unmaskTarget?.patientId)?.name}</p>
              </div>

              <div className="space-y-3 lg:space-y-4">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Alasan Akses</label>
                <textarea 
                  className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold transition-all h-24 resize-none shadow-inner"
                  placeholder="Contoh: Verifikasi klaim atau konsultasi mendesak..."
                  value={accessReason}
                  onChange={(e) => setAccessReason(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex gap-3 mt-8">
                <button onClick={() => setIsUnmaskModalOpen(false)} className="flex-1 py-3 lg:py-4 bg-slate-100 text-slate-500 rounded-xl lg:rounded-2xl font-black text-[10px] uppercase tracking-widest">
                  Batal
                </button>
                <button onClick={submitUnmaskReason} className="flex-1 py-3 lg:py-4 bg-blue-600 text-white rounded-xl lg:rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">
                  Konfirmasi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Detail Modal - Responsive */}
      {selectedLog && (
        <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center p-0 lg:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-t-[2rem] lg:rounded-[2.5rem] shadow-2xl p-6 lg:p-10 border-t lg:border border-slate-100 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-10 opacity-5">
              <IconHistory className="w-24 h-24 lg:w-32 lg:h-32" />
            </div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6 lg:mb-8">
                <div>
                  <h2 className="text-xl lg:text-2xl font-black text-slate-800 uppercase tracking-tight">Detail Log Audit</h2>
                  <p className="text-[9px] lg:text-xs font-bold text-slate-400 uppercase tracking-widest">Keamanan Sistem</p>
                </div>
                <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <span className="pi pi-times font-black text-slate-400"></span>
                </button>
              </div>

              <div className="space-y-4 lg:space-y-6">
                <div className="grid grid-cols-2 gap-3 lg:gap-6">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[8px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Timestamp</p>
                    <p className="text-[10px] lg:text-xs font-bold text-slate-700 font-mono">{new Date(selectedLog.timestamp).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[8px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Action</p>
                    <span className="text-[10px] font-black text-blue-700 uppercase">{selectedLog.action}</span>
                  </div>
                </div>

                <div className="p-4 lg:p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[8px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Aktivitas</p>
                  <p className="text-xs lg:text-sm font-bold text-slate-800 leading-relaxed italic">
                    "{selectedLog.details}"
                  </p>
                </div>

                <div className="p-4 lg:p-6 border-l-4 border-blue-500 bg-blue-50/30 rounded-r-2xl">
                  <p className="text-[10px] text-slate-600 leading-relaxed font-medium">
                    Data ini bersifat permanen dan tervalidasi sebagai bukti hukum sesuai UU PDP.
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <button onClick={() => setSelectedLog(null)} className="w-full py-3 lg:py-4 bg-slate-900 text-white rounded-xl lg:rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest shadow-lg">
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Footer */}
      <footer className="hidden lg:block bg-white border-t border-slate-100 py-8 px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <IconShield className="w-5 h-5 text-slate-400" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">MedGuard Pro • Verified 2024</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
