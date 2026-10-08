import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsFQDN,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/**
 * Validation shared by the create and update Company Profile DTOs. Every
 * message starts with the property it concerns (`$property …` or
 * `each value in $property …`), which is how the companies page ties a
 * server error to its form field.
 */

export const MAX_NAME_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_LIST_SIZE = 50;

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimEach(value: unknown): unknown {
  return Array.isArray(value) ? value.map(trimString) : value;
}

/** Trimmed, non-blank display name. `required` false lets it be left out — but never null. */
export function DisplayNameField(required: boolean): PropertyDecorator {
  return applyDecorators(
    ...(required ? [] : [ValidateIf((_object: object, value: unknown) => value !== undefined)]),
    Transform(({ value }: { value: unknown }) => trimString(value)),
    IsString(),
    IsNotEmpty({ message: '$property must not be empty' }),
    MaxLength(MAX_NAME_LENGTH),
  );
}

/** A list of trimmed, non-blank names; may be left out, never null. */
export function NameListField(): PropertyDecorator {
  return applyDecorators(
    ValidateIf((_object: object, value: unknown) => value !== undefined),
    Transform(({ value }: { value: unknown }) => trimEach(value)),
    IsArray(),
    ArrayMaxSize(MAX_LIST_SIZE),
    IsString({ each: true }),
    IsNotEmpty({ each: true, message: 'each value in $property must not be empty' }),
    MaxLength(MAX_NAME_LENGTH, { each: true }),
  );
}

/** The company's own web hostname (`lambda.ai`), lower-cased; null or blank clears it. */
export function DomainField(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => {
      const trimmed = trimString(value);
      if (trimmed === '') return null;
      return typeof trimmed === 'string' ? trimmed.toLowerCase() : trimmed;
    }),
    IsOptional(),
    IsString(),
    IsFQDN({ require_tld: true }, { message: '$property must be a valid hostname, e.g. lambda.ai' }),
    MaxLength(MAX_NAME_LENGTH),
  );
}

/** A one-line description; null or blank clears it. */
export function DescriptionField(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => {
      const trimmed = trimString(value);
      return trimmed === '' ? null : trimmed;
    }),
    IsOptional(),
    IsString(),
    MaxLength(MAX_DESCRIPTION_LENGTH),
  );
}
