"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ShareModalProps, SharePlatform } from "@/types/share";
import { handleShare, isMobileDevice } from "@/lib/shareUtils";

const PLATFORM_CONFIG = {
  whatsapp: {
    icon: "💬",
    label: "WhatsApp",
    color: "bg-green-500",
    hoverColor: "hover:bg-green-600",
  },
  x: {
    icon: "𝕏",
    label: "X (Twitter)",
    color: "bg-black",
    hoverColor: "hover:bg-gray-800",
  },
  copy: {
    icon: "📋",
    label: "Copy Link",
    color: "bg-blue-500",
    hoverColor: "hover:bg-blue-600",
  },
};

export default function ShareModal({ isOpen, onClose, suggestion, onShare }: ShareModalProps) {
  const handlePlatformShare = async (platform: SharePlatform) => {
    await onShare(platform);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Content */}
        <motion.div
          initial={{ 
            y: isMobileDevice() ? "100%" : "scale(0.9)",
            opacity: 0 
          }}
          animate={{ 
            y: 0,
            opacity: 1 
          }}
          exit={{ 
            y: isMobileDevice() ? "100%" : "scale(0.9)",
            opacity: 0 
          }}
          transition={{ 
            type: "spring", 
            damping: 25,
            stiffness: 300 
          }}
          className={`relative z-10 w-full ${
            isMobileDevice() 
              ? "max-w-lg rounded-t-3xl border-t border-x border-gray-800" 
              : "max-w-md rounded-2xl border border-gray-800"
          } bg-gray-900/95 backdrop-blur-xl shadow-2xl`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <h3 className="text-xl font-bold text-white">Share Your Rescue</h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Suggestion Preview */}
          <div className="p-6 border-b border-gray-800">
            <p className="text-sm text-gray-400 mb-2">Your BAF suggestion:</p>
            <p className="text-lg font-semibold text-white">{suggestion}</p>
          </div>

          {/* Platform Options */}
          <div className="p-6">
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(PLATFORM_CONFIG).map(([platform, config]) => (
                <motion.button
                  key={platform}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handlePlatformShare(platform as SharePlatform)}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl ${config.color} ${config.hoverColor} text-white transition-all duration-200 shadow-lg`}
                >
                  <div className="text-2xl mb-2">{config.icon}</div>
                  <div className="text-xs font-medium text-center">{config.label}</div>
                </motion.button>
              ))}
            </div>

            {/* Additional Info */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                Share your rescue and help others escape boredom! 🚀
              </p>
            </div>
          </div>

          {/* Mobile Handle */}
          {isMobileDevice() && (
            <div className="flex justify-center pb-4">
              <div className="w-12 h-1 bg-gray-700 rounded-full"></div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
