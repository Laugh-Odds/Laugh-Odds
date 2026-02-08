// server/server.js - Updated with Yellow Network integration
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { Meme, GasModel } = require("./model");
const { SettlementRecord, UserVote } = require("./models/Settlement");
const { ethers, parseEther, Contract } = require("ethers");
const CONTRACT = require("./FunnyOrFud.json");
const AutoSettlementService = require("./services/settlementService");
const yellowNetworkService = require("./services/yellowNetworkService");

// Prevent crashes from unhandled MongoDB timeouts
process.on('unhandledRejection', (err) => {
  console.log('Unhandled rejection (non-fatal):', err.message || err);
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Initialize ethers.js provider and wallet (Sepolia)
const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || process.env.RPC_URL);
const relayerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const contractAddress = process.env.CONTRACT_ADDRESS || "0x4c7Bad39Fc980701043a3b03051Cd64835d5e2aA";
const contractABI = CONTRACT.abi;

// Initialize Auto-Settlement Service
const settlementService = new AutoSettlementService();
settlementService.start();

// In-memory fallback when MongoDB is down
const memoryVotes = new Set(); // "address_marketId" keys
const memoryFaucet = new Set(); // addresses that got faucet

// Connect to Yellow Network on startup
yellowNetworkService.connect().then(() => {
  console.log("⚡ Yellow Network connected");
}).catch(err => {
  console.warn("⚠️ Yellow Network connection failed:", err.message, "(will retry)");
});

// Health Check
app.get("/api/health", async (req, res) => {
  try {
    res.status(200).json({
      status: "healthy",
      settlement_service: "running",
      yellow_network: yellowNetworkService.getStatus(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Track user votes when they vote (with in-memory fallback when MongoDB is down)
app.post("/api/user-vote", async (req, res) => {
  const { userAddress, marketId, vote, transferId, memeCid } = req.body;

  if (!userAddress || marketId === undefined || !vote) {
    return res.status(400).json({ message: "Missing required parameters" });
  }

  try {
    const voteKey = memeCid
      ? `${userAddress}_${marketId}_${memeCid}`
      : `${userAddress}_${marketId}`;

    // Check duplicate (try MongoDB first, fallback to memory)
    try {
      const query = memeCid
        ? { userAddress, marketId, memeCid }
        : { userAddress, marketId };
      const existingVote = await UserVote.findOne(query).maxTimeMS(3000);
      if (existingVote) {
        return res.status(400).json({ message: "User already voted on this" });
      }
    } catch (dbErr) {
      // MongoDB down - use in-memory
      if (memoryVotes.has(voteKey)) {
        return res.status(400).json({ message: "User already voted on this" });
      }
    }

    // Try on-chain vote via relay (server pays gas)
    try {
      const contract = new Contract(contractAddress, contractABI, relayerWallet);
      const voteYes = vote === 'funny';
      const voteCost = await contract.voteCost();
      const txResponse = await contract.vote(userAddress, BigInt(marketId), voteYes, {
        value: voteCost
      });
      console.log("Vote tx sent:", txResponse.hash);
    } catch (chainErr) {
      console.log("On-chain vote failed (may already voted):", chainErr.message?.substring(0, 100));
    }

    // Save vote (try MongoDB, fallback to memory)
    memoryVotes.add(voteKey);
    const userVote = new UserVote({
      userAddress,
      marketId,
      vote,
      transactionHash: transferId || 'relay',
      memeCid,
    });
    userVote.save().catch(() => console.log("MongoDB save failed, vote in memory"));

    res.json({ message: "Vote recorded successfully" });
  } catch (error) {
    console.error("Error recording user vote:", error);
    res.status(500).json({ message: "Failed to record vote", error: error.message });
  }
});

// Get user's voting history
app.get("/api/user-votes/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const userVotes = await UserVote.find({ userAddress: address }).sort({ votedAt: -1 });

    res.json(userVotes);
  } catch (error) {
    console.error("Error fetching user votes:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get user's settlement history
app.get("/api/user-settlements/:address", async (req, res) => {
  try {
    const { address } = req.params;

    // Find all settlements where user participated
    const settlements = await SettlementRecord.find({
      "participants.address": address
    }).sort({ settledAt: -1 });

    // Calculate user-specific data for each settlement
    const userSettlements = settlements.map(settlement => {
      const userParticipation = settlement.participants.find(p => p.address === address);

      return {
        marketId: settlement.marketId,
        winnerSide: settlement.winnerSide,
        userVote: userParticipation.vote,
        userWon: userParticipation.won,
        userStake: userParticipation.staked,
        userPayout: userParticipation.payout,
        netResult: userParticipation.won ?
          (BigInt(userParticipation.payout) - BigInt(userParticipation.staked)).toString() :
          (-BigInt(userParticipation.staked)).toString(),
        totalVotes: settlement.totalVotes,
        yesVotes: settlement.yesVotes,
        noVotes: settlement.noVotes,
        settlementTx: settlement.settlementTx,
        settledAt: settlement.settledAt
      };
    });

    res.json(userSettlements);
  } catch (error) {
    console.error("Error fetching user settlements:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get settlement details for a specific market
app.get("/api/settlement/:marketId", async (req, res) => {
  try {
    const { marketId } = req.params;
    const settlement = await SettlementRecord.findOne({ marketId: parseInt(marketId) });

    if (!settlement) {
      return res.status(404).json({ message: "Settlement not found" });
    }

    res.json(settlement);
  } catch (error) {
    console.error("Error fetching settlement:", error);
    res.status(500).json({ message: error.message });
  }
});

// Manual settlement trigger (admin endpoint)
app.post("/api/manual-settle/:marketId", async (req, res) => {
  try {
    const { marketId } = req.params;

    console.log(`Manual settlement requested for market ${marketId}`);
    const success = await settlementService.manualSettle(parseInt(marketId));

    if (success) {
      res.json({ message: `Market ${marketId} settled successfully` });
    } else {
      res.status(400).json({ message: `Failed to settle market ${marketId}` });
    }
  } catch (error) {
    console.error("Manual settlement error:", error);
    res.status(500).json({ message: "Settlement failed", error: error.message });
  }
});

// Get settlement status for a market
app.get("/api/settlement-status/:marketId", async (req, res) => {
  try {
    const { marketId } = req.params;
    const status = await settlementService.getSettlementStatus(parseInt(marketId));

    res.json(status);
  } catch (error) {
    console.error("Error getting settlement status:", error);
    res.status(500).json({ message: error.message });
  }
});

// Yellow Network status endpoint
app.get("/api/yellow-status", async (req, res) => {
  res.json(yellowNetworkService.getStatus());
});

// Meme creation routes
app.post("/api/memes", async (req, res) => {
  try {
    const meme = new Meme(req.body);
    await meme.save();
    res.status(201).json(meme);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get("/api/markets-data", async (req, res) => {
  try {
    const contract = new Contract(contractAddress, contractABI, provider);
    const count = await contract.marketCount();
    const markets = [];
    for (let i = 0; i < Number(count); i++) {
      try {
        const m = await contract.getMarket(i);
        // getMarket returns: [creator, endTime, isActive, metadata, memes[]]
        const memes = (m[4] || []).map(rm => ({
          creator: rm[0],
          cid: rm[1],
          memeTemplate: Number(rm[2])
        }));
        markets.push({
          id: i,
          creator: m[0],
          endTime: Number(m[1]),
          yesVotes: 0,
          noVotes: 0,
          totalStaked: "0",
          isActive: m[2],
          metadata: m[3],
          memes: memes
        });
      } catch(e) {
        console.log("Market", i, "error:", e.message);
      }
    }
    res.json(markets);
  } catch (error) {
    console.error("Error fetching markets:", error);
    res.status(500).json({ message: "Failed to fetch markets", error: error.message });
  }
});

app.post("/api/market", async (req, res) => {
  const { cid } = req.body;

  if (!cid) {
    return res.status(400).json({ message: "Missing CID parameter" });
  }

  try {
    const contract = new Contract(contractAddress, contractABI, relayerWallet);

    const gasLimit = await contract.createMarket.estimateGas(cid);

    const txResponse = await contract.createMarket(cid, {
      gasLimit: gasLimit,
    });

    console.log("Market creation transaction sent:", txResponse.hash);

    res.json({
      success: true,
      message: "Market created successfully",
      transactionHash: txResponse.hash
    });

    // Wait for confirmation in background
    txResponse.wait().then(receipt => {
      console.log("Market creation confirmed in block:", receipt.blockNumber);
    });
  } catch (error) {
    console.error("Error creating market:", error);
    res.status(500).json({ message: "Failed to create market", error: error.message });
  }
});

app.post("/api/meme", async (req, res) => {
  const { address, cid, templateId } = req.body;

  if (!address || cid === undefined) {
    return res.status(400).json({ message: "Missing required parameters" });
  }

  try {
    const contract = new Contract(contractAddress, contractABI, relayerWallet);

    const gasLimit = await contract.createMeme.estimateGas(
      address,
      cid,
      templateId
    );

    const txResponse = await contract.createMeme(address, cid, templateId, {
      gasLimit: gasLimit,
    });

    console.log("Meme creation transaction sent:", txResponse.hash);

    res.json({
      message: "Meme created successfully",
      transactionHash: txResponse.hash
    });
  } catch (error) {
    console.error("Error creating meme:", error);
    res.status(500).json({ message: "Failed to create meme", error: error.message });
  }
});

app.get("/api/memes", async (req, res) => {
  try {
    const memes = await Meme.find().sort({ createdAt: -1 });
    res.json(memes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/memes/:templateId", async (req, res) => {
  try {
    const { templateId } = req.params;
    const memes = await Meme.find({ memeTemplate: templateId });

    if (memes.length === 0) {
      return res.status(404).json({ message: "No memes found for this template" });
    }

    res.json(memes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/faucet/:address", async (req, res) => {
  const addr = req.params.address;
  try {
    // Check duplicate (try MongoDB first, fallback to memory)
    let alreadySent = false;
    try {
      const gas = await GasModel.findOne({ address: addr }).maxTimeMS(3000);
      if (gas) alreadySent = true;
    } catch (dbErr) {
      if (memoryFaucet.has(addr)) alreadySent = true;
    }

    if (alreadySent) {
      return res.status(200).json({ success: true, message: "Already given testnet tokens" });
    }

    const tx = await relayerWallet.sendTransaction({
      to: addr,
      value: parseEther("0.01"),
    });

    console.log("Faucet tx sent:", tx.hash);
    memoryFaucet.add(addr);

    // Save to MongoDB in background (don't block response)
    new GasModel({ address: addr }).save().catch(() => {})

    // Don't wait for confirmation - return immediately
    res.status(200).json({ success: true, message: "Sent 0.01 ETH! Tx: " + tx.hash });

    // Wait in background
    tx.wait().then(() => console.log("Faucet confirmed for", addr));
  } catch (error) {
    console.log("Faucet error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`⚡ Auto-Settlement Service active`);
  console.log(`🔗 Contract: ${contractAddress}`);
  console.log(`🌐 Network: Sepolia`);
});
