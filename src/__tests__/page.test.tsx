import { render, screen, waitFor } from "@testing-library/react";
import Home from "@/app/page";

global.fetch = jest.fn();

beforeEach(() => {
  (global.fetch as jest.Mock).mockReset();
});

describe("Home page", () => {
  it("renders the BoredAF heading after loading", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ complete: true }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("Bored")).toBeInTheDocument();
      expect(screen.getByText("AF")).toBeInTheDocument();
    });
  });

  it("shows BAF button when onboarding is complete", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ complete: true }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /get a suggestion/i })).toBeInTheDocument();
    });
  });

  it("shows onboarding when not complete", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ complete: false }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText(/I'm BAF/)).toBeInTheDocument();
    });
  });

  it("shows loading spinner initially", () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    render(<Home />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });
});
