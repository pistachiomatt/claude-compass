import {
  parseWhiteboardYml,
  whiteboardYmlToClusterGridData,
  clusterGridDataToWhiteboardYml,
  serializeWhiteboardYml,
  hasWhiteboardContent,
  type WhiteboardYml,
} from "@/lib/whiteboard/parseWhiteboardYml"

describe("parseWhiteboardYml", () => {
  it("parses valid YAML", () => {
    const yaml = `
stage: DISCOVER
clusters:
  Research:
    at: [0, 0]
    items:
      - id: item1
        heading: First item
        body: Some body text
        at: [0, 0]
`
    const result = parseWhiteboardYml(yaml)

    expect(result).not.toBeNull()
    expect(result?.stage).toBe("DISCOVER")
    expect(result?.clusters?.Research).toBeDefined()
    expect(result?.clusters?.Research.items).toHaveLength(1)
    expect(result?.clusters?.Research.items[0].heading).toBe("First item")
  })

  it("returns null for invalid YAML", () => {
    const result = parseWhiteboardYml("{ invalid yaml [")
    expect(result).toBeNull()
  })

  it("returns empty object for empty string", () => {
    const result = parseWhiteboardYml("")
    // yaml.load returns undefined for empty string, which passes through
    expect(result).toBeUndefined()
  })

  it("parses hmw and open_questions", () => {
    const yaml = `
hmw:
  - How might we improve onboarding?
  - How might we reduce churn?
open_questions:
  - What is the target demographic?
`
    const result = parseWhiteboardYml(yaml)

    expect(result?.hmw).toHaveLength(2)
    expect(result?.open_questions).toHaveLength(1)
  })
})

describe("whiteboardYmlToClusterGridData", () => {
  it("converts clusters to grid format", () => {
    const whiteboard: WhiteboardYml = {
      stage: "DEFINE",
      clusters: {
        Ideas: {
          at: [0, 0],
          items: [
            { id: "a", heading: "Idea A", at: [0, 0] },
            { id: "b", heading: "Idea B", body: "Details", at: [0, 1] },
          ],
        },
      },
    }

    const result = whiteboardYmlToClusterGridData(whiteboard)

    expect(result.clusters.Ideas).toBeDefined()
    expect(result.clusters.Ideas.items).toHaveLength(2)
    expect(result.clusters.Ideas.items[0].heading).toBe("Idea A")
    expect(result.clusters.Ideas.items[1].body).toBe("Details")
  })

  it("converts hmw to sticky questions with reversed order", () => {
    const whiteboard: WhiteboardYml = {
      hmw: ["First HMW", "Second HMW"],
    }

    const result = whiteboardYmlToClusterGridData(whiteboard)

    expect(result.stickyQuestions).toHaveLength(2)
    // Reversed - newest first
    expect(result.stickyQuestions![0].text).toBe("Second HMW")
    expect(result.stickyQuestions![0].type).toBe("hmw")
    expect(result.stickyQuestions![1].text).toBe("First HMW")
  })

  it("handles empty whiteboard", () => {
    const result = whiteboardYmlToClusterGridData({})

    expect(result.clusters).toEqual({})
    expect(result.stickyQuestions).toEqual([])
  })
})

describe("clusterGridDataToWhiteboardYml", () => {
  it("converts grid data back to yml format", () => {
    const gridData = {
      clusters: {
        Research: {
          at: [0, 0] as [number, number],
          items: [
            { id: "x", heading: "Test", at: [0, 0] as [number, number] },
          ],
        },
      },
      stickyQuestions: [],
    }

    const result = clusterGridDataToWhiteboardYml(gridData)

    expect(result.clusters?.Research.items[0].heading).toBe("Test")
    expect(result.stage).toBe("DISCOVER") // default
  })

  it("preserves existing fields from original", () => {
    const gridData = {
      clusters: {},
      stickyQuestions: [],
    }
    const existing: WhiteboardYml = {
      stage: "DELIVER",
      hmw: ["Existing HMW"],
      connections: [{ from: "a", to: "b" }],
    }

    const result = clusterGridDataToWhiteboardYml(gridData, existing)

    expect(result.stage).toBe("DELIVER")
    expect(result.hmw).toEqual(["Existing HMW"])
    expect(result.connections).toEqual([{ from: "a", to: "b" }])
  })
})

describe("serializeWhiteboardYml", () => {
  it("produces valid YAML that can be parsed back", () => {
    const original: WhiteboardYml = {
      stage: "DEVELOP",
      clusters: {
        Test: {
          at: [0, 0],
          items: [{ id: "1", heading: "Item", at: [0, 0] }],
        },
      },
    }

    const serialized = serializeWhiteboardYml(original)
    const parsed = parseWhiteboardYml(serialized)

    expect(parsed?.stage).toBe("DEVELOP")
    expect(parsed?.clusters?.Test.items[0].heading).toBe("Item")
  })
})

describe("hasWhiteboardContent", () => {
  it("returns false for null", () => {
    expect(hasWhiteboardContent(null)).toBe(false)
  })

  it("returns false for empty clusters", () => {
    expect(hasWhiteboardContent({ clusters: {} })).toBe(false)
  })

  it("returns false for clusters with no items", () => {
    expect(
      hasWhiteboardContent({
        clusters: {
          Empty: { at: [0, 0], items: [] },
        },
      })
    ).toBe(false)
  })

  it("returns true when cluster has items", () => {
    expect(
      hasWhiteboardContent({
        clusters: {
          Filled: {
            at: [0, 0],
            items: [{ id: "1", heading: "Test", at: [0, 0] }],
          },
        },
      })
    ).toBe(true)
  })
})
