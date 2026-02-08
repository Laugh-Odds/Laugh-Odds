// server/services/settlementService.js
const cron = require('node-cron');
const { ethers, Contract } = require('ethers');
const { SettlementRecord, UserVote } = require('../models/Settlement');
const CONTRACT = require('../FunnyOrFud.json');
const yellowNetworkService = require('./yellowNetworkService');

class AutoSettlementService {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || process.env.RPC_URL);
        this.relayerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.contractAddress = process.env.CONTRACT_ADDRESS || "0x4c7Bad39Fc980701043a3b03051Cd64835d5e2aA";
        this.contract = new Contract(this.contractAddress, CONTRACT.abi, this.relayerWallet);
        this.isRunning = false;
    }

    // Start the automatic settlement service
    start() {
        console.log('🚀 Starting Auto-Settlement Service...');

        // Check every 5 minutes for settlements
        cron.schedule('*/5 * * * *', async () => {
            if (this.isRunning) {
                console.log('⏳ Settlement check already in progress, skipping...');
                return;
            }

            this.isRunning = true;
            try {
                await this.checkAndSettleMarkets();
            } catch (error) {
                console.error('🚨 Auto-settlement error:', error);
            } finally {
                this.isRunning = false;
            }
        });

        console.log('✅ Auto-Settlement Service started successfully');
    }

    // Main settlement logic
    async checkAndSettleMarkets() {
        console.log('🔍 Checking for markets to settle...');

        try {
            const marketCount = await this.contract.marketCount();
            console.log(`📊 Total markets: ${marketCount}`);

            let settledCount = 0;

            for (let i = 0; i < marketCount; i++) {
                try {
                    const market = await this.contract.getMarket(i);
                    const [creator, endTime, isActive, metadata, memes] = market;

                    // Skip if already settled
                    if (!isActive) {
                        continue;
                    }

                    const now = Math.floor(Date.now() / 1000);
                    const timeLeft = Number(endTime) - now;

                    // Check if 6 hours have passed
                    if (timeLeft <= 0) {
                        console.log(`⚡ Settling market ${i} (${timeLeft}s overdue)...`);

                        const settled = await this.settleMarket(i, market);
                        if (settled) {
                            settledCount++;
                        }
                    } else {
                        console.log(`⏰ Market ${i}: ${Math.floor(timeLeft / 3600)}h ${Math.floor((timeLeft % 3600) / 60)}m remaining`);
                    }

                } catch (error) {
                    console.error(`❌ Error processing market ${i}:`, error.message);
                }
            }

            if (settledCount > 0) {
                console.log(`🎉 Successfully settled ${settledCount} markets`);
            } else {
                console.log('✨ No markets ready for settlement');
            }

        } catch (error) {
            console.error('🚨 Failed to check markets:', error);
        }
    }

    // Settle individual market via Yellow Network rewards
    async settleMarket(marketId, marketData) {
        try {
            const [creator, endTime, isActive, metadata, memes] = marketData;

            // Get votes from MongoDB
            const votes = await UserVote.find({ marketId });
            const yesVotes = votes.filter(v => v.vote === 'funny');
            const noVotes = votes.filter(v => v.vote === 'lame');

            console.log(`📈 Market ${marketId} Stats:`, {
                yesVotes: yesVotes.length,
                noVotes: noVotes.length,
                creator: creator.slice(0, 8) + '...'
            });

            const winnerSide = yesVotes.length > noVotes.length ? 'funny' : 'lame';
            const winners = winnerSide === 'funny' ? yesVotes : noVotes;
            const totalVotes = votes.length;

            // Calculate rewards: each vote = 100 units (0.0001 ytest.usd)
            const totalPool = totalVotes * 100;
            const creatorReward = Math.floor(totalPool * 0.05);
            const voterPool = totalPool - creatorReward;
            const rewardPerWinner = winners.length > 0 ? Math.floor(voterPool / winners.length) : 0;

            console.log(`💰 Distributing rewards via Yellow Network...`);
            console.log(`   Creator: ${creatorReward} units`);
            console.log(`   Each winner: ${rewardPerWinner} units`);

            // Distribute via Yellow Network
            const rewardList = [];

            if (creatorReward > 0) {
                rewardList.push({ address: creator, amount: creatorReward });
            }

            for (const winner of winners) {
                rewardList.push({ address: winner.userAddress, amount: rewardPerWinner });
            }

            let distributionResults = [];
            if (rewardList.length > 0) {
                try {
                    distributionResults = await yellowNetworkService.distributeRewards(rewardList);
                    console.log(`✅ Rewards distributed for market ${marketId}`);
                } catch (rewardError) {
                    console.error(`⚠️ Failed to distribute rewards via Yellow Network:`, rewardError.message);
                    // Continue with settlement record even if reward distribution fails
                }
            }

            // Store settlement record
            await this.storeSettlementRecord(marketId, {
                creator,
                endTime,
                yesVotes: yesVotes.length,
                noVotes: noVotes.length,
                totalVotes,
                winnerSide,
                creatorReward,
                voterPool,
                rewardPerWinner,
                distributionResults,
            });

            return true;

        } catch (error) {
            console.error(`🚨 Failed to settle market ${marketId}:`, error.message);
            return false;
        }
    }

    // Store settlement record in database
    async storeSettlementRecord(marketId, data) {
        try {
            const settlementRecord = new SettlementRecord({
                marketId,
                templateCreator: data.creator,
                endTime: new Date(Number(data.endTime) * 1000),
                totalVotes: data.totalVotes,
                yesVotes: data.yesVotes,
                noVotes: data.noVotes,
                totalStaked: (data.totalVotes * 100).toString(),
                winnerSide: data.winnerSide,
                creatorReward: data.creatorReward.toString(),
                voterRewards: data.voterPool.toString(),
                settlementTx: 'yellow_network',
                blockNumber: 0,
                gasUsed: '0',
                settledAt: new Date()
            });

            await settlementRecord.save();
            console.log(`💾 Settlement record saved for market ${marketId}`);

        } catch (error) {
            console.error(`🚨 Failed to store settlement record for market ${marketId}:`, error);
        }
    }

    // Manual settlement trigger (for admin use)
    async manualSettle(marketId) {
        console.log(`🔧 Manual settlement requested for market ${marketId}`);

        try {
            const market = await this.contract.getMarket(marketId);
            return await this.settleMarket(marketId, market);
        } catch (error) {
            console.error(`🚨 Manual settlement failed for market ${marketId}:`, error);
            throw error;
        }
    }

    // Get settlement status
    async getSettlementStatus(marketId) {
        try {
            const market = await this.contract.getMarket(marketId);
            const [creator, endTime, isActive, metadata] = market;

            const now = Math.floor(Date.now() / 1000);
            const timeLeft = Number(endTime) - now;

            // Get vote counts from MongoDB
            const votes = await UserVote.find({ marketId });
            const yesVotes = votes.filter(v => v.vote === 'funny').length;
            const noVotes = votes.filter(v => v.vote === 'lame').length;

            return {
                marketId,
                isActive,
                timeLeft,
                readyForSettlement: timeLeft <= 0 && isActive,
                yesVotes,
                noVotes,
                totalVotes: votes.length,
                yellowNetworkStatus: yellowNetworkService.getStatus(),
            };
        } catch (error) {
            console.error(`Error getting settlement status for market ${marketId}:`, error);
            throw error;
        }
    }
}

module.exports = AutoSettlementService;
