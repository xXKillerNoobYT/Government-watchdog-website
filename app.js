function timelineApp() {
  return {
    activePage: "timeline",
    activeSource: null,
    activeTopic: null,
    filters: {
      state: "WY",
      county: "lincoln",
      town: "alpine"
    },
    states: [
      { value: "WY", label: "Wyoming", locked: false },
      { value: "US", label: "United States expansion - locked", locked: true }
    ],
    counties: [
      { value: "lincoln", label: "Lincoln County", locked: false },
      { value: "teton", label: "Teton County - planned", locked: true },
      { value: "statewide", label: "Statewide - planned", locked: true }
    ],
    towns: [
      { value: "alpine", label: "Town of Alpine", locked: false },
      { value: "afton", label: "Afton - planned", locked: true },
      { value: "kemmerer", label: "Kemmerer - planned", locked: true }
    ],
    cards: [
      {
        id: "fixture-001",
        icon: "M",
        typeLabel: "Meeting node",
        title: "Council meeting timeline card pattern",
        summary: "Prototype card showing how a reviewed meeting item will sit in the timeline once backend source records exist.",
        dateLabel: "Fixture date",
        status: "verified",
        gated: false,
        tags: ["Meetings", "Council"],
        source: {
          type: "Fixture source note",
          publisher: "Government Watchdog prototype",
          originalUrl: "https://example.invalid/alpine-fixture-meeting",
          archiveUrl: null,
          capturedDate: "2026-06-06",
          localNote: "Prototype only - no raw civic source committed"
        }
      },
      {
        id: "fixture-002",
        icon: "S",
        typeLabel: "Source card",
        title: "Official-record source drawer pattern",
        summary: "Demonstrates the drawer fields that will expose source type, publisher, capture date, archive status, and local note path.",
        dateLabel: "Fixture date",
        status: "verified",
        gated: false,
        tags: ["Sources", "Audit trail"],
        source: {
          type: "Official record placeholder",
          publisher: "Placeholder authority",
          originalUrl: "https://example.invalid/alpine-fixture-source",
          archiveUrl: "https://web.archive.org/example-placeholder",
          capturedDate: "2026-06-06",
          localNote: "Awaiting reviewed backend source record"
        }
      },
      {
        id: "fixture-003",
        icon: "!",
        typeLabel: "AI-presented block",
        title: "AI-presented summary gate",
        summary: "Shows how generated or unreviewed explanatory text is visually separated from verified card content.",
        dateLabel: "Fixture date",
        status: "ai-presented",
        gated: true,
        gateTitle: "AI-generated - not independently verified",
        gateText: "This block is a UI fixture. It demonstrates caution copy and must not be treated as sourced reporting.",
        tags: ["AI review", "Caution"],
        source: {
          type: "Prototype fixture",
          publisher: "Government Watchdog prototype",
          originalUrl: "https://example.invalid/alpine-fixture-ai",
          archiveUrl: null,
          capturedDate: "2026-06-06",
          localNote: "Generated text gate demonstration"
        }
      },
      {
        id: "fixture-004",
        icon: "D",
        typeLabel: "Dispute/correction card",
        title: "Disputed or corrected claim state",
        summary: "Demonstrates the visual treatment for a future card that needs competing source links or a correction trail.",
        dateLabel: "Fixture date",
        status: "disputed",
        gated: true,
        gateTitle: "Disputed fixture state",
        gateText: "Future production cards must show both source trails before any disputed claim is displayed.",
        tags: ["Corrections", "Review"],
        source: {
          type: "Correction trail placeholder",
          publisher: "Government Watchdog prototype",
          originalUrl: "https://example.invalid/alpine-fixture-dispute",
          archiveUrl: null,
          capturedDate: "2026-06-06",
          localNote: "Needs reviewed correction/dispute record"
        }
      },
      {
        id: "fixture-005",
        icon: "T",
        typeLabel: "Topic link",
        title: "Topic timeline routing preview",
        summary: "Shows how topic filters can preserve the Alpine scope while routing users into narrower timeline views.",
        dateLabel: "Fixture date",
        status: "unverified",
        gated: true,
        gateTitle: "Unverified prototype card",
        gateText: "This is intentionally not marked verified; it exists to test label placement and gated display behavior.",
        tags: ["Topics", "Navigation"],
        source: {
          type: "Prototype fixture",
          publisher: "Government Watchdog prototype",
          originalUrl: "https://example.invalid/alpine-fixture-topic",
          archiveUrl: null,
          capturedDate: "2026-06-06",
          localNote: "Static fixture mode"
        }
      }
    ],
    get topics() {
      return [...new Set(this.cards.flatMap((card) => card.tags))].sort();
    },
    syncScope() {
      this.filters.state = "WY";
      this.filters.county = "lincoln";
      this.filters.town = "alpine";
    },
    filteredCards() {
      const scoped = this.cards;
      if (!this.activeTopic) return scoped;
      return scoped.filter((card) => card.tags.includes(this.activeTopic));
    },
    statusText(status) {
      const labels = {
        verified: "Verified fixture pattern",
        "ai-presented": "AI-generated - not independently verified",
        unverified: "Unverified fixture",
        disputed: "Disputed fixture",
        corrected: "Corrected fixture"
      };
      return labels[status] || "Status unavailable";
    },
    openSource(card) {
      this.activeSource = card;
    },
    closeSource() {
      this.activeSource = null;
    },
    focusTopic(topic) {
      this.activeTopic = topic;
      this.activePage = "timeline";
    }
  };
}
