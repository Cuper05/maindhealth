/**
 * Deja un médico como responsable/predeterminado de la estación.
 * Es el que atiende las teleconsultas por omisión y el que autoriza las
 * recetas de protocolo (su cédula va impresa).
 *
 *   node --env-file=.env.local scripts/set-station-responsible.mjs "Urista"
 *   node --env-file=.env.local scripts/set-station-responsible.mjs          (solo lista)
 */
import postgres from "postgres";

const needle = (process.argv[2] ?? "").trim();
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const doctors = await sql`
    SELECT u.id, u.first_name, u.last_name_paternal, u.last_name_maternal,
           u.email, u.phone, u.specialty, u.professional_license,
           u.active, u.teleconsulta_available
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE r.code = 'doctor'
    ORDER BY u.id
  `;

  console.log("Médicos en el sistema:");
  for (const d of doctors) {
    const name = [d.first_name, d.last_name_paternal, d.last_name_maternal]
      .filter(Boolean)
      .join(" ");
    console.log(
      `  #${d.id} ${name} · ${d.specialty ?? "sin especialidad"} · cédula ${d.professional_license ?? "—"} · tel ${d.phone ?? "—"} · activo ${d.active} · teleconsulta ${d.teleconsulta_available}`,
    );
  }

  const current = await sql`
    SELECT rp.id, rp.doctor_id, rp.active, u.first_name, u.last_name_paternal
    FROM station_responsible_physicians rp
    JOIN users u ON u.id = rp.doctor_id
    ORDER BY rp.authorized_at DESC
  `;
  console.log("\nResponsables registrados:");
  for (const r of current) {
    console.log(
      `  fila ${r.id} → #${r.doctor_id} ${r.first_name} ${r.last_name_paternal} · activo ${r.active}`,
    );
  }

  if (!needle) {
    console.log("\nSin cambios. Pase un apellido o correo para fijar el responsable.");
    process.exit(0);
  }

  const target = doctors.filter((d) => {
    const hay = [
      d.first_name,
      d.last_name_paternal,
      d.last_name_maternal,
      d.email,
      String(d.id),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(needle.toLowerCase());
  });

  if (target.length === 0) throw new Error(`Ningún médico coincide con "${needle}"`);
  if (target.length > 1) {
    throw new Error(
      `"${needle}" coincide con varios médicos: ${target.map((d) => `#${d.id}`).join(", ")}`,
    );
  }

  const doctor = target[0];
  const name = [doctor.first_name, doctor.last_name_paternal, doctor.last_name_maternal]
    .filter(Boolean)
    .join(" ");

  if (!doctor.active) throw new Error(`${name} está inactivo`);
  if (!doctor.professional_license) {
    throw new Error(`${name} no tiene cédula profesional y esa cédula se imprime en las recetas`);
  }

  // Un solo responsable activo a la vez: la consulta toma el más reciente.
  await sql`
    UPDATE station_responsible_physicians
    SET active = false, updated_at = NOW()
    WHERE doctor_id <> ${doctor.id} AND active = true
  `;

  const [existing] = await sql`
    SELECT id FROM station_responsible_physicians WHERE doctor_id = ${doctor.id} LIMIT 1
  `;

  if (existing) {
    await sql`
      UPDATE station_responsible_physicians
      SET active = true, authorized_at = NOW(), updated_at = NOW()
      WHERE id = ${existing.id}
    `;
  } else {
    await sql`
      INSERT INTO station_responsible_physicians (doctor_id, active, authorization_note)
      VALUES (
        ${doctor.id},
        true,
        'Autoriza el uso de sus datos profesionales para emitir recetas unicamente dentro de protocolos clinicos preautorizados de la estacion MaindHealth.'
      )
    `;
  }

  if (!doctor.teleconsulta_available || !doctor.phone) {
    console.log(
      `\nAviso: ${name} ${!doctor.phone ? "no tiene teléfono" : "no está marcado como disponible"}; sin eso no recibe las alertas de teleconsulta.`,
    );
  }

  const after = await sql`
    SELECT rp.doctor_id, u.first_name, u.last_name_paternal, u.professional_license
    FROM station_responsible_physicians rp
    JOIN users u ON u.id = rp.doctor_id
    WHERE rp.active = true AND u.active = true
    ORDER BY rp.authorized_at DESC
    LIMIT 1
  `;
  console.log(
    `\nPredeterminado ahora: #${after[0].doctor_id} ${after[0].first_name} ${after[0].last_name_paternal} · cédula ${after[0].professional_license}`,
  );
} finally {
  await sql.end({ timeout: 2 });
}
