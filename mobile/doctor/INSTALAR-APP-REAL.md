# Instalar la app real de médicos (iPhone / Android)

**Esto NO es Expo Go.** Expo Go es solo para desarrollo rápido y en iPhone suele fallar (túnel, versión, permisos).  
El producto final es una **app instalable** firmada con tu cuenta Apple / Google mediante **EAS Build**.

Necesitas en la PC: Node 20+, cuenta [Expo](https://expo.dev) y, para iPhone, **Apple Developer** (la firma no se puede inventar desde el código).

---

## Camino definitivo (iPhone) — hazlo tú en la PC

Abre PowerShell o CMD:

```bat
cd C:\Users\telem\Documents\maindhealth\mobile\doctor
npm install
npm install -g eas-cli
eas login
```

### 1) Crear / vincular el proyecto Expo (obligatorio para push)

```bat
eas init
```

- Te pedirá cuenta/organización Expo.
- Al terminar verás un **Project ID** (UUID).
- Cópialo a `.env` (crea el archivo si no existe):

```env
EXPO_PUBLIC_API_URL=https://health.maindsteel.com.mx
EXPO_PUBLIC_PROJECT_ID=pega-aqui-el-uuid-de-eas-init
```

**No inventes el ID.** Sin este UUID real, el login puede funcionar pero **push no**.

También puedes verlo en: https://expo.dev → tu proyecto → Project settings → Project ID.

### 2) Build instalable iOS (recomendado: preview)

```bat
eas build --profile preview --platform ios
```

Alternativa con cliente de desarrollo (útil si luego usas Metro en la PC):

```bat
eas build --profile development --platform ios
```

La primera vez EAS pedirá credenciales Apple (Apple ID + equipo). EAS puede generar certificados y perfiles.  
Registra el UDID del iPhone cuando lo pida (perfil *ad hoc* / internal).

### 3) Instalar en el iPhone

1. Cuando el build termine, abre el enlace de Expo (o https://expo.dev → Builds).
2. Escanea el **QR** desde el iPhone (Safari del sistema está bien **solo para descargar el .ipa/instalador**, no para usar la app en el navegador).
3. Confía en el desarrollador si iOS lo pide: Ajustes → General → VPN y gestión de dispositivos.

### 4) Producción / TestFlight (opcional, más adelante)

```bat
eas build --profile production --platform ios
eas submit --platform ios
```

Luego instala desde **TestFlight**.

### 5) Probar push

1. Abre la app instalada (icono “MaindHealth Médicos”).
2. Inicia sesión (demo seed: `doctor@maindhealth.local` / `admin123` si aplica).
3. Acepta notificaciones.
4. Escala una teleconsulta desde la estación: debe llegar push al teléfono.

Si no llega push: confirma que `.env` tiene el **mismo** `EXPO_PUBLIC_PROJECT_ID` del paso 1 y vuelve a construir (`eas build`).

---

## Android (más rápido para probar sideload)

```bat
cd C:\Users\telem\Documents\maindhealth\mobile\doctor
eas login
eas init
eas build --profile preview --platform android
```

- Perfil `preview` genera **APK**.
- Descarga desde la página del build en expo.dev e instálalo en el teléfono (permitir orígenes desconocidos si hace falta).
- Mismo `.env` con `EXPO_PUBLIC_PROJECT_ID` real.

---

## Identificadores ya configurados en el repo

| Plataforma | ID |
|------------|-----|
| iOS bundle | `mx.com.maindsteel.maindhealth.doctor` |
| Android package | `mx.com.maindsteel.maindhealth.doctor` |
| Slug Expo | `maindhealth-doctor` |

Archivo de builds: `eas.json` (perfiles `development`, `preview`, `production`).

---

## Metro local (solo si ya instalaste un development build)

Si usaste `--profile development`, en la PC puedes arrancar el bundler con:

```bat
iniciar-app-medico.bat
```

Eso **no sustituye** el instalador EAS. Sin app nativa instalada, no es el camino del producto.

---

## Qué NO hacer

- No uses Expo Go como método de entrega al médico.
- No abras la app médica en Safari como “versión web”.
- No inventes un `EXPO_PUBLIC_PROJECT_ID`: sale de `eas init` / expo.dev.
