import { NextResponse } from "next/server";

const messages: Array<Record<string, unknown>> = [];

export async function GET() {
  return NextResponse.json(messages);
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.content?.trim()) return NextResponse.json({ message: "메시지를 입력해 주세요." }, { status: 400 });
  const message = { id: crypto.randomUUID(), ...body, createdAt: new Date().toISOString() };
  messages.push(message);
  return NextResponse.json(message, { status: 201 });
}
