import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const IMAGES_DIR = path.join(process.cwd(), "../data_pipeline/output/images");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ player_id: string }> }
) {
  const { player_id } = await params;

  if (!/^\d+$/.test(player_id)) {
    return new NextResponse(null, { status: 400 });
  }

  const filePath = path.join(IMAGES_DIR, `${player_id}.png`);

  if (fs.existsSync(filePath)) {
    const file = fs.readFileSync(filePath);

    let contentType = "image/jpeg";
    if (file[0] === 0x89 && file[1] === 0x50) contentType = "image/png";
    else if (file[8] === 0x57 && file[9] === 0x45) contentType = "image/webp";

    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  // fallback to CDN URL from raw JSON (local file missing or not yet downloaded)
  const jsonPath = path.join(process.cwd(), "../data_pipeline/output/players_cards.json");
  if (fs.existsSync(jsonPath)) {
    const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as Array<{ player_id: string | number; image_url?: string }>;
    const entry = raw.find((p) => String(p.player_id) === player_id);
    if (entry?.image_url) {
      return NextResponse.redirect(entry.image_url);
    }
  }

  return new NextResponse(null, { status: 404 });
}
