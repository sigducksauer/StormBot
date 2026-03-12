"use client";

import { useState, useCallback } from "react";
import { HexColorPicker } from "react-colorful";
import { EmbedPreview } from "./EmbedPreview";
import { useDebounce } from "@/lib/hooks/useDebounce";

export interface EmbedField {
  name:   string;
  value:  string;
  inline: boolean;
}

export interface EmbedConfig {
  title:         string;
  description:   string;
  color:         string;
  thumbnail_url: string;
  image_url:     string;
  footer_text:   string;
  footer_icon:   string;
  author_name:   string;
  author_icon:   string;
  fields:        EmbedField[];
}

const DEFAULT_CONFIG: EmbedConfig = {
  title:         "🛒 Bem-vindo à Loja",
  description:   "Selecione um produto abaixo para comprar.",
  color:         "#5865F2",
  thumbnail_url: "",
  image_url:     "",
  footer_text:   "VendBot • Compras seguras",
  footer_icon:   "",
  author_name:   "",
  author_icon:   "",
  fields:        [],
};

interface EmbedEditorProps {
  initialConfig?: Partial<EmbedConfig>;
  embedName:      string;
  onSave:         (config: EmbedConfig) => Promise<void>;
}

type Tab = "basic" | "images" | "fields" | "author";

const VARS = ["{produto}", "{preco}", "{descricao}", "{quantidade}", "{usuario}", "{servidor}"];

export function EmbedEditor({ initialConfig, embedName, onSave }: EmbedEditorProps) {
  const [config,     setConfig]     = useState<EmbedConfig>({ ...DEFAULT_CONFIG, ...initialConfig });
  const [saving,     setSaving]     = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [activeTab,  setActiveTab]  = useState<Tab>("basic");
  const [saved,      setSaved]      = useState(false);

  const debouncedConfig = useDebounce(config, 250);

  const update = useCallback((key: keyof EmbedConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const addField = () => {
    setConfig(prev => ({
      ...prev,
      fields: [...prev.fields, { name: "Novo campo", value: "Valor do campo", inline: true }],
    }));
  };

  const removeField = (index: number) => {
    setConfig(prev => ({ ...prev, fields: prev.fields.filter((_, i) => i !== index) }));
  };

  const updateField = (index: number, key: keyof EmbedField, value: string | boolean) => {
    setConfig(prev => {
      const fields = [...prev.fields];
      fields[index] = { ...fields[index], [key]: value };
      return { ...prev, fields };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "basic",  label: "📝 Básico"  },
    { key: "images", label: "🖼️ Imagens" },
    { key: "fields", label: `📋 Campos ${config.fields.length > 0 ? `(${config.fields.length})` : ""}` },
    { key: "author", label: "👤 Autor"   },
  ];

  return (
    <div className="flex gap-6 h-full">
      {/* ── Editor ─────────────────────────────────── */}
      <div className="w-1/2 flex flex-col gap-4 overflow-y-auto pr-1">
        {/* Header do editor */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">{embedName}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Personalize a aparência no Discord</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              saved
                ? "bg-green-600 text-white"
                : "bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white"
            }`}
          >
            {saving ? "Salvando..." : saved ? "✅ Salvo!" : "💾 Salvar"}
          </button>
        </div>

        {/* Variáveis disponíveis */}
        <div className="p-3 bg-zinc-800/50 border border-zinc-700 rounded-xl">
          <p className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Variáveis dinâmicas</p>
          <div className="flex flex-wrap gap-1.5">
            {VARS.map(v => (
              <code key={v}
                className="text-xs bg-zinc-800 border border-zinc-700 text-indigo-400 px-2 py-0.5 rounded-md cursor-pointer hover:bg-zinc-700 transition"
                onClick={() => navigator.clipboard?.writeText(v).catch(() => {})}
              >{v}</code>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-800 p-1 rounded-xl">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === tab.key ? "bg-zinc-700 text-white shadow" : "text-zinc-500 hover:text-zinc-300"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Básico */}
        {activeTab === "basic" && (
          <div className="space-y-4">
            <Field label="Título">
              <input className={CLS} value={config.title}
                onChange={e => update("title", e.target.value)}
                placeholder="Título da embed" maxLength={256} />
            </Field>

            <Field label="Descrição">
              <textarea className={`${CLS} h-24 resize-none`} value={config.description}
                onChange={e => update("description", e.target.value)}
                placeholder="Descrição... Suporta **markdown**" maxLength={4096} />
            </Field>

            <Field label="Cor da borda lateral">
              <div className="relative">
                <button
                  onClick={() => setShowPicker(p => !p)}
                  className="flex items-center gap-3 w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 hover:border-zinc-600 transition"
                >
                  <span className="w-6 h-6 rounded-md border border-zinc-600 flex-shrink-0"
                    style={{ backgroundColor: config.color }} />
                  <span className="text-sm text-white font-mono">{config.color}</span>
                </button>
                {showPicker && (
                  <div className="absolute top-12 left-0 z-30 p-3 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl">
                    <HexColorPicker color={config.color} onChange={c => update("color", c)} />
                    <button className="w-full mt-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-xs text-white rounded-lg transition"
                      onClick={() => setShowPicker(false)}>
                      ✓ Confirmar
                    </button>
                  </div>
                )}
              </div>
            </Field>

            <Field label="Rodapé">
              <input className={CLS} value={config.footer_text}
                onChange={e => update("footer_text", e.target.value)}
                placeholder="Texto do rodapé" maxLength={2048} />
            </Field>
          </div>
        )}

        {/* Tab: Imagens */}
        {activeTab === "images" && (
          <div className="space-y-4">
            <Field label="Thumbnail (canto superior direito)">
              <input className={CLS} value={config.thumbnail_url}
                onChange={e => update("thumbnail_url", e.target.value)}
                placeholder="https://..." />
              {config.thumbnail_url && (
                <img src={config.thumbnail_url} alt="" className="mt-2 w-16 h-16 rounded-lg object-cover border border-zinc-700"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
            </Field>

            <Field label="Imagem principal (banner grande)">
              <input className={CLS} value={config.image_url}
                onChange={e => update("image_url", e.target.value)}
                placeholder="https://..." />
              {config.image_url && (
                <img src={config.image_url} alt="" className="mt-2 w-full max-h-28 rounded-lg object-cover border border-zinc-700"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
            </Field>

            <Field label="Ícone do rodapé">
              <input className={CLS} value={config.footer_icon}
                onChange={e => update("footer_icon", e.target.value)}
                placeholder="https://..." />
            </Field>
          </div>
        )}

        {/* Tab: Campos */}
        {activeTab === "fields" && (
          <div className="space-y-3">
            {config.fields.length === 0 && (
              <p className="text-zinc-600 text-sm text-center py-6">Nenhum campo adicionado ainda.</p>
            )}
            {config.fields.map((field, i) => (
              <div key={i} className="p-4 bg-zinc-800 rounded-xl border border-zinc-700">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Campo {i + 1}</span>
                  <button onClick={() => removeField(i)} className="text-xs text-red-400 hover:text-red-300 transition">
                    🗑 Remover
                  </button>
                </div>
                <input className={`${CLS} mb-2`} value={field.name}
                  onChange={e => updateField(i, "name", e.target.value)}
                  placeholder="Título do campo" />
                <textarea className={`${CLS} h-16 resize-none mb-3`} value={field.value}
                  onChange={e => updateField(i, "value", e.target.value)}
                  placeholder="Valor do campo" />
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={field.inline}
                    onChange={e => updateField(i, "inline", e.target.checked)}
                    className="w-4 h-4 accent-indigo-500 rounded" />
                  <span className="text-sm text-zinc-300">Exibir em linha (inline)</span>
                </label>
              </div>
            ))}
            <button onClick={addField}
              className="w-full py-2.5 border-2 border-dashed border-zinc-700 text-zinc-500 hover:text-white hover:border-indigo-500 rounded-xl text-sm transition">
              + Adicionar campo
            </button>
          </div>
        )}

        {/* Tab: Autor */}
        {activeTab === "author" && (
          <div className="space-y-4">
            <Field label="Nome do autor">
              <input className={CLS} value={config.author_name}
                onChange={e => update("author_name", e.target.value)}
                placeholder="Ex: VendBot Store" maxLength={256} />
            </Field>
            <Field label="URL do ícone do autor">
              <input className={CLS} value={config.author_icon}
                onChange={e => update("author_icon", e.target.value)}
                placeholder="https://..." />
              {config.author_icon && (
                <img src={config.author_icon} alt="" className="mt-2 w-10 h-10 rounded-full border border-zinc-700"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
            </Field>
          </div>
        )}
      </div>

      {/* ── Preview ────────────────────────────────── */}
      <div className="w-1/2 sticky top-0 self-start">
        <p className="text-xs font-semibold text-zinc-500 mb-3 text-center uppercase tracking-wide">
          Preview ao vivo
        </p>
        <div className="bg-[#313338] rounded-2xl p-5 min-h-48 border border-[#232428]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">V</div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-bold">VendBot</span>
                <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-bold">BOT</span>
              </div>
              <span className="text-zinc-500 text-xs">Hoje às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>
          <EmbedPreview config={debouncedConfig} />
        </div>
      </div>
    </div>
  );
}

const CLS = "w-full bg-zinc-700/50 border border-zinc-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
