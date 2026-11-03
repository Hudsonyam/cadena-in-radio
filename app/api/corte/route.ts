import { NextResponse } from "next/server";
import { DefaultAzureCredential } from "@azure/identity";

type Section = "Puebla" | "México" | "Internacionales" | "Espectáculos" | "Clima" | "Deportes";
type NewsItem = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  section: Section;
};

const MAX_WORDS = 130;
const DEFAULT_AGENT_ENDPOINT = "https://yamilm-ia-7643-resource.services.ai.azure.com/api/projects/yamilm-ia-7643/agents/Agente-de-noticias-a-la-hora/endpoint/protocols/openai/responses?api-version=v1";
const TOKEN_SCOPE = "https://ai.azure.com/.default";
const azureCredential = new DefaultAzureCredential();
const FEEDS: { section: Section; query: string }[] = [
  { section: "Puebla", query: "noticias Puebla" },
  { section: "México", query: "noticias México" },
  { section: "Internacionales", query: "noticias internacionales mundo" },
  { section: "Espectáculos", query: "espectáculos entretenimiento México" },
  { section: "Clima", query: "clima Puebla pronóstico del tiempo" },
  { section: "Deportes", query: "deportes Puebla México" },
];
const FEED_ENV: Record<Section, string> = {
  Puebla: "NEWS_RSS_PUEBLA",
  México: "NEWS_RSS_MEXICO",
  Internacionales: "NEWS_RSS_INTERNACIONALES",
  "Espectáculos": "NEWS_RSS_ESPECTACULOS",
  Clima: "NEWS_RSS_CLIMA",
  Deportes: "NEWS_RSS_DEPORTES",
};

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function readTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]).trim() : "";
}

function trimToWords(text: string, maxWords: number) {
  const cleanText = text
    .replace(/\*\*/g, "")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const words = cleanText.split(/\s+/);
  let limitedText = cleanText;
  if (words.length > maxWords) {
    limitedText = words.slice(0, maxWords).join(" ").replace(/[,;:–-]+$/, "");
    if (!/[.!?…]$/.test(limitedText)) limitedText += "…";
  }

  return limitedText
    .split(/\n\s*\n/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡])/u))
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .join("\n\n");
}

async function getFeed(section: Section, query: string): Promise<NewsItem[]> {
  const customFeed = process.env[FEED_ENV[section]];
  const url = customFeed || `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=es-419&gl=MX&ceid=MX:es-419`;
  const response = await fetch(url, {
    headers: { "User-Agent": "InformeALaHoraNewsroom/1.0", Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(9000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`El feed de ${section} respondió ${response.status}.`);
  const xml = await response.text();
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)]
    .slice(0, 7)
    .map((match) => {
      const item = match[1];
      const title = readTag(item, "title");
      const url = readTag(item, "link");
      const published = readTag(item, "pubDate");
      const source = readTag(item, "source") || "Google Noticias";
      return { title, url, source, publishedAt: published ? new Date(published).toISOString() : new Date().toISOString(), section };
    })
    .filter((item) => item.title && item.url && /^https?:\/\//i.test(item.url));
}

function getResponseText(payload: { output_text?: unknown; output?: unknown }) {
  if (typeof payload.output_text === "string") return payload.output_text.trim();
  if (!Array.isArray(payload.output)) return "";
  return payload.output
    .flatMap((item) => {
      if (!item || typeof item !== "object" || !Array.isArray((item as { content?: unknown }).content)) return [];
      return (item as { content: unknown[] }).content.flatMap((part) => {
        if (!part || typeof part !== "object") return [];
        const content = part as { type?: unknown; text?: unknown };
        return content.type === "output_text" && typeof content.text === "string" ? [content.text] : [];
      });
    })
    .join("\n")
    .trim();
}

function getAgentRequestUrl(endpoint: string) {
  const url = new URL(endpoint);
  if (!url.searchParams.has("api-version")) url.searchParams.set("api-version", "v1");
  return url;
}

export async function POST(request: Request) {
  const agentEndpoint = process.env.FOUNDRY_AGENT_ENDPOINT || DEFAULT_AGENT_ENDPOINT;

  try {
    const body = await request.json().catch(() => ({}));
    const focus = typeof body.focus === "string" ? body.focus.trim().slice(0, 100) : "Lo más relevante de la hora";
    const results = await Promise.allSettled(FEEDS.map(({ section, query }) => getFeed(section, query)));
    const stories = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    if (stories.length < 3) {
      const failures = results.filter((result) => result.status === "rejected").length;
      return NextResponse.json(
        { error: failures === FEEDS.length ? "No se pudo acceder a las fuentes RSS. Revisa tu conexión o configura feeds alternativos." : "Hay muy pocos titulares disponibles para preparar un corte confiable. Intenta de nuevo en unos minutos." },
        { status: 502 },
      );
    }

    const newsContext = stories.map((story, index) => `${index + 1}. [${story.section}] ${story.title} — Fuente: ${story.source} — Publicado: ${story.publishedAt} — URL: ${story.url}`).join("\n");
    const prompt = `Redacta un corte informativo para radio en español mexicano natural, claro y neutral. Usa exclusivamente hechos respaldados por los titulares; no inventes ni completes información. Parafrasea las noticias y selecciona las 4 o 5 más relevantes para la audiencia, priorizando Puebla y su zona metropolitana; incluye noticias de México, internacionales, espectáculos, clima y deportes solo cuando haya información pertinente y fiable. Omite las categorías sin noticias útiles. Para clima, menciona únicamente pronósticos expresos en los titulares.\n\nFORMATO OBLIGATORIO: entrega únicamente el texto de las noticias, con una noticia por párrafo, separadas por una línea en blanco, igual que un boletín leído al aire. Cada párrafo debe ser una o dos oraciones completas, directas y autocontenidas. No pongas saludo ni despedida, encabezados, nombres de secciones, viñetas, números, títulos, fuentes, enlaces ni comentarios. No unas todas las notas en un solo párrafo. Máximo 115 palabras en total para que el corte no exceda 1 minuto con 10 segundos.\n\nEnfoque editorial: ${focus || "Lo más relevante de la hora"}.\n\nTitulares recientes consultados:\n${newsContext}`;
    const accessToken = await azureCredential.getToken(TOKEN_SCOPE);
    if (!accessToken) {
      return NextResponse.json({ error: "Microsoft Entra no entregó un token. Inicia sesión con Azure CLI (`az login`) y vuelve a intentar." }, { status: 503 });
    }

    const aiResponse = await fetch(getAgentRequestUrl(agentEndpoint), {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken.token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({ input: prompt }),
    });

    if (!aiResponse.ok) {
      const detail = await aiResponse.text();
      console.error("AI provider error", aiResponse.status, detail.slice(0, 500));
      const error = aiResponse.status === 401 || aiResponse.status === 403
        ? `Microsoft Foundry respondió ${aiResponse.status}. Ejecuta az login y confirma que tu usuario tenga el rol Foundry Agent Consumer en el proyecto o agente.`
        : `Microsoft Foundry respondió ${aiResponse.status}. Revisa la disponibilidad del endpoint del agente.`;
      return NextResponse.json({ error }, { status: 502 });
    }

    const payload = await aiResponse.json() as { output_text?: unknown; output?: unknown };
    const script = getResponseText(payload);
    if (typeof script !== "string" || script.length === 0) {
      return NextResponse.json({ error: "El agente no devolvió texto en la respuesta. Revisa su configuración y protocolo Responses." }, { status: 502 });
    }

    return NextResponse.json({ script: trimToWords(script, MAX_WORDS), stories, generatedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    console.error("Cut generation error", message);
    const authError = /credential|az login|authentication/i.test(message);
    return NextResponse.json({ error: authError ? "No se pudo autenticar en Microsoft Entra. Ejecuta az login en la terminal y vuelve a intentar." : "No se pudo completar el corte. Comprueba tu conexión, las fuentes y el endpoint del agente." }, { status: 500 });
  }
}
