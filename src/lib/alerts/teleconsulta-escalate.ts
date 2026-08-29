import { and, asc, eq, inArray, isNotNull, isNull, lte, ne, or } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  patientsTable,
  rolesTable,
  teleconsultaAlertAttemptsTable,
  teleconsultaEscalationsTable,
  teleconsultaJoinTokensTable,
  usersTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import {
  appBaseUrl,
  buildTeleconsultaVoiceTwiml,
  isTwilioConfigured,
  normalizePhoneE164,
  placeVoiceCall,
  sendSms,
  sendWhatsApp,
  teleconsultaEscalateSeconds,
} from "@/lib/alerts/twilio";

function newOpaqueToken(): string {
  return randomBytes(24).toString("base64url");
}

function parseQueue(queueJson: string): number[] {
  try {
    const parsed = JSON.parse(queueJson) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is number => typeof id === "number" && id > 0);
  } catch {
    return [];
  }
}

/**
 * Ordered queue: assigned → responsible → remaining active doctors
 * with phone and teleconsultaAvailable.
 */
export async function buildDoctorAlertQueue(input: {
  assignedDoctorId?: number | null;
  responsibleDoctorId?: number | null;
  preferredIds?: number[];
}): Promise<number[]> {
  const doctors = await db
    .select({
      id: usersTable.id,
      phone: usersTable.phone,
    })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .where(
      and(
        eq(rolesTable.code, "doctor"),
        eq(usersTable.active, true),
        eq(usersTable.teleconsultaAvailable, true),
        isNotNull(usersTable.phone),
        ne(usersTable.phone, ""),
      ),
    )
    .orderBy(asc(usersTable.lastNamePaternal), asc(usersTable.firstName));

  const withPhone = doctors.filter((d) => normalizePhoneE164(d.phone));
  const idSet = new Set(withPhone.map((d) => d.id));

  const ordered: number[] = [];
  const push = (id: number | null | undefined) => {
    if (!id || !idSet.has(id) || ordered.includes(id)) return;
    ordered.push(id);
  };

  push(input.assignedDoctorId);
  push(input.responsibleDoctorId);
  for (const id of input.preferredIds ?? []) push(id);
  for (const d of withPhone) push(d.id);

  return ordered;
}

async function createJoinToken(input: {
  appointmentId: number;
  userId: number;
}): Promise<{ id: number; token: string; url: string }> {
  const token = newOpaqueToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 8);
  const [row] = await db
    .insert(teleconsultaJoinTokensTable)
    .values({
      token,
      appointmentId: input.appointmentId,
      userId: input.userId,
      expiresAt,
    })
    .returning({ id: teleconsultaJoinTokensTable.id, token: teleconsultaJoinTokensTable.token });

  return {
    id: row.id,
    token: row.token,
    url: `${appBaseUrl()}/t/${row.token}`,
  };
}

async function alertDoctorChannels(input: {
  appointmentId: number;
  doctorUserId: number;
  joinUrl: string;
  attemptId: number;
  patientLabel: string;
  redFlags: string[];
}): Promise<{
  voiceCallSid: string | null;
  smsSid: string | null;
  whatsappSid: string | null;
  errors: string[];
}> {
  const [doctor] = await db
    .select({
      phone: usersTable.phone,
      firstName: usersTable.firstName,
      lastNamePaternal: usersTable.lastNamePaternal,
      lastNameMaternal: usersTable.lastNameMaternal,
    })
    .from(usersTable)
    .where(eq(usersTable.id, input.doctorUserId));

  const phone = doctor?.phone ?? "";
  const doctorName = doctor ? formatPersonName(doctor) : "Doctor";
  const flags =
    input.redFlags.length > 0
      ? input.redFlags.slice(0, 3).join("; ")
      : "Urgente — fuera de protocolo autónomo";

  const smsBody = `MaindHealth URGENTE: ${input.patientLabel} espera teleconsulta. ${flags}. Entra ahora: ${input.joinUrl}`;

  const errors: string[] = [];
  let voiceCallSid: string | null = null;
  let smsSid: string | null = null;
  let whatsappSid: string | null = null;

  if (!isTwilioConfigured()) {
    errors.push("Twilio no configurado — solo notificación in-app");
    return { voiceCallSid, smsSid, whatsappSid, errors };
  }

  // Spanish TwiML via Url on APP_BASE_URL (custom domain). Inline Twiml as backup.
  const voiceUrl = `${appBaseUrl()}/api/alerts/twilio/voice?attemptId=${input.attemptId}&doctor=${encodeURIComponent(doctorName)}&patient=${encodeURIComponent(input.patientLabel)}`;
  const twiml = buildTeleconsultaVoiceTwiml({
    attemptId: input.attemptId,
    doctorName,
    patientLabel: input.patientLabel,
    gatherBaseUrl: appBaseUrl(),
  });

  // Timeouts: never hang the kiosk request; voice first so the phone rings.
  type TwResult = Awaited<ReturnType<typeof placeVoiceCall>>;
  const timed = <T extends TwResult>(p: Promise<T>, ms: number, label: string) =>
    Promise.race([
      p,
      new Promise<TwResult>((resolve) =>
        setTimeout(() => resolve({ ok: false, error: `${label}: timeout ${ms}ms` }), ms),
      ),
    ]);

  const voice = await timed(
    placeVoiceCall({ to: phone, twimlUrl: voiceUrl, twiml }),
    10_000,
    "voz",
  );
  if (voice.ok) voiceCallSid = voice.sid;
  else if (!voice.skipped) errors.push(`voz: ${voice.error}`);

  const [sms, wa] = await Promise.all([
    timed(sendSms({ to: phone, body: smsBody }), 8_000, "sms"),
    timed(sendWhatsApp({ to: phone, body: smsBody }), 8_000, "whatsapp"),
  ]);
  if (sms.ok) smsSid = sms.sid;
  else if (!sms.skipped) errors.push(`sms: ${sms.error}`);
  if (wa.ok) whatsappSid = wa.sid;
  else if (!wa.skipped) errors.push(`whatsapp: ${wa.error}`);

  return { voiceCallSid, smsSid, whatsappSid, errors };
}

async function alertDoctorInEscalation(input: {
  escalationId: number;
  appointmentId: number;
  doctorUserId: number;
  redFlags: string[];
}): Promise<void> {
  const [patientRow] = await db
    .select({
      firstName: patientsTable.firstName,
      lastNamePaternal: patientsTable.lastNamePaternal,
      lastNameMaternal: patientsTable.lastNameMaternal,
      chartNumber: patientsTable.chartNumber,
    })
    .from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .where(eq(appointmentsTable.id, input.appointmentId));

  const patientLabel = patientRow
    ? `${formatPersonName(patientRow)}${patientRow.chartNumber ? ` (${patientRow.chartNumber})` : ""}`
    : `Cita #${input.appointmentId}`;

  const join = await createJoinToken({
    appointmentId: input.appointmentId,
    userId: input.doctorUserId,
  });

  const [attempt] = await db
    .insert(teleconsultaAlertAttemptsTable)
    .values({
      escalationId: input.escalationId,
      appointmentId: input.appointmentId,
      doctorUserId: input.doctorUserId,
      joinTokenId: join.id,
      status: "pending",
      channels: "voice,sms,whatsapp",
    })
    .returning({ id: teleconsultaAlertAttemptsTable.id });

  // Await Twilio in-request with per-channel timeouts (see alertDoctorChannels).
  // Do NOT fire-and-forget via after(() => void …): Vercel freezes the isolate
  // before Calls.json completes, so the doctor's phone never rings.
  try {
    const result = await alertDoctorChannels({
      appointmentId: input.appointmentId,
      doctorUserId: input.doctorUserId,
      joinUrl: join.url,
      attemptId: attempt.id,
      patientLabel,
      redFlags: input.redFlags,
    });

    await db
      .update(teleconsultaAlertAttemptsTable)
      .set({
        voiceCallSid: result.voiceCallSid,
        smsSid: result.smsSid,
        whatsappSid: result.whatsappSid,
        errorDetail: result.errors.length > 0 ? result.errors.join("; ") : null,
        status:
          result.errors.length >= 3 &&
          !result.voiceCallSid &&
          !result.smsSid &&
          !result.whatsappSid
            ? "failed"
            : "pending",
      })
      .where(eq(teleconsultaAlertAttemptsTable.id, attempt.id));
  } catch (err) {
    console.error("[teleconsulta-escalate] channels failed", err);
    try {
      await db
        .update(teleconsultaAlertAttemptsTable)
        .set({
          status: "failed",
          errorDetail: err instanceof Error ? err.message : "Error enviando alertas",
        })
        .where(eq(teleconsultaAlertAttemptsTable.id, attempt.id));
    } catch {
      /* ignore */
    }
  }
}

/**
 * Start (or no-op if already active) urgent phone/SMS/WhatsApp escalation.
 * In-app notify remains separate and additive.
 */
export async function startTeleconsultaEscalation(input: {
  appointmentId: number;
  assignedDoctorId?: number | null;
  responsibleDoctorId?: number | null;
  preferredIds?: number[];
  redFlags?: string[];
}): Promise<{ started: boolean; queueSize: number; reason?: string }> {
  const [existing] = await db
    .select({
      id: teleconsultaEscalationsTable.id,
      status: teleconsultaEscalationsTable.status,
    })
    .from(teleconsultaEscalationsTable)
    .where(eq(teleconsultaEscalationsTable.appointmentId, input.appointmentId));

  if (existing?.status === "joined") {
    return { started: false, queueSize: 0, reason: "already_joined" };
  }
  if (existing?.status === "active") {
    return { started: false, queueSize: 0, reason: "already_active" };
  }

  const queue = await buildDoctorAlertQueue({
    assignedDoctorId: input.assignedDoctorId,
    responsibleDoctorId: input.responsibleDoctorId,
    preferredIds: input.preferredIds,
  });

  if (queue.length === 0) {
    console.warn(
      "[teleconsulta-escalate] empty queue (need active doctors with phone + teleconsultaAvailable)",
    );
    return { started: false, queueSize: 0, reason: "empty_queue" };
  }

  const firstDoctorId = queue[0];
  const escalateSec = teleconsultaEscalateSeconds();
  const nextActionAt = new Date(Date.now() + escalateSec * 1000);
  const redFlags = input.redFlags ?? [];

  let escalationId: number;

  if (existing) {
    await db
      .update(teleconsultaEscalationsTable)
      .set({
        currentDoctorUserId: firstDoctorId,
        queueJson: JSON.stringify(queue),
        indexInQueue: 0,
        nextActionAt,
        status: "active",
        joinedByUserId: null,
        joinedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(teleconsultaEscalationsTable.id, existing.id));
    escalationId = existing.id;
  } else {
    const [row] = await db
      .insert(teleconsultaEscalationsTable)
      .values({
        appointmentId: input.appointmentId,
        currentDoctorUserId: firstDoctorId,
        queueJson: JSON.stringify(queue),
        indexInQueue: 0,
        nextActionAt,
        status: "active",
      })
      .returning({ id: teleconsultaEscalationsTable.id });
    escalationId = row.id;
  }

  await alertDoctorInEscalation({
    escalationId,
    appointmentId: input.appointmentId,
    doctorUserId: firstDoctorId,
    redFlags,
  });

  return { started: true, queueSize: queue.length };
}

/** Doctor opened /t/{token} — stop further alerts for this appointment. */
export async function markTeleconsultaJoined(input: {
  appointmentId: number;
  doctorUserId?: number | null;
  joinTokenId?: number | null;
}): Promise<void> {
  const now = new Date();

  await db
    .update(teleconsultaEscalationsTable)
    .set({
      status: "joined",
      joinedByUserId: input.doctorUserId ?? null,
      joinedAt: now,
      nextActionAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(teleconsultaEscalationsTable.appointmentId, input.appointmentId),
        or(
          eq(teleconsultaEscalationsTable.status, "active"),
          eq(teleconsultaEscalationsTable.status, "exhausted"),
        ),
      ),
    );

  if (input.doctorUserId) {
    await db
      .update(teleconsultaAlertAttemptsTable)
      .set({ status: "joined", joinedAt: now })
      .where(
        and(
          eq(teleconsultaAlertAttemptsTable.appointmentId, input.appointmentId),
          eq(teleconsultaAlertAttemptsTable.doctorUserId, input.doctorUserId),
          eq(teleconsultaAlertAttemptsTable.status, "pending"),
        ),
      );
  } else if (input.joinTokenId) {
    await db
      .update(teleconsultaAlertAttemptsTable)
      .set({ status: "joined", joinedAt: now })
      .where(
        and(
          eq(teleconsultaAlertAttemptsTable.appointmentId, input.appointmentId),
          eq(teleconsultaAlertAttemptsTable.joinTokenId, input.joinTokenId),
          eq(teleconsultaAlertAttemptsTable.status, "pending"),
        ),
      );
  }

  // Cancel other pending attempts for this appointment
  await db
    .update(teleconsultaAlertAttemptsTable)
    .set({ status: "timed_out", timedOutAt: now })
    .where(
      and(
        eq(teleconsultaAlertAttemptsTable.appointmentId, input.appointmentId),
        eq(teleconsultaAlertAttemptsTable.status, "pending"),
      ),
    );

  // Revoke unused tokens for this appointment (keep the one just used)
  const revokeConditions = [
    eq(teleconsultaJoinTokensTable.appointmentId, input.appointmentId),
    isNull(teleconsultaJoinTokensTable.usedAt),
    isNull(teleconsultaJoinTokensTable.revokedAt),
  ];
  if (input.joinTokenId) {
    revokeConditions.push(ne(teleconsultaJoinTokensTable.id, input.joinTokenId));
  }
  await db
    .update(teleconsultaJoinTokensTable)
    .set({ revokedAt: now })
    .where(and(...revokeConditions));
}

/**
 * Process due escalations (cron / after()). Advance to next doctor if still pending.
 */
export async function processDueTeleconsultaEscalations(input?: {
  redFlagsByAppointment?: Record<number, string[]>;
}): Promise<{ processed: number; advanced: number }> {
  const now = new Date();
  const due = await db
    .select()
    .from(teleconsultaEscalationsTable)
    .where(
      and(
        eq(teleconsultaEscalationsTable.status, "active"),
        isNotNull(teleconsultaEscalationsTable.nextActionAt),
        lte(teleconsultaEscalationsTable.nextActionAt, now),
      ),
    )
    .limit(50);

  let advanced = 0;

  for (const esc of due) {
    const queue = parseQueue(esc.queueJson);
    const currentIndex = esc.indexInQueue;

    // Mark current attempt timed out
    if (esc.currentDoctorUserId) {
      await db
        .update(teleconsultaAlertAttemptsTable)
        .set({ status: "timed_out", timedOutAt: now })
        .where(
          and(
            eq(teleconsultaAlertAttemptsTable.escalationId, esc.id),
            eq(teleconsultaAlertAttemptsTable.doctorUserId, esc.currentDoctorUserId),
            eq(teleconsultaAlertAttemptsTable.status, "pending"),
          ),
        );
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      await db
        .update(teleconsultaEscalationsTable)
        .set({
          status: "exhausted",
          nextActionAt: null,
          updatedAt: now,
        })
        .where(eq(teleconsultaEscalationsTable.id, esc.id));
      continue;
    }

    const nextDoctorId = queue[nextIndex];
    const escalateSec = teleconsultaEscalateSeconds();
    const nextActionAt = new Date(Date.now() + escalateSec * 1000);

    await db
      .update(teleconsultaEscalationsTable)
      .set({
        currentDoctorUserId: nextDoctorId,
        indexInQueue: nextIndex,
        nextActionAt,
        updatedAt: now,
      })
      .where(eq(teleconsultaEscalationsTable.id, esc.id));

    const redFlags = input?.redFlagsByAppointment?.[esc.appointmentId] ?? [];
    await alertDoctorInEscalation({
      escalationId: esc.id,
      appointmentId: esc.appointmentId,
      doctorUserId: nextDoctorId,
      redFlags,
    });
    advanced += 1;
  }

  return { processed: due.length, advanced };
}

/** Resend SMS + WhatsApp for an attempt (Twilio Gather digit 1). */
export async function resendAttemptLinkMessages(attemptId: number): Promise<{
  ok: boolean;
  error?: string;
}> {
  const [attempt] = await db
    .select({
      id: teleconsultaAlertAttemptsTable.id,
      appointmentId: teleconsultaAlertAttemptsTable.appointmentId,
      doctorUserId: teleconsultaAlertAttemptsTable.doctorUserId,
      joinTokenId: teleconsultaAlertAttemptsTable.joinTokenId,
      status: teleconsultaAlertAttemptsTable.status,
    })
    .from(teleconsultaAlertAttemptsTable)
    .where(eq(teleconsultaAlertAttemptsTable.id, attemptId));

  if (!attempt) return { ok: false, error: "Intento no encontrado" };
  if (attempt.status === "joined") return { ok: false, error: "Ya se unió" };

  let joinUrl: string | null = null;
  if (attempt.joinTokenId) {
    const [tok] = await db
      .select({ token: teleconsultaJoinTokensTable.token })
      .from(teleconsultaJoinTokensTable)
      .where(eq(teleconsultaJoinTokensTable.id, attempt.joinTokenId));
    if (tok) joinUrl = `${appBaseUrl()}/t/${tok.token}`;
  }

  if (!joinUrl) {
    const join = await createJoinToken({
      appointmentId: attempt.appointmentId,
      userId: attempt.doctorUserId,
    });
    joinUrl = join.url;
    await db
      .update(teleconsultaAlertAttemptsTable)
      .set({ joinTokenId: join.id })
      .where(eq(teleconsultaAlertAttemptsTable.id, attempt.id));
  }

  const [doctor] = await db
    .select({ phone: usersTable.phone })
    .from(usersTable)
    .where(eq(usersTable.id, attempt.doctorUserId));

  if (!doctor?.phone) return { ok: false, error: "Sin teléfono" };

  const body = `MaindHealth: enlace teleconsulta (reenviado): ${joinUrl}`;
  const sms = await sendSms({ to: doctor.phone, body });
  const wa = await sendWhatsApp({ to: doctor.phone, body });
  if (!sms.ok && !wa.ok) {
    return { ok: false, error: sms.error || wa.error || "No se pudo reenviar" };
  }
  return { ok: true };
}

export async function getAttemptForVoice(attemptId: number) {
  const [row] = await db
    .select({
      id: teleconsultaAlertAttemptsTable.id,
      appointmentId: teleconsultaAlertAttemptsTable.appointmentId,
      doctorUserId: teleconsultaAlertAttemptsTable.doctorUserId,
      status: teleconsultaAlertAttemptsTable.status,
      joinTokenId: teleconsultaAlertAttemptsTable.joinTokenId,
    })
    .from(teleconsultaAlertAttemptsTable)
    .where(eq(teleconsultaAlertAttemptsTable.id, attemptId));
  return row ?? null;
}

/** Load join URLs for doctors already in preferred list (debug / tests). */
export async function listActiveEscalationsForAppointments(appointmentIds: number[]) {
  if (appointmentIds.length === 0) return [];
  return db
    .select()
    .from(teleconsultaEscalationsTable)
    .where(inArray(teleconsultaEscalationsTable.appointmentId, appointmentIds));
}
