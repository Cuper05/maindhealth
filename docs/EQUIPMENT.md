# MaindHealth — Equipos y dispositivos

## A. Equipo clínico (idea original)

| Equipo | Módulo |
|--------|--------|
| Baumanómetro | `vital_signs` |
| Oxímetro | `vital_signs` |
| Termómetro | `vital_signs` |
| Báscula digital | `vital_signs` |
| Medidor de altura digital | `vital_signs` |
| Electrocardiograma USB **Lepu/Creative PC-80B** (1 canal, de mano) | `vital_signs` / kiosko paso `ecg` + `tools/ecg-bridge` |
| Medidor de glucosa | `vital_signs` |
| Pantalla de síntomas | Triage UI |

## B. Equipo tecnológico (ampliación)

| Equipo | Módulo |
|--------|--------|
| Cámara HD | Teleconsulta |
| Bocina fija de estación | Guía por voz + teleconsulta (higiene e inclusión; sin audífonos) |
| Micrófono fijo | Teleconsulta / voz del paciente |
| Pantalla principal | Teleconsulta |
| Computadora / terminal clínica | Sistema |
| Tablet clínica | Triage / captura |
| Router / conectividad | Infraestructura |
| UPS | Continuidad |
| Impresora / escáner | Recetas, documentos |

## C. Paquete mínimo de arranque

**Clínico:** tensiómetro **U90B Pro** por Bluetooth LE (bridge `tools/u90b-bridge` en `127.0.0.1:3931`, MAC `23:51:D6:CE:70:BB`), oxímetro **CMS50D+** USB (`:3927`, única fuente de SpO₂), ECG **MD100C_P** BLE (`:3928`), báscula+altura **Lejia HW-701** (`:3930`), termómetro **K3 Pro** (`:3933`).

**Tecnológico:** cámara, bocina fija, micrófono fijo, pantalla, computadora, conectividad estable.

## D. Inventario en sistema (Fase 2)

Tabla `medical_devices` + catálogo `catalog_device_types`.  
Fase 3: `device_readings` para lectura automática.

## E. Opcionales / especialidad (futuro)

Estetoscopio digital, otoscopio, dermatoscopio, monitor multiparámetro, etc.

**Nota ECG:** Equipo de estación = **PC-80B** (USB + PC). AliveCor KardiaMobile (AC-009) no aplica al kiosko (solo app móvil).
