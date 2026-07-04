import { readSession } from "@/lib/server/session";

export async function GET() {
  const session = await readSession();
  return Response.json({ session });
}
