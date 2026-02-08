import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:web3dart/web3dart.dart';
import 'package:wallet/wallet.dart' show EthereumAddress;
import 'package:http/http.dart' as http;
import '../config/constants.dart';
import '../models/market.dart';
import '../models/meme.dart';

/// Reads market data from the FunnyOrFud contract on Sepolia.
class Web3Service {
  late Web3Client _client;
  late DeployedContract _contract;
  bool _initialized = false;

  Future<void> init() async {
    if (_initialized) return;

    _client = Web3Client(sepoliaRpcUrl, http.Client());

    final abiString = await rootBundle.loadString('assets/FunnyOrFud.json');
    final abiJson = jsonDecode(abiString);
    final abi = jsonEncode(abiJson['abi']);

    _contract = DeployedContract(
      ContractAbi.fromJson(abi, 'FunnyOrFud'),
      EthereumAddress.fromHex(contractAddress),
    );

    _initialized = true;
  }

  /// Get total number of markets
  Future<int> getMarketCount() async {
    await init();
    final result = await _client.call(
      contract: _contract,
      function: _contract.function('marketCount'),
      params: [],
    );
    return (result[0] as BigInt).toInt();
  }

  /// Get a single market by ID using markets(i) + getMarketMemes(i)
  Future<Market> getMarket(int marketId) async {
    await init();

    // Use the public mapping getter (flat fields, no nested array)
    final result = await _client.call(
      contract: _contract,
      function: _contract.function('markets'),
      params: [BigInt.from(marketId)],
    );
    // markets(i) returns: [creator, endTime, creatorFee, yesVotes, noVotes, totalStaked, isActive, metadata]

    // Get memes separately
    List<Meme> memes = [];
    try {
      final memesResult = await _client.call(
        contract: _contract,
        function: _contract.function('getMarketMemes'),
        params: [BigInt.from(marketId)],
      );
      final memesRaw = memesResult[0] as List<dynamic>;
      memes = memesRaw.map((m) {
        final fields = m as List<dynamic>;
        return Meme(
          creator: (fields[0] as EthereumAddress).eip55With0x,
          cid: fields[1] as String,
          memeTemplate: (fields[2] as BigInt).toInt(),
        );
      }).toList();
    } catch (e) {
      debugPrint('[Web3] getMarketMemes($marketId) failed: $e');
    }

    return Market(
      id: marketId,
      creator: (result[0] as EthereumAddress).eip55With0x,
      endTime: result[1] as BigInt,
      yesVotes: result[3] as BigInt,
      noVotes: result[4] as BigInt,
      totalStaked: result[5] as BigInt,
      isActive: result[6] as bool,
      metadata: result[7] as String,
      memes: memes,
    );
  }

  /// Get ETH balance for an address
  Future<String> getEthBalance(String address) async {
    await init();
    final balance = await _client.getBalance(EthereumAddress.fromHex(address));
    // Convert from wei to ETH (18 decimals)
    final ethValue = balance.getInWei / BigInt.from(10).pow(18);
    return ethValue.toStringAsFixed(4);
  }

  /// Get all markets
  Future<List<Market>> getAllMarkets() async {
    final count = await getMarketCount();
    debugPrint('[Web3] Market count: $count');
    final List<Market> markets = [];
    for (int i = 0; i < count; i++) {
      try {
        final market = await getMarket(i);
        debugPrint('[Web3] Market $i loaded: metadata=${market.metadata}');
        markets.add(market);
      } catch (e) {
        debugPrint('[Web3] Market $i FAILED: $e');
      }
    }
    return markets;
  }
}
