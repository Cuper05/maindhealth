# MaindHealth — Tabla maestra para desarrollo

| Módulo | Tabla | Prioridad | Dependencia |
|--------|-------|-----------|-------------|
| Registro de pacientes | `patients` | Alta | — |
| Expediente clínico | `clinical_records` | Alta | patients |
| Usuarios | `users` | Alta | roles |
| Roles | `roles` | Alta | — |
| Agenda médica | `appointments` | Alta | patients, users, catálogos |
| Triage / signos | `vital_signs` | Alta | patients, appointments, users |
| Teleconsulta | `consultations` | Alta | appointments, patients, users |
| Recetas | `prescriptions` | Alta | consultations |
| Detalle receta | `prescription_items` | Alta | prescriptions |
| Seguimiento | `follow_ups` | Alta | patients, consultations |
| Documentos | `clinical_documents` | Media | patients |
| Dispositivos | `medical_devices` | Media | — |
| Notificaciones | `notifications` | Media | patients, appointments |
| Bitácora | `activity_log` | Media | users |
| Integración hardware | `device_readings` | Baja | medical_devices |
| Laboratorio | `lab_results` | Baja | patients, consultations |
| Facturación | `consultation_payments` | Baja | patients, appointments |

Ver también: [MODULES.md](./MODULES.md), [DATABASE.md](./DATABASE.md), [NAVIGATION.md](./NAVIGATION.md).
