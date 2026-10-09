// Express 4 does not catch rejected promises from async handlers; this forwards them to errorHandler.
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
