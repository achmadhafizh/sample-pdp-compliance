
import React, { useState, useEffect } from 'react';
import { Patient, Gender } from '../types';
import { IconShield, IconLock } from './Icons';
import { maskNIK, maskPhone, maskEmail, maskBirthDate } from '../App';

interface Props {
  initialData?: Patient;
  unmaskedFields?: Set<string>; // Pass from App to know which fields shouldn't be masked in form
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
      // Create a masked version for the form state
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
      alert("Persetujuan PDP harus ditandatangani pasien sesuai UU No. 27/2022.");
      return;
    }
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-200 max-w-4xl mx-auto animate-in fade-in zoom-in duration-500">
      <div className="flex items-center justify-between mb-10">
        <h3 className="text-2xl font-black text-slate-800 flex items-center gap-4">
          <IconShield className="text-blue-600 w-10 h-10" /> 
          {initialData ? 'Update Data Pasien' : 'Registrasi Pasien Baru'}
        </h3>
        <div className="px-6 py-2 bg-blue-50 text-blue-700 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-blue-100">
          SECURE INPUT MODE
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap Pasien</label>
          <input 
            type="text" 
            required 
            placeholder="Contoh: Achmad Hafizh"
            className="w-full px-6 py-4 border border-slate-200 rounded-[1.5rem] focus:ring-8 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 shadow-sm"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">NIK (Masked)</label>
          <input 
            type="text" 
            required
            placeholder="Input 16 digit NIK" 
            className="w-full px-6 py-4 border border-slate-200 rounded-[1.5rem] focus:ring-8 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-mono font-bold text-slate-700 shadow-sm"
            value={formData.nik}
            onChange={e => setFormData({...formData, nik: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal Lahir (Masked)</label>
          <input 
            type="text" 
            required
            placeholder="DD-MM-YYYY"
            className="w-full px-6 py-4 border border-slate-200 rounded-[1.5rem] focus:ring-8 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 shadow-sm"
            value={formData.birthDate}
            onChange={e => setFormData({...formData, birthDate: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Jenis Kelamin</label>
          <select 
            className="w-full px-6 py-4 border border-slate-200 rounded-[1.5rem] focus:ring-8 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 shadow-sm"
            value={formData.gender}
            onChange={e => setFormData({...formData, gender: e.target.value as Gender})}
          >
            <option value={Gender.Male}>Laki-laki</option>
            <option value={Gender.Female}>Perempuan</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nomor Telepon (Masked)</label>
          <input 
            type="text" 
            required
            placeholder="08xxxxxxxxxx"
            className="w-full px-6 py-4 border border-slate-200 rounded-[1.5rem] focus:ring-8 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 shadow-sm"
            value={formData.phone}
            onChange={e => setFormData({...formData, phone: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email (Masked)</label>
          <input 
            type="text" 
            required
            placeholder="hafizh@email.com"
            className="w-full px-6 py-4 border border-slate-200 rounded-[1.5rem] focus:ring-8 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 shadow-sm"
            value={formData.email}
            onChange={e => setFormData({...formData, email: e.target.value})}
          />
        </div>
      </div>

      <div className="mb-10 space-y-2">
        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Alamat Domisili</label>
        <textarea 
          required
          placeholder="Alamat lengkap..."
          className="w-full px-6 py-4 border border-slate-200 rounded-[1.5rem] focus:ring-8 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all h-28 font-bold text-slate-700 resize-none shadow-sm"
          value={formData.address}
          onChange={e => setFormData({...formData, address: e.target.value})}
        />
      </div>

      <div className="p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] mb-10">
        <h4 className="font-black text-slate-800 flex items-center gap-3 mb-4 text-sm uppercase tracking-widest">
          <IconLock className="w-6 h-6 text-blue-600" /> Kepatuhan UU PDP No. 27/2022
        </h4>
        <p className="text-[11px] text-slate-500 leading-relaxed mb-6 font-medium italic">
          Pengendali Data Pribadi wajib memperoleh persetujuan tertulis atau terekam dari Subjek Data Pribadi untuk melakukan pemrosesan data pribadi sesuai mandat Pasal 20 UU PDP.
        </p>
        <label className="flex items-center gap-5 cursor-pointer group p-4 bg-white rounded-2xl transition-all border border-slate-200 hover:border-blue-400 shadow-sm">
          <input 
            type="checkbox" 
            className="w-7 h-7 rounded-xl text-blue-600 focus:ring-blue-500 cursor-pointer border-slate-300"
            checked={formData.consentSigned}
            onChange={e => setFormData({...formData, consentSigned: e.target.checked})}
          />
          <span className="text-sm font-black text-slate-700 group-hover:text-blue-600 transition-colors">
            Pasien telah memberikan persetujuan eksplisit (Consent)
          </span>
        </label>
      </div>

      <div className="flex justify-end gap-5">
        <button 
          type="button" 
          onClick={onCancel}
          className="px-10 py-4 border border-slate-200 rounded-[1.5rem] text-slate-500 hover:bg-slate-50 font-black text-xs uppercase tracking-widest transition-all"
        >
          Batal
        </button>
        <button 
          type="submit" 
          className="px-12 py-4 bg-blue-600 text-white rounded-[1.5rem] hover:bg-blue-700 font-black text-xs uppercase tracking-widest transition-all shadow-2xl shadow-blue-200"
        >
          {initialData ? 'Update Data' : 'Simpan Data'}
        </button>
      </div>
    </form>
  );
};

export default PatientForm;
