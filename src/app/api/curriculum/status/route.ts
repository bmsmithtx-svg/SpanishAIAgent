import { NextResponse } from "next/server";
import { getGeneratedCurriculumStatus } from "@/lib/curriculum/generated-curriculum-status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const status = await getGeneratedCurriculumStatus();

  return NextResponse.json(status);
}
