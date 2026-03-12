"use client";

import { EmbedConfig } from "./EmbedEditor";

function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "88, 101, 242";
  return `${r}, ${g}, ${b}`;
}

export function EmbedPreview({ config }: { config: EmbedConfig }) {
  const inlineFields  = config.fields.filter(f => f.inline);
  const blockFields   = config.fields.filter(f => !f.inline);
  const hasContent    = config.title || config.description || config.fields.length > 0;

  if (!hasContent) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">
        Preencha os campos para ver o preview
      </div>
    );
  }

  return (
    <div
      className="rounded-md overflow-hidden text-sm max-w-lg"
      style={{
        backgroundColor: "#2b2d31",
        borderLeft: `4px solid ${config.color || "#5865F2"}`,
      }}
    >
      <div className="p-4">
        {/* Autor */}
        {config.author_name && (
          <div className="flex items-center gap-2 mb-2">
            {config.author_icon && (
              <img src={config.author_icon} alt="" className="w-5 h-5 rounded-full"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
            <span className="text-white text-xs font-semibold">{config.author_name}</span>
          </div>
        )}

        {/* Título + thumbnail */}
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            {config.title && (
              <p className="text-white font-bold text-sm mb-1 leading-snug">
                {config.title}
              </p>
            )}
            {config.description && (
              <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-line">
                {config.description}
              </p>
            )}
          </div>
          {config.thumbnail_url && (
            <img src={config.thumbnail_url} alt="" className="w-14 h-14 rounded-md object-cover flex-shrink-0"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
        </div>

        {/* Campos inline */}
        {inlineFields.length > 0 && (
          <div className={`grid gap-3 mt-3 ${inlineFields.length >= 3 ? "grid-cols-3" : inlineFields.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
            {inlineFields.map((f, i) => (
              <div key={i}>
                <p className="text-white text-xs font-bold mb-0.5">{f.name}</p>
                <p className="text-zinc-300 text-xs">{f.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Campos bloco */}
        {blockFields.map((f, i) => (
          <div key={i} className="mt-3">
            <p className="text-white text-xs font-bold mb-0.5">{f.name}</p>
            <p className="text-zinc-300 text-xs">{f.value}</p>
          </div>
        ))}

        {/* Imagem banner */}
        {config.image_url && (
          <img src={config.image_url} alt="" className="mt-4 w-full max-h-36 object-cover rounded-md"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        )}

        {/* Footer */}
        {(config.footer_text || config.footer_icon) && (
          <div className="flex items-center gap-2 mt-4 pt-2 border-t border-zinc-600/30">
            {config.footer_icon && (
              <img src={config.footer_icon} alt="" className="w-4 h-4 rounded-full"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
            {config.footer_text && (
              <span className="text-zinc-500 text-[11px]">{config.footer_text}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
