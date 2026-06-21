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

## Fase 4 — Portal avanzado e integraciones ✅

1. ✅ Autocita en portal (`/portal/citas/nueva`) + pago pendiente automático
2. ✅ Stripe Checkout — pagos en línea (`STRIPE_SECRET_KEY` + webhook)
3. ✅ Daily.co + recordatorios de videollamada en notificaciones
4. ✅ Mensajería paciente–clínica (`/portal/mensajes`, `/mensajes`)
5. ✅ API ingest hardware — `POST /api/device-readings/ingest` con `x-api-key`
6. ✅ Receta regulada — folio `MH-RX-*`, código de verificación, QR en PDF
7. ✅ Alertas clínicas (`/alertas`) + métricas en reportes

## Fase 5 — Futuro

- Integración MQTT / BLE en tiempo real
- Pasarela alternativa (Conekta)
- Analítica predictiva / alertas IA
