# Puente ECG → MaindHealth (estación)

Servicio local en `http://127.0.0.1:3928`.

## Equipo

**MD100C_P** por Bluetooth LE.

- MAC fija de esta estación: `FB:1E:E4:A4:03:00`
- Comandos de activación (del script de prueba):
  - `01 00`
  - `55 AA 20 00 00 00 20`
- Entrega **frecuencia cardiaca** y una etiqueta clínica derivada (bradicardia / normal / taquicardia) para el análisis médico.

Sustituye al PC-80B USB y al flujo KardiaMobile del kiosco.

## Una sola vez

```bat
1-instalar-python-bleak.bat
```

Requiere Python 3 y el paquete `bleak`. Bluetooth de la PC encendido.

## Uso en kiosko

1. Encender el MD100C_P cerca de la estación
2. Tocar **Leer electrocardiograma**
3. Dedo en el sensor ~30 s
4. Tocar **Ya terminó**

## Arranque

Va en `tools\station-bridges`. Manual:

```bat
cd tools\ecg-bridge
node server.mjs
```

Variable opcional: `ECG_MD100C_ADDRESS` (por defecto la MAC fija de arriba).
