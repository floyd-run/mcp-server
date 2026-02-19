import { z } from "zod";

const configSchema = z.object({
  floydApiKey: z.string().min(1),
  floydBaseUrl: z
    .string()
    .url()
    .default("https://api.floyd.run/v1")
    .transform((url) => url.replace(/\/+$/, "")),
  port: z.coerce.number().int().min(1).max(65535).default(3000),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  return configSchema.parse({
    floydApiKey: process.env.FLOYD_API_KEY,
    floydBaseUrl: process.env.FLOYD_BASE_URL || undefined,
    port: process.env.PORT || undefined,
  });
}
