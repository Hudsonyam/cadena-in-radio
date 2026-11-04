import { DefaultAzureCredential } from "@azure/identity";
import { NextResponse } from "next/server";

const TOKEN_SCOPE = "https://cognitiveservices.azure.com/.default";
const VOICE_NAME = "es-MX-DaliaNeural";
const MAX_SCRIPT_LENGTH = 4000;
const azureCredential = new DefaultAzureCredential();

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function POST(request: Request) {
  const endpoint = process.env.SPEECH_RESOURCE_ENDPOINT;
  const resourceId = process.env.SPEECH_RESOURCE_ID;
  if (!endpoint || !resourceId) {
    return NextResponse.json(
      { error: "Configura SPEECH_RESOURCE_ENDPOINT y SPEECH_RESOURCE_ID para generar audio." },
      { status: 503 },
    );
  }

  let endpointUrl: URL;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    return NextResponse.json({ error: "SPEECH_RESOURCE_ENDPOINT no es una URL válida." }, { status: 500 });
  }
  if (endpointUrl.protocol !== "https:") {
    return NextResponse.json({ error: "El endpoint de Speech debe usar HTTPS." }, { status: 500 });
  }

  const body = await request.json().catch(() => null) as { script?: unknown } | null;
  if (!body || typeof body.script !== "string" || !body.script.trim()) {
    return NextResponse.json({ error: "Envía el guion que quieres convertir a audio." }, { status: 400 });
  }
  if (body.script.length > MAX_SCRIPT_LENGTH) {
    return NextResponse.json({ error: "El guion es demasiado largo para generar el audio." }, { status: 400 });
  }

  try {
    const token = await azureCredential.getToken(TOKEN_SCOPE);
    if (!token) {
      return NextResponse.json({ error: "Microsoft Entra no entregó un token para Azure Speech." }, { status: 503 });
    }

    const speechUrl = new URL("/tts/cognitiveservices/v1", endpointUrl);
    const speechResponse = await fetch(speechUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer aad#${resourceId}#${token.token}`,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "CadenaIN-Newsroom/1.0",
      },
      body: `<speak version="1.0" xml:lang="es-MX"><voice name="${VOICE_NAME}">${escapeXml(body.script.trim())}</voice></speak>`,
      signal: AbortSignal.timeout(60000),
      cache: "no-store",
    });

    if (!speechResponse.ok) {
      const detail = await speechResponse.text();
      console.error("Azure Speech error", speechResponse.status, detail.slice(0, 500));
      return NextResponse.json(
        { error: `Azure Speech respondió ${speechResponse.status}. Revisa la configuración y los permisos del recurso de Speech.` },
        { status: 502 },
      );
    }

    const audio = await speechResponse.arrayBuffer();
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'attachment; filename="corte-radio.mp3"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    console.error("Audio generation error", message);
    return NextResponse.json(
      { error: "No se pudo generar el audio. Comprueba la autenticación y la conexión con Azure Speech." },
      { status: 500 },
    );
  }
}
