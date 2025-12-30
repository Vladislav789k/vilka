import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { base64UrlDecode } from "@/lib/base64url";
import { ensureBucketExists, getMinioBucket, getMinioClient } from "@/lib/minio";

export const runtime = "nodejs";

function getEncodedFromUrl(urlStr: string): string | null {
  try {
    const url = new URL(urlStr);
    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return last || null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const encoded = getEncodedFromUrl(req.url);
  if (!encoded) {
    return NextResponse.json({ error: "Некорректный ключ" }, { status: 400 });
  }

  let objectKey: string;
  try {
    objectKey = base64UrlDecode(encoded);
  } catch {
    return NextResponse.json({ error: "Некорректный ключ" }, { status: 400 });
  }

  const client = getMinioClient();
  const bucket = getMinioBucket();
  await ensureBucketExists(client, bucket);

  try {
    const stat = await client.statObject(bucket, objectKey);
    const nodeStream = await client.getObject(bucket, objectKey);
    const webStream = Readable.toWeb(nodeStream as any) as ReadableStream;

    return new Response(webStream, {
      headers: {
        "Content-Type": stat.metaData?.["content-type"] || "application/octet-stream",
        "Content-Length": String(stat.size),
        ETag: stat.etag,
        // 1 день: можно увеличить, но пока безопаснее (картинки могут обновляться)
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    // MinIO кидает разные ошибки; проверяем по коду и сообщению
    if (e?.code === "NoSuchKey" || msg.includes("NoSuchKey") || msg.includes("Not Found")) {
      return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
    }
    console.error("[GET /api/media/menu-items]", e);
    return NextResponse.json({ error: "Ошибка при получении файла" }, { status: 500 });
  }
}


