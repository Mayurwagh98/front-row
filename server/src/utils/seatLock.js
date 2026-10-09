import { redis } from "../config/redis.js";

export const LOCK_TTL_SECONDS = 300; // 5-minute hold
const lockKey = (showtimeId, seatId) => `lock:seat:${showtimeId}:${seatId}`;

/**
 * RACE CONDITION PREVENTION:
 * `SET key value NX EX 300` is a single atomic Redis command. NX = "only set if
 * absent", so when many users click the same seat at once, exactly ONE call
 * returns "OK". There is no read-then-write gap. EX makes the lock self-expire,
 * so crashed tabs / dropped connections never hold a seat forever.
 * The value is the sessionId so we can verify ownership later.
 */
export async function lockSeat(showtimeId, seatId, sessionId) {
  const res = await redis.set(lockKey(showtimeId, seatId), sessionId, {
    nx: true,
    ex: LOCK_TTL_SECONDS,
  });
  return res === "OK";
}

// Compare-and-delete in Lua so GET+DEL is atomic: we can never delete a lock that
// expired and was re-acquired by someone else between the two steps (TOCTOU).
const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end`;

export async function releaseSeat(showtimeId, seatId, sessionId) {
  const res = await redis.eval(
    RELEASE_SCRIPT,
    [lockKey(showtimeId, seatId)],
    [sessionId],
  );
  return res === 1;
}

export const getLockOwner = (showtimeId, seatId) =>
  redis.get(lockKey(showtimeId, seatId));

/** Lock several seats all-or-nothing. Returns { ok, failedSeatId }. */
export async function lockSeats(showtimeId, seatIds, sessionId) {
  const acquired = [];
  for (const id of seatIds) {
    if (await lockSeat(showtimeId, id, sessionId)) acquired.push(id);
    else {
      await Promise.all(
        acquired.map((a) => releaseSeat(showtimeId, a, sessionId)),
      );
      return { ok: false, failedSeatId: id };
    }
  }
  return { ok: true };
}
