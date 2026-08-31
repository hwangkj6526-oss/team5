import { NextResponse } from "next/server";

const plans: Array<Record<string, unknown>> = [];

export async function GET() {
  return NextResponse.json(plans);
}

export async function POST(request: Request) {
  const body = await request.json();
  const plan = { id: crypto.randomUUID(), ...body, createdAt: new Date().toISOString() };
  plans.unshift(plan);
  return NextResponse.json(plan, { status: 201 });
}
