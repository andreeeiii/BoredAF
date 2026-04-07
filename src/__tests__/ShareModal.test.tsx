import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ShareModal from "@/app/components/ShareModal";
import { SharePlatform } from "@/types/share";

// Mock the shareUtils
jest.mock("@/lib/shareUtils", () => ({
  handleShare: jest.fn(),
  isMobileDevice: jest.fn(() => false),
}));

describe("ShareModal", () => {
  const mockOnClose = jest.fn();
  const mockOnShare = jest.fn();
  const suggestion = "Learn 5 Greek words";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders when open", () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        suggestion={suggestion}
        onShare={mockOnShare}
      />
    );

    expect(screen.getByText("Share Your Rescue")).toBeInTheDocument();
    expect(screen.getByText(suggestion)).toBeInTheDocument();
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("X (Twitter)")).toBeInTheDocument();
    expect(screen.getByText("Copy Link")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <ShareModal
        isOpen={false}
        onClose={mockOnClose}
        suggestion={suggestion}
        onShare={mockOnShare}
      />
    );

    expect(screen.queryByText("Share Your Rescue")).not.toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        suggestion={suggestion}
        onShare={mockOnShare}
      />
    );

    // Find the backdrop by its class and click it
    const backdrop = document.querySelector('.bg-black\\/60');
    if (backdrop) {
      fireEvent.click(backdrop);
    }

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("calls onClose when close button is clicked", () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        suggestion={suggestion}
        onShare={mockOnShare}
      />
    );

    const closeButton = screen.getAllByRole("button")[0]; // First button is the close button
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("calls onShare when WhatsApp button is clicked", async () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        suggestion={suggestion}
        onShare={mockOnShare}
      />
    );

    const whatsappButton = screen.getByText("WhatsApp");
    fireEvent.click(whatsappButton);

    await waitFor(() => {
      expect(mockOnShare).toHaveBeenCalledWith("whatsapp");
    });
  });

  it("calls onShare when X button is clicked", async () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        suggestion={suggestion}
        onShare={mockOnShare}
      />
    );

    const xButton = screen.getByText("X (Twitter)");
    fireEvent.click(xButton);

    await waitFor(() => {
      expect(mockOnShare).toHaveBeenCalledWith("x");
    });
  });

  it("calls onShare when Copy Link button is clicked", async () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        suggestion={suggestion}
        onShare={mockOnShare}
      />
    );

    const copyButton = screen.getByText("Copy Link");
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockOnShare).toHaveBeenCalledWith("copy");
    });
  });

  it("displays suggestion text correctly", () => {
    const customSuggestion = "Watch a chess stream";
    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        suggestion={customSuggestion}
        onShare={mockOnShare}
      />
    );

    expect(screen.getByText(customSuggestion)).toBeInTheDocument();
    expect(screen.getByText("Your BAF suggestion:")).toBeInTheDocument();
  });
});
