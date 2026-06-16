# MaindHealth — Equipos y dispositivos

## A. Equipo clínico (idea original)

| Equipo | Módulo |
|--------|--------|
| Baumanómetro | `vital_signs` |
| Oxímetro | `vital_signs` |
| Termómetro | `vital_signs` |
| Báscula digital | `vital_signs` |
| Medidor de altura digital | `vital_signs` |
| Medidor de glucosa | `vital_signs` |
| Pantalla de síntomas | Triage UI |

## B. Equipo tecnológico (ampliación)

| Equipo | Módulo |
|--------|--------|
| Cámara HD | Teleconsulta |
| Micrófono | Teleconsulta |
| Pantalla principal | Teleconsulta |
| Computadora / terminal clínica | Sistema |
| Tablet clínica | Triage / captura |
| Router / conectividad | Infraestructura |
| UPS | Continuidad |
| Impresora / escáner | Recetas, documentos |

## C. Paquete mínimo de arranque

**Clínico:** baumanómetro, oxímetro, termómetro, báscula, medidor de altura, glucómetro.

**Tecnológico:** cámara, micrófono, pantalla, computadora, conectividad estable.

## D. Inventario en sistema (Fase 2)

Tabla `medical_devices` + catálogo `catalog_device_types`.  
Fase 3: `device_readings` para lectura automática.

## E. Opcionales / especialidad (futuro)

Estetoscopio digital, ECG portátil, otoscopio, dermatoscopio, monitor multiparámetro, etc.
