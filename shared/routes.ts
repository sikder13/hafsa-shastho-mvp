import { z } from 'zod';
import { insertUserSchema, insertAppointmentSchema, users, appointments } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    sendOtp: {
      method: 'POST' as const,
      path: '/api/auth/send-otp' as const,
      input: z.object({
        phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
      }),
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    verifyOtp: {
      method: 'POST' as const,
      path: '/api/auth/verify-otp' as const,
      input: z.object({
        phoneNumber: z.string(),
        otp: z.string().length(6, "OTP must be 6 digits"),
      }),
      responses: {
        200: z.object({ user: z.custom<typeof users.$inferSelect>() }),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout' as const,
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect | null>(),
      },
    },
  },
  appointments: {
    list: {
      method: 'GET' as const,
      path: '/api/appointments' as const,
      responses: {
        200: z.array(z.custom<typeof appointments.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/appointments' as const,
      input: insertAppointmentSchema,
      responses: {
        201: z.custom<typeof appointments.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
