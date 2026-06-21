import {
  and,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  notExists,
  notInArray,
  sql,
} from "drizzle-orm";
import { can } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/constants";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  catalogAppointmentStatusesTable,
  catalogDeviceTypesTable,
  followUpsTable,
  medicalDevicesTable,
  notificationsTable,
  patientsTable,
  vitalSignsTable,
  usersTable,
} from "@/lib/db/schema";
import { DEVICE_STATUS_LABELS, type DeviceStatus } from "@/lib/db/schema/medical-devices";
import { formatPersonName } from "@/lib/format/name";

async function getPatientIdForUser(userId: number) {
  const [user] = await db
    .select({ patientId: usersTable.patientId })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return user?.patientId ?? null;
}

type NotificationInsert = {
  userId: number;
  type: string;
  title: string;
  body?: string;
  href?: string;
  referenceKey: string;
};

async function ensureNotification(data: NotificationInsert) {
  const [existing] = await db
    .select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, data.userId),
        eq(notificationsTable.referenceKey, data.referenceKey),
      ),
    );

  if (!existing) {
    await db.insert(notificationsTable).values(data);
    return;
  }

  await db
    .update(notificationsTable)
    .set({
      type: data.type,
      title: data.title,
      body: data.body,
      href: data.href,
    })
    .where(eq(notificationsTable.id, existing.id));
}

export async function syncUserNotifications(userId: number, role: UserRole) {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const followUpHorizon = new Date(now);
  followUpHorizon.setDate(followUpHorizon.getDate() + 7);

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const activeKeys: string[] = [];

  if (can(role, "appointments:view")) {
    const conditions = [
      gte(appointmentsTable.startAt, now),
      lte(appointmentsTable.startAt, in24h),
    ];
    if (role === "doctor") {
      conditions.push(eq(appointmentsTable.doctorId, userId));
    }
    if (role === "patient") {
      const patientId = await getPatientIdForUser(userId);
      if (patientId) {
        conditions.push(eq(appointmentsTable.patientId, patientId));
      } else {
        conditions.push(sql`1 = 0`);
      }
    }

    const rows = await db
      .select({
        id: appointmentsTable.id,
        startAt: appointmentsTable.startAt,
        reason: appointmentsTable.reason,
        meetingUrl: appointmentsTable.meetingUrl,
        firstName: patientsTable.firstName,
        lastNamePaternal: patientsTable.lastNamePaternal,
        lastNameMaternal: patientsTable.lastNameMaternal,
      })
      .from(appointmentsTable)
      .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
      .where(and(...conditions));

    for (const appt of rows) {
      const referenceKey = `cita:${appt.id}`;
      activeKeys.push(referenceKey);
      const href = role === "patient" ? `/portal/citas/${appt.id}` : `/agenda/${appt.id}`;
      await ensureNotification({
        userId,
        type: "cita_proxima",
        referenceKey,
        title: role === "patient"
          ? `Tu cita — ${appt.startAt.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}`
          : `Cita con ${formatPersonName(appt)}`,
        body:
          appt.reason ??
          `Programada para ${appt.startAt.toLocaleString("es-MX", {
            dateStyle: "medium",
            timeStyle: "short",
          })}`,
        href,
      });

      if (appt.meetingUrl && role === "patient") {
        const videoKey = `videollamada:${appt.id}`;
        activeKeys.push(videoKey);
        await ensureNotification({
          userId,
          type: "videollamada_lista",
          referenceKey: videoKey,
          title: "Videollamada lista",
          body: "Tu consulta incluye enlace de teleconsulta. Entra 5 minutos antes.",
          href: `/portal/citas/${appt.id}`,
        });
      }
    }
  }

  if (can(role, "followups:view")) {
    const conditions = [
      sql`${followUpsTable.nextReviewAt} IS NOT NULL`,
      gte(followUpsTable.nextReviewAt, now),
      lte(followUpsTable.nextReviewAt, followUpHorizon),
    ];
    if (role === "doctor") {
      conditions.push(eq(followUpsTable.doctorId, userId));
    }

    const rows = await db
      .select({
        id: followUpsTable.id,
        nextReviewAt: followUpsTable.nextReviewAt,
        patientId: patientsTable.id,
        firstName: patientsTable.firstName,
        lastNamePaternal: patientsTable.lastNamePaternal,
        lastNameMaternal: patientsTable.lastNameMaternal,
      })
      .from(followUpsTable)
      .innerJoin(patientsTable, eq(followUpsTable.patientId, patientsTable.id))
      .where(and(...conditions));

    for (const row of rows) {
      const referenceKey = `seguimiento:${row.id}`;
      activeKeys.push(referenceKey);
      await ensureNotification({
        userId,
        type: "seguimiento_pendiente",
        referenceKey,
        title: `Revisión de ${formatPersonName(row)}`,
        body: row.nextReviewAt
          ? `Próxima revisión: ${row.nextReviewAt.toLocaleString("es-MX", {
              dateStyle: "medium",
              timeStyle: "short",
            })}`
          : undefined,
        href: `/pacientes/${row.patientId}?tab=seguimientos`,
      });
    }
  }

  if (can(role, "vitals:write")) {
    const rows = await db
      .select({
        id: appointmentsTable.id,
        startAt: appointmentsTable.startAt,
        patientId: patientsTable.id,
        firstName: patientsTable.firstName,
        lastNamePaternal: patientsTable.lastNamePaternal,
        lastNameMaternal: patientsTable.lastNameMaternal,
      })
      .from(appointmentsTable)
      .innerJoin(
        catalogAppointmentStatusesTable,
        eq(appointmentsTable.appointmentStatusId, catalogAppointmentStatusesTable.id),
      )
      .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
      .where(
        and(
          gte(appointmentsTable.startAt, todayStart),
          lte(appointmentsTable.startAt, todayEnd),
          inArray(catalogAppointmentStatusesTable.code, ["scheduled", "in_progress"]),
          notExists(
            db
              .select({ id: vitalSignsTable.id })
              .from(vitalSignsTable)
              .where(eq(vitalSignsTable.appointmentId, appointmentsTable.id)),
          ),
        ),
      );

    for (const row of rows) {
      const referenceKey = `triage:${row.id}`;
      activeKeys.push(referenceKey);
      await ensureNotification({
        userId,
        type: "triage_pendiente",
        referenceKey,
        title: `Triage pendiente — ${formatPersonName(row)}`,
        body: `Cita de hoy ${row.startAt.toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
        })} sin signos vitales`,
        href: `/triage/nuevo?patientId=${row.patientId}&appointmentId=${row.id}&redirect=/agenda/${row.id}`,
      });
    }
  }

  if (can(role, "config:view")) {
    const rows = await db
      .select({
        id: medicalDevicesTable.id,
        status: medicalDevicesTable.status,
        serialNumber: medicalDevicesTable.serialNumber,
        typeName: catalogDeviceTypesTable.name,
      })
      .from(medicalDevicesTable)
      .innerJoin(
        catalogDeviceTypesTable,
        eq(medicalDevicesTable.deviceTypeId, catalogDeviceTypesTable.id),
      )
      .where(
        inArray(medicalDevicesTable.status, ["en_mantenimiento", "calibracion_pendiente"]),
      );

    for (const device of rows) {
      const referenceKey = `dispositivo:${device.id}`;
      activeKeys.push(referenceKey);
      await ensureNotification({
        userId,
        type: "dispositivo_alerta",
        referenceKey,
        title: `${device.typeName} requiere atención`,
        body: `${DEVICE_STATUS_LABELS[device.status as DeviceStatus]}${device.serialNumber ? ` · ${device.serialNumber}` : ""}`,
        href: `/dispositivos/${device.id}`,
      });
    }
  }

  const staleBase = and(
    eq(notificationsTable.userId, userId),
    isNull(notificationsTable.readAt),
    sql`${notificationsTable.type} != 'sistema'`,
  );

  if (activeKeys.length === 0) {
    await db.delete(notificationsTable).where(staleBase);
    return;
  }

  await db
    .delete(notificationsTable)
    .where(and(staleBase, notInArray(notificationsTable.referenceKey, activeKeys)));
}
