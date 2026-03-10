import { render, screen, fireEvent } from "@testing-library/react";
import BafButton from "@/app/components/BafButton";

describe("BafButton", () => {
  it("renders with BAF text in idle state", () => {
    render(<BafButton />);
    const button = screen.getByRole("button", { name: /get a suggestion/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("BAF");
  });

  it("is not disabled in idle state", () => {
    render(<BafButton />);
    const button = screen.getByRole("button", { name: /get a suggestion/i });
    expect(button).not.toBeDisabled();
  });

  it("transitions to thinking state on click", () => {
    render(<BafButton />);
    const button = screen.getByRole("button", { name: /get a suggestion/i });
    fireEvent.click(button);
    const thinkingButton = screen.getByRole("button", { name: /loading suggestion/i });
    expect(thinkingButton).toHaveTextContent("Thinking...");
    expect(thinkingButton).toBeDisabled();
  });

  it("shows cancel button in thinking state", () => {
    render(<BafButton />);
    fireEvent.click(screen.getByRole("button", { name: /get a suggestion/i }));
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("returns to idle state when cancel is clicked", () => {
    render(<BafButton />);
    fireEvent.click(screen.getByRole("button", { name: /get a suggestion/i }));
    fireEvent.click(screen.getByText("Cancel"));
    const button = screen.getByRole("button", { name: /get a suggestion/i });
    expect(button).toHaveTextContent("BAF");
    expect(button).not.toBeDisabled();
  });

  it("does not show cancel button in idle state", () => {
    render(<BafButton />);
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
  });
});
