import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { emitToUsers } from '../socket';
import { isBlockedEitherWay, blockedUserIds } from './safety.controller';

// Two kinds of chat:
//   groups    → one per trip, for the host + APPROVED travellers   (id = tripId)
//   inquiries → one per join request, for the requester + the host (id = requestId)
type ChatKind = 'groups' | 'inquiries';

const messageSelect = {
  id: true,
  text: true,
  createdAt: true,
  sender: { select: { id: true, name: true, avatar: true } },
  replyTo: { select: { id: true, text: true, sender: { select: { id: true, name: true } } } },
} as const;

// Who may read/write a chat. Returns null when the user isn't a member.
// Queries run in parallel (not nested) so each check costs one database round trip.
async function getChatAccess(kind: ChatKind, id: string, userId: string) {
  if (kind === 'groups') {
    const [trip, approved] = await Promise.all([
      prisma.trip.findUnique({ where: { id }, select: { hostId: true, destination: true } }),
      prisma.request.findMany({ where: { tripId: id, status: 'APPROVED' }, select: { userId: true } }),
    ]);
    if (!trip) return null;
    const members = [trip.hostId, ...approved.map((r) => r.userId)];
    return members.includes(userId) ? { tripId: id, requestId: null, members, title: trip.destination } : null;
  }

  const [request, trip] = await Promise.all([
    prisma.request.findUnique({ where: { id }, select: { userId: true, tripId: true, status: true } }),
    prisma.trip.findFirst({ where: { requests: { some: { id } } }, select: { hostId: true, destination: true } }),
  ]);
  // Declined requests close the inquiry chat; so does either side blocking the other.
  if (!request || !trip || request.status === 'REJECTED') return null;
  if (await isBlockedEitherWay(request.userId, trip.hostId)) return null;
  const members = [request.userId, trip.hostId];
  return members.includes(userId) ? { tripId: request.tripId, requestId: id, members, title: trip.destination } : null;
}

const chatKey = (kind: ChatKind, id: string) => `${kind}:${id}`;

function parseKind(value: unknown): ChatKind | null {
  return value === 'groups' || value === 'inquiries' ? value : null;
}

// Every chat the user belongs to, with the latest message and how many messages are unread.
async function buildChats(userId: string) {
  const latest = { orderBy: { createdAt: 'desc' as const }, take: 1, select: messageSelect };

  const [trips, requests] = await Promise.all([
    prisma.trip.findMany({
      where: { OR: [{ hostId: userId }, { requests: { some: { userId, status: 'APPROVED' } } }] },
      include: {
        _count: { select: { requests: { where: { status: 'APPROVED' } } } },
        messages: { where: { requestId: null }, ...latest },
      },
    }),
    prisma.request.findMany({
      where: { status: { not: 'REJECTED' }, OR: [{ userId }, { trip: { hostId: userId } }] },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        trip: { select: { destination: true, host: { select: { id: true, name: true, avatar: true } } } },
        messages: latest,
      },
    }),
  ]);

  // Drop inquiries with anyone blocked either-way — hides them from both sides' chat lists.
  const hidden = await blockedUserIds(userId);
  const visibleRequests = requests.filter((r) => !hidden.has(r.userId === userId ? r.trip.host.id : r.user.id));

  // Unread = messages from others newer than when I last opened that chat.
  // ponytail: one COUNT per chat; fine for a handful of chats, batch into one SQL query if lists get long.
  const reads = await prisma.chatRead.findMany({ where: { userId } });
  const lastRead = new Map(reads.map((r) => [r.chatKey, r.lastReadAt]));
  const countUnread = (tripId: string, requestId: string | null, key: string) =>
    prisma.message.count({
      where: { tripId, requestId, senderId: { not: userId }, createdAt: { gt: lastRead.get(key) ?? new Date(0) } },
    });
  const [groupUnread, inquiryUnread] = await Promise.all([
    Promise.all(trips.map((t) => countUnread(t.id, null, chatKey('groups', t.id)))),
    Promise.all(visibleRequests.map((r) => countUnread(r.tripId, r.id, chatKey('inquiries', r.id)))),
  ]);

  const groups = trips.map((t, i) => ({
    kind: 'groups' as const,
    id: t.id,
    title: t.destination,
    image: t.coverImage,
    startDate: t.startDate,
    endDate: t.endDate,
    spotsFilled: t._count.requests + 1, // host takes a spot
    maxGuests: t.maxGuests,
    lastMessage: t.messages[0] ?? null,
    unread: groupUnread[i]!,
    activityAt: t.messages[0]?.createdAt ?? t.createdAt,
  }));

  const inquiries = visibleRequests.map((r, i) => {
    const other = r.userId === userId ? r.trip.host : r.user;
    // The join pitch acts as the first message until someone replies.
    const pitch = r.message ? { id: `pitch-${r.id}`, text: r.message, createdAt: r.createdAt, sender: r.user } : null;
    const lastMessage = r.messages[0] ?? pitch;
    return {
      kind: 'inquiries' as const,
      id: r.id,
      title: other.name,
      image: other.avatar,
      status: r.status,
      destination: r.trip.destination,
      lastMessage,
      unread: inquiryUnread[i]!,
      activityAt: lastMessage?.createdAt ?? r.createdAt,
    };
  });

  const byActivity = (a: { activityAt: Date }, b: { activityAt: Date }) =>
    b.activityAt.getTime() - a.activityAt.getTime();
  return { groups: groups.sort(byActivity), inquiries: inquiries.sort(byActivity) };
}

// GET /api/chats
// Every chat the user belongs to, with the latest message and unread count.
export const getChats = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await buildChats(req.userId as string));
  } catch (error) {
    console.error('[getChats]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// GET /api/chats/unread-count
// Total unread messages across all chats (the badge on the Chats menu item).
export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { groups, inquiries } = await buildChats(req.userId as string);
    const total = [...groups, ...inquiries].reduce((sum, c) => sum + c.unread, 0);
    res.status(200).json({ total });
  } catch (error) {
    console.error('[getUnreadCount]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// POST /api/chats/:kind/:id/read
// Marks a chat as read up to now (called when the user opens / is viewing it).
export const markChatRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const kind = parseKind(req.params['kind']);
    const id = req.params['id'] as string;
    const userId = req.userId as string;
    if (!kind || !(await getChatAccess(kind, id, userId))) {
      res.status(404).json({ error: 'Chat not found.' });
      return;
    }
    const key = chatKey(kind, id);
    const now = new Date();
    await prisma.chatRead.upsert({
      where: { userId_chatKey: { userId, chatKey: key } },
      update: { lastReadAt: now },
      create: { userId, chatKey: key, lastReadAt: now },
    });
    res.status(204).end();
  } catch (error) {
    console.error('[markChatRead]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// GET /api/chats/:kind/:id/messages
// The latest 200 messages of one chat, oldest first.
export const getMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const kind = parseKind(req.params['kind']);
    const id = req.params['id'] as string;
    if (!kind) {
      res.status(404).json({ error: 'Chat not found.' });
      return;
    }
    const access = await getChatAccess(kind, id, req.userId as string);
    if (!access) {
      res.status(404).json({ error: 'Chat not found.' });
      return;
    }

    // ponytail: fixed 200-message window, add "load older" paging when chats get long.
    const recent = await prisma.message.findMany({
      where: { tripId: access.tripId, requestId: access.requestId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: messageSelect,
    });
    const messages: unknown[] = recent.reverse();

    // Inquiry chats open with the traveller's join pitch.
    if (kind === 'inquiries') {
      const request = await prisma.request.findUnique({
        where: { id },
        select: { message: true, createdAt: true, user: { select: { id: true, name: true, avatar: true } } },
      });
      if (request?.message) {
        messages.unshift({ id: `pitch-${id}`, text: request.message, createdAt: request.createdAt, sender: request.user });
      }
    }

    res.status(200).json(messages);
  } catch (error) {
    console.error('[getMessages]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// POST /api/chats/:kind/:id/messages
// Saves a message and pushes it live to every member of the chat.
// Speed matters here (the database is a ~130 ms round trip away), so all lookups run
// in parallel and the insert is a single plain INSERT: about 2 round trips in total.
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const kind = parseKind(req.params['kind']);
    const id = req.params['id'] as string;
    const userId = req.userId as string;
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const replyToId = typeof req.body?.replyToId === 'string' ? req.body.replyToId : null;

    if (!text || text.length > 1000) {
      res.status(400).json({ error: 'Message must be 1 to 1000 characters.' });
      return;
    }
    if (!kind) {
      res.status(404).json({ error: 'Chat not found.' });
      return;
    }

    const [access, sender, original, originalSender] = await Promise.all([
      getChatAccess(kind, id, userId),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, avatar: true } }),
      replyToId
        ? prisma.message.findUnique({ where: { id: replyToId }, select: { id: true, text: true, tripId: true, requestId: true } })
        : null,
      replyToId
        ? prisma.user.findFirst({ where: { messages: { some: { id: replyToId } } }, select: { id: true, name: true } })
        : null,
    ]);
    if (!access || !sender) {
      res.status(404).json({ error: 'Chat not found.' });
      return;
    }
    // Optional reply: the quoted message must be in this same chat.
    if (replyToId && (!original || !originalSender || original.tripId !== access.tripId || original.requestId !== access.requestId)) {
      res.status(400).json({ error: 'You can only reply to a message in this chat.' });
      return;
    }

    const saved = await prisma.message.create({
      data: { tripId: access.tripId, requestId: access.requestId, senderId: userId, text, replyToId },
      select: { id: true, createdAt: true },
    });

    // Same shape as messageSelect, built from what we already loaded.
    const message = {
      ...saved,
      text,
      sender,
      replyTo: original && originalSender ? { id: original.id, text: original.text, sender: originalSender } : null,
    };

    emitToUsers(access.members, 'chat:message', { kind, conversationId: id, chatTitle: access.title, message });
    res.status(201).json(message);
  } catch (error) {
    console.error('[sendMessage]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};
