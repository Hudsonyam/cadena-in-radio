# Informe a la hora — generador de cortes

Aplicación web para preparar cortes de noticias breves para locución, con secciones de Puebla, México, Internacionales, Espectáculos, Clima y Deportes. Obtiene titulares desde feeds RSS, los envía al agente Responses de Microsoft Foundry y limita la salida a 130 palabras para dejar margen respecto al máximo de 1 minuto con 10 segundos. Cada guion comienza con «Esto es Informe a la hora» y termina con «Soy Mariana del Río. No olviden sintonizarnos por La 96 y La Intensa».

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

## Desplegar en Azure App Service

La aplicación requiere un servidor Node.js porque genera cortes mediante rutas API de Next.js. Puede probarse en Azure App Service para Linux, nivel **Free F1**, y usar una identidad administrada para autenticarse con Microsoft Foundry y Azure Speech; no publiques `.env.local` ni credenciales de Azure. F1 usa recursos compartidos, tiene cuotas y no permite escalar horizontalmente; es adecuado para una prueba o uso ligero, no para disponibilidad o carga de producción. El nivel F1 no cobra por el plan de App Service, pero no cubre el uso de Microsoft Foundry ni otros servicios de Azure, que pueden generar cargos.

1. Instala Azure CLI, inicia sesión y selecciona la suscripción:

   ```powershell
   az login
   az account set --subscription "<id-o-nombre-de-la-suscripción>"
   ```

2. Desde la carpeta del proyecto, define un grupo de recursos y un nombre globalmente único para la aplicación. `az webapp up` crea el plan y la aplicación si aún no existen, y publica el proyecto:

   ```powershell
   $rg = "rg-radio-puebla"
   $app = "<nombre-globalmente-unico>"
   $location = "eastus2"
   az group create --name $rg --location $location
   az webapp up --name $app --resource-group $rg --location $location --runtime "NODE:24-lts" --sku F1
   ```

3. Configura el endpoint del agente y habilita la compilación durante el despliegue. Para generar MP3, agrega además el endpoint personalizado y el ID de recurso de Azure Speech:

   ```powershell
   az webapp config appsettings set --resource-group $rg --name $app --settings "FOUNDRY_AGENT_ENDPOINT=<endpoint-del-agente>" "SPEECH_RESOURCE_ENDPOINT=https://<recurso-speech>.cognitiveservices.azure.com" "SPEECH_RESOURCE_ID=<id-de-recurso-speech>" "SCM_DO_BUILD_DURING_DEPLOYMENT=true"
   az webapp config set --resource-group $rg --name $app --startup-file "npm start"
   ```

4. Habilita la identidad administrada y asígnale el rol **Foundry Agent Consumer** en el proyecto/agente de Foundry y **Cognitive Services Speech User** en el recurso Speech configurado abajo. Copia los IDs de recurso correspondientes y úsalos como ámbitos:

   ```powershell
   $principalId = az webapp identity assign --resource-group $rg --name $app --query principalId --output tsv
   az role assignment create --assignee-object-id $principalId --assignee-principal-type ServicePrincipal --role "Foundry Agent Consumer" --scope "<id-de-recurso-del-proyecto-de-Foundry>"
   az role assignment create --assignee-object-id $principalId --assignee-principal-type ServicePrincipal --role "Cognitive Services Speech User" --scope "<id-de-recurso-de-Speech>"
   ```

   La asignación de rol puede tardar unos minutos en propagarse. El principal de servicio de App Service debe tener permiso de invocación; el rol de tu cuenta personal no se hereda.

5. Vuelve a publicar después de aplicar la configuración y abre la URL que informa Azure:

   ```powershell
   az webapp up --name $app --resource-group $rg --location $location --runtime "NODE:24-lts" --sku F1
   az webapp browse --name $app --resource-group $rg
   ```

Al cambiar el endpoint o los feeds, actualiza los ajustes de aplicación en App Service y vuelve a publicar. Configura `NEWS_RSS_PUEBLA`, `NEWS_RSS_MEXICO`, `NEWS_RSS_INTERNACIONALES`, `NEWS_RSS_ESPECTACULOS`, `NEWS_RSS_CLIMA` o `NEWS_RSS_DEPORTES` solo si vas a sustituir los feeds predeterminados.

La aplicación invoca el endpoint **Responses** que compartiste con `api-version=v1`. El agente debe entregar una noticia por párrafo, sin encabezados ni viñetas, como boletín de locución. La autenticación se realiza en el servidor con Microsoft Entra mediante `DefaultAzureCredential`: Azure CLI en desarrollo local e identidad administrada en App Service. No necesita clave API y el token no se expone al navegador. Si Azure responde 403, confirma que la identidad utilizada tenga el rol **Foundry Agent Consumer** en el ámbito correcto.

## Generar audio MP3

Después de generar y revisar el corte, pulsa **Generar audio MP3** en la vista previa. El servidor convierte el texto del guion a una voz neural en español de México (`es-MX-DaliaNeural`) y descarga el archivo MP3. No se envían las fuentes ni datos adicionales al servicio de voz.

Este proyecto ya está configurado con el recurso Azure Speech `cadena-in-speech-yamilm`, en Central US, nivel gratuito F0, con dominio personalizado y autenticación de Microsoft Entra. El nivel F0 incluye hasta 500 000 caracteres al mes para voces neurales; revisa las [cuotas y precios de Speech](https://azure.microsoft.com/pricing/details/speech/) antes de ampliar el uso. El permiso **Cognitive Services Speech User** ya está asignado a la cuenta Azure local que configuró el recurso.

Los valores de `.env.local` ya apuntan al recurso configurado. En otra computadora, copia `.env.example` y sustituye los marcadores por el endpoint personalizado y el ID del recurso Speech correspondiente. Para usar audio en App Service, asigna además **Cognitive Services Speech User** a su identidad administrada. No cambies el nivel F0 a S0 sin revisar antes sus costos.

En local, inicia sesión con `az login`. Si cambias de recurso, asigna a tu usuario **Cognitive Services Speech User** sobre ese recurso. Si los ajustes se configuran en App Service, reinicia o vuelve a publicar la aplicación para aplicarlos.

## Fuentes

Por defecto consulta Google Noticias RSS con búsquedas en español para las seis secciones: Puebla, México, Internacionales, Espectáculos, Clima y Deportes. Se pueden sustituir por feeds RSS propios mediante `NEWS_RSS_PUEBLA`, `NEWS_RSS_MEXICO`, `NEWS_RSS_INTERNACIONALES`, `NEWS_RSS_ESPECTACULOS`, `NEWS_RSS_CLIMA` y `NEWS_RSS_DEPORTES`. El guion muestra enlaces a los titulares para que la redacción pueda verificar cada nota antes de salir al aire.

## Uso editorial

La aplicación es una ayuda para la redacción, no una fuente periodística autónoma. Comprueba cifras, nombres, fechas y noticias en desarrollo con las fuentes enlazadas antes de transmitir. La duración real depende de la velocidad de locución; el objetivo de 130 palabras, incluyendo apertura y cierre, busca mantener margen por debajo de 70 segundos a un ritmo normal.
