# Puente ECG → MaindHealth (estación)

Servicio local en `http://127.0.0.1:3928`.

## Equipo

**MD100C_P** por Bluetooth LE.

- MAC fija de esta estación: `FB:1E:E4:A4:03:00`
- Comandos de activación (del script de prueba / `ecg.py`):
  - `01 00`
  - `55 AA 20 00 00 00 20`
- Entrega la **onda en vivo** (`wave` en `GET /progress`) para el trazado del kiosko.
- **No** entrega frecuencia cardiaca: los **lpm** los toma el oxímetro CMS50D+.

### Decodificación de onda (ChoiceMMed / `ecg.py`)

1. Trama `0x01` de 16 bytes: **5 muestras** `[LO, HI, FLAG]` → `amplitud = LO | (HI<<8)`.
   - Leer byte a byte generaba diente de sierra (HI≈0, FLAG≈1).
2. Fallback `ecg.py`: `len >= 4` y `30 <= data[3] <= 200` → un punto.
3. El kiosko dibuja las muestras uint16 en papel ECG (rosa); solo interpola si llegan pocos puntos.

## Una sola vez

```bat
1-instalar-python-bleak.bat
```

Requiere Python 3 y el paquete `bleak`. Bluetooth de la PC encendido.

## Uso en kiosko

1. Encender el MD100C_P cerca de la estación
2. Tocar **Leer electrocardiograma**
3. Dedos en las placas ~30 s (ver onda en pantalla)
4. Tocar **Ya terminó**

## Arranque

Va en `tools\station-bridges`. Manual:

```bat
cd tools\ecg-bridge
node server.mjs
```

Variable opcional: `ECG_MD100C_ADDRESS` (por defecto la MAC fija de arriba).
