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

## MVP Fase 1 — estado

| Módulo | BD | UI |
|--------|----|----|
| Login y roles | ✅ | ✅ |
| Pacientes | ✅ | ✅ alta + detalle + expediente |
| Expediente clínico | ✅ | ✅ pestaña en detalle paciente |
| Agenda médica | ✅ | ✅ listado + nueva cita + detalle |
| Triage / signos vitales | ✅ | ✅ listado + captura (IMC auto) |
| Consultas / teleconsulta | ✅ | ✅ nota médica por cita |
| Recetas | ✅ | ✅ emisión + PDF |
| Seguimientos | ✅ | 🔜 |
| Configuración / usuarios | ✅ | ✅ listado |

## Documentación

- [docs/MODULES.md](./docs/MODULES.md) — matriz de módulos y prioridades
- [docs/DATABASE.md](./docs/DATABASE.md) — esquema y relaciones
- [docs/NAVIGATION.md](./docs/NAVIGATION.md) — pantallas y menú
- [docs/EQUIPMENT.md](./docs/EQUIPMENT.md) — equipos del teleconsultorio
- [docs/ROADMAP.md](./docs/ROADMAP.md) — fases 1–3
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) — tabla maestra para desarrollo

## Modelo de datos (Fase 1)

```
roles → users (médicos son users con rol doctor)
patients → clinical_records (1:1)
patients → appointments → consultations → prescriptions → prescription_items
                        → vital_signs
                        → follow_ups
```

## Próximos pasos

1. Seguimiento del paciente (formulario + listado pendientes)
2. Integración video real (Daily.co o similar)
3. Fase 2: documentos, dispositivos, reportes, catálogos
