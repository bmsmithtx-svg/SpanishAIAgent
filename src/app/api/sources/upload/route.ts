import { NextResponse } from "next/server";
import { uploadSpanishSourcePdf } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files").filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        {
          message: "Upload at least one PDF file using the files field.",
          results: []
        },
        { status: 400 }
      );
    }

    const results = [];

    for (const file of files) {
      results.push(await uploadSpanishSourcePdf(file));
    }

    return NextResponse.json({
      message: "PDF upload processing finished.",
      uploadedCount: results.filter((result) => !result.duplicate && !result.error).length,
      duplicateCount: results.filter((result) => result.duplicate).length,
      failedCount: results.filter((result) => result.error).length,
      results
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "PDF upload failed.",
        error: error instanceof Error ? error.message : "Unknown upload error."
      },
      { status: 500 }
    );
  }
}
