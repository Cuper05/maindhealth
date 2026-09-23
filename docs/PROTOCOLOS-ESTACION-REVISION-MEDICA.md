# Protocolos clínicos de estación — paquete para revisión y firma médica

**Estado:** borrador asistido por IA (guías públicas orientativas)  
**Uso:** solo casos ambulatorios leves en kiosco MaindHealth  
**Requisito:** firma / aprobación del médico responsable con cédula antes de considerarse “protocolo autorizado definitivo”

Fuente de verdad en código: `src/lib/kiosk/clinical-protocols-catalog.ts`  
Se siembra a BD con: `npx tsx scripts/seed-protocols.ts`

---

## Cómo leer este documento

Cada protocolo tiene:

1. **Inclusión** — cuándo sí puede emitir receta autónoma  
2. **Exclusión** — cuándo **debe** ir a teleconsulta (el motor también busca keywords de exclusión en el motivo)  
3. **Esquema farmacológico** propuesto  
4. **Referencias** a validar (CENETEC, IMSS, consensos RAM México, guías ambulatorias)

La IA **no** sustituye al médico firmante. Si hay duda clínica → teleconsulta.

---

## Lista de protocolos

| Código | Nombre | Antibiótico | Severidad máx. autónoma |
|--------|--------|-------------|-------------------------|
| GI_LEVE | Dispepsia / epigastrio | No | moderate |
| DIARREA_LEVE | Diarrea aguda leve | No | low |
| FIEBRE_VIRAL_LEVE | Síndrome febril leve (sintomático) | No | low |
| NAUSEA_LEVE | Náusea/vómito leve | No | low |
| CEFALEA_LEVE | Cefalea tensional | No | moderate |
| IRA_VIRAL_LEVE | Resfriado / IRA viral | No | low |
| FARINGITIS_BACT | Faringoamigdalitis | Amoxicilina | moderate |
| IVU_LEVE | Cistitis no complicada (mujer) | Nitrofurantoína | moderate |
| SINUSITIS_LEVE | Sinusitis aguda | Amox/clav | moderate |
| LUMBALGIA_LEVE | Lumbalgia mecánica | No (AINE) | moderate |
| MIALGIA_LEVE | Mialgias | No | low |
| OTITIS_EXTERNA_LEVE | Otitis externa | Ciprofloxacino ótico | low |
| CONJUNTIVITIS_LEVE | Conjuntivitis | Tobramicina oftálmica | low |
| DERMATITIS_LEVE | Dermatitis/prurito | No (antihistamínico) | low |
| ABDOMEN_BAJO_LEVE | Dolor abdominal bajo | No | low |

Detalle completo (inclusión/exclusión/dosis/referencias): ver archivo TypeScript del catálogo.

---

## Reglas transversales (propuesta para firma)

1. Edad: autónomo solo adultos ≥18 (pediatría → teleconsulta).  
2. Embarazo / lactancia: fuera de autónomo salvo que el médico firme un protocolo específico.  
3. Alergias reportadas: el motor filtra penicilina, AINE, paracetamol, nitrofurantoína.  
4. Signos vitales de alarma (hipoxemia, PA extrema, fiebre muy alta, etc.): siempre teleconsulta.  
5. Antibióticos solo en protocolos con criterios clínicos explícitos (no “por si acaso”).  
6. Toda receta autónoma queda auditada con código de protocolo + médico responsable.

---

## Checklist de firma (médico responsable)

- [ ] Revisé dosis y duración de cada protocolo  
- [ ] Revisé exclusiones y estoy de acuerdo  
- [ ] Confirmé disponibilidad comercial de los fármacos en la estación  
- [ ] Confirmé que pediatría / embarazo / inmunosupresión quedan fuera  
- [ ] Autorizo activar estos protocolos en producción bajo mi cédula  

**Nombre:** _______________________  
**Cédula profesional:** _______________________  
**Fecha:** _______________________  
**Firma:** _______________________

---

## Próximas mejoras recomendadas (después de esta firma)

1. Formulario kiosco: pregunta explícita embarazo (sí/no/no sé) → exclusión automática.  
2. Criterios Centor capturados como chips (fiebre, exudado, adenopatía, ausencia de tos).  
3. Segunda revisión por otro médico o comité clínico.  
4. Farmacovigilancia: bitácora de recetas autónomas vs escaladas.
