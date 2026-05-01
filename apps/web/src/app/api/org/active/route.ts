import { NextResponse } from "next/server";
import { getActiveOrg } from "@/lib/org";

export async function GET() {
  try {
    const org = await getActiveOrg();
    if (!org) return NextResponse.json({ error: "no_org" }, { status: 404 });
    return NextResponse.json({ org });
  } catch (err) {
    console.error("Failed to resolve active org", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
