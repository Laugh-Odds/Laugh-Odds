import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../models/market.dart';
import '../widgets/ipfs_image.dart';

class SettlementsScreen extends StatefulWidget {
  const SettlementsScreen({super.key});

  @override
  State<SettlementsScreen> createState() => _SettlementsScreenState();
}

class _SettlementsScreenState extends State<SettlementsScreen> {
  final Map<int, String> _voteValues = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<AppProvider>();
      if (provider.markets.isEmpty) {
        provider.loadMarkets();
      }
      _loadVoteValues();
    });
  }

  Future<void> _loadVoteValues() async {
    final provider = context.read<AppProvider>();
    for (final market in provider.markets) {
      if (provider.hasVoted(market.id)) {
        final val = await provider.getVoteValue(market.id);
        if (val != null && mounted) {
          setState(() => _voteValues[market.id] = val);
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Votes',
            style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              context.read<AppProvider>().loadMarkets().then((_) => _loadVoteValues());
            },
          ),
        ],
      ),
      body: Consumer<AppProvider>(
        builder: (context, provider, _) {
          if (!provider.isConnected) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.account_balance_wallet_outlined,
                      size: 64, color: Colors.grey),
                  SizedBox(height: 16),
                  Text('Connect wallet to view your votes'),
                ],
              ),
            );
          }

          if (provider.isLoadingMarkets) {
            return const Center(child: CircularProgressIndicator());
          }

          final voted = provider.votedMarkets;

          if (voted.isEmpty) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.how_to_vote_outlined, size: 64, color: Colors.grey),
                  SizedBox(height: 16),
                  Text('No votes yet'),
                  SizedBox(height: 8),
                  Text('Swipe on memes in the Vote tab to get started',
                      style: TextStyle(color: Colors.grey)),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              await provider.loadMarkets();
              await _loadVoteValues();
            },
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: voted.length,
              itemBuilder: (context, index) {
                final market = voted[index];
                final vote = _voteValues[market.id];
                return _VotedMarketCard(market: market, vote: vote);
              },
            ),
          );
        },
      ),
    );
  }
}

class _VotedMarketCard extends StatelessWidget {
  final Market market;
  final String? vote;

  const _VotedMarketCard({required this.market, this.vote});

  @override
  Widget build(BuildContext context) {
    final isFunny = vote == 'funny';
    final imageCid = market.memes.isNotEmpty
        ? market.memes.first.cid
        : market.metadata;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            // Meme thumbnail
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: SizedBox(
                width: 70,
                height: 70,
                child: IpfsImage(cid: imageCid, fit: BoxFit.cover),
              ),
            ),
            const SizedBox(width: 14),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Market #${market.id}',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      if (vote != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: isFunny
                                ? Colors.green.withValues(alpha: 0.15)
                                : Colors.red.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                isFunny ? Icons.thumb_up : Icons.thumb_down,
                                size: 14,
                                color: isFunny ? Colors.green : Colors.red,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                isFunny ? 'Funny' : 'Lame',
                                style: TextStyle(
                                  color: isFunny ? Colors.green : Colors.red,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: market.isActive && !market.isExpired
                              ? Colors.blue.withValues(alpha: 0.15)
                              : Colors.grey.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          market.isActive && !market.isExpired ? 'Active' : 'Ended',
                          style: TextStyle(
                            color: market.isActive && !market.isExpired
                                ? Colors.blue
                                : Colors.grey,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            // Time remaining
            Text(
              market.timeRemainingText,
              style: TextStyle(color: Colors.grey[400], fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}
