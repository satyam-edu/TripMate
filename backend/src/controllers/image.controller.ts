import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

// Uploaded profile photos / covers, stored in the Image table.
// Uploads arrive as raw bytes (Content-Type image/jpeg|png|webp), already resized by the browser.

const PHOTO_FIELDS = { avatar: 'avatar', cover: 'coverImage' } as const;
type PhotoKind = keyof typeof PHOTO_FIELDS;

// Identify the real file type from its first bytes (never trust the declared type).
function sniffImageType(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

const IMAGE_URL_ID = /\/api\/images\/([0-9a-f-]{36})$/;

// Deletes a previously uploaded image when it's replaced/removed (Google photo URLs are left alone).
async function deleteUploaded(url: string | null | undefined): Promise<void> {
  const id = url?.match(IMAGE_URL_ID)?.[1];
  if (id) await prisma.image.deleteMany({ where: { id } });
}

export function isUploadedImage(url: string | null | undefined): boolean {
  return !!url && IMAGE_URL_ID.test(url);
}

// PUT /api/users/me/photo/:kind   (kind = avatar | cover, body = image bytes)
export const uploadPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const kind = req.params['kind'] as PhotoKind;
    const field = PHOTO_FIELDS[kind];
    if (!field) {
      res.status(404).json({ error: 'Unknown photo type.' });
      return;
    }
    const body: unknown = req.body;
    const mimeType = Buffer.isBuffer(body) ? sniffImageType(body) : null;
    if (!Buffer.isBuffer(body) || !mimeType) {
      res.status(400).json({ error: 'Please upload a JPEG, PNG or WebP image.' });
      return;
    }

    const userId = req.userId as string;
    const before = await prisma.user.findUnique({ where: { id: userId }, select: { avatar: true, coverImage: true } });
    const image = await prisma.image.create({ data: { data: body, mimeType }, select: { id: true } });
    // Absolute URL so it works from the frontend's own domain (Render sets https via trust proxy).
    const url = `${req.protocol}://${req.get('host')}/api/images/${image.id}`;

    const user = await prisma.user.update({ where: { id: userId }, data: { [field]: url } });
    await deleteUploaded(before?.[field]);
    res.status(200).json(user);
  } catch (error) {
    console.error('[uploadPhoto]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// DELETE /api/users/me/photo/:kind   → back to initials (avatar) / default cover
export const removePhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const field = PHOTO_FIELDS[req.params['kind'] as PhotoKind];
    if (!field) {
      res.status(404).json({ error: 'Unknown photo type.' });
      return;
    }
    const userId = req.userId as string;
    const before = await prisma.user.findUnique({ where: { id: userId }, select: { avatar: true, coverImage: true } });
    const user = await prisma.user.update({ where: { id: userId }, data: { [field]: null } });
    await deleteUploaded(before?.[field]);
    res.status(200).json(user);
  } catch (error) {
    console.error('[removePhoto]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// GET /api/images/:id   (public, like any profile photo)
export const getImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const image = await prisma.image.findUnique({ where: { id: req.params['id'] as string } });
    if (!image) {
      res.status(404).end();
      return;
    }
    res.set({
      'Content-Type': image.mimeType,
      // A new upload always gets a new id, so each image never changes → cache it for a year.
      'Cache-Control': 'public, max-age=31536000, immutable',
      // The frontend lives on another domain (Vercel); allow it to show these images.
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    res.send(Buffer.from(image.data));
  } catch (error) {
    console.error('[getImage]', error);
    res.status(500).end();
  }
};
