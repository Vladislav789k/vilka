import { NextRequest, NextResponse } from "next/server";
import { getClaimInfo } from "@/lib/yandexDelivery/client";

type InfoRequest = {
  claimId: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<InfoRequest>;
    const claimId = String(body.claimId ?? "").trim();
    if (!claimId) {
      return NextResponse.json({ error: "claimId обязателен" }, { status: 400 });
    }

    const info = await getClaimInfo({ claimId });
    return NextResponse.json(info);
  } catch (e) {
    console.error("[POST /api/delivery/yandex/info] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "server_error" },
      { status: 500 }
    );
  }
}

