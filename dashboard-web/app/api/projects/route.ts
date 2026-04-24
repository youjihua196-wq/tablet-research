import { NextResponse } from "next/server";
import { listProjects } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const projects = listProjects();
  return NextResponse.json(projects);
}
