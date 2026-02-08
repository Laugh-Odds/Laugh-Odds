import React from "react";
import { motion } from "framer-motion";
import { Crown, Users, Wallet } from "lucide-react";

const MinimalistFeatures = () => {
  const features = [
    {
      icon: <Crown className="w-6 h-6" />,
      title: "Template Creation",
      description:
        "Create and monetize meme templates with custom revenue sharing. Set your terms and watch your creations spread.",
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-500",
      gradient: "from-purple-500/20",
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Community Voting",
      description:
        "Simple swipe interface to vote on memes. Right for funny, left for lame. Your votes shape the meme economy.",
      iconBg: "bg-red-500/10",
      iconColor: "text-red-500",
      gradient: "from-red-500/20",
    },
    {
      icon: <Wallet className="w-6 h-6" />,
      title: "Reward System",
      description:
        "Earn rewards when your memes make people laugh. Smart contracts ensure fair distribution of earnings.",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-500",
      gradient: "from-emerald-500/20",
    },
  ];

  return (
    <section className="w-full">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: index * 0.2,
                ease: "easeOut",
              }}
              className="relative group h-full"
            >
              {/* Gradient Orb */}
              <div
                className={`absolute -z-10 top-0 right-0 w-20 sm:w-24 h-20 sm:h-24
                  rounded-full blur-2xl opacity-0 group-hover:opacity-40
                  bg-gradient-to-br ${feature.gradient} to-transparent
                  transition-opacity duration-500`}
              />

              {/* Card */}
              <div className="h-full glass rounded-2xl p-4 sm:p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                {/* Icon */}
                <div className={`w-10 h-10 sm:w-12 sm:h-12 ${feature.iconBg} ${feature.iconColor}
                  rounded-full flex items-center justify-center mb-4 sm:mb-6`}>
                  {feature.icon}
                </div>

                {/* Content */}
                <h3 className="text-lg sm:text-xl font-medium text-white mb-2 sm:mb-3">
                  {feature.title}
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MinimalistFeatures;