import { z } from 'zod';

/**
 * Zod raw shapes for RPC function arguments.
 * Keys match the exact parameter names (snake_case) used in lib/core/*.ts
 */
export const RPC_SCHEMAS: Record<string, z.ZodRawShape> = {
  // sc.ts
  scCreate: {
    xe_id: z.string(),
    ngay: z.string(),
  },
  scAddCongViec: {
    sc_id: z.string(),
    mo_ta: z.string(),
    nguyen_nhan: z.string().optional(),
    loai_xu_ly: z.string().optional(),
    so_luong: z.number().optional(),
    don_gia: z.number().optional(),
  },
  scAddVatTu: {
    sc_id: z.string(),
    vattu_id: z.string(),
    so_luong: z.number(),
  },
  scBatDauSua: {
    sc_id: z.string(),
  },
  scHoanThanh: {
    sc_id: z.string(),
  },
  scTuChoi: {
    sc_id: z.string(),
    ly_do: z.string(),
  },
  scQuyetToan: {
    sc_id: z.string(),
  },

  // ho_so.ts
  keHoachSave: {
    sc_id: z.string(),
    mo_ta: z.string().optional(),
  },
  kiemTuSave: {
    sc_id: z.string(),
    mo_ta: z.string().optional(),
  },
  nghiemThuSave: {
    sc_id: z.string(),
    ngay_nghiem: z.string().optional(),
    tong_vat_tu: z.number().optional(),
    tong_nhan_cong: z.number().optional(),
  },
  hoSoSave: {
    sc_id: z.string(),
    so_chung_tu: z.string().optional(),
    ngay: z.string().optional(),
    ghi_chu: z.string().optional(),
  },

  // baogia.ts
  baogiaSave: {
    sc_id: z.string(),
    ncc: z.string().optional(),
    ngay: z.string(),
    items: z.any(),
  },

  // kho.ts
  nhapKho: {
    vattu_id: z.string(),
    so_luong: z.number(),
    don_gia: z.number().optional(),
    ngay: z.string(),
    ly_do: z.string().optional(),
  },
  xuatKho: {
    vattu_id: z.string(),
    so_luong: z.number(),
    sc_id: z.string().optional(),
    ly_do: z.string().optional(),
  },
  vattuCreate: {
    ten: z.string(),
    ma: z.string().optional(),
    don_vi: z.string().optional(),
    gia: z.number().optional(),
    ton_min: z.number().optional(),
  },
  dmCreate: {
    sc_id: z.string().optional(),
    items: z.any(),
    ngay: z.string(),
  },
  dmNhap: {
    dm_id: z.string(),
  },
};

/**
 * Convert a ZodRawShape to a JSON Schema object.
 * Supports: z.string(), z.number(), z.boolean(), z.enum([...]), and .optional()
 * Nested objects/arrays use z.any() → treated as { type: 'object', additionalProperties: true }
 */
export function zodShapeToJsonSchema(shape: z.ZodRawShape): any {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, zodType] of Object.entries(shape)) {
    let propSchema: any = { type: 'object', additionalProperties: true }; // default for z.any()
    let isOptional = false;

    // Check if it's an optional wrapper
    if (zodType instanceof z.ZodOptional) {
      isOptional = true;
      // Unwrap to get the inner type
      const innerType = zodType.unwrap();
      propSchema = zodTypeToJsonSchema(innerType);
    } else {
      propSchema = zodTypeToJsonSchema(zodType);
    }

    properties[key] = propSchema;

    if (!isOptional) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: true,
  };
}

function zodTypeToJsonSchema(zodType: z.ZodTypeAny): any {
  // Handle ZodString
  if (zodType instanceof z.ZodString) {
    return { type: 'string' };
  }

  // Handle ZodNumber
  if (zodType instanceof z.ZodNumber) {
    return { type: 'number' };
  }

  // Handle ZodBoolean
  if (zodType instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }

  // Handle ZodEnum
  if (zodType instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: zodType.options,
    };
  }

  // Handle ZodOptional (should be handled by caller, but defensive)
  if (zodType instanceof z.ZodOptional) {
    return zodTypeToJsonSchema(zodType.unwrap());
  }

  // Handle ZodNullable
  if (zodType instanceof z.ZodNullable) {
    const inner = zodTypeToJsonSchema(zodType.unwrap());
    return {
      anyOf: [inner, { type: 'null' }],
    };
  }

  // Handle ZodArray
  if (zodType instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodTypeToJsonSchema(zodType.element),
    };
  }

  // Handle ZodObject
  if (zodType instanceof z.ZodObject) {
    return zodShapeToJsonSchema(zodType.shape);
  }

  // Handle ZodAny, ZodUnknown, ZodUnion, ZodIntersection, etc.
  // Fallback: permissive object
  return { type: 'object', additionalProperties: true };
}

/**
 * Get a Zod schema for a tool input by function name.
 * Returns a Zod schema suitable for MCP SDK's registerTool inputSchema.
 * If shape exists in RPC_SCHEMAS, wraps it; otherwise returns empty passthrough object.
 */
export function getToolInputSchema(fn: string): z.ZodTypeAny {
  const shape = RPC_SCHEMAS[fn];
  return shape ? z.object(shape).passthrough() : z.object({}).passthrough();
}