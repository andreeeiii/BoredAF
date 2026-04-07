import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BafButton from "@/app/components/BafButton";

global.fetch = jest.fn();

beforeEach(() => {
  (global.fetch as jest.Mock).mockReset();
});

describe("BafButton", () => {
  it("renders with BAF text in idle state", () => {
    render(<BafButton />);
    const button = screen.getByRole("button", { name: /get a suggestion/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("BAF");
  });

  it("transitions to thinking state on click", () => {
    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {})
    );
    render(<BafButton />);
    const button = screen.getByRole("button", { name: /get a suggestion/i });
    fireEvent.click(button);
    expect(screen.getByText("Thinking...")).toBeInTheDocument();
  });

  it("shows suggestion after API response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestion: "Watch a chess video",
        emoji: "♟️",
        vibe: "chill",
        source: "youtube",
        link: "https://youtube.com/watch?v=abc123",
        isLive: false,
        archetype: "The Grind",
      }),
    });

    render(<BafButton />);
    fireEvent.click(screen.getByRole("button", { name: /get a suggestion/i }));

    await waitFor(() => {
      expect(screen.getByText("Watch a chess video")).toBeInTheDocument();
    });

    expect(screen.getByText(/LFG/)).toBeInTheDocument();
    expect(screen.getByText(/Nah/)).toBeInTheDocument();
    expect(screen.getByText(/YouTube/)).toBeInTheDocument();
  });

  it("shows LIVE badge for live suggestions", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestion: "GothamChess is streaming right now!",
        emoji: "🔴",
        vibe: "live",
        source: "twitch",
        link: "https://twitch.tv/gothamchess",
        isLive: true,
        archetype: "The Chill",
      }),
    });

    render(<BafButton />);
    fireEvent.click(screen.getByRole("button", { name: /get a suggestion/i }));

    await waitFor(() => {
      expect(screen.getByText("Live Now")).toBeInTheDocument();
    });
    expect(screen.getByText(/Twitch/)).toBeInTheDocument();
  });

  it("shows why menu when Nah is clicked", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestion: "Play blitz",
        emoji: "♟️",
        vibe: "active",
        source: "chess",
        link: null,
        isLive: false,
        archetype: "The Grind",
      }),
    });

    render(<BafButton />);
    fireEvent.click(screen.getByRole("button", { name: /get a suggestion/i }));

    await waitFor(() => {
      expect(screen.getByText("Play blitz")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Nah/));

    expect(screen.getByText("Why not?")).toBeInTheDocument();
    expect(screen.getByText("Too tired")).toBeInTheDocument();
    expect(screen.getByText("Not interested")).toBeInTheDocument();
  });

  it("returns to idle on error", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
    });

    render(<BafButton />);
    fireEvent.click(screen.getByRole("button", { name: /get a suggestion/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /get a suggestion/i })
      ).toBeInTheDocument();
    });
  });

  it("transitions to accepted state when LFG is clicked", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestion: "Learn 5 Greek words",
        emoji: "📚",
        vibe: "educational",
        source: "general",
        link: null,
        isLive: false,
        archetype: "The Scholar",
      }),
    });

    render(<BafButton />);
    fireEvent.click(screen.getByRole("button", { name: /get a suggestion/i }));

    await waitFor(() => {
      expect(screen.getByText("Learn 5 Greek words")).toBeInTheDocument();
    });

    // Click LFG button
    fireEvent.click(screen.getByText(/LFG/));

    await waitFor(() => {
      expect(screen.getByText("Rescue Accepted! 🎉")).toBeInTheDocument();
    });

    expect(screen.getByText("Share My Rescue ✨")).toBeInTheDocument();
    expect(screen.getByText("Back to BAF 🔥")).toBeInTheDocument();
  });

  it("opens share modal when Share My Rescue is clicked", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestion: "Try a new recipe",
        emoji: "👨‍🍳",
        vibe: "creative",
        source: "general",
        link: null,
        isLive: false,
        archetype: "The Creator",
      }),
    });

    render(<BafButton />);
    fireEvent.click(screen.getByRole("button", { name: /get a suggestion/i }));

    await waitFor(() => {
      expect(screen.getByText("Try a new recipe")).toBeInTheDocument();
    });

    // Click LFG button
    fireEvent.click(screen.getByText(/LFG/));

    await waitFor(() => {
      expect(screen.getByText("Rescue Accepted! 🎉")).toBeInTheDocument();
    });

    // Click Share My Rescue button
    fireEvent.click(screen.getByText(/Share My Rescue/));

    await waitFor(() => {
      expect(screen.getByText("Share Your Rescue")).toBeInTheDocument();
    });
  });

  it("returns to idle state when Back to BAF is clicked", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestion: "Watch a chess stream",
        emoji: "♟️",
        vibe: "competitive",
        source: "twitch",
        link: "https://twitch.tv/example",
        isLive: true,
        archetype: "The Strategist",
      }),
    });

    render(<BafButton />);
    fireEvent.click(screen.getByRole("button", { name: /get a suggestion/i }));

    await waitFor(() => {
      expect(screen.getByText("Watch a chess stream")).toBeInTheDocument();
    });

    // Click LFG button
    fireEvent.click(screen.getByText(/LFG/));

    await waitFor(() => {
      expect(screen.getByText("Rescue Accepted! 🎉")).toBeInTheDocument();
    });

    // Click Back to BAF button
    fireEvent.click(screen.getByText(/Back to BAF/));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /get a suggestion/i })).toBeInTheDocument();
    });
  });

  it("submits feedback when LFG is clicked", async () => {
    const mockFetch = (global.fetch as jest.Mock);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestion: "Learn something new",
        emoji: "🚀",
        vibe: "adventurous",
        source: "general",
        link: null,
        isLive: false,
        archetype: "The Explorer",
      }),
    });

    render(<BafButton />);
    fireEvent.click(screen.getByRole("button", { name: /get a suggestion/i }));

    await waitFor(() => {
      expect(screen.getByText("Learn something new")).toBeInTheDocument();
    });

    // Click LFG button
    fireEvent.click(screen.getByText(/LFG/));

    await waitFor(() => {
      expect(screen.getByText("Rescue Accepted! 🎉")).toBeInTheDocument();
    });

    // Check that feedback was submitted
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(2, "/api/baf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "feedback",
        suggestion: "Learn something new",
        outcome: "accepted",
        source: "general",
        archetype: "The Explorer",
        link: null,
      }),
    });
  });
});
