Call the SQUAD image tool exactly once:

tools.squad.image({
  prompt: "Flat vector test card: a black square centered on a white background, no text, no gradients",
  model: "opencode/gpt-image-2.5-sunburst",
  aspect: "1:1",
  resolution: "1K",
  n: 1,
  name: "m6-image-smoke"
})

Return only the raw tool output.
