# Informe a la hora — generador de cortes

Aplicación web para preparar cortes de noticias breves para locución, con secciones de Puebla, México, Internacionales, Espectáculos, Clima y Deportes. Obtiene titulares desde feeds RSS, los envía al agente Responses de Microsoft Foundry y limita la salida a 130 palabras para dejar margen respecto al máximo de 1 minuto con 10 segundos.

## Requisitos

- Node.js 20.9 o posterior.
- Acceso a Microsoft Foundry y al agente Agente-de-noticias-a-la-hora.
- Azure CLI instalado, con sesión iniciada, y permiso **Foundry Agent Consumer** para invocar el agente.
- Acceso a internet para consultar los RSS y el endpoint de Microsoft Foundry.

## Configuración en Windows

1. Abre la carpeta `radio-puebla` en VS Code.
2. Copia `.env.example` como `.env.local`. El endpoint de tu agente ya está indicado; puedes cambiarlo con `FOUNDRY_AGENT_ENDPOINT` si cambia en Azure.
3. En la terminal, inicia sesión en Azure con `az login`. El usuario debe tener el rol **Foundry Agent Consumer** (o un rol con permiso de invocación) en el proyecto o agente.
4. Instala dependencias y levanta el sitio con `npm.cmd install` y `npm.cmd run dev`.
5. Abre `http://localhost:3000` y pulsa **Generar corte informativo**.

## Probarlo en otra computadora

La forma recomendada es guardar el código en un repositorio **privado** de GitHub. No se ha configurado un remoto de GitHub para este proyecto todavía. Al crear el repositorio, no subas `.env.local`, contraseñas ni tokens: `.gitignore` ya excluye ese archivo y `.env.example` contiene solo la configuración no secreta del endpoint.

En la otra computadora se necesita:

- Windows, Git, Node.js 20.9 o posterior y Azure CLI.
- Acceso de GitHub al repositorio privado.
- Una cuenta de Azure autorizada para invocar el agente, con rol **Foundry Agent Consumer** en el ámbito correspondiente.

Después de clonar el repositorio:

1. Abre la carpeta del proyecto en VS Code y abre una terminal PowerShell.
2. Copia `.env.example` a `.env.local` (por ejemplo, con `Copy-Item .env.example .env.local`).
3. Inicia sesión en Azure con `az login` o `az login --use-device-code` y completa la autenticación en el navegador.
4. Ejecuta `npm.cmd install` y luego `npm.cmd run dev`.
5. Abre `http://localhost:3000` y genera un corte de prueba.

La sesión de Azure no se copia entre computadoras: cada persona inicia sesión con su propia cuenta autorizada. Como alternativa a GitHub, se puede copiar la carpeta del proyecto sin `node_modules`, `.next` ni `.env.local`; en la otra máquina se instala con npm y se autentica en Azure del mismo modo.

La aplicación invoca el endpoint **Responses** que compartiste con `api-version=v1`. El agente debe entregar una noticia por párrafo, sin encabezados ni viñetas, como boletín de locución. La autenticación se realiza en el servidor con Microsoft Entra mediante Azure CLI (`DefaultAzureCredential`); no necesita clave API y el token no se expone al navegador. Si Azure responde 403, solicita que te asignen el rol **Foundry Agent Consumer** en el ámbito correcto.

## Fuentes

Por defecto consulta Google Noticias RSS con búsquedas en español para las seis secciones: Puebla, México, Internacionales, Espectáculos, Clima y Deportes. Se pueden sustituir por feeds RSS propios mediante `NEWS_RSS_PUEBLA`, `NEWS_RSS_MEXICO`, `NEWS_RSS_INTERNACIONALES`, `NEWS_RSS_ESPECTACULOS`, `NEWS_RSS_CLIMA` y `NEWS_RSS_DEPORTES`. El guion muestra enlaces a los titulares para que la redacción pueda verificar cada nota antes de salir al aire.

## Uso editorial

La aplicación es una ayuda para la redacción, no una fuente periodística autónoma. Comprueba cifras, nombres, fechas y noticias en desarrollo con las fuentes enlazadas antes de transmitir. La duración real depende de la velocidad de locución; el objetivo de 130 palabras busca mantener margen por debajo de 70 segundos a un ritmo normal.
