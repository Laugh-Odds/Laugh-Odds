import { Compass, Plus, Wallet } from "lucide-react";
import Link from "next/link";

const BottomHeader = () => {
  const navLinks = [
    { href: "/app/memes", icon: Compass, label: "Explore" },
    { href: "/app/memes/create", icon: Plus, label: "Create" },
    { href: "/app/memes/settlements", icon: Wallet, label: "Settlements" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass-strong p-2">
      <div className="flex justify-around items-center">
        {navLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="p-2 flex flex-col items-center group"
            >
              <Icon
                className="h-8 w-8 md:h-6 md:w-6 text-white/50 group-hover:text-white transition-all duration-200 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
              />
              <span className="text-xs mt-1 hidden md:block text-white/50 group-hover:text-white transition-colors duration-200">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomHeader;
