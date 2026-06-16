# MaindHealth — Base de datos (MVP Fase 1)

Esquema alineado con la especificación del teleconsultorio. Drizzle aplica cambios con `npm run db:push`.

## Tablas Fase 1

| Módulo | Tabla | Campos clave |
|--------|-------|--------------|
| Roles | `roles` | code, name, description |
| Usuarios | `users` | role_id, nombre, correo, especialidad, cédula, password_hash |
| Pacientes | `patients` | chart_number, nombre, curp, contacto, emergencia, estatus |
| Expediente | `clinical_records` | patient_id (1:1), alergias, antecedentes, crónicos |
| Catálogo cita | `catalog_appointment_types` | name, description |
| Catálogo estatus | `catalog_appointment_statuses` | code, name |
| Agenda | `appointments` | patient_id, doctor_id, start_at, modalidad, estatus |
| Signos vitales | `vital_signs` | patient_id, cita_id, PA, FC, SpO2, temp, peso, glucosa, IMC |
| Consultas | `consultations` | cita_id, diagnóstico, plan, indicaciones, resumen |
| Recetas | `prescriptions` | consultation_id, patient_id, doctor_id |
| Detalle receta | `prescription_items` | prescription_id, medicamento, dosis, frecuencia |
| Seguimientos | `follow_ups` | patient_id, evolución, próxima_revisión |

## Relaciones principales

```
roles 1:N users
patients 1:1 clinical_records
patients 1:N appointments
users (doctor) 1:N appointments
appointments 1:N vital_signs
appointments 1:N consultations
consultations 1:N prescriptions
prescriptions 1:N prescription_items
consultations 1:N follow_ups
```

## Tablas Fase 2 (pendientes)

- `clinical_documents`
- `medical_devices`
- `notifications`
- `activity_log`
- Catálogos: síntomas, diagnósticos, medicamentos, tipos documento/dispositivo

## Tablas Fase 3 (pendientes)

- `device_readings`
- `lab_results`
- `consultation_payments`
- `digital_signatures`

## Orden de construcción

1. `roles` → `users`
2. `patients` → `clinical_records`
3. Catálogos de cita → `appointments`
4. `vital_signs`, `consultations`, `prescriptions`, `prescription_items`, `follow_ups`

## Migración desde schema anterior

Si ya tenías la BD con el schema simple (`providers`, `consultation_notes`):

```bash
dropdb maindhealth && createdb maindhealth
npm run db:push
npm run db:seed
```
