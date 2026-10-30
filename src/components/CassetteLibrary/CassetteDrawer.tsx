import React, { useState, useRef } from 'react';
import { DictationItem, DifficultyLevel, DictationAttempt } from '../../types/dictation';
import { Disc, Plus, X, Search, CheckCircle, Upload, Download, FileAudio, Trash2, FileText, Copy, Check } from 'lucide-react';
import { soundFx } from '../../utils/audioEffects';
import { saveAudioBlob, generateDettatiTxtContent } from '../../utils/storage';

interface CassetteDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  dictations: DictationItem[];
  currentTrackId: string | null;
  onSelectTrack: (track: DictationItem) => void;
  onAddCustomDictation: (newItem: DictationItem) => void;
  onDeleteCustomDictation: (id: string) => void;
  attempts: Record<string, DictationAttempt>;
}

export const CassetteDrawer: React.FC<CassetteDrawerProps> = ({
  isOpen,
  onClose,
  dictations,
  currentTrackId,
  onSelectTrack,
  onAddCustomDictation,
  onDeleteCustomDictation,
  attempts,
}) => {
  const [activeTab, setActiveTab] = useState<string>('TUTTI');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingModalOpen, setIsAddingModalOpen] = useState(false);
  const [showTxtModal, setShowTxtModal] = useState(false);
  const [copiedTxt, setCopiedTxt] = useState(false);

  // Simplified Form State (Only 3 essential fields!)
  const [newDifficulty, setNewDifficulty] = useState<DifficultyLevel>('Principiante');
  const [newAudioPath, setNewAudioPath] = useState('lezione.mp3');
  const [newChineseText, setNewChineseText] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedBlobUrl, setUploadedBlobUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const filteredList = dictations.filter((item) => {
    const matchesTab =
      activeTab === 'TUTTI' ||
      (activeTab === 'PRINCIPIANTE' && item.difficulty === 'Principiante') ||
      (activeTab === 'INTERMEDIO' && item.difficulty === 'Intermedio') ||
      (activeTab === 'AVANZATO' && item.difficulty === 'Avanzato') ||
      (activeTab === 'CUSTOM' && item.isCustom);

    const matchesSearch =
      searchQuery.trim() === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.chineseText.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesTab && matchesSearch;
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    soundFx.playClick('switch');
    setUploadedFileName(file.name);
    setNewAudioPath(file.name);

    const blobUrl = URL.createObjectURL(file);
    setUploadedBlobUrl(blobUrl);

    const tempId = `custom-audio-${Date.now()}`;
    await saveAudioBlob(tempId, file);
  };

  const handleSaveNewDictation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChineseText.trim()) return;

    soundFx.playClick('play');

    let finalAudioPath = uploadedBlobUrl || newAudioPath.trim();
    if (!uploadedBlobUrl && !finalAudioPath.startsWith('/') && !finalAudioPath.startsWith('http')) {
      finalAudioPath = `/audio/${finalAudioPath}`;
    }

    const title = newTitle.trim() || `Dettato ${dictations.length + 1}`;

    const newId = `custom-${Date.now()}`;
    const newItem: DictationItem = {
      id: newId,
      title,
      difficulty: newDifficulty,
      audioSrc: finalAudioPath,
      chineseText: newChineseText.trim(),
      isCustom: true,
      createdAt: new Date().toISOString(),
    };

    onAddCustomDictation(newItem);
    setIsAddingModalOpen(false);

    // Reset Form
    setNewDifficulty('Principiante');
    setNewAudioPath('lezione.mp3');
    setNewChineseText('');
    setNewTitle('');
    setUploadedFileName(null);
    setUploadedBlobUrl(null);
  };

  const handleDownloadTxt = () => {
    soundFx.playClick('switch');
    const txtContent = generateDettatiTxtContent(dictations);
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dettati.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyTxt = () => {
    soundFx.playClick('switch');
    const txtContent = generateDettatiTxtContent(dictations);
    navigator.clipboard.writeText(txtContent);
    setCopiedTxt(true);
    setTimeout(() => setCopiedTxt(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-white border-2 border-stone-300 shadow-2xl overflow-hidden text-stone-800">
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
              <Disc className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-base font-bold font-mono text-stone-900 tracking-wide">
                LIBRERIA NASTRI AUDIO & DETTATI CINESI
              </h2>
              <p className="text-xs font-mono text-stone-500">
                Aggiungi o ascolta i file MP3 nella cartella /public/audio/ (Senza JSON!)
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundFx.playClick('stop');
              onClose();
            }}
            className="w-8 h-8 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-600 hover:text-stone-900 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="p-3 bg-white border-b border-stone-200 flex flex-wrap items-center justify-between gap-2.5">
          {/* Difficulty Tabs */}
          <div className="flex flex-wrap gap-1 font-mono text-xs">
            {['TUTTI', 'PRINCIPIANTE', 'INTERMEDIO', 'AVANZATO', 'CUSTOM'].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  soundFx.playClick('switch');
                  setActiveTab(tab);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold border transition cursor-pointer ${
                  activeTab === tab
                    ? 'bg-amber-500 text-stone-950 border-amber-600 shadow-xs'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
                }`}
              >
                {tab === 'TUTTI'
                  ? `Tutti (${dictations.length})`
                  : tab === 'PRINCIPIANTE'
                  ? 'Principiante'
                  : tab === 'INTERMEDIO'
                  ? 'Intermedio'
                  : tab === 'AVANZATO'
                  ? 'Avanzato'
                  : 'Aggiunti da te'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundFx.playClick('switch');
                setIsAddingModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-mono text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Aggiungi MP3</span>
            </button>
            <button
              onClick={() => {
                soundFx.playClick('switch');
                setShowTxtModal(true);
              }}
              title="Visualizza o scarica dettati.txt (1 riga per esercizio)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono text-xs font-semibold border border-stone-300 transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-amber-600" />
              <span>Vedi dettati.txt</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-2 bg-stone-50 border-b border-stone-200 flex items-center gap-2">
          <Search className="w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca per titolo o caratteri cinesi..."
            className="w-full bg-transparent text-xs text-stone-800 placeholder:text-stone-400 focus:outline-hidden font-mono"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-stone-500 hover:text-stone-800"
            >
              Cancella
            </button>
          )}
        </div>

        {/* Cassette Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8fafc]">
          {filteredList.length === 0 ? (
            <div className="text-center py-12 text-stone-400 font-mono text-sm">
              Nessun nastro audio trovato.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredList.map((track) => {
                const isSelected = track.id === currentTrackId;
                const attempt = attempts[track.id];

                const spineColor =
                  track.difficulty === 'Principiante'
                    ? 'border-l-amber-500 bg-amber-50/40'
                    : track.difficulty === 'Intermedio'
                    ? 'border-l-blue-500 bg-blue-50/40'
                    : track.difficulty === 'Avanzato'
                    ? 'border-l-red-500 bg-red-50/40'
                    : 'border-l-purple-500 bg-purple-50/40';

                return (
                  <div
                    key={track.id}
                    onClick={() => {
                      soundFx.playClick('play');
                      onSelectTrack(track);
                      onClose();
                    }}
                    className={`relative p-3.5 rounded-2xl border transition cursor-pointer group flex flex-col justify-between shadow-2xs ${
                      isSelected
                        ? 'bg-amber-100/70 border-amber-500 ring-2 ring-amber-400/40'
                        : 'bg-white hover:bg-stone-50 border-stone-200 hover:border-stone-300'
                    } border-l-4 ${spineColor}`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="font-bold text-sm text-stone-900 group-hover:text-amber-700 transition truncate">
                          {track.title}
                        </h3>
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            track.difficulty === 'Principiante'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : track.difficulty === 'Intermedio'
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : track.difficulty === 'Avanzato'
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : 'bg-purple-100 text-purple-800 border border-purple-300'
                          }`}
                        >
                          {track.difficulty}
                        </span>
                      </div>

                      <p className="text-base text-stone-800 font-sans tracking-wide mb-2 font-semibold line-clamp-1">
                        {track.chineseText}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-[11px] font-mono text-stone-500">
                      <div className="flex items-center gap-1.5 truncate max-w-[65%]">
                        <FileAudio className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="truncate">{track.audioSrc}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {attempt && attempt.completed && (
                          <div className="flex items-center gap-1 text-emerald-600 font-bold">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>{attempt.score}%</span>
                          </div>
                        )}

                        {track.isCustom && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              soundFx.playClick('stop');
                              onDeleteCustomDictation(track.id);
                            }}
                            title="Elimina"
                            className="p-1 text-stone-400 hover:text-red-500 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <span className="text-amber-600 font-bold group-hover:underline">
                          CARICA NEL WALKMAN ▶
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-stone-500">
          <span>Formato testo: 1 riga per dettato nel file /public/audio/dettati.txt</span>
          <span>Nastri: {dictations.length}</span>
        </div>
      </div>

      {/* MODAL SEMPLIFICATO: Aggiungi MP3 (Nessun JSON!) */}
      {isAddingModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white border-2 border-stone-300 p-6 shadow-2xl text-stone-800">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="text-base font-bold text-amber-700 font-mono tracking-wide flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span>AGGIUNGI NUOVO MP3 (SEMPLICE)</span>
              </h3>
              <button
                onClick={() => setIsAddingModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 hover:text-stone-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewDictation} className="mt-4 space-y-4 text-xs font-mono">
              {/* 1. Difficoltà */}
              <div>
                <label className="block text-stone-700 font-bold mb-1">1. LIVELLO DI DIFFICOLTÀ:</label>
                <select
                  value={newDifficulty}
                  onChange={(e) => setNewDifficulty(e.target.value as DifficultyLevel)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl p-2.5 text-stone-900 focus:border-amber-500 focus:outline-hidden font-bold"
                >
                  <option value="Principiante">Principiante</option>
                  <option value="Intermedio">Intermedio</option>
                  <option value="Avanzato">Avanzato</option>
                </select>
              </div>

              {/* 2. File MP3 */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <label className="block text-stone-800 font-bold">2. FILE MP3:</label>
                
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/mp3,audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs cursor-pointer shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadedFileName ? `Caricato: ${uploadedFileName}` : 'Carica MP3 dal computer'}</span>
                  </button>
                </div>

                <div className="text-[10px] text-stone-500 text-center">oppure scrivi il nome del file in /public/audio/:</div>

                <input
                  type="text"
                  placeholder="es. lezione5.mp3"
                  value={newAudioPath}
                  onChange={(e) => setNewAudioPath(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-lg p-2 text-stone-900 focus:border-amber-500 focus:outline-hidden text-xs"
                />
              </div>

              {/* 3. Frase Cinese */}
              <div>
                <label className="block text-stone-700 font-bold mb-1">
                  3. FRASE IN CINESE (Caratteri da trascrivere):
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Incolla qui la frase cinese (es. 明天你想去哪儿？)"
                  value={newChineseText}
                  onChange={(e) => setNewChineseText(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl p-2.5 text-stone-900 font-sans text-base focus:border-amber-500 focus:outline-hidden resize-none"
                />
              </div>

              {/* Titolo opzionale */}
              <div>
                <label className="block text-stone-500 mb-1 text-[11px]">TITOLO (Opzionale):</label>
                <input
                  type="text"
                  placeholder="es. 05. In Viaggio"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl p-2 text-stone-900 focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold shadow-md cursor-pointer"
                >
                  Salva Cassetta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETTATI.TXT: Testo Semplice (Senza JSON) */}
      {showTxtModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl rounded-3xl bg-white border-2 border-stone-300 p-6 shadow-2xl text-stone-800 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-stone-900 font-mono tracking-wide">
                  FORMATO SEMPLICE: /public/audio/dettati.txt
                </h3>
              </div>
              <button
                onClick={() => setShowTxtModal(false)}
                className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 hover:text-stone-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-3 text-xs text-stone-600 font-mono">
              Niente JSON o formati complicati! Puoi modificare il file <strong className="text-stone-900">/public/audio/dettati.txt</strong> con qualsiasi editor di testo inserendo <strong>1 riga per dettato</strong>:
              <div className="p-2 mt-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 font-bold">
                Difficoltà | Nome file MP3 | Titolo | Frase cinese
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-stone-900 text-amber-300 p-3.5 rounded-xl font-mono text-xs shadow-inner leading-relaxed select-all">
              <pre>{generateDettatiTxtContent(dictations)}</pre>
            </div>

            <div className="pt-3 border-t border-stone-200 flex items-center justify-between gap-2">
              <button
                onClick={handleCopyTxt}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-mono text-xs font-bold border border-stone-300 cursor-pointer"
              >
                {copiedTxt ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copiedTxt ? 'Copiato negli appunti!' : 'Copia testo'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadTxt}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Scarica dettati.txt</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
