import { runtime } from "@/lib/server/runtime";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return runtime().auth.handler(request);
}

export function POST(request: Request) {
  return runtime().auth.handler(request);
}
