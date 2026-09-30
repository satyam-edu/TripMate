// Integration test against the real (dev) database — same pattern used for manual
// E2E checks throughout this project: create real rows, call the real controller,
// assert, then delete everything it created.
import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import '../middlewares/auth.middleware'; // pulls in the `req.userId` ambient type augmentation
import { prisma } from '../config/prisma';
import { updateRequestStatus } from './request.controller';

function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    end() {
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

let host: { id: string };
let traveller: { id: string };
let stranger: { id: string };
let tripId: string;
let requestId: string;

before(async () => {
  host = await prisma.user.create({ data: { googleId: 'test-permtest-host', name: 'Perm Host' } });
  traveller = await prisma.user.create({ data: { googleId: 'test-permtest-trav', name: 'Perm Traveller' } });
  stranger = await prisma.user.create({ data: { googleId: 'test-permtest-stranger', name: 'Perm Stranger' } });

  const trip = await prisma.trip.create({
    data: {
      hostId: host.id,
      destination: 'Permission Test Trip',
      country: 'India',
      startDate: new Date(Date.now() + 7 * 86400000),
      endDate: new Date(Date.now() + 10 * 86400000),
      budget: 5000,
      maxGuests: 5,
    },
  });
  tripId = trip.id;

  const request = await prisma.request.create({
    data: { tripId, userId: traveller.id, status: 'PENDING' },
  });
  requestId = request.id;
});

after(async () => {
  await prisma.request.deleteMany({ where: { tripId } });
  await prisma.trip.delete({ where: { id: tripId } });
  await prisma.user.deleteMany({ where: { id: { in: [host.id, traveller.id, stranger.id] } } });
  await prisma.$disconnect();
});

test('a stranger cannot approve someone else\'s trip request', async () => {
  const req = { params: { id: requestId }, body: { status: 'APPROVED' }, userId: stranger.id } as unknown as Request;
  const res = fakeRes();

  await updateRequestStatus(req, res);

  assert.equal(res.statusCode, 403);
  const unchanged = await prisma.request.findUnique({ where: { id: requestId } });
  assert.equal(unchanged?.status, 'PENDING', 'request must stay PENDING when a non-host tries to decide it');
});

test('the trip host can approve the request', async () => {
  const req = { params: { id: requestId }, body: { status: 'APPROVED' }, userId: host.id } as unknown as Request;
  const res = fakeRes();

  await updateRequestStatus(req, res);

  assert.equal(res.statusCode, 200);
  const updated = await prisma.request.findUnique({ where: { id: requestId } });
  assert.equal(updated?.status, 'APPROVED');
});
