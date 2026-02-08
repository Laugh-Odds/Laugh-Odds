import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../models/market.dart';
import '../widgets/ipfs_image.dart';

class GalleryScreen extends StatefulWidget {
  const GalleryScreen({super.key});

  @override
  State<GalleryScreen> createState() => _GalleryScreenState();
}

class _GalleryScreenState extends State<GalleryScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<AppProvider>();
      if (provider.markets.isEmpty) {
        provider.loadMarkets();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Explore Memes', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => context.read<AppProvider>().loadMarkets(),
          ),
        ],
      ),
      body: Consumer<AppProvider>(
        builder: (context, provider, _) {
          if (provider.isLoadingMarkets) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.marketsError != null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: Colors.red),
                  const SizedBox(height: 16),
                  Text('Failed to load markets',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  ElevatedButton(
                    onPressed: () => provider.loadMarkets(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          if (provider.markets.isEmpty) {
            return const Center(
              child: Text('No markets yet. Be the first to create one!'),
            );
          }

          return RefreshIndicator(
            onRefresh: () => provider.loadMarkets(),
            child: GridView.builder(
              padding: const EdgeInsets.all(12),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 0.75,
              ),
              itemCount: provider.markets.length,
              itemBuilder: (context, index) {
                return _MarketCard(market: provider.markets[index]);
              },
            ),
          );
        },
      ),
    );
  }
}

class _MarketCard extends StatelessWidget {
  final Market market;

  const _MarketCard({required this.market});

  @override
  Widget build(BuildContext context) {
    // Use the first meme's CID as the card image, or metadata as fallback
    final imageCid = market.memes.isNotEmpty
        ? market.memes.first.cid
        : market.metadata;

    return GestureDetector(
      onTap: () => _showMarketDetail(context),
      child: Card(
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  IpfsImage(cid: imageCid, fit: BoxFit.cover),
                  // Status badge
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: market.isActive && !market.isExpired
                            ? Colors.green
                            : Colors.red,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        market.isActive && !market.isExpired ? 'Active' : 'Ended',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Market #${market.id}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.thumb_up, size: 12, color: Colors.green),
                      const SizedBox(width: 4),
                      Text('${market.yesVotes}',
                          style: const TextStyle(fontSize: 12, color: Colors.green)),
                      const SizedBox(width: 12),
                      const Icon(Icons.thumb_down, size: 12, color: Colors.red),
                      const SizedBox(width: 4),
                      Text('${market.noVotes}',
                          style: const TextStyle(fontSize: 12, color: Colors.red)),
                      const Spacer(),
                      Text(market.timeRemainingText,
                          style: TextStyle(fontSize: 11, color: Colors.grey[400])),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showMarketDetail(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.grey[900],
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.4,
        maxChildSize: 0.9,
        expand: false,
        builder: (_, controller) => ListView(
          controller: controller,
          padding: const EdgeInsets.all(20),
          children: [
            Center(
              child: Container(
                width: 40, height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[600],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text('Market #${market.id}',
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: IpfsImage(
                cid: market.memes.isNotEmpty
                    ? market.memes.first.cid
                    : market.metadata,
                height: 250,
                fit: BoxFit.cover,
              ),
            ),
            const SizedBox(height: 16),
            _detailRow('Status',
                market.isActive && !market.isExpired ? 'Active' : 'Ended'),
            _detailRow('Time Left', market.timeRemainingText),
            _detailRow('Funny Votes', market.yesVotes.toString()),
            _detailRow('Lame Votes', market.noVotes.toString()),
            _detailRow('Total Staked',
                '${(market.totalStaked.toInt() / 1e18).toStringAsFixed(4)} ytest.usd'),
            _detailRow('Memes Created', market.memes.length.toString()),
            if (market.memes.length > 1) ...[
              const SizedBox(height: 16),
              const Text('Memes in this market',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              SizedBox(
                height: 120,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: market.memes.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, i) => IpfsImage(
                    cid: market.memes[i].cid,
                    width: 120,
                    height: 120,
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey[400])),
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
