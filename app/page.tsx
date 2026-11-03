"use client";

import { useMemo, useState } from "react";

type Section = "Puebla" | "México" | "Internacionales" | "Espectáculos" | "Clima" | "Deportes";
type NewsItem = { title: string; url: string; source: string; publishedAt: string; section: Section };
type Cut = { script: string; stories: NewsItem[]; generatedAt: string };
const sections: Section[] = ["Puebla", "México", "Internacionales", "Espectáculos", "Clima", "Deportes"];

function countWords(text: string) { return text.trim() ? text.trim().split(/\s+/).length : 0; }
function formatTime(date: string) { return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(new Date(date)); }

export default function Home() {
  const [cut, setCut] = useState<Cut | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focus, setFocus] = useState("Lo más relevante de la hora");
  const [copied, setCopied] = useState(false);
  const wordCount = useMemo(() => countWords(cut?.script ?? ""), [cut]);
  const duration = Math.ceil((wordCount / 125) * 60);

  async function generateCut() {
    setLoading(true); setError(""); setCopied(false);
    try {
      const response = await fetch("/api/corte", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ focus }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo generar el corte.");
      setCut(result as Cut);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Ocurrió un error inesperado."); }
    finally { setLoading(false); }
  }

  async function copyScript() {
    if (!cut) return;
    await navigator.clipboard.writeText(cut.script); setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadScript() {
    if (!cut) return;
    const body = `${cut.script}\n\nFuentes consultadas:\n${cut.stories.map((story) => `• ${story.title} — ${story.source}: ${story.url}`).join("\n")}`;
    const file = new Blob([body], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(file); link.download = `corte-radio-${new Date().toISOString().slice(0, 10)}.txt`; link.click(); URL.revokeObjectURL(link.href);
  }

  const storiesBySection = sections.map((section) => ({ section, stories: cut?.stories.filter((story) => story.section === section) ?? [] }));

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#inicio" aria-label="Cadena IN, inicio"><span className="brand-text">CADENA <strong>IN</strong></span></a>
        <div className="station-chip"><span className="live-dot" /> CABINA DE NOTICIAS</div>
        <nav className="side-nav" aria-label="Navegación principal"><a className="nav-item active" href="#inicio"><span className="nav-icon">◫</span> Generador de cortes</a><a className="nav-item" href="#fuentes"><span className="nav-icon">◎</span> Fuentes de noticias</a></nav>
        <div className="sidebar-bottom"><div className="sidebar-note"><span className="note-icon">✳</span><div><strong>Listo para salir al aire</strong><small>Guiones breves, claros y con fuentes.</small></div></div><div className="profile"><div className="avatar">CI</div><div><strong>Redacción</strong><small>Cadena IN</small></div><span className="profile-dots">···</span></div></div>
      </aside>

      <section className="main-area" id="inicio">
        <header className="topbar"><div className="breadcrumb">Producción <span>/</span> <strong>Corte informativo</strong></div><div className="topbar-right"><span className="clock-icon">◷</span><span>Edición en vivo</span><span className="topbar-avatar">CI</span></div></header>
        <div className="content-wrap">
          <section className="welcome-row"><div><div className="eyebrow"><span className="live-dot" /> ESTUDIO DE NOTICIAS</div><h1>INFORME A LA HORA</h1><p className="lead">Puebla, México, Internacionales, Espectáculos, Clima y Deportes en un solo corte.</p></div><div className="duration-badge"><span className="duration-icon">◷</span><div><small>DURACIÓN MÁXIMA</small><strong>01:10 <i>min</i></strong></div></div></section>

          <div className="workspace-grid">
            <section className="panel generator-panel"><div className="panel-heading"><div><div className="section-label">NUEVO CORTE</div></div><span className="auto-tag"><span className="sparkle">✳</span> ASISTIDO POR IA</span></div><p className="panel-copy">Revisamos titulares recientes y los convertimos en un guion listo para locución.</p>
              <label className="field-label" htmlFor="focus">Enfoque editorial <span>OPCIONAL</span></label><input id="focus" className="focus-input" value={focus} onChange={(event) => setFocus(event.target.value)} maxLength={100} placeholder="Ej. seguridad vial, servicio a la comunidad…" />
              <div className="coverage-row"><span className="field-label">SECCIONES</span><div className="coverage-chips"><span><i className="pin-dot puebla" />Puebla</span><span><i className="pin-dot mexico" />México</span><span><i className="pin-dot international" />Internacionales</span><span><i className="pin-dot entertainment" />Espectáculos</span><span><i className="pin-dot weather" />Clima</span><span><i className="pin-dot sports" />Deportes</span></div></div>
              <button className="generate-button" onClick={generateCut} disabled={loading}>{loading ? <><span className="spinner" /> Preparando tu corte…</> : <><span className="button-sparkle">✳</span> Generar corte informativo <span className="button-arrow">→</span></>}</button>
              <div className="button-caption"><span className="lock-icon">♧</span> La IA resume titulares y conserva sus fuentes para verificación.</div>
              {error && <div className="error-box" role="alert"><strong>No se pudo generar el corte.</strong><p>{error}</p></div>}{!cut && !error && <div className="empty-hint"><span>↳</span> Tu guion y sus fuentes aparecerán aquí.</div>}
            </section>

            <section className="panel rundown-panel" aria-live="polite"><div className="panel-heading rundown-heading"><div><div className="section-label">VISTA PREVIA</div><h2>Guion de locución</h2></div>{cut && <span className="ready-status"><i /> LISTO</span>}</div>
              {cut ? <><div className="script-meta"><span><i className="meta-clock">◷</i> {formatTime(cut.generatedAt)} hrs</span><span className="meta-separator">·</span><span>{wordCount} palabras</span><span className="meta-separator">·</span><span>{duration} seg aprox.</span></div><div className="script-paper"><div className="script-mark">EN VIVO <span>●</span></div><p>{cut.script}</p></div><div className="timing-row"><div className="timing-label"><span>TIEMPO ESTIMADO</span><strong>{String(Math.floor(duration / 60)).padStart(2, "0")}:{String(duration % 60).padStart(2, "0")} <small>/ 01:10</small></strong></div><div className="progress-track"><span style={{ width: `${Math.min(100, (duration / 70) * 100)}%` }} /></div><div className="safe-label"><i /> EN TIEMPO</div></div><div className="script-actions"><button className="secondary-button" onClick={copyScript}>{copied ? "✓ Copiado" : "▢ Copiar guion"}</button><button className="secondary-button" onClick={downloadScript}>↓ Descargar .txt</button><button className="regenerate-button" onClick={generateCut} disabled={loading} aria-label="Generar otro corte">↻</button></div></> : <div className="preview-empty"><div className="waveform">{Array.from({ length: 19 }, (_, index) => <i key={index} />)}</div><span className="preview-empty-icon">✳</span><strong>El espacio de tu próxima historia</strong><p>Genera un corte para ver el guion, el tiempo estimado y las fuentes consultadas.</p><div className="preview-time">OBJETIVO: MENOS DE 01:10</div></div>}
            </section>
          </div>

          {cut && <section className="sources-section" id="fuentes"><div className="sources-title"><div><div className="section-label">CONTEXTO EDITORIAL</div><h2>Fuentes consultadas</h2></div><span className="source-count">{cut.stories.length} titulares</span></div><div className="source-grid">{storiesBySection.map(({ section, stories }) => <article className="source-card" key={section}><div className="source-card-head"><span className={`source-category ${section === "Puebla" ? "local" : section === "México" ? "national" : section === "Internacionales" ? "global" : section === "Espectáculos" ? "entertainment" : section === "Clima" ? "weather" : "sports"}`}>{section}</span><span>{stories.length} notas</span></div>{stories.length ? stories.slice(0, 3).map((story, index) => <a className="story-link" href={story.url} target="_blank" rel="noreferrer" key={`${story.url}-${index}`}><span>{story.title}</span><small>{story.source} ↗</small></a>) : <p className="no-stories">Sin titulares disponibles para esta sección.</p>}</article>)}</div><p className="editorial-note"><span>ⓘ</span> Verifica la información y los datos sensibles antes de transmitir. Los titulares pueden actualizarse durante el día.</p></section>}
          <footer className="page-footer"><span>CADENA IN <i>·</i> HERRAMIENTA DE PRODUCCIÓN</span><span>Información para la comunidad, con responsabilidad.</span></footer>
        </div>
      </section>
    </main>
  );
}
