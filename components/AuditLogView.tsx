
import React from 'react';
import { AuditLog } from '../types';
import { IconHistory } from './Icons';

interface Props {
  logs: AuditLog[];
  onLogClick?: (log: AuditLog) => void;
}

const AuditLogView: React.FC<Props> = ({ logs, onLogClick }) => {
  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <h3 className="font-black text-slate-800 flex items-center gap-3 text-sm uppercase tracking-widest">
          <IconHistory className="text-blue-600" /> Log Jejak Audit (UU PDP)
        </h3>
        <span className="text-[10px] px-3 py-1 bg-green-100 text-green-700 rounded-full font-black uppercase tracking-tighter animate-pulse">Live Secure Monitoring</span>
      </div>
      <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
        <table className="w-full text-left table-fixed">
          <thead className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 w-1/4">Waktu</th>
              <th className="px-6 py-4 w-1/4">User</th>
              <th className="px-6 py-4 w-1/6">Aksi</th>
              <th className="px-6 py-4 w-1/3">Detail Singkat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {logs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(log => (
              <tr 
                key={log.id} 
                onClick={() => onLogClick?.(log)}
                className="text-xs hover:bg-blue-50/30 cursor-pointer transition-colors group"
              >
                <td className="px-6 py-4 text-slate-400 font-mono tracking-tighter whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString('id-ID')}
                  <span className="block text-[9px] opacity-60">{new Date(log.timestamp).toLocaleDateString('id-ID')}</span>
                </td>
                <td className="px-6 py-4 font-black text-slate-700 group-hover:text-blue-600 truncate">{log.userId}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${
                    log.action === 'VIEW' ? 'bg-blue-50 text-blue-600' :
                    log.action === 'DELETE' ? 'bg-red-50 text-red-600' :
                    log.action === 'CREATE' ? 'bg-green-50 text-green-600' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500 italic truncate font-medium">
                  {log.details}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLogView;
