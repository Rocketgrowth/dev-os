export const NDA_STANDARD_TERMS = [
  'Parties',
  'Effective Date',
  'Confidentiality Obligations',
  'Permitted Disclosures',
  'Term & Duration',
  'Governing Law',
  'Jurisdiction',
  'IP Ownership',
  'Non-Solicitation',
  'Breach & Remedy',
] as const

export const MSA_STANDARD_TERMS = [
  'Parties',
  'Service Scope',
  'Payment Terms',
  'Invoice Schedule',
  'Late Payment Penalty',
  'Liability Cap',
  'Indemnification',
  'IP Ownership',
  'Termination Clause',
  'Governing Law',
  'Dispute Resolution',
  'Notice Period',
] as const

export const STANDARD_TERMS = {
  nda: NDA_STANDARD_TERMS,
  msa: MSA_STANDARD_TERMS,
} as const

export type NdaTerm = (typeof NDA_STANDARD_TERMS)[number]
export type MsaTerm = (typeof MSA_STANDARD_TERMS)[number]
