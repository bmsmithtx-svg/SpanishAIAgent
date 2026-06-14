import { NextResponse } from "next/server";
import { getGeneratedCurriculumStatus } from "@/lib/curriculum";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const status = await getGeneratedCurriculumStatus();

  return NextResponse.json(status);
}
