import { NextResponse } from "next/server";
import { getActiveGeneratedCurriculum } from "@/lib/curriculum/generated-curriculum-read";
import { getGeneratedCurriculumStatus } from "@/lib/curriculum/generated-curriculum-status";
import {
  getCurriculumSections,
  getCurriculumSummary
} from "@/lib/curriculum/curriculum-map";

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
