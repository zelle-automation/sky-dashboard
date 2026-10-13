import { renderArt } from "@/lib/art";

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const svg = renderArt((await ctx.params).name);
  if (!svg) return new Response("Not found", { status: 404 });
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
