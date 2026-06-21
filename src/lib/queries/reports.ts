import { count, desc, eq, gte, isNotNull, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  ACTIVITY_MODULE_LABELS,
  activityLogTable,
  appointmentsTable,
  catalogAppointmentStatusesTable,
  consultationPaymentsTable,
  consultationsTable,
  deviceReadingsTable,
  digitalSignaturesTable,
  followUpsTable,
  labResultsTable,
  patientsTable,
  prescriptionsTable,
  usersTable,
  vitalSignsTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { getPeriodStart, type ReportPeriodDays } from "@/lib/reports/period";
import { getVitalAlerts, hasVitalAlerts } from "@/lib/reports/vital-alerts";

export type OperationalReport = {
  periodDays: ReportPeriodDays;
  periodStart: Date;
  summary: {
    newPatients: number;
    appointments: number;
    consultations: number;
    prescriptions: number;
    followUps: number;
    vitalCaptures: number;
    outOfRangeVitals: number;
    deviceReadings: number;
    labResults: number;
    paymentsPaid: number;
    digitalSignatures: number;
    teleconsultas: number;
  };
  appointmentsByStatus: { statusName: string; total: number }[];
  doctorProductivity: { doctorName: string; consultations: number; prescriptions: number }[];
  activityByModule: { module: string; moduleLabel: string; total: number }[];
  outOfRangeVitals: {
    id: number;
    recordedAt: Date;
    patientId: number;
    patientName: string;
    chartNumber: string;
    alerts: ReturnType<typeof getVitalAlerts>;
  }[];
};

export async function getOperationalReport(periodDays: ReportPeriodDays): Promise<OperationalReport> {
  const periodStart = getPeriodStart(periodDays);

  const [
    [newPatientsRow], [appointmentsRow], [consultationsRow], [prescriptionsRow],
    [followUpsRow], [vitalCapturesRow], [deviceReadingsRow], [labResultsRow],
    [paymentsPaidRow], [signaturesRow], [teleconsultasRow],
    appointmentsByStatus, doctorConsultations,
    doctorPrescriptions, activityRows, vitalRows,
  ] = await Promise.all([
    db.select({ total: count() }).from(patientsTable).where(gte(patientsTable.registeredAt, periodStart)),
    db.select({ total: count() }).from(appointmentsTable).where(gte(appointmentsTable.startAt, periodStart)),
    db.select({ total: count() }).from(consultationsTable).where(gte(consultationsTable.consultedAt, periodStart)),
    db.select({ total: count() }).from(prescriptionsTable).where(gte(prescriptionsTable.issuedAt, periodStart)),
    db.select({ total: count() }).from(followUpsTable).where(gte(followUpsTable.followUpAt, periodStart)),
    db.select({ total: count() }).from(vitalSignsTable).where(gte(vitalSignsTable.recordedAt, periodStart)),
    db.select({ total: count() }).from(deviceReadingsTable).where(gte(deviceReadingsTable.recordedAt, periodStart)),
    db.select({ total: count() }).from(labResultsTable).where(gte(labResultsTable.resultAt, periodStart)),
    db.select({ total: count() }).from(consultationPaymentsTable).where(
      and(gte(consultationPaymentsTable.paidAt, periodStart), eq(consultationPaymentsTable.status, "paid")),
    ),
    db.select({ total: count() }).from(digitalSignaturesTable).where(gte(digitalSignaturesTable.signedAt, periodStart)),
    db.select({ total: count() }).from(appointmentsTable).where(
      and(gte(appointmentsTable.startAt, periodStart), isNotNull(appointmentsTable.meetingUrl)),
    ),
    db.select({ statusName: catalogAppointmentStatusesTable.name, total: count() })
      .from(appointmentsTable)
      .innerJoin(catalogAppointmentStatusesTable, eq(appointmentsTable.appointmentStatusId, catalogAppointmentStatusesTable.id))
      .where(gte(appointmentsTable.startAt, periodStart))
      .groupBy(catalogAppointmentStatusesTable.name).orderBy(desc(count())),
    db.select({
      doctorFirstName: usersTable.firstName,
      doctorLastNamePaternal: usersTable.lastNamePaternal,
      doctorLastNameMaternal: usersTable.lastNameMaternal,
      total: count(),
    }).from(consultationsTable).innerJoin(usersTable, eq(consultationsTable.doctorId, usersTable.id))
      .where(gte(consultationsTable.consultedAt, periodStart))
      .groupBy(usersTable.id, usersTable.firstName, usersTable.lastNamePaternal, usersTable.lastNameMaternal)
      .orderBy(desc(count())),
    db.select({
      doctorFirstName: usersTable.firstName,
      doctorLastNamePaternal: usersTable.lastNamePaternal,
      doctorLastNameMaternal: usersTable.lastNameMaternal,
      total: count(),
    }).from(prescriptionsTable).innerJoin(usersTable, eq(prescriptionsTable.doctorId, usersTable.id))
      .where(gte(prescriptionsTable.issuedAt, periodStart))
      .groupBy(usersTable.id, usersTable.firstName, usersTable.lastNamePaternal, usersTable.lastNameMaternal),
    db.select({ module: activityLogTable.module, total: count() })
      .from(activityLogTable).where(gte(activityLogTable.createdAt, periodStart))
      .groupBy(activityLogTable.module).orderBy(desc(count())),
    db.select({
      id: vitalSignsTable.id, recordedAt: vitalSignsTable.recordedAt, patientId: vitalSignsTable.patientId,
      chartNumber: patientsTable.chartNumber, patientFirstName: patientsTable.firstName,
      patientLastNamePaternal: patientsTable.lastNamePaternal, patientLastNameMaternal: patientsTable.lastNameMaternal,
      systolicPressure: vitalSignsTable.systolicPressure, diastolicPressure: vitalSignsTable.diastolicPressure,
      heartRate: vitalSignsTable.heartRate, oxygenSaturation: vitalSignsTable.oxygenSaturation,
      temperature: vitalSignsTable.temperature, glucose: vitalSignsTable.glucose,
    }).from(vitalSignsTable).innerJoin(patientsTable, eq(vitalSignsTable.patientId, patientsTable.id))
      .where(gte(vitalSignsTable.recordedAt, periodStart)).orderBy(desc(vitalSignsTable.recordedAt)).limit(500),
  ]);

  const prescriptionByDoctor = new Map(
    doctorPrescriptions.map((row) => [
      formatPersonName({ firstName: row.doctorFirstName, lastNamePaternal: row.doctorLastNamePaternal, lastNameMaternal: row.doctorLastNameMaternal }),
      row.total,
    ]),
  );

  const doctorProductivity = doctorConsultations.map((row) => {
    const doctorName = formatPersonName({ firstName: row.doctorFirstName, lastNamePaternal: row.doctorLastNamePaternal, lastNameMaternal: row.doctorLastNameMaternal });
    return { doctorName, consultations: row.total, prescriptions: prescriptionByDoctor.get(doctorName) ?? 0 };
  });

  for (const row of doctorPrescriptions) {
    const doctorName = formatPersonName({ firstName: row.doctorFirstName, lastNamePaternal: row.doctorLastNamePaternal, lastNameMaternal: row.doctorLastNameMaternal });
    if (!doctorProductivity.some((item) => item.doctorName === doctorName)) {
      doctorProductivity.push({ doctorName, consultations: 0, prescriptions: row.total });
    }
  }
  doctorProductivity.sort((a, b) => b.consultations - a.consultations);

  const outOfRangeVitals = vitalRows.map((row) => {
    const vitalFields = {
      systolicPressure: row.systolicPressure, diastolicPressure: row.diastolicPressure,
      heartRate: row.heartRate, oxygenSaturation: row.oxygenSaturation,
      temperature: row.temperature, glucose: row.glucose,
    };
    if (!hasVitalAlerts(vitalFields)) return null;
    return {
      id: row.id, recordedAt: row.recordedAt, patientId: row.patientId,
      patientName: formatPersonName({ firstName: row.patientFirstName, lastNamePaternal: row.patientLastNamePaternal, lastNameMaternal: row.patientLastNameMaternal }),
      chartNumber: row.chartNumber, alerts: getVitalAlerts(vitalFields),
    };
  }).filter((row): row is NonNullable<typeof row> => row != null).slice(0, 25);

  const activityByModule = activityRows.map((row) => ({
    module: row.module,
    moduleLabel: ACTIVITY_MODULE_LABELS[row.module as keyof typeof ACTIVITY_MODULE_LABELS] ?? row.module,
    total: row.total,
  }));

  return {
    periodDays, periodStart,
    summary: {
      newPatients: newPatientsRow?.total ?? 0,
      appointments: appointmentsRow?.total ?? 0,
      consultations: consultationsRow?.total ?? 0,
      prescriptions: prescriptionsRow?.total ?? 0,
      followUps: followUpsRow?.total ?? 0,
      vitalCaptures: vitalCapturesRow?.total ?? 0,
      outOfRangeVitals: vitalRows.filter((row) => hasVitalAlerts({
        systolicPressure: row.systolicPressure, diastolicPressure: row.diastolicPressure,
        heartRate: row.heartRate, oxygenSaturation: row.oxygenSaturation,
        temperature: row.temperature, glucose: row.glucose,
      })).length,
      deviceReadings: deviceReadingsRow?.total ?? 0,
      labResults: labResultsRow?.total ?? 0,
      paymentsPaid: paymentsPaidRow?.total ?? 0,
      digitalSignatures: signaturesRow?.total ?? 0,
      teleconsultas: teleconsultasRow?.total ?? 0,
    },
    appointmentsByStatus, doctorProductivity, activityByModule, outOfRangeVitals,
  };
}
