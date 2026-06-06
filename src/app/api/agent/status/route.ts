import { NextResponse } from "next/server";
import { getAgentStatus } from "@/lib/agent/spanish-agent";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getAgentStatus());
}
