import { NextRequest, NextResponse } from "next/server";
import { getProjectAnalysis } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const data = getProjectAnalysis(params.slug);
  if (!data) {
    return NextResponse.json({ error: "No analysis data found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
