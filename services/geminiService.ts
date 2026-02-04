
import { GoogleGenAI, Type } from "@google/genai";
import { Patient, MedicalRecord } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  async summarizePatientHistory(patient: Patient): Promise<string> {
    const prompt = `
      Bertindaklah sebagai asisten medis profesional. Ringkaslah riwayat medis pasien berikut secara singkat namun padat (Medical Summary).
      Nama: ${patient.name}
      Alergi: ${patient.allergies.join(', ')}
      Riwayat Penyakit: ${patient.records.map(r => r.diagnosis).join(', ')}
      Berikan ringkasan dalam Bahasa Indonesia yang formal.
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response.text || "Gagal mendapatkan ringkasan.";
    } catch (error) {
      console.error("AI Error:", error);
      return "Layanan AI sedang tidak tersedia.";
    }
  },

  async getPDPAdvisory(action: string): Promise<string> {
    const prompt = `
      Anda adalah pakar hukum Perlindungan Data Pribadi (UU PDP) Indonesia. 
      Berikan saran singkat (maksimal 3 poin) tentang kepatuhan PDP saat melakukan tindakan: "${action}".
      Gunakan bahasa yang mudah dimengerti staf medis.
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response.text || "Tidak ada saran spesifik.";
    } catch (error) {
      return "Gagal memuat saran kepatuhan.";
    }
  }
};
