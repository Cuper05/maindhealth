# MaindHealth — Roadmap

## Fase 1 — MVP real ✅

Tablas: `roles`, `users`, `patients`, `clinical_records`, `appointments`, `vital_signs`, `consultations`, `prescriptions`, `prescription_items`, `follow_ups`, catálogos mínimos de cita.

Pantallas: Login, Dashboard, Pacientes, Agenda, Triage, Consultas, Recetas, Seguimiento.

## Fase 2 — Operación sólida ✅

Documentos clínicos, dispositivos médicos, bitácora, catálogos extendidos, notificaciones, gráficas de signos vitales, reportes operativos.

## Fase 3 — Escalamiento ✅

1. ✅ `device_readings` — lecturas de equipos + sync opcional a triage
2. ✅ Portal del paciente (`/portal`) — citas, recetas, documentos, lab, pagos
3. ✅ Firma digital — recetas con hash SHA-256 en PDF
4. ✅ `lab_results` — resultados estructurados
5. ✅ `consultation_payments` — cobros por cita (manual MVP)
6. ✅ Daily.co — salas automáticas en teleconsulta (con `VIDEO_API_KEY`)
7. ✅ Analítica extendida en reportes

## Fase 4 — Futuro

- Integración hardware en tiempo real (MQTT / BLE)
- Pasarela de pago (Stripe / Conekta)
- Prescripción electrónica regulada
- Portal paciente avanzado (mensajería, autocita)
- Analítica predictiva / alertas IA
