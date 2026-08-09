# Puente CONTEC CMS50D+ → MaindHealth

Envía SpO₂ y pulso por USB a `POST /api/device-readings/ingest`.

## 1. Driver USB (obligatorio)

1. Conecta el **CMS50D+** por USB y **enciéndelo**.
2. Instala el driver **Silicon Labs CP210x**:
   - https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers
3. En Windows → Administrador de dispositivos debe aparecer un puerto **COMx** (USB Serial / CP210x).
4. El oxímetro debe tener el mismo **número de serie** en MaindHealth (`/dispositivos`), ej. `22040300012`.

## 2. Instalar el puente

```powershell
cd C:\Users\telem\Documents\maindhealth\tools\cms50dplus-bridge
npm install
```

## 3. Probar

Listar puertos:

```powershell
npm run ports
```

Simular envío a producción (sin oxímetro):

```powershell
npm run simulate
```

Lectura real (ponte el dedo, espera ~5–15 s):

```powershell
npm run once
```

Forzar puerto:

```powershell
$env:CMS50_PORT="COM4"
npm run once
```

Con paciente (para triage):

```powershell
$env:PATIENT_ID="1"
npm run once
```

## 4. Variables

| Variable | Descripción |
|----------|-------------|
| `DEVICE_INGEST_API_KEY` | Se lee también de `Documents\maindhealth-device-ingest-key.txt` |
| `MAINHEALTH_API_URL` | Default `https://health.maindsteel.com.mx` |
| `DEVICE_SERIAL` | Default `22040300012` |
| `CMS50_PORT` | Ej. `COM4` |
| `CMS50_BAUD` | Default `115200` (prueba `19200` si falla) |

## Nota

El CMS50D+ es **spot-check** (medición puntual), no monitoreo continuo. El puente toma una lectura estable y la envía.
