import { NextRequest } from "next/server";

export function jsonRequest(
  body: unknown,
  url = "http://127.0.0.1:3000/api/projects",
) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
