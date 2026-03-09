import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
  it("renders the BoredAF heading", () => {
    render(<Home />);
    expect(screen.getByText("Bored")).toBeInTheDocument();
    expect(screen.getByText("AF")).toBeInTheDocument();
  });

  it("renders the BAF ME button", () => {
    render(<Home />);
    expect(screen.getByRole("button", { name: /get a suggestion/i })).toBeInTheDocument();
  });
});
