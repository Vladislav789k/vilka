import { NextRequest, NextResponse } from "next/server";
import { acceptClaim } from "@/lib/yandexDelivery/client";

type AcceptRequest = {
  claimId: string;
  version: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<AcceptRequest>;
    const claimId = String(body.claimId ?? "").trim();
    const version = Number(body.version);

    if (!claimId) {
      return NextResponse.json({ error: "claimId обязателен" }, { status: 400 });
    }
    if (!Number.isFinite(version) || version < 0) {
      return NextResponse.json({ error: "version обязателен" }, { status: 400 });
    }

    const res = await acceptClaim({ claimId, version });
    return NextResponse.json(res);
  } catch (e) {
    console.error("[POST /api/delivery/yandex/accept] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server_error" },
      { status: 500 }
    );
  }
}

