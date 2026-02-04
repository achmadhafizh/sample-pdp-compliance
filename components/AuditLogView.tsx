
import React from 'react';
import { AuditLog } from '../types';
import { IconHistory } from './Icons';

interface Props {
  logs: AuditLog[];
  onLogClick?: (log: AuditLog) => void;
}

const AuditLogView: React.FC<Props> = ({ logs, onLogClick }) => {
  return (
    <div className="bg-white rounded-2xl lg:rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 lg:p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <h3 className="font-black text-slate-800 flex items-center gap-2 lg:gap-3 text-xs lg:text-sm uppercase tracking-widest">
          <IconHistory className="text-blue-600 w-4 h-4 lg:w-5 lg:h-5" /> Audit Log
        </h3>
        <span className="text-[8px] lg:text-[10px] px-2 py-0.5 lg:px-3 lg:py-1 bg-green-100 text-green-700 rounded-full font-black uppercase">Live</span>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left min-w-[600px] lg:min-w-0">
          <thead className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
            <tr>
              <th className="px-4 lg:px-6 py-3 lg:py-4">Waktu</th>
              <th className="px-4 lg:px-6 py-3 lg:py-4">User</th>
              <th className="px-4 lg:px-6 py-3 lg:py-4">Aksi</th>
              <th className="px-4 lg:px-6 py-3 lg:py-4">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {logs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(log => (
              <tr 
                key={log.id} 
                onClick={() => onLogClick?.(log)}
                className="text-[10px] lg:text-xs hover:bg-blue-50/30 cursor-pointer transition-colors group"
              >
                <td className="px-4 lg:px-6 py-3 lg:py-4 text-slate-400 font-mono tracking-tighter">
                  {new Date(log.timestamp).toLocaleTimeString('id-ID')}
                </td>
                <td className="px-4 lg:px-6 py-3 lg:py-4 font-black text-slate-700 truncate">{log.userId}</td>
                <td className="px-4 lg:px-6 py-3 lg:py-4">
                  <span className={`px-2 py-0.5 rounded text-[8px] lg:text-[9px] font-black uppercase ${
                    log.action === 'VIEW' ? 'bg-blue-50 text-blue-600' :
                    log.action === 'DELETE' ? 'bg-red-50 text-red-600' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 lg:px-6 py-3 lg:py-4 text-slate-500 truncate max-w-[150px] lg:max-w-none">
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
