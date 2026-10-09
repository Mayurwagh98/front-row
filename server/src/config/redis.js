import { Redis } from "@upstash/redis";

// Upstash REST client (HTTP based, no persistent TCP connection needed)
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
