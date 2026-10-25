import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle Component", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("renders with accessible aria-label", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label");
  });

  it("toggles between dark and light themes when clicked", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button");

    fireEvent.click(button);
    expect(localStorage.getItem("docmind-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    fireEvent.click(button);
    expect(localStorage.getItem("docmind-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ThemeToggle />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
