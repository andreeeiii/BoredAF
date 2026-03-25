import { generateSocialCard } from "@/lib/socialCard";

// Mock the html-to-image library
jest.mock("html-to-image", () => ({
  toPng: jest.fn(),
}));

// Mock the qrcode library
jest.mock("qrcode", () => ({
  toDataURL: jest.fn(),
}));

describe("socialCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("generates a social card with valid data URL", async () => {
    const mockToPng = require("html-to-image").toPng;
    const mockQRCode = require("qrcode");

    // Mock QR code generation
    mockQRCode.toDataURL.mockResolvedValue("data:image/png;base64,mock-qr-code");

    // Mock image generation
    mockToPng.mockResolvedValue("data:image/png;base64,mock-social-card");

    const config = {
      suggestion: "Learn 5 Greek words",
      emoji: "📚",
      vibe: "educational",
    };

    const result = await generateSocialCard(config);

    expect(result).toBe("data:image/png;base64,mock-social-card");
    expect(mockQRCode.toDataURL).toHaveBeenCalledWith(
      "https://bored-af.app/join",
      expect.objectContaining({
        width: 120,
        margin: 1,
      })
    );
    expect(mockToPng).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        width: 360,
        height: 640,
        quality: 0.9,
        pixelRatio: 2,
      })
    );
  });

  it("generates QR code with correct URL", async () => {
    const mockQRCode = require("qrcode");
    const mockToPng = require("html-to-image").toPng;

    mockQRCode.toDataURL.mockResolvedValue("data:image/png;base64,mock-qr-code");
    mockToPng.mockResolvedValue("data:image/png;base64,mock-social-card");

    const config = {
      suggestion: "Watch a chess stream",
      emoji: "♟️",
      vibe: "competitive",
    };

    await generateSocialCard(config);

    expect(mockQRCode.toDataURL).toHaveBeenCalledWith(
      "https://bored-af.app/join",
      expect.objectContaining({
        width: 120,
        margin: 1,
        color: {
          dark: "#ffffff",
          light: "#6200ea",
        },
      })
    );
  });

  it("handles different suggestion texts correctly", async () => {
    const mockQRCode = require("qrcode");
    const mockToPng = require("html-to-image").toPng;

    mockQRCode.toDataURL.mockResolvedValue("data:image/png;base64,mock-qr-code");
    mockToPng.mockResolvedValue("data:image/png;base64,mock-social-card");

    const configs = [
      {
        suggestion: "Learn 5 Greek words",
        emoji: "📚",
        vibe: "educational",
      },
      {
        suggestion: "Watch a chess stream",
        emoji: "♟️",
        vibe: "competitive",
      },
      {
        suggestion: "Try a new recipe",
        emoji: "👨‍🍳",
        vibe: "creative",
      },
    ];

    for (const config of configs) {
      const result = await generateSocialCard(config);
      expect(result).toBe("data:image/png;base64,mock-social-card");
      expect(mockToPng).toHaveBeenCalledTimes(configs.indexOf(config) + 1);
    }
  });

  it("handles emoji rendering correctly", async () => {
    const mockQRCode = require("qrcode");
    const mockToPng = require("html-to-image").toPng;

    mockQRCode.toDataURL.mockResolvedValue("data:image/png;base64,mock-qr-code");
    mockToPng.mockResolvedValue("data:image/png;base64,mock-social-card");

    const config = {
      suggestion: "Learn something new",
      emoji: "🚀",
      vibe: "adventurous",
    };

    const result = await generateSocialCard(config);

    expect(result).toBe("data:image/png;base64,mock-social-card");
    expect(mockToPng).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        width: 360,
        height: 640,
      })
    );
  });

  it("handles QR code generation failure", async () => {
    const mockQRCode = require("qrcode");
    const mockToPng = require("html-to-image").toPng;

    mockQRCode.toDataURL.mockRejectedValue(new Error("QR code generation failed"));

    const config = {
      suggestion: "Learn 5 Greek words",
      emoji: "📚",
      vibe: "educational",
    };

    await expect(generateSocialCard(config)).rejects.toThrow("QR code generation failed");
  });

  it("handles image generation failure", async () => {
    const mockQRCode = require("qrcode");
    const mockToPng = require("html-to-image").toPng;

    mockQRCode.toDataURL.mockResolvedValue("data:image/png;base64,mock-qr-code");
    mockToPng.mockRejectedValue(new Error("Image generation failed"));

    const config = {
      suggestion: "Learn 5 Greek words",
      emoji: "📚",
      vibe: "educational",
    };

    await expect(generateSocialCard(config)).rejects.toThrow("Image generation failed");
  });
});
