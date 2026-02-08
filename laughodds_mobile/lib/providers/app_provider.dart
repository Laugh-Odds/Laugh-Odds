import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/constants.dart';
import '../models/market.dart';
import '../models/meme.dart';
import '../models/settlement.dart';
import '../services/api_service.dart';
import '../services/web3_service.dart';
import '../services/yellow_network_service.dart';

class AppProvider extends ChangeNotifier {
  final ApiService _api = ApiService();
  final Web3Service _web3 = Web3Service();
  final YellowNetworkService _yellow = YellowNetworkService();
  StreamSubscription? _yellowStatusSub;

  // Wallet state
  String? _walletAddress;
  bool _isConnecting = false;

  // Market state
  List<Market> _markets = [];
  bool _isLoadingMarkets = false;
  String? _marketsError;

  // Settlement state
  List<Settlement> _settlements = [];
  bool _isLoadingSettlements = false;

  // ETH balance
  String _ethBalance = '0.00';

  // Vote tracking
  final Set<String> _votedMarkets = {};

  // Getters
  String? get walletAddress => _walletAddress;
  bool get isConnected => _walletAddress != null;
  bool get isConnecting => _isConnecting;
  List<Market> get markets => _markets;
  bool get isLoadingMarkets => _isLoadingMarkets;
  String? get marketsError => _marketsError;
  List<Settlement> get settlements => _settlements;
  bool get isLoadingSettlements => _isLoadingSettlements;
  ApiService get api => _api;
  Web3Service get web3 => _web3;

  // Yellow Network getters
  YellowNetworkService get yellow => _yellow;
  bool get isYellowConnected => _yellow.isConnected;
  bool get isYellowAuthenticated => _yellow.isAuthenticated;
  String get yellowBalance => _yellow.balance;
  String get ethBalance => _ethBalance;
  String? get yellowChannelId => _yellow.channelId;
  String? get yellowError => _yellow.error;

  AppProvider() {
    _yellowStatusSub = _yellow.statusStream.listen((_) {
      notifyListeners();
    });
  }

  @override
  void dispose() {
    _yellowStatusSub?.cancel();
    _yellow.dispose();
    super.dispose();
  }

  /// Connect wallet and Yellow Network
  Future<void> connectWallet(String address) async {
    _isConnecting = true;
    notifyListeners();

    try {
      _walletAddress = address;

      // Request backend faucet for Sepolia gas
      try {
        await _api.requestFaucet(address);
      } catch (e) {
        debugPrint('Faucet request failed: $e');
      }

      // Try Yellow Network (ClearNode WebSocket) - optional, voting works via relay
      try {
        await _yellow.connect(address);
      } catch (e) {
        debugPrint('Yellow Network connect failed (using relay): $e');
      }

      // Fetch ETH balance
      fetchEthBalance();

      // Load voted markets from SharedPreferences
      await _loadVotedMarkets();
    } catch (e) {
      debugPrint('Connect wallet error: $e');
    } finally {
      _isConnecting = false;
      notifyListeners();
    }
  }

  /// Disconnect wallet and Yellow Network
  void disconnectWallet() {
    _yellow.disconnect();
    _walletAddress = null;
    _settlements = [];
    _votedMarkets.clear();
    notifyListeners();
  }

  /// Refresh Yellow Network balance
  void refreshBalance() {
    _yellow.refreshBalance();
    fetchEthBalance();
  }

  /// Fetch Sepolia ETH balance
  Future<void> fetchEthBalance() async {
    if (_walletAddress == null) return;
    try {
      final balance = await _web3.getEthBalance(_walletAddress!);
      _ethBalance = balance;
      notifyListeners();
    } catch (e) {
      debugPrint('Fetch ETH balance error: $e');
    }
  }

  /// Load all markets from backend API (reads contract via ethers.js)
  Future<void> loadMarkets() async {
    _isLoadingMarkets = true;
    _marketsError = null;
    notifyListeners();

    try {
      final data = await _api.getMarketsData();
      _markets = data.map((m) {
        final memesRaw = m['memes'] as List? ?? [];
        final memes = memesRaw.map((me) => Meme(
          creator: me['creator'] as String? ?? '',
          cid: me['cid'] as String? ?? '',
          memeTemplate: me['memeTemplate'] as int? ?? 0,
        )).toList();

        return Market(
          id: m['id'] as int,
          creator: m['creator'] as String? ?? '',
          endTime: BigInt.from(m['endTime'] as int),
          yesVotes: BigInt.from(m['yesVotes'] as int? ?? 0),
          noVotes: BigInt.from(m['noVotes'] as int? ?? 0),
          totalStaked: BigInt.parse(m['totalStaked']?.toString() ?? '0'),
          isActive: m['isActive'] as bool? ?? false,
          metadata: m['metadata'] as String? ?? '',
          memes: memes,
        );
      }).toList();
    } catch (e) {
      _marketsError = e.toString();
      debugPrint('Load markets error: $e');
    } finally {
      _isLoadingMarkets = false;
      notifyListeners();
    }
  }

  /// Vote on a market - uses Yellow Network if authenticated, else backend relay
  Future<String> vote({
    required int marketId,
    required bool voteYes,
    String? memeCid,
  }) async {
    if (_walletAddress == null) throw Exception('Wallet not connected');

    final vote = voteYes ? 'funny' : 'lame';
    String transferId = '';

    // Try Yellow Network state channel first (gasless)
    if (_yellow.isAuthenticated) {
      final result = await _yellow.sendVoteTransfer(
        toAddress: serverYellowAddress,
        marketId: marketId,
        vote: vote,
      );

      if (result['success'] == true) {
        transferId = result['transferId'] as String? ?? '';
      } else {
        debugPrint('Yellow Network transfer failed: ${result['error']}, using backend relay');
      }
    }

    // Record vote on backend (works as relay - server handles on-chain)
    await _api.recordVote(
      userAddress: _walletAddress!,
      marketId: marketId,
      vote: vote,
      transferId: transferId.isNotEmpty ? transferId : null,
      memeCid: memeCid,
    );

    // Track locally
    final key = memeCid != null
        ? 'user_vote_${_walletAddress}_meme_$memeCid'
        : 'user_vote_${_walletAddress}_$marketId';
    _votedMarkets.add(key);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, vote);

    if (_yellow.isAuthenticated) {
      _yellow.refreshBalance();
    }
    return transferId;
  }

  /// Check if user has voted on a market
  bool hasVoted(int marketId) {
    if (_walletAddress == null) return false;
    return _votedMarkets.contains('user_vote_${_walletAddress}_$marketId');
  }

  /// Load voted markets from SharedPreferences
  Future<void> _loadVotedMarkets() async {
    if (_walletAddress == null) return;
    final prefs = await SharedPreferences.getInstance();
    final keys = prefs.getKeys();
    _votedMarkets.clear();
    for (final key in keys) {
      if (key.startsWith('user_vote_${_walletAddress}_')) {
        _votedMarkets.add(key);
      }
    }
  }

  /// Load settlements
  Future<void> loadSettlements() async {
    if (_walletAddress == null) return;
    _isLoadingSettlements = true;
    notifyListeners();

    try {
      _settlements = await _api.getUserSettlements(_walletAddress!);
    } catch (e) {
      debugPrint('Load settlements error: $e');
    } finally {
      _isLoadingSettlements = false;
      notifyListeners();
    }
  }

  /// Get user's vote on a market ('funny' or 'lame' or null)
  String? getVote(int marketId) {
    if (_walletAddress == null) return null;
    final key = 'user_vote_${_walletAddress}_$marketId';
    if (!_votedMarkets.contains(key)) return null;
    // We stored the vote value in SharedPreferences
    return null; // Will be loaded async
  }

  /// Get markets user has voted on
  List<Market> get votedMarkets {
    return _markets.where((m) => hasVoted(m.id)).toList();
  }

  /// Get vote value from SharedPreferences
  Future<String?> getVoteValue(int marketId) async {
    if (_walletAddress == null) return null;
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('user_vote_${_walletAddress}_$marketId');
  }

  /// Get unvoted active markets for swipe screen
  List<Market> get unvotedActiveMarkets {
    return _markets
        .where((m) => m.isActive && !m.isExpired && !hasVoted(m.id))
        .toList();
  }
}
