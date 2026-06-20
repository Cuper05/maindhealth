# MaindHealth

Sistema de **telemedicina / teleconsultorio** para Maindsteel.

Agenda citas, gestiona pacientes, captura signos vitales, documenta consultas y emite recetas.

## Stack

- Next.js 16 · React 19 · Tailwind CSS 4
- PostgreSQL · Drizzle ORM
- Sesión con iron-session · roles (admin, médico, enfermería, recepción, paciente)

## Inicio rápido

```bash
cd ~/Projects/maindhealth
cp .env.example .env
# Edita DATABASE_URL (ej. postgresql://TU_USUARIO@localhost:5432/maindhealth)
createdb maindhealth
npm run db:push
npm run db:seed
npm run dev
```

Abre **http://localhost:3003**

| Usuario | Correo | Contraseña |
|---------|--------|------------|
| Admin | `admin@maindhealth.local` | `admin123` |
| Médico demo | `doctor@maindhealth.local` | `admin123` |

> Si migras desde el schema anterior: `dropdb maindhealth && createdb maindhealth` antes de `db:push`.

## Estado del producto

| Módulo | BD | UI |
|--------|----|----|
| Login y roles | ✅ | ✅ |
| Pacientes | ✅ | ✅ alta + detalle + expediente |
| Expediente clínico | ✅ | ✅ pestaña en detalle paciente |
| Agenda médica | ✅ | ✅ listado + nueva cita + detalle |
| Triage / signos vitales | ✅ | ✅ listado + captura + historial gráfico |
| Consultas / teleconsulta | ✅ | ✅ nota médica + catálogos clínicos |
| Recetas | ✅ | ✅ emisión + PDF + catálogo de medicamentos |
| Documentos clínicos | ✅ | ✅ carga + listado + ver archivo |
| Seguimientos | ✅ | ✅ listado + registro + próximas revisiones |
| Dispositivos médicos | ✅ | ✅ inventario + alertas de mantenimiento |
| Bitácora | ✅ | ✅ auditoría de acciones |
| Notificaciones | ✅ | ✅ recordatorios in-app |
| Reportes operativos | ✅ | ✅ indicadores clínicos y productividad |
| Catálogos clínicos | ✅ | ✅ síntomas, diagnósticos, medicamentos |
| Configuración / usuarios | ✅ | ✅ listado |

## Documentación

- [docs/MODULES.md](./docs/MODULES.md) — matriz de módulos y prioridades
- [docs/DATABASE.md](./docs/DATABASE.md) — esquema y relaciones
- [docs/NAVIGATION.md](./docs/NAVIGATION.md) — pantallas y menú
- [docs/EQUIPMENT.md](./docs/EQUIPMENT.md) — equipos del teleconsultorio
- [docs/ROADMAP.md](./docs/ROADMAP.md) — fases 1–3
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) — tabla maestra para desarrollo

## Modelo de datos

```
roles → users (médicos son users con rol doctor)
patients → clinical_records (1:1)
patients → appointments → consultations → prescriptions → prescription_items
                        → vital_signs
                        → follow_ups
                        → clinical_documents
medical_devices · activity_log · notifications
```

## Próximos pasos (Fase 3)

1. Lecturas automáticas de dispositivos (`device_readings`)
2. Portal del paciente
3. Firma digital y laboratorio
4. Pagos de consulta
5. Videollamada real (Daily.co)
