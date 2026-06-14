import { NextResponse } from "next/server";
import {
  getActiveGeneratedCurriculum,
  getCurriculumSections,
  getCurriculumSummary,
  getGeneratedCurriculumStatus
} from "@/lib/curriculum";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const [status, generatedCurriculum] = await Promise.all([
    getGeneratedCurriculumStatus(),
    getActiveGeneratedCurriculum()
  ]);

  return NextResponse.json({
    status,
    generatedCurriculum,
    fallbackSeed: {
      active: !generatedCurriculum,
      summary: getCurriculumSummary(),
      sections: generatedCurriculum ? [] : getCurriculumSections()
    }
  });
}
