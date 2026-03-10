import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    hasCrmUrl: !!process.env.CRM_WEBHOOK_URL,
    crmUrlPrefix: process.env.CRM_WEBHOOK_URL?.substring(0, 20),
    hasCrmSecret: !!process.env.CRM_WEBHOOK_SECRET,
  });
}
