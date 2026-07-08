import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { 
  Upload, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Loader2, 
  RefreshCw, 
  X,
  Play
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

interface ImportadorPlanilhaProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface Mapping {
  nome: string;
  cpf: string;
  telefone: string;
  cep: string;
  endereco: string;
  bairro: string;
}

export default function ImportadorPlanilha({ onClose, onSuccess }: ImportadorPlanilhaProps) {
  const { profile } = useAuth();
  
  // States
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({
    nome: '',
    cpf: '',
    telefone: '',
    cep: '',
    endereco: '',
    bairro: ''
  });
  
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'complete'>('upload');
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
    successes: 0,
    duplicates: 0,
    errors: 0
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  // Mask CPF Helper
  const maskCPF = (value: string) => {
    const clean = value.replace(/\D/g, "");
    if (clean.length !== 11) return value;
    return clean
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2");
  };

  // Mask Phone Helper
  const maskPhone = (value: string) => {
    const clean = value.replace(/\D/g, "");
    if (clean.length < 10) return value;
    if (clean.length === 10) {
      return clean.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    return clean.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  };

  // Mask CEP Helper
  const maskCEP = (value: string) => {
    const clean = value.replace(/\D/g, "");
    if (clean.length !== 8) return value;
    return clean.replace(/^(\d{5})(\d)/, "$1-$2");
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragRef.current) {
      dragRef.current.classList.add('border-blue-500', 'bg-blue-600/5');
    }
  };

  const handleDragLeave = () => {
    if (dragRef.current) {
      dragRef.current.classList.remove('border-blue-500', 'bg-blue-600/5');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleDragLeave();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Core file processing
  const processFile = (selectedFile: File) => {
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      toast.error('Formato inválido. Por favor envie um arquivo Excel (.xlsx, .xls) ou CSV.');
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert sheet to raw 2D array of headers and rows
        const jsonData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        
        if (jsonData.length === 0) {
          toast.error('A planilha carregada está vazia.');
          return;
        }

        const fileHeaders = (jsonData[0] as any[]).map(h => String(h || '').trim());
        const fileRows = jsonData.slice(1).filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''));

        setHeaders(fileHeaders);
        setRows(fileRows);

        // Run smart auto-detection rules
        const autoMap: Mapping = {
          nome: '',
          cpf: '',
          telefone: '',
          cep: '',
          endereco: '',
          bairro: ''
        };

        fileHeaders.forEach((header) => {
          const lower = header.toLowerCase();
          
          if (lower.includes('nome') || lower.includes('name') || lower.includes('cidad') || lower.includes('pacient') || lower.includes('beneficiario') || lower.includes('solicitante')) {
            if (!autoMap.nome) autoMap.nome = header;
          } else if (lower.includes('cpf') || lower.includes('doc')) {
            if (!autoMap.cpf) autoMap.cpf = header;
          } else if (lower.includes('tel') || lower.includes('phone') || lower.includes('cel') || lower.includes('whats') || lower.includes('fone')) {
            if (!autoMap.telefone) autoMap.telefone = header;
          } else if (lower.includes('cep') || lower.includes('zip')) {
            if (!autoMap.cep) autoMap.cep = header;
          } else if (lower.includes('end') || lower.includes('address') || lower.includes('rua') || lower.includes('logradouro')) {
            if (!autoMap.endereco) autoMap.endereco = header;
          } else if (lower.includes('bair') || lower.includes('neigh') || lower.includes('distrit')) {
            if (!autoMap.bairro) autoMap.bairro = header;
          }
        });

        setMapping(autoMap);
        setStep('mapping');
        toast.success('Arquivo lido com sucesso!');
      } catch (err) {
        console.error(err);
        toast.error('Erro ao processar o arquivo. Certifique-se de que é um formato válido.');
      }
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  // Get index of mapped header
  const getHeaderIndex = (headerName: string) => {
    return headers.indexOf(headerName);
  };

  const handleStartImport = async () => {
    if (!profile?.cabinetId) {
      toast.error('Você precisa estar logado em um gabinete para realizar importações.');
      return;
    }

    if (!mapping.nome) {
      toast.error('O mapeamento para o campo "Nome Completo" é obrigatório.');
      return;
    }

    setStep('importing');
    const totalToImport = rows.length;
    setImportProgress({
      current: 0,
      total: totalToImport,
      successes: 0,
      duplicates: 0,
      errors: 0
    });

    const nomeIdx = getHeaderIndex(mapping.nome);
    const cpfIdx = mapping.cpf ? getHeaderIndex(mapping.cpf) : -1;
    const telIdx = mapping.telefone ? getHeaderIndex(mapping.telefone) : -1;
    const cepIdx = mapping.cep ? getHeaderIndex(mapping.cep) : -1;
    const endIdx = mapping.endereco ? getHeaderIndex(mapping.endereco) : -1;
    const bairIdx = mapping.bairro ? getHeaderIndex(mapping.bairro) : -1;

    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawNome = row[nomeIdx] ? String(row[nomeIdx]).trim() : '';
      
      // Skip row if name is missing
      if (!rawNome) {
        errorCount++;
        setImportProgress(prev => ({ ...prev, current: i + 1, errors: errorCount }));
        continue;
      }

      const rawCpf = cpfIdx !== -1 && row[cpfIdx] ? String(row[cpfIdx]).trim().replace(/\D/g, '') : '';
      const formattedCpf = rawCpf.length === 11 ? maskCPF(rawCpf) : 'SEM-CPF';

      const rawTel = telIdx !== -1 && row[telIdx] ? String(row[telIdx]).trim() : '';
      const formattedTel = rawTel ? maskPhone(rawTel) : '';

      const rawCep = cepIdx !== -1 && row[cepIdx] ? String(row[cepIdx]).trim().replace(/\D/g, '') : '';
      const formattedCep = rawCep.length === 8 ? maskCEP(rawCep) : '';

      const rawEndereco = endIdx !== -1 && row[endIdx] ? String(row[endIdx]).trim() : '';
      const rawBairro = bairIdx !== -1 && row[bairIdx] ? String(row[bairIdx]).trim() : '';

      try {
        // Simple deduplication check by CPF (if valid CPF provided)
        if (formattedCpf !== 'SEM-CPF') {
          const qExist = query(
            collection(db, 'atendimentos'),
            where('cabinetId', '==', profile.cabinetId),
            where('cpf', '==', formattedCpf)
          );
          const snapExist = await getDocs(qExist);
          if (!snapExist.empty) {
            duplicateCount++;
            setImportProgress(prev => ({ ...prev, current: i + 1, duplicates: duplicateCount }));
            continue;
          }
        }

        // Create an initial interaction/record under "atendimentos"
        const year = new Date().getFullYear();
        const random = Math.floor(1000 + Math.random() * 9000);
        const protocol = `PROT-${year}-${random}`;

        await addDoc(collection(db, 'atendimentos'), {
          protocolo: protocol,
          nome_completo: rawNome,
          cpf: formattedCpf,
          telefone: formattedTel,
          cep: formattedCep,
          endereco: rawEndereco,
          bairro: rawBairro,
          tipo_atendimento: 'Cadastro Inicial',
          descricao: 'Cadastro de cidadão importado via planilha.',
          status: 'Concluído',
          prioridade: 'Média',
          cabinetId: profile.cabinetId,
          usuario_id: profile.id || '',
          usuario_nome: profile.nome || 'Gabinete CRM',
          canal: 'Importador',
          created_at: serverTimestamp()
        });

        successCount++;
        setImportProgress(prev => ({ ...prev, current: i + 1, successes: successCount }));
      } catch (err) {
        console.error(`Erro ao importar linha ${i + 2}:`, err);
        errorCount++;
        setImportProgress(prev => ({ ...prev, current: i + 1, errors: errorCount }));
      }
    }

    setStep('complete');
    onSuccess();
    toast.success('Processo de importação finalizado!');
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/50 backdrop-blur-sm">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileSpreadsheet size={22} className="text-blue-500" />
              Importar Cidadãos (CSV / Excel)
            </h3>
            <p className="text-xs text-slate-400 mt-1">Carregue sua base de contatos para acelerar o CRM.</p>
          </div>
          <button
            onClick={onClose}
            disabled={step === 'importing'}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-500 hover:text-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                ref={dragRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-800 hover:border-blue-500/50 bg-slate-950/20 hover:bg-blue-600/[0.02] transition-all rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer min-h-[220px]"
              >
                <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 mb-4 shadow-lg shadow-blue-500/5">
                  <Upload size={26} />
                </div>
                <h4 className="text-base font-bold text-white tracking-tight">Arraste seu arquivo ou clique para carregar</h4>
                <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
                  Formatos suportados: Excel (<strong>.xlsx, .xls</strong>) ou planilhas de valores separados por vírgula (<strong>.csv</strong>).
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                />
              </div>

              {/* Instructions */}
              <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h5 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">Como funciona:</h5>
                <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
                  <li>Selecione qualquer arquivo com dados de contatos de munícipes.</li>
                  <li>Na próxima etapa, mapeie quais colunas correspondem a cada dado (Nome, Telefone, CPF, etc.).</li>
                  <li>Cadastros existentes com o mesmo CPF serão preservados e não duplicados.</li>
                  <li>O limite recomendado é de até <strong>500 linhas</strong> por importação para melhor performance.</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {step === 'mapping' && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center gap-3">
                <FileSpreadsheet className="text-blue-400 shrink-0" size={18} />
                <div className="text-xs text-blue-400 leading-relaxed">
                  <strong>Planilha carregada:</strong> {file?.name} ({rows.length} contatos encontrados). Mapeie as colunas correspondentes abaixo.
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">Mapeamento de Colunas</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nome Completo (Required) */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>Nome Completo <span className="text-red-500">*</span></span>
                    </label>
                    <select
                      value={mapping.nome}
                      onChange={(e) => setMapping({...mapping, nome: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-300 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">-- Selecione a coluna --</option>
                      {headers.map((h, i) => (
                        <option key={i} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* CPF */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300">CPF (Opcional)</label>
                    <select
                      value={mapping.cpf}
                      onChange={(e) => setMapping({...mapping, cpf: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-300 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">-- Ignorar ou Não Possui --</option>
                      {headers.map((h, i) => (
                        <option key={i} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Telefone */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300">Telefone / WhatsApp</label>
                    <select
                      value={mapping.telefone}
                      onChange={(e) => setMapping({...mapping, telefone: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-300 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">-- Ignorar ou Não Possui --</option>
                      {headers.map((h, i) => (
                        <option key={i} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* CEP */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300">CEP</label>
                    <select
                      value={mapping.cep}
                      onChange={(e) => setMapping({...mapping, cep: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-300 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">-- Ignorar ou Não Possui --</option>
                      {headers.map((h, i) => (
                        <option key={i} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Endereço */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300">Endereço (Rua, Número, etc.)</label>
                    <select
                      value={mapping.endereco}
                      onChange={(e) => setMapping({...mapping, endereco: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-300 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">-- Ignorar ou Não Possui --</option>
                      {headers.map((h, i) => (
                        <option key={i} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Bairro */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300">Bairro</label>
                    <select
                      value={mapping.bairro}
                      onChange={(e) => setMapping({...mapping, bairro: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-300 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">-- Ignorar ou Não Possui --</option>
                      {headers.map((h, i) => (
                        <option key={i} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={() => setStep('preview')}
                  disabled={!mapping.nome}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer transition-colors flex items-center gap-2"
                >
                  Visualizar Dados
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW DATA */}
          {step === 'preview' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">Amostra de Registros (Primeiras 5 Linhas)</h4>
                <p className="text-[11px] text-slate-400">Verifique se as colunas foram mapeadas corretamente antes de prosseguir.</p>
              </div>

              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        <th className="p-3.5">Nome</th>
                        <th className="p-3.5">CPF</th>
                        <th className="p-3.5">Telefone</th>
                        <th className="p-3.5">CEP</th>
                        <th className="p-3.5">Bairro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {rows.slice(0, 5).map((row, idx) => {
                        const nomeVal = mapping.nome ? String(row[getHeaderIndex(mapping.nome)] || '-') : '-';
                        const cpfVal = mapping.cpf ? String(row[getHeaderIndex(mapping.cpf)] || '-') : '-';
                        const telVal = mapping.telefone ? String(row[getHeaderIndex(mapping.telefone)] || '-') : '-';
                        const cepVal = mapping.cep ? String(row[getHeaderIndex(mapping.cep)] || '-') : '-';
                        const bairVal = mapping.bairro ? String(row[getHeaderIndex(mapping.bairro)] || '-') : '-';

                        return (
                          <tr key={idx} className="hover:bg-slate-900/40 transition-colors text-slate-300">
                            <td className="p-3.5 font-bold text-slate-200">{nomeVal}</td>
                            <td className="p-3.5 font-mono text-[11px]">{cpfVal !== '-' ? maskCPF(cpfVal) : '-'}</td>
                            <td className="p-3.5">{telVal !== '-' ? maskPhone(telVal) : '-'}</td>
                            <td className="p-3.5 font-mono">{cepVal !== '-' ? maskCEP(cepVal) : '-'}</td>
                            <td className="p-3.5">{bairVal}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep('mapping')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer transition-colors"
                >
                  Mapear Colunas
                </button>
                <button
                  type="button"
                  onClick={handleStartImport}
                  className="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer transition-colors flex items-center gap-2 shadow-lg shadow-green-900/10"
                >
                  <Play size={14} />
                  Iniciar Importação ({rows.length} contatos)
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: IMPORT PROGRESS */}
          {step === 'importing' && (
            <div className="space-y-6 py-4 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-2" />
              <div className="space-y-1 max-w-sm">
                <h4 className="text-base font-bold text-white">Importando dados para o CRM</h4>
                <p className="text-xs text-slate-400">Gravando os contatos de cidadãos com segurança e validando CPFs...</p>
              </div>

              <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-full h-3 overflow-hidden">
                <div
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  className="bg-blue-500 h-full transition-all duration-300"
                />
              </div>

              <div className="grid grid-cols-4 gap-4 w-full max-w-md bg-slate-950/50 border border-slate-850 p-4 rounded-2xl text-xs font-medium">
                <div>
                  <span className="text-slate-500 block uppercase tracking-wider text-[9px] font-bold">Processados</span>
                  <span className="text-base font-bold text-white">{importProgress.current} / {importProgress.total}</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase tracking-wider text-[9px] font-bold">Sucessos</span>
                  <span className="text-base font-bold text-green-400">{importProgress.successes}</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase tracking-wider text-[9px] font-bold">Duplicados</span>
                  <span className="text-base font-bold text-amber-400">{importProgress.duplicates}</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase tracking-wider text-[9px] font-bold">Erros</span>
                  <span className="text-base font-bold text-red-400">{importProgress.errors}</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: COMPLETED */}
          {step === 'complete' && (
            <div className="space-y-6 py-4 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center text-green-400 mb-2 shadow-lg shadow-green-500/5">
                <CheckCircle2 size={32} />
              </div>
              <div className="space-y-1 max-w-sm">
                <h4 className="text-base font-bold text-white">Importação Concluída!</h4>
                <p className="text-xs text-slate-400">Sua planilha foi processada e cadastrada no banco de dados.</p>
              </div>

              <div className="grid grid-cols-3 gap-4 w-full max-w-sm bg-slate-950/50 border border-slate-850 p-4 rounded-2xl text-xs font-medium">
                <div>
                  <span className="text-slate-500 block uppercase tracking-wider text-[9px] font-bold">Importados</span>
                  <span className="text-base font-bold text-green-400">{importProgress.successes}</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase tracking-wider text-[9px] font-bold">Duplicados</span>
                  <span className="text-base font-bold text-amber-400">{importProgress.duplicates}</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase tracking-wider text-[9px] font-bold">Erros</span>
                  <span className="text-base font-bold text-red-400">{importProgress.errors}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer transition-colors"
              >
                Concluir e Fechar
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
