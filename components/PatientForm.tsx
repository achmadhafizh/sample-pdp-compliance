
import React, { useState, useEffect } from 'react';
import { Patient, Gender } from '../types';
import { IconShield, IconLock } from './Icons';
import { maskNIK, maskPhone, maskEmail, maskBirthDate } from '../App';

interface Props {
  initialData?: Patient;
  unmaskedFields?: Set<string>; 
  onSave: (patient: Partial<Patient>) => void;
  onCancel: () => void;
}

const PatientForm: React.FC<Props> = ({ initialData, unmaskedFields, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<Patient>>({
    name: '',
    email: '',
    phone: '',
    birthDate: '',
    gender: Gender.Male,
    address: '',
    bloodType: 'O',
    nik: '',
    consentSigned: false,
    allergies: []
  });

  useEffect(() => {
    if (initialData) {
      const maskedData = { ...initialData };
      if (!unmaskedFields?.has('nik')) maskedData.nik = maskNIK(initialData.nik);
      if (!unmaskedFields?.has('email')) maskedData.email = maskEmail(initialData.email);
      if (!unmaskedFields?.has('phone')) maskedData.phone = maskPhone(initialData.phone);
      if (!unmaskedFields?.has('birthDate')) maskedData.birthDate = maskBirthDate(initialData.birthDate);
      setFormData(maskedData);
    }
  }, [initialData, unmaskedFields]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.consentSigned) {
      alert("Persetujuan PDP harus ditandatangani!");
      return;
    }
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 lg:p-10 rounded-[2rem] lg:rounded-[3rem] shadow-2xl border border-slate-200 max-w-4xl mx-auto animate-in fade-in zoom-in duration-500">
      <div className="flex items-center justify-between mb-8 lg:mb-10">
        <h3 className="text-lg lg:text-2xl font-black text-slate-800 flex items-center gap-3 lg:gap-4">
          <IconShield className="text-blue-600 w-8 h-8 lg:w-10 lg:h-10" /> 
          <span className="truncate">{initialData ? 'Edit Pasien' : 'Baru'}</span>
        </h3>
        <div className="px-3 py-1 lg:px-6 lg:py-2 bg-blue-50 text-blue-700 rounded-xl lg:rounded-2xl text-[8px] lg:text-[10px] font-black uppercase tracking-widest border border-blue-100">
          SECURE
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8 mb-6 lg:mb-10">
        <div className="space-y-1 lg:space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
          <input 
            type="text" 
            required 
            placeholder="Contoh: Achmad Hafizh"
            className="w-full px-4 lg:px-6 py-3 lg:py-4 border border-slate-200 rounded-xl lg:rounded-[1.5rem] focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm font-bold shadow-sm"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
          />
        </div>
        <div className="space-y-1 lg:space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NIK (Masked)</label>
          <input 
            type="text" 
            required
            className="w-full px-4 lg:px-6 py-3 lg:py-4 border border-slate-200 rounded-xl lg:rounded-[1.5rem] focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none font-mono font-bold text-sm shadow-sm"
            value={formData.nik}
            onChange={e => setFormData({...formData, nik: e.target.value})}
          />
        </div>
        <div className="space-y-1 lg:space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal Lahir</label>
          <input 
            type="text" 
            required
            placeholder="DD-MM-YYYY"
            className="w-full px-4 lg:px-6 py-3 lg:py-4 border border-slate-200 rounded-xl lg:rounded-[1.5rem] focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none font-bold text-sm shadow-sm"
            value={formData.birthDate}
            onChange={e => setFormData({...formData, birthDate: e.target.value})}
          />
        </div>
        <div className="space-y-1 lg:space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jenis Kelamin</label>
          <select 
            className="w-full px-4 lg:px-6 py-3 lg:py-4 border border-slate-200 rounded-xl lg:rounded-[1.5rem] focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none font-bold text-sm shadow-sm"
            value={formData.gender}
            onChange={e => setFormData({...formData, gender: e.target.value as Gender})}
          >
            <option value={Gender.Male}>Laki-laki</option>
            <option value={Gender.Female}>Perempuan</option>
          </select>
        </div>
        <div className="space-y-1 lg:space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nomor Telepon</label>
          <input 
            type="text" 
            required
            className="w-full px-4 lg:px-6 py-3 lg:py-4 border border-slate-200 rounded-xl lg:rounded-[1.5rem] focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none font-bold text-sm shadow-sm"
            value={formData.phone}
            onChange={e => setFormData({...formData, phone: e.target.value})}
          />
        </div>
        <div className="space-y-1 lg:space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
          <input 
            type="text" 
            required
            className="w-full px-4 lg:px-6 py-3 lg:py-4 border border-slate-200 rounded-xl lg:rounded-[1.5rem] focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none font-bold text-sm shadow-sm"
            value={formData.email}
            onChange={e => setFormData({...formData, email: e.target.value})}
          />
        </div>
      </div>

      <div className="p-4 lg:p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl lg:rounded-[2.5rem] mb-8 lg:mb-10">
        <label className="flex items-center gap-4 cursor-pointer group p-3 bg-white rounded-xl lg:rounded-2xl transition-all border border-slate-200 hover:border-blue-400 shadow-sm">
          <input 
            type="checkbox" 
            className="w-6 h-6 lg:w-7 lg:h-7 rounded-lg lg:rounded-xl text-blue-600 focus:ring-blue-500 cursor-pointer"
            checked={formData.consentSigned}
            onChange={e => setFormData({...formData, consentSigned: e.target.checked})}
          />
          <span className="text-[11px] lg:text-sm font-black text-slate-700 group-hover:text-blue-600 transition-colors">
            Pasien Menyetujui Persetujuan PDP
          </span>
        </label>
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 lg:gap-5">
        <button type="button" onClick={onCancel} className="w-full sm:w-auto px-6 lg:px-10 py-3 lg:py-4 border border-slate-200 rounded-xl lg:rounded-[1.5rem] text-slate-500 font-black text-[10px] lg:text-xs uppercase tracking-widest">
          Batal
        </button>
        <button type="submit" className="w-full sm:w-auto px-6 lg:px-12 py-3 lg:py-4 bg-blue-600 text-white rounded-xl lg:rounded-[1.5rem] font-black text-[10px] lg:text-xs uppercase tracking-widest shadow-lg">
          Simpan
        </button>
      </div>
    </form>
  );
};

export default PatientForm;
