# NoteHacks

Ever found yourself struggling to keep up during a lecture, caught between listening to the professor while scrambling to scribble down notes? It’s all too common to miss key points while juggling the demands of note-taking — that’s why we created a tool designed to do the hard work for you!

## What it does
With a simple click, you can start recording of your lecture, and NoteHacks will start generating clear, summarized notes in real time. The summary conciseness parameter can be fine tuned depending on how you want your notes written, and will take note of when it looks like you've been distracted so that you can have all those details you would have missed. These notes are stored for future review, where you can directly ask AI about the content without having to provide background details. 

## Stack
- Backend + database using Convex
- Frontend using Next.js
- Image, speech, and text models by Groq

## Setup

### Backend

This should install all requirements and then spin up the FastAPI backend:
```
pip install -r requirements.txt
./main.py
```

### Frontend

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the result.

#### Environment variables

To test signing in with Clerk and making posts, follow these steps:

1. Follow the first 3 steps from the [Get Started](https://docs.convex.dev/auth/clerk) guide for Clerk.
2. Instead of pasting your _Issuer URL_ to the config file add an environment variable `CLERK_JWT_ISSUER_DOMAIN` with the _Issuer URL_ to your Deployment Settings on the Convex [dashboard](https://dashboard.convex.dev/)
3. In your `.env.local` file add a variable `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` with your Publishable Key (see step 7 of the [Get Started](https://docs.convex.dev/auth/clerk) guide)
