import {z, ZodType} from 'zod'
import type {ZodObjectOrWrapped} from './utils'

/**
 * Represents any valid JSON value.
 */
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONObject
  | JSONValue[];

/**
 * Represents a JSON object.
 */
export type JSONObject = {
  [key: string]: JSONValue
};

export type JSONSchema = {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema | JSONSchema[];
  required?: string[];
  enum?: (string | number)[];
  additionalProperties?: boolean | JSONSchema;
  [key: string]: any; // For any other additional properties
};


export function mapJsonSchemaToZod(schema: JSONSchema): ZodObjectOrWrapped {
  if (schema.type === 'object') {
    const properties = schema.properties ?? {};
    const required = schema.required ?? [];

    const objectShape: Record<string, ZodType<any, any>> = {};

    Object.keys(properties).forEach((key) => {
      const property = properties[key];
      const isRequired = required.includes(key);

      let zodValidator: ZodType<any, any>;

      switch (property.type) {
        case 'string':
          zodValidator = z.string().describe(property.description);
          break;
        case 'boolean':
          zodValidator = z.boolean().describe(property.description);
          break;
        case 'number':
          zodValidator = z.number().describe(property.description);
          break;
        case 'array':
          zodValidator = z.array(z.string()).describe(property.description);
          break;
        default:
          throw new Error(`Unsupported property type: ${property.type}`);
      }

      // Apply default if it exists in the property
      if (property.default !== undefined) {
        zodValidator = zodValidator.default(property.default);
      } else if (schema.default && schema.default[key] !== undefined) {
        zodValidator = zodValidator.default(schema.default[key]);
      }

      // If no required fields are specified, make all fields optional
      if (!isRequired) {
        zodValidator = zodValidator.optional();
      }

      objectShape[key] = zodValidator;
    });

    return z.object(objectShape).strict(); // strict() to enforce no additional properties
  } else {
    throw new Error(`Unsupported schema type: ${schema.type}`);
  }
}
