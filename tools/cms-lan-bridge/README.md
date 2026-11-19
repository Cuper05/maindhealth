# Monitor de signos vitales → MaindHealth (Ethernet)

El USB de estos monitores es para pendrive. Los datos salen por **RJ45**.

Servicio local: `http://127.0.0.1:3932`

## Una vez

1. Cable del monitor al puerto Ethernet de la torre (100 Mbps).
2. Doble clic en **`1-configurar-ethernet.bat`** (administrador). Asigna `202.114.4.119` y `202.114.4.120`.
3. En el monitor: **SYSTEM MENU → NET CONFIG → NET TYPE = CMS**.
   - Si solo hay CUSTOM: SERVER IP `202.114.4.119`, IP del monitor `202.114.4.20`, máscara `255.255.255.0`.
4. El puente arranca con `station-bridges` (puerto 3932).

## Lectura

El kiosko **ya no** usa este bridge para SpO₂ ni presión arterial.

- **SpO₂** = CMS50D+ USB (`tools/cms50dplus-bridge`, `:3927`)
- **Presión** = U90B Pro BLE (`tools/u90b-bridge`, `:3931`)

`/read?kind=spo2` y `/read?kind=nibp` responden error a propósito.
