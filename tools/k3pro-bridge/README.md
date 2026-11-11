# Puente termómetro K3 Pro → MaindHealth

Servicio local en `http://127.0.0.1:3933`.

## Equipo

**K3 Pro** (termómetro infrarrojo de frente, USB serial).

- Puerto: `COM8`
- Baudios: `115200`
- Solo se guarda la **última** línea `T body = XX.X C` (modo corporal).

Sustituye al Beurer FT95 Bluetooth.

## Una sola vez

```bat
python -m pip install -r requirements.txt
```

(o el Python ya usado para el ECG / bleak).

## Uso en kiosko

1. Encender el K3 Pro
2. En el kiosco: **Leer temperatura ahora**
3. Acercar la frente a 5–10 cm hasta el pitido
4. El kiosco toma solo la temperatura corporal

## Arranque

Va en `tools\station-bridges`. Manual:

```bat
cd tools\k3pro-bridge
node server.mjs
```

Variables: `K3PRO_PORT`, `K3PRO_BAUD`, `K3PRO_BRIDGE_PORT`.
