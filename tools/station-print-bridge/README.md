# Impresión silenciosa — estación MaindHealth

Evita la ventana **Guardar archivo** que aparece cuando Windows usa
**Microsoft Print to PDF**.

El kiosko envía el PDF a `http://127.0.0.1:3929/print` y este servicio lo
manda directo a la **impresora física**.

## 1. Instalar

```powershell
cd C:\Users\telem\Documents\maindhealth\tools\station-print-bridge
npm install
```

## 2. Ver impresoras

```powershell
npm run printers
```

Anota el **nombre exacto** de la impresora física (no “Microsoft Print to PDF”).

## 3. Arrancar

Doble clic en `iniciar-servicio-impresora.bat`

Opcional (recomendado): en el `.bat` o en el entorno:

```bat
set STATION_PRINTER=Nombre Exacto De La Impresora
```

## 4. Probar salud

Abre en el navegador: http://127.0.0.1:3929/health

## Junto al oxímetro

Deja este servicio corriendo en la Lenovo (como `iniciar-servicio-oximetro.bat`).
Puedes crear un acceso directo en Inicio de Windows.
