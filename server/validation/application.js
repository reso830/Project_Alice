import { z } from 'zod';
import { STATUS_VALUES } from '../../shared/constants.js';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const requiredString = (fieldLabel) => z.string({
  error: `${fieldLabel} is required`,
}).trim().min(1, `${fieldLabel} is required`);

const optionalText = z.string().optional();
const emptyString = z.literal('');
const optionalBoolean = z.union([z.boolean(), z.null()])
  .transform((value) => value === true)
  .optional();

const dateField = (fieldLabel) => z.string()
  .regex(datePattern, `${fieldLabel} must use YYYY-MM-DD format`)
  .or(emptyString)
  .transform((value) => (value === '' ? null : value))
  .optional();

const jobPostingUrl = z.string()
  .url('Job posting URL must be a valid URL')
  .refine(
    (value) => value.startsWith('http://') || value.startsWith('https://'),
    'Job posting URL must be a valid http or https URL',
  )
  .or(emptyString)
  .optional();

const compat = z.number()
  .int('Compatibility score must be an integer')
  .min(0, 'Compatibility must be between 0 and 100')
  .max(100, 'Compatibility must be between 0 and 100')
  .optional();

const salary = z.union([
  z.number()
    .int('Salary must be a positive integer or null')
    .positive('Salary must be a positive integer or null'),
  z.null(),
]).optional();

const metadata = z.union([
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
  z.null(),
]).optional();

const status = z.string({
  error: 'Status is required',
}).refine(
  (value) => STATUS_VALUES.includes(value),
  `Status must be one of: ${STATUS_VALUES.join(', ')}`,
);

const writableFields = {
  companyName: requiredString('Company name'),
  jobTitle: requiredString('Job title'),
  status,
  compat,
  fav: optionalBoolean,
  sourcePlatform: optionalText,
  applicationDate: dateField('Application date'),
  jobPostingUrl,
  recruiter: optionalText,
  notes: optionalText,
  salary,
  responsibilities: optionalText,
  skills: z.array(z.string()).optional(),
  followUpAction: optionalText,
  followUpDate: dateField('Follow-up date'),
  metadata,
};

export const createSchema = z.object(writableFields).strip();

export const updateSchema = z.object({
  ...writableFields,
  archived: optionalBoolean,
  companyName: writableFields.companyName.optional(),
  jobTitle: writableFields.jobTitle.optional(),
  status: writableFields.status.optional(),
}).strip();

function fieldMessage(issue) {
  if (issue.code === 'invalid_type' && issue.input === undefined) {
    return 'Required';
  }

  return issue.message;
}

export function toApiError(zodError) {
  return zodError.issues.reduce((fields, issue) => {
    const [field] = issue.path;
    if (typeof field === 'string' && fields[field] === undefined) {
      fields[field] = fieldMessage(issue);
    }
    return fields;
  }, {});
}
