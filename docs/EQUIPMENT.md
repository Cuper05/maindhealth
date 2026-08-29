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

**Clínico:** baumanómetro USB **BP-700 / CP2110 TU0-700X** (cable puesto; la PC silencia el USB al medir; bridge `tools/bp700-bridge` en `127.0.0.1:3931`), oxímetro CMS50D+ (`COM4`, `:3927`), termómetro, báscula+altura **Lejia HW-701** (`COM5`, `:3930`), ECG **PC-80B** (disco `EASY ECG`, `:3928`), glucómetro.

**Tecnológico:** cámara, bocina fija, micrófono fijo, pantalla, computadora, conectividad estable.

## D. Inventario en sistema (Fase 2)

Tabla `medical_devices` + catálogo `catalog_device_types`.  
Fase 3: `device_readings` para lectura automática.

## E. Opcionales / especialidad (futuro)

Estetoscopio digital, otoscopio, dermatoscopio, monitor multiparámetro, etc.

**Nota ECG:** Equipo de estación = **PC-80B** (USB + PC). AliveCor KardiaMobile (AC-009) no aplica al kiosko (solo app móvil).
