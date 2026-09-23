# Bridge báscula Lejia HW-701

Cable: **RS232 en la báscula → USB (CH340) en la PC** → `COMx`.

## Protocolo

- **4800** 8N1 ASCII  
- Ejemplo: `LJid7024103001$LJTime260816052535$q0$W08710$H1585$b347$Y$`  
  - `W08710` → **87.10 kg** (/100)  
  - `H1585` → **158.5 cm** (/10)  
  - `b347` → **IMC 34.7** (/10)

## Uso en estación

1. `listar-puertos.bat` → confirma COM (p. ej. COM5).
2. Ajusta `HW701_PORT` en `iniciar-servicio-bascula.bat`.
3. Deja abierto `iniciar-servicio-bascula.bat` → `http://127.0.0.1:3930`
4. En el kiosko: **Leer báscula ahora**.
