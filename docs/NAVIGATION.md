# MaindHealth — Pantallas y navegación

## Menú lateral (MVP)

| Ruta | Módulo | Fase |
|------|--------|------|
| `/` | Dashboard | 1 |
| `/pacientes` | Pacientes | 1 |
| `/agenda` | Agenda médica | 1 |
| `/triage` | Triage / signos vitales | 1 |
| `/consultas` | Consultas / teleconsulta | 1 |
| `/recetas` | Recetas | 1 |
| `/seguimientos` | Seguimiento | 1 |
| `/documentos` | Documentos clínicos | 2 |
| `/dispositivos` | Dispositivos médicos | 2 |
| `/reportes` | Reportes | 2 |
| `/configuracion` | Catálogos y usuarios | 2 |

## Flujo clínico principal

```
Login → Dashboard → Pacientes → Agenda → Triage → Consulta → Receta → Seguimiento
```

## Detalle de paciente (Fase 1.1)

`/pacientes/[id]` — pestañas: resumen, expediente, citas, signos, consultas, recetas, seguimientos.

## Roles y dashboard

- **Administrador** — operación global, usuarios, dispositivos  
- **Médico** — agenda, consultas, recetas  
- **Enfermería** — triage, signos vitales  
- **Recepción** — pacientes, agenda  
- **Paciente** — portal (Fase 2)
