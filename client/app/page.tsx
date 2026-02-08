"use client"

import FeaturesSectionDemo from "@/components/Landing/Features"
import Footer from "@/components/Landing/Footer"
import AnimatedHeading from "@/components/Landing/Heading"
import TimelineDemo from "@/components/Landing/Timeline"

const Page = () => {
  return (
    <div className="min-h-screen">
      {/* Background radial gradient orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-900/30 blur-[120px]" />
        <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-900/20 blur-[100px]" />
        <div className="absolute bottom-[10%] left-[30%] w-[400px] h-[400px] rounded-full bg-indigo-900/20 blur-[80px]" />
      </div>

      <AnimatedHeading />
      <div className="min-h-screen relative">
        <div className="relative w-full max-w-6xl mx-auto h-[80vh] flex items-center justify-center px-4">
          <div className="text-center z-10 max-w-4xl">
            <h2 className="text-white text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Where Memes Meet
              <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Web3 Economics</span>
            </h2>
            <p className="text-white/70 text-lg md:text-xl mb-8 max-w-2xl mx-auto leading-relaxed">
              Create viral meme templates, vote on the funniest content, and earn rewards when your taste in humor pays
              off. The future of meme culture is here.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => (window.location.href = "/app/memes")}
                className="px-8 py-4 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 glow-blue"
              >
                Start Creating
              </button>
              <button
                onClick={() => (window.location.href = "/app/memes")}
                className="px-8 py-4 glass hover:bg-white/10 text-white rounded-xl font-semibold transition-all duration-300"
              >
                Explore Memes
              </button>
            </div>
          </div>
        </div>
      </div>
      <FeaturesSectionDemo />
      <TimelineDemo />
      <Footer />
    </div>
  )
}

export default Page
