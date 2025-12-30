import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import { base64UrlDecode, base64UrlEncode } from "@/lib/base64url";
import { ensureBucketExists, getMinioBucket, getMinioClient } from "@/lib/minio";

export const runtime = "nodejs";

function getIdFromUrl(urlStr: string): number | null {
  try {
    const url = new URL(urlStr);
    const parts = url.pathname.split("/").filter(Boolean);
    const idPart = parts[parts.length - 2]; // .../menu-items/:id/image
    const n = Number(idPart);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function guessExt(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct === "image/jpeg" || ct === "image/jpg") return "jpg";
  if (ct === "image/png") return "png";
  if (ct === "image/webp") return "webp";
  if (ct === "image/gif") return "gif";
  return "bin";
}

export async function POST(req: NextRequest) {
  const menuItemId = getIdFromUrl(req.url);
  if (!menuItemId) {
    return NextResponse.json({ error: "Некорректный id товара в URL" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  if (!restaurantId) {
    return NextResponse.json({ error: "restaurantId обязателен" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Ожидается multipart/form-data" },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Поле file обязательно" }, { status: 400 });
  }

  if (!file.type || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Можно загружать только изображения" }, { status: 400 });
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return NextResponse.json({ error: "Файл пустой" }, { status: 400 });
  }

  // мягкий лимит: 10MB (в nginx уже client_max_body_size 10m)
  const MAX_BYTES = 10 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Файл слишком большой (макс 10MB)" }, { status: 413 });
  }

  // убедимся, что товар существует и принадлежит ресторану; заодно достанем старую картинку
  const { rows } = await query<{ image_url: string | null }>(
    `SELECT image_url FROM menu_items WHERE id = $1 AND restaurant_id = $2`,
    [menuItemId, restaurantId]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
  }

  const oldImageUrl = rows[0].image_url;

  const ext = guessExt(file.type);
  const objectKey = `menu-items/${restaurantId}/${menuItemId}/${Date.now()}-${randomUUID()}.${ext}`;
  const encodedKey = base64UrlEncode(objectKey);

  const client = getMinioClient();
  const bucket = getMinioBucket();
  await ensureBucketExists(client, bucket);

  const buf = Buffer.from(await file.arrayBuffer());

  try {
    await client.putObject(bucket, objectKey, buf, buf.length, {
      "Content-Type": file.type,
      "Cache-Control": "public, max-age=86400",
    });
  } catch (e) {
    console.error("[minio putObject]", e);
    return NextResponse.json({ error: "Не удалось загрузить изображение" }, { status: 500 });
  }

  const newImageUrl = `/api/media/menu-items/${encodedKey}`;

  try {
    await query(
      `UPDATE menu_items SET image_url = $1, updated_at = NOW() WHERE id = $2 AND restaurant_id = $3`,
      [newImageUrl, menuItemId, restaurantId]
    );
  } catch (e) {
    // если БД не обновилась — удаляем загруженный объект, чтобы не мусорить
    try {
      await client.removeObject(bucket, objectKey);
    } catch {
      /* ignore */
    }
    console.error("[db update image_url]", e);
    return NextResponse.json({ error: "Не удалось сохранить изображение" }, { status: 500 });
  }

  // best-effort удаление предыдущего файла, если он тоже из нашего MinIO-прокси
  if (oldImageUrl && oldImageUrl.startsWith("/api/media/menu-items/")) {
    const encodedOld = oldImageUrl.split("/api/media/menu-items/")[1];
    if (encodedOld) {
      try {
        const oldKey = base64UrlDecode(encodedOld);
        await client.removeObject(bucket, oldKey);
      } catch {
        /* ignore */
      }
    }
  }

  return NextResponse.json({ imageUrl: newImageUrl }, { status: 201 });
}


