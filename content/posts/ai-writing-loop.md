# The AI Writing Loop

Shipping with speed does not mean handing over the voice of your blog. This loop keeps you in the driver seat while your AI editor handles structure and surface polish.

## Step 1: Capture raw signal

- Dump the idea into your notes app or directly into `content/posts/<slug>.md`.
- Ignore grammar and sequence for now - focus on the insight.
- Add any supporting links or quotes you plan to reference.

### Prompts that help

```
Summarize this brain dump into the top three points the reader must know.
```

## Step 2: Let AI tighten the prose

Hand the draft to your assistant with clear instructions.

- Ask for a structured outline first, so you can verify the flow.
- Request short paragraphs and actionable takeaways.
- Reject any hallucinated facts or tools that do not exist.

## Step 3: Review with intention

- Read the suggestions aloud to ensure the tone still sounds like you.
- Merge the edits manually; do not paste blindly.
- Keep your own call to action or next-steps list at the end.

## Step 4: Publish and iterate

- Update `data/posts.json` with any new tags or a revised `summary`.
- Commit the Markdown and catalog together.
- Revisit the post after publishing - append new learnings rather than rewriting history.

> Keep each loop tight. The faster you publish, the easier it is to feed better context back into the assistant.

Once you are comfortable with this rhythm, you can run multiple posts in parallel without losing your voice.
