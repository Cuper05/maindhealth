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

El kiosko espera SpO₂, NIBP y temperatura del flujo HL7/CMS. NIBP solo aparece después de pulsar Start en el monitor.
