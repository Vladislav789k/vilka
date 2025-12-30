import { Client } from "minio";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function getMinioClient(): Client {
  const endPoint = requiredEnv("MINIO_ENDPOINT");
  const port = Number(requiredEnv("MINIO_PORT"));
  const useSSL = (process.env.MINIO_USE_SSL ?? "false") === "true";
  const accessKey = requiredEnv("MINIO_ACCESS_KEY");
  const secretKey = requiredEnv("MINIO_SECRET_KEY");

  if (!Number.isFinite(port)) {
    throw new Error("MINIO_PORT must be a number");
  }

  return new Client({
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey,
  });
}

export async function ensureBucketExists(client: Client, bucket: string) {
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket);
  }
}

export function getMinioBucket(): string {
  return process.env.MINIO_BUCKET ?? "media";
}


