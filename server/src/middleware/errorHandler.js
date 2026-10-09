export function errorHandler(err, req, res, next) {
  // Upload problems are the user's to fix, not server faults.
  if (err.code === "LIMIT_FILE_SIZE")
    return res
      .status(400)
      .json({
        success: false,
        message: "That image is too large. Use one under 3 MB.",
      });
  if (err.message === "BAD_TYPE")
    return res
      .status(400)
      .json({
        success: false,
        message: "Only JPG, PNG or WebP images are allowed.",
      });
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
}
