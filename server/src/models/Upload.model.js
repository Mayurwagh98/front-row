import mongoose from 'mongoose';

// Uploaded poster images live in MongoDB, not on disk: free hosts (Render, etc.) wipe the filesystem on every
// restart/redeploy, which would make uploaded posters disappear. Posters are small (3 MB cap), so this is fine.
const uploadSchema = new mongoose.Schema(
  { data: { type: Buffer, required: true }, contentType: { type: String, required: true } },
  { timestamps: true }
);

export default mongoose.model('Upload', uploadSchema);
