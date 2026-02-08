import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/constants.dart';
import '../models/settlement.dart';
import '../models/user_vote.dart';

class ApiService {
  /// Record a vote (with Yellow Network transfer proof)
  Future<void> recordVote({
    required String userAddress,
    required int marketId,
    required String vote,
    String? transferId,
    String? memeCid,
  }) async {
    final response = await http.post(
      Uri.parse('$apiBaseUrl/api/user-vote'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'userAddress': userAddress,
        'marketId': marketId,
        'vote': vote,
        if (transferId != null) 'transferId': transferId,
        if (memeCid != null) 'memeCid': memeCid,
      }),
    );

    if (response.statusCode != 200) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(data['message'] ?? 'Failed to record vote');
    }
  }

  /// Create a new market (meme template) via relay
  Future<Map<String, dynamic>> createMarket({required String cid}) async {
    final response = await http.post(
      Uri.parse('$apiBaseUrl/api/market'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'cid': cid}),
    ).timeout(const Duration(seconds: 30));

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception(data['message'] ?? 'Market creation failed');
    }
    return data;
  }

  /// Create meme via relay (adds meme to existing market)
  Future<Map<String, dynamic>> createMeme({
    required String address,
    required String cid,
    required String templateId,
  }) async {
    final response = await http.post(
      Uri.parse('$apiBaseUrl/api/meme'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'address': address,
        'cid': cid,
        'templateId': templateId,
      }),
    );

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception(data['message'] ?? 'Meme creation failed');
    }
    return data;
  }

  /// Request faucet tokens (Sepolia ETH)
  Future<Map<String, dynamic>> requestFaucet(String address) async {
    final response = await http.get(
      Uri.parse('$apiBaseUrl/api/faucet/$address'),
    );

    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Get Yellow Network status from server
  Future<Map<String, dynamic>> getYellowStatus() async {
    final response = await http.get(
      Uri.parse('$apiBaseUrl/api/yellow-status'),
    );

    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Get user settlements
  Future<List<Settlement>> getUserSettlements(String address) async {
    final response = await http.get(
      Uri.parse('$apiBaseUrl/api/user-settlements/$address'),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to load settlements');
    }

    final list = jsonDecode(response.body) as List;
    return list
        .map((e) => Settlement.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Get user votes
  Future<List<UserVote>> getUserVotes(String address) async {
    final response = await http.get(
      Uri.parse('$apiBaseUrl/api/user-votes/$address'),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to load votes');
    }

    final list = jsonDecode(response.body) as List;
    return list
        .map((e) => UserVote.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Get all markets from backend (reads from contract via ethers.js)
  Future<List<Map<String, dynamic>>> getMarketsData() async {
    final response = await http.get(
      Uri.parse('$apiBaseUrl/api/markets-data'),
    ).timeout(const Duration(seconds: 30));

    if (response.statusCode != 200) {
      throw Exception('Failed to fetch markets');
    }

    final list = jsonDecode(response.body) as List;
    return list.cast<Map<String, dynamic>>();
  }

  /// Health check (includes Yellow Network status)
  Future<Map<String, dynamic>> healthCheck() async {
    try {
      final response = await http
          .get(Uri.parse('$apiBaseUrl/api/health'))
          .timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      }
      return {'status': 'error'};
    } catch (_) {
      return {'status': 'unreachable'};
    }
  }
}
