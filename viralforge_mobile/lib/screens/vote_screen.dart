import 'package:flutter/material.dart';
import 'package:flutter_card_swiper/flutter_card_swiper.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../models/market.dart';
import '../widgets/ipfs_image.dart';

class VoteScreen extends StatefulWidget {
  const VoteScreen({super.key});

  @override
  State<VoteScreen> createState() => _VoteScreenState();
}

class _VoteScreenState extends State<VoteScreen> {
  final CardSwiperController _swiperController = CardSwiperController();
  bool _isVoting = false;
  CardSwiperDirection? _currentDirection;

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
  void dispose() {
    _swiperController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Vote', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          Consumer<AppProvider>(
            builder: (_, provider, __) {
              if (!provider.isConnected) return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.only(right: 16),
                child: Center(
                  child: Text(
                    '${provider.ethBalance} ETH',
                    style: TextStyle(color: Colors.amber[300], fontWeight: FontWeight.bold),
                  ),
                ),
              );
            },
          ),
        ],
      ),
      body: Consumer<AppProvider>(
        builder: (context, provider, _) {
          if (!provider.isConnected) {
            return _buildConnectPrompt(context);
          }

          if (provider.isLoadingMarkets) {
            return const Center(child: CircularProgressIndicator());
          }

          final cards = provider.unvotedActiveMarkets;

          if (cards.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.check_circle_outline, size: 64, color: Colors.green),
                  const SizedBox(height: 16),
                  const Text("You've voted on everything!",
                      style: TextStyle(fontSize: 18)),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: () => provider.loadMarkets(),
                    child: const Text('Refresh'),
                  ),
                ],
              ),
            );
          }

          return Column(
            children: [
              // Instructions
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _buildHint(Icons.thumb_down, 'Lame', Colors.red, 'Swipe Left'),
                    _buildHint(Icons.thumb_up, 'Funny', Colors.green, 'Swipe Right'),
                  ],
                ),
              ),
              // Swiper
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: CardSwiper(
                    controller: _swiperController,
                    cardsCount: cards.length,
                    numberOfCardsDisplayed: cards.length > 1 ? 2 : 1,
                    allowedSwipeDirection: AllowedSwipeDirection.symmetric(
                      horizontal: true,
                      vertical: false,
                    ),
                    onSwipeDirectionChange: (horizontalDirection, verticalDirection) {
                      setState(() => _currentDirection = horizontalDirection);
                    },
                    onSwipe: (prevIndex, currentIndex, direction) {
                      _handleSwipe(cards[prevIndex], direction);
                      setState(() => _currentDirection = null);
                      return true;
                    },
                    onEnd: () {
                      setState(() {});
                    },
                    cardBuilder: (context, index, percentThresholdX, percentThresholdY) {
                      return _VoteCard(
                        market: cards[index],
                        swipeDirection: index == 0 ? _currentDirection : null,
                        isVoting: _isVoting && index == 0,
                      );
                    },
                  ),
                ),
              ),
              const SizedBox(height: 20),
              // Button row
              Padding(
                padding: const EdgeInsets.only(bottom: 24),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _buildActionButton(
                      Icons.close,
                      Colors.red,
                      () => _swiperController.swipe(CardSwiperDirection.left),
                    ),
                    _buildActionButton(
                      Icons.favorite,
                      Colors.green,
                      () => _swiperController.swipe(CardSwiperDirection.right),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildConnectPrompt(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.account_balance_wallet_outlined, size: 64, color: Colors.amber),
          const SizedBox(height: 16),
          const Text('Connect your wallet to start voting',
              style: TextStyle(fontSize: 16)),
          const SizedBox(height: 4),
          Text('Swipe right for Funny, left for Lame',
              style: TextStyle(color: Colors.grey[500], fontSize: 13)),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            icon: const Icon(Icons.link),
            label: const Text('Go to Wallet'),
            onPressed: () => context.go('/wallet'),
          ),
        ],
      ),
    );
  }

  Widget _buildHint(IconData icon, String label, Color color, String hint) {
    return Column(
      children: [
        Icon(icon, color: color, size: 28),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(color: color, fontWeight: FontWeight.bold)),
        Text(hint, style: TextStyle(color: Colors.grey[500], fontSize: 11)),
      ],
    );
  }

  Widget _buildActionButton(IconData icon, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: _isVoting ? null : onTap,
      child: Container(
        width: 60,
        height: 60,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: color, width: 2),
        ),
        child: Icon(icon, color: color, size: 30),
      ),
    );
  }

  void _handleSwipe(Market market, CardSwiperDirection direction) async {
    if (direction != CardSwiperDirection.left &&
        direction != CardSwiperDirection.right) return;

    final voteYes = direction == CardSwiperDirection.right;

    setState(() => _isVoting = true);

    try {
      final provider = context.read<AppProvider>();
      await provider.vote(
        marketId: market.id,
        voteYes: voteYes,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Voted ${voteYes ? "Funny" : "Lame"} on Market #${market.id}',
            ),
            backgroundColor: voteYes ? Colors.green[700] : Colors.red[700],
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Vote failed: ${e.toString().replaceFirst("Exception: ", "")}'),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isVoting = false);
    }
  }
}

class _VoteCard extends StatelessWidget {
  final Market market;
  final CardSwiperDirection? swipeDirection;
  final bool isVoting;

  const _VoteCard({
    required this.market,
    this.swipeDirection,
    this.isVoting = false,
  });

  @override
  Widget build(BuildContext context) {
    final imageCid =
        market.memes.isNotEmpty ? market.memes.first.cid : market.metadata;

    return Stack(
      fit: StackFit.expand,
      children: [
        // Card
        Card(
          clipBehavior: Clip.antiAlias,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          elevation: 8,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: IpfsImage(cid: imageCid, fit: BoxFit.cover),
              ),
              Container(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Market #${market.id}',
                      style: const TextStyle(
                          fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        _statChip(Icons.thumb_up, '${market.yesVotes}', Colors.green),
                        const SizedBox(width: 12),
                        _statChip(Icons.thumb_down, '${market.noVotes}', Colors.red),
                        const Spacer(),
                        Icon(Icons.timer, size: 14, color: Colors.grey[400]),
                        const SizedBox(width: 4),
                        Text(market.timeRemainingText,
                            style: TextStyle(color: Colors.grey[400], fontSize: 13)),
                      ],
                    ),
                    if (isVoting) ...[
                      const SizedBox(height: 8),
                      const LinearProgressIndicator(),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        // Green overlay (swipe right = Funny)
        if (swipeDirection == CardSwiperDirection.right)
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                color: Colors.green.withValues(alpha: 0.3),
              ),
              child: const Center(
                child: Icon(Icons.thumb_up, size: 80, color: Colors.white),
              ),
            ),
          ),
        // Red overlay (swipe left = Lame)
        if (swipeDirection == CardSwiperDirection.left)
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                color: Colors.red.withValues(alpha: 0.3),
              ),
              child: const Center(
                child: Icon(Icons.thumb_down, size: 80, color: Colors.white),
              ),
            ),
          ),
      ],
    );
  }

  Widget _statChip(IconData icon, String value, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 4),
        Text(value, style: TextStyle(color: color, fontWeight: FontWeight.bold)),
      ],
    );
  }
}
