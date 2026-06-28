# MaindHealth — Pantallas y navegación

## Menú lateral (MVP)

| Ruta | Módulo | Fase |
|------|--------|------|
| `/` | Dashboard | 1 |
| `/pacientes` | Pacientes | 1 |
| `/agenda` | Agenda médica | 1 |
| `/estacion` | Estación telemedicina (protocolo intake) | 5 |
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
Login → Estación (intake) → Triage → Consulta → Receta → Seguimiento
```

### Protocolo de estación (`/estacion/flujo`)

1. Bienvenida  
2. Paciente nuevo o recurrente  
3. Captura / confirmación de datos  
4. Formulario clínico inicial  
5. Consentimiento informado  
6. Instrucciones y captura de signos vitales  
7. Sala de espera de teleconsulta  

Sin intake completado no hay triage ni consulta.

## Detalle de paciente (Fase 1.1)

`/pacientes/[id]` — pestañas: resumen, expediente, citas, signos, consultas, recetas, seguimientos.

## Roles y dashboard

- **Administrador** — operación global, usuarios, dispositivos  
- **Médico** — agenda, consultas, recetas  
- **Enfermería** — triage, signos vitales  
- **Recepción** — pacientes, agenda  
- **Paciente** — portal (Fase 2)
