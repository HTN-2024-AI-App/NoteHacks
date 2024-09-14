import { mutation } from "./_generated/server";
import { v } from "convex/values";

export default mutation({
  args: {
    title: v.string(),
    transcription: v.string(),
  },
  handler: async (ctx, { title, transcription }) => {
    // Convert the current date to a timestamp
    const createdAt = Date.now(); // Current time in milliseconds
    
    // Insert the data into the "lectures" collection
    await ctx.db.insert("lectures", {
      title,
      transcription,
      createdAt, // Use timestamp for createdAt
    });
  },
});
