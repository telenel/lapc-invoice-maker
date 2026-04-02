"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { MessageCircleIcon } from "lucide-react";
import { motion } from "framer-motion";
import { ChatMobileSheet } from "./chat-mobile-sheet";

export function ChatMobileLauncher() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) {
      setOpen(false);
    }
  }, [session?.user, status]);

  if (status !== "authenticated" || !session?.user) {
    return null;
  }

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 print:hidden"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.5 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        aria-label="Open AI Assistant"
      >
        <MessageCircleIcon className="h-6 w-6" />
        {/* Pulse ring on first load */}
        <motion.span
          className="absolute inset-0 rounded-full bg-purple-600"
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: 1.6, opacity: 0 }}
          transition={{
            duration: 1.5,
            repeat: 2,
            repeatType: "loop",
            ease: "easeOut",
          }}
          aria-hidden
        />
      </motion.button>

      {open && <ChatMobileSheet onClose={() => setOpen(false)} />}
    </>
  );
}
