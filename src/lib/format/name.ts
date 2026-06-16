export function formatPersonName(parts: {
  firstName: string;
  lastNamePaternal: string;
  lastNameMaternal?: string | null;
}) {
  return [parts.firstName, parts.lastNamePaternal, parts.lastNameMaternal]
    .filter(Boolean)
    .join(" ");
}

export function optionLabel(person: {
  firstName: string;
  lastNamePaternal: string;
  lastNameMaternal?: string | null;
  chartNumber?: string;
  specialty?: string | null;
}) {
  const name = formatPersonName(person);
  if (person.chartNumber) return `${person.chartNumber} — ${name}`;
  if (person.specialty) return `${name} (${person.specialty})`;
  return name;
}
