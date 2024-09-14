import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.string(),
    username: v.string(),
    pictureUrl: v.string(),
    numPosts: v.number(),
  })
    .index("tokenIdentifier", ["tokenIdentifier"])
    .index("username", ["username"]),
    
  posts: defineTable({
    authorId: v.id("users"),
    text: v.string(),
  }).index("authorId", ["authorId"]),

  lectures: defineTable({
    title: v.string(),
    transcription: v.string(), // Markdown transcription
    createdAt: v.date(),
  }).index("title", ["title"]),
});