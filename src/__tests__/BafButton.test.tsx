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
});
