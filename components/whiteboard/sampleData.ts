import type { WhiteboardData } from "./types"

export const SAMPLE_WHITEBOARD: WhiteboardData = {
  stage: "DEFINE",
  clusters: {
    "User Problems": {
      at: [0, 0], // Top-left
      items: [
        {
          id: "prob-1",
          heading: "Anxiety about once-a-year trip",
          body: "Users feel pressure because they only take one big vacation per year. The stakes feel very high.",
          at: [0, 0],
        },
        {
          id: "prob-2",
          heading: "Not sure how to assess quality",
          at: [1, 0],
        },
        {
          id: "prob-3",
          heading: "Unclear who is hosting",
          body: "Trust comes from reviews and social proof, but reviews can feel fake or outdated. Users want to know who they're dealing with.",
          at: [2, 0],
        },
        {
          id: "prob-4",
          heading: "Fear of hidden fees",
          body: "Cleaning fees, service fees, and other charges that appear at checkout erode trust and make comparison shopping difficult.",
          at: [0, 1],
        },
        {
          id: "prob-5",
          heading: "Photos don't match reality",
          at: [1, 1],
        },
      ],
    },
    Goals: {
      at: [0, 1], // Below User Problems
      items: [
        {
          id: "goal-1",
          heading: "Give user tools to feel confident",
          body: "Provide transparent pricing, verified photos, and clear host communication to build trust before booking.",
          at: [0, 0],
        },
        {
          id: "goal-2",
          heading: "Reassure not a one-way door",
          body: "Make cancellation policies crystal clear and offer protection for when things go wrong.",
          at: [1, 0],
        },
        {
          id: "goal-3",
          heading: "Surface social proof effectively",
          at: [2, 0],
        },
      ],
    },
    "User Journey": {
      at: [1, 0], // Right of User Problems
      items: [
        {
          id: "journey-1",
          heading: "Discovery → Search → Browse → Compare → Decide → Book → Travel",
          body: "Each step has unique anxieties. Discovery is exciting, but anxiety peaks at the Book stage.",
          at: [0, 0],
        },
      ],
    },
    Insights: {
      at: [1, 1], // Below User Journey
      items: [
        {
          id: "insight-1",
          heading: "Price anchoring matters",
          body: "Users compare to hotel prices. If Airbnb feels more expensive after fees, trust drops sharply.",
          at: [0, 0],
        },
        {
          id: "insight-2",
          heading: "Group bookings are complex",
          body: "When booking for a group, the decision-maker carries extra pressure and needs more validation.",
          at: [1, 0],
        },
      ],
    },
  },
  floating: [
    {
      id: "float-1",
      content: "Expensive trips make decision-making brittle and critical",
      at: [5, 0],
    },
    {
      id: "float-2",
      content: "Mobile users have different anxiety patterns than desktop",
      at: [5, 1],
    },
  ],
  connections: [
    { from: "prob-3", to: "goal-1" },
    { from: "prob-4", to: "goal-1" },
    { from: "prob-1", to: "goal-2" },
    { from: "insight-1", to: "prob-4" },
  ],
  hmw: [
    "How might we help guests feel trust before booking?",
    "How might we reduce anxiety between booking and arrival?",
    "How might we make group trip planning less stressful?",
  ],
  open_questions: [
    "What are all the signals of trust in a listing?",
    "How do group trips affect decision-making?",
    "What's the right balance of info vs. overwhelm?",
  ],
}
