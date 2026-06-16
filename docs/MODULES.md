# MaindHealth — Matriz de módulos

## Prioridad alta (MVP — Fase 1)

| Módulo | Tabla principal | Función |
|--------|-----------------|---------|
| Registro de pacientes | `patients` | Alta y control de pacientes |
| Expediente clínico | `clinical_records` | Historial médico base |
| Triage y signos vitales | `vital_signs` | PA, temp, SpO2, peso, etc. |
| Agenda médica | `appointments` | Citas, horarios, reprogramación |
| Teleconsulta / consulta | `consultations` | Nota clínica + videollamada |
| Recetas | `prescriptions` + `prescription_items` | Indicaciones medicamentos |
| Usuarios y roles | `users` + `roles` | Control de acceso |
| Seguimiento | `follow_ups` | Evolución y próxima revisión |

## Prioridad media (Fase 2)

| Módulo | Tabla |
|--------|-------|
| Documentos clínicos | `clinical_documents` |
| Control de dispositivos | `medical_devices` |
| Reportes | vistas / queries |
| Catálogos extendidos | `catalog_*` |
| Notificaciones | `notifications` |
| Bitácora | `activity_log` |
| Portal paciente | UI sobre tablas existentes |

## Prioridad baja (Fase 3)

Integración automática con dispositivos, firma digital, prescripción electrónica avanzada, alertas clínicas IA, laboratorio, facturación, analítica avanzada.

## Bloques de construcción

1. **Clínico** — pacientes, expediente, signos, consultas, recetas, seguimiento  
2. **Operativo** — agenda, usuarios, documentos, reportes, dispositivos  
3. **Tecnológico** — videollamada, hardware, conectividad, trazabilidad

## Orden de desarrollo

Ver [ROADMAP.md](./ROADMAP.md).
