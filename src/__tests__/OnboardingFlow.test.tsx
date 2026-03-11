import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OnboardingFlow from "@/app/components/OnboardingFlow";

global.fetch = jest.fn();

beforeEach(() => {
  (global.fetch as jest.Mock).mockReset();
});

describe("OnboardingFlow", () => {
  const mockOnComplete = jest.fn();

  beforeEach(() => {
    mockOnComplete.mockReset();
  });

  it("renders the first question as a bot message", () => {
    render(<OnboardingFlow onComplete={mockOnComplete} />);
    expect(screen.getByText(/I'm BAF/)).toBeInTheDocument();
    expect(screen.getByText(/just 4 questions/)).toBeInTheDocument();
  });

  it("shows a progress bar with step info", () => {
    render(<OnboardingFlow onComplete={mockOnComplete} />);
    expect(screen.getByText(/Step 1 of 4/)).toBeInTheDocument();
  });

  it("shows an input field and submit button", () => {
    render(<OnboardingFlow onComplete={mockOnComplete} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByText("→")).toBeInTheDocument();
  });

  it("adds user message when answer is submitted", async () => {
    render(<OnboardingFlow onComplete={mockOnComplete} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "GothamChess, MrBeast" } });
    fireEvent.click(screen.getByText("→"));

    await waitFor(() => {
      expect(screen.getByText("GothamChess, MrBeast")).toBeInTheDocument();
    });
  });

  it("advances to next question after answering", async () => {
    render(<OnboardingFlow onComplete={mockOnComplete} />);
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "GothamChess" } });
    fireEvent.click(screen.getByText("→"));

    await waitFor(() => {
      expect(screen.getByText(/Step 2 of 4/)).toBeInTheDocument();
    });
  });

  it("shows building persona screen after 4 answers", async () => {
    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {})
    );

    render(<OnboardingFlow onComplete={mockOnComplete} />);

    for (let i = 0; i < 4; i++) {
      await waitFor(() => {
        expect(screen.getByRole("textbox")).not.toBeDisabled();
      });
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: `Answer ${i + 1}` } });
      fireEvent.click(screen.getByText("→"));
    }

    await waitFor(() => {
      expect(screen.getByTestId("building-persona")).toBeInTheDocument();
    });

    expect(screen.getByText("Building Your Persona")).toBeInTheDocument();
    expect(screen.getByTestId("building-status")).toBeInTheDocument();
  });

  it("shows archetype result after submission", async () => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        archetype: "The Grinder",
        tags: ["chess", "competitive"],
      }),
    });

    render(<OnboardingFlow onComplete={mockOnComplete} />);

    for (let i = 0; i < 4; i++) {
      await waitFor(() => {
        expect(screen.getByRole("textbox")).not.toBeDisabled();
      });
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: `Answer ${i + 1}` } });
      fireEvent.click(screen.getByText("→"));
    }

    await waitFor(() => {
      expect(screen.getByTestId("building-persona")).toBeInTheDocument();
    });

    jest.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(screen.getByText(/The Grinder/)).toBeInTheDocument();
    });

    expect(screen.getByText("#chess")).toBeInTheDocument();
    expect(screen.getByText("#competitive")).toBeInTheDocument();
    expect(screen.getByText(/Let's Go/)).toBeInTheDocument();
    jest.useRealTimers();
  });

  it("transitions Chat → Building → Result → Dashboard in correct order", async () => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        archetype: "The Lurker",
        tags: ["youtube"],
      }),
    });

    render(<OnboardingFlow onComplete={mockOnComplete} />);

    // Phase 1: Chat — input visible
    expect(screen.getByRole("textbox")).toBeInTheDocument();

    for (let i = 0; i < 4; i++) {
      await waitFor(() => {
        expect(screen.getByRole("textbox")).not.toBeDisabled();
      });
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: `Answer ${i + 1}` } });
      fireEvent.click(screen.getByText("→"));
    }

    // Phase 2: Building — animation screen visible, input gone
    await waitFor(() => {
      expect(screen.getByTestId("building-persona")).toBeInTheDocument();
    });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    // Advance past minimum building duration
    jest.advanceTimersByTime(3000);

    // Phase 3: Result — archetype + Let's Go button visible
    await waitFor(() => {
      expect(screen.getByTestId("result-screen")).toBeInTheDocument();
    });
    expect(screen.getByText(/The Lurker/)).toBeInTheDocument();
    expect(screen.getByText(/Let's Go/)).toBeInTheDocument();

    // Phase 4: Dashboard — onComplete called
    fireEvent.click(screen.getByText(/Let's Go/));
    expect(mockOnComplete).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("does not submit when input is empty", () => {
    render(<OnboardingFlow onComplete={mockOnComplete} />);
    const submitBtn = screen.getByText("→");
    fireEvent.click(submitBtn);
    expect(screen.queryByText(/Step 2 of 4/)).not.toBeInTheDocument();
  });

  it("submits on Enter key press", async () => {
    render(<OnboardingFlow onComplete={mockOnComplete} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Test answer" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("Test answer")).toBeInTheDocument();
    });
  });
});
